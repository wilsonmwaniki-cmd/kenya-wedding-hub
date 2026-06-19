alter table public.timelines
  add column if not exists wedding_id uuid null references public.weddings(id) on delete cascade;

create index if not exists timelines_wedding_id_idx
  on public.timelines (wedding_id);

update public.timelines t
set wedding_id = pc.wedding_id
from public.planner_clients pc
where t.wedding_id is null
  and t.client_id = pc.id
  and pc.wedding_id is not null;

with owner_workspace as (
  select distinct on (wm.user_id)
    wm.user_id,
    wm.wedding_id
  from public.wedding_memberships wm
  where wm.user_id is not null
    and wm.is_owner = true
    and wm.membership_status = 'active'
  order by wm.user_id, wm.accepted_at nulls last, wm.created_at
)
update public.timelines t
set wedding_id = ow.wedding_id
from owner_workspace ow
where t.wedding_id is null
  and t.user_id = ow.user_id;

create table if not exists public.timeline_operation_events (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  timeline_id uuid not null references public.timelines(id) on delete cascade,
  timeline_event_id uuid null references public.timeline_events(id) on delete cascade,
  operation_type text not null check (
    operation_type in (
      'event_created',
      'event_updated',
      'event_deleted',
      'event_reordered',
      'timeline_shifted'
    )
  ),
  performed_by_user_id uuid null references auth.users(id) on delete set null,
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists timeline_operation_events_wedding_created_idx
  on public.timeline_operation_events (wedding_id, created_at desc);

create index if not exists timeline_operation_events_timeline_created_idx
  on public.timeline_operation_events (timeline_id, created_at desc);

create index if not exists timeline_operation_events_timeline_event_created_idx
  on public.timeline_operation_events (timeline_event_id, created_at desc)
  where timeline_event_id is not null;

create unique index if not exists timeline_operation_events_timeline_idempotency_idx
  on public.timeline_operation_events (timeline_id, idempotency_key);

alter table public.timeline_operation_events enable row level security;

drop policy if exists "Users can view timeline operation events for accessible timelines" on public.timeline_operation_events;
create policy "Users can view timeline operation events for accessible timelines"
on public.timeline_operation_events
for select
using (public.owns_timeline(timeline_id));
