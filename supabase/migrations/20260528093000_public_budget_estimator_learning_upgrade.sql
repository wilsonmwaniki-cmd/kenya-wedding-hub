-- Upgrade the public budget estimator so it derives category pricing from
-- vendor learning signals rather than raw observation medians alone.
-- Safe for anonymous visitors because it exposes only aggregated category
-- estimates, never vendor-specific prices.

CREATE OR REPLACE FUNCTION public.get_public_budget_estimate(
  guest_count_input integer DEFAULT 120,
  wedding_style_input text DEFAULT 'classic',
  venue_tier_input text DEFAULT 'mid_tier',
  county_input text DEFAULT NULL,
  min_sample_size integer DEFAULT 5
)
RETURNS TABLE (
  category text,
  source text,
  sample_size bigint,
  benchmark_visible boolean,
  suggested_amount numeric,
  low_amount numeric,
  high_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_guest_count integer := GREATEST(COALESCE(guest_count_input, 120), 25);
  normalized_style text := lower(COALESCE(NULLIF(trim(wedding_style_input), ''), 'classic'));
  normalized_venue_tier text := lower(COALESCE(NULLIF(trim(venue_tier_input), ''), 'mid_tier'));
  normalized_county text := lower(NULLIF(trim(county_input), ''));
  required_sample_size integer := GREATEST(COALESCE(min_sample_size, 5), 1);
  style_factor numeric;
  venue_factor numeric;
BEGIN
  style_factor := CASE normalized_style
    WHEN 'intimate' THEN 0.90
    WHEN 'classic' THEN 1.00
    WHEN 'luxury' THEN 1.35
    WHEN 'garden' THEN 1.05
    ELSE 1.00
  END;

  venue_factor := CASE normalized_venue_tier
    WHEN 'budget' THEN 0.85
    WHEN 'mid_tier' THEN 1.00
    WHEN 'luxury' THEN 1.40
    ELSE 1.00
  END;

  RETURN QUERY
  WITH category_defaults AS (
    SELECT *
    FROM (
      VALUES
        ('Venue', 120000::numeric, 1400::numeric, 0.18::numeric),
        ('Catering', 60000::numeric, 2200::numeric, 0.16::numeric),
        ('Photography', 90000::numeric, 300::numeric, 0.15::numeric),
        ('Décor', 80000::numeric, 800::numeric, 0.22::numeric),
        ('Flowers', 40000::numeric, 350::numeric, 0.20::numeric),
        ('Music/DJ', 30000::numeric, 140::numeric, 0.18::numeric),
        ('Transport', 25000::numeric, 200::numeric, 0.16::numeric),
        ('Attire/Beauty', 70000::numeric, 150::numeric, 0.14::numeric),
        ('Miscellaneous', 45000::numeric, 250::numeric, 0.20::numeric)
    ) AS t(category, fixed_base, per_guest_base, spread_ratio)
  ),
  listing_context AS (
    SELECT
      vl.id,
      CASE
        WHEN lower(vl.category) LIKE '%venue%' THEN 'Venue'
        WHEN lower(vl.category) LIKE '%cater%' THEN 'Catering'
        WHEN lower(vl.category) LIKE '%photo%' OR lower(vl.category) LIKE '%video%' THEN 'Photography'
        WHEN lower(vl.category) LIKE '%decor%' THEN 'Décor'
        WHEN lower(vl.category) LIKE '%flower%' OR lower(vl.category) LIKE '%flor%' THEN 'Flowers'
        WHEN lower(vl.category) LIKE '%music%' OR lower(vl.category) LIKE '%dj%' OR lower(vl.category) LIKE '%entertain%' OR lower(vl.category) LIKE '%band%' OR lower(vl.category) = 'mc' THEN 'Music/DJ'
        WHEN lower(vl.category) LIKE '%transport%' OR lower(vl.category) LIKE '%car hire%' THEN 'Transport'
        WHEN lower(vl.category) LIKE '%attire%' OR lower(vl.category) LIKE '%beauty%' OR lower(vl.category) LIKE '%makeup%' OR lower(vl.category) LIKE '%hair%' OR lower(vl.category) LIKE '%gown%' OR lower(vl.category) LIKE '%suit%' THEN 'Attire/Beauty'
        ELSE 'Miscellaneous'
      END AS estimator_category,
      lower(COALESCE(vl.location_county, '')) AS county_key,
      vl.minimum_budget_kes,
      vl.maximum_budget_kes,
      vl.created_at,
      vl.updated_at
    FROM public.vendor_listings vl
    WHERE vl.is_approved = true
      AND (
        normalized_county IS NULL
        OR lower(COALESCE(vl.location_county, '')) = normalized_county
      )
  ),
  learning_signals AS (
    SELECT
      lc.id AS vendor_listing_id,
      lc.estimator_category AS category_key,
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
        WHEN lower(vpo.category) LIKE '%venue%' THEN 'Venue'
        WHEN lower(vpo.category) LIKE '%cater%' THEN 'Catering'
        WHEN lower(vpo.category) LIKE '%photo%' OR lower(vpo.category) LIKE '%video%' THEN 'Photography'
        WHEN lower(vpo.category) LIKE '%decor%' THEN 'Décor'
        WHEN lower(vpo.category) LIKE '%flower%' OR lower(vpo.category) LIKE '%flor%' THEN 'Flowers'
        WHEN lower(vpo.category) LIKE '%music%' OR lower(vpo.category) LIKE '%dj%' OR lower(vpo.category) LIKE '%entertain%' OR lower(vpo.category) LIKE '%band%' OR lower(vpo.category) = 'mc' THEN 'Music/DJ'
        WHEN lower(vpo.category) LIKE '%transport%' OR lower(vpo.category) LIKE '%car hire%' THEN 'Transport'
        WHEN lower(vpo.category) LIKE '%attire%' OR lower(vpo.category) LIKE '%beauty%' OR lower(vpo.category) LIKE '%makeup%' OR lower(vpo.category) LIKE '%hair%' OR lower(vpo.category) LIKE '%gown%' OR lower(vpo.category) LIKE '%suit%' THEN 'Attire/Beauty'
        ELSE 'Miscellaneous'
      END AS category_key,
      ROUND(vpo.amount::numeric, 2) AS amount,
      CASE
        WHEN vpo.price_type = 'quote' THEN 0.60::numeric
        WHEN vpo.price_type = 'booked' THEN 0.85::numeric
        ELSE 1.00::numeric
      END AS signal_weight,
      COALESCE(vpo.event_date::timestamptz, vpo.created_at) AS observed_at
    FROM public.vendor_price_observations vpo
    JOIN listing_context lc
      ON lc.id = vpo.vendor_listing_id
    WHERE vpo.is_anonymized = true
      AND vpo.amount > 0
      AND (
        normalized_county IS NULL
        OR lower(COALESCE(vpo.location_county, lc.county_key, '')) = normalized_county
      )

    UNION ALL

    SELECT
      cd.vendor_listing_id,
      lc.estimator_category AS category_key,
      ROUND(cd.total_amount::numeric, 2) AS amount,
      0.60::numeric AS signal_weight,
      COALESCE(cd.issue_date::timestamptz, cd.created_at) AS observed_at
    FROM public.commercial_documents cd
    JOIN listing_context lc
      ON lc.id = cd.vendor_listing_id
    WHERE cd.document_type = 'quote'
      AND cd.status <> 'draft'
      AND cd.total_amount > 0

    UNION ALL

    SELECT
      cd.vendor_listing_id,
      lc.estimator_category AS category_key,
      ROUND(cd.total_amount::numeric, 2) AS amount,
      0.85::numeric AS signal_weight,
      COALESCE(cd.issue_date::timestamptz, cd.created_at) AS observed_at
    FROM public.commercial_documents cd
    JOIN listing_context lc
      ON lc.id = cd.vendor_listing_id
    WHERE cd.document_type = 'invoice'
      AND cd.status IN ('draft', 'sent', 'part_paid')
      AND cd.total_amount > 0

    UNION ALL

    SELECT
      cd.vendor_listing_id,
      lc.estimator_category AS category_key,
      ROUND(cd.total_amount::numeric, 2) AS amount,
      1.00::numeric AS signal_weight,
      COALESCE(cd.paid_date::timestamptz, cd.updated_at, cd.issue_date::timestamptz, cd.created_at) AS observed_at
    FROM public.commercial_documents cd
    JOIN listing_context lc
      ON lc.id = cd.vendor_listing_id
    WHERE cd.document_type = 'invoice'
      AND cd.status = 'paid'
      AND cd.total_amount > 0
      AND cd.amount_paid >= cd.total_amount
  ),
  vendor_learning_profiles AS (
    SELECT
      ls.vendor_listing_id,
      ls.category_key,
      ROUND((SUM(ls.amount * ls.signal_weight) / NULLIF(SUM(ls.signal_weight), 0))::numeric, 2) AS predicted_price,
      COUNT(*)::integer AS signal_count,
      MAX(ls.observed_at) AS last_observed_at
    FROM learning_signals ls
    WHERE ls.amount > 0
    GROUP BY ls.vendor_listing_id, ls.category_key
  ),
  market_data AS (
    SELECT
      vlp.category_key,
      COUNT(*)::bigint AS sample_size,
      ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY vlp.predicted_price))::numeric, 2) AS median_amount,
      ROUND(AVG(vlp.predicted_price)::numeric, 2) AS average_amount
    FROM vendor_learning_profiles vlp
    WHERE vlp.predicted_price > 0
    GROUP BY vlp.category_key
  ),
  estimated AS (
    SELECT
      cd.category,
      COALESCE(md.sample_size, 0)::bigint AS sample_size,
      COALESCE(md.sample_size, 0) >= required_sample_size AS benchmark_visible,
      CASE
        WHEN COALESCE(md.sample_size, 0) >= required_sample_size THEN
          ROUND(
            COALESCE(md.median_amount, md.average_amount)
            * style_factor
            * venue_factor
            * CASE
                WHEN lower(cd.category) IN ('venue', 'catering', 'décor', 'flowers') THEN GREATEST(normalized_guest_count::numeric / 120.0, 0.65)
                ELSE GREATEST(0.75 + ((normalized_guest_count::numeric - 120.0) / 1200.0), 0.70)
              END,
            2
          )
        ELSE
          ROUND((cd.fixed_base + (cd.per_guest_base * normalized_guest_count)) * style_factor * venue_factor, 2)
      END AS suggested_amount,
      cd.spread_ratio
    FROM category_defaults cd
    LEFT JOIN market_data md
      ON md.category_key = cd.category
  )
  SELECT
    estimated.category,
    CASE WHEN estimated.benchmark_visible THEN 'market' ELSE 'fallback' END::text AS source,
    estimated.sample_size,
    estimated.benchmark_visible,
    estimated.suggested_amount,
    ROUND(estimated.suggested_amount * (1 - estimated.spread_ratio), 2) AS low_amount,
    ROUND(estimated.suggested_amount * (1 + estimated.spread_ratio), 2) AS high_amount
  FROM estimated
  ORDER BY CASE lower(estimated.category)
    WHEN 'venue' THEN 1
    WHEN 'catering' THEN 2
    WHEN 'photography' THEN 3
    WHEN 'décor' THEN 4
    WHEN 'flowers' THEN 5
    WHEN 'music/dj' THEN 6
    WHEN 'transport' THEN 7
    WHEN 'attire/beauty' THEN 8
    ELSE 9
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_budget_estimate(integer, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_budget_estimate(integer, text, text, text, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_budget_estimate(integer, text, text, text, integer) TO authenticated;
