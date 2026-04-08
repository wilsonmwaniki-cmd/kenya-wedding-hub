ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS wedding_county text,
ADD COLUMN IF NOT EXISTS wedding_town text,
ADD COLUMN IF NOT EXISTS primary_county text,
ADD COLUMN IF NOT EXISTS primary_town text,
ADD COLUMN IF NOT EXISTS service_areas text[] NOT NULL DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS travel_scope text NOT NULL DEFAULT 'selected_counties',
ADD COLUMN IF NOT EXISTS minimum_budget_kes numeric,
ADD COLUMN IF NOT EXISTS maximum_budget_kes numeric;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_travel_scope_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_travel_scope_check
CHECK (travel_scope IN ('local_only', 'selected_counties', 'nationwide'));

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_budget_band_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_budget_band_check
CHECK (
  (minimum_budget_kes IS NULL OR minimum_budget_kes >= 0)
  AND (maximum_budget_kes IS NULL OR maximum_budget_kes >= 0)
  AND (
    minimum_budget_kes IS NULL
    OR maximum_budget_kes IS NULL
    OR minimum_budget_kes <= maximum_budget_kes
  )
);

ALTER TABLE public.vendor_listings
ADD COLUMN IF NOT EXISTS location_county text,
ADD COLUMN IF NOT EXISTS location_town text,
ADD COLUMN IF NOT EXISTS service_areas text[] NOT NULL DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS travel_scope text NOT NULL DEFAULT 'selected_counties',
ADD COLUMN IF NOT EXISTS minimum_budget_kes numeric,
ADD COLUMN IF NOT EXISTS maximum_budget_kes numeric;

ALTER TABLE public.vendor_listings
DROP CONSTRAINT IF EXISTS vendor_listings_travel_scope_check;

ALTER TABLE public.vendor_listings
ADD CONSTRAINT vendor_listings_travel_scope_check
CHECK (travel_scope IN ('local_only', 'selected_counties', 'nationwide'));

ALTER TABLE public.vendor_listings
DROP CONSTRAINT IF EXISTS vendor_listings_budget_band_check;

ALTER TABLE public.vendor_listings
ADD CONSTRAINT vendor_listings_budget_band_check
CHECK (
  (minimum_budget_kes IS NULL OR minimum_budget_kes >= 0)
  AND (maximum_budget_kes IS NULL OR maximum_budget_kes >= 0)
  AND (
    minimum_budget_kes IS NULL
    OR maximum_budget_kes IS NULL
    OR minimum_budget_kes <= maximum_budget_kes
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
  company_website,
  primary_county,
  primary_town,
  service_areas,
  travel_scope,
  minimum_budget_kes,
  maximum_budget_kes
FROM public.profiles
WHERE role = 'planner'::public.app_role
  AND COALESCE(planner_type, 'professional') = 'professional'
  AND planner_verified = true
  AND planner_subscription_status = 'active'
  AND (planner_subscription_expires_at IS NULL OR planner_subscription_expires_at > now());

GRANT SELECT ON public.public_planner_profiles TO anon;
GRANT SELECT ON public.public_planner_profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role_text text;
  requested_role public.app_role;
  requested_planner_type text;
  resolved_planner_type text;
  resolved_committee_name text;
  resolved_wedding_county text;
  resolved_wedding_town text;
  resolved_primary_county text;
  resolved_primary_town text;
  resolved_service_areas text[];
  resolved_travel_scope text;
  resolved_minimum_budget numeric;
  resolved_maximum_budget numeric;
  resolved_wedding_location text;
BEGIN
  requested_role_text := lower(COALESCE(NEW.raw_user_meta_data->>'role', 'couple'));
  requested_planner_type := lower(COALESCE(NEW.raw_user_meta_data->>'planner_type', ''));

  requested_role := CASE
    WHEN requested_role_text IN ('planner', 'committee') THEN 'planner'::public.app_role
    WHEN requested_role_text = 'vendor' THEN 'vendor'::public.app_role
    ELSE 'couple'::public.app_role
  END;

  resolved_planner_type := CASE
    WHEN requested_role_text = 'committee' THEN 'committee'
    WHEN requested_role = 'planner'::public.app_role AND requested_planner_type = 'committee' THEN 'committee'
    WHEN requested_role = 'planner'::public.app_role THEN 'professional'
    ELSE NULL
  END;

  resolved_committee_name := CASE
    WHEN resolved_planner_type = 'committee'
      THEN NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'committee_name', '')), '')
    ELSE NULL
  END;

  resolved_wedding_county := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'wedding_county', '')), '');
  resolved_wedding_town := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'wedding_town', '')), '');
  resolved_primary_county := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'primary_county', '')), '');
  resolved_primary_town := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'primary_town', '')), '');

  resolved_service_areas := COALESCE(
    ARRAY(
      SELECT jsonb_array_elements_text(COALESCE(NEW.raw_user_meta_data->'service_areas', '[]'::jsonb))
    ),
    '{}'::text[]
  );

  resolved_travel_scope := lower(COALESCE(NEW.raw_user_meta_data->>'travel_scope', 'selected_counties'));
  IF resolved_travel_scope NOT IN ('local_only', 'selected_counties', 'nationwide') THEN
    resolved_travel_scope := 'selected_counties';
  END IF;

  resolved_minimum_budget := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'minimum_budget_kes', '')), '')::numeric;
  resolved_maximum_budget := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'maximum_budget_kes', '')), '')::numeric;
  resolved_wedding_location := NULLIF(trim(concat_ws(', ', resolved_wedding_town, resolved_wedding_county)), '');

  INSERT INTO public.profiles (
    user_id,
    full_name,
    role,
    planner_type,
    committee_name,
    wedding_county,
    wedding_town,
    wedding_location,
    primary_county,
    primary_town,
    service_areas,
    travel_scope,
    minimum_budget_kes,
    maximum_budget_kes
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    requested_role,
    resolved_planner_type,
    resolved_committee_name,
    resolved_wedding_county,
    resolved_wedding_town,
    resolved_wedding_location,
    resolved_primary_county,
    resolved_primary_town,
    resolved_service_areas,
    resolved_travel_scope,
    resolved_minimum_budget,
    resolved_maximum_budget
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    planner_type = EXCLUDED.planner_type,
    committee_name = COALESCE(EXCLUDED.committee_name, public.profiles.committee_name),
    wedding_county = COALESCE(EXCLUDED.wedding_county, public.profiles.wedding_county),
    wedding_town = COALESCE(EXCLUDED.wedding_town, public.profiles.wedding_town),
    wedding_location = COALESCE(EXCLUDED.wedding_location, public.profiles.wedding_location),
    primary_county = COALESCE(EXCLUDED.primary_county, public.profiles.primary_county),
    primary_town = COALESCE(EXCLUDED.primary_town, public.profiles.primary_town),
    service_areas = CASE
      WHEN cardinality(EXCLUDED.service_areas) > 0 THEN EXCLUDED.service_areas
      ELSE public.profiles.service_areas
    END,
    travel_scope = COALESCE(EXCLUDED.travel_scope, public.profiles.travel_scope),
    minimum_budget_kes = COALESCE(EXCLUDED.minimum_budget_kes, public.profiles.minimum_budget_kes),
    maximum_budget_kes = COALESCE(EXCLUDED.maximum_budget_kes, public.profiles.maximum_budget_kes);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, requested_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
