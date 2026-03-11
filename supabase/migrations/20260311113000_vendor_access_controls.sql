ALTER TABLE public.vendor_listings
ADD COLUMN IF NOT EXISTS verification_requested boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_requested_at timestamptz,
ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz,
ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;

ALTER TABLE public.vendor_listings
DROP CONSTRAINT IF EXISTS vendor_listings_subscription_status_check;

ALTER TABLE public.vendor_listings
ADD CONSTRAINT vendor_listings_subscription_status_check
CHECK (subscription_status IN ('inactive', 'active', 'past_due', 'cancelled'));

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
    WHERE vl.id = target_listing_id
      AND vl.is_approved = true
      AND vl.is_verified = true
      AND vl.subscription_status = 'active'
      AND (vl.subscription_expires_at IS NULL OR vl.subscription_expires_at > now())
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

  IF listing_record.is_approved = false THEN
    RAISE EXCEPTION 'Listing approval is required before verification can be requested'
      USING ERRCODE = 'P0001';
  END IF;

  IF listing_record.subscription_status <> 'active'
     OR (listing_record.subscription_expires_at IS NOT NULL AND listing_record.subscription_expires_at <= now()) THEN
    RAISE EXCEPTION 'An active subscription is required before verification can be requested'
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

DROP POLICY IF EXISTS "Requesters can insert own requests" ON public.vendor_connection_requests;
CREATE POLICY "Requesters can insert own requests"
ON public.vendor_connection_requests
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = requester_user_id
  AND public.vendor_listing_has_full_access(vendor_listing_id)
);

DROP POLICY IF EXISTS "Vendors can view requests to their listings" ON public.vendor_connection_requests;
CREATE POLICY "Vendors can view requests to their listings"
ON public.vendor_connection_requests
FOR SELECT TO authenticated
USING (
  vendor_listing_id IN (
    SELECT id
    FROM public.vendor_listings
    WHERE user_id = auth.uid()
      AND public.vendor_listing_has_full_access(id)
  )
);

DROP POLICY IF EXISTS "Vendors can update requests to their listings" ON public.vendor_connection_requests;
CREATE POLICY "Vendors can update requests to their listings"
ON public.vendor_connection_requests
FOR UPDATE TO authenticated
USING (
  vendor_listing_id IN (
    SELECT id
    FROM public.vendor_listings
    WHERE user_id = auth.uid()
      AND public.vendor_listing_has_full_access(id)
  )
)
WITH CHECK (
  vendor_listing_id IN (
    SELECT id
    FROM public.vendor_listings
    WHERE user_id = auth.uid()
      AND public.vendor_listing_has_full_access(id)
  )
);

DROP FUNCTION IF EXISTS public.admin_list_vendor_listings(text, text, integer, integer);
CREATE FUNCTION public.admin_list_vendor_listings(
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
  verification_requested boolean,
  verification_requested_at timestamptz,
  subscription_status text,
  subscription_expires_at timestamptz,
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
    v.business_name::text,
    v.category::text,
    v.location::text,
    v.is_approved,
    v.is_verified,
    v.verification_requested,
    v.verification_requested_at,
    v.subscription_status::text,
    v.subscription_expires_at,
    v.updated_at::timestamptz,
    p.full_name::text,
    u.email::text
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
    is_verified = normalized_verify,
    verification_requested = CASE WHEN normalized_verify THEN false ELSE verification_requested END,
    verification_requested_at = CASE WHEN normalized_verify THEN NULL ELSE verification_requested_at END,
    updated_at = now()
  WHERE id = listing_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor listing not found'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_vendor_subscription(
  listing_id uuid,
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

  UPDATE public.vendor_listings
  SET
    subscription_status = new_subscription_status,
    subscription_started_at = CASE
      WHEN new_subscription_status = 'active' THEN COALESCE(subscription_started_at, now())
      ELSE subscription_started_at
    END,
    subscription_expires_at = new_subscription_expires_at,
    updated_at = now()
  WHERE id = listing_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor listing not found'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_vendor_reputation_overview(
  listing_id_input uuid,
  min_sample_size integer DEFAULT 3
)
RETURNS TABLE (
  sample_size bigint,
  benchmark_visible boolean,
  average_overall_rating numeric,
  average_reliability_rating numeric,
  average_communication_rating numeric,
  average_quality_rating numeric,
  average_punctuality_rating numeric,
  average_value_rating numeric,
  hire_again_rate numeric,
  on_time_rate numeric,
  flagged_review_count bigint,
  last_review_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean;
  caller_is_planner boolean;
  caller_is_vendor_owner boolean;
  caller_vendor_has_full_access boolean;
  threshold integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF listing_id_input IS NULL THEN
    RAISE EXCEPTION 'Listing id is required'
      USING ERRCODE = '23502';
  END IF;

  caller_is_admin := public.has_role(auth.uid(), 'admin'::public.app_role);
  caller_is_planner := public.has_role(auth.uid(), 'planner'::public.app_role);

  SELECT EXISTS (
    SELECT 1
    FROM public.vendor_listings vl
    WHERE vl.id = listing_id_input
      AND vl.user_id = auth.uid()
  ) INTO caller_is_vendor_owner;

  caller_vendor_has_full_access := public.vendor_listing_has_full_access(listing_id_input);

  IF NOT (
    caller_is_admin
    OR caller_is_planner
    OR (caller_is_vendor_owner AND caller_vendor_has_full_access)
  ) THEN
    RAISE EXCEPTION 'Unauthorized'
      USING ERRCODE = '42501';
  END IF;

  threshold := GREATEST(COALESCE(min_sample_size, 3), 1);

  RETURN QUERY
  WITH scoped_reviews AS (
    SELECT
      vrr.overall_rating::numeric AS overall_rating,
      vrr.reliability_rating::numeric AS reliability_rating,
      vrr.communication_rating::numeric AS communication_rating,
      vrr.quality_rating::numeric AS quality_rating,
      vrr.punctuality_rating::numeric AS punctuality_rating,
      vrr.value_rating::numeric AS value_rating,
      CASE WHEN vrr.would_hire_again THEN 1::numeric ELSE 0::numeric END AS hire_again_numeric,
      CASE
        WHEN vrr.delivered_on_time IS NULL THEN NULL
        WHEN vrr.delivered_on_time THEN 1::numeric
        ELSE 0::numeric
      END AS on_time_numeric,
      cardinality(vrr.issue_flags) AS issue_count,
      vrr.created_at
    FROM public.vendor_reputation_reviews vrr
    WHERE vrr.vendor_listing_id = listing_id_input
      AND (
        CASE
          WHEN caller_is_admin THEN vrr.visibility IN ('planner_network', 'admin_only')
          ELSE vrr.visibility = 'planner_network'
        END
      )
  ),
  aggregates AS (
    SELECT
      COUNT(*)::bigint AS sample_size,
      AVG(overall_rating) AS average_overall_rating,
      AVG(reliability_rating) AS average_reliability_rating,
      AVG(communication_rating) AS average_communication_rating,
      AVG(quality_rating) AS average_quality_rating,
      AVG(punctuality_rating) AS average_punctuality_rating,
      AVG(value_rating) AS average_value_rating,
      AVG(hire_again_numeric) AS hire_again_rate,
      AVG(on_time_numeric) FILTER (WHERE on_time_numeric IS NOT NULL) AS on_time_rate,
      COUNT(*) FILTER (WHERE issue_count > 0)::bigint AS flagged_review_count,
      MAX(created_at) AS last_review_at
    FROM scoped_reviews
  )
  SELECT
    a.sample_size,
    (a.sample_size >= threshold) AS benchmark_visible,
    CASE WHEN a.sample_size >= threshold THEN ROUND(a.average_overall_rating, 2) ELSE NULL END,
    CASE WHEN a.sample_size >= threshold THEN ROUND(a.average_reliability_rating, 2) ELSE NULL END,
    CASE WHEN a.sample_size >= threshold THEN ROUND(a.average_communication_rating, 2) ELSE NULL END,
    CASE WHEN a.sample_size >= threshold THEN ROUND(a.average_quality_rating, 2) ELSE NULL END,
    CASE WHEN a.sample_size >= threshold THEN ROUND(a.average_punctuality_rating, 2) ELSE NULL END,
    CASE WHEN a.sample_size >= threshold THEN ROUND(a.average_value_rating, 2) ELSE NULL END,
    CASE WHEN a.sample_size >= threshold THEN ROUND(a.hire_again_rate, 4) ELSE NULL END,
    CASE WHEN a.sample_size >= threshold THEN ROUND(a.on_time_rate, 4) ELSE NULL END,
    CASE WHEN a.sample_size >= threshold THEN a.flagged_review_count ELSE NULL::bigint END,
    a.last_review_at
  FROM aggregates a;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vendor_listing_has_full_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_listing_has_full_access(uuid) TO authenticated, anon;

REVOKE EXECUTE ON FUNCTION public.request_vendor_verification() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_vendor_verification() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_list_vendor_listings(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_vendor_listings(text, text, integer, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_review_vendor_listing(uuid, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_vendor_listing(uuid, boolean, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_set_vendor_subscription(uuid, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_vendor_subscription(uuid, text, timestamptz) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_vendor_reputation_overview(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vendor_reputation_overview(uuid, integer) TO authenticated;
