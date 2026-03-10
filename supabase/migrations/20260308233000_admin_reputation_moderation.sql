-- Admin moderation RPCs for vendor reputation scorecards

CREATE OR REPLACE FUNCTION public.admin_reputation_review_metrics()
RETURNS TABLE (
  total_reviews bigint,
  flagged_reviews bigint,
  planner_network_reviews bigint,
  admin_only_reviews bigint,
  private_reviews bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.vendor_reputation_reviews),
    (SELECT COUNT(*) FROM public.vendor_reputation_reviews WHERE cardinality(issue_flags) > 0),
    (SELECT COUNT(*) FROM public.vendor_reputation_reviews WHERE visibility = 'planner_network'),
    (SELECT COUNT(*) FROM public.vendor_reputation_reviews WHERE visibility = 'admin_only'),
    (SELECT COUNT(*) FROM public.vendor_reputation_reviews WHERE visibility = 'private');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_vendor_reputation_reviews(
  search_query text DEFAULT NULL,
  issue_filter text DEFAULT 'flagged',
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
    vrr.vendor_name_snapshot::text,
    vrr.vendor_category_snapshot::text,
    vrr.reviewer_user_id,
    p.full_name::text,
    u.email::text,
    pc.client_name::text,
    vrr.overall_rating,
    vrr.delivered_on_time,
    vrr.would_hire_again,
    vrr.issue_flags,
    vrr.visibility::text,
    vrr.private_notes::text
  FROM public.vendor_reputation_reviews vrr
  LEFT JOIN public.profiles p
    ON p.user_id = vrr.reviewer_user_id
  LEFT JOIN auth.users u
    ON u.id = vrr.reviewer_user_id
  LEFT JOIN public.planner_clients pc
    ON pc.id = vrr.client_id
  WHERE
    (
      search_query IS NULL
      OR vrr.vendor_name_snapshot ILIKE '%' || search_query || '%'
      OR vrr.vendor_category_snapshot ILIKE '%' || search_query || '%'
      OR p.full_name ILIKE '%' || search_query || '%'
      OR u.email ILIKE '%' || search_query || '%'
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
  ORDER BY
    CASE WHEN cardinality(vrr.issue_flags) > 0 THEN 0 ELSE 1 END,
    vrr.created_at DESC
  LIMIT GREATEST(1, LEAST(limit_rows, 200))
  OFFSET GREATEST(0, offset_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_vendor_reputation_visibility(
  review_id uuid,
  new_visibility text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();

  IF new_visibility NOT IN ('private', 'planner_network', 'admin_only') THEN
    RAISE EXCEPTION 'Unsupported visibility: %', new_visibility
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.vendor_reputation_reviews
  SET visibility = new_visibility
  WHERE id = review_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor reputation review not found'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reputation_review_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reputation_review_metrics() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_list_vendor_reputation_reviews(text, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_vendor_reputation_reviews(text, text, text, integer, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_set_vendor_reputation_visibility(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_vendor_reputation_visibility(uuid, text) TO authenticated;
