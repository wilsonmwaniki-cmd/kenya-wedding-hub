alter table public.weddings
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists deletion_reason text,
  add column if not exists is_meaningful boolean not null default false,
  add column if not exists became_meaningful_at timestamptz;

alter table public.weddings
  drop constraint if exists weddings_status_check;

alter table public.weddings
  add constraint weddings_status_check
  check (status in ('draft', 'active', 'archived', 'cancelled', 'deleted'));

create index if not exists weddings_status_created_by_idx
  on public.weddings (created_by_user_id, status, created_at desc);

create index if not exists weddings_deleted_at_idx
  on public.weddings (deleted_at desc)
  where deleted_at is not null;

alter table public.profiles
  add column if not exists account_purpose text,
  add column if not exists verified_couple boolean not null default false,
  add column if not exists free_wedding_replacement_used boolean not null default false,
  add column if not exists professional_use_risk_score integer not null default 0,
  add column if not exists professional_use_risk_level text not null default 'low',
  add column if not exists last_risk_calculated_at timestamptz,
  add column if not exists support_review_status text not null default 'none',
  add column if not exists support_review_notes text;

alter table public.profiles
  drop constraint if exists profiles_account_purpose_check;

alter table public.profiles
  add constraint profiles_account_purpose_check
  check (
    account_purpose is null
    or account_purpose in (
      'planning_my_own_wedding',
      'helping_family_or_friend',
      'professional_planner',
      'vendor',
      'other'
    )
  );

alter table public.profiles
  drop constraint if exists profiles_professional_use_risk_level_check;

alter table public.profiles
  add constraint profiles_professional_use_risk_level_check
  check (professional_use_risk_level in ('low', 'medium', 'high'));

alter table public.profiles
  drop constraint if exists profiles_support_review_status_check;

alter table public.profiles
  add constraint profiles_support_review_status_check
  check (support_review_status in ('none', 'pending', 'approved', 'restricted'));

create table if not exists public.zania_feature_flags (
  key text primary key,
  value jsonb not null,
  description text null,
  updated_at timestamptz not null default now(),
  constraint zania_feature_flags_value_is_json check (jsonb_typeof(value) is not null)
);

drop trigger if exists update_zania_feature_flags_updated_at on public.zania_feature_flags;
create trigger update_zania_feature_flags_updated_at
before update on public.zania_feature_flags
for each row execute function public.update_updated_at_column();

alter table public.zania_feature_flags enable row level security;

drop policy if exists "Admins can view zania feature flags" on public.zania_feature_flags;
create policy "Admins can view zania feature flags"
on public.zania_feature_flags
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admins can manage zania feature flags" on public.zania_feature_flags;
create policy "Admins can manage zania feature flags"
on public.zania_feature_flags
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

insert into public.zania_feature_flags (key, value, description)
values
  ('FREE_PLAN_MAX_ACTIVE_WEDDINGS', '1'::jsonb, 'Maximum active wedding workspaces allowed on the free Intimate plan.'),
  ('FREE_PLAN_MAX_TRUSTED_DEVICES', '1'::jsonb, 'Maximum concurrently trusted devices for a free Intimate account.'),
  ('FREE_PLAN_DEVICE_SWITCH_LIMIT', '3'::jsonb, 'Allowed free-plan device switches inside the switch window before review.'),
  ('FREE_PLAN_DEVICE_SWITCH_WINDOW_DAYS', '90'::jsonb, 'Rolling device switch window for the free plan.'),
  ('FREE_PLAN_ALLOW_PARTNER_ACCOUNT', 'true'::jsonb, 'Whether a second partner owner seat is allowed on the free Intimate plan.'),
  ('FREE_PLAN_ALLOW_EXPORT', 'true'::jsonb, 'Whether lightweight branded exports remain available on the free Intimate plan.'),
  ('PROFESSIONAL_RISK_THRESHOLD_MEDIUM', '30'::jsonb, 'Minimum risk score that should be treated as medium.'),
  ('PROFESSIONAL_RISK_THRESHOLD_HIGH', '60'::jsonb, 'Minimum risk score that should be treated as high.'),
  ('MEANINGFUL_WEDDING_GUEST_THRESHOLD', '10'::jsonb, 'Guest-count threshold used by meaningful-wedding detection.'),
  ('MEANINGFUL_WEDDING_ACTIVITY_DAYS', '14'::jsonb, 'Active-day threshold used by meaningful-wedding detection.'),
  ('FREE_PLAN_REPLACEMENT_WINDOW_DAYS', '7'::jsonb, 'Number of days in which a low-activity deleted wedding may be replaced once.'),
  ('FREE_PLAN_REPLACEMENT_GUEST_THRESHOLD', '5'::jsonb, 'Maximum guest count still treated as a low-activity replacement candidate.')
on conflict (key) do nothing;

create table if not exists public.wedding_lifecycle_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  created_at timestamptz not null,
  deleted_at timestamptz null,
  wedding_date date null,
  workspace_lifetime_days integer null,
  guest_count_at_deletion integer not null default 0,
  vendor_count_at_deletion integer not null default 0,
  export_count integer not null default 0,
  collaborator_invite_count integer not null default 0,
  is_meaningful boolean not null default false,
  became_meaningful_at timestamptz null,
  last_activity_at timestamptz null,
  created_wedding_name text null,
  deletion_reason text null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (wedding_id, user_id)
);

create index if not exists wedding_lifecycle_history_user_created_idx
  on public.wedding_lifecycle_history (user_id, created_at desc);

create index if not exists wedding_lifecycle_history_user_deleted_idx
  on public.wedding_lifecycle_history (user_id, deleted_at desc);

drop trigger if exists update_wedding_lifecycle_history_updated_at on public.wedding_lifecycle_history;
create trigger update_wedding_lifecycle_history_updated_at
before update on public.wedding_lifecycle_history
for each row execute function public.update_updated_at_column();

alter table public.wedding_lifecycle_history enable row level security;

drop policy if exists "Users can view own wedding lifecycle history" on public.wedding_lifecycle_history;
create policy "Users can view own wedding lifecycle history"
on public.wedding_lifecycle_history
for select
to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'::public.app_role));

create table if not exists public.account_audit_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete cascade,
  wedding_id uuid null references public.weddings(id) on delete cascade,
  device_session_id uuid null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists account_audit_events_user_created_idx
  on public.account_audit_events (user_id, created_at desc);

create index if not exists account_audit_events_wedding_created_idx
  on public.account_audit_events (wedding_id, created_at desc);

create index if not exists account_audit_events_type_created_idx
  on public.account_audit_events (event_type, created_at desc);

alter table public.account_audit_events enable row level security;

drop policy if exists "Users can view own account audit events" on public.account_audit_events;
create policy "Users can view own account audit events"
on public.account_audit_events
for select
to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'::public.app_role));

create table if not exists public.device_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_name text null,
  platform text null,
  browser text null,
  app_installation_id text null,
  push_token text null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_ip_hash text null,
  last_approximate_location text null,
  trusted_at timestamptz null,
  revoked_at timestamptz null,
  is_current boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists device_sessions_user_device_unique
  on public.device_sessions (user_id, device_id);

create index if not exists device_sessions_user_current_idx
  on public.device_sessions (user_id, is_current, last_seen_at desc);

alter table public.device_sessions enable row level security;

drop policy if exists "Users can view own device sessions" on public.device_sessions;
create policy "Users can view own device sessions"
on public.device_sessions
for select
to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'::public.app_role));

create table if not exists public.otp_audit_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete cascade,
  device_session_id uuid null,
  phone_number_hash text null,
  ip_hash text null,
  otp_purpose text not null,
  delivery_channel text null,
  status text not null,
  attempt_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  check (status in ('requested', 'verified', 'failed', 'locked', 'expired')),
  check (attempt_count >= 0)
);

create index if not exists otp_audit_events_user_created_idx
  on public.otp_audit_events (user_id, created_at desc);

create index if not exists otp_audit_events_purpose_created_idx
  on public.otp_audit_events (otp_purpose, created_at desc);

alter table public.otp_audit_events enable row level security;

drop policy if exists "Users can view own otp audit events" on public.otp_audit_events;
create policy "Users can view own otp audit events"
on public.otp_audit_events
for select
to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'::public.app_role));

create or replace function public.get_zania_flag_int(flag_key text, fallback_value integer)
returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  raw_value jsonb;
  normalized text;
begin
  select value
  into raw_value
  from public.zania_feature_flags
  where key = flag_key;

  if raw_value is null then
    return fallback_value;
  end if;

  normalized := trim(both '"' from raw_value::text);
  return coalesce(nullif(normalized, '')::integer, fallback_value);
exception
  when others then
    return fallback_value;
end;
$$;

create or replace function public.get_zania_flag_bool(flag_key text, fallback_value boolean)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  raw_value jsonb;
  normalized text;
begin
  select value
  into raw_value
  from public.zania_feature_flags
  where key = flag_key;

  if raw_value is null then
    return fallback_value;
  end if;

  normalized := lower(trim(both '"' from raw_value::text));
  if normalized in ('true', 't', '1', 'yes') then
    return true;
  end if;
  if normalized in ('false', 'f', '0', 'no') then
    return false;
  end if;
  return fallback_value;
end;
$$;

create or replace function public.log_account_audit_event(
  target_user_id uuid,
  target_wedding_id uuid,
  target_event_type text,
  event_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_id uuid;
begin
  insert into public.account_audit_events (
    user_id,
    wedding_id,
    event_type,
    metadata
  )
  values (
    target_user_id,
    target_wedding_id,
    target_event_type,
    coalesce(event_metadata, '{}'::jsonb)
  )
  returning id into created_id;

  return created_id;
end;
$$;

create or replace function public.current_user_primary_owned_wedding_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select wm.wedding_id
  from public.wedding_memberships wm
  join public.weddings w on w.id = wm.wedding_id
  where wm.user_id = auth.uid()
    and wm.is_owner = true
    and wm.membership_status = 'active'
    and wm.role in ('bride', 'groom')
    and w.status = 'active'
    and w.deleted_at is null
  order by wm.created_at asc
  limit 1;
$$;

create or replace function public.primary_owned_wedding_id(target_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select wm.wedding_id
  from public.wedding_memberships wm
  join public.weddings w on w.id = wm.wedding_id
  where wm.user_id = target_user_id
    and wm.is_owner = true
    and wm.membership_status = 'active'
    and wm.role in ('bride', 'groom')
    and w.status = 'active'
    and w.deleted_at is null
  order by wm.created_at asc
  limit 1;
$$;

create or replace function public.get_wedding_collaboration_metrics(target_wedding_id uuid)
returns table (
  guest_count integer,
  vendor_count integer,
  export_count integer,
  collaborator_invite_count integer,
  task_count integer,
  budget_item_count integer,
  timeline_event_count integer,
  last_activity_at timestamptz
)
language sql
stable
set search_path = public
as $$
  with task_metrics as (
    select
      count(*)::integer as task_count,
      max(t.created_at) as task_last_activity
    from public.tasks t
    where t.wedding_id = target_wedding_id
  ),
  budget_metrics as (
    select
      count(*)::integer as budget_item_count,
      max(bc.created_at) as budget_last_activity
    from public.budget_categories bc
    where bc.wedding_id = target_wedding_id
  ),
  guest_metrics as (
    select
      count(*)::integer as guest_count,
      max(g.created_at) as guest_last_activity
    from public.guests g
    where g.wedding_id = target_wedding_id
  ),
  vendor_metrics as (
    select
      count(*)::integer as vendor_count,
      max(v.created_at) as vendor_last_activity
    from public.vendors v
    where v.wedding_id = target_wedding_id
  ),
  invite_metrics as (
    select
      count(*)::integer as collaborator_invite_count,
      max(wi.created_at) as invite_last_activity
    from public.wedding_invites wi
    where wi.wedding_id = target_wedding_id
      and wi.invite_type <> 'partner'
  ),
  timeline_metrics as (
    select
      count(te.id)::integer as timeline_event_count,
      greatest(max(t.created_at), max(te.created_at)) as timeline_last_activity
    from public.timelines t
    left join public.timeline_events te on te.timeline_id = t.id
    where t.wedding_id = target_wedding_id
  ),
  export_metrics as (
    select
      count(*)::integer as export_count,
      max(ae.created_at) as export_last_activity
    from public.account_audit_events ae
    where ae.wedding_id = target_wedding_id
      and ae.event_type = 'EXPORT_GENERATED'
  )
  select
    gm.guest_count,
    vm.vendor_count,
    em.export_count,
    im.collaborator_invite_count,
    tm.task_count,
    bm.budget_item_count,
    tlm.timeline_event_count,
    greatest(
      coalesce(gm.guest_last_activity, '-infinity'::timestamptz),
      coalesce(vm.vendor_last_activity, '-infinity'::timestamptz),
      coalesce(im.invite_last_activity, '-infinity'::timestamptz),
      coalesce(tm.task_last_activity, '-infinity'::timestamptz),
      coalesce(bm.budget_last_activity, '-infinity'::timestamptz),
      coalesce(tlm.timeline_last_activity, '-infinity'::timestamptz),
      coalesce(em.export_last_activity, '-infinity'::timestamptz)
    ) as last_activity_at
  from guest_metrics gm
  cross join vendor_metrics vm
  cross join export_metrics em
  cross join invite_metrics im
  cross join task_metrics tm
  cross join budget_metrics bm
  cross join timeline_metrics tlm;
$$;

create or replace function public.is_meaningful_wedding(target_wedding_id uuid)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  wedding_row public.weddings%rowtype;
  metrics record;
  guest_threshold integer := public.get_zania_flag_int('MEANINGFUL_WEDDING_GUEST_THRESHOLD', 10);
  activity_days integer := public.get_zania_flag_int('MEANINGFUL_WEDDING_ACTIVITY_DAYS', 14);
begin
  select *
  into wedding_row
  from public.weddings
  where id = target_wedding_id;

  if wedding_row.id is null then
    return false;
  end if;

  select *
  into metrics
  from public.get_wedding_collaboration_metrics(target_wedding_id);

  return
    coalesce(metrics.guest_count, 0) > guest_threshold
    or coalesce(metrics.vendor_count, 0) > 3
    or coalesce(metrics.budget_item_count, 0) > 0
    or coalesce(metrics.task_count, 0) > 10
    or coalesce(metrics.timeline_event_count, 0) > 0
    or coalesce(metrics.export_count, 0) > 0
    or wedding_row.wedding_date is not null
    or nullif(trim(coalesce(wedding_row.location_town, '')), '') is not null
    or nullif(trim(coalesce(wedding_row.location_county, '')), '') is not null
    or wedding_row.created_at <= now() - make_interval(days => activity_days);
end;
$$;

create or replace function public.sync_wedding_meaningful_state(target_wedding_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  meaningful_now boolean;
begin
  meaningful_now := public.is_meaningful_wedding(target_wedding_id);

  update public.weddings
  set
    is_meaningful = meaningful_now,
    became_meaningful_at = case
      when meaningful_now then coalesce(became_meaningful_at, now())
      else became_meaningful_at
    end,
    updated_at = now()
  where id = target_wedding_id;

  update public.wedding_lifecycle_history
  set
    is_meaningful = meaningful_now,
    became_meaningful_at = case
      when meaningful_now then coalesce(became_meaningful_at, now())
      else became_meaningful_at
    end,
    updated_at = now()
  where wedding_id = target_wedding_id;

  return meaningful_now;
end;
$$;

create or replace function public.upsert_wedding_lifecycle_history(target_wedding_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  wedding_row public.weddings%rowtype;
  metrics record;
begin
  select *
  into wedding_row
  from public.weddings
  where id = target_wedding_id;

  if wedding_row.id is null then
    return;
  end if;

  select *
  into metrics
  from public.get_wedding_collaboration_metrics(target_wedding_id);

  insert into public.wedding_lifecycle_history (
    user_id,
    wedding_id,
    created_at,
    deleted_at,
    wedding_date,
    workspace_lifetime_days,
    guest_count_at_deletion,
    vendor_count_at_deletion,
    export_count,
    collaborator_invite_count,
    is_meaningful,
    became_meaningful_at,
    last_activity_at,
    created_wedding_name,
    deletion_reason,
    metadata
  )
  values (
    wedding_row.created_by_user_id,
    wedding_row.id,
    wedding_row.created_at,
    wedding_row.deleted_at,
    wedding_row.wedding_date,
    case
      when wedding_row.deleted_at is null then null
      else greatest((wedding_row.deleted_at::date - wedding_row.created_at::date), 0)
    end,
    coalesce(metrics.guest_count, 0),
    coalesce(metrics.vendor_count, 0),
    coalesce(metrics.export_count, 0),
    coalesce(metrics.collaborator_invite_count, 0),
    coalesce(wedding_row.is_meaningful, false),
    wedding_row.became_meaningful_at,
    metrics.last_activity_at,
    wedding_row.name,
    wedding_row.deletion_reason,
    jsonb_build_object(
      'status', wedding_row.status,
      'location_county', wedding_row.location_county,
      'location_town', wedding_row.location_town,
      'wedding_code', wedding_row.wedding_code
    )
  )
  on conflict (wedding_id, user_id) do update
  set
    deleted_at = excluded.deleted_at,
    wedding_date = excluded.wedding_date,
    workspace_lifetime_days = excluded.workspace_lifetime_days,
    guest_count_at_deletion = excluded.guest_count_at_deletion,
    vendor_count_at_deletion = excluded.vendor_count_at_deletion,
    export_count = excluded.export_count,
    collaborator_invite_count = excluded.collaborator_invite_count,
    is_meaningful = excluded.is_meaningful,
    became_meaningful_at = excluded.became_meaningful_at,
    last_activity_at = excluded.last_activity_at,
    created_wedding_name = excluded.created_wedding_name,
    deletion_reason = excluded.deletion_reason,
    metadata = excluded.metadata,
    updated_at = now();
end;
$$;

create or replace function public.can_create_replacement_free_wedding(target_user_id uuid)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  replacement_used boolean := false;
  replacement_window_days integer := public.get_zania_flag_int('FREE_PLAN_REPLACEMENT_WINDOW_DAYS', 7);
  guest_threshold integer := public.get_zania_flag_int('FREE_PLAN_REPLACEMENT_GUEST_THRESHOLD', 5);
  candidate record;
begin
  select p.free_wedding_replacement_used
  into replacement_used
  from public.profiles p
  where p.user_id = target_user_id;

  if coalesce(replacement_used, false) then
    return false;
  end if;

  select *
  into candidate
  from public.wedding_lifecycle_history wlh
  where wlh.user_id = target_user_id
    and wlh.deleted_at is not null
  order by wlh.deleted_at desc
  limit 1;

  if candidate.user_id is null then
    return false;
  end if;

  return
    coalesce(candidate.is_meaningful, false) = false
    and coalesce(candidate.workspace_lifetime_days, replacement_window_days + 1) < replacement_window_days
    and coalesce(candidate.guest_count_at_deletion, 0) < guest_threshold
    and coalesce(candidate.vendor_count_at_deletion, 0) = 0
    and coalesce(candidate.export_count, 0) = 0
    and coalesce(candidate.collaborator_invite_count, 0) = 0;
end;
$$;

create or replace function public.recalculate_professional_risk(target_user_id uuid)
returns table (
  risk_score integer,
  risk_level text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_score integer := 0;
  medium_threshold integer := public.get_zania_flag_int('PROFESSIONAL_RISK_THRESHOLD_MEDIUM', 30);
  high_threshold integer := public.get_zania_flag_int('PROFESSIONAL_RISK_THRESHOLD_HIGH', 60);
  deleted_wedding_count integer := 0;
  meaningful_wedding_count integer := 0;
  weddings_last_18_months integer := 0;
  average_lifetime_days numeric := 0;
  distinct_wedding_names integer := 0;
  total_exports integer := 0;
  planner_or_committee_attempts integer := 0;
  device_switches integer := 0;
  bypass_attempts integer := 0;
  purpose text;
  resolved_level text := 'low';
begin
  select account_purpose
  into purpose
  from public.profiles
  where user_id = target_user_id;

  select
    count(*) filter (where deleted_at is not null),
    count(*) filter (where is_meaningful),
    count(*) filter (where created_at >= now() - interval '18 months'),
    coalesce(avg(workspace_lifetime_days), 0),
    count(distinct created_wedding_name),
    coalesce(sum(export_count), 0)
  into
    deleted_wedding_count,
    meaningful_wedding_count,
    weddings_last_18_months,
    average_lifetime_days,
    distinct_wedding_names,
    total_exports
  from public.wedding_lifecycle_history
  where user_id = target_user_id;

  select count(*)
  into planner_or_committee_attempts
  from public.account_audit_events
  where user_id = target_user_id
    and event_type in ('PLANNER_ROLE_ATTEMPTED', 'COLLABORATOR_INVITE_ATTEMPTED');

  select count(*)
  into device_switches
  from public.account_audit_events
  where user_id = target_user_id
    and event_type = 'DEVICE_SWITCHED'
    and created_at >= now() - interval '90 days';

  select count(*)
  into bypass_attempts
  from public.account_audit_events
  where user_id = target_user_id
    and event_type in ('SECOND_WEDDING_ATTEMPTED', 'COLLABORATIVE_PLAN_REQUIRED');

  if meaningful_wedding_count > 1 then
    new_score := new_score + 30;
  end if;

  if weddings_last_18_months > 2 then
    new_score := new_score + 30;
  end if;

  if deleted_wedding_count > 0 and meaningful_wedding_count > 0 then
    new_score := new_score + 25;
  end if;

  if average_lifetime_days > 0 and average_lifetime_days < 60 then
    new_score := new_score + 15;
  end if;

  if distinct_wedding_names > 1 then
    new_score := new_score + 15;
  end if;

  if total_exports >= 3 then
    new_score := new_score + 10;
  end if;

  if device_switches > public.get_zania_flag_int('FREE_PLAN_DEVICE_SWITCH_LIMIT', 3) then
    new_score := new_score + 10;
  end if;

  if planner_or_committee_attempts > 0 then
    new_score := new_score + 20;
  end if;

  if purpose = 'professional_planner' then
    new_score := new_score + 50;
  end if;

  if bypass_attempts > 1 then
    new_score := new_score + 30;
  end if;

  if new_score >= high_threshold then
    resolved_level := 'high';
  elsif new_score >= medium_threshold then
    resolved_level := 'medium';
  end if;

  update public.profiles
  set
    professional_use_risk_score = new_score,
    professional_use_risk_level = resolved_level,
    last_risk_calculated_at = now(),
    updated_at = now()
  where user_id = target_user_id;

  return query select new_score, resolved_level;
end;
$$;

create or replace function public.assert_wedding_feature_enabled(
  target_wedding_id uuid,
  required_feature text,
  audit_event_type text default 'COLLABORATIVE_PLAN_REQUIRED'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_owner_user_id uuid;
begin
  if public.wedding_has_feature(target_wedding_id, required_feature) then
    return;
  end if;

  select w.created_by_user_id
  into target_owner_user_id
  from public.weddings w
  where w.id = target_wedding_id;

  perform public.log_account_audit_event(
    target_owner_user_id,
    target_wedding_id,
    audit_event_type,
    jsonb_build_object('required_feature', required_feature)
  );

  if target_owner_user_id is not null then
    perform public.recalculate_professional_risk(target_owner_user_id);
  end if;

  raise exception 'COLLABORATIVE_PLAN_REQUIRED: Upgrade to Collaborative to invite planners, committee members, family or vendors.'
    using errcode = 'P0001';
end;
$$;

create or replace function public.soft_delete_wedding_workspace(
  target_wedding_id uuid,
  deletion_reason_input text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  wedding_row public.weddings%rowtype;
  active_owner record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select *
  into wedding_row
  from public.weddings
  where id = target_wedding_id
  for update;

  if wedding_row.id is null then
    raise exception 'Wedding not found'
      using errcode = 'P0002';
  end if;

  select 1
  into active_owner
  from public.wedding_memberships wm
  where wm.wedding_id = target_wedding_id
    and wm.user_id = auth.uid()
    and wm.is_owner = true
    and wm.membership_status = 'active'
    and wm.role in ('bride', 'groom')
  limit 1;

  if active_owner is null and not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Only a wedding owner can delete this workspace'
      using errcode = '42501';
  end if;

  perform public.sync_wedding_meaningful_state(target_wedding_id);

  update public.weddings
  set
    status = 'deleted',
    deleted_at = now(),
    deleted_by_user_id = auth.uid(),
    deletion_reason = nullif(trim(coalesce(deletion_reason_input, '')), ''),
    updated_at = now()
  where id = target_wedding_id;

  perform public.upsert_wedding_lifecycle_history(target_wedding_id);
  perform public.log_account_audit_event(wedding_row.created_by_user_id, target_wedding_id, 'WEDDING_DELETED', jsonb_build_object(
    'reason', nullif(trim(coalesce(deletion_reason_input, '')), ''),
    'is_meaningful', wedding_row.is_meaningful
  ));
  perform public.recalculate_professional_risk(wedding_row.created_by_user_id);
end;
$$;

create or replace function public.archive_wedding_workspace(target_wedding_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  wedding_owner_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.wedding_memberships wm
    where wm.wedding_id = target_wedding_id
      and wm.user_id = auth.uid()
      and wm.is_owner = true
      and wm.membership_status = 'active'
      and wm.role in ('bride', 'groom')
  ) and not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Only a wedding owner can archive this workspace'
      using errcode = '42501';
  end if;

  update public.weddings
  set
    status = 'archived',
    updated_at = now()
  where id = target_wedding_id;

  select created_by_user_id
  into wedding_owner_user_id
  from public.weddings
  where id = target_wedding_id;

  perform public.upsert_wedding_lifecycle_history(target_wedding_id);
  perform public.log_account_audit_event(wedding_owner_user_id, target_wedding_id, 'WEDDING_ARCHIVED');
  perform public.recalculate_professional_risk(wedding_owner_user_id);
end;
$$;

create or replace function public.restore_deleted_wedding_workspace(target_wedding_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  wedding_owner_user_id uuid;
begin
  perform public.require_admin();

  update public.weddings
  set
    status = 'archived',
    deleted_at = null,
    deleted_by_user_id = null,
    deletion_reason = null,
    updated_at = now()
  where id = target_wedding_id;

  select created_by_user_id
  into wedding_owner_user_id
  from public.weddings
  where id = target_wedding_id;

  perform public.upsert_wedding_lifecycle_history(target_wedding_id);
  perform public.log_account_audit_event(wedding_owner_user_id, target_wedding_id, 'WEDDING_RESTORED');
  perform public.recalculate_professional_risk(wedding_owner_user_id);
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role_text text;
  requested_role public.app_role;
  requested_planner_type text;
  resolved_planner_type text;
  resolved_committee_name text;
  resolved_wedding_county text;
  resolved_wedding_town text;
  resolved_primary_county text;
  resolved_primary_town text;
  resolved_service_areas text[];
  resolved_travel_scope text;
  resolved_minimum_budget numeric;
  resolved_maximum_budget numeric;
  resolved_wedding_location text;
  resolved_account_purpose text;
begin
  requested_role_text := lower(
    coalesce(
      new.raw_user_meta_data->>'role',
      new.raw_user_meta_data->>'signup_target_role',
      new.raw_user_meta_data->>'professional_signup_role',
      'couple'
    )
  );
  requested_planner_type := lower(coalesce(new.raw_user_meta_data->>'planner_type', ''));

  requested_role := case
    when requested_role_text in ('planner', 'committee') then 'planner'::public.app_role
    when requested_role_text = 'vendor' then 'vendor'::public.app_role
    else 'couple'::public.app_role
  end;

  resolved_planner_type := case
    when requested_role_text = 'committee' then 'committee'
    when requested_role = 'planner'::public.app_role and requested_planner_type = 'committee' then 'committee'
    when requested_role = 'planner'::public.app_role then 'professional'
    else null
  end;

  resolved_committee_name := case
    when resolved_planner_type = 'committee'
      then nullif(trim(coalesce(new.raw_user_meta_data->>'committee_name', '')), '')
    else null
  end;

  resolved_wedding_county := nullif(trim(coalesce(new.raw_user_meta_data->>'wedding_county', '')), '');
  resolved_wedding_town := nullif(trim(coalesce(new.raw_user_meta_data->>'wedding_town', '')), '');
  resolved_primary_county := nullif(trim(coalesce(new.raw_user_meta_data->>'primary_county', '')), '');
  resolved_primary_town := nullif(trim(coalesce(new.raw_user_meta_data->>'primary_town', '')), '');

  resolved_service_areas := coalesce(
    array(
      select jsonb_array_elements_text(coalesce(new.raw_user_meta_data->'service_areas', '[]'::jsonb))
    ),
    '{}'::text[]
  );

  resolved_travel_scope := lower(coalesce(new.raw_user_meta_data->>'travel_scope', 'selected_counties'));
  if resolved_travel_scope not in ('local_only', 'selected_counties', 'nationwide') then
    resolved_travel_scope := 'selected_counties';
  end if;

  resolved_minimum_budget := nullif(trim(coalesce(new.raw_user_meta_data->>'minimum_budget_kes', '')), '')::numeric;
  resolved_maximum_budget := nullif(trim(coalesce(new.raw_user_meta_data->>'maximum_budget_kes', '')), '')::numeric;
  resolved_wedding_location := nullif(trim(concat_ws(', ', resolved_wedding_town, resolved_wedding_county)), '');
  resolved_account_purpose := nullif(trim(coalesce(new.raw_user_meta_data->>'account_purpose', '')), '');

  insert into public.profiles (
    user_id,
    full_name,
    role,
    planner_type,
    committee_name,
    wedding_county,
    wedding_town,
    wedding_location,
    primary_county,
    primary_town,
    service_areas,
    travel_scope,
    minimum_budget_kes,
    maximum_budget_kes,
    account_purpose
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    requested_role,
    resolved_planner_type,
    resolved_committee_name,
    resolved_wedding_county,
    resolved_wedding_town,
    resolved_wedding_location,
    resolved_primary_county,
    resolved_primary_town,
    resolved_service_areas,
    resolved_travel_scope,
    resolved_minimum_budget,
    resolved_maximum_budget,
    resolved_account_purpose
  )
  on conflict (user_id) do update
  set
    full_name = excluded.full_name,
    role = excluded.role,
    planner_type = excluded.planner_type,
    committee_name = coalesce(excluded.committee_name, public.profiles.committee_name),
    wedding_county = coalesce(excluded.wedding_county, public.profiles.wedding_county),
    wedding_town = coalesce(excluded.wedding_town, public.profiles.wedding_town),
    wedding_location = coalesce(excluded.wedding_location, public.profiles.wedding_location),
    primary_county = coalesce(excluded.primary_county, public.profiles.primary_county),
    primary_town = coalesce(excluded.primary_town, public.profiles.primary_town),
    service_areas = case
      when cardinality(excluded.service_areas) > 0 then excluded.service_areas
      else public.profiles.service_areas
    end,
    travel_scope = coalesce(excluded.travel_scope, public.profiles.travel_scope),
    minimum_budget_kes = coalesce(excluded.minimum_budget_kes, public.profiles.minimum_budget_kes),
    maximum_budget_kes = coalesce(excluded.maximum_budget_kes, public.profiles.maximum_budget_kes),
    account_purpose = coalesce(excluded.account_purpose, public.profiles.account_purpose);

  insert into public.user_roles (user_id, role)
  values (new.id, requested_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

create or replace function public.get_my_wedding_ownership()
returns table (
  wedding_id uuid,
  wedding_name text,
  wedding_code text,
  wedding_date date,
  location_county text,
  location_town text,
  owner_role text,
  partner_email text,
  partner_role text,
  partner_status text,
  partner_invite_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_membership public.wedding_memberships%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select wm.*
  into owner_membership
  from public.wedding_memberships wm
  join public.weddings w on w.id = wm.wedding_id
  where wm.membership_status = 'active'
    and wm.is_owner = true
    and wm.role in ('bride', 'groom')
    and w.status = 'active'
    and w.deleted_at is null
    and (
      wm.user_id = auth.uid()
      or lower(wm.email) = public.current_user_email()
    )
  order by wm.created_at asc
  limit 1;

  if owner_membership.id is null then
    return;
  end if;

  return query
  with partner_membership as (
    select wm.email, wm.role, wm.membership_status
    from public.wedding_memberships wm
    where wm.wedding_id = owner_membership.wedding_id
      and wm.is_owner = true
      and wm.id <> owner_membership.id
    order by wm.created_at asc
    limit 1
  ), pending_invite as (
    select wi.email, wi.proposed_role, wi.expires_at
    from public.wedding_invites wi
    where wi.wedding_id = owner_membership.wedding_id
      and wi.invite_type = 'partner'
      and wi.status = 'pending'
    order by wi.created_at desc
    limit 1
  )
  select
    w.id,
    w.name,
    w.wedding_code,
    w.wedding_date,
    w.location_county,
    w.location_town,
    owner_membership.role::text,
    coalesce(pm.email, pi.email),
    coalesce(pm.role, pi.proposed_role)::text,
    case
      when pm.membership_status = 'active' then 'active'
      when pi.email is not null or pm.membership_status = 'invited' then 'pending'
      else 'not_invited'
    end::text,
    pi.expires_at
  from public.weddings w
  left join partner_membership pm on true
  left join pending_invite pi on true
  where w.id = owner_membership.wedding_id
    and w.status = 'active'
    and w.deleted_at is null;
end;
$$;

create or replace function public.create_wedding_workspace(
  wedding_name text,
  creator_role text,
  partner_email_input text default null::text,
  wedding_date_input date default null::date,
  location_county_input text default null::text,
  location_town_input text default null::text
)
returns table (
  wedding_id uuid,
  wedding_code text,
  owner_membership_id uuid,
  partner_invite_id uuid
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  created_wedding_id uuid;
  created_wedding_code text;
  created_owner_membership_id uuid;
  created_partner_invite_id uuid;
  normalized_role text;
  normalized_partner_email text;
  existing_active_wedding_id uuid;
  max_active_weddings integer := public.get_zania_flag_int('FREE_PLAN_MAX_ACTIVE_WEDDINGS', 1);
  has_paid_couple_access boolean := false;
  can_use_replacement boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  normalized_role := lower(trim(coalesce(creator_role, '')));
  if normalized_role not in ('bride', 'groom') then
    raise exception 'Creator role must be bride or groom'
      using errcode = '22023';
  end if;

  normalized_partner_email := nullif(lower(trim(coalesce(partner_email_input, ''))), '');

  select p.planning_pass_status = 'active'
    and (p.planning_pass_expires_at is null or p.planning_pass_expires_at > now())
  into has_paid_couple_access
  from public.profiles p
  where p.user_id = auth.uid();

  select public.primary_owned_wedding_id(auth.uid())
  into existing_active_wedding_id;

  if existing_active_wedding_id is not null and not has_paid_couple_access then
    perform public.log_account_audit_event(auth.uid(), existing_active_wedding_id, 'SECOND_WEDDING_ATTEMPTED');
    perform public.recalculate_professional_risk(auth.uid());
    raise exception 'You already have an active Intimate wedding workspace. Upgrade to Collaborative to coordinate another wedding.'
      using errcode = 'P0001';
  end if;

  if not has_paid_couple_access then
    can_use_replacement := public.can_create_replacement_free_wedding(auth.uid());

    if (
      select count(*)
      from public.wedding_lifecycle_history wlh
      where wlh.user_id = auth.uid()
    ) >= max_active_weddings
      and not can_use_replacement then
      perform public.log_account_audit_event(auth.uid(), null, 'SECOND_WEDDING_ATTEMPTED');
      perform public.recalculate_professional_risk(auth.uid());
      raise exception 'You have already used your free Intimate wedding workspace. Upgrade to Collaborative to create or manage another wedding.'
        using errcode = 'P0001';
    end if;
  end if;

  insert into public.weddings (
    name,
    wedding_code,
    wedding_date,
    location_county,
    location_town,
    status,
    created_by_user_id
  )
  values (
    trim(wedding_name),
    public.generate_wedding_code(),
    wedding_date_input,
    nullif(trim(coalesce(location_county_input, '')), ''),
    nullif(trim(coalesce(location_town_input, '')), ''),
    'active',
    auth.uid()
  )
  returning public.weddings.id, public.weddings.wedding_code
  into created_wedding_id, created_wedding_code;

  insert into public.wedding_memberships (
    wedding_id,
    user_id,
    email,
    role,
    membership_status,
    is_owner,
    invited_by_user_id,
    accepted_at
  )
  values (
    created_wedding_id,
    auth.uid(),
    public.current_user_email(),
    normalized_role,
    'active',
    true,
    auth.uid(),
    now()
  )
  returning id into created_owner_membership_id;

  if normalized_partner_email is not null and public.get_zania_flag_bool('FREE_PLAN_ALLOW_PARTNER_ACCOUNT', true) then
    insert into public.wedding_memberships (
      wedding_id,
      email,
      role,
      membership_status,
      is_owner,
      invited_by_user_id
    )
    values (
      created_wedding_id,
      normalized_partner_email,
      case when normalized_role = 'bride' then 'groom' else 'bride' end,
      'invited',
      true,
      auth.uid()
    );

    insert into public.wedding_invites (
      wedding_id,
      membership_id,
      email,
      invite_type,
      proposed_role,
      status,
      sent_at,
      expires_at,
      created_by_user_id
    )
    select
      wm.wedding_id,
      wm.id,
      wm.email,
      'partner',
      wm.role,
      'pending',
      null,
      now() + interval '30 days',
      auth.uid()
    from public.wedding_memberships wm
    where wm.wedding_id = created_wedding_id
      and wm.email = normalized_partner_email
      and wm.is_owner = true
    limit 1
    returning id into created_partner_invite_id;
  end if;

  if can_use_replacement then
    update public.profiles
    set
      free_wedding_replacement_used = true,
      updated_at = now()
    where user_id = auth.uid();
  end if;

  perform public.upsert_wedding_lifecycle_history(created_wedding_id);
  perform public.log_account_audit_event(auth.uid(), created_wedding_id, 'WEDDING_CREATED', jsonb_build_object(
    'replacement_used', can_use_replacement
  ));
  perform public.recalculate_professional_risk(auth.uid());

  wedding_id := created_wedding_id;
  wedding_code := created_wedding_code;
  owner_membership_id := created_owner_membership_id;
  partner_invite_id := created_partner_invite_id;
  return next;
end;
$function$;

create or replace function public.upsert_committee_invite(
  target_wedding_id uuid,
  committee_email_input text,
  committee_role_input text default 'committee_member'
)
returns table (
  wedding_id uuid,
  membership_id uuid,
  invite_id uuid,
  proposed_role text,
  expires_at timestamptz,
  seats_remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_committee_email text;
  normalized_role text;
  target_membership public.wedding_memberships%rowtype;
  created_invite public.wedding_invites%rowtype;
  remaining_seats integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not public.can_manage_wedding_memberships(target_wedding_id) then
    raise exception 'You do not have permission to manage committee invites for this wedding'
      using errcode = '42501';
  end if;

  perform public.assert_wedding_feature_enabled(target_wedding_id, 'committee_collaboration', 'COLLABORATOR_INVITE_ATTEMPTED');

  normalized_committee_email := nullif(lower(trim(coalesce(committee_email_input, ''))), '');
  if normalized_committee_email is null then
    raise exception 'Committee email is required'
      using errcode = '22023';
  end if;

  normalized_role := lower(trim(coalesce(committee_role_input, 'committee_member')));
  if normalized_role not in ('committee_member', 'committee_chair') then
    raise exception 'Committee role must be committee_member or committee_chair'
      using errcode = '22023';
  end if;

  select *
  into target_membership
  from public.wedding_memberships wm
  where wm.wedding_id = target_wedding_id
    and wm.role in ('committee_member', 'committee_chair')
    and lower(wm.email) = normalized_committee_email
  order by wm.created_at desc
  limit 1;

  if target_membership.id is null then
    remaining_seats := public.available_committee_seats(target_wedding_id);
    if remaining_seats <= 0 then
      raise exception 'No committee bundle seats are available for this wedding'
        using errcode = '22023';
    end if;

    insert into public.wedding_memberships (
      wedding_id,
      email,
      role,
      membership_status,
      is_owner,
      invited_by_user_id
    )
    values (
      target_wedding_id,
      normalized_committee_email,
      normalized_role,
      'invited',
      false,
      auth.uid()
    )
    returning *
    into target_membership;
  else
    update public.wedding_memberships
    set role = normalized_role,
        membership_status = case
          when membership_status = 'active' then membership_status
          else 'invited'
        end,
        invited_by_user_id = auth.uid(),
        revoked_at = null,
        updated_at = now()
    where id = target_membership.id
    returning *
    into target_membership;
  end if;

  update public.wedding_invites
  set status = 'revoked',
      updated_at = now()
  where wedding_id = target_wedding_id
    and lower(email) = normalized_committee_email
    and invite_type = 'committee'
    and status = 'pending';

  insert into public.wedding_invites (
    wedding_id,
    membership_id,
    email,
    invite_type,
    proposed_role,
    status,
    sent_at,
    expires_at,
    created_by_user_id
  )
  values (
    target_wedding_id,
    target_membership.id,
    normalized_committee_email,
    'committee',
    normalized_role,
    'pending',
    now(),
    now() + interval '21 days',
    auth.uid()
  )
  returning *
  into created_invite;

  remaining_seats := public.available_committee_seats(target_wedding_id);

  perform public.log_account_audit_event(auth.uid(), target_wedding_id, 'COLLABORATOR_INVITE_ATTEMPTED', jsonb_build_object(
    'invite_type', 'committee',
    'role', normalized_role
  ));
  perform public.recalculate_professional_risk(auth.uid());

  wedding_id := target_wedding_id;
  membership_id := target_membership.id;
  invite_id := created_invite.id;
  proposed_role := created_invite.proposed_role;
  expires_at := created_invite.expires_at;
  seats_remaining := remaining_seats;
  return next;
end;
$$;

create or replace function public.validate_workspace_vendor_invite()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  resolved_wedding_id uuid;
begin
  if new.invite_contact_email is not null then
    new.invite_contact_email := lower(nullif(btrim(new.invite_contact_email), ''));
  end if;

  if new.invite_contact_phone is not null then
    new.invite_contact_phone := nullif(btrim(new.invite_contact_phone), '');
  end if;

  if new.invited_by_user_id is null and auth.uid() is not null then
    new.invited_by_user_id := auth.uid();
  end if;

  resolved_wedding_id := public.resolve_vendor_workspace_wedding_id(new.vendor_id);

  if resolved_wedding_id is null then
    raise exception 'Vendor must belong to a wedding workspace before invite records can be created'
      using errcode = 'P0001';
  end if;

  if new.wedding_id <> resolved_wedding_id then
    raise exception 'Vendor invite wedding does not match the vendor workspace'
      using errcode = 'P0001';
  end if;

  perform public.assert_wedding_feature_enabled(new.wedding_id, 'vendor_collaboration', 'COLLABORATOR_INVITE_ATTEMPTED');

  return new;
end;
$$;

create or replace function public.enforce_planner_link_request_plan()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  active_wedding_id uuid;
begin
  active_wedding_id := public.primary_owned_wedding_id(new.couple_user_id);

  if active_wedding_id is null then
    raise exception 'You need an active wedding workspace before inviting a planner.'
      using errcode = 'P0001';
  end if;

  perform public.assert_wedding_feature_enabled(active_wedding_id, 'planner_collaboration', 'PLANNER_ROLE_ATTEMPTED');
  perform public.log_account_audit_event(new.couple_user_id, active_wedding_id, 'PLANNER_ROLE_ATTEMPTED', jsonb_build_object(
    'planner_user_id', new.planner_user_id
  ));

  return new;
end;
$$;

drop trigger if exists enforce_planner_link_request_plan on public.planner_link_requests;
create trigger enforce_planner_link_request_plan
before insert or update on public.planner_link_requests
for each row execute function public.enforce_planner_link_request_plan();

create or replace function public.enforce_vendor_connection_request_plan()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  requester_role public.app_role;
  active_wedding_id uuid;
begin
  select p.role
  into requester_role
  from public.profiles p
  where p.user_id = new.requester_user_id;

  if requester_role = 'planner'::public.app_role then
    return new;
  end if;

  active_wedding_id := public.primary_owned_wedding_id(new.requester_user_id);

  if active_wedding_id is null then
    raise exception 'You need an active wedding workspace before coordinating with a vendor.'
      using errcode = 'P0001';
  end if;

  perform public.assert_wedding_feature_enabled(active_wedding_id, 'vendor_collaboration', 'COLLABORATOR_INVITE_ATTEMPTED');
  perform public.log_account_audit_event(new.requester_user_id, active_wedding_id, 'COLLABORATOR_INVITE_ATTEMPTED', jsonb_build_object(
    'vendor_listing_id', new.vendor_listing_id
  ));

  return new;
end;
$$;

drop trigger if exists enforce_vendor_connection_request_plan on public.vendor_connection_requests;
create trigger enforce_vendor_connection_request_plan
before insert or update on public.vendor_connection_requests
for each row execute function public.enforce_vendor_connection_request_plan();

create or replace function public.enforce_wedding_task_assignment_plan()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  assigned_membership public.wedding_memberships%rowtype;
begin
  if new.assigned_membership_id is null or new.wedding_id is null then
    return new;
  end if;

  select *
  into assigned_membership
  from public.wedding_memberships
  where id = new.assigned_membership_id;

  if assigned_membership.id is null then
    return new;
  end if;

  if assigned_membership.user_id is not null and assigned_membership.user_id = new.user_id then
    return new;
  end if;

  perform public.assert_wedding_feature_enabled(new.wedding_id, 'committee_collaboration', 'COLLABORATOR_INVITE_ATTEMPTED');

  return new;
end;
$$;

drop trigger if exists enforce_wedding_task_assignment_plan on public.tasks;
create trigger enforce_wedding_task_assignment_plan
before insert or update on public.tasks
for each row execute function public.enforce_wedding_task_assignment_plan();

grant execute on function public.get_zania_flag_int(text, integer) to authenticated, service_role;
grant execute on function public.get_zania_flag_bool(text, boolean) to authenticated, service_role;
grant execute on function public.current_user_primary_owned_wedding_id() to authenticated;
grant execute on function public.primary_owned_wedding_id(uuid) to authenticated, service_role;
grant execute on function public.get_wedding_collaboration_metrics(uuid) to authenticated, service_role;
grant execute on function public.is_meaningful_wedding(uuid) to authenticated, service_role;
grant execute on function public.sync_wedding_meaningful_state(uuid) to authenticated, service_role;
grant execute on function public.upsert_wedding_lifecycle_history(uuid) to service_role;
grant execute on function public.can_create_replacement_free_wedding(uuid) to authenticated, service_role;
grant execute on function public.recalculate_professional_risk(uuid) to service_role;
grant execute on function public.assert_wedding_feature_enabled(uuid, text, text) to service_role;
grant execute on function public.soft_delete_wedding_workspace(uuid, text) to authenticated;
grant execute on function public.archive_wedding_workspace(uuid) to authenticated;
grant execute on function public.restore_deleted_wedding_workspace(uuid) to authenticated;

with active_owned_weddings as (
  select distinct on (wm.user_id)
    wm.user_id,
    w.wedding_code,
    w.wedding_date,
    w.location_county,
    w.location_town
  from public.wedding_memberships wm
  join public.weddings w on w.id = wm.wedding_id
  where wm.user_id is not null
    and wm.is_owner = true
    and wm.membership_status = 'active'
    and wm.role in ('bride', 'groom')
    and w.status = 'active'
    and w.deleted_at is null
  order by wm.user_id, wm.created_at asc
)
update public.profiles p
set
  collaboration_code = coalesce(p.collaboration_code, aow.wedding_code),
  wedding_date = coalesce(p.wedding_date, aow.wedding_date),
  wedding_county = coalesce(p.wedding_county, aow.location_county),
  wedding_town = coalesce(p.wedding_town, aow.location_town),
  wedding_location = coalesce(
    p.wedding_location,
    nullif(concat_ws(', ', aow.location_town, aow.location_county), '')
  ),
  account_purpose = coalesce(
    p.account_purpose,
    case
      when p.role = 'vendor'::public.app_role then 'vendor'
      when p.role = 'planner'::public.app_role then 'professional_planner'
      else 'planning_my_own_wedding'
    end
  ),
  updated_at = now()
from active_owned_weddings aow
where p.user_id = aow.user_id;
