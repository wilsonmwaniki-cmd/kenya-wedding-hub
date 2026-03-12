ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS planner_type text,
ADD COLUMN IF NOT EXISTS committee_name text;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_planner_type_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_planner_type_check
CHECK (
  planner_type IS NULL
  OR planner_type IN ('professional', 'committee')
);

UPDATE public.profiles
SET planner_type = 'professional'
WHERE role = 'planner'::public.app_role
  AND planner_type IS NULL;

CREATE TABLE IF NOT EXISTS public.wedding_committee_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chair_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text NULL,
  responsibility text NOT NULL,
  permission_level text NOT NULL DEFAULT 'member'
    CHECK (permission_level IN ('chair', 'member', 'viewer')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wedding_committee_members_chair_user_id
  ON public.wedding_committee_members (chair_user_id);

ALTER TABLE public.wedding_committee_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_committee_members(target_chair_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN true
    WHEN auth.uid() <> target_chair_user_id THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'planner'::public.app_role
        AND p.planner_type = 'committee'
    )
  END
$$;

DROP POLICY IF EXISTS "Committee chairs and admins can view committee members" ON public.wedding_committee_members;
CREATE POLICY "Committee chairs and admins can view committee members"
ON public.wedding_committee_members FOR SELECT
USING (public.can_manage_committee_members(chair_user_id));

DROP POLICY IF EXISTS "Committee chairs and admins can insert committee members" ON public.wedding_committee_members;
CREATE POLICY "Committee chairs and admins can insert committee members"
ON public.wedding_committee_members FOR INSERT
WITH CHECK (public.can_manage_committee_members(chair_user_id));

DROP POLICY IF EXISTS "Committee chairs and admins can update committee members" ON public.wedding_committee_members;
CREATE POLICY "Committee chairs and admins can update committee members"
ON public.wedding_committee_members FOR UPDATE
USING (public.can_manage_committee_members(chair_user_id))
WITH CHECK (public.can_manage_committee_members(chair_user_id));

DROP POLICY IF EXISTS "Committee chairs and admins can delete committee members" ON public.wedding_committee_members;
CREATE POLICY "Committee chairs and admins can delete committee members"
ON public.wedding_committee_members FOR DELETE
USING (public.can_manage_committee_members(chair_user_id));

DROP TRIGGER IF EXISTS update_wedding_committee_members_updated_at ON public.wedding_committee_members;
CREATE TRIGGER update_wedding_committee_members_updated_at
BEFORE UPDATE ON public.wedding_committee_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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

  INSERT INTO public.profiles (user_id, full_name, role, planner_type, committee_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    requested_role,
    resolved_planner_type,
    resolved_committee_name
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    planner_type = EXCLUDED.planner_type,
    committee_name = COALESCE(EXCLUDED.committee_name, public.profiles.committee_name);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, requested_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

ALTER TABLE public.vendor_reputation_reviews
ADD COLUMN IF NOT EXISTS review_source text NOT NULL DEFAULT 'professional_planner',
ADD COLUMN IF NOT EXISTS review_source_role text;

ALTER TABLE public.vendor_reputation_reviews
DROP CONSTRAINT IF EXISTS vendor_reputation_reviews_review_source_check;

ALTER TABLE public.vendor_reputation_reviews
ADD CONSTRAINT vendor_reputation_reviews_review_source_check
CHECK (review_source IN ('professional_planner', 'committee', 'admin'));

CREATE OR REPLACE FUNCTION public.record_vendor_reputation_review(
  overall_rating_input integer,
  reliability_input integer,
  communication_input integer,
  quality_input integer,
  punctuality_input integer,
  value_input integer,
  vendor_name_input text DEFAULT NULL,
  vendor_category_input text DEFAULT NULL,
  vendor_listing_input uuid DEFAULT NULL,
  source_vendor_input uuid DEFAULT NULL,
  client_input uuid DEFAULT NULL,
  event_date_input date DEFAULT NULL,
  delivered_on_time_input boolean DEFAULT NULL,
  would_hire_again_input boolean DEFAULT true,
  issue_flags_input text[] DEFAULT '{}'::text[],
  private_notes_input text DEFAULT NULL,
  visibility_input text DEFAULT 'planner_network',
  is_anonymized_input boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_id uuid;
  resolved_vendor_name text;
  resolved_vendor_category text;
  resolved_vendor_listing_id uuid;
  resolved_client_id uuid;
  resolved_event_date date;
  reviewer_profile record;
  resolved_review_source text;
  resolved_review_source_role text;
BEGIN
  PERFORM public.require_planner_or_admin();

  IF overall_rating_input IS NULL OR overall_rating_input NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Overall rating must be between 1 and 5'
      USING ERRCODE = '22023';
  END IF;

  IF reliability_input IS NULL OR reliability_input NOT BETWEEN 1 AND 5
     OR communication_input IS NULL OR communication_input NOT BETWEEN 1 AND 5
     OR quality_input IS NULL OR quality_input NOT BETWEEN 1 AND 5
     OR punctuality_input IS NULL OR punctuality_input NOT BETWEEN 1 AND 5
     OR value_input IS NULL OR value_input NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'All structured ratings must be between 1 and 5'
      USING ERRCODE = '22023';
  END IF;

  IF visibility_input NOT IN ('private', 'planner_network', 'admin_only') THEN
    RAISE EXCEPTION 'Unsupported visibility: %', visibility_input
      USING ERRCODE = '22023';
  END IF;

  IF issue_flags_input IS NULL THEN
    issue_flags_input := '{}'::text[];
  END IF;

  IF NOT (
    issue_flags_input <@ ARRAY[
      'late_setup',
      'late_delivery',
      'poor_communication',
      'deposit_risk',
      'quality_issue',
      'no_show',
      'scope_change',
      'budget_overrun',
      'unprofessional_staff',
      'payment_dispute'
    ]::text[]
  ) THEN
    RAISE EXCEPTION 'Unsupported issue flags supplied'
      USING ERRCODE = '22023';
  END IF;

  SELECT p.role, p.planner_type, p.committee_name
  INTO reviewer_profile
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  resolved_review_source := CASE
    WHEN reviewer_profile.role = 'admin'::public.app_role THEN 'admin'
    WHEN reviewer_profile.planner_type = 'committee' THEN 'committee'
    ELSE 'professional_planner'
  END;

  resolved_review_source_role := CASE
    WHEN reviewer_profile.planner_type = 'committee'
      THEN COALESCE(NULLIF(reviewer_profile.committee_name, ''), 'Wedding Committee')
    WHEN reviewer_profile.role = 'admin'::public.app_role
      THEN 'Admin Review'
    ELSE 'Professional Planner'
  END;

  resolved_vendor_name := NULLIF(trim(vendor_name_input), '');
  resolved_vendor_category := NULLIF(trim(vendor_category_input), '');
  resolved_vendor_listing_id := vendor_listing_input;
  resolved_client_id := client_input;
  resolved_event_date := event_date_input;

  IF source_vendor_input IS NOT NULL THEN
    SELECT
      COALESCE(NULLIF(v.name, ''), resolved_vendor_name),
      COALESCE(NULLIF(v.category, ''), resolved_vendor_category),
      COALESCE(v.vendor_listing_id, resolved_vendor_listing_id),
      COALESCE(v.client_id, resolved_client_id)
    INTO resolved_vendor_name, resolved_vendor_category, resolved_vendor_listing_id, resolved_client_id
    FROM public.vendors v
    WHERE v.id = source_vendor_input
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR v.user_id = auth.uid()
      );
  END IF;

  IF resolved_vendor_listing_id IS NOT NULL THEN
    SELECT
      COALESCE(NULLIF(vl.business_name, ''), resolved_vendor_name),
      COALESCE(NULLIF(vl.category, ''), resolved_vendor_category)
    INTO resolved_vendor_name, resolved_vendor_category
    FROM public.vendor_listings vl
    WHERE vl.id = resolved_vendor_listing_id;
  END IF;

  IF resolved_vendor_name IS NULL OR resolved_vendor_category IS NULL THEN
    RAISE EXCEPTION 'Vendor name and category are required to record a reputation review'
      USING ERRCODE = '22023';
  END IF;

  IF resolved_client_id IS NOT NULL THEN
    SELECT COALESCE(pc.wedding_date, resolved_event_date)
    INTO resolved_event_date
    FROM public.planner_clients pc
    WHERE pc.id = resolved_client_id
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR pc.planner_user_id = auth.uid()
      );
  END IF;

  INSERT INTO public.vendor_reputation_reviews (
    user_id,
    reviewer_user_id,
    client_id,
    source_vendor_id,
    vendor_listing_id,
    vendor_name_snapshot,
    vendor_category_snapshot,
    event_date,
    overall_rating,
    reliability_rating,
    communication_rating,
    quality_rating,
    punctuality_rating,
    value_rating,
    would_hire_again,
    delivered_on_time,
    issue_flags,
    private_notes,
    visibility,
    is_anonymized,
    review_source,
    review_source_role
  ) VALUES (
    auth.uid(),
    auth.uid(),
    resolved_client_id,
    source_vendor_input,
    resolved_vendor_listing_id,
    resolved_vendor_name,
    resolved_vendor_category,
    resolved_event_date,
    overall_rating_input,
    reliability_input,
    communication_input,
    quality_input,
    punctuality_input,
    value_input,
    COALESCE(would_hire_again_input, true),
    delivered_on_time_input,
    issue_flags_input,
    NULLIF(trim(private_notes_input), ''),
    visibility_input,
    COALESCE(is_anonymized_input, true),
    resolved_review_source,
    resolved_review_source_role
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$;

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
  planner_type text,
  committee_name text,
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
    p.full_name,
    p.company_name,
    p.company_email,
    COALESCE(p.planner_type, 'professional')::text,
    p.committee_name,
    p.planner_verified,
    p.planner_verification_requested,
    p.planner_verification_requested_at,
    p.planner_subscription_status::text,
    p.planner_subscription_expires_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.role = 'planner'::public.app_role
    AND (
      search_query IS NULL
      OR p.full_name ILIKE '%' || search_query || '%'
      OR p.company_name ILIKE '%' || search_query || '%'
      OR p.company_email ILIKE '%' || search_query || '%'
      OR p.committee_name ILIKE '%' || search_query || '%'
    )
    AND (
      verification_filter = 'all'
      OR (verification_filter = 'requested' AND p.planner_verification_requested = true AND p.planner_verified = false)
      OR (verification_filter = 'pending' AND p.planner_verified = false)
      OR (verification_filter = 'verified' AND p.planner_verified = true)
    )
  ORDER BY p.updated_at DESC
  LIMIT GREATEST(1, LEAST(limit_rows, 200))
  OFFSET GREATEST(0, offset_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_vendor_reputation_reviews(
  search_query text DEFAULT NULL,
  issue_filter text DEFAULT 'all',
  visibility_filter text DEFAULT 'all',
  limit_rows integer DEFAULT 100,
  offset_rows integer DEFAULT 0
)
RETURNS TABLE (
  review_id uuid,
  created_at timestamptz,
  vendor_listing_id uuid,
  vendor_name text,
  vendor_category text,
  reviewer_user_id uuid,
  reviewer_name text,
  reviewer_email text,
  client_name text,
  overall_rating integer,
  delivered_on_time boolean,
  would_hire_again boolean,
  issue_flags text[],
  visibility text,
  review_source text,
  review_source_role text,
  private_notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();

  RETURN QUERY
  SELECT
    vrr.id,
    vrr.created_at,
    vrr.vendor_listing_id,
    vrr.vendor_name_snapshot,
    vrr.vendor_category_snapshot,
    vrr.reviewer_user_id,
    p.full_name,
    au.email::text,
    pc.client_name,
    vrr.overall_rating,
    vrr.delivered_on_time,
    vrr.would_hire_again,
    vrr.issue_flags,
    vrr.visibility,
    vrr.review_source,
    vrr.review_source_role,
    vrr.private_notes
  FROM public.vendor_reputation_reviews vrr
  LEFT JOIN public.profiles p
    ON p.user_id = vrr.reviewer_user_id
  LEFT JOIN auth.users au
    ON au.id = vrr.reviewer_user_id
  LEFT JOIN public.planner_clients pc
    ON pc.id = vrr.client_id
  WHERE (
      search_query IS NULL
      OR vrr.vendor_name_snapshot ILIKE '%' || search_query || '%'
      OR vrr.vendor_category_snapshot ILIKE '%' || search_query || '%'
      OR p.full_name ILIKE '%' || search_query || '%'
      OR au.email ILIKE '%' || search_query || '%'
      OR pc.client_name ILIKE '%' || search_query || '%'
    )
    AND (
      issue_filter = 'all'
      OR (issue_filter = 'flagged' AND cardinality(vrr.issue_flags) > 0)
      OR (issue_filter = 'clean' AND cardinality(vrr.issue_flags) = 0)
    )
    AND (
      visibility_filter = 'all'
      OR vrr.visibility = visibility_filter
    )
  ORDER BY vrr.created_at DESC
  LIMIT GREATEST(1, LEAST(limit_rows, 200))
  OFFSET GREATEST(0, offset_rows);
END;
$$;
