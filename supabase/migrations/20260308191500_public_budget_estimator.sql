-- Public budget estimator powered by anonymized pricing intelligence.
-- Safe for anonymous visitors because it exposes only aggregated estimates.

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
  market_data AS (
    SELECT
      lower(vpo.category) AS category_key,
      COUNT(*)::bigint AS sample_size,
      ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY vpo.amount))::numeric, 2) AS median_amount
    FROM public.vendor_price_observations vpo
    WHERE vpo.is_anonymized = true
      AND (
        county_input IS NULL
        OR lower(COALESCE(vpo.location_county, '')) = lower(county_input)
      )
    GROUP BY lower(vpo.category)
  ),
  estimated AS (
    SELECT
      cd.category,
      COALESCE(md.sample_size, 0)::bigint AS sample_size,
      COALESCE(md.sample_size, 0) >= required_sample_size AS benchmark_visible,
      CASE
        WHEN COALESCE(md.sample_size, 0) >= required_sample_size THEN
          ROUND(
            md.median_amount
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
      ON md.category_key = lower(cd.category)
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
