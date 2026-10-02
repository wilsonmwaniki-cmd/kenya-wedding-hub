-- Keep the public pricing display and provider-enforced checkout amounts aligned.
update public.pricing_catalog
set
  config = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          config,
          '{professionalPlans,planner,premium,monthlyPriceKes}',
          '1500'::jsonb,
          true
        ),
        '{professionalPlans,planner,premium,annualPriceKes}',
        '15000'::jsonb,
        true
      ),
      '{audiencePlans,planner,displayMonthlyPriceKes}',
      '1500'::jsonb,
      true
    ),
    '{audiencePlans,planner,displayAnnualPriceKes}',
    '15000'::jsonb,
    true
  ),
  updated_at = now()
where is_active = true;
