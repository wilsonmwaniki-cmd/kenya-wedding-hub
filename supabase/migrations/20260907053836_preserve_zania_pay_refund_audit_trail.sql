-- Preserve original payment records while calculating invoices from their net,
-- post-refund value. Keep the generated receipt as an auditable record.

alter table public.commercial_document_payments
  add column if not exists refunded_amount numeric(12,2) not null default 0;

alter table public.commercial_document_payments
  drop constraint if exists commercial_document_payments_refunded_amount_check;
alter table public.commercial_document_payments
  add constraint commercial_document_payments_refunded_amount_check
  check (refunded_amount >= 0 and refunded_amount <= amount);

create or replace function public.recalculate_commercial_document_totals(
  _document_id uuid
)
returns public.commercial_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  _document public.commercial_documents%rowtype;
  _subtotal numeric(12,2);
  _amount_paid numeric(12,2);
  _next_status text;
begin
  select * into _document
  from public.commercial_documents
  where id = _document_id
  limit 1;

  if _document.id is null then raise exception 'Commercial document not found'; end if;

  select coalesce(sum(item.line_total), 0) into _subtotal
  from public.commercial_document_items item
  where item.document_id = _document_id;

  select coalesce(sum(payment.amount - payment.refunded_amount), 0) into _amount_paid
  from public.commercial_document_payments payment
  where payment.document_id = _document_id;

  _next_status := _document.status;
  if _document.document_type = 'invoice' and _document.status <> 'void' then
    if _amount_paid >= greatest(_subtotal - _document.discount_amount + _document.tax_amount, 0)
      and greatest(_subtotal - _document.discount_amount + _document.tax_amount, 0) > 0 then
      _next_status := 'paid';
    elsif _amount_paid > 0 then
      _next_status := 'part_paid';
    elsif _document.status not in ('draft', 'sent') then
      _next_status := 'sent';
    end if;
  end if;

  update public.commercial_documents
  set subtotal = _subtotal,
      total_amount = greatest(_subtotal - discount_amount + tax_amount, 0),
      amount_paid = _amount_paid,
      balance_due = greatest(greatest(_subtotal - discount_amount + tax_amount, 0) - _amount_paid, 0),
      paid_date = case
        when document_type = 'invoice' and _next_status = 'paid'
          then coalesce((select max(payment_date) from public.commercial_document_payments where document_id = _document_id), paid_date)
        when document_type = 'invoice' then null
        else paid_date
      end,
      status = _next_status,
      updated_at = now()
  where id = _document_id
  returning * into _document;

  return _document;
end;
$$;

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
  order by created_at limit 1 for update;
  if refund_record.id is null then raise exception 'Refund request not found'; end if;
  if _amount is not null and _amount > 0 and round(_amount, 2) <> round(refund_record.amount, 2) then
    raise exception 'Refund amount does not match the approved request';
  end if;

  update public.zania_pay_refunds
  set provider_refund_id = coalesce(nullif(trim(_refund_reference), ''), provider_refund_id),
      provider_status = _provider_status,
      status = mapped_status,
      completed_at = case when mapped_status = 'paid' then coalesce(completed_at, now()) else completed_at end,
      failure_message = case when mapped_status = 'failed' then 'Paystack could not process this refund.' else null end,
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
    select * into budget_record from public.budget_payments
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
