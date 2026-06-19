create table if not exists public.planner_change_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.planner_clients(id) on delete cascade,
  couple_user_id uuid not null,
  planner_user_id uuid not null,
  target_table text not null check (
    target_table in (
      'guests',
      'wedding_contributions',
      'contribution_rounds',
      'budget_categories',
      'budget_payments',
      'tasks',
      'vendors',
      'timelines',
      'timeline_events'
    )
  ),
  change_type text not null check (change_type in ('create', 'update', 'delete')),
  target_id uuid null,
  current_payload jsonb null,
  proposed_payload jsonb not null default '{}'::jsonb,
  note text null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_at timestamptz null,
  reviewed_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planner_change_requests_client_status_idx
  on public.planner_change_requests (client_id, status, created_at desc);

create index if not exists planner_change_requests_couple_status_idx
  on public.planner_change_requests (couple_user_id, status, created_at desc);

create index if not exists planner_change_requests_planner_status_idx
  on public.planner_change_requests (planner_user_id, status, created_at desc);

alter table public.planner_change_requests enable row level security;

drop policy if exists "Planners can submit linked client change requests" on public.planner_change_requests;
create policy "Planners can submit linked client change requests"
on public.planner_change_requests
for insert
to authenticated
with check (
  auth.uid() = planner_user_id
  and exists (
    select 1
    from public.planner_clients pc
    where pc.id = client_id
      and pc.planner_user_id = auth.uid()
      and pc.linked_user_id = couple_user_id
  )
);

drop policy if exists "Planners can view own change requests" on public.planner_change_requests;
create policy "Planners can view own change requests"
on public.planner_change_requests
for select
to authenticated
using (auth.uid() = planner_user_id);

drop policy if exists "Couples can view linked planner change requests" on public.planner_change_requests;
create policy "Couples can view linked planner change requests"
on public.planner_change_requests
for select
to authenticated
using (
  auth.uid() = couple_user_id
  and exists (
    select 1
    from public.planner_clients pc
    where pc.id = client_id
      and pc.linked_user_id = auth.uid()
  )
);

drop policy if exists "Couples can review linked planner change requests" on public.planner_change_requests;
create policy "Couples can review linked planner change requests"
on public.planner_change_requests
for update
to authenticated
using (
  auth.uid() = couple_user_id
  and exists (
    select 1
    from public.planner_clients pc
    where pc.id = client_id
      and pc.linked_user_id = auth.uid()
  )
)
with check (
  auth.uid() = couple_user_id
  and exists (
    select 1
    from public.planner_clients pc
    where pc.id = client_id
      and pc.linked_user_id = auth.uid()
  )
);

drop policy if exists "Planners can cancel own pending change requests" on public.planner_change_requests;
create policy "Planners can cancel own pending change requests"
on public.planner_change_requests
for update
to authenticated
using (auth.uid() = planner_user_id and status = 'pending')
with check (auth.uid() = planner_user_id);

drop trigger if exists update_planner_change_requests_updated_at on public.planner_change_requests;
create trigger update_planner_change_requests_updated_at
before update on public.planner_change_requests
for each row execute function public.update_updated_at_column();
