alter table public.vendors
  add column if not exists source_vendor_candidate_id uuid
    references public.vendor_candidates(id) on delete set null,
  add column if not exists gateway_idempotency_key uuid,
  add column if not exists created_via text not null default 'manual';

create unique index if not exists vendors_source_vendor_candidate_id_unique
  on public.vendors (source_vendor_candidate_id);

create unique index if not exists vendors_gateway_idempotency_key_unique
  on public.vendors (gateway_idempotency_key);

alter table public.intelligence_gateway_confirmations
  add column if not exists result_vendor_id uuid
    references public.vendors(id) on delete set null;

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
    'save_vendor_candidate',
    'assign_vendor_candidate',
    'promote_vendor_candidate'
  ));

comment on column public.vendors.source_vendor_candidate_id is
  'Private discovery candidate that supplied this vendor tracker row.';

comment on column public.vendors.gateway_idempotency_key is
  'Prevents duplicate tracker rows when a confirmed Gateway action is retried.';
