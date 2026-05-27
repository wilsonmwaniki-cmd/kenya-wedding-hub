-- Vendor learning profile
-- Blends declared ranges, planner observations, commercial quotes,
-- invoice-stage amounts, and paid invoice outcomes into one predicted price.

CREATE OR REPLACE FUNCTION public.get_vendor_learning_profile(
  listing_id_input uuid
)
RETURNS TABLE (
  vendor_listing_id uuid,
  declared_min_price numeric,
  declared_max_price numeric,
  declared_midpoint_price numeric,
  quote_average_amount numeric,
  booked_average_amount numeric,
  final_paid_average_amount numeric,
  predicted_price numeric,
  quote_observation_count integer,
  booked_observation_count integer,
  final_paid_observation_count integer,
  declared_range_count integer,
  total_observation_count integer,
  confidence_score integer,
  quote_to_paid_delta_percent numeric,
  last_observed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH listing_context AS (
    SELECT
      vl.id,
      vl.minimum_budget_kes,
      vl.maximum_budget_kes,
      vl.created_at,
      vl.updated_at
    FROM public.vendor_listings vl
    WHERE vl.id = listing_id_input
  ),
  learning_signals AS (
    SELECT
      lc.id AS vendor_listing_id,
      'declared_range'::text AS signal_kind,
      CASE
        WHEN lc.minimum_budget_kes IS NOT NULL AND lc.maximum_budget_kes IS NOT NULL
          THEN ROUND(((lc.minimum_budget_kes + lc.maximum_budget_kes) / 2.0)::numeric, 2)
        ELSE ROUND(COALESCE(lc.minimum_budget_kes, lc.maximum_budget_kes)::numeric, 2)
      END AS amount,
      0.25::numeric AS signal_weight,
      COALESCE(lc.updated_at, lc.created_at, now()) AS observed_at
    FROM listing_context lc
    WHERE COALESCE(lc.minimum_budget_kes, lc.maximum_budget_kes) IS NOT NULL

    UNION ALL

    SELECT
      vpo.vendor_listing_id,
      CASE
        WHEN vpo.price_type = 'quote' THEN 'quote'
        WHEN vpo.price_type = 'booked' THEN 'booked'
        ELSE 'final_paid'
      END AS signal_kind,
      ROUND(vpo.amount::numeric, 2) AS amount,
      CASE
        WHEN vpo.price_type = 'quote' THEN 0.60::numeric
        WHEN vpo.price_type = 'booked' THEN 0.85::numeric
        ELSE 1.00::numeric
      END AS signal_weight,
      COALESCE(vpo.event_date::timestamptz, vpo.created_at) AS observed_at
    FROM public.vendor_price_observations vpo
    WHERE vpo.vendor_listing_id = listing_id_input
      AND vpo.amount > 0

    UNION ALL

    SELECT
      cd.vendor_listing_id,
      'quote'::text AS signal_kind,
      ROUND(cd.total_amount::numeric, 2) AS amount,
      0.60::numeric AS signal_weight,
      COALESCE(cd.issue_date::timestamptz, cd.created_at) AS observed_at
    FROM public.commercial_documents cd
    WHERE cd.vendor_listing_id = listing_id_input
      AND cd.document_type = 'quote'
      AND cd.status <> 'draft'
      AND cd.total_amount > 0

    UNION ALL

    SELECT
      cd.vendor_listing_id,
      'booked'::text AS signal_kind,
      ROUND(cd.total_amount::numeric, 2) AS amount,
      0.85::numeric AS signal_weight,
      COALESCE(cd.issue_date::timestamptz, cd.created_at) AS observed_at
    FROM public.commercial_documents cd
    WHERE cd.vendor_listing_id = listing_id_input
      AND cd.document_type = 'invoice'
      AND cd.status IN ('draft', 'sent', 'part_paid')
      AND cd.total_amount > 0

    UNION ALL

    SELECT
      cd.vendor_listing_id,
      'final_paid'::text AS signal_kind,
      ROUND(cd.total_amount::numeric, 2) AS amount,
      1.00::numeric AS signal_weight,
      COALESCE(cd.paid_date::timestamptz, cd.updated_at, cd.issue_date::timestamptz, cd.created_at) AS observed_at
    FROM public.commercial_documents cd
    WHERE cd.vendor_listing_id = listing_id_input
      AND cd.document_type = 'invoice'
      AND cd.status = 'paid'
      AND cd.total_amount > 0
      AND cd.amount_paid >= cd.total_amount
  ),
  aggregates AS (
    SELECT
      COUNT(*) FILTER (WHERE signal_kind = 'declared_range')::integer AS declared_range_count,
      COUNT(*) FILTER (WHERE signal_kind = 'quote')::integer AS quote_observation_count,
      COUNT(*) FILTER (WHERE signal_kind = 'booked')::integer AS booked_observation_count,
      COUNT(*) FILTER (WHERE signal_kind = 'final_paid')::integer AS final_paid_observation_count,
      COUNT(*)::integer AS total_observation_count,
      ROUND(AVG(amount) FILTER (WHERE signal_kind = 'quote')::numeric, 2) AS quote_average_amount,
      ROUND(AVG(amount) FILTER (WHERE signal_kind = 'booked')::numeric, 2) AS booked_average_amount,
      ROUND(AVG(amount) FILTER (WHERE signal_kind = 'final_paid')::numeric, 2) AS final_paid_average_amount,
      ROUND((SUM(amount * signal_weight) / NULLIF(SUM(signal_weight), 0))::numeric, 2) AS predicted_price,
      MAX(observed_at) AS last_observed_at
    FROM learning_signals
  )
  SELECT
    lc.id AS vendor_listing_id,
    lc.minimum_budget_kes AS declared_min_price,
    lc.maximum_budget_kes AS declared_max_price,
    CASE
      WHEN lc.minimum_budget_kes IS NOT NULL AND lc.maximum_budget_kes IS NOT NULL
        THEN ROUND(((lc.minimum_budget_kes + lc.maximum_budget_kes) / 2.0)::numeric, 2)
      ELSE ROUND(COALESCE(lc.minimum_budget_kes, lc.maximum_budget_kes)::numeric, 2)
    END AS declared_midpoint_price,
    ag.quote_average_amount,
    ag.booked_average_amount,
    ag.final_paid_average_amount,
    ag.predicted_price,
    ag.quote_observation_count,
    ag.booked_observation_count,
    ag.final_paid_observation_count,
    ag.declared_range_count,
    ag.total_observation_count,
    LEAST(
      100,
      (CASE WHEN ag.declared_range_count > 0 THEN 10 ELSE 0 END)
      + LEAST(ag.quote_observation_count, 4) * 8
      + LEAST(ag.booked_observation_count, 3) * 12
      + LEAST(ag.final_paid_observation_count, 3) * 18
      + (
        CASE
          WHEN (
            (CASE WHEN ag.quote_observation_count > 0 THEN 1 ELSE 0 END)
            + (CASE WHEN ag.booked_observation_count > 0 THEN 1 ELSE 0 END)
            + (CASE WHEN ag.final_paid_observation_count > 0 THEN 1 ELSE 0 END)
          ) >= 2
            THEN 10
          ELSE 0
        END
      )
    )::integer AS confidence_score,
    CASE
      WHEN ag.quote_average_amount IS NOT NULL
        AND ag.final_paid_average_amount IS NOT NULL
        AND ag.quote_average_amount > 0
      THEN ROUND((((ag.final_paid_average_amount - ag.quote_average_amount) / ag.quote_average_amount) * 100)::numeric, 1)
      ELSE NULL
    END AS quote_to_paid_delta_percent,
    ag.last_observed_at
  FROM listing_context lc
  CROSS JOIN aggregates ag;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_vendor_learning_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vendor_learning_profile(uuid) TO authenticated;
