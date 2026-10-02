-- Operational safeguards for Zania Pay before live payment initiation.

alter table public.zania_pay_orders
  add column if not exists reconciliation_status text not null default 'not_checked',
  add column if not exists reconciliation_attempts integer not null default 0,
  add column if not exists next_reconciliation_at timestamptz null,
  add column if not exists last_reconciled_at timestamptz null,
  add column if not exists last_reconciliation_error text null;

alter table public.zania_pay_orders
  drop constraint if exists zania_pay_orders_reconciliation_status_check;
alter table public.zania_pay_orders
  add constraint zania_pay_orders_reconciliation_status_check
  check (reconciliation_status in ('not_checked', 'checking', 'pending', 'verified', 'failed'));

alter table public.zania_pay_provider_events
  add column if not exists retry_count integer not null default 0,
  add column if not exists last_retry_at timestamptz null,
  add column if not exists next_retry_at timestamptz null;

alter table public.zania_pay_refunds
  add column if not exists invoice_amount numeric(12,2),
  add column if not exists provider_fee_amount numeric(12,2) not null default 0,
  add column if not exists zania_fee_amount numeric(12,2) not null default 0,
  add column if not exists provider_refund_id text null,
  add column if not exists provider_status text null,
  add column if not exists failure_message text null,
  add column if not exists initiated_at timestamptz null,
  add column if not exists idempotency_key text null;

update public.zania_pay_refunds set invoice_amount = amount where invoice_amount is null;
alter table public.zania_pay_refunds alter column invoice_amount set not null;
alter table public.zania_pay_refunds
  drop constraint if exists zania_pay_refunds_status_check;
alter table public.zania_pay_refunds
  add constraint zania_pay_refunds_status_check
  check (status in ('requested', 'processing', 'needs_attention', 'paid', 'failed', 'cancelled'));
alter table public.zania_pay_refunds
  add constraint zania_pay_refunds_fee_amounts_check
  check (invoice_amount > 0 and provider_fee_amount >= 0 and zania_fee_amount >= 0
    and amount = invoice_amount + provider_fee_amount + zania_fee_amount);

alter table public.zania_pay_settlements
  drop constraint if exists zania_pay_settlements_status_check;
alter table public.zania_pay_settlements
  add constraint zania_pay_settlements_status_check
  check (status in ('pending', 'scheduled', 'paid', 'failed', 'part_reversed', 'reversed'));

create unique index if not exists zania_pay_refunds_idempotency_unique
  on public.zania_pay_refunds(idempotency_key) where idempotency_key is not null;
create index if not exists zania_pay_orders_reconciliation_due_idx
  on public.zania_pay_orders(next_reconciliation_at)
  where status in ('awaiting_authorization', 'processing');
create index if not exists zania_pay_provider_events_retry_due_idx
  on public.zania_pay_provider_events(next_retry_at)
  where processing_status = 'failed';

create or replace function public.claim_zania_pay_reconciliation_batch(_limit integer default 20)
returns table (
  order_id uuid,
  provider text,
  provider_reference text,
  mode text,
  charge_amount numeric,
  currency text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select payment_order.id
    from public.zania_pay_orders payment_order
    where payment_order.provider_reference is not null
      and payment_order.status in ('awaiting_authorization', 'processing')
      and payment_order.submitted_at <= now() - interval '1 minute'
      and coalesce(payment_order.next_reconciliation_at, '-infinity'::timestamptz) <= now()
    order by payment_order.submitted_at
    for update skip locked
    limit least(greatest(coalesce(_limit, 20), 1), 100)
  )
  update public.zania_pay_orders payment_order
  set reconciliation_status = 'checking',
      reconciliation_attempts = payment_order.reconciliation_attempts + 1,
      last_reconciled_at = now(),
      next_reconciliation_at = now() + interval '5 minutes',
      updated_at = now()
  from candidates
  where payment_order.id = candidates.id
  returning payment_order.id, payment_order.provider, payment_order.provider_reference,
    payment_order.mode, payment_order.charge_amount, payment_order.currency;
end;
$$;

create or replace function public.finish_zania_pay_reconciliation(
  _order_id uuid,
  _status text,
  _error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _status not in ('pending', 'verified', 'failed') then
    raise exception 'Invalid reconciliation status';
  end if;
  update public.zania_pay_orders
  set reconciliation_status = _status,
      last_reconciliation_error = nullif(trim(_error), ''),
      last_reconciled_at = now(),
      next_reconciliation_at = case
        when _status = 'verified' then null
        when _status = 'pending' then now() + interval '5 minutes'
        else now() + interval '15 minutes'
      end,
      updated_at = now()
  where id = _order_id;
end;
$$;

create or replace function public.admin_request_zania_pay_refund(
  _order_id uuid,
  _invoice_amount numeric,
  _reason text,
  _idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_order public.zania_pay_orders%rowtype;
  reserved_invoice numeric(12,2);
  remaining_invoice numeric(12,2);
  refunded_zania_fee numeric(12,2);
  service_fee_refund numeric(12,2) := 0;
  refund_record public.zania_pay_refunds%rowtype;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Only admins can request Zania Pay refunds';
  end if;
  if nullif(trim(_idempotency_key), '') is null then raise exception 'A retry key is required'; end if;

  select * into refund_record from public.zania_pay_refunds where idempotency_key = trim(_idempotency_key);
  if refund_record.id is not null then return to_jsonb(refund_record); end if;

  select * into payment_order from public.zania_pay_orders where id = _order_id for update;
  if payment_order.id is null or payment_order.status not in ('paid', 'part_refunded') then
    raise exception 'Only paid Zania Pay orders can be refunded';
  end if;

  select coalesce(sum(invoice_amount), 0), coalesce(sum(zania_fee_amount), 0)
    into reserved_invoice, refunded_zania_fee
  from public.zania_pay_refunds
  where order_id = _order_id and status in ('requested', 'processing', 'needs_attention', 'paid');
  remaining_invoice := payment_order.amount - reserved_invoice;
  if _invoice_amount is null or _invoice_amount <= 0 or _invoice_amount > remaining_invoice then
    raise exception 'Refund amount exceeds the refundable invoice balance';
  end if;
  if _invoice_amount = remaining_invoice and refunded_zania_fee = 0 then
    service_fee_refund := payment_order.zania_fee;
  end if;

  insert into public.zania_pay_refunds (
    order_id, amount, invoice_amount, provider_fee_amount, zania_fee_amount,
    reason, requested_by, idempotency_key
  ) values (
    _order_id, _invoice_amount + service_fee_refund, _invoice_amount, 0, service_fee_refund,
    nullif(trim(_reason), ''), auth.uid(), trim(_idempotency_key)
  ) returning * into refund_record;
  return to_jsonb(refund_record);
end;
$$;

create or replace function public.claim_zania_pay_refund(_refund_id uuid)
returns public.zania_pay_refunds
language plpgsql security definer set search_path = public
as $$
declare refund_record public.zania_pay_refunds%rowtype;
begin
  update public.zania_pay_refunds
  set status = 'processing', initiated_at = coalesce(initiated_at, now()), updated_at = now()
  where id = _refund_id and status = 'requested'
  returning * into refund_record;
  return refund_record;
end;
$$;

create or replace function public.finish_zania_pay_refund_request(
  _refund_id uuid, _provider_reference text, _provider_refund_id text, _provider_status text
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.zania_pay_refunds
  set provider_reference = nullif(trim(_provider_reference), ''),
      provider_refund_id = nullif(trim(_provider_refund_id), ''),
      provider_status = nullif(trim(_provider_status), ''),
      status = case when lower(coalesce(_provider_status, '')) = 'processed' then 'paid' else 'processing' end,
      completed_at = case when lower(coalesce(_provider_status, '')) = 'processed' then now() else completed_at end,
      failure_message = null, updated_at = now()
  where id = _refund_id;
end;
$$;

create or replace function public.fail_zania_pay_refund_request(_refund_id uuid, _message text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.zania_pay_refunds
  set status = 'failed', failure_message = left(coalesce(_message, 'Refund request failed'), 500), updated_at = now()
  where id = _refund_id;
end;
$$;

create or replace function public.apply_zania_pay_refund_event(
  _transaction_reference text,
  _refund_reference text,
  _provider_status text,
  _amount numeric
)
returns void language plpgsql security definer set search_path = public
as $$
declare
  payment_order public.zania_pay_orders%rowtype;
  refund_record public.zania_pay_refunds%rowtype;
  refunded_invoice numeric(12,2);
  remaining_paid numeric(12,2);
  mapped_status text;
begin
  select * into payment_order from public.zania_pay_orders
  where provider = 'paystack' and provider_reference = _transaction_reference for update;
  if payment_order.id is null then raise exception 'Refund payment order not found'; end if;
  mapped_status := case lower(coalesce(_provider_status, ''))
    when 'processed' then 'paid' when 'failed' then 'failed'
    when 'needs-attention' then 'needs_attention' else 'processing' end;
  select * into refund_record from public.zania_pay_refunds
  where order_id = payment_order.id
    and (provider_refund_id = _refund_reference or provider_refund_id is null)
    and status in ('requested', 'processing', 'needs_attention', 'failed')
  order by created_at limit 1 for update;
  if refund_record.id is null then raise exception 'Refund request not found'; end if;
  if _amount is not null and _amount > 0 and round(_amount, 2) <> round(refund_record.amount, 2) then
    raise exception 'Refund amount does not match the approved request';
  end if;
  update public.zania_pay_refunds
  set provider_refund_id = coalesce(nullif(trim(_refund_reference), ''), provider_refund_id),
      provider_status = _provider_status, status = mapped_status,
      completed_at = case when mapped_status = 'paid' then now() else completed_at end,
      failure_message = case when mapped_status = 'failed' then 'Paystack could not process this refund.' else null end,
      updated_at = now()
  where id = refund_record.id;
  if mapped_status <> 'paid' then return; end if;

  select coalesce(sum(invoice_amount), 0) into refunded_invoice
  from public.zania_pay_refunds where order_id = payment_order.id and status = 'paid';
  remaining_paid := greatest(payment_order.amount - refunded_invoice, 0);
  update public.zania_pay_orders set
    status = case when remaining_paid = 0 then 'refunded' else 'part_refunded' end,
    net_settlement = remaining_paid, updated_at = now()
  where id = payment_order.id;
  update public.zania_pay_settlements set
    net_amount = remaining_paid,
    status = case when remaining_paid = 0 then 'reversed' else 'part_reversed' end,
    updated_at = now()
  where order_id = payment_order.id;
  update public.commercial_documents invoice set
    amount_paid = remaining_paid,
    balance_due = greatest(invoice.total_amount - remaining_paid, 0),
    status = case when remaining_paid = 0 then 'sent' else 'part_paid' end,
    paid_date = case when remaining_paid = invoice.total_amount then invoice.paid_date else null end,
    updated_at = now()
  where invoice.id = payment_order.invoice_id;
end;
$$;

create or replace function public.apply_zania_pay_dispute_event(
  _transaction_reference text, _dispute_reference text, _event_type text,
  _reason text, _evidence_due_at timestamptz, _metadata jsonb
)
returns void language plpgsql security definer set search_path = public
as $$
declare payment_order_id uuid; resolved boolean := _event_type = 'charge.dispute.resolve';
begin
  select id into payment_order_id from public.zania_pay_orders
  where provider = 'paystack' and provider_reference = _transaction_reference;
  if payment_order_id is null then raise exception 'Dispute payment order not found'; end if;
  insert into public.zania_pay_disputes (
    order_id, provider_dispute_reference, status, reason, evidence_due_at, resolved_at, metadata
  ) values (
    payment_order_id, _dispute_reference,
    case when resolved then 'closed' when _event_type = 'charge.dispute.remind' then 'under_review' else 'open' end,
    nullif(trim(_reason), ''), _evidence_due_at, case when resolved then now() else null end,
    coalesce(_metadata, '{}'::jsonb)
  ) on conflict (provider_dispute_reference) do update set
    status = excluded.status, reason = coalesce(excluded.reason, public.zania_pay_disputes.reason),
    evidence_due_at = coalesce(excluded.evidence_due_at, public.zania_pay_disputes.evidence_due_at),
    resolved_at = excluded.resolved_at, metadata = excluded.metadata, updated_at = now();
  update public.zania_pay_orders set status = case when resolved then 'paid' else 'disputed' end, updated_at = now()
  where id = payment_order_id and status not in ('part_refunded', 'refunded');
end;
$$;

create or replace function public.admin_list_zania_pay_ledger(_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Only admins can view the Zania Pay ledger';
  end if;
  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb) into result
  from (
    select
      payment_order.created_at,
      jsonb_build_object(
        'id', payment_order.id, 'createdAt', payment_order.created_at,
        'invoiceId', payment_order.invoice_id, 'invoiceNumber', invoice.document_number,
        'invoiceTitle', invoice.title, 'payerName', coalesce(payer.full_name, invoice.recipient_name, 'Couple'),
        'professionalName', coalesce(vendor.business_name, professional.company_name, professional.full_name, 'Professional'),
        'mode', payment_order.mode, 'method', payment_order.payment_method, 'status', payment_order.status,
        'invoiceAmount', payment_order.amount, 'providerFee', coalesce(payment_order.provider_fee, payment_order.payer_processing_fee, 0),
        'zaniaFee', payment_order.zania_fee, 'totalCharged', payment_order.charge_amount,
        'professionalSettlement', coalesce(payment_order.net_settlement, 0),
        'settlementStatus', settlement.status, 'providerReference', payment_order.provider_reference,
        'reconciliationStatus', payment_order.reconciliation_status,
        'reconciliationAttempts', payment_order.reconciliation_attempts,
        'lastReconciliationError', payment_order.last_reconciliation_error,
        'refundAmount', coalesce(refunds.refund_amount, 0),
        'refundInvoiceAmount', coalesce(refunds.refund_invoice_amount, 0),
        'refundStatus', refunds.refund_status,
        'disputeStatus', disputes.dispute_status,
        'exception', case
          when payment_order.reconciliation_status = 'failed' then coalesce(payment_order.last_reconciliation_error, 'Reconciliation failed')
          when failed_event.processing_error is not null then failed_event.processing_error
          when settlement.status = 'failed' then 'Settlement failed'
          when refunds.refund_status in ('failed', 'needs_attention') then 'Refund needs attention'
          when refunds.refund_status in ('requested', 'processing') and refunds.latest_refund_at < now() - interval '30 minutes' then 'Refund confirmation is delayed'
          when disputes.dispute_status in ('open', 'under_review') then 'Open dispute'
          when payment_order.status in ('awaiting_authorization', 'processing') and payment_order.submitted_at < now() - interval '10 minutes' then 'Payment confirmation is delayed'
          else null end
      ) as row_data
    from public.zania_pay_orders payment_order
    join public.commercial_documents invoice on invoice.id = payment_order.invoice_id
    left join public.profiles payer on payer.id = payment_order.payer_user_id
    left join public.profiles professional on professional.id = payment_order.professional_user_id
    left join public.zania_pay_accounts account on account.id = payment_order.professional_account_id
    left join public.vendor_listings vendor on vendor.id = account.vendor_listing_id
    left join public.zania_pay_settlements settlement on settlement.order_id = payment_order.id
    left join lateral (
      select sum(refund.amount) filter (where refund.status = 'paid') as refund_amount,
        sum(refund.invoice_amount) filter (where refund.status = 'paid') as refund_invoice_amount,
        (array_agg(refund.status order by refund.created_at desc))[1] as refund_status,
        max(refund.created_at) as latest_refund_at
      from public.zania_pay_refunds refund where refund.order_id = payment_order.id
    ) refunds on true
    left join lateral (
      select (array_agg(dispute.status order by dispute.created_at desc))[1] as dispute_status
      from public.zania_pay_disputes dispute where dispute.order_id = payment_order.id
    ) disputes on true
    left join lateral (
      select event.processing_error from public.zania_pay_provider_events event
      where event.provider_reference = payment_order.provider_reference and event.processing_status = 'failed'
      order by event.received_at desc limit 1
    ) failed_event on true
    order by payment_order.created_at desc
    limit least(greatest(coalesce(_limit, 100), 1), 250)
  ) ledger;
  return result;
end;
$$;

revoke execute on function public.claim_zania_pay_reconciliation_batch(integer) from public, anon, authenticated;
revoke execute on function public.finish_zania_pay_reconciliation(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.claim_zania_pay_refund(uuid) from public, anon, authenticated;
revoke execute on function public.finish_zania_pay_refund_request(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.fail_zania_pay_refund_request(uuid, text) from public, anon, authenticated;
revoke execute on function public.apply_zania_pay_refund_event(text, text, text, numeric) from public, anon, authenticated;
revoke execute on function public.apply_zania_pay_dispute_event(text, text, text, text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.claim_zania_pay_reconciliation_batch(integer) to service_role;
grant execute on function public.finish_zania_pay_reconciliation(uuid, text, text) to service_role;
grant execute on function public.claim_zania_pay_refund(uuid) to service_role;
grant execute on function public.finish_zania_pay_refund_request(uuid, text, text, text) to service_role;
grant execute on function public.fail_zania_pay_refund_request(uuid, text) to service_role;
grant execute on function public.apply_zania_pay_refund_event(text, text, text, numeric) to service_role;
grant execute on function public.apply_zania_pay_dispute_event(text, text, text, text, timestamptz, jsonb) to service_role;

revoke execute on function public.admin_request_zania_pay_refund(uuid, numeric, text, text) from public, anon;
revoke execute on function public.admin_list_zania_pay_ledger(integer) from public, anon;
grant execute on function public.admin_request_zania_pay_refund(uuid, numeric, text, text) to authenticated;
grant execute on function public.admin_list_zania_pay_ledger(integer) to authenticated;

comment on function public.claim_zania_pay_reconciliation_batch(integer) is
  'Internal worker claim. Callable only with the Supabase service role.';
comment on function public.admin_request_zania_pay_refund(uuid, numeric, text, text) is
  'Creates an idempotent admin-approved refund. Full invoice refunds also reverse the KES 50 Zania fee; provider processing fees are not automatically refunded.';

do $$
begin
  if exists (select 1 from vault.decrypted_secrets where name = 'zania_project_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'zania_anon_key')
    and exists (select 1 from vault.decrypted_secrets where name = 'zania_pay_reconciliation_token') then
    perform cron.schedule(
      'reconcile-zania-pay-orders',
      '*/5 * * * *',
      $job$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'zania_project_url')
            || '/functions/v1/zania-pay-operations',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'zania_anon_key'),
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'zania_anon_key'),
            'x-zania-reconcile-token', (select decrypted_secret from vault.decrypted_secrets where name = 'zania_pay_reconciliation_token')
          ),
          body := jsonb_build_object('action', 'reconcile', 'source', 'cron', 'requestedAt', now()),
          timeout_milliseconds := 20000
        );
      $job$
    );
  end if;
end;
$$;
