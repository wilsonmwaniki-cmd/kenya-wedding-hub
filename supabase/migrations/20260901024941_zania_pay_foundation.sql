-- Zania Pay foundation.
--
-- This migration deliberately separates marketplace invoice payments from the
-- subscription-billing payment_transactions ledger. New payment orders are
-- short lived, server-authoritative, and bound to an authenticated couple plus
-- a connected professional relationship.

alter table public.professional_entitlements
  drop constraint if exists professional_entitlements_feature_key_check;

alter table public.professional_entitlements
  add constraint professional_entitlements_feature_key_check
  check (
    feature_key in (
      'directory_listing',
      'verified_listing',
      'booking_management',
      'document_collaboration',
      'invoicing',
      'contract_management',
      'public_reputation',
      'media_portfolio',
      'advertising',
      'team_workspace',
      'payments_accept'
    )
  );

insert into public.professional_entitlements (
  user_id,
  audience,
  feature_key,
  status,
  source_lookup_key,
  source_bundle_code,
  seat_limit,
  effective_from,
  effective_to,
  metadata
)
select
  entitlement.user_id,
  entitlement.audience,
  'payments_accept',
  entitlement.status,
  entitlement.source_lookup_key,
  entitlement.source_bundle_code,
  entitlement.seat_limit,
  entitlement.effective_from,
  entitlement.effective_to,
  entitlement.metadata || jsonb_build_object('source_feature_key', entitlement.feature_key)
from public.professional_entitlements entitlement
where entitlement.feature_key = 'booking_management'
on conflict (user_id, audience, feature_key) do nothing;

insert into public.wedding_entitlements (
  wedding_id,
  feature_key,
  status,
  source_bundle_id,
  effective_from,
  effective_to,
  metadata
)
select
  entitlement.wedding_id,
  'payments_send',
  entitlement.status,
  entitlement.source_bundle_id,
  entitlement.effective_from,
  entitlement.effective_to,
  entitlement.metadata || jsonb_build_object('source_feature_key', entitlement.feature_key)
from public.wedding_entitlements entitlement
where entitlement.feature_key = 'wedding_collaboration'
on conflict (wedding_id, feature_key) do nothing;

update public.pricing_catalog
set config = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            config,
            '{checkout,coupleCheckoutMap,couple_collaborative_monthly,features}',
            coalesce(config #> '{checkout,coupleCheckoutMap,couple_collaborative_monthly,features}', '[]'::jsonb)
              || '["payments_send"]'::jsonb,
            true
          ),
          '{checkout,coupleCheckoutMap,couple_collaborative_annual,features}',
          coalesce(config #> '{checkout,coupleCheckoutMap,couple_collaborative_annual,features}', '[]'::jsonb)
            || '["payments_send"]'::jsonb,
          true
        ),
        '{checkout,professionalCheckoutMap,planner_premium_monthly,features}',
        coalesce(config #> '{checkout,professionalCheckoutMap,planner_premium_monthly,features}', '[]'::jsonb)
          || '["payments_accept"]'::jsonb,
        true
      ),
      '{checkout,professionalCheckoutMap,planner_premium_annual,features}',
      coalesce(config #> '{checkout,professionalCheckoutMap,planner_premium_annual,features}', '[]'::jsonb)
        || '["payments_accept"]'::jsonb,
      true
    ),
    '{checkout,professionalCheckoutMap,vendor_premium_monthly,features}',
    coalesce(config #> '{checkout,professionalCheckoutMap,vendor_premium_monthly,features}', '[]'::jsonb)
      || '["payments_accept"]'::jsonb,
    true
  ),
  '{checkout,professionalCheckoutMap,vendor_premium_annual,features}',
  coalesce(config #> '{checkout,professionalCheckoutMap,vendor_premium_annual,features}', '[]'::jsonb)
    || '["payments_accept"]'::jsonb,
  true
),
updated_at = now()
where is_active = true;

create table public.zania_pay_accounts (
  id uuid primary key default gen_random_uuid(),
  professional_user_id uuid not null references auth.users(id) on delete cascade,
  audience text not null check (audience in ('vendor', 'planner')),
  vendor_listing_id uuid null references public.vendor_listings(id) on delete set null,
  provider text not null default 'sandbox',
  provider_account_reference text null,
  status text not null default 'not_started'
    check (status in ('not_started', 'pending', 'verified', 'paused', 'rejected')),
  settlement_currency text not null default 'KES' check (settlement_currency = 'KES'),
  settlement_destination_hint text null,
  terms_accepted_at timestamptz null,
  submitted_at timestamptz null,
  verified_at timestamptz null,
  paused_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zania_pay_accounts_vendor_listing_shape check (
    (audience = 'vendor' and vendor_listing_id is not null)
    or (audience = 'planner' and vendor_listing_id is null)
  ),
  constraint zania_pay_accounts_user_audience_unique unique (professional_user_id, audience)
);

create table public.zania_pay_orders (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.commercial_documents(id) on delete restrict,
  wedding_id uuid not null references public.weddings(id) on delete restrict,
  payer_user_id uuid not null references auth.users(id) on delete restrict,
  professional_user_id uuid not null references auth.users(id) on delete restrict,
  professional_account_id uuid not null references public.zania_pay_accounts(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'KES' check (currency = 'KES'),
  payment_method text not null check (payment_method in ('mpesa', 'card')),
  mode text not null default 'sandbox' check (mode in ('sandbox', 'live')),
  status text not null default 'created'
    check (status in (
      'created', 'awaiting_authorization', 'processing', 'paid', 'failed',
      'expired', 'cancelled', 'part_refunded', 'refunded', 'disputed'
    )),
  idempotency_key text not null,
  provider text not null,
  provider_reference text null,
  provider_fee numeric(12,2) null check (provider_fee is null or provider_fee >= 0),
  zania_fee numeric(12,2) not null default 0 check (zania_fee = 0),
  net_settlement numeric(12,2) null check (net_settlement is null or net_settlement >= 0),
  eligibility_snapshot jsonb not null,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  submitted_at timestamptz null,
  paid_at timestamptz null,
  failed_at timestamptz null,
  failure_code text null,
  failure_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zania_pay_orders_payer_idempotency_unique unique (payer_user_id, idempotency_key)
);

create unique index zania_pay_orders_provider_reference_unique
  on public.zania_pay_orders(provider, provider_reference)
  where provider_reference is not null;

create index zania_pay_orders_invoice_created_idx
  on public.zania_pay_orders(invoice_id, created_at desc);

create index zania_pay_orders_payer_created_idx
  on public.zania_pay_orders(payer_user_id, created_at desc);

create index zania_pay_orders_professional_created_idx
  on public.zania_pay_orders(professional_user_id, created_at desc);

create index zania_pay_orders_open_expiry_idx
  on public.zania_pay_orders(expires_at)
  where status in ('created', 'awaiting_authorization');

create table public.zania_pay_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.zania_pay_orders(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  status text not null check (status in ('started', 'submitted', 'processing', 'succeeded', 'failed')),
  provider_reference text null,
  phone_hint text null,
  failure_code text null,
  failure_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zania_pay_attempts_order_number_unique unique (order_id, attempt_number)
);

create table public.zania_pay_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  provider_reference text null,
  payload_hash text not null,
  payload jsonb not null,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  processing_error text null,
  received_at timestamptz not null default now(),
  processed_at timestamptz null,
  constraint zania_pay_provider_events_unique unique (provider, provider_event_id)
);

create table public.zania_pay_settlements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.zania_pay_orders(id) on delete restrict,
  professional_user_id uuid not null references auth.users(id) on delete restrict,
  gross_amount numeric(12,2) not null check (gross_amount > 0),
  provider_fee numeric(12,2) not null default 0 check (provider_fee >= 0),
  zania_fee numeric(12,2) not null default 0 check (zania_fee = 0),
  net_amount numeric(12,2) not null check (net_amount >= 0),
  currency text not null default 'KES' check (currency = 'KES'),
  status text not null default 'pending'
    check (status in ('pending', 'scheduled', 'paid', 'failed', 'reversed')),
  provider_settlement_reference text null,
  expected_at timestamptz null,
  paid_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zania_pay_settlements_order_unique unique (order_id)
);

create table public.zania_pay_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.zania_pay_orders(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  reason text null,
  status text not null default 'requested'
    check (status in ('requested', 'processing', 'paid', 'failed', 'cancelled')),
  provider_reference text null,
  requested_by uuid null references auth.users(id) on delete set null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.zania_pay_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.zania_pay_orders(id) on delete restrict,
  provider_dispute_reference text not null,
  status text not null default 'open'
    check (status in ('open', 'under_review', 'won', 'lost', 'closed')),
  reason text null,
  evidence_due_at timestamptz null,
  resolved_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zania_pay_disputes_provider_reference_unique unique (provider_dispute_reference)
);

alter table public.commercial_document_payments
  add column if not exists source text not null default 'external'
    check (source in ('external', 'zania_pay', 'zania_pay_sandbox')),
  add column if not exists zania_pay_order_id uuid null references public.zania_pay_orders(id) on delete restrict,
  add column if not exists provider_reference text null,
  add column if not exists confirmed_at timestamptz null;

create unique index commercial_document_payments_zania_pay_order_unique
  on public.commercial_document_payments(zania_pay_order_id)
  where zania_pay_order_id is not null;

alter table public.zania_pay_accounts enable row level security;
alter table public.zania_pay_orders enable row level security;
alter table public.zania_pay_attempts enable row level security;
alter table public.zania_pay_provider_events enable row level security;
alter table public.zania_pay_settlements enable row level security;
alter table public.zania_pay_refunds enable row level security;
alter table public.zania_pay_disputes enable row level security;

revoke all on public.zania_pay_accounts from anon, authenticated;
revoke all on public.zania_pay_attempts from anon, authenticated;
revoke all on public.zania_pay_provider_events from anon, authenticated;

grant select on public.zania_pay_orders to authenticated;
grant select on public.zania_pay_settlements to authenticated;
grant select on public.zania_pay_refunds to authenticated;
grant select on public.zania_pay_disputes to authenticated;

create policy "Payment participants can view orders"
on public.zania_pay_orders for select
to authenticated
using ((select auth.uid()) in (payer_user_id, professional_user_id));

create policy "Professionals can view settlements"
on public.zania_pay_settlements for select
to authenticated
using ((select auth.uid()) = professional_user_id);

create policy "Payment participants can view refunds"
on public.zania_pay_refunds for select
to authenticated
using (
  exists (
    select 1
    from public.zania_pay_orders payment_order
    where payment_order.id = zania_pay_refunds.order_id
      and (select auth.uid()) in (payment_order.payer_user_id, payment_order.professional_user_id)
  )
);

create policy "Payment participants can view disputes"
on public.zania_pay_disputes for select
to authenticated
using (
  exists (
    select 1
    from public.zania_pay_orders payment_order
    where payment_order.id = zania_pay_disputes.order_id
      and (select auth.uid()) in (payment_order.payer_user_id, payment_order.professional_user_id)
  )
);

create or replace function public.get_zania_pay_account_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  account_record public.zania_pay_accounts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into account_record
  from public.zania_pay_accounts
  where professional_user_id = auth.uid()
  order by created_at desc
  limit 1;

  if account_record.id is null then
    return jsonb_build_object('status', 'not_started');
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'id', account_record.id,
    'audience', account_record.audience,
    'status', account_record.status,
    'provider', account_record.provider,
    'settlementCurrency', account_record.settlement_currency,
    'settlementDestinationHint', account_record.settlement_destination_hint,
    'submittedAt', account_record.submitted_at,
    'verifiedAt', account_record.verified_at
  ));
end;
$$;

create or replace function public.request_zania_pay_account(
  _audience text,
  _vendor_listing_id uuid default null,
  _settlement_destination_hint text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  account_record public.zania_pay_accounts%rowtype;
  profile_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if _audience not in ('vendor', 'planner') then
    raise exception 'Choose a vendor or planner account';
  end if;

  select role::text into profile_role
  from public.profiles
  where user_id = auth.uid();

  if profile_role <> _audience then
    raise exception 'This payment account does not match your Zania account';
  end if;

  if _audience = 'vendor' and not exists (
    select 1
    from public.vendor_listings listing
    where listing.id = _vendor_listing_id
      and listing.user_id = auth.uid()
  ) then
    raise exception 'Choose your own vendor listing';
  end if;

  insert into public.zania_pay_accounts (
    professional_user_id,
    audience,
    vendor_listing_id,
    status,
    settlement_destination_hint,
    terms_accepted_at,
    submitted_at
  ) values (
    auth.uid(),
    _audience,
    case when _audience = 'vendor' then _vendor_listing_id else null end,
    'pending',
    nullif(trim(_settlement_destination_hint), ''),
    now(),
    now()
  )
  on conflict (professional_user_id, audience)
  do update set
    vendor_listing_id = excluded.vendor_listing_id,
    settlement_destination_hint = excluded.settlement_destination_hint,
    terms_accepted_at = coalesce(public.zania_pay_accounts.terms_accepted_at, excluded.terms_accepted_at),
    submitted_at = excluded.submitted_at,
    status = case
      when public.zania_pay_accounts.status = 'verified' then 'verified'
      else 'pending'
    end,
    updated_at = now()
  returning * into account_record;

  return public.get_zania_pay_account_status();
end;
$$;

create or replace function public.get_zania_pay_invoice_eligibility(_invoice_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  invoice_record public.commercial_documents%rowtype;
  payer_id uuid := auth.uid();
  payer_email text;
  resolved_wedding_id uuid;
  account_record public.zania_pay_accounts%rowtype;
  couple_can_send boolean := false;
  professional_can_accept boolean := false;
  connection_found boolean := false;
  invoice_payable boolean := false;
  reason_code text;
begin
  if payer_id is null then
    raise exception 'Authentication required';
  end if;

  select lower(email) into payer_email
  from auth.users
  where id = payer_id;

  select * into invoice_record
  from public.commercial_documents
  where id = _invoice_id;

  if invoice_record.id is null or invoice_record.document_type <> 'invoice' then
    return jsonb_build_object(
      'allowed', false,
      'state', 'invoice_unavailable',
      'reason', 'This invoice is not available for payment.'
    );
  end if;

  invoice_payable := invoice_record.status in ('sent', 'part_paid')
    and invoice_record.balance_due > 0;

  if invoice_record.client_id is not null then
    select client.wedding_id into resolved_wedding_id
    from public.planner_clients client
    where client.id = invoice_record.client_id
      and client.linked_user_id = payer_id
    limit 1;
  end if;

  if resolved_wedding_id is null and invoice_record.vendor_id is not null then
    select vendor.wedding_id into resolved_wedding_id
    from public.vendors vendor
    where vendor.id = invoice_record.vendor_id
      and (
        vendor.user_id = payer_id
        or (vendor.wedding_id is not null and public.is_wedding_member(vendor.wedding_id))
      )
      and (
        invoice_record.vendor_listing_id is null
        or vendor.vendor_listing_id = invoice_record.vendor_listing_id
      )
    limit 1;
  end if;

  if resolved_wedding_id is null
     and invoice_record.vendor_listing_id is not null
     and payer_email <> ''
     and lower(coalesce(invoice_record.recipient_email, '')) = payer_email then
    select vendor.wedding_id into resolved_wedding_id
    from public.vendors vendor
    where vendor.vendor_listing_id = invoice_record.vendor_listing_id
      and (
        vendor.user_id = payer_id
        or (vendor.wedding_id is not null and public.is_wedding_member(vendor.wedding_id))
      )
    order by vendor.created_at desc
    limit 1;
  end if;

  connection_found := resolved_wedding_id is not null
    and public.is_wedding_member(resolved_wedding_id);

  if connection_found then
    couple_can_send := public.wedding_has_feature(resolved_wedding_id, 'payments_send');
  end if;

  professional_can_accept := exists (
    select 1
    from public.professional_entitlements entitlement
    where entitlement.user_id = invoice_record.user_id
      and entitlement.audience = invoice_record.role
      and entitlement.feature_key = 'payments_accept'
      and entitlement.status = 'active'
      and entitlement.effective_from <= now()
      and (entitlement.effective_to is null or entitlement.effective_to > now())
  );

  select * into account_record
  from public.zania_pay_accounts account
  where account.professional_user_id = invoice_record.user_id
    and account.audience = invoice_record.role
  limit 1;

  reason_code := case
    when not connection_found then 'not_connected'
    when not invoice_payable then 'invoice_unavailable'
    when not couple_can_send then 'couple_upgrade'
    when not professional_can_accept then 'professional_subscription_required'
    when account_record.id is null or account_record.status <> 'verified' then 'professional_not_ready'
    else 'available'
  end;

  return jsonb_strip_nulls(jsonb_build_object(
    'allowed', reason_code = 'available',
    'state', reason_code,
    'invoiceId', invoice_record.id,
    'invoiceNumber', invoice_record.document_number,
    'weddingId', resolved_wedding_id,
    'professionalUserId', invoice_record.user_id,
    'professionalAccountId', account_record.id,
    'balanceDue', invoice_record.balance_due,
    'currency', invoice_record.currency,
    'coupleCanSend', couple_can_send,
    'professionalCanAccept', professional_can_accept,
    'professionalAccountStatus', coalesce(account_record.status, 'not_started'),
    'reason', case reason_code
      when 'available' then 'Pay this invoice through Zania.'
      when 'couple_upgrade' then 'Upgrade your wedding workspace to pay through Zania.'
      when 'professional_subscription_required' then 'This professional has not activated Zania Pay yet.'
      when 'professional_not_ready' then 'This professional has not finished setting up Zania Pay.'
      when 'not_connected' then 'This invoice is not connected to your wedding workspace.'
      else 'This invoice is not available for payment.'
    end
  ));
end;
$$;

create or replace function public.create_zania_pay_order(
  _invoice_id uuid,
  _amount numeric,
  _payment_method text,
  _idempotency_key text
)
returns public.zania_pay_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  eligibility jsonb;
  invoice_record public.commercial_documents%rowtype;
  existing_order public.zania_pay_orders%rowtype;
  created_order public.zania_pay_orders%rowtype;
  clean_key text := nullif(trim(_idempotency_key), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if _payment_method not in ('mpesa', 'card') then
    raise exception 'Choose M-Pesa or card';
  end if;

  if clean_key is null or length(clean_key) > 120 then
    raise exception 'Could not start payment. Please try again.';
  end if;

  select * into existing_order
  from public.zania_pay_orders
  where payer_user_id = auth.uid()
    and idempotency_key = clean_key;

  if existing_order.id is not null then
    return existing_order;
  end if;

  select * into invoice_record
  from public.commercial_documents
  where id = _invoice_id
  for update;

  eligibility := public.get_zania_pay_invoice_eligibility(_invoice_id);

  if not coalesce((eligibility ->> 'allowed')::boolean, false) then
    raise exception '%', coalesce(eligibility ->> 'reason', 'This invoice cannot be paid through Zania.');
  end if;

  if _amount is null or _amount <= 0 or _amount > invoice_record.balance_due then
    raise exception 'Enter an amount up to the remaining balance';
  end if;

  update public.zania_pay_orders
  set status = 'expired', updated_at = now()
  where payer_user_id = auth.uid()
    and invoice_id = _invoice_id
    and status in ('created', 'awaiting_authorization')
    and expires_at <= now();

  insert into public.zania_pay_orders (
    invoice_id,
    wedding_id,
    payer_user_id,
    professional_user_id,
    professional_account_id,
    amount,
    currency,
    payment_method,
    mode,
    status,
    idempotency_key,
    provider,
    eligibility_snapshot,
    expires_at
  ) values (
    _invoice_id,
    (eligibility ->> 'weddingId')::uuid,
    auth.uid(),
    (eligibility ->> 'professionalUserId')::uuid,
    (eligibility ->> 'professionalAccountId')::uuid,
    _amount,
    invoice_record.currency,
    _payment_method,
    'sandbox',
    'created',
    clean_key,
    'sandbox',
    eligibility,
    now() + interval '15 minutes'
  )
  returning * into created_order;

  return created_order;
end;
$$;

revoke execute on function public.get_zania_pay_account_status() from public, anon;
revoke execute on function public.request_zania_pay_account(text, uuid, text) from public, anon;
revoke execute on function public.get_zania_pay_invoice_eligibility(uuid) from public, anon;
revoke execute on function public.create_zania_pay_order(uuid, numeric, text, text) from public, anon;

grant execute on function public.get_zania_pay_account_status() to authenticated;
grant execute on function public.request_zania_pay_account(text, uuid, text) to authenticated;
grant execute on function public.get_zania_pay_invoice_eligibility(uuid) to authenticated;
grant execute on function public.create_zania_pay_order(uuid, numeric, text, text) to authenticated;

drop trigger if exists update_zania_pay_accounts_updated_at on public.zania_pay_accounts;
create trigger update_zania_pay_accounts_updated_at
before update on public.zania_pay_accounts
for each row execute function public.update_updated_at_column();

drop trigger if exists update_zania_pay_orders_updated_at on public.zania_pay_orders;
create trigger update_zania_pay_orders_updated_at
before update on public.zania_pay_orders
for each row execute function public.update_updated_at_column();

drop trigger if exists update_zania_pay_attempts_updated_at on public.zania_pay_attempts;
create trigger update_zania_pay_attempts_updated_at
before update on public.zania_pay_attempts
for each row execute function public.update_updated_at_column();

drop trigger if exists update_zania_pay_settlements_updated_at on public.zania_pay_settlements;
create trigger update_zania_pay_settlements_updated_at
before update on public.zania_pay_settlements
for each row execute function public.update_updated_at_column();

drop trigger if exists update_zania_pay_refunds_updated_at on public.zania_pay_refunds;
create trigger update_zania_pay_refunds_updated_at
before update on public.zania_pay_refunds
for each row execute function public.update_updated_at_column();

drop trigger if exists update_zania_pay_disputes_updated_at on public.zania_pay_disputes;
create trigger update_zania_pay_disputes_updated_at
before update on public.zania_pay_disputes
for each row execute function public.update_updated_at_column();

notify pgrst, 'reload schema';
