ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS beta_trial_status text NOT NULL DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS beta_trial_started_at timestamptz,
ADD COLUMN IF NOT EXISTS beta_trial_expires_at timestamptz;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_beta_trial_status_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_beta_trial_status_check
CHECK (beta_trial_status IN ('inactive', 'active', 'expired', 'cancelled'));

UPDATE public.profiles
SET
  beta_trial_status = 'active',
  beta_trial_started_at = now(),
  beta_trial_expires_at = now() + interval '14 days',
  updated_at = now()
WHERE beta_trial_status = 'inactive'
  AND beta_trial_started_at IS NULL
  AND beta_trial_expires_at IS NULL;

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
      AND (
        (
          p.planner_subscription_status = 'active'
          AND (p.planner_subscription_expires_at IS NULL OR p.planner_subscription_expires_at > now())
        )
        OR (
          p.beta_trial_status = 'active'
          AND p.beta_trial_expires_at IS NOT NULL
          AND p.beta_trial_expires_at > now()
        )
      )
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

  IF NOT (
    (
      profile_record.planner_subscription_status = 'active'
      AND (
        profile_record.planner_subscription_expires_at IS NULL
        OR profile_record.planner_subscription_expires_at > now()
      )
    )
    OR (
      profile_record.beta_trial_status = 'active'
      AND profile_record.beta_trial_expires_at IS NOT NULL
      AND profile_record.beta_trial_expires_at > now()
    )
  ) THEN
    RAISE EXCEPTION 'An active subscription or beta trial is required before verification can be requested'
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
  AND (
    (
      planner_subscription_status = 'active'
      AND (planner_subscription_expires_at IS NULL OR planner_subscription_expires_at > now())
    )
    OR (
      beta_trial_status = 'active'
      AND beta_trial_expires_at IS NOT NULL
      AND beta_trial_expires_at > now()
    )
  );

GRANT SELECT ON public.public_planner_profiles TO anon;
GRANT SELECT ON public.public_planner_profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.vendor_listing_has_full_access(target_listing_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vendor_listings vl
    LEFT JOIN public.profiles p
      ON p.user_id = vl.user_id
    WHERE vl.id = target_listing_id
      AND vl.is_approved = true
      AND vl.is_verified = true
      AND (
        (
          vl.subscription_status = 'active'
          AND (vl.subscription_expires_at IS NULL OR vl.subscription_expires_at > now())
        )
        OR (
          p.beta_trial_status = 'active'
          AND p.beta_trial_expires_at IS NOT NULL
          AND p.beta_trial_expires_at > now()
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.request_vendor_verification()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing_record public.vendor_listings%ROWTYPE;
  profile_record public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO listing_record
  FROM public.vendor_listings
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor listing not found'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT *
  INTO profile_record
  FROM public.profiles
  WHERE user_id = auth.uid();

  IF listing_record.is_approved = false THEN
    RAISE EXCEPTION 'Listing approval is required before verification can be requested'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (
    (
      listing_record.subscription_status = 'active'
      AND (
        listing_record.subscription_expires_at IS NULL
        OR listing_record.subscription_expires_at > now()
      )
    )
    OR (
      profile_record.beta_trial_status = 'active'
      AND profile_record.beta_trial_expires_at IS NOT NULL
      AND profile_record.beta_trial_expires_at > now()
    )
  ) THEN
    RAISE EXCEPTION 'An active subscription or beta trial is required before verification can be requested'
      USING ERRCODE = 'P0001';
  END IF;

  IF listing_record.is_verified THEN
    RAISE EXCEPTION 'Listing is already verified'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.vendor_listings
  SET
    verification_requested = true,
    verification_requested_at = now(),
    updated_at = now()
  WHERE id = listing_record.id;
END;
$$;
