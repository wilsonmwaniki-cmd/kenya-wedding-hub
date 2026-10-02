alter table public.guests
  add column if not exists gateway_idempotency_key uuid,
  add column if not exists created_via text not null default 'manual';

create unique index if not exists guests_gateway_idempotency_key_unique
  on public.guests (gateway_idempotency_key);

alter table public.planner_change_requests
  add column if not exists gateway_idempotency_key uuid;

create unique index if not exists planner_change_requests_gateway_idempotency_key_unique
  on public.planner_change_requests (gateway_idempotency_key);

alter table public.intelligence_gateway_confirmations
  add column if not exists result_guest_id uuid references public.guests(id) on delete set null,
  add column if not exists result_change_request_id uuid references public.planner_change_requests(id) on delete set null;

alter table public.intelligence_gateway_confirmations
  drop constraint if exists intelligence_gateway_confirmations_capability_check;

alter table public.intelligence_gateway_confirmations
  add constraint intelligence_gateway_confirmations_capability_check
  check (capability in ('create_task', 'update_task', 'add_guest'));
