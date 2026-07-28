create table if not exists public.document_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  requester_role text not null check (requester_role in ('couple', 'planner', 'vendor')),
  recipient_role text not null check (recipient_role in ('planner', 'vendor')),
  request_type text not null check (request_type in ('quote', 'contract')),
  status text not null default 'new'
    check (status in ('new', 'viewed', 'responded', 'changes_requested', 'declined', 'cancelled')),
  wedding_id uuid null references public.weddings(id) on delete cascade,
  client_id uuid null references public.planner_clients(id) on delete set null,
  vendor_id uuid null references public.vendors(id) on delete set null,
  vendor_listing_id uuid null references public.vendor_listings(id) on delete set null,
  response_document_id uuid null references public.commercial_documents(id) on delete set null,
  response_contract_id uuid null references public.professional_contracts(id) on delete set null,
  title text not null,
  service_category text null,
  message text null,
  requester_name text not null,
  requester_email text null,
  requester_phone text null,
  recipient_name text not null,
  wedding_name text null,
  event_date date null,
  budget_amount numeric(12,2) null check (budget_amount is null or budget_amount >= 0),
  due_at timestamptz null,
  viewed_at timestamptz null,
  responded_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  check (requester_user_id <> recipient_user_id),
  check (
    (request_type = 'quote' and response_contract_id is null)
    or (request_type = 'contract' and response_document_id is null)
  )
);

create index if not exists document_requests_recipient_inbox_idx
  on public.document_requests (recipient_user_id, status, created_at desc);

create index if not exists document_requests_requester_outbox_idx
  on public.document_requests (requester_user_id, status, created_at desc);

create index if not exists document_requests_wedding_idx
  on public.document_requests (wedding_id, created_at desc);

create unique index if not exists document_requests_one_active_vendor_quote
  on public.document_requests (requester_user_id, recipient_user_id, vendor_id, request_type)
  where request_type = 'quote'
    and vendor_id is not null
    and status in ('new', 'viewed', 'changes_requested');

create unique index if not exists document_requests_one_active_planner_quote
  on public.document_requests (requester_user_id, recipient_user_id, wedding_id, request_type)
  where request_type = 'quote'
    and recipient_role = 'planner'
    and wedding_id is not null
    and status in ('new', 'viewed', 'changes_requested');

drop trigger if exists update_document_requests_updated_at on public.document_requests;
create trigger update_document_requests_updated_at
before update on public.document_requests
for each row execute function public.update_updated_at_column();

alter table public.document_requests enable row level security;

revoke all on table public.document_requests from public, anon;
revoke insert, update, delete on table public.document_requests from authenticated;
grant select on table public.document_requests to authenticated;

drop policy if exists "Request participants can view document requests" on public.document_requests;
create policy "Request participants can view document requests"
on public.document_requests
for select
to authenticated
using (
  auth.uid() is not null
  and auth.uid() in (requester_user_id, recipient_user_id)
);

create or replace function public.request_vendor_quote(
  target_vendor_id uuid,
  request_message text default null,
  request_budget_amount numeric default null
)
returns public.document_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_user_id uuid := auth.uid();
  target_vendor public.vendors%rowtype;
  target_listing public.vendor_listings%rowtype;
  target_wedding public.weddings%rowtype;
  requester_profile public.profiles%rowtype;
  requester_email text;
  requester_display_name text;
  existing_request public.document_requests%rowtype;
  created_request public.document_requests%rowtype;
  resolved_wedding_id uuid;
begin
  if acting_user_id is null then
    raise exception 'Sign in before requesting a quote';
  end if;

  select * into target_vendor
  from public.vendors
  where id = target_vendor_id;

  if target_vendor.id is null then
    raise exception 'Vendor not found';
  end if;

  resolved_wedding_id := public.resolve_vendor_workspace_wedding_id(target_vendor.id);

  if resolved_wedding_id is null or not public.is_wedding_member(resolved_wedding_id) then
    raise exception 'You do not have access to this wedding vendor';
  end if;

  if target_vendor.vendor_listing_id is null then
    raise exception 'This vendor has not connected a professional account yet';
  end if;

  select * into target_listing
  from public.vendor_listings
  where id = target_vendor.vendor_listing_id;

  if target_listing.id is null or target_listing.user_id is null then
    raise exception 'The vendor professional account is unavailable';
  end if;

  if target_listing.user_id = acting_user_id then
    raise exception 'You cannot request a quote from your own account';
  end if;

  select * into target_wedding from public.weddings where id = resolved_wedding_id;
  select * into requester_profile from public.profiles where user_id = acting_user_id;
  select email::text into requester_email from auth.users where id = acting_user_id;

  requester_display_name := coalesce(
    nullif(btrim(target_wedding.name), ''),
    nullif(btrim(requester_profile.full_name), ''),
    'A Zania client'
  );

  select * into existing_request
  from public.document_requests
  where requester_user_id = acting_user_id
    and recipient_user_id = target_listing.user_id
    and vendor_id = target_vendor.id
    and request_type = 'quote'
    and status in ('new', 'viewed', 'changes_requested')
  order by created_at desc
  limit 1;

  if existing_request.id is not null then
    return existing_request;
  end if;

  insert into public.document_requests (
    requester_user_id,
    recipient_user_id,
    requester_role,
    recipient_role,
    request_type,
    wedding_id,
    client_id,
    vendor_id,
    vendor_listing_id,
    title,
    service_category,
    message,
    requester_name,
    requester_email,
    requester_phone,
    recipient_name,
    wedding_name,
    event_date,
    budget_amount,
    due_at,
    metadata
  )
  values (
    acting_user_id,
    target_listing.user_id,
    coalesce(requester_profile.role::text, 'couple'),
    'vendor',
    'quote',
    resolved_wedding_id,
    target_vendor.client_id,
    target_vendor.id,
    target_listing.id,
    'Quote for ' || coalesce(nullif(btrim(target_vendor.category), ''), target_listing.category, 'wedding service'),
    coalesce(nullif(btrim(target_vendor.category), ''), target_listing.category),
    nullif(btrim(request_message), ''),
    requester_display_name,
    nullif(btrim(requester_email), ''),
    nullif(btrim(requester_profile.company_phone), ''),
    target_listing.business_name,
    target_wedding.name,
    target_wedding.wedding_date,
    request_budget_amount,
    now() + interval '3 days',
    jsonb_build_object('source', 'wedding_vendor_workspace')
  )
  returning * into created_request;

  return created_request;
end;
$$;

create or replace function public.request_planner_quote(
  target_planner_user_id uuid,
  request_message text default null,
  request_budget_amount numeric default null
)
returns public.document_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_user_id uuid := auth.uid();
  requester_profile public.profiles%rowtype;
  planner_profile public.profiles%rowtype;
  target_wedding public.weddings%rowtype;
  target_client public.planner_clients%rowtype;
  requester_email text;
  requester_display_name text;
  target_wedding_id uuid;
  existing_request public.document_requests%rowtype;
  created_request public.document_requests%rowtype;
begin
  if acting_user_id is null then
    raise exception 'Sign in before requesting a quote';
  end if;

  select * into requester_profile from public.profiles where user_id = acting_user_id;
  if requester_profile.role::text <> 'couple' then
    raise exception 'Only couple accounts can request a planner quote here';
  end if;

  select * into planner_profile
  from public.profiles
  where user_id = target_planner_user_id
    and role::text = 'planner';

  if planner_profile.user_id is null then
    raise exception 'Planner account not found';
  end if;

  select wm.wedding_id into target_wedding_id
  from public.wedding_memberships wm
  join public.weddings w on w.id = wm.wedding_id and w.deleted_at is null
  where wm.user_id = acting_user_id
    and wm.membership_status = 'active'
    and wm.is_owner = true
  order by w.updated_at desc
  limit 1;

  if target_wedding_id is null then
    raise exception 'Create your wedding workspace before requesting a planner quote';
  end if;

  select * into target_wedding from public.weddings where id = target_wedding_id;
  select * into target_client
  from public.planner_clients
  where planner_user_id = target_planner_user_id
    and (linked_user_id = acting_user_id or wedding_id = target_wedding_id)
    and coalesce(is_archived, false) = false
  order by created_at desc
  limit 1;

  select email::text into requester_email from auth.users where id = acting_user_id;
  requester_display_name := coalesce(
    nullif(btrim(target_wedding.name), ''),
    nullif(btrim(requester_profile.full_name), ''),
    'A Zania couple'
  );

  select * into existing_request
  from public.document_requests
  where requester_user_id = acting_user_id
    and recipient_user_id = target_planner_user_id
    and wedding_id = target_wedding_id
    and request_type = 'quote'
    and status in ('new', 'viewed', 'changes_requested')
  order by created_at desc
  limit 1;

  if existing_request.id is not null then
    return existing_request;
  end if;

  insert into public.document_requests (
    requester_user_id,
    recipient_user_id,
    requester_role,
    recipient_role,
    request_type,
    wedding_id,
    client_id,
    title,
    service_category,
    message,
    requester_name,
    requester_email,
    requester_phone,
    recipient_name,
    wedding_name,
    event_date,
    budget_amount,
    due_at,
    metadata
  )
  values (
    acting_user_id,
    target_planner_user_id,
    'couple',
    'planner',
    'quote',
    target_wedding_id,
    target_client.id,
    'Wedding planning quote',
    'Wedding planning',
    nullif(btrim(request_message), ''),
    requester_display_name,
    nullif(btrim(requester_email), ''),
    nullif(btrim(requester_profile.company_phone), ''),
    coalesce(nullif(btrim(planner_profile.company_name), ''), nullif(btrim(planner_profile.full_name), ''), 'Wedding planner'),
    target_wedding.name,
    target_wedding.wedding_date,
    request_budget_amount,
    now() + interval '3 days',
    jsonb_build_object('source', 'planner_profile')
  )
  returning * into created_request;

  return created_request;
end;
$$;

create or replace function public.mark_document_request_viewed(request_id_input uuid)
returns public.document_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_request public.document_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in to open this request';
  end if;

  update public.document_requests
  set
    status = case when status = 'new' then 'viewed' else status end,
    viewed_at = coalesce(viewed_at, now())
  where id = request_id_input
    and recipient_user_id = auth.uid()
  returning * into updated_request;

  if updated_request.id is null then
    raise exception 'Document request not found';
  end if;

  return updated_request;
end;
$$;

create or replace function public.respond_to_document_request(
  request_id_input uuid,
  response_document_id_input uuid default null,
  response_contract_id_input uuid default null
)
returns public.document_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  target_request public.document_requests%rowtype;
  target_document public.commercial_documents%rowtype;
  target_contract public.professional_contracts%rowtype;
  updated_request public.document_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in to answer this request';
  end if;

  select * into target_request
  from public.document_requests
  where id = request_id_input
    and recipient_user_id = auth.uid();

  if target_request.id is null then
    raise exception 'Document request not found';
  end if;

  if target_request.request_type = 'quote' then
    select * into target_document
    from public.commercial_documents
    where id = response_document_id_input
      and user_id = auth.uid()
      and role = target_request.recipient_role
      and document_type = 'quote';

    if target_document.id is null then
      raise exception 'Choose a quote owned by this professional account';
    end if;
  else
    select * into target_contract
    from public.professional_contracts
    where id = response_contract_id_input
      and user_id = auth.uid()
      and role = target_request.recipient_role;

    if target_contract.id is null then
      raise exception 'Choose a contract owned by this professional account';
    end if;
  end if;

  update public.document_requests
  set
    status = 'responded',
    response_document_id = case when request_type = 'quote' then target_document.id else null end,
    response_contract_id = case when request_type = 'contract' then target_contract.id else null end,
    viewed_at = coalesce(viewed_at, now()),
    responded_at = now()
  where id = target_request.id
  returning * into updated_request;

  return updated_request;
end;
$$;

create or replace function public.cancel_document_request(request_id_input uuid)
returns public.document_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_request public.document_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in to cancel this request';
  end if;

  update public.document_requests
  set status = 'cancelled'
  where id = request_id_input
    and requester_user_id = auth.uid()
    and status in ('new', 'viewed', 'changes_requested')
  returning * into updated_request;

  if updated_request.id is null then
    raise exception 'This request can no longer be cancelled';
  end if;

  return updated_request;
end;
$$;

revoke all on function public.request_vendor_quote(uuid, text, numeric) from public;
revoke all on function public.request_planner_quote(uuid, text, numeric) from public;
revoke all on function public.mark_document_request_viewed(uuid) from public;
revoke all on function public.respond_to_document_request(uuid, uuid, uuid) from public;
revoke all on function public.cancel_document_request(uuid) from public;

grant execute on function public.request_vendor_quote(uuid, text, numeric) to authenticated;
grant execute on function public.request_planner_quote(uuid, text, numeric) to authenticated;
grant execute on function public.mark_document_request_viewed(uuid) to authenticated;
grant execute on function public.respond_to_document_request(uuid, uuid, uuid) to authenticated;
grant execute on function public.cancel_document_request(uuid) to authenticated;
