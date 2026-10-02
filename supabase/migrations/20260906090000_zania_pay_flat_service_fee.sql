-- Charge a transparent, payer-borne KES 50 Zania service fee on each
-- successful Zania Pay transaction. Historical fee-free orders retain zero.

alter function public.finalize_zania_pay_order(text, text, numeric, numeric, timestamptz)
  rename to finalize_zania_pay_order_without_service_fee;

alter table public.zania_pay_orders
  drop constraint if exists zania_pay_orders_zania_fee_check;

alter table public.zania_pay_orders
  alter column zania_fee set default 50,
  add constraint zania_pay_orders_zania_fee_check
    check (zania_fee in (0, 50));

alter table public.zania_pay_settlements
  drop constraint if exists zania_pay_settlements_zania_fee_check;

alter table public.zania_pay_settlements
  add constraint zania_pay_settlements_zania_fee_check
    check (zania_fee in (0, 50));

alter table public.zania_pay_orders
  drop column charge_amount;

alter table public.zania_pay_orders
  add column charge_amount numeric(12,2) generated always as
    (round(amount + payer_processing_fee + zania_fee, 2)) stored;

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

  if _amount is null or _amount > invoice_record.balance_due then
    raise exception 'Enter an amount up to the remaining balance';
  end if;

  if _amount < 1000 then
    raise exception 'Zania Pay payments start at KES 1,000.';
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
    zania_fee,
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
    50,
    eligibility,
    now() + interval '15 minutes'
  )
  returning * into created_order;

  return created_order;
end;
$$;

revoke execute on function public.create_zania_pay_order(uuid, numeric, text, text)
  from public, anon;
grant execute on function public.create_zania_pay_order(uuid, numeric, text, text)
  to authenticated;

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
  result jsonb;
  order_id uuid;
  receipt_id uuid;
  service_fee numeric(12,2);
  total_charged numeric(12,2);
begin
  select payment_order.zania_fee
    into service_fee
  from public.zania_pay_orders payment_order
  where payment_order.provider = _provider
    and payment_order.provider_reference = _provider_reference;

  if service_fee is null then
    raise exception 'Payment order not found';
  end if;

  result := public.finalize_zania_pay_order_without_service_fee(
    _provider,
    _provider_reference,
    _amount,
    _provider_fee,
    _paid_at
  );

  order_id := nullif(result ->> 'orderId', '')::uuid;

  update public.zania_pay_orders payment_order
  set zania_fee = service_fee,
      updated_at = now()
  where payment_order.id = order_id
  returning payment_order.charge_amount into total_charged;

  update public.zania_pay_settlements settlement
  set zania_fee = service_fee,
      charge_amount = total_charged,
      updated_at = now()
  where settlement.order_id = order_id;

  receipt_id := nullif(result ->> 'receiptId', '')::uuid;
  if receipt_id is null then
    select receipt.id into receipt_id
    from public.commercial_documents receipt
    where receipt.document_type = 'receipt'
      and receipt.metadata ->> 'zania_pay_order_id' = order_id::text
    limit 1;
  end if;

  if receipt_id is not null then
    update public.commercial_documents receipt
    set metadata = receipt.metadata || jsonb_build_object(
          'zania_service_fee', service_fee,
          'total_charged', total_charged,
          'fee_bearer', 'payer'
        ),
        updated_at = now()
    where receipt.id = receipt_id;
  end if;

  return result || jsonb_build_object(
    'receiptId', receipt_id,
    'zaniaServiceFee', service_fee,
    'totalCharged', total_charged,
    'professionalSettlement', (select amount from public.zania_pay_orders where id = order_id)
  );
end;
$$;

revoke execute on function public.finalize_zania_pay_order_without_service_fee(text, text, numeric, numeric, timestamptz)
  from public, anon, authenticated;
grant execute on function public.finalize_zania_pay_order_without_service_fee(text, text, numeric, numeric, timestamptz)
  to service_role;

revoke execute on function public.finalize_zania_pay_order(text, text, numeric, numeric, timestamptz)
  from public, anon, authenticated;
grant execute on function public.finalize_zania_pay_order(text, text, numeric, numeric, timestamptz)
  to service_role;

create or replace function public.get_shared_commercial_document_v2(_share_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _document jsonb;
  _metadata jsonb;
begin
  _document := public.get_shared_commercial_document(_share_token);

  if _document is null then
    return null;
  end if;

  select coalesce(cd.metadata, '{}'::jsonb)
    into _metadata
  from public.commercial_documents cd
  where cd.id = (_document ->> 'id')::uuid;

  return _document || jsonb_build_object(
    'paymentInstructions', nullif(trim(_metadata ->> 'paymentInstructions'), ''),
    'authorisedBy', nullif(trim(_metadata ->> 'authorisedBy'), ''),
    'sourceInvoiceNumber', nullif(trim(_metadata ->> 'source_invoice_number'), ''),
    'sourceInvoiceTitle', nullif(trim(_metadata ->> 'source_invoice_title'), ''),
    'receiptPaymentMethod', nullif(trim(_metadata ->> 'payment_method'), ''),
    'receiptPaymentReference', nullif(trim(_metadata ->> 'payment_reference'), ''),
    'receiptProcessingFee', coalesce(nullif(_metadata ->> 'payer_processing_fee', '')::numeric, 0),
    'receiptZaniaServiceFee', coalesce(nullif(_metadata ->> 'zania_service_fee', '')::numeric, 0),
    'receiptTotalCharged', coalesce(nullif(_metadata ->> 'total_charged', '')::numeric, 0)
  );
end;
$$;

revoke execute on function public.get_shared_commercial_document_v2(uuid)
  from public, anon, authenticated;
grant execute on function public.get_shared_commercial_document_v2(uuid)
  to anon, authenticated;

comment on column public.zania_pay_orders.zania_fee is
  'Flat payer-borne Zania service fee. Zero is retained only for historical fee-free orders.';
