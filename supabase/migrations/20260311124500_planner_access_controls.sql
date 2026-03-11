ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS planner_verified boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS planner_verification_requested boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS planner_verification_requested_at timestamptz,
ADD COLUMN IF NOT EXISTS planner_subscription_status text NOT NULL DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS planner_subscription_started_at timestamptz,
ADD COLUMN IF NOT EXISTS planner_subscription_expires_at timestamptz;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_planner_subscription_status_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_planner_subscription_status_check
CHECK (planner_subscription_status IN ('inactive', 'active', 'past_due', 'cancelled'));

CREATE OR REPLACE FUNCTION public.planner_profile_has_full_access(target_planner_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = target_planner_user_id
      AND p.role = 'planner'::public.app_role
      AND p.planner_verified = true
      AND p.planner_subscription_status = 'active'
      AND (p.planner_subscription_expires_at IS NULL OR p.planner_subscription_expires_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.request_planner_verification()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_record public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO profile_record
  FROM public.profiles
  WHERE user_id = auth.uid()
    AND role = 'planner'::public.app_role;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Planner profile not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF profile_record.planner_subscription_status <> 'active'
     OR (profile_record.planner_subscription_expires_at IS NOT NULL AND profile_record.planner_subscription_expires_at <= now()) THEN
    RAISE EXCEPTION 'An active subscription is required before verification can be requested'
      USING ERRCODE = 'P0001';
  END IF;

  IF profile_record.planner_verified THEN
    RAISE EXCEPTION 'Planner profile is already verified'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles
  SET
    planner_verification_requested = true,
    planner_verification_requested_at = now(),
    updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

DROP POLICY IF EXISTS "Couples can insert own requests" ON public.planner_link_requests;
CREATE POLICY "Couples can insert own requests"
ON public.planner_link_requests FOR INSERT
WITH CHECK (
  auth.uid() = couple_user_id
  AND public.planner_profile_has_full_access(planner_user_id)
);

DROP POLICY IF EXISTS "Planners can view requests to them" ON public.planner_link_requests;
CREATE POLICY "Planners can view requests to them"
ON public.planner_link_requests FOR SELECT
USING (
  auth.uid() = planner_user_id
  AND public.planner_profile_has_full_access(planner_user_id)
);

DROP POLICY IF EXISTS "Planners can update requests to them" ON public.planner_link_requests;
CREATE POLICY "Planners can update requests to them"
ON public.planner_link_requests FOR UPDATE
USING (
  auth.uid() = planner_user_id
  AND public.planner_profile_has_full_access(planner_user_id)
)
WITH CHECK (
  auth.uid() = planner_user_id
  AND public.planner_profile_has_full_access(planner_user_id)
);

DROP POLICY IF EXISTS "Requesters can insert own requests" ON public.vendor_connection_requests;
CREATE POLICY "Requesters can insert own requests"
ON public.vendor_connection_requests
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = requester_user_id
  AND public.vendor_listing_has_full_access(vendor_listing_id)
  AND (
    NOT public.has_role(auth.uid(), 'planner'::public.app_role)
    OR public.planner_profile_has_full_access(auth.uid())
  )
);

DROP VIEW IF EXISTS public.public_planner_profiles;
CREATE VIEW public.public_planner_profiles AS
SELECT
  id,
  user_id,
  full_name,
  company_name,
  avatar_url,
  bio,
  specialties,
  company_email,
  company_phone,
  company_website
FROM public.profiles
WHERE role = 'planner'::public.app_role
  AND planner_verified = true
  AND planner_subscription_status = 'active'
  AND (planner_subscription_expires_at IS NULL OR planner_subscription_expires_at > now());

GRANT SELECT ON public.public_planner_profiles TO anon;
GRANT SELECT ON public.public_planner_profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_planner_profiles(
  search_query text DEFAULT NULL,
  verification_filter text DEFAULT 'all',
  limit_rows integer DEFAULT 100,
  offset_rows integer DEFAULT 0
)
RETURNS TABLE (
  profile_id uuid,
  user_id uuid,
  full_name text,
  company_name text,
  company_email text,
  planner_verified boolean,
  planner_verification_requested boolean,
  planner_verification_requested_at timestamptz,
  planner_subscription_status text,
  planner_subscription_expires_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();

  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.full_name::text,
    p.company_name::text,
    p.company_email::text,
    p.planner_verified,
    p.planner_verification_requested,
    p.planner_verification_requested_at,
    p.planner_subscription_status::text,
    p.planner_subscription_expires_at,
    p.updated_at::timestamptz
  FROM public.profiles p
  WHERE p.role = 'planner'::public.app_role
    AND (
      verification_filter = 'all'
      OR (verification_filter = 'pending' AND p.planner_verified = false)
      OR (verification_filter = 'verified' AND p.planner_verified = true)
      OR (verification_filter = 'requested' AND p.planner_verification_requested = true)
    )
    AND (
      search_query IS NULL
      OR p.full_name ILIKE '%' || search_query || '%'
      OR p.company_name ILIKE '%' || search_query || '%'
      OR p.company_email ILIKE '%' || search_query || '%'
    )
  ORDER BY p.updated_at DESC
  LIMIT GREATEST(1, LEAST(limit_rows, 200))
  OFFSET GREATEST(0, offset_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_planner_access(
  target_user_id uuid,
  new_verified boolean,
  new_subscription_status text,
  new_subscription_expires_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();

  IF new_subscription_status NOT IN ('inactive', 'active', 'past_due', 'cancelled') THEN
    RAISE EXCEPTION 'Unsupported subscription status'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles
  SET
    planner_verified = new_verified,
    planner_verification_requested = CASE WHEN new_verified THEN false ELSE planner_verification_requested END,
    planner_verification_requested_at = CASE WHEN new_verified THEN NULL ELSE planner_verification_requested_at END,
    planner_subscription_status = new_subscription_status,
    planner_subscription_started_at = CASE
      WHEN new_subscription_status = 'active' THEN COALESCE(planner_subscription_started_at, now())
      ELSE planner_subscription_started_at
    END,
    planner_subscription_expires_at = new_subscription_expires_at,
    updated_at = now()
  WHERE user_id = target_user_id
    AND role = 'planner'::public.app_role;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Planner profile not found'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.planner_profile_has_full_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.planner_profile_has_full_access(uuid) TO authenticated, anon;

REVOKE EXECUTE ON FUNCTION public.request_planner_verification() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_planner_verification() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_list_planner_profiles(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_planner_profiles(text, text, integer, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_set_planner_access(uuid, boolean, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_planner_access(uuid, boolean, text, timestamptz) TO authenticated;
