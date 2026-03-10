-- Vendor trust overview RPC for vendor-owned dashboards and planner trust cards

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

  IF NOT (caller_is_admin OR caller_is_planner OR caller_is_vendor_owner) THEN
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

REVOKE EXECUTE ON FUNCTION public.get_vendor_reputation_overview(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vendor_reputation_overview(uuid, integer) TO authenticated;
