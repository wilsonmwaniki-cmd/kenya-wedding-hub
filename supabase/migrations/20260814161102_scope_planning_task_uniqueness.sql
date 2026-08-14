drop index if exists public.tasks_wedding_template_unique;

create unique index tasks_wedding_template_unique
on public.tasks (wedding_id, template_source, template_key)
where template_source = 'planning_experiment_v1';

create or replace function public.save_planning_experiment(
  wedding_id_input uuid,
  wedding_date_input date,
  estimated_budget_input numeric,
  estimated_guest_count_input integer,
  wedding_type_input text,
  top_priorities_input text[],
  booked_categories_input text[],
  primary_next_action_input jsonb,
  secondary_actions_input jsonb,
  budget_rows_input jsonb,
  tasks_input jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  budget_row_count integer;
  task_row_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not public.can_manage_wedding_memberships(wedding_id_input) then
    raise exception 'Only a wedding owner can build this plan.' using errcode = '42501';
  end if;

  perform 1
  from public.weddings
  where id = wedding_id_input
  for update;

  if not found then
    raise exception 'Wedding workspace not found.' using errcode = 'P0002';
  end if;

  if wedding_date_input is null
    or estimated_budget_input <= 0
    or estimated_guest_count_input <= 0
    or wedding_type_input not in ('traditional', 'civil', 'church', 'garden', 'destination', 'other')
    or cardinality(coalesce(top_priorities_input, '{}'::text[])) <> 3
  then
    raise exception 'The planning inputs are incomplete or invalid.' using errcode = '22023';
  end if;

  if jsonb_typeof(budget_rows_input) <> 'array' or jsonb_typeof(tasks_input) <> 'array' then
    raise exception 'Budget rows and tasks must be arrays.' using errcode = '22023';
  end if;

  if jsonb_typeof(primary_next_action_input) <> 'object'
    or jsonb_typeof(secondary_actions_input) <> 'array'
    or jsonb_array_length(secondary_actions_input) > 3
  then
    raise exception 'The next actions are invalid.' using errcode = '22023';
  end if;

  budget_row_count := jsonb_array_length(budget_rows_input);
  task_row_count := jsonb_array_length(tasks_input);
  if budget_row_count < 1 or budget_row_count > 30 or task_row_count < 1 or task_row_count > 10 then
    raise exception 'The generated plan is outside the allowed size.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(budget_rows_input) as row_data(name text, allocated numeric, suggested_percentage numeric)
    where nullif(btrim(row_data.name), '') is null
      or row_data.allocated is null
      or row_data.allocated < 0
      or row_data.suggested_percentage is null
      or row_data.suggested_percentage < 0
  ) or (
    select count(distinct lower(btrim(row_data.name)))
    from jsonb_to_recordset(budget_rows_input) as row_data(name text)
  ) <> budget_row_count then
    raise exception 'The generated budget contains invalid or duplicate categories.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(tasks_input) as row_data(key text, title text, category text, priority_level integer, completed boolean)
    where nullif(btrim(row_data.key), '') is null
      or nullif(btrim(row_data.title), '') is null
      or nullif(btrim(row_data.category), '') is null
      or row_data.priority_level is null
      or row_data.priority_level not between 1 and 4
      or row_data.completed is null
  ) or (
    select count(distinct row_data.key)
    from jsonb_to_recordset(tasks_input) as row_data(key text)
  ) <> task_row_count then
    raise exception 'The generated tasks contain invalid or duplicate items.' using errcode = '22023';
  end if;

  insert into public.wedding_planning_profiles (
    wedding_id, estimated_budget, estimated_guest_count, wedding_type,
    top_priorities, booked_categories, primary_next_action, secondary_actions
  ) values (
    wedding_id_input, estimated_budget_input, estimated_guest_count_input, wedding_type_input,
    top_priorities_input, coalesce(booked_categories_input, '{}'::text[]),
    primary_next_action_input, secondary_actions_input
  )
  on conflict (wedding_id) do update set
    estimated_budget = excluded.estimated_budget,
    estimated_guest_count = excluded.estimated_guest_count,
    wedding_type = excluded.wedding_type,
    top_priorities = excluded.top_priorities,
    booked_categories = excluded.booked_categories,
    primary_next_action = excluded.primary_next_action,
    secondary_actions = excluded.secondary_actions;

  update public.weddings
  set wedding_date = wedding_date_input
  where id = wedding_id_input;

  update public.profiles
  set wedding_date = wedding_date_input,
      wedding_budget_goal = estimated_budget_input,
      expected_guest_count = estimated_guest_count_input
  where user_id = current_user_id;

  insert into public.budget_categories (
    user_id, wedding_id, client_id, name, allocated, spent, budget_scope, visibility,
    suggested_allocated, suggested_percentage, allocation_manually_edited, allocation_last_edited_field
  )
  select
    current_user_id, wedding_id_input, null, row_data.name, row_data.allocated, 0, 'wedding', 'public',
    row_data.allocated, row_data.suggested_percentage, false, null
  from jsonb_to_recordset(budget_rows_input)
    as row_data(name text, allocated numeric, suggested_percentage numeric)
  on conflict (wedding_id, name) do update set
    suggested_allocated = excluded.suggested_allocated,
    suggested_percentage = excluded.suggested_percentage,
    allocated = case
      when public.budget_categories.allocation_manually_edited then public.budget_categories.allocated
      else excluded.allocated
    end;

  delete from public.tasks
  where wedding_id = wedding_id_input
    and template_source = 'planning_experiment_v1'
    and template_key not in (
      select row_data.key
      from jsonb_to_recordset(tasks_input) as row_data(key text)
    );

  insert into public.tasks (
    user_id, wedding_id, client_id, title, category, priority_level, completed,
    visibility, template_source, template_key
  )
  select
    current_user_id, wedding_id_input, null, row_data.title, row_data.category,
    row_data.priority_level, row_data.completed, 'public', 'planning_experiment_v1', row_data.key
  from jsonb_to_recordset(tasks_input)
    as row_data(key text, title text, category text, priority_level integer, completed boolean)
  on conflict (wedding_id, template_source, template_key)
    where template_source = 'planning_experiment_v1'
  do update set
    title = excluded.title,
    category = excluded.category,
    priority_level = excluded.priority_level,
    completed = excluded.completed;

  return jsonb_build_object('budget_rows', budget_row_count, 'tasks', task_row_count);
end;
$$;

revoke all on function public.save_planning_experiment(
  uuid, date, numeric, integer, text, text[], text[], jsonb, jsonb, jsonb, jsonb
) from public, anon;

grant execute on function public.save_planning_experiment(
  uuid, date, numeric, integer, text, text[], text[], jsonb, jsonb, jsonb, jsonb
) to authenticated;
