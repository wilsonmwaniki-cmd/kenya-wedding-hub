-- Multi-event wedding foundation
--
-- This migration is intentionally additive. The legacy weddings.wedding_date
-- remains available while wedding_events becomes the event-level foundation.

create table public.wedding_events (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  event_date date not null,
  start_time time without time zone null,
  end_time time without time zone null,
  venue_name text null,
  location text null,
  notes text null,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  constraint wedding_events_name_not_blank check (length(btrim(name)) > 0),
  constraint wedding_events_sort_order_nonnegative check (sort_order >= 0)
);

create index wedding_events_wedding_date_order_idx
  on public.wedding_events (wedding_id, event_date, sort_order, id)
  where archived_at is null;

create unique index wedding_events_one_active_primary_per_wedding_idx
  on public.wedding_events (wedding_id)
  where is_primary = true and archived_at is null;

comment on table public.wedding_events is
  'User-defined dated events that belong to one wedding workspace.';

comment on column public.wedding_events.is_primary is
  'Identifies the active event mirrored by the legacy weddings.wedding_date compatibility field.';

create or replace function public.normalize_wedding_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name);

  if tg_op = 'UPDATE' and new.wedding_id is distinct from old.wedding_id then
    raise exception 'A wedding event cannot be moved to another wedding.'
      using errcode = '23514';
  end if;

  if new.archived_at is not null then
    new.is_primary := false;
  end if;

  return new;
end;
$$;

revoke all on function public.normalize_wedding_event() from public, anon, authenticated;

create trigger normalize_wedding_event_before_write
before insert or update on public.wedding_events
for each row execute function public.normalize_wedding_event();

create trigger update_wedding_events_updated_at
before update on public.wedding_events
for each row execute function public.update_updated_at_column();

alter table public.wedding_events enable row level security;

revoke all on table public.wedding_events from public, anon, authenticated;
grant select, insert, update on table public.wedding_events to authenticated;

create policy "Wedding participants can view events"
on public.wedding_events
for select
to authenticated
using (
  public.is_wedding_member(wedding_id)
  or public.can_manage_wedding(wedding_id)
);

create policy "Wedding owners can create events"
on public.wedding_events
for insert
to authenticated
with check (public.can_manage_wedding(wedding_id));

create policy "Wedding owners can update events"
on public.wedding_events
for update
to authenticated
using (public.can_manage_wedding(wedding_id))
with check (public.can_manage_wedding(wedding_id));

-- Keep the legacy main date and the active primary event aligned during the
-- compatibility period. Clearing the legacy date removes primary status but
-- preserves the event and every record attached to it.
create or replace function public.sync_wedding_primary_event_from_legacy_date()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  matching_event_id uuid;
begin
  if tg_op = 'UPDATE' and new.wedding_date is not distinct from old.wedding_date then
    return new;
  end if;

  if new.wedding_date is null then
    update public.wedding_events
    set is_primary = false
    where wedding_id = new.id
      and is_primary = true
      and archived_at is null;

    return new;
  end if;

  update public.wedding_events
  set event_date = new.wedding_date
  where wedding_id = new.id
    and is_primary = true
    and archived_at is null;

  if found then
    return new;
  end if;

  select we.id
  into matching_event_id
  from public.wedding_events we
  where we.wedding_id = new.id
    and we.event_date = new.wedding_date
    and we.archived_at is null
  order by we.sort_order, we.created_at, we.id
  limit 1;

  if matching_event_id is not null then
    update public.wedding_events
    set is_primary = true
    where id = matching_event_id;
  else
    insert into public.wedding_events (
      wedding_id,
      name,
      event_date,
      is_primary,
      sort_order
    ) values (
      new.id,
      'Wedding day',
      new.wedding_date,
      true,
      0
    );
  end if;

  return new;
end;
$$;

revoke all on function public.sync_wedding_primary_event_from_legacy_date()
  from public, anon, authenticated;

create trigger sync_wedding_primary_event_after_date_write
after insert or update of wedding_date on public.weddings
for each row execute function public.sync_wedding_primary_event_from_legacy_date();

create or replace function public.sync_legacy_date_from_primary_wedding_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  replacement_date date;
begin
  if new.is_primary = true and new.archived_at is null then
    update public.weddings
    set wedding_date = new.event_date
    where id = new.wedding_id
      and wedding_date is distinct from new.event_date;

    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.is_primary = true
    and old.archived_at is null
    and (new.is_primary = false or new.archived_at is not null)
  then
    select we.event_date
    into replacement_date
    from public.wedding_events we
    where we.wedding_id = new.wedding_id
      and we.is_primary = true
      and we.archived_at is null
      and we.id <> new.id
    limit 1;

    update public.weddings
    set wedding_date = replacement_date
    where id = new.wedding_id
      and wedding_date is distinct from replacement_date;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_legacy_date_from_primary_wedding_event()
  from public, anon, authenticated;

create trigger sync_legacy_date_after_wedding_event_write
after insert or update of event_date, is_primary, archived_at on public.wedding_events
for each row execute function public.sync_legacy_date_from_primary_wedding_event();

create or replace function public.set_primary_wedding_event(
  target_wedding_id uuid,
  target_event_id uuid
)
returns public.wedding_events
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_event public.wedding_events%rowtype;
begin
  if not public.can_manage_wedding(target_wedding_id) then
    raise exception 'You do not have permission to manage this wedding.'
      using errcode = '42501';
  end if;

  select we.*
  into selected_event
  from public.wedding_events we
  where we.id = target_event_id
    and we.wedding_id = target_wedding_id
    and we.archived_at is null;

  if selected_event.id is null then
    raise exception 'The selected active event does not belong to this wedding.'
      using errcode = '22023';
  end if;

  update public.wedding_events
  set is_primary = false
  where wedding_id = target_wedding_id
    and is_primary = true
    and archived_at is null
    and id <> target_event_id;

  update public.wedding_events
  set is_primary = true
  where id = target_event_id
  returning * into selected_event;

  return selected_event;
end;
$$;

revoke all on function public.set_primary_wedding_event(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.set_primary_wedding_event(uuid, uuid)
  to authenticated;

-- Backfill exactly one neutral primary event for existing dated weddings.
-- The NOT EXISTS guard makes this safe to rerun during reconciliation.
insert into public.wedding_events (
  wedding_id,
  name,
  event_date,
  is_primary,
  sort_order
)
select
  w.id,
  'Wedding day',
  w.wedding_date,
  true,
  0
from public.weddings w
where w.wedding_date is not null
  and not exists (
    select 1
    from public.wedding_events we
    where we.wedding_id = w.id
      and we.archived_at is null
  );

alter table public.timelines
  add column event_id uuid null
    references public.wedding_events(id) on delete set null;

alter table public.tasks
  add column event_id uuid null
    references public.wedding_events(id) on delete set null;

alter table public.timelines
  add constraint timelines_templates_are_not_event_scoped
  check (is_template = false or event_id is null);

create index timelines_event_id_idx on public.timelines (event_id);
create index tasks_event_id_idx on public.tasks (event_id);

create or replace function public.validate_wedding_event_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_id is null then
    return new;
  end if;

  if new.wedding_id is null then
    raise exception 'An event-scoped record must belong to a wedding.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.wedding_events we
    where we.id = new.event_id
      and we.wedding_id = new.wedding_id
  ) then
    raise exception 'The selected event does not belong to this wedding.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_wedding_event_scope()
  from public, anon, authenticated;

create trigger validate_timeline_wedding_event_scope
before insert or update of event_id, wedding_id on public.timelines
for each row execute function public.validate_wedding_event_scope();

create trigger validate_task_wedding_event_scope
before insert or update of event_id, wedding_id on public.tasks
for each row execute function public.validate_wedding_event_scope();

-- Existing non-template timelines can be linked only where date matching is
-- unambiguous. No event relationship is inferred from titles or categories.
with unambiguous_matches as (
  select
    t.id as timeline_id,
    min(we.id::text)::uuid as event_id
  from public.timelines t
  join public.wedding_events we
    on we.wedding_id = t.wedding_id
   and we.event_date = t.timeline_date
   and we.archived_at is null
  where t.is_template = false
    and t.event_id is null
    and t.wedding_id is not null
    and t.timeline_date is not null
  group by t.id
  having count(*) = 1
)
update public.timelines t
set event_id = match.event_id
from unambiguous_matches match
where t.id = match.timeline_id;
