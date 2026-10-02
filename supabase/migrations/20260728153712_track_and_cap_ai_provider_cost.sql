alter table public.ai_plan_configs
  add column if not exists monthly_cost_cap_usd numeric(10, 4);

update public.ai_plan_configs
set monthly_cost_cap_usd = case audience
  when 'planner' then 5.0000
  else 2.0000
end
where monthly_cost_cap_usd is null;

alter table public.ai_plan_configs
  alter column monthly_cost_cap_usd set not null,
  add constraint ai_plan_configs_monthly_cost_cap_check
    check (monthly_cost_cap_usd >= 0);

alter table public.ai_assistant_usage_logs
  add column if not exists model text null,
  add column if not exists provider_request_count integer not null default 0,
  add column if not exists input_tokens bigint not null default 0,
  add column if not exists cached_input_tokens bigint not null default 0,
  add column if not exists output_tokens bigint not null default 0,
  add column if not exists estimated_cost_usd numeric(12, 6) not null default 0;

alter table public.ai_assistant_usage_logs
  add constraint ai_assistant_usage_provider_request_count_check
    check (provider_request_count >= 0),
  add constraint ai_assistant_usage_input_tokens_check
    check (input_tokens >= 0),
  add constraint ai_assistant_usage_cached_input_tokens_check
    check (cached_input_tokens >= 0 and cached_input_tokens <= input_tokens),
  add constraint ai_assistant_usage_output_tokens_check
    check (output_tokens >= 0),
  add constraint ai_assistant_usage_estimated_cost_check
    check (estimated_cost_usd >= 0);

create index if not exists ai_assistant_usage_logs_user_month_cost_idx
  on public.ai_assistant_usage_logs (user_id, month_start)
  include (estimated_cost_usd);

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
  add_on_annual_lookup_key text,
  monthly_cost_cap_usd numeric,
  estimated_cost_used_usd numeric,
  remaining_cost_usd numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  derived_audience text;
  config_row public.ai_plan_configs%rowtype;
  used_count integer;
  used_cost numeric;
  current_month date := date_trunc('month', now())::date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  derived_audience := public.get_current_ai_audience();

  select *
  into config_row
  from public.ai_plan_configs apc
  where apc.audience = derived_audience;

  if not found then
    raise exception 'AI plan configuration not found for %', derived_audience;
  end if;

  select count(*)::integer, coalesce(sum(log.estimated_cost_usd), 0)
  into used_count, used_cost
  from public.ai_assistant_usage_logs log
  where log.user_id = auth.uid()
    and log.month_start = current_month;

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
    config_row.add_on_annual_lookup_key,
    config_row.monthly_cost_cap_usd,
    used_cost,
    greatest(config_row.monthly_cost_cap_usd - used_cost, 0);
end;
$$;

drop function if exists public.log_ai_assistant_message(text);
create function public.log_ai_assistant_message(
  feature_input text default 'ai_assistant',
  model_input text default null,
  provider_request_count_input integer default 0,
  input_tokens_input bigint default 0,
  cached_input_tokens_input bigint default 0,
  output_tokens_input bigint default 0,
  estimated_cost_usd_input numeric default 0
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
  add_on_annual_lookup_key text,
  monthly_cost_cap_usd numeric,
  estimated_cost_used_usd numeric,
  remaining_cost_usd numeric
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
  used_cost numeric;
  current_month date := date_trunc('month', now())::date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if coalesce(provider_request_count_input, 0) < 0
    or coalesce(input_tokens_input, 0) < 0
    or coalesce(cached_input_tokens_input, 0) < 0
    or coalesce(output_tokens_input, 0) < 0
    or coalesce(estimated_cost_usd_input, 0) < 0
    or coalesce(cached_input_tokens_input, 0) > coalesce(input_tokens_input, 0)
  then
    raise exception 'Invalid AI usage values';
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

  select count(*)::integer, coalesce(sum(log.estimated_cost_usd), 0)
  into used_count, used_cost
  from public.ai_assistant_usage_logs log
  where log.user_id = auth.uid()
    and log.month_start = current_month;

  if used_count >= config_row.monthly_message_cap then
    raise exception 'You have reached the monthly AI message limit for your plan.';
  end if;

  insert into public.ai_assistant_usage_logs (
    user_id,
    audience,
    role,
    feature,
    month_start,
    model,
    provider_request_count,
    input_tokens,
    cached_input_tokens,
    output_tokens,
    estimated_cost_usd
  )
  values (
    auth.uid(),
    derived_audience,
    coalesce(profile_role, 'couple'),
    coalesce(nullif(trim(feature_input), ''), 'ai_assistant'),
    current_month,
    nullif(trim(model_input), ''),
    coalesce(provider_request_count_input, 0),
    coalesce(input_tokens_input, 0),
    coalesce(cached_input_tokens_input, 0),
    coalesce(output_tokens_input, 0),
    coalesce(estimated_cost_usd_input, 0)
  );

  used_count := used_count + 1;
  used_cost := used_cost + coalesce(estimated_cost_usd_input, 0);

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
    config_row.add_on_annual_lookup_key,
    config_row.monthly_cost_cap_usd,
    used_cost,
    greatest(config_row.monthly_cost_cap_usd - used_cost, 0);
end;
$$;

revoke all on function public.get_ai_usage_status() from public, anon;
revoke all on function public.log_ai_assistant_message(text, text, integer, bigint, bigint, bigint, numeric) from public, anon;
grant execute on function public.get_ai_usage_status() to authenticated;
grant execute on function public.log_ai_assistant_message(text, text, integer, bigint, bigint, bigint, numeric) to authenticated;
