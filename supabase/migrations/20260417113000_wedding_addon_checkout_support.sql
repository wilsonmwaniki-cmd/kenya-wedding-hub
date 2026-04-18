alter table public.wedding_subscription_bundles
  drop constraint if exists wedding_subscription_bundles_bundle_type_check;

alter table public.wedding_subscription_bundles
  add constraint wedding_subscription_bundles_bundle_type_check
  check (
    bundle_type in (
      'wedding_pass',
      'committee_bundle',
      'planner_addon',
      'export_addon',
      'calendar_addon',
      'ai_addon',
      'registry_addon',
      'guest_rsvp_addon'
    )
  );
