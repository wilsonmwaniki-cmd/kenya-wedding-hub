create table if not exists public.guest_check_in_events (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  action text not null check (action in ('check_in', 'undo_check_in')),
  performed_by_user_id uuid null references auth.users(id) on delete set null,
  performed_by_device_id text null,
  idempotency_key text not null,
  source text not null default 'app',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists guest_check_in_events_wedding_created_idx
  on public.guest_check_in_events (wedding_id, created_at desc);

create index if not exists guest_check_in_events_guest_created_idx
  on public.guest_check_in_events (guest_id, created_at desc);

create unique index if not exists guest_check_in_events_wedding_idempotency_idx
  on public.guest_check_in_events (wedding_id, idempotency_key);

alter table public.guest_check_in_events enable row level security;

drop policy if exists "Users can view guest check-in events for accessible guests" on public.guest_check_in_events;
create policy "Users can view guest check-in events for accessible guests"
on public.guest_check_in_events
for select
using (
  exists (
    select 1
    from public.guests g
    where g.id = guest_check_in_events.guest_id
      and (
        auth.uid() = g.user_id
        or public.is_linked_planner_of(g.user_id)
        or public.is_linked_couple_of(g.client_id)
        or (g.wedding_id is not null and (public.is_wedding_member(g.wedding_id) or public.can_manage_wedding(g.wedding_id)))
      )
  )
);
