create or replace function public.generate_collaboration_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  for attempt_number in 1..100 loop
    candidate := 'ZN-';

    for character_index in 1..6 loop
      candidate := candidate || substr(
        alphabet,
        1 + floor(random() * length(alphabet))::integer,
        1
      );
    end loop;

    if not exists (
      select 1
      from public.profiles p
      where p.collaboration_code = candidate
    ) then
      return candidate;
    end if;
  end loop;

  raise exception 'Unable to generate a unique collaboration code';
end;
$$;

create or replace function public.ensure_my_collaboration_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_role public.app_role;
  current_code text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select p.role, p.collaboration_code
  into profile_role, current_code
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1;

  if profile_role is null then
    raise exception 'Profile not found';
  end if;

  if current_code is null then
    update public.profiles p
    set collaboration_code = public.generate_collaboration_code()
    where p.user_id = auth.uid()
      and p.collaboration_code is null;

    select p.collaboration_code
    into current_code
    from public.profiles p
    where p.user_id = auth.uid()
    limit 1;
  end if;

  return current_code;
end;
$$;

create or replace function public.get_current_ai_audience()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  profile_role text;
  profile_planner_type text;
begin
  select p.role::text, p.planner_type::text
  into profile_role, profile_planner_type
  from public.profiles p
  where p.user_id = auth.uid();

  if profile_role = 'planner' and profile_planner_type = 'committee' then
    return 'committee';
  end if;

  if profile_role = 'planner' then
    return 'planner';
  end if;

  if profile_role = 'vendor' then
    return 'vendor';
  end if;

  return 'couple';
end;
$$;

create or replace function public.log_ai_assistant_message(
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
  profile_role text;
  config_row public.ai_plan_configs%rowtype;
  used_count integer;
  current_month date := date_trunc('month', now())::date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select p.role::text
  into profile_role
  from public.profiles p
  where p.user_id = auth.uid();

  derived_audience := public.get_current_ai_audience();

  select *
  into config_row
  from public.ai_plan_configs apc
  where apc.audience = derived_audience;

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
    coalesce(profile_role, 'couple'),
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
