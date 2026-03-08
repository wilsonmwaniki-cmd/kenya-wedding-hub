
-- Add 'admin' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

-- Admin dashboard metrics function
CREATE OR REPLACE FUNCTION public.admin_dashboard_metrics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Only allow admins
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT json_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'total_couples', (SELECT count(*) FROM public.profiles WHERE role = 'couple'),
    'total_planners', (SELECT count(*) FROM public.profiles WHERE role = 'planner'),
    'total_vendors', (SELECT count(*) FROM public.profiles WHERE role = 'vendor'),
    'total_admins', (SELECT count(*) FROM public.profiles WHERE role = 'admin'),
    'total_vendor_listings', (SELECT count(*) FROM public.vendor_listings),
    'pending_vendor_approvals', (SELECT count(*) FROM public.vendor_listings WHERE is_approved = false),
    'total_tasks', (SELECT count(*) FROM public.tasks),
    'total_guests', (SELECT count(*) FROM public.guests),
    'total_budget_items', (SELECT count(*) FROM public.budget_categories),
    'total_clients', (SELECT count(*) FROM public.planner_clients),
    'open_link_requests', (SELECT count(*) FROM public.planner_link_requests WHERE status = 'pending')
  ) INTO result;

  RETURN result;
END;
$$;

-- Admin list users function
CREATE OR REPLACE FUNCTION public.admin_list_users(
  search_query text DEFAULT NULL,
  role_filter text DEFAULT NULL,
  limit_rows int DEFAULT 100,
  offset_rows int DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT json_agg(row_to_json(t)) INTO result
  FROM (
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
    LEFT JOIN auth.users u ON u.id = p.user_id
    WHERE
      (search_query IS NULL OR
        p.full_name ILIKE '%' || search_query || '%' OR
        u.email ILIKE '%' || search_query || '%' OR
        p.company_name ILIKE '%' || search_query || '%')
      AND (role_filter IS NULL OR p.role::text = role_filter)
    ORDER BY u.created_at DESC NULLS LAST
    LIMIT limit_rows OFFSET offset_rows
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Admin list vendor listings function
CREATE OR REPLACE FUNCTION public.admin_list_vendor_listings(
  search_query text DEFAULT NULL,
  status_filter text DEFAULT 'all',
  limit_rows int DEFAULT 100,
  offset_rows int DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT json_agg(row_to_json(t)) INTO result
  FROM (
    SELECT
      vl.id AS listing_id,
      vl.user_id,
      vl.business_name,
      vl.category,
      vl.location,
      vl.is_approved,
      vl.is_verified,
      vl.updated_at,
      p.full_name AS owner_name,
      u.email AS owner_email
    FROM public.vendor_listings vl
    LEFT JOIN public.profiles p ON p.user_id = vl.user_id
    LEFT JOIN auth.users u ON u.id = vl.user_id
    WHERE
      (search_query IS NULL OR
        vl.business_name ILIKE '%' || search_query || '%' OR
        vl.category ILIKE '%' || search_query || '%' OR
        p.full_name ILIKE '%' || search_query || '%')
      AND (status_filter = 'all' OR
        (status_filter = 'pending' AND vl.is_approved = false) OR
        (status_filter = 'approved' AND vl.is_approved = true))
    ORDER BY vl.updated_at DESC
    LIMIT limit_rows OFFSET offset_rows
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Admin set user role function
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  target_user_id uuid,
  new_role app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Update profile role
  UPDATE public.profiles SET role = new_role, updated_at = now() WHERE user_id = target_user_id;

  -- Upsert user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, new_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Remove old roles from user_roles
  DELETE FROM public.user_roles WHERE user_id = target_user_id AND role != new_role;
END;
$$;

-- Admin review vendor listing function
CREATE OR REPLACE FUNCTION public.admin_review_vendor_listing(
  listing_id uuid,
  approve boolean,
  verify boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.vendor_listings
  SET is_approved = approve, is_verified = verify, updated_at = now()
  WHERE id = listing_id;
END;
$$;
