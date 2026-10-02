-- Couple-facing pricing is intentionally simple: free Intimate planning and one
-- paid Collaborative plan. Professional pricing remains unchanged.
update public.pricing_catalog
set config = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        config,
        '{couplePlans}',
        $${
          "free": {
            "title": "Intimate",
            "annualPriceKes": null,
            "monthlyPriceKes": null,
            "bundleCode": null,
            "checkoutMonthlyLookupKey": null,
            "checkoutAnnualLookupKey": null
          },
          "collaborative": {
            "title": "Collaborative",
            "annualPriceKes": 15000,
            "monthlyPriceKes": 1999,
            "bundleCode": "couple_collaborative_annual",
            "checkoutMonthlyLookupKey": "couple_collaborative_monthly",
            "checkoutAnnualLookupKey": "couple_collaborative_annual"
          }
        }$$::jsonb,
        true
      ),
      '{coupleAddons}',
      '{}'::jsonb,
      true
    ),
    '{checkout,allowedLookupKeys}',
    (
      select coalesce(jsonb_agg(value), '[]'::jsonb)
      from jsonb_array_elements(config #> '{checkout,allowedLookupKeys}') as entry(value)
      where value #>> '{}' not in (
        'planning_pass_one_time',
        'couple_basic_monthly',
        'couple_basic_annual',
        'couple_premium_monthly',
        'couple_premium_annual',
        'gift_registry_addon',
        'guest_rsvp_management_addon'
      )
    ) || '["couple_collaborative_monthly", "couple_collaborative_annual"]'::jsonb,
    true
  ),
  '{checkout,coupleCheckoutMap}',
  $${
    "couple_collaborative_monthly": {
      "bundleCode": "couple_collaborative_monthly",
      "bundleType": "wedding_pass",
      "features": [
        "wedding_collaboration",
        "planner_collaboration",
        "vendor_collaboration"
      ],
      "couplePlanTier": "collaborative",
      "seatLimits": null,
      "syncLegacyPlanningPass": false
    },
    "couple_collaborative_annual": {
      "bundleCode": "couple_collaborative_annual",
      "bundleType": "wedding_pass",
      "features": [
        "wedding_collaboration",
        "planner_collaboration",
        "vendor_collaboration"
      ],
      "couplePlanTier": "collaborative",
      "seatLimits": null,
      "syncLegacyPlanningPass": false
    }
  }$$::jsonb,
  true
),
updated_at = now()
where is_active = true;

update public.pricing_catalog
set config = jsonb_set(
  config,
  '{audiencePlans,couple}',
  $${
    "title": "Couples",
    "billingCadence": "monthly_or_annual",
    "displayOneTimePriceKes": null,
    "displayMonthlyPriceKes": 1999,
    "displayAnnualPriceKes": 15000,
    "freeTierName": "Intimate",
    "paidTierName": "Collaborative",
    "entitlementCode": "couple_collaborative",
    "billingProductKey": "couple_collaborative",
    "checkoutMonthlyLookupKey": "couple_collaborative_monthly",
    "checkoutAnnualLookupKey": "couple_collaborative_annual",
    "checkoutOneTimeLookupKey": null,
    "successPath": "/budget?upgrade=success",
    "cancelPath": "/pricing?upgrade=cancelled"
  }$$::jsonb,
  true
),
updated_at = now()
where is_active = true;
