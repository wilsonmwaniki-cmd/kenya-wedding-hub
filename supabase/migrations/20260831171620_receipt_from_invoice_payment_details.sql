update public.commercial_documents receipt
set
  subtotal = payment.amount,
  discount_amount = 0,
  tax_amount = 0,
  total_amount = payment.amount,
  amount_paid = payment.amount,
  balance_due = 0,
  due_date = null,
  paid_date = payment.payment_date,
  issue_date = payment.payment_date,
  notes = payment.notes,
  terms = null,
  metadata = jsonb_strip_nulls(jsonb_build_object(
    'source_invoice_id', invoice.id,
    'source_invoice_number', invoice.document_number,
    'source_invoice_title', invoice.title,
    'source_invoice_total', invoice.total_amount,
    'source_payment_id', payment.id,
    'payment_method', payment.payment_method,
    'payment_reference', nullif(trim(payment.reference), ''),
    'authorisedBy', nullif(trim(invoice.metadata ->> 'authorisedBy'), '')
  ))
from public.commercial_documents invoice,
  public.commercial_document_payments payment
where receipt.document_type = 'receipt'
  and receipt.quote_source_id = invoice.id
  and payment.id = (receipt.metadata ->> 'source_payment_id')::uuid
  and receipt.metadata ? 'source_payment_id';

insert into public.commercial_document_items (
  document_id, sort_order, description, quantity, unit_price, line_total, metadata
)
select
  receipt.id,
  0,
  'Payment toward ' || invoice.document_number || ' · ' || invoice.title,
  1,
  payment.amount,
  payment.amount,
  jsonb_build_object('source_invoice_id', invoice.id, 'source_payment_id', payment.id)
from public.commercial_documents receipt
join public.commercial_documents invoice on invoice.id = receipt.quote_source_id
join public.commercial_document_payments payment
  on payment.id = (receipt.metadata ->> 'source_payment_id')::uuid
where receipt.document_type = 'receipt'
  and receipt.metadata ? 'source_payment_id'
  and not exists (
    select 1
    from public.commercial_document_items item
    where item.document_id = receipt.id
  );
