-- Keep the public pricing display and provider-enforced checkout amount aligned.
-- The vendor annual price remains KES 9,000.
update public.pricing_catalog
set
  config = jsonb_set(
    jsonb_set(
      config,
      '{professionalPlans,vendor,premium,monthlyPriceKes}',
      '850'::jsonb,
      true
    ),
    '{audiencePlans,vendor,displayMonthlyPriceKes}',
    '850'::jsonb,
    true
  ),
  updated_at = now()
where is_active = true;
