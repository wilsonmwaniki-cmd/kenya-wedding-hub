-- Avoid PL/pgSQL variable/column ambiguity while preserving the flat service
-- fee around the fee-free finalizer used by historical Zania Pay orders.

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
  finalization_result jsonb;
  resolved_order_id uuid;
  resolved_receipt_id uuid;
  resolved_service_fee numeric(12,2);
  resolved_total_charged numeric(12,2);
begin
  select payment_order.zania_fee
    into resolved_service_fee
  from public.zania_pay_orders payment_order
  where payment_order.provider = _provider
    and payment_order.provider_reference = _provider_reference;

  if resolved_service_fee is null then
    raise exception 'Payment order not found';
  end if;

  finalization_result := public.finalize_zania_pay_order_without_service_fee(
    _provider,
    _provider_reference,
    _amount,
    _provider_fee,
    _paid_at
  );

  resolved_order_id := nullif(finalization_result ->> 'orderId', '')::uuid;

  update public.zania_pay_orders payment_order
  set zania_fee = resolved_service_fee,
      updated_at = now()
  where payment_order.id = resolved_order_id
  returning payment_order.charge_amount into resolved_total_charged;

  update public.zania_pay_settlements settlement
  set zania_fee = resolved_service_fee,
      charge_amount = resolved_total_charged,
      updated_at = now()
  where settlement.order_id = resolved_order_id;

  resolved_receipt_id := nullif(finalization_result ->> 'receiptId', '')::uuid;
  if resolved_receipt_id is null then
    select receipt.id into resolved_receipt_id
    from public.commercial_documents receipt
    where receipt.document_type = 'receipt'
      and receipt.metadata ->> 'zania_pay_order_id' = resolved_order_id::text
    limit 1;
  end if;

  if resolved_receipt_id is not null then
    update public.commercial_documents receipt
    set metadata = receipt.metadata || jsonb_build_object(
          'zania_service_fee', resolved_service_fee,
          'total_charged', resolved_total_charged,
          'fee_bearer', 'payer'
        ),
        updated_at = now()
    where receipt.id = resolved_receipt_id;
  end if;

  return finalization_result || jsonb_build_object(
    'receiptId', resolved_receipt_id,
    'zaniaServiceFee', resolved_service_fee,
    'totalCharged', resolved_total_charged,
    'professionalSettlement', (
      select payment_order.amount
      from public.zania_pay_orders payment_order
      where payment_order.id = resolved_order_id
    )
  );
end;
$$;

revoke execute on function public.finalize_zania_pay_order(text, text, numeric, numeric, timestamptz)
  from public, anon, authenticated;
grant execute on function public.finalize_zania_pay_order(text, text, numeric, numeric, timestamptz)
  to service_role;
