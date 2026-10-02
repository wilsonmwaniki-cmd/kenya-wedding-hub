drop index if exists public.guests_gateway_idempotency_key_unique;
create unique index guests_gateway_idempotency_key_unique
  on public.guests (gateway_idempotency_key);

drop index if exists public.planner_change_requests_gateway_idempotency_key_unique;
create unique index planner_change_requests_gateway_idempotency_key_unique
  on public.planner_change_requests (gateway_idempotency_key);
