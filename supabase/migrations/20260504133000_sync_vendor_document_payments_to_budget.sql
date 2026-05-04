create or replace function public.sync_vendor_document_payment_to_budget(
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
  _document public.commercial_documents%rowtype;
  _vendor public.vendors%rowtype;
  _category public.budget_categories%rowtype;
  _budget_payment public.budget_payments%rowtype;
  _category_name text;
  _contract_amount numeric;
  _next_amount_paid numeric;
  _next_status text;
  _owns_listing boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
    into _document
  from public.commercial_documents
  where id = _document_id
    and user_id = auth.uid()
  limit 1;

  if _document.id is null then
    raise exception 'Commercial document not found';
  end if;

  if _document.role <> 'vendor' or _document.vendor_id is null then
    return null;
  end if;

  select *
    into _vendor
  from public.vendors
  where id = _document.vendor_id
  limit 1;

  if _vendor.id is null then
    return null;
  end if;

  select exists(
    select 1
    from public.vendor_listings vl
    where vl.user_id = auth.uid()
      and vl.id = coalesce(_vendor.vendor_listing_id, _document.vendor_listing_id)
  )
  into _owns_listing;

  if not _owns_listing then
    return null;
  end if;

  _category_name := coalesce(
    nullif(trim(_vendor.category), ''),
    nullif(trim(_document.title), ''),
    'Vendor'
  );

  select *
    into _category
  from public.budget_categories
  where user_id = _vendor.user_id
    and budget_scope = 'wedding'
    and lower(name) = lower(_category_name)
    and client_id is not distinct from _vendor.client_id
    and wedding_id is not distinct from _vendor.wedding_id
  order by created_at asc
  limit 1;

  if _category.id is null then
    insert into public.budget_categories (
      user_id,
      client_id,
      wedding_id,
      name,
      allocated,
      spent,
      budget_scope,
      visibility,
      committee_role_in_charge,
      contract_status
    )
    values (
      _vendor.user_id,
      _vendor.client_id,
      _vendor.wedding_id,
      _category_name,
      coalesce(_vendor.price, _document.total_amount, 0),
      0,
      'wedding',
      'public',
      coalesce(_vendor.committee_role_in_charge, 'unassigned'),
      coalesce(_vendor.contract_status, 'not_started')
    )
    returning * into _category;
  end if;

  insert into public.budget_payments (
    user_id,
    client_id,
    wedding_id,
    budget_category_id,
    vendor_id,
    budget_scope,
    category_name,
    payee_name,
    amount,
    payment_date,
    reference,
    notes
  )
  values (
    _vendor.user_id,
    _vendor.client_id,
    _vendor.wedding_id,
    _category.id,
    _vendor.id,
    'wedding',
    _category_name,
    coalesce(nullif(trim(_vendor.name), ''), _document.recipient_name),
    _amount,
    coalesce(_payment_date, current_date),
    _reference,
    _notes
  )
  returning * into _budget_payment;

  update public.budget_categories
  set spent = coalesce(spent, 0) + _amount
  where id = _category.id;

  _next_amount_paid := coalesce(_vendor.amount_paid, 0) + _amount;
  _contract_amount := coalesce(_vendor.price, _document.total_amount, 0);
  _next_status := case
    when _contract_amount > 0 and _next_amount_paid >= _contract_amount then 'paid_full'
    when _next_amount_paid > 0 then 'part_paid'
    else coalesce(_vendor.payment_status, 'unpaid')
  end;

  update public.vendors
  set
    amount_paid = _next_amount_paid,
    payment_status = _next_status,
    last_payment_at = coalesce(_payment_date, current_date)::timestamptz
  where id = _vendor.id;

  return _budget_payment.id;
end;
$$;

grant execute on function public.sync_vendor_document_payment_to_budget(uuid, numeric, date, text, text) to authenticated;

create or replace function public.record_commercial_document_payment(
  _document_id uuid,
  _amount numeric,
  _payment_date date default current_date,
  _payment_method text default 'other',
  _reference text default null,
  _notes text default null,
  _budget_payment_id uuid default null
)
returns public.commercial_document_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  _document public.commercial_documents%rowtype;
  _payment public.commercial_document_payments%rowtype;
  _linked_budget_payment_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if _amount is null or _amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  select *
    into _document
  from public.commercial_documents
  where id = _document_id
    and user_id = auth.uid()
  limit 1;

  if _document.id is null then
    raise exception 'Commercial document not found';
  end if;

  if _document.document_type <> 'invoice' then
    raise exception 'Payments can only be recorded against invoices';
  end if;

  if _document.status = 'void' then
    raise exception 'Cannot record payment against a void invoice';
  end if;

  _linked_budget_payment_id := _budget_payment_id;

  if _linked_budget_payment_id is null then
    _linked_budget_payment_id := public.sync_vendor_document_payment_to_budget(
      _document_id,
      _amount,
      _payment_date,
      _reference,
      _notes
    );
  end if;

  insert into public.commercial_document_payments (
    document_id,
    amount,
    payment_date,
    payment_method,
    reference,
    notes,
    recorded_by,
    budget_payment_id
  )
  values (
    _document_id,
    _amount,
    coalesce(_payment_date, current_date),
    _payment_method,
    _reference,
    _notes,
    auth.uid(),
    _linked_budget_payment_id
  )
  returning * into _payment;

  perform public.recalculate_commercial_document_totals(_document_id);

  return _payment;
end;
$$;

grant execute on function public.record_commercial_document_payment(uuid, numeric, date, text, text, text, uuid) to authenticated;
