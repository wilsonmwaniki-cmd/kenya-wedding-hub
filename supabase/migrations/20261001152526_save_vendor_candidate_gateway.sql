alter table public.vendor_candidates
  add column if not exists gateway_idempotency_key uuid,
  add column if not exists created_via text not null default 'manual';

create unique index if not exists vendor_candidates_gateway_idempotency_key_unique
  on public.vendor_candidates (gateway_idempotency_key);

alter table public.intelligence_gateway_confirmations
  alter column wedding_id drop not null,
  add column if not exists result_vendor_candidate_id uuid
  references public.vendor_candidates(id) on delete set null;

alter table public.intelligence_gateway_confirmations
  drop constraint if exists intelligence_gateway_confirmations_capability_check;

alter table public.intelligence_gateway_confirmations
  add constraint intelligence_gateway_confirmations_capability_check
  check (capability in (
    'create_task',
    'update_task',
    'add_guest',
    'record_expense',
    'create_vendor_follow_up_reminder',
    'record_payment',
    'save_vendor_candidate'
  ));

comment on column public.vendor_candidates.gateway_idempotency_key is
  'Prevents duplicate private candidates when a confirmed Gateway action is retried.';
