-- Make payment-provider fees payer-borne while keeping the professional's
-- invoice settlement whole. Zania continues to charge no transaction fee.

alter table public.zania_pay_orders
  add column if not exists payer_processing_fee numeric(12,2) not null default 0
    check (payer_processing_fee >= 0),
  add column if not exists charge_amount numeric(12,2) generated always as
    (round(amount + payer_processing_fee, 2)) stored,
  add column if not exists fee_bearer text not null default 'payer'
    check (fee_bearer = 'payer');

alter table public.zania_pay_settlements
  add column if not exists payer_processing_fee numeric(12,2) not null default 0
    check (payer_processing_fee >= 0),
  add column if not exists charge_amount numeric(12,2) null
    check (charge_amount is null or charge_amount > 0),
  add column if not exists fee_bearer text not null default 'payer'
    check (fee_bearer = 'payer');

create or replace function public.finalize_zania_pay_order(
  _provider text,
  _provider_reference text,
  _amount numeric,
  _provider_fee numeric default 0,
  _paid_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_order public.zania_pay_orders%rowtype;
  invoice_record public.commercial_documents%rowtype;
  payment_record public.commercial_document_payments%rowtype;
  receipt_record public.commercial_documents%rowtype;
  settlement_record public.zania_pay_settlements%rowtype;
  linked_budget_payment_id uuid;
  resolved_fee numeric(12,2) := greatest(coalesce(_provider_fee, 0), 0);
begin
  select * into payment_order
  from public.zania_pay_orders
  where provider = _provider
    and provider_reference = _provider_reference
  for update;

  if payment_order.id is null then
    raise exception 'Payment order not found';
  end if;

  if payment_order.status = 'paid' then
    select * into payment_record
    from public.commercial_document_payments
    where zania_pay_order_id = payment_order.id;

    return jsonb_build_object(
      'orderId', payment_order.id,
      'paymentId', payment_record.id,
      'status', 'paid',
      'alreadyFinalized', true
    );
  end if;

  if payment_order.status in ('expired', 'cancelled', 'refunded') then
    raise exception 'Payment order is no longer payable';
  end if;

  if _amount is null or round(_amount, 2) <> round(payment_order.charge_amount, 2) then
    raise exception 'Payment amount does not match the order';
  end if;

  select * into invoice_record
  from public.commercial_documents
  where id = payment_order.invoice_id
  for update;

  if invoice_record.id is null
     or invoice_record.document_type <> 'invoice'
     or invoice_record.status not in ('sent', 'part_paid') then
    raise exception 'Invoice is not payable';
  end if;

  if invoice_record.balance_due < payment_order.amount then
    raise exception 'Payment exceeds the remaining invoice balance';
  end if;

  linked_budget_payment_id := public.sync_zania_pay_payment_to_budget(
    invoice_record.id,
    payment_order.amount,
    coalesce(_paid_at, now())::date,
    _provider_reference,
    'Paid through Zania'
  );

  insert into public.commercial_document_payments (
    document_id, amount, payment_date, payment_method, reference, notes,
    recorded_by, source, zania_pay_order_id, provider_reference, confirmed_at,
    budget_payment_id
  ) values (
    invoice_record.id,
    payment_order.amount,
    coalesce(_paid_at, now())::date,
    payment_order.payment_method,
    _provider_reference,
    'Paid through Zania',
    payment_order.professional_user_id,
    case when payment_order.mode = 'live' then 'zania_pay' else 'zania_pay_sandbox' end,
    payment_order.id,
    _provider_reference,
    coalesce(_paid_at, now()),
    linked_budget_payment_id
  )
  on conflict (zania_pay_order_id) where zania_pay_order_id is not null
  do update set confirmed_at = coalesce(public.commercial_document_payments.confirmed_at, excluded.confirmed_at)
  returning * into payment_record;

  perform public.recalculate_commercial_document_totals(invoice_record.id);

  update public.zania_pay_orders
  set
    status = 'paid',
    provider_fee = resolved_fee,
    zania_fee = 0,
    net_settlement = payment_order.amount,
    paid_at = coalesce(_paid_at, now()),
    failure_code = null,
    failure_message = null,
    updated_at = now()
  where id = payment_order.id
  returning * into payment_order;

  insert into public.zania_pay_settlements (
    order_id, professional_user_id, gross_amount, provider_fee, zania_fee,
    net_amount, currency, status, payer_processing_fee, charge_amount, fee_bearer
  ) values (
    payment_order.id,
    payment_order.professional_user_id,
    payment_order.amount,
    resolved_fee,
    0,
    payment_order.amount,
    payment_order.currency,
    'pending',
    payment_order.payer_processing_fee,
    payment_order.charge_amount,
    'payer'
  )
  on conflict (order_id) do update set
    provider_fee = excluded.provider_fee,
    net_amount = excluded.net_amount,
    payer_processing_fee = excluded.payer_processing_fee,
    charge_amount = excluded.charge_amount,
    fee_bearer = excluded.fee_bearer,
    updated_at = now()
  returning * into settlement_record;

  select * into receipt_record
  from public.commercial_documents
  where user_id = invoice_record.user_id
    and document_type = 'receipt'
    and metadata ->> 'source_payment_id' = payment_record.id::text
  limit 1;

  if receipt_record.id is null then
    insert into public.commercial_documents (
      user_id, role, document_type, document_number, title, status, currency,
      recipient_name, recipient_email, recipient_phone, wedding_name,
      client_id, vendor_listing_id, vendor_id, quote_source_id,
      subtotal, discount_amount, tax_amount, total_amount, amount_paid, balance_due,
      issue_date, due_date, paid_date, notes, terms, metadata
    ) values (
      invoice_record.user_id,
      invoice_record.role,
      'receipt',
      public.generate_next_commercial_document_number(invoice_record.user_id, 'receipt', payment_record.payment_date),
      'Receipt for ' || invoice_record.title,
      'issued',
      invoice_record.currency,
      invoice_record.recipient_name,
      invoice_record.recipient_email,
      invoice_record.recipient_phone,
      invoice_record.wedding_name,
      invoice_record.client_id,
      invoice_record.vendor_listing_id,
      invoice_record.vendor_id,
      invoice_record.id,
      payment_record.amount,
      0,
      0,
      payment_record.amount,
      payment_record.amount,
      0,
      payment_record.payment_date,
      null,
      payment_record.payment_date,
      'Paid through Zania',
      null,
      jsonb_strip_nulls(jsonb_build_object(
        'source_invoice_id', invoice_record.id,
        'source_invoice_number', invoice_record.document_number,
        'source_invoice_title', invoice_record.title,
        'source_invoice_total', invoice_record.total_amount,
        'source_payment_id', payment_record.id,
        'payment_method', payment_record.payment_method,
        'payment_reference', _provider_reference,
        'zania_pay_order_id', payment_order.id,
        'invoice_payment_amount', payment_order.amount,
        'payer_processing_fee', payment_order.payer_processing_fee,
        'total_charged', payment_order.charge_amount,
        'fee_bearer', 'payer',
        'authorisedBy', nullif(trim(invoice_record.metadata ->> 'authorisedBy'), '')
      ))
    ) returning * into receipt_record;

    insert into public.commercial_document_items (
      document_id, sort_order, description, quantity, unit_price, line_total, metadata
    ) values (
      receipt_record.id,
      0,
      'Payment toward ' || invoice_record.document_number || ' · ' || invoice_record.title,
      1,
      payment_record.amount,
      payment_record.amount,
      jsonb_build_object(
        'source_invoice_id', invoice_record.id,
        'source_payment_id', payment_record.id,
        'zania_pay_order_id', payment_order.id
      )
    );
  end if;

  return jsonb_build_object(
    'orderId', payment_order.id,
    'paymentId', payment_record.id,
    'receiptId', receipt_record.id,
    'settlementId', settlement_record.id,
    'invoicePaymentAmount', payment_order.amount,
    'processingFee', payment_order.payer_processing_fee,
    'totalCharged', payment_order.charge_amount,
    'professionalSettlement', payment_order.amount,
    'status', 'paid',
    'alreadyFinalized', false
  );
end;
$$;

revoke execute on function public.finalize_zania_pay_order(text, text, numeric, numeric, timestamptz)
  from public, anon, authenticated;
grant execute on function public.finalize_zania_pay_order(text, text, numeric, numeric, timestamptz)
  to service_role;
