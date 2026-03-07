-- Admin portal foundation:
-- 1) add admin role
-- 2) provide secure RPCs for owner operations
-- 3) prevent non-admin role escalation via direct profile updates

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

CREATE OR REPLACE FUNCTION public.require_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_profile_role_change_unless_admin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    PERFORM public.require_admin();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_role_change_unless_admin ON public.profiles;
CREATE TRIGGER prevent_profile_role_change_unless_admin
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_role_change_unless_admin();

CREATE OR REPLACE FUNCTION public.admin_dashboard_metrics()
RETURNS TABLE (
  total_users bigint,
  total_couples bigint,
  total_planners bigint,
  total_vendors bigint,
  total_admins bigint,
  total_vendor_listings bigint,
  pending_vendor_approvals bigint,
  total_tasks bigint,
  total_guests bigint,
  total_budget_items bigint,
  total_clients bigint,
  open_link_requests bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.profiles),
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'couple'::public.app_role),
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'planner'::public.app_role),
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'vendor'::public.app_role),
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'admin'::public.app_role),
    (SELECT COUNT(*) FROM public.vendor_listings),
    (SELECT COUNT(*) FROM public.vendor_listings WHERE is_approved = false),
    (SELECT COUNT(*) FROM public.tasks),
    (SELECT COUNT(*) FROM public.guests),
    (SELECT COUNT(*) FROM public.budget_categories),
    (SELECT COUNT(*) FROM public.planner_clients),
    (SELECT COUNT(*) FROM public.planner_link_requests WHERE status = 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users(
  search_query text DEFAULT NULL,
  role_filter public.app_role DEFAULT NULL,
  limit_rows integer DEFAULT 100,
  offset_rows integer DEFAULT 0
)
RETURNS TABLE (
  user_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  full_name text,
  role public.app_role,
  company_name text,
  wedding_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();

  RETURN QUERY
  SELECT
    p.user_id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    p.full_name,
    p.role,
    p.company_name,
    p.wedding_date
  FROM public.profiles p
  LEFT JOIN auth.users u
    ON u.id = p.user_id
  WHERE
    (search_query IS NULL OR
      p.full_name ILIKE '%' || search_query || '%' OR
      p.company_name ILIKE '%' || search_query || '%' OR
      u.email ILIKE '%' || search_query || '%')
    AND
    (role_filter IS NULL OR p.role = role_filter)
  ORDER BY COALESCE(u.created_at, p.created_at) DESC
  LIMIT GREATEST(1, LEAST(limit_rows, 200))
  OFFSET GREATEST(0, offset_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  target_user_id uuid,
  new_role public.app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_exists boolean;
BEGIN
  PERFORM public.require_admin();

  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = target_user_id
  ) INTO user_exists;

  IF NOT user_exists THEN
    RAISE EXCEPTION 'Target user profile not found'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.profiles
  SET role = new_role
  WHERE user_id = target_user_id;

  DELETE FROM public.user_roles
  WHERE user_id = target_user_id
    AND role IS DISTINCT FROM new_role;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, new_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_vendor_listings(
  search_query text DEFAULT NULL,
  status_filter text DEFAULT 'all',
  limit_rows integer DEFAULT 100,
  offset_rows integer DEFAULT 0
)
RETURNS TABLE (
  listing_id uuid,
  user_id uuid,
  business_name text,
  category text,
  location text,
  is_approved boolean,
  is_verified boolean,
  updated_at timestamptz,
  owner_name text,
  owner_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();

  RETURN QUERY
  SELECT
    v.id,
    v.user_id,
    v.business_name,
    v.category,
    v.location,
    v.is_approved,
    v.is_verified,
    v.updated_at,
    p.full_name,
    u.email
  FROM public.vendor_listings v
  LEFT JOIN public.profiles p
    ON p.user_id = v.user_id
  LEFT JOIN auth.users u
    ON u.id = v.user_id
  WHERE
    (
      status_filter = 'all'
      OR (status_filter = 'pending' AND v.is_approved = false)
      OR (status_filter = 'approved' AND v.is_approved = true)
    )
    AND (
      search_query IS NULL
      OR v.business_name ILIKE '%' || search_query || '%'
      OR v.category ILIKE '%' || search_query || '%'
      OR p.full_name ILIKE '%' || search_query || '%'
      OR u.email ILIKE '%' || search_query || '%'
    )
  ORDER BY v.updated_at DESC
  LIMIT GREATEST(1, LEAST(limit_rows, 200))
  OFFSET GREATEST(0, offset_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_vendor_listing(
  listing_id uuid,
  approve boolean,
  verify boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_verify boolean;
BEGIN
  PERFORM public.require_admin();

  normalized_verify := CASE WHEN approve THEN verify ELSE false END;

  UPDATE public.vendor_listings
  SET
    is_approved = approve,
    is_verified = normalized_verify
  WHERE id = listing_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor listing not found'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.require_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.require_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_dashboard_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_metrics() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_list_users(text, public.app_role, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, public.app_role, integer, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_list_vendor_listings(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_vendor_listings(text, text, integer, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_review_vendor_listing(uuid, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_vendor_listing(uuid, boolean, boolean) TO authenticated;
