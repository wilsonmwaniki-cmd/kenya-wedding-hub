create or replace function public.issue_receipt_from_payment(
  _document_id uuid,
  _payment_id uuid
)
returns public.commercial_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  _invoice public.commercial_documents%rowtype;
  _payment public.commercial_document_payments%rowtype;
  _receipt public.commercial_documents%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into _invoice
  from public.commercial_documents
  where id = _document_id and user_id = auth.uid()
  limit 1;

  if _invoice.id is null then
    raise exception 'Invoice not found';
  end if;

  if _invoice.document_type <> 'invoice' then
    raise exception 'Receipts can only be issued from invoices';
  end if;

  select * into _payment
  from public.commercial_document_payments
  where id = _payment_id and document_id = _document_id
  limit 1;

  if _payment.id is null then
    raise exception 'Payment not found';
  end if;

  select * into _receipt
  from public.commercial_documents
  where user_id = auth.uid()
    and document_type = 'receipt'
    and metadata ->> 'source_payment_id' = _payment.id::text
  limit 1;

  if _receipt.id is not null then
    return _receipt;
  end if;

  insert into public.commercial_documents (
    user_id, role, document_type, document_number, title, status, currency,
    recipient_name, recipient_email, recipient_phone, wedding_name,
    client_id, vendor_listing_id, vendor_id, quote_source_id,
    subtotal, discount_amount, tax_amount, total_amount, amount_paid, balance_due,
    issue_date, due_date, paid_date, notes, terms, metadata
  )
  values (
    _invoice.user_id,
    _invoice.role,
    'receipt',
    public.generate_next_commercial_document_number(_invoice.user_id, 'receipt', _payment.payment_date),
    'Receipt for ' || _invoice.title,
    'issued',
    _invoice.currency,
    _invoice.recipient_name,
    _invoice.recipient_email,
    _invoice.recipient_phone,
    _invoice.wedding_name,
    _invoice.client_id,
    _invoice.vendor_listing_id,
    _invoice.vendor_id,
    _invoice.id,
    _payment.amount,
    0,
    0,
    _payment.amount,
    _payment.amount,
    0,
    _payment.payment_date,
    null,
    _payment.payment_date,
    _payment.notes,
    null,
    jsonb_strip_nulls(jsonb_build_object(
      'source_invoice_id', _invoice.id,
      'source_invoice_number', _invoice.document_number,
      'source_invoice_title', _invoice.title,
      'source_invoice_total', _invoice.total_amount,
      'source_payment_id', _payment.id,
      'payment_method', _payment.payment_method,
      'payment_reference', nullif(trim(_payment.reference), ''),
      'authorisedBy', nullif(trim(_invoice.metadata ->> 'authorisedBy'), '')
    ))
  )
  returning * into _receipt;

  insert into public.commercial_document_items (
    document_id, sort_order, description, quantity, unit_price, line_total, metadata
  ) values (
    _receipt.id,
    0,
    'Payment toward ' || _invoice.document_number || ' · ' || _invoice.title,
    1,
    _payment.amount,
    _payment.amount,
    jsonb_build_object('source_invoice_id', _invoice.id, 'source_payment_id', _payment.id)
  );

  return _receipt;
end;
$$;

revoke execute on function public.issue_receipt_from_payment(uuid, uuid) from public;
revoke execute on function public.issue_receipt_from_payment(uuid, uuid) from anon;
grant execute on function public.issue_receipt_from_payment(uuid, uuid) to authenticated;
