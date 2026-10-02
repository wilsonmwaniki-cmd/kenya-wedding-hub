create or replace function public.convert_quote_to_invoice(
  _quote_id uuid,
  _issue_date date default current_date,
  _due_date date default null
)
returns public.commercial_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  _quote public.commercial_documents%rowtype;
  _invoice public.commercial_documents%rowtype;
  _invoice_title text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
    into _quote
  from public.commercial_documents
  where id = _quote_id
    and user_id = auth.uid()
  limit 1;

  if _quote.id is null then
    raise exception 'Quote not found';
  end if;

  if _quote.document_type <> 'quote' then
    raise exception 'Only quotes can be converted to invoices';
  end if;

  _invoice_title := case
    when trim(coalesce(_quote.title, '')) = '' then 'Invoice'
    when trim(_quote.title) ~* 'invoice$' then trim(_quote.title)
    when trim(_quote.title) ~* 'quote$' then regexp_replace(trim(_quote.title), 'quote$', 'Invoice', 'i')
    else trim(_quote.title) || ' Invoice'
  end;

  insert into public.commercial_documents (
    user_id,
    role,
    document_type,
    document_number,
    title,
    status,
    currency,
    recipient_name,
    recipient_email,
    recipient_phone,
    wedding_name,
    client_id,
    vendor_listing_id,
    vendor_id,
    quote_source_id,
    subtotal,
    discount_amount,
    tax_amount,
    total_amount,
    amount_paid,
    balance_due,
    issue_date,
    due_date,
    notes,
    terms,
    metadata
  )
  values (
    _quote.user_id,
    _quote.role,
    'invoice',
    public.generate_next_commercial_document_number(_quote.user_id, 'invoice', coalesce(_issue_date, current_date)),
    _invoice_title,
    'draft',
    _quote.currency,
    _quote.recipient_name,
    _quote.recipient_email,
    _quote.recipient_phone,
    _quote.wedding_name,
    _quote.client_id,
    _quote.vendor_listing_id,
    _quote.vendor_id,
    _quote.id,
    _quote.subtotal,
    _quote.discount_amount,
    _quote.tax_amount,
    _quote.total_amount,
    0,
    _quote.total_amount,
    coalesce(_issue_date, current_date),
    _due_date,
    _quote.notes,
    _quote.terms,
    coalesce(_quote.metadata, '{}'::jsonb) || jsonb_build_object('source_quote_id', _quote.id)
  )
  returning * into _invoice;

  insert into public.commercial_document_items (
    document_id,
    sort_order,
    description,
    quantity,
    unit_price,
    line_total,
    metadata
  )
  select
    _invoice.id,
    cdi.sort_order,
    cdi.description,
    cdi.quantity,
    cdi.unit_price,
    cdi.line_total,
    cdi.metadata
  from public.commercial_document_items cdi
  where cdi.document_id = _quote.id;

  return public.recalculate_commercial_document_totals(_invoice.id);
end;
$$;
