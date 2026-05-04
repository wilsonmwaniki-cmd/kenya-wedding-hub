create table if not exists public.commercial_document_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.commercial_documents(id) on delete cascade,
  share_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists commercial_document_shares_document_id_idx
  on public.commercial_document_shares (document_id);

create unique index if not exists commercial_document_shares_share_token_idx
  on public.commercial_document_shares (share_token);

alter table public.commercial_document_shares enable row level security;

drop policy if exists "Users can manage own commercial document shares" on public.commercial_document_shares;
create policy "Users can manage own commercial document shares"
on public.commercial_document_shares
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop trigger if exists update_commercial_document_shares_updated_at on public.commercial_document_shares;
create trigger update_commercial_document_shares_updated_at
before update on public.commercial_document_shares
for each row
execute function public.update_updated_at_column();

create or replace function public.ensure_commercial_document_share_token(_document_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _document public.commercial_documents%rowtype;
  _share_token uuid;
begin
  if _uid is null then
    raise exception 'Authentication required';
  end if;

  select *
    into _document
  from public.commercial_documents
  where id = _document_id
    and user_id = _uid;

  if not found then
    raise exception 'Document not found';
  end if;

  select share_token
    into _share_token
  from public.commercial_document_shares
  where document_id = _document.id;

  if _share_token is not null then
    return _share_token;
  end if;

  insert into public.commercial_document_shares (user_id, document_id)
  values (_uid, _document.id)
  returning share_token into _share_token;

  return _share_token;
end;
$$;

create or replace function public.get_shared_commercial_document(_share_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _share record;
  _document public.commercial_documents%rowtype;
  _profile public.profiles%rowtype;
  _vendor_listing record;
  _issuer_name text;
  _issuer_email text;
  _issuer_phone text;
  _issuer_website text;
  _issuer_location text;
  _items jsonb;
  _payments jsonb;
begin
  select
    cds.user_id,
    cds.document_id
  into _share
  from public.commercial_document_shares cds
  where cds.share_token = _share_token;

  if not found then
    return null;
  end if;

  select *
    into _document
  from public.commercial_documents
  where id = _share.document_id;

  if not found then
    return null;
  end if;

  select *
    into _profile
  from public.profiles
  where user_id = _share.user_id;

  if _document.vendor_listing_id is not null then
    select
      vl.business_name,
      vl.email,
      vl.phone,
      vl.website,
      vl.primary_county,
      vl.primary_town
    into _vendor_listing
    from public.vendor_listings vl
    where vl.id = _document.vendor_listing_id;
  end if;

  if _document.role = 'planner' then
    _issuer_name := coalesce(_profile.company_name, _profile.full_name, 'Zania Planner');
    _issuer_email := coalesce(_profile.company_email, _profile.company_email, _profile.company_email);
    _issuer_phone := _profile.company_phone;
    _issuer_website := _profile.company_website;
    _issuer_location := trim(
      both ', ' from concat_ws(', ', _profile.primary_town, _profile.primary_county)
    );
  else
    _issuer_name := coalesce(_vendor_listing.business_name, _profile.company_name, _profile.full_name, 'Zania Vendor');
    _issuer_email := coalesce(_vendor_listing.email, _profile.company_email);
    _issuer_phone := coalesce(_vendor_listing.phone, _profile.company_phone);
    _issuer_website := coalesce(_vendor_listing.website, _profile.company_website);
    _issuer_location := trim(
      both ', ' from concat_ws(', ', _vendor_listing.primary_town, _vendor_listing.primary_county)
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cdi.id,
        'description', cdi.description,
        'quantity', cdi.quantity,
        'unitPrice', cdi.unit_price,
        'lineTotal', cdi.line_total,
        'sortOrder', cdi.sort_order
      )
      order by cdi.sort_order asc, cdi.created_at asc
    ),
    '[]'::jsonb
  )
  into _items
  from public.commercial_document_items cdi
  where cdi.document_id = _document.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cdp.id,
        'amount', cdp.amount,
        'paymentDate', cdp.payment_date,
        'paymentMethod', cdp.payment_method,
        'reference', cdp.reference,
        'notes', cdp.notes
      )
      order by cdp.payment_date asc, cdp.created_at asc
    ),
    '[]'::jsonb
  )
  into _payments
  from public.commercial_document_payments cdp
  where cdp.document_id = _document.id;

  return jsonb_build_object(
    'id', _document.id,
    'role', _document.role,
    'documentType', _document.document_type,
    'documentNumber', _document.document_number,
    'title', _document.title,
    'status', _document.status,
    'currency', _document.currency,
    'recipientName', _document.recipient_name,
    'recipientEmail', _document.recipient_email,
    'recipientPhone', _document.recipient_phone,
    'weddingName', _document.wedding_name,
    'issueDate', _document.issue_date,
    'dueDate', _document.due_date,
    'paidDate', _document.paid_date,
    'notes', _document.notes,
    'terms', _document.terms,
    'subtotal', _document.subtotal,
    'discountAmount', _document.discount_amount,
    'taxAmount', _document.tax_amount,
    'totalAmount', _document.total_amount,
    'amountPaid', _document.amount_paid,
    'balanceDue', _document.balance_due,
    'issuerName', _issuer_name,
    'issuerEmail', _issuer_email,
    'issuerPhone', _issuer_phone,
    'issuerWebsite', _issuer_website,
    'issuerLocation', nullif(_issuer_location, ''),
    'items', _items,
    'payments', _payments
  );
end;
$$;

grant execute on function public.ensure_commercial_document_share_token(uuid) to authenticated;
grant execute on function public.get_shared_commercial_document(uuid) to anon, authenticated;
