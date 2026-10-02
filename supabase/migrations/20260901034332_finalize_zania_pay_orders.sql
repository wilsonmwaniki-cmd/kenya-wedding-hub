create or replace function public.record_zania_pay_provider_event(
  _provider text,
  _provider_event_id text,
  _event_type text,
  _provider_reference text,
  _payload_hash text,
  _payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id uuid;
begin
  insert into public.zania_pay_provider_events (
    provider,
    provider_event_id,
    event_type,
    provider_reference,
    payload_hash,
    payload
  ) values (
    _provider,
    _provider_event_id,
    _event_type,
    _provider_reference,
    _payload_hash,
    _payload
  )
  on conflict (provider, provider_event_id) do nothing
  returning id into inserted_id;

  return inserted_id is not null;
end;
$$;

create or replace function public.sync_zania_pay_payment_to_budget(
  _document_id uuid,
  _amount numeric,
  _payment_date date default current_date,
  _reference text default null,
  _notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_record public.commercial_documents%rowtype;
  vendor_record public.vendors%rowtype;
  category_record public.budget_categories%rowtype;
  budget_payment_record public.budget_payments%rowtype;
  category_name text;
  contract_amount numeric;
  next_amount_paid numeric;
  next_status text;
  owns_listing boolean := false;
begin
  select * into invoice_record
  from public.commercial_documents
  where id = _document_id
  limit 1;

  if invoice_record.id is null
     or invoice_record.role <> 'vendor'
     or invoice_record.vendor_id is null then
    return null;
  end if;

  select * into vendor_record
  from public.vendors
  where id = invoice_record.vendor_id
  for update;

  if vendor_record.id is null then
    return null;
  end if;

  select exists(
    select 1
    from public.vendor_listings listing
    where listing.user_id = invoice_record.user_id
      and listing.id = coalesce(vendor_record.vendor_listing_id, invoice_record.vendor_listing_id)
  ) into owns_listing;

  if not owns_listing then
    return null;
  end if;

  category_name := coalesce(
    nullif(trim(vendor_record.category), ''),
    nullif(trim(invoice_record.title), ''),
    'Vendor'
  );

  select * into category_record
  from public.budget_categories
  where user_id = vendor_record.user_id
    and budget_scope = 'wedding'
    and lower(name) = lower(category_name)
    and client_id is not distinct from vendor_record.client_id
    and wedding_id is not distinct from vendor_record.wedding_id
  order by created_at asc
  limit 1
  for update;

  if category_record.id is null then
    insert into public.budget_categories (
      user_id, client_id, wedding_id, name, allocated, spent, budget_scope,
      visibility, committee_role_in_charge, contract_status
    ) values (
      vendor_record.user_id,
      vendor_record.client_id,
      vendor_record.wedding_id,
      category_name,
      coalesce(vendor_record.price, invoice_record.total_amount, 0),
      0,
      'wedding',
      'public',
      coalesce(vendor_record.committee_role_in_charge, 'unassigned'),
      coalesce(vendor_record.contract_status, 'not_started')
    ) returning * into category_record;
  end if;

  insert into public.budget_payments (
    user_id, client_id, wedding_id, budget_category_id, vendor_id, budget_scope,
    category_name, payee_name, amount, payment_date, reference, notes
  ) values (
    vendor_record.user_id,
    vendor_record.client_id,
    vendor_record.wedding_id,
    category_record.id,
    vendor_record.id,
    'wedding',
    category_name,
    coalesce(nullif(trim(vendor_record.name), ''), invoice_record.recipient_name),
    _amount,
    coalesce(_payment_date, current_date),
    _reference,
    _notes
  ) returning * into budget_payment_record;

  update public.budget_categories
  set spent = coalesce(spent, 0) + _amount
  where id = category_record.id;

  next_amount_paid := coalesce(vendor_record.amount_paid, 0) + _amount;
  contract_amount := coalesce(vendor_record.price, invoice_record.total_amount, 0);
  next_status := case
    when contract_amount > 0 and next_amount_paid >= contract_amount then 'paid_full'
    when next_amount_paid > 0 then 'part_paid'
    else coalesce(vendor_record.payment_status, 'unpaid')
  end;

  update public.vendors
  set
    amount_paid = next_amount_paid,
    payment_status = next_status,
    last_payment_at = coalesce(_payment_date, current_date)::timestamptz
  where id = vendor_record.id;

  return budget_payment_record.id;
end;
$$;

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

  if _amount is null or round(_amount, 2) <> round(payment_order.amount, 2) then
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
    document_id,
    amount,
    payment_date,
    payment_method,
    reference,
    notes,
    recorded_by,
    source,
    zania_pay_order_id,
    provider_reference,
    confirmed_at,
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
    net_settlement = greatest(payment_order.amount - resolved_fee, 0),
    paid_at = coalesce(_paid_at, now()),
    failure_code = null,
    failure_message = null,
    updated_at = now()
  where id = payment_order.id
  returning * into payment_order;

  insert into public.zania_pay_settlements (
    order_id,
    professional_user_id,
    gross_amount,
    provider_fee,
    zania_fee,
    net_amount,
    currency,
    status
  ) values (
    payment_order.id,
    payment_order.professional_user_id,
    payment_order.amount,
    resolved_fee,
    0,
    greatest(payment_order.amount - resolved_fee, 0),
    payment_order.currency,
    'pending'
  )
  on conflict (order_id) do update set
    provider_fee = excluded.provider_fee,
    net_amount = excluded.net_amount,
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
    'status', 'paid',
    'alreadyFinalized', false
  );
end;
$$;

create or replace function public.fail_zania_pay_order(
  _provider text,
  _provider_reference text,
  _failure_code text,
  _failure_message text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.zania_pay_orders
  set
    status = 'failed',
    failed_at = now(),
    failure_code = nullif(trim(_failure_code), ''),
    failure_message = nullif(trim(_failure_message), ''),
    updated_at = now()
  where provider = _provider
    and provider_reference = _provider_reference
    and status in ('created', 'awaiting_authorization', 'processing');

  update public.zania_pay_attempts
  set
    status = 'failed',
    failure_code = nullif(trim(_failure_code), ''),
    failure_message = nullif(trim(_failure_message), ''),
    updated_at = now()
  where provider_reference = _provider_reference
    and status <> 'succeeded';

  return found;
end;
$$;

revoke execute on function public.record_zania_pay_provider_event(text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.sync_zania_pay_payment_to_budget(uuid, numeric, date, text, text) from public, anon, authenticated;
revoke execute on function public.finalize_zania_pay_order(text, text, numeric, numeric, timestamptz) from public, anon, authenticated;
revoke execute on function public.fail_zania_pay_order(text, text, text, text) from public, anon, authenticated;

grant execute on function public.record_zania_pay_provider_event(text, text, text, text, text, jsonb) to service_role;
grant execute on function public.sync_zania_pay_payment_to_budget(uuid, numeric, date, text, text) to service_role;
grant execute on function public.finalize_zania_pay_order(text, text, numeric, numeric, timestamptz) to service_role;
grant execute on function public.fail_zania_pay_order(text, text, text, text) to service_role;

notify pgrst, 'reload schema';
