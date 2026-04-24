create table if not exists public.ai_plan_configs (
  audience text primary key,
  monthly_message_cap integer not null check (monthly_message_cap >= 0),
  ai_enabled boolean not null default true,
  add_on_separate boolean not null default false,
  add_on_lookup_key text null,
  add_on_annual_lookup_key text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_plan_configs_audience_check
    check (audience in ('couple', 'committee', 'planner', 'vendor'))
);

insert into public.ai_plan_configs (
  audience,
  monthly_message_cap,
  ai_enabled,
  add_on_separate,
  add_on_lookup_key,
  add_on_annual_lookup_key
)
values
  ('couple', 60, true, false, null, null),
  ('committee', 80, true, false, null, null),
  ('planner', 300, true, false, null, null),
  ('vendor', 120, true, false, null, null)
on conflict (audience) do nothing;

drop trigger if exists update_ai_plan_configs_updated_at on public.ai_plan_configs;
create trigger update_ai_plan_configs_updated_at
before update on public.ai_plan_configs
for each row execute function public.update_updated_at_column();

create table if not exists public.ai_assistant_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  audience text not null,
  role text not null,
  feature text not null default 'ai_assistant',
  month_start date not null,
  created_at timestamptz not null default now(),
  constraint ai_assistant_usage_logs_audience_check
    check (audience in ('couple', 'committee', 'planner', 'vendor'))
);

create index if not exists ai_assistant_usage_logs_user_month_idx
  on public.ai_assistant_usage_logs (user_id, month_start desc);

create index if not exists ai_assistant_usage_logs_audience_month_idx
  on public.ai_assistant_usage_logs (audience, month_start desc);

create table if not exists public.vendor_follow_up_reminders (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  vendor_listing_id uuid not null references public.vendor_listings(id) on delete cascade,
  created_by_user_id uuid not null,
  title text not null,
  notes text null,
  due_date date null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_follow_up_reminders_status_check
    check (status in ('open', 'completed'))
);

create index if not exists vendor_follow_up_reminders_vendor_idx
  on public.vendor_follow_up_reminders (vendor_id, status, due_date);

create index if not exists vendor_follow_up_reminders_listing_idx
  on public.vendor_follow_up_reminders (vendor_listing_id, status, due_date);

alter table public.vendor_follow_up_reminders enable row level security;

drop policy if exists "Vendors can view own follow-up reminders" on public.vendor_follow_up_reminders;
create policy "Vendors can view own follow-up reminders"
on public.vendor_follow_up_reminders
for select
to authenticated
using (
  exists (
    select 1
    from public.vendor_listings vl
    where vl.id = vendor_follow_up_reminders.vendor_listing_id
      and vl.user_id = auth.uid()
      and public.vendor_listing_has_full_access(vl.id)
  )
);

drop trigger if exists update_vendor_follow_up_reminders_updated_at on public.vendor_follow_up_reminders;
create trigger update_vendor_follow_up_reminders_updated_at
before update on public.vendor_follow_up_reminders
for each row execute function public.update_updated_at_column();

drop function if exists public.get_current_ai_audience();
create function public.get_current_ai_audience()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_role text;
  current_planner_type text;
begin
  select p.role::text, p.planner_type::text
  into current_role, current_planner_type
  from public.profiles p
  where p.user_id = auth.uid();

  if current_role = 'planner' and current_planner_type = 'committee' then
    return 'committee';
  end if;

  if current_role = 'planner' then
    return 'planner';
  end if;

  if current_role = 'vendor' then
    return 'vendor';
  end if;

  return 'couple';
end;
$$;

drop function if exists public.get_ai_usage_status();
create function public.get_ai_usage_status()
returns table (
  audience text,
  monthly_message_cap integer,
  messages_used integer,
  remaining_messages integer,
  month_start date,
  ai_enabled boolean,
  add_on_separate boolean,
  add_on_lookup_key text,
  add_on_annual_lookup_key text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  derived_audience text;
  config_row public.ai_plan_configs%rowtype;
  used_count integer;
  current_month date := date_trunc('month', now())::date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  derived_audience := public.get_current_ai_audience();

  select *
  into config_row
  from public.ai_plan_configs
  where ai_plan_configs.audience = derived_audience;

  if not found then
    raise exception 'AI plan configuration not found for %', derived_audience;
  end if;

  select count(*)::integer
  into used_count
  from public.ai_assistant_usage_logs l
  where l.user_id = auth.uid()
    and l.month_start = current_month;

  return query
  select
    derived_audience,
    config_row.monthly_message_cap,
    used_count,
    greatest(config_row.monthly_message_cap - used_count, 0),
    current_month,
    config_row.ai_enabled,
    config_row.add_on_separate,
    config_row.add_on_lookup_key,
    config_row.add_on_annual_lookup_key;
end;
$$;

drop function if exists public.log_ai_assistant_message(text);
create function public.log_ai_assistant_message(
  feature_input text default 'ai_assistant'
)
returns table (
  audience text,
  monthly_message_cap integer,
  messages_used integer,
  remaining_messages integer,
  month_start date,
  ai_enabled boolean,
  add_on_separate boolean,
  add_on_lookup_key text,
  add_on_annual_lookup_key text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  derived_audience text;
  current_role text;
  config_row public.ai_plan_configs%rowtype;
  used_count integer;
  current_month date := date_trunc('month', now())::date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select p.role::text
  into current_role
  from public.profiles p
  where p.user_id = auth.uid();

  derived_audience := public.get_current_ai_audience();

  select *
  into config_row
  from public.ai_plan_configs
  where ai_plan_configs.audience = derived_audience;

  if not found then
    raise exception 'AI plan configuration not found for %', derived_audience;
  end if;

  if config_row.ai_enabled is false then
    raise exception 'AI assistant is currently disabled for the % plan.', derived_audience;
  end if;

  select count(*)::integer
  into used_count
  from public.ai_assistant_usage_logs l
  where l.user_id = auth.uid()
    and l.month_start = current_month;

  if used_count >= config_row.monthly_message_cap then
    raise exception 'You have reached the monthly AI message limit for your plan.';
  end if;

  insert into public.ai_assistant_usage_logs (
    user_id,
    audience,
    role,
    feature,
    month_start
  )
  values (
    auth.uid(),
    derived_audience,
    coalesce(current_role, 'couple'),
    coalesce(nullif(trim(feature_input), ''), 'ai_assistant'),
    current_month
  );

  used_count := used_count + 1;

  return query
  select
    derived_audience,
    config_row.monthly_message_cap,
    used_count,
    greatest(config_row.monthly_message_cap - used_count, 0),
    current_month,
    config_row.ai_enabled,
    config_row.add_on_separate,
    config_row.add_on_lookup_key,
    config_row.add_on_annual_lookup_key;
end;
$$;

drop function if exists public.create_vendor_follow_up_reminder(uuid, text, text, date);
create function public.create_vendor_follow_up_reminder(
  target_vendor_id uuid,
  title_input text,
  notes_input text default null,
  due_date_input date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_vendor record;
  reminder_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if nullif(trim(title_input), '') is null then
    raise exception 'Reminder title is required.';
  end if;

  select
    v.id,
    v.vendor_listing_id
  into target_vendor
  from public.vendors v
  join public.vendor_listings vl on vl.id = v.vendor_listing_id
  where v.id = target_vendor_id
    and vl.user_id = auth.uid()
    and public.vendor_listing_has_full_access(vl.id);

  if not found then
    raise exception 'You do not have access to create reminders for this booking.';
  end if;

  insert into public.vendor_follow_up_reminders (
    vendor_id,
    vendor_listing_id,
    created_by_user_id,
    title,
    notes,
    due_date
  )
  values (
    target_vendor.id,
    target_vendor.vendor_listing_id,
    auth.uid(),
    trim(title_input),
    nullif(trim(notes_input), ''),
    due_date_input
  )
  returning id into reminder_id;

  return reminder_id;
end;
$$;

drop function if exists public.update_vendor_follow_up_reminder_status(uuid, text);
create function public.update_vendor_follow_up_reminder_status(
  target_reminder_id uuid,
  status_input text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_status text;
begin
  normalized_status := lower(trim(status_input));

  if normalized_status not in ('open', 'completed') then
    raise exception 'Reminder status must be open or completed.';
  end if;

  if not exists (
    select 1
    from public.vendor_follow_up_reminders r
    join public.vendor_listings vl on vl.id = r.vendor_listing_id
    where r.id = target_reminder_id
      and vl.user_id = auth.uid()
      and public.vendor_listing_has_full_access(vl.id)
  ) then
    raise exception 'You do not have access to update this reminder.';
  end if;

  update public.vendor_follow_up_reminders
  set status = normalized_status
  where id = target_reminder_id;

  return normalized_status;
end;
$$;

drop function if exists public.update_vendor_booking_status(uuid, text);
create function public.update_vendor_booking_status(
  target_vendor_id uuid,
  status_input text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_status text;
begin
  normalized_status := lower(trim(status_input));

  if normalized_status not in ('contacted', 'quoted', 'booked', 'completed', 'rejected') then
    raise exception 'Vendor booking status must be contacted, quoted, booked, completed, or rejected.';
  end if;

  if not exists (
    select 1
    from public.vendors v
    join public.vendor_listings vl on vl.id = v.vendor_listing_id
    where v.id = target_vendor_id
      and vl.user_id = auth.uid()
      and public.vendor_listing_has_full_access(vl.id)
  ) then
    raise exception 'You do not have access to update this booking status.';
  end if;

  update public.vendors
  set status = normalized_status
  where id = target_vendor_id;

  return normalized_status;
end;
$$;

drop function if exists public.admin_ai_usage_metrics();
create function public.admin_ai_usage_metrics()
returns table (
  total_messages bigint,
  active_users bigint,
  couple_messages bigint,
  committee_messages bigint,
  planner_messages bigint,
  vendor_messages bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_month date := date_trunc('month', now())::date;
begin
  perform public.require_admin();

  return query
  select
    count(*)::bigint as total_messages,
    count(distinct l.user_id)::bigint as active_users,
    count(*) filter (where l.audience = 'couple')::bigint as couple_messages,
    count(*) filter (where l.audience = 'committee')::bigint as committee_messages,
    count(*) filter (where l.audience = 'planner')::bigint as planner_messages,
    count(*) filter (where l.audience = 'vendor')::bigint as vendor_messages
  from public.ai_assistant_usage_logs l
  where l.month_start = current_month;
end;
$$;

drop function if exists public.admin_list_ai_usage(text, text, integer, integer);
create function public.admin_list_ai_usage(
  search_query text default null,
  audience_filter text default 'all',
  limit_rows integer default 100,
  offset_rows integer default 0
)
returns table (
  user_id uuid,
  full_name text,
  email text,
  audience text,
  role text,
  month_start date,
  messages_used bigint,
  monthly_message_cap integer,
  remaining_messages integer,
  ai_enabled boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_month date := date_trunc('month', now())::date;
begin
  perform public.require_admin();

  return query
  with usage_by_user as (
    select
      l.user_id,
      l.audience,
      max(l.role) as role,
      l.month_start,
      count(*)::bigint as messages_used
    from public.ai_assistant_usage_logs l
    where l.month_start = current_month
    group by l.user_id, l.audience, l.month_start
  )
  select
    u.user_id,
    p.full_name::text,
    au.email::text,
    u.audience,
    u.role,
    u.month_start,
    u.messages_used,
    c.monthly_message_cap,
    greatest(c.monthly_message_cap - u.messages_used::integer, 0),
    c.ai_enabled
  from usage_by_user u
  left join public.profiles p on p.user_id = u.user_id
  left join auth.users au on au.id = u.user_id
  join public.ai_plan_configs c on c.audience = u.audience
  where (
      audience_filter = 'all'
      or u.audience = audience_filter
    )
    and (
      search_query is null
      or p.full_name ilike '%' || search_query || '%'
      or au.email ilike '%' || search_query || '%'
    )
  order by u.messages_used desc, p.full_name asc nulls last, au.email asc nulls last
  limit greatest(1, least(limit_rows, 200))
  offset greatest(0, offset_rows);
end;
$$;

drop function if exists public.admin_list_ai_plan_configs();
create function public.admin_list_ai_plan_configs()
returns table (
  audience text,
  monthly_message_cap integer,
  ai_enabled boolean,
  add_on_separate boolean,
  add_on_lookup_key text,
  add_on_annual_lookup_key text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  return query
  select
    c.audience,
    c.monthly_message_cap,
    c.ai_enabled,
    c.add_on_separate,
    c.add_on_lookup_key,
    c.add_on_annual_lookup_key,
    c.updated_at
  from public.ai_plan_configs c
  order by
    case c.audience
      when 'couple' then 1
      when 'committee' then 2
      when 'planner' then 3
      when 'vendor' then 4
      else 99
    end;
end;
$$;

drop function if exists public.admin_set_ai_plan_config(text, integer, boolean, boolean, text, text);
create function public.admin_set_ai_plan_config(
  audience_input text,
  monthly_message_cap_input integer,
  ai_enabled_input boolean,
  add_on_separate_input boolean default false,
  add_on_lookup_key_input text default null,
  add_on_annual_lookup_key_input text default null
)
returns public.ai_plan_configs
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_row public.ai_plan_configs%rowtype;
  normalized_audience text;
begin
  perform public.require_admin();

  normalized_audience := lower(trim(audience_input));

  if normalized_audience not in ('couple', 'committee', 'planner', 'vendor') then
    raise exception 'Invalid AI audience. Expected couple, committee, planner, or vendor.';
  end if;

  if monthly_message_cap_input < 0 then
    raise exception 'Monthly AI message cap cannot be negative.';
  end if;

  insert into public.ai_plan_configs (
    audience,
    monthly_message_cap,
    ai_enabled,
    add_on_separate,
    add_on_lookup_key,
    add_on_annual_lookup_key
  )
  values (
    normalized_audience,
    monthly_message_cap_input,
    ai_enabled_input,
    add_on_separate_input,
    nullif(trim(add_on_lookup_key_input), ''),
    nullif(trim(add_on_annual_lookup_key_input), '')
  )
  on conflict (audience) do update
  set
    monthly_message_cap = excluded.monthly_message_cap,
    ai_enabled = excluded.ai_enabled,
    add_on_separate = excluded.add_on_separate,
    add_on_lookup_key = excluded.add_on_lookup_key,
    add_on_annual_lookup_key = excluded.add_on_annual_lookup_key,
    updated_at = now()
  returning * into saved_row;

  return saved_row;
end;
$$;

grant execute on function public.get_current_ai_audience() to authenticated;
grant execute on function public.get_ai_usage_status() to authenticated;
grant execute on function public.log_ai_assistant_message(text) to authenticated;
grant execute on function public.create_vendor_follow_up_reminder(uuid, text, text, date) to authenticated;
grant execute on function public.update_vendor_follow_up_reminder_status(uuid, text) to authenticated;
grant execute on function public.update_vendor_booking_status(uuid, text) to authenticated;
grant execute on function public.admin_ai_usage_metrics() to authenticated;
grant execute on function public.admin_list_ai_usage(text, text, integer, integer) to authenticated;
grant execute on function public.admin_list_ai_plan_configs() to authenticated;
grant execute on function public.admin_set_ai_plan_config(text, integer, boolean, boolean, text, text) to authenticated;
