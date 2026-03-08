-- Vendor reputation graph foundation
-- Planner-only structured post-event reviews with private notes
-- Aggregated trust metrics exposed only after minimum sample thresholds

CREATE OR REPLACE FUNCTION public.require_planner_or_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'planner'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Planner or admin access required'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.vendor_reputation_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NULL REFERENCES public.planner_clients(id) ON DELETE CASCADE,
  source_vendor_id uuid NULL REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_listing_id uuid NULL REFERENCES public.vendor_listings(id) ON DELETE SET NULL,
  vendor_name_snapshot text NOT NULL,
  vendor_category_snapshot text NOT NULL,
  event_date date NULL,
  overall_rating integer NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  reliability_rating integer NOT NULL CHECK (reliability_rating BETWEEN 1 AND 5),
  communication_rating integer NOT NULL CHECK (communication_rating BETWEEN 1 AND 5),
  quality_rating integer NOT NULL CHECK (quality_rating BETWEEN 1 AND 5),
  punctuality_rating integer NOT NULL CHECK (punctuality_rating BETWEEN 1 AND 5),
  value_rating integer NOT NULL CHECK (value_rating BETWEEN 1 AND 5),
  would_hire_again boolean NOT NULL DEFAULT true,
  delivered_on_time boolean NULL,
  issue_flags text[] NOT NULL DEFAULT '{}'::text[]
    CHECK (
      issue_flags <@ ARRAY[
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
    ),
  private_notes text NULL,
  visibility text NOT NULL DEFAULT 'planner_network'
    CHECK (visibility IN ('private', 'planner_network', 'admin_only')),
  is_anonymized boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_reputation_reviews_source_vendor_unique
  ON public.vendor_reputation_reviews (source_vendor_id)
  WHERE source_vendor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_reputation_reviews_vendor_listing_id
  ON public.vendor_reputation_reviews (vendor_listing_id);

CREATE INDEX IF NOT EXISTS idx_vendor_reputation_reviews_client_id
  ON public.vendor_reputation_reviews (client_id);

CREATE INDEX IF NOT EXISTS idx_vendor_reputation_reviews_category
  ON public.vendor_reputation_reviews (vendor_category_snapshot);

CREATE INDEX IF NOT EXISTS idx_vendor_reputation_reviews_created_at
  ON public.vendor_reputation_reviews (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_reputation_reviews_event_date
  ON public.vendor_reputation_reviews (event_date DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_reputation_reviews_issue_flags
  ON public.vendor_reputation_reviews USING gin (issue_flags);

ALTER TABLE public.vendor_reputation_reviews ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_vendor_reputation_review(
  _owner_user_id uuid,
  _reviewer_user_id uuid,
  _client_id uuid,
  _source_vendor_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN true
    WHEN NOT public.has_role(auth.uid(), 'planner'::public.app_role) THEN false
    WHEN _owner_user_id IS DISTINCT FROM auth.uid() THEN false
    WHEN _reviewer_user_id IS DISTINCT FROM auth.uid() THEN false
    WHEN _client_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.planner_clients pc
      WHERE pc.id = _client_id
        AND pc.planner_user_id = auth.uid()
    ) THEN false
    WHEN _source_vendor_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.vendors v
      WHERE v.id = _source_vendor_id
        AND v.user_id = auth.uid()
        AND (_client_id IS NULL OR v.client_id IS NOT DISTINCT FROM _client_id)
    ) THEN false
    ELSE true
  END
$$;

DROP POLICY IF EXISTS "Planners and admins can view vendor reputation reviews" ON public.vendor_reputation_reviews;
CREATE POLICY "Planners and admins can view vendor reputation reviews"
ON public.vendor_reputation_reviews FOR SELECT
USING (
  auth.uid() = user_id
  OR auth.uid() = reviewer_user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Planners and admins can insert vendor reputation reviews" ON public.vendor_reputation_reviews;
CREATE POLICY "Planners and admins can insert vendor reputation reviews"
ON public.vendor_reputation_reviews FOR INSERT
WITH CHECK (
  public.can_manage_vendor_reputation_review(user_id, reviewer_user_id, client_id, source_vendor_id)
);

DROP POLICY IF EXISTS "Planners and admins can update vendor reputation reviews" ON public.vendor_reputation_reviews;
CREATE POLICY "Planners and admins can update vendor reputation reviews"
ON public.vendor_reputation_reviews FOR UPDATE
USING (
  auth.uid() = user_id
  OR auth.uid() = reviewer_user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  public.can_manage_vendor_reputation_review(user_id, reviewer_user_id, client_id, source_vendor_id)
);

DROP POLICY IF EXISTS "Planners and admins can delete vendor reputation reviews" ON public.vendor_reputation_reviews;
CREATE POLICY "Planners and admins can delete vendor reputation reviews"
ON public.vendor_reputation_reviews FOR DELETE
USING (
  auth.uid() = user_id
  OR auth.uid() = reviewer_user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP TRIGGER IF EXISTS update_vendor_reputation_reviews_updated_at ON public.vendor_reputation_reviews;
CREATE TRIGGER update_vendor_reputation_reviews_updated_at
BEFORE UPDATE ON public.vendor_reputation_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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
        OR (v.user_id = auth.uid() AND public.has_role(auth.uid(), 'planner'::public.app_role))
      );

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Vendor workflow record not accessible for this user'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF resolved_vendor_listing_id IS NOT NULL THEN
    SELECT
      COALESCE(NULLIF(vl.business_name, ''), resolved_vendor_name),
      COALESCE(NULLIF(vl.category, ''), resolved_vendor_category)
    INTO resolved_vendor_name, resolved_vendor_category
    FROM public.vendor_listings vl
    WHERE vl.id = resolved_vendor_listing_id;
  END IF;

  IF resolved_client_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.planner_clients pc
      WHERE pc.id = resolved_client_id
        AND (
          pc.planner_user_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    ) THEN
      RAISE EXCEPTION 'Client not accessible for this user'
        USING ERRCODE = '42501';
    END IF;

    IF resolved_event_date IS NULL THEN
      SELECT pc.wedding_date
      INTO resolved_event_date
      FROM public.planner_clients pc
      WHERE pc.id = resolved_client_id;
    END IF;
  END IF;

  IF resolved_vendor_name IS NULL THEN
    RAISE EXCEPTION 'Vendor name is required'
      USING ERRCODE = '23514';
  END IF;

  IF resolved_vendor_category IS NULL THEN
    RAISE EXCEPTION 'Vendor category is required'
      USING ERRCODE = '23514';
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
    is_anonymized
  )
  VALUES (
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
    COALESCE(is_anonymized_input, true)
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_vendor_reputation_benchmark(
  vendor_listing_filter uuid DEFAULT NULL,
  category_filter text DEFAULT NULL,
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
  vendor_count bigint,
  last_review_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean;
BEGIN
  PERFORM public.require_planner_or_admin();
  caller_is_admin := public.has_role(auth.uid(), 'admin'::public.app_role);

  RETURN QUERY
  WITH scoped_reviews AS (
    SELECT
      vrr.id,
      vrr.vendor_listing_id,
      vrr.vendor_name_snapshot,
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
    WHERE (vendor_listing_filter IS NULL OR vrr.vendor_listing_id = vendor_listing_filter)
      AND (category_filter IS NULL OR lower(vrr.vendor_category_snapshot) = lower(category_filter))
      AND (
        caller_is_admin
        OR vrr.visibility = 'planner_network'
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
      COUNT(DISTINCT COALESCE(vendor_listing_id::text, vendor_name_snapshot))::bigint AS vendor_count,
      MAX(created_at) AS last_review_at
    FROM scoped_reviews
  )
  SELECT
    a.sample_size,
    (a.sample_size >= GREATEST(COALESCE(min_sample_size, 3), 1)) AS benchmark_visible,
    CASE WHEN a.sample_size >= GREATEST(COALESCE(min_sample_size, 3), 1) THEN ROUND(a.average_overall_rating, 2) ELSE NULL END,
    CASE WHEN a.sample_size >= GREATEST(COALESCE(min_sample_size, 3), 1) THEN ROUND(a.average_reliability_rating, 2) ELSE NULL END,
    CASE WHEN a.sample_size >= GREATEST(COALESCE(min_sample_size, 3), 1) THEN ROUND(a.average_communication_rating, 2) ELSE NULL END,
    CASE WHEN a.sample_size >= GREATEST(COALESCE(min_sample_size, 3), 1) THEN ROUND(a.average_quality_rating, 2) ELSE NULL END,
    CASE WHEN a.sample_size >= GREATEST(COALESCE(min_sample_size, 3), 1) THEN ROUND(a.average_punctuality_rating, 2) ELSE NULL END,
    CASE WHEN a.sample_size >= GREATEST(COALESCE(min_sample_size, 3), 1) THEN ROUND(a.average_value_rating, 2) ELSE NULL END,
    CASE WHEN a.sample_size >= GREATEST(COALESCE(min_sample_size, 3), 1) THEN ROUND(a.hire_again_rate, 4) ELSE NULL END,
    CASE WHEN a.sample_size >= GREATEST(COALESCE(min_sample_size, 3), 1) THEN ROUND(a.on_time_rate, 4) ELSE NULL END,
    CASE WHEN a.sample_size >= GREATEST(COALESCE(min_sample_size, 3), 1) THEN a.flagged_review_count ELSE NULL::bigint END,
    a.vendor_count,
    a.last_review_at
  FROM aggregates a;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.require_planner_or_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.require_planner_or_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_manage_vendor_reputation_review(uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_vendor_reputation_review(uuid, uuid, uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.record_vendor_reputation_review(integer, integer, integer, integer, integer, integer, text, text, uuid, uuid, uuid, date, boolean, boolean, text[], text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_vendor_reputation_review(integer, integer, integer, integer, integer, integer, text, text, uuid, uuid, uuid, date, boolean, boolean, text[], text, text, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_vendor_reputation_benchmark(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vendor_reputation_benchmark(uuid, text, integer) TO authenticated;
