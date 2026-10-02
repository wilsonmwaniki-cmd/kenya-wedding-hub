alter table public.tasks
  add column if not exists template_key text null,
  add column if not exists timeline_offset_days integer null,
  add column if not exists due_date_source text not null default 'manual',
  add column if not exists schedule_anchor_date date null,
  add column if not exists last_auto_scheduled_at timestamptz null,
  add column if not exists manually_scheduled_at timestamptz null;

alter table public.tasks
  drop constraint if exists tasks_due_date_source_check;

alter table public.tasks
  add constraint tasks_due_date_source_check
  check (due_date_source in ('automatic', 'manual', 'unscheduled'));

create index if not exists tasks_adaptive_schedule_idx
  on public.tasks (wedding_id, due_date_source, completed)
  where timeline_offset_days is not null;

create or replace function public.adaptive_task_due_date(
  wedding_date_input date,
  planning_start_date_input date,
  timeline_offset_days_input integer,
  maximum_timeline_days_input integer default 548
)
returns date
language plpgsql
immutable
security invoker
set search_path = public
as $function$
declare
  planning_window_days integer;
  nominal_due_date date;
  maximum_timeline_days integer;
  catch_up_days integer;
  grace_days integer;
  missed_window_span integer;
  catch_up_position numeric;
  scheduled_days_from_start integer;
begin
  if wedding_date_input is null
    or planning_start_date_input is null
    or timeline_offset_days_input is null then
    return null;
  end if;

  planning_window_days := wedding_date_input - planning_start_date_input;
  nominal_due_date := wedding_date_input - timeline_offset_days_input;

  if planning_window_days <= 0 or nominal_due_date >= planning_start_date_input then
    return nominal_due_date;
  end if;

  maximum_timeline_days := greatest(
    coalesce(maximum_timeline_days_input, 548),
    timeline_offset_days_input,
    planning_window_days + 1
  );
  catch_up_days := least(
    28,
    greatest(0, planning_window_days - 1),
    greatest(3, round(planning_window_days * 0.15)::integer)
  );

  if catch_up_days = 0 then
    return planning_start_date_input;
  end if;

  grace_days := least(2, catch_up_days);
  missed_window_span := greatest(1, maximum_timeline_days - planning_window_days);
  catch_up_position := least(
    1,
    greatest(
      0,
      (maximum_timeline_days - timeline_offset_days_input)::numeric / missed_window_span
    )
  );
  scheduled_days_from_start := round(
    grace_days + catch_up_position * (catch_up_days - grace_days)
  )::integer;

  return planning_start_date_input + scheduled_days_from_start;
end;
$function$;

with owner_weddings as (
  select distinct on (wm.user_id)
    wm.user_id,
    wm.wedding_id
  from public.wedding_memberships wm
  join public.weddings w on w.id = wm.wedding_id
  where wm.user_id is not null
    and wm.is_owner = true
    and wm.membership_status = 'active'
    and w.status = 'active'
    and w.deleted_at is null
  order by wm.user_id, wm.created_at asc
)
update public.tasks task
set wedding_id = owner_weddings.wedding_id
from owner_weddings
where task.user_id = owner_weddings.user_id
  and task.client_id is null
  and task.wedding_id is null
  and task.template_source = 'zania_checklist_v2';

update public.tasks task
set
  template_key = coalesce(task.template_key, 'legacy-' || task.id::text),
  timeline_offset_days = coalesce(
    task.timeline_offset_days,
    case
      when lower(coalesce(task.description, '')) ~ 'timeline: [0-9]+ months?' then
        round(
          substring(lower(task.description) from 'timeline: ([0-9]+) months?')::numeric * 30.4375
        )::integer
      when lower(coalesce(task.description, '')) ~ 'timeline: [0-9]+ weeks?' then
        substring(lower(task.description) from 'timeline: ([0-9]+) weeks?')::integer * 7
      when lower(coalesce(task.description, '')) ~ 'timeline: [0-9]+ days?' then
        substring(lower(task.description) from 'timeline: ([0-9]+) days?')::integer
      when lower(coalesce(task.description, '')) like '%timeline: wedding day.%' then 0
      when lower(coalesce(task.description, '')) like '%timeline: post wedding.%' then -7
      else null
    end
  ),
  due_date_source = case
    when task.completed then task.due_date_source
    else 'automatic'
  end,
  schedule_anchor_date = coalesce(
    task.schedule_anchor_date,
    (
      select w.created_at::date
      from public.weddings w
      where w.id = task.wedding_id
    ),
    (
      select p.created_at::date
      from public.profiles p
      where p.user_id = task.user_id
    ),
    task.created_at::date
  )
where task.template_source = 'zania_checklist_v2';

with wedding_schedule_horizons as (
  select
    task.wedding_id,
    greatest(548, coalesce(max(task.timeline_offset_days), 548)) as maximum_timeline_days
  from public.tasks task
  where task.wedding_id is not null
    and task.template_source = 'zania_checklist_v2'
    and task.timeline_offset_days is not null
  group by task.wedding_id
)
update public.tasks task
set
  due_date = public.adaptive_task_due_date(
    wedding.wedding_date,
    task.schedule_anchor_date,
    task.timeline_offset_days,
    horizon.maximum_timeline_days
  ),
  last_auto_scheduled_at = now()
from public.weddings wedding
join wedding_schedule_horizons horizon on horizon.wedding_id = wedding.id
where task.wedding_id = wedding.id
  and task.template_source = 'zania_checklist_v2'
  and task.timeline_offset_days is not null
  and task.due_date_source = 'automatic'
  and task.completed = false;

create or replace function public.track_task_due_date_source()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
begin
  if tg_op = 'INSERT' then
    if new.due_date is null and new.due_date_source = 'manual' then
      new.due_date_source := 'unscheduled';
    end if;
    return new;
  end if;

  if new.due_date is distinct from old.due_date
    and coalesce(current_setting('zania.recalibrating_tasks', true), 'off') <> 'on' then
    new.due_date_source := case when new.due_date is null then 'unscheduled' else 'manual' end;
    new.manually_scheduled_at := now();
  end if;

  return new;
end;
$function$;

drop trigger if exists track_task_due_date_source on public.tasks;
create trigger track_task_due_date_source
before insert or update of due_date on public.tasks
for each row execute function public.track_task_due_date_source();

create or replace function public.recalibrate_wedding_task_schedule(
  target_wedding_id uuid,
  wedding_date_input date
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  maximum_timeline_days integer;
  updated_task_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not public.can_manage_wedding(target_wedding_id) then
    raise exception 'You cannot reschedule tasks for this wedding'
      using errcode = '42501';
  end if;

  select greatest(548, coalesce(max(task.timeline_offset_days), 548))
  into maximum_timeline_days
  from public.tasks task
  where task.wedding_id = target_wedding_id
    and task.timeline_offset_days is not null;

  perform set_config('zania.recalibrating_tasks', 'on', true);

  update public.tasks task
  set
    due_date = public.adaptive_task_due_date(
      wedding_date_input,
      task.schedule_anchor_date,
      task.timeline_offset_days,
      maximum_timeline_days
    ),
    last_auto_scheduled_at = now()
  where task.wedding_id = target_wedding_id
    and task.completed = false
    and task.due_date_source = 'automatic'
    and task.timeline_offset_days is not null;

  get diagnostics updated_task_count = row_count;
  perform set_config('zania.recalibrating_tasks', 'off', true);

  return updated_task_count;
end;
$function$;

create or replace function public.recalibrate_tasks_after_wedding_date_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
begin
  perform public.recalibrate_wedding_task_schedule(new.id, new.wedding_date);
  return new;
end;
$function$;

drop trigger if exists recalibrate_tasks_after_wedding_date_change on public.weddings;
create trigger recalibrate_tasks_after_wedding_date_change
after update of wedding_date on public.weddings
for each row
when (old.wedding_date is distinct from new.wedding_date)
execute function public.recalibrate_tasks_after_wedding_date_change();

revoke execute on function public.recalibrate_wedding_task_schedule(uuid, date) from public, anon;
grant execute on function public.recalibrate_wedding_task_schedule(uuid, date) to authenticated, service_role;

revoke execute on function public.adaptive_task_due_date(date, date, integer, integer) from public, anon;
grant execute on function public.adaptive_task_due_date(date, date, integer, integer) to authenticated, service_role;
