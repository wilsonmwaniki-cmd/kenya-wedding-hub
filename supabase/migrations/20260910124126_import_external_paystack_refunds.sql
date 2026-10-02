-- Import refunds initiated in Paystack so their webhooks remain auditable in Zania.

create unique index if not exists zania_pay_refunds_provider_refund_id_unique
  on public.zania_pay_refunds(provider_refund_id)
  where provider_refund_id is not null;

create or replace function public.apply_zania_pay_refund_event(
  _transaction_reference text,
  _refund_reference text,
  _provider_status text,
  _amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_order public.zania_pay_orders%rowtype;
  refund_record public.zania_pay_refunds%rowtype;
  payment_record public.commercial_document_payments%rowtype;
  budget_record public.budget_payments%rowtype;
  refunded_invoice numeric(12,2);
  remaining_paid numeric(12,2);
  previous_refunded numeric(12,2) := 0;
  refund_delta numeric(12,2) := 0;
  reserved_invoice numeric(12,2) := 0;
  reserved_zania_fee numeric(12,2) := 0;
  reserved_total numeric(12,2) := 0;
  imported_invoice_amount numeric(12,2) := 0;
  imported_zania_fee numeric(12,2) := 0;
  imported_provider_fee numeric(12,2) := 0;
  mapped_status text;
begin
  select * into payment_order from public.zania_pay_orders
  where provider = 'paystack' and provider_reference = _transaction_reference for update;
  if payment_order.id is null then raise exception 'Refund payment order not found'; end if;

  mapped_status := case lower(coalesce(_provider_status, ''))
    when 'processed' then 'paid'
    when 'failed' then 'failed'
    when 'needs-attention' then 'needs_attention'
    else 'processing'
  end;

  select * into refund_record from public.zania_pay_refunds
  where order_id = payment_order.id
    and (provider_refund_id = _refund_reference or provider_refund_id is null)
    and status in ('requested', 'processing', 'needs_attention', 'failed', 'paid')
  order by (provider_refund_id = _refund_reference) desc, created_at
  limit 1 for update;

  if refund_record.id is null then
    if nullif(trim(_refund_reference), '') is null then
      raise exception 'Paystack refund reference is required';
    end if;
    if _amount is null or _amount <= 0 then
      raise exception 'Paystack refund amount is required';
    end if;

    select coalesce(sum(refund.invoice_amount), 0),
           coalesce(sum(refund.zania_fee_amount), 0),
           coalesce(sum(refund.amount), 0)
      into reserved_invoice, reserved_zania_fee, reserved_total
    from public.zania_pay_refunds refund
    where refund.order_id = payment_order.id
      and refund.status in ('requested', 'processing', 'needs_attention', 'paid');

    if round(_amount, 2) > round(greatest(payment_order.charge_amount - reserved_total, 0), 2) then
      raise exception 'Paystack refund exceeds the remaining refundable charge';
    end if;

    imported_invoice_amount := least(
      round(_amount, 2),
      greatest(payment_order.amount - reserved_invoice, 0)
    );
    if imported_invoice_amount <= 0 then
      raise exception 'Paystack refund has no remaining invoice amount to reverse';
    end if;
    imported_zania_fee := least(
      greatest(round(_amount, 2) - imported_invoice_amount, 0),
      greatest(payment_order.zania_fee - reserved_zania_fee, 0)
    );
    imported_provider_fee := greatest(
      round(_amount, 2) - imported_invoice_amount - imported_zania_fee,
      0
    );

    insert into public.zania_pay_refunds (
      order_id,
      amount,
      invoice_amount,
      provider_fee_amount,
      zania_fee_amount,
      reason,
      requested_by,
      provider_reference,
      provider_refund_id,
      provider_status,
      status,
      initiated_at,
      idempotency_key
    ) values (
      payment_order.id,
      round(_amount, 2),
      imported_invoice_amount,
      imported_provider_fee,
      imported_zania_fee,
      'Imported from Paystack dashboard',
      null,
      _transaction_reference,
      trim(_refund_reference),
      _provider_status,
      mapped_status,
      now(),
      'paystack-dashboard-refund:' || trim(_refund_reference)
    ) returning * into refund_record;
  end if;

  if _amount is not null and _amount > 0 and round(_amount, 2) <> round(refund_record.amount, 2) then
    raise exception 'Refund amount does not match the approved request';
  end if;

  update public.zania_pay_refunds
  set provider_refund_id = coalesce(nullif(trim(_refund_reference), ''), provider_refund_id),
      provider_status = _provider_status,
      status = mapped_status,
      completed_at = case when mapped_status = 'paid' then coalesce(completed_at, now()) else completed_at end,
      failure_message = case when mapped_status = 'failed' then 'Paystack could not process this refund.' else null end,
      next_reconciliation_at = case when mapped_status = 'processing' then now() + interval '1 minute' else null end,
      updated_at = now()
  where id = refund_record.id;

  if mapped_status <> 'paid' then return; end if;

  select coalesce(sum(refund.invoice_amount), 0) into refunded_invoice
  from public.zania_pay_refunds refund
  where refund.order_id = payment_order.id and refund.status = 'paid';
  remaining_paid := greatest(payment_order.amount - refunded_invoice, 0);

  select * into payment_record
  from public.commercial_document_payments payment
  where payment.zania_pay_order_id = payment_order.id
  for update;

  if payment_record.id is not null then
    previous_refunded := payment_record.refunded_amount;
    refund_delta := greatest(refunded_invoice - previous_refunded, 0);
    update public.commercial_document_payments
    set refunded_amount = least(refunded_invoice, amount),
        notes = case
          when refund_delta > 0 then concat_ws(E'\n', nullif(notes, ''), 'Refunded through Zania Pay')
          else notes
        end,
        updated_at = now()
    where id = payment_record.id;
  end if;

  update public.zania_pay_orders
  set status = case when remaining_paid = 0 then 'refunded' else 'part_refunded' end,
      net_settlement = remaining_paid,
      updated_at = now()
  where id = payment_order.id;

  update public.zania_pay_settlements
  set net_amount = remaining_paid,
      status = case when remaining_paid = 0 then 'reversed' else 'part_reversed' end,
      updated_at = now()
  where order_id = payment_order.id;

  perform public.recalculate_commercial_document_totals(payment_order.invoice_id);

  if payment_record.budget_payment_id is not null and refund_delta > 0 then
    select * into budget_record
    from public.budget_payments
    where id = payment_record.budget_payment_id for update;
    if budget_record.id is not null then
      update public.budget_payments
      set amount = greatest(amount - refund_delta, 0),
          notes = concat_ws(E'\n', nullif(notes, ''), 'Refunded through Zania Pay')
      where id = budget_record.id;
      update public.budget_categories
      set spent = greatest(coalesce(spent, 0) - refund_delta, 0)
      where id = budget_record.budget_category_id;
      update public.vendors vendor
      set amount_paid = greatest(coalesce(vendor.amount_paid, 0) - refund_delta, 0),
          payment_status = case
            when greatest(coalesce(vendor.amount_paid, 0) - refund_delta, 0) = 0 then 'unpaid'
            when vendor.price is not null and greatest(coalesce(vendor.amount_paid, 0) - refund_delta, 0) >= vendor.price then 'paid_full'
            else 'part_paid'
          end
      where vendor.id = budget_record.vendor_id;
    end if;
  end if;

  update public.commercial_documents receipt
  set status = case when remaining_paid = 0 then 'void' else receipt.status end,
      notes = case
        when coalesce((receipt.metadata ->> 'refunded_amount')::numeric, 0) <> refunded_invoice
          then concat_ws(E'\n', nullif(receipt.notes, ''),
            'Refunded KES ' || to_char(refunded_invoice, 'FM999,999,999,990.00') || ' through Zania Pay')
        else receipt.notes
      end,
      metadata = receipt.metadata || jsonb_build_object(
        'refund_status', case when remaining_paid = 0 then 'refunded' else 'part_refunded' end,
        'refunded_amount', refunded_invoice,
        'net_received_amount', remaining_paid,
        'refunded_at', now()
      ),
      updated_at = now()
  where receipt.document_type = 'receipt'
    and receipt.metadata ->> 'zania_pay_order_id' = payment_order.id::text;
end;
$$;

revoke execute on function public.apply_zania_pay_refund_event(text, text, text, numeric)
  from public, anon, authenticated;
grant execute on function public.apply_zania_pay_refund_event(text, text, text, numeric)
  to service_role;

comment on function public.apply_zania_pay_refund_event(text, text, text, numeric) is
  'Applies Paystack refund webhooks and imports refunds initiated directly in Paystack. Service role only.';
