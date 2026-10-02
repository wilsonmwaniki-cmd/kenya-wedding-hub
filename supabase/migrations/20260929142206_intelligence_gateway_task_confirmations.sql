alter table public.tasks
  add column if not exists gateway_idempotency_key uuid,
  add column if not exists created_via text not null default 'manual';

create unique index if not exists tasks_gateway_idempotency_key_unique
  on public.tasks (gateway_idempotency_key);

create table if not exists public.intelligence_gateway_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  selected_client_id uuid references public.planner_clients(id) on delete cascade,
  capability text not null check (capability in ('create_task')),
  arguments jsonb not null,
  idempotency_key uuid not null default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'executed', 'expired', 'revoked')),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now(),
  executed_at timestamptz,
  result_entity_id uuid references public.tasks(id) on delete set null,
  unique (user_id, idempotency_key)
);

create index if not exists intelligence_gateway_confirmations_pending_idx
  on public.intelligence_gateway_confirmations (user_id, capability, expires_at)
  where status = 'pending';

alter table public.intelligence_gateway_confirmations enable row level security;

create policy "Users can view own gateway confirmations"
  on public.intelligence_gateway_confirmations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create own gateway confirmations"
  on public.intelligence_gateway_confirmations
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own gateway confirmations"
  on public.intelligence_gateway_confirmations
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.intelligence_gateway_confirmations from anon;
grant select, insert, update on table public.intelligence_gateway_confirmations to authenticated;
