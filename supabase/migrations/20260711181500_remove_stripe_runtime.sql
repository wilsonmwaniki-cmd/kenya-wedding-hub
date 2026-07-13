alter table public.profiles
  drop column if exists stripe_customer_id;

drop function if exists public.admin_beta_readiness_snapshot();

create or replace function public.admin_beta_readiness_snapshot()
returns table (
  active_beta_trials integer,
  active_couple_passes integer,
  active_planner_subscriptions integer,
  active_vendor_subscriptions integer,
  active_wedding_entitlements integer,
  active_professional_entitlements integer,
  recent_failed_syncs integer,
  recent_ai_failures integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only admins can view the beta readiness snapshot';
  end if;

  return query
  select
    (select count(*)::integer
      from public.profiles p
      where p.beta_trial_status = 'active'
        and (p.beta_trial_expires_at is null or p.beta_trial_expires_at > now())),
    (select count(*)::integer
      from public.profiles p
      where p.planning_pass_status = 'active'
        and (p.planning_pass_expires_at is null or p.planning_pass_expires_at > now())),
    (select count(*)::integer
      from public.profiles p
      where p.planner_subscription_status = 'active'
        and (p.planner_subscription_expires_at is null or p.planner_subscription_expires_at > now())),
    (select count(*)::integer
      from public.vendor_listings vl
      where vl.subscription_status = 'active'
        and (vl.subscription_expires_at is null or vl.subscription_expires_at > now())),
    (select count(*)::integer
      from public.wedding_entitlements we
      where we.status = 'active'
        and (we.effective_to is null or we.effective_to > now())),
    (select count(*)::integer
      from public.professional_entitlements pe
      where pe.status = 'active'
        and (pe.effective_to is null or pe.effective_to > now())),
    (select count(*)::integer
      from public.function_event_logs l
      where l.status = 'failure'
        and l.function_name in ('sync-pesapal-couple-checkout', 'sync-pesapal-professional-checkout')
        and l.created_at >= now() - interval '7 days'),
    (select count(*)::integer
      from public.function_event_logs l
      where l.status = 'failure'
        and l.function_name = 'wedding-ai-chat'
        and l.created_at >= now() - interval '7 days');
end;
$$;
