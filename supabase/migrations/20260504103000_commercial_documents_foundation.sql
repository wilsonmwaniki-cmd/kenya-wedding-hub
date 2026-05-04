create table if not exists public.commercial_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('vendor', 'planner')),
  document_type text not null check (document_type in ('quote', 'invoice', 'receipt')),
  document_number text not null,
  title text not null,
  status text not null,
  currency text not null default 'KES',
  recipient_name text not null,
  recipient_email text null,
  recipient_phone text null,
  wedding_name text null,
  client_id uuid null references public.planner_clients(id) on delete set null,
  vendor_listing_id uuid null references public.vendor_listings(id) on delete set null,
  vendor_id uuid null references public.vendors(id) on delete set null,
  quote_source_id uuid null references public.commercial_documents(id) on delete set null,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  balance_due numeric(12,2) not null default 0 check (balance_due >= 0),
  issue_date date not null default current_date,
  due_date date null,
  paid_date date null,
  notes text null,
  terms text null,
  metadata jsonb not null default '{}'::jsonb,
  constraint commercial_documents_document_number_user_id_key unique (user_id, document_number)
);

create table if not exists public.commercial_document_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  document_id uuid not null references public.commercial_documents(id) on delete cascade,
  sort_order integer not null default 0,
  description text not null,
  quantity numeric(12,2) not null default 1 check (quantity >= 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  line_total numeric(12,2) not null default 0 check (line_total >= 0),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.commercial_document_payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  document_id uuid not null references public.commercial_documents(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text not null check (payment_method in ('mpesa', 'bank', 'cash', 'card', 'other')),
  reference text null,
  notes text null,
  recorded_by uuid not null references auth.users(id) on delete cascade,
  budget_payment_id uuid null references public.budget_payments(id) on delete set null
);

create index if not exists commercial_documents_user_id_idx
  on public.commercial_documents(user_id);

create index if not exists commercial_documents_role_idx
  on public.commercial_documents(role);

create index if not exists commercial_documents_document_type_idx
  on public.commercial_documents(document_type);

create index if not exists commercial_documents_client_id_idx
  on public.commercial_documents(client_id);

create index if not exists commercial_documents_vendor_listing_id_idx
  on public.commercial_documents(vendor_listing_id);

create index if not exists commercial_documents_vendor_id_idx
  on public.commercial_documents(vendor_id);

create index if not exists commercial_documents_issue_date_idx
  on public.commercial_documents(issue_date desc);

create index if not exists commercial_document_items_document_id_idx
  on public.commercial_document_items(document_id);

create index if not exists commercial_document_items_sort_order_idx
  on public.commercial_document_items(sort_order);

create index if not exists commercial_document_payments_document_id_idx
  on public.commercial_document_payments(document_id);

create index if not exists commercial_document_payments_payment_date_idx
  on public.commercial_document_payments(payment_date desc);

create or replace function public.commercial_document_status_allowed(
  _document_type text,
  _status text
)
returns boolean
language sql
immutable
as $$
  select case _document_type
    when 'quote' then _status in ('draft', 'sent', 'accepted', 'rejected', 'expired')
    when 'invoice' then _status in ('draft', 'sent', 'part_paid', 'paid', 'void')
    when 'receipt' then _status in ('issued', 'void')
    else false
  end;
$$;

create or replace function public.can_manage_own_commercial_document(
  _user_id uuid,
  _role text
)
returns boolean
language sql
stable
as $$
  select auth.uid() = _user_id
    and _role in ('vendor', 'planner');
$$;

create or replace function public.can_access_own_commercial_document(
  _document_id uuid
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.commercial_documents cd
    where cd.id = _document_id
      and public.can_manage_own_commercial_document(cd.user_id, cd.role)
  );
$$;

create or replace function public.generate_next_commercial_document_number(
  _user_id uuid,
  _document_type text,
  _issue_date date default current_date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _prefix text;
  _year text;
  _next_number integer;
begin
  if _document_type not in ('quote', 'invoice', 'receipt') then
    raise exception 'Unsupported commercial document type';
  end if;

  _prefix := case _document_type
    when 'quote' then 'QT'
    when 'invoice' then 'INV'
    when 'receipt' then 'RCT'
  end;

  _year := to_char(coalesce(_issue_date, current_date), 'YYYY');

  select coalesce(max((regexp_match(document_number, '^[A-Z]+-\d{4}-(\d+)$'))[1]::integer), 0) + 1
    into _next_number
  from public.commercial_documents
  where user_id = _user_id
    and document_type = _document_type
    and document_number like _prefix || '-' || _year || '-%';

  return _prefix || '-' || _year || '-' || lpad(_next_number::text, 4, '0');
end;
$$;

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
  select *
    into _document
  from public.commercial_documents
  where id = _document_id
  limit 1;

  if _document.id is null then
    raise exception 'Commercial document not found';
  end if;

  select coalesce(sum(cdi.line_total), 0)
    into _subtotal
  from public.commercial_document_items cdi
  where cdi.document_id = _document_id;

  select coalesce(sum(cdp.amount), 0)
    into _amount_paid
  from public.commercial_document_payments cdp
  where cdp.document_id = _document_id;

  _next_status := _document.status;

  if _document.document_type = 'invoice' and _document.status <> 'void' then
    if _amount_paid >= greatest(_subtotal - _document.discount_amount + _document.tax_amount, 0) and greatest(_subtotal - _document.discount_amount + _document.tax_amount, 0) > 0 then
      _next_status := 'paid';
    elsif _amount_paid > 0 then
      _next_status := 'part_paid';
    elsif _document.status not in ('draft', 'sent') then
      _next_status := 'draft';
    end if;
  end if;

  update public.commercial_documents
  set
    subtotal = _subtotal,
    total_amount = greatest(_subtotal - discount_amount + tax_amount, 0),
    amount_paid = _amount_paid,
    balance_due = greatest(greatest(_subtotal - discount_amount + tax_amount, 0) - _amount_paid, 0),
    paid_date = case
      when document_type = 'invoice' and _next_status = 'paid'
        then coalesce((select max(payment_date) from public.commercial_document_payments where document_id = _document_id), paid_date)
      else paid_date
    end,
    status = _next_status
  where id = _document_id
  returning * into _document;

  return _document;
end;
$$;

create or replace function public.create_commercial_document(
  _role text,
  _document_type text,
  _title text,
  _recipient_name text,
  _recipient_email text default null,
  _recipient_phone text default null,
  _client_id uuid default null,
  _vendor_listing_id uuid default null,
  _vendor_id uuid default null,
  _issue_date date default current_date,
  _due_date date default null,
  _notes text default null,
  _terms text default null,
  _wedding_name text default null,
  _status text default null,
  _document_number text default null,
  _currency text default 'KES',
  _metadata jsonb default '{}'::jsonb
)
returns public.commercial_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  _document public.commercial_documents%rowtype;
  _resolved_status text;
  _resolved_number text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.can_manage_own_commercial_document(auth.uid(), _role) then
    raise exception 'Access denied';
  end if;

  _resolved_status := coalesce(
    _status,
    case _document_type
      when 'receipt' then 'issued'
      else 'draft'
    end
  );

  if not public.commercial_document_status_allowed(_document_type, _resolved_status) then
    raise exception 'Invalid status for commercial document type';
  end if;

  _resolved_number := coalesce(
    nullif(trim(_document_number), ''),
    public.generate_next_commercial_document_number(auth.uid(), _document_type, coalesce(_issue_date, current_date))
  );

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
    auth.uid(),
    _role,
    _document_type,
    _resolved_number,
    _title,
    _resolved_status,
    coalesce(nullif(trim(_currency), ''), 'KES'),
    _recipient_name,
    _recipient_email,
    _recipient_phone,
    _wedding_name,
    _client_id,
    _vendor_listing_id,
    _vendor_id,
    0,
    0,
    0,
    0,
    0,
    0,
    coalesce(_issue_date, current_date),
    _due_date,
    _notes,
    _terms,
    coalesce(_metadata, '{}'::jsonb)
  )
  returning * into _document;

  return _document;
end;
$$;

create or replace function public.save_commercial_document_items(
  _document_id uuid,
  _items jsonb
)
returns public.commercial_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  _document public.commercial_documents%rowtype;
  _item jsonb;
  _description text;
  _quantity numeric(12,2);
  _unit_price numeric(12,2);
  _line_total numeric(12,2);
  _sort_order integer;
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

  delete from public.commercial_document_items
  where document_id = _document_id;

  if jsonb_typeof(coalesce(_items, '[]'::jsonb)) = 'array' then
    for _item in
      select value
      from jsonb_array_elements(coalesce(_items, '[]'::jsonb))
    loop
      _description := nullif(trim(coalesce(_item->>'description', '')), '');

      if _description is null then
        continue;
      end if;

      _quantity := greatest(coalesce((_item->>'quantity')::numeric, 1), 0);
      _unit_price := greatest(coalesce((_item->>'unit_price')::numeric, 0), 0);
      _line_total := coalesce((_item->>'line_total')::numeric, _quantity * _unit_price);
      _sort_order := coalesce((_item->>'sort_order')::integer, 0);

      insert into public.commercial_document_items (
        document_id,
        sort_order,
        description,
        quantity,
        unit_price,
        line_total,
        metadata
      )
      values (
        _document_id,
        _sort_order,
        _description,
        _quantity,
        _unit_price,
        greatest(_line_total, 0),
        coalesce(_item->'metadata', '{}'::jsonb)
      );
    end loop;
  end if;

  return public.recalculate_commercial_document_totals(_document_id);
end;
$$;

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
    _budget_payment_id
  )
  returning * into _payment;

  perform public.recalculate_commercial_document_totals(_document_id);

  return _payment;
end;
$$;

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
    _quote.title,
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

  select *
    into _invoice
  from public.commercial_documents
  where id = _document_id
    and user_id = auth.uid()
  limit 1;

  if _invoice.id is null then
    raise exception 'Invoice not found';
  end if;

  if _invoice.document_type <> 'invoice' then
    raise exception 'Receipts can only be issued from invoices';
  end if;

  select *
    into _payment
  from public.commercial_document_payments
  where id = _payment_id
    and document_id = _document_id
  limit 1;

  if _payment.id is null then
    raise exception 'Payment not found';
  end if;

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
    paid_date,
    notes,
    terms,
    metadata
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
    _invoice.terms,
    coalesce(_invoice.metadata, '{}'::jsonb) || jsonb_build_object(
      'source_invoice_id', _invoice.id,
      'source_payment_id', _payment.id,
      'payment_method', _payment.payment_method,
      'payment_reference', _payment.reference
    )
  )
  returning * into _receipt;

  return _receipt;
end;
$$;

alter table public.commercial_documents enable row level security;
alter table public.commercial_document_items enable row level security;
alter table public.commercial_document_payments enable row level security;

drop policy if exists "Users can view own commercial documents" on public.commercial_documents;
create policy "Users can view own commercial documents"
on public.commercial_documents
for select
using (public.can_manage_own_commercial_document(user_id, role));

drop policy if exists "Users can insert own commercial documents" on public.commercial_documents;
create policy "Users can insert own commercial documents"
on public.commercial_documents
for insert
with check (public.can_manage_own_commercial_document(user_id, role));

drop policy if exists "Users can update own commercial documents" on public.commercial_documents;
create policy "Users can update own commercial documents"
on public.commercial_documents
for update
using (public.can_manage_own_commercial_document(user_id, role))
with check (public.can_manage_own_commercial_document(user_id, role));

drop policy if exists "Users can delete own draft commercial documents" on public.commercial_documents;
create policy "Users can delete own draft commercial documents"
on public.commercial_documents
for delete
using (public.can_manage_own_commercial_document(user_id, role) and status = 'draft');

drop policy if exists "Users can view own commercial document items" on public.commercial_document_items;
create policy "Users can view own commercial document items"
on public.commercial_document_items
for select
using (public.can_access_own_commercial_document(document_id));

drop policy if exists "Users can insert own commercial document items" on public.commercial_document_items;
create policy "Users can insert own commercial document items"
on public.commercial_document_items
for insert
with check (public.can_access_own_commercial_document(document_id));

drop policy if exists "Users can update own commercial document items" on public.commercial_document_items;
create policy "Users can update own commercial document items"
on public.commercial_document_items
for update
using (public.can_access_own_commercial_document(document_id))
with check (public.can_access_own_commercial_document(document_id));

drop policy if exists "Users can delete own commercial document items" on public.commercial_document_items;
create policy "Users can delete own commercial document items"
on public.commercial_document_items
for delete
using (public.can_access_own_commercial_document(document_id));

drop policy if exists "Users can view own commercial document payments" on public.commercial_document_payments;
create policy "Users can view own commercial document payments"
on public.commercial_document_payments
for select
using (public.can_access_own_commercial_document(document_id));

drop policy if exists "Users can insert own commercial document payments" on public.commercial_document_payments;
create policy "Users can insert own commercial document payments"
on public.commercial_document_payments
for insert
with check (public.can_access_own_commercial_document(document_id) and auth.uid() = recorded_by);

drop policy if exists "Users can update own commercial document payments" on public.commercial_document_payments;
create policy "Users can update own commercial document payments"
on public.commercial_document_payments
for update
using (public.can_access_own_commercial_document(document_id))
with check (public.can_access_own_commercial_document(document_id));

drop policy if exists "Users can delete own commercial document payments" on public.commercial_document_payments;
create policy "Users can delete own commercial document payments"
on public.commercial_document_payments
for delete
using (public.can_access_own_commercial_document(document_id));

drop trigger if exists update_commercial_documents_updated_at on public.commercial_documents;
create trigger update_commercial_documents_updated_at
before update on public.commercial_documents
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_commercial_document_items_updated_at on public.commercial_document_items;
create trigger update_commercial_document_items_updated_at
before update on public.commercial_document_items
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_commercial_document_payments_updated_at on public.commercial_document_payments;
create trigger update_commercial_document_payments_updated_at
before update on public.commercial_document_payments
for each row
execute function public.update_updated_at_column();

grant execute on function public.generate_next_commercial_document_number(uuid, text, date) to authenticated;
grant execute on function public.recalculate_commercial_document_totals(uuid) to authenticated;
grant execute on function public.create_commercial_document(text, text, text, text, text, text, uuid, uuid, uuid, date, date, text, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.save_commercial_document_items(uuid, jsonb) to authenticated;
grant execute on function public.record_commercial_document_payment(uuid, numeric, date, text, text, text, uuid) to authenticated;
grant execute on function public.convert_quote_to_invoice(uuid, date, date) to authenticated;
grant execute on function public.issue_receipt_from_payment(uuid, uuid) to authenticated;
