create table if not exists public.function_event_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  function_name text not null,
  severity text not null check (severity in ('info', 'warn', 'error')),
  status text not null check (status in ('success', 'failure')),
  event_type text not null,
  message text not null,
  user_id uuid null,
  audience text null,
  entity_id text null,
  request_id text null,
  details jsonb not null default '{}'::jsonb
);

create index if not exists function_event_logs_created_at_idx
  on public.function_event_logs (created_at desc);

create index if not exists function_event_logs_status_created_at_idx
  on public.function_event_logs (status, created_at desc);

create index if not exists function_event_logs_function_name_idx
  on public.function_event_logs (function_name, created_at desc);

alter table public.function_event_logs enable row level security;

drop policy if exists "Admins can view function event logs" on public.function_event_logs;
create policy "Admins can view function event logs"
on public.function_event_logs
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

drop function if exists public.admin_recent_function_events(text, integer);
create function public.admin_recent_function_events(
  status_filter text default 'failure',
  limit_rows integer default 50
)
returns table (
  created_at timestamptz,
  function_name text,
  severity text,
  status text,
  event_type text,
  message text,
  user_id uuid,
  audience text,
  entity_id text,
  request_id text,
  details jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Only admins can view function event logs.';
  end if;

  return query
  select
    l.created_at,
    l.function_name,
    l.severity,
    l.status,
    l.event_type,
    l.message,
    l.user_id,
    l.audience,
    l.entity_id,
    l.request_id,
    l.details
  from public.function_event_logs l
  where status_filter is null
    or status_filter = 'all'
    or l.status = status_filter
  order by l.created_at desc
  limit greatest(limit_rows, 1);
end;
$$;

drop function if exists public.admin_beta_readiness_snapshot();
create function public.admin_beta_readiness_snapshot()
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
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Only admins can view beta readiness metrics.';
  end if;

  return query
  select
    (select count(*)::integer
      from public.profiles p
      where p.beta_trial_status = 'active'
        and p.beta_trial_expires_at is not null
        and p.beta_trial_expires_at > now()),
    (select count(*)::integer
      from public.profiles p
      where p.planning_pass_status = 'active'
        and (p.planning_pass_expires_at is null or p.planning_pass_expires_at > now())),
    (select count(*)::integer
      from public.profiles p
      where p.role = 'planner'::public.app_role
        and p.planner_subscription_status = 'active'
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
        and l.function_name in ('sync-couple-checkout', 'sync-professional-checkout')
        and l.created_at >= now() - interval '7 days'),
    (select count(*)::integer
      from public.function_event_logs l
      where l.status = 'failure'
        and l.function_name = 'wedding-ai-chat'
        and l.created_at >= now() - interval '7 days');
end;
$$;

grant execute on function public.admin_recent_function_events(text, integer) to authenticated;
grant execute on function public.admin_beta_readiness_snapshot() to authenticated;
