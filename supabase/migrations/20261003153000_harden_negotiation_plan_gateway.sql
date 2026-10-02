alter function public.save_negotiation_plan(uuid, uuid, uuid, numeric, numeric, text[], text[], text, text, numeric, uuid)
  security definer;

revoke insert, update on table public.vendor_negotiation_profiles from authenticated;
revoke insert on table public.vendor_negotiation_proposals from authenticated;

drop policy if exists "Wedding members can create negotiation profiles" on public.vendor_negotiation_profiles;
drop policy if exists "Wedding members can update negotiation profiles" on public.vendor_negotiation_profiles;
drop policy if exists "Wedding members can create negotiation proposals" on public.vendor_negotiation_proposals;

comment on function public.save_negotiation_plan(uuid, uuid, uuid, numeric, numeric, text[], text[], text, text, numeric, uuid) is
  'Security-definer Gateway boundary for confirmed negotiation plans. Validates auth, wedding membership, returned quote state and idempotency; authenticated clients have no direct table write grants.';

notify pgrst, 'reload schema';
