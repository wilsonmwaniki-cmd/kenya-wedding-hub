alter table public.vendor_enquiries
  add column if not exists response_token uuid not null default gen_random_uuid(),
  add column if not exists response_expires_at timestamptz not null default (now() + interval '30 days'),
  add column if not exists response_status text not null default 'awaiting_response',
  add column if not exists responded_at timestamptz null;

alter table public.vendor_enquiries
  drop constraint if exists vendor_enquiries_response_status_check;
alter table public.vendor_enquiries
  add constraint vendor_enquiries_response_status_check
  check (response_status in ('awaiting_response', 'available', 'unavailable', 'needs_details'));

create unique index if not exists vendor_enquiries_response_token_unique
  on public.vendor_enquiries (response_token);

create table if not exists public.vendor_enquiry_responses (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null unique references public.vendor_enquiries(id) on delete cascade,
  response text not null check (response in ('available', 'unavailable', 'needs_details')),
  message text null check (message is null or char_length(message) between 1 and 2000),
  quote_amount numeric(14,2) null check (quote_amount is null or quote_amount >= 0),
  quote_currency text null check (quote_currency is null or quote_currency ~ '^[A-Z]{3}$'),
  quote_valid_until date null,
  responder_name text not null,
  responder_email text not null,
  actor_source text not null default 'vendor_response_link' check (actor_source = 'vendor_response_link'),
  created_at timestamptz not null default now()
);

create index if not exists vendor_enquiry_responses_created_idx
  on public.vendor_enquiry_responses (created_at desc);

alter table public.vendor_enquiry_responses enable row level security;
revoke all on table public.vendor_enquiry_responses from anon;
grant select on table public.vendor_enquiry_responses to authenticated;

drop policy if exists "Enquiry participants can view vendor responses" on public.vendor_enquiry_responses;
create policy "Enquiry participants can view vendor responses"
on public.vendor_enquiry_responses for select to authenticated
using (
  exists (
    select 1
    from public.vendor_enquiries enquiry
    where enquiry.id = enquiry_id
      and (
        enquiry.owner_user_id = auth.uid()
        or enquiry.initiated_by_user_id = auth.uid()
        or enquiry.approved_by_user_id = auth.uid()
        or exists (
          select 1 from public.planner_clients client
          where client.id = enquiry.planner_client_id
            and client.linked_user_id = auth.uid()
        )
      )
  )
);

create or replace function public.get_vendor_enquiry_response_context(_response_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_enquiry public.vendor_enquiries%rowtype;
  target_vendor public.vendors%rowtype;
  existing_response public.vendor_enquiry_responses%rowtype;
begin
  select * into target_enquiry
  from public.vendor_enquiries enquiry
  where enquiry.response_token = _response_token;

  if target_enquiry.id is null
    or target_enquiry.delivery_status <> 'sent'
    or target_enquiry.response_expires_at <= now() then
    return jsonb_build_object('available', false, 'canRespond', false);
  end if;

  select * into target_vendor from public.vendors where id = target_enquiry.vendor_id;
  select * into existing_response
  from public.vendor_enquiry_responses response
  where response.enquiry_id = target_enquiry.id;

  return jsonb_build_object(
    'available', true,
    'canRespond', existing_response.id is null,
    'vendorName', coalesce(nullif(btrim(target_vendor.name), ''), target_enquiry.recipient_name),
    'recipientName', target_enquiry.recipient_name,
    'senderName', target_enquiry.sender_name,
    'subject', target_enquiry.subject,
    'message', target_enquiry.message,
    'expiresAt', target_enquiry.response_expires_at,
    'latestResponse', case when existing_response.id is null then null else jsonb_build_object(
      'response', existing_response.response,
      'message', existing_response.message,
      'quoteAmount', existing_response.quote_amount,
      'quoteCurrency', existing_response.quote_currency,
      'quoteValidUntil', existing_response.quote_valid_until,
      'createdAt', existing_response.created_at
    ) end
  );
end;
$$;

create or replace function public.respond_to_vendor_enquiry(
  _response_token uuid,
  _response text,
  _message text default null,
  _quote_amount numeric default null,
  _quote_currency text default 'KES',
  _quote_valid_until date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_enquiry public.vendor_enquiries%rowtype;
  clean_message text := nullif(btrim(_message), '');
  clean_currency text := upper(nullif(btrim(_quote_currency), ''));
  created_response public.vendor_enquiry_responses%rowtype;
begin
  if _response not in ('available', 'unavailable', 'needs_details') then
    raise exception 'Choose available, unavailable, or needs more details';
  end if;
  if clean_message is not null and char_length(clean_message) > 2000 then
    raise exception 'Keep the response message within 2000 characters';
  end if;
  if _response = 'needs_details' and (clean_message is null or char_length(clean_message) < 3) then
    raise exception 'Explain what information you need in at least 3 characters';
  end if;
  if _quote_amount is not null and (_quote_amount < 0 or _quote_amount > 1000000000000) then
    raise exception 'Enter a valid indicative amount';
  end if;
  if _quote_amount is not null and (clean_currency is null or clean_currency !~ '^[A-Z]{3}$') then
    raise exception 'Use a three-letter currency code';
  end if;
  if _quote_valid_until is not null and _quote_valid_until < current_date then
    raise exception 'The quote validity date cannot be in the past';
  end if;

  select * into target_enquiry
  from public.vendor_enquiries enquiry
  where enquiry.response_token = _response_token
  for update;

  if target_enquiry.id is null
    or target_enquiry.delivery_status <> 'sent'
    or target_enquiry.response_expires_at <= now() then
    raise exception 'This enquiry response link is no longer available';
  end if;
  if target_enquiry.response_status <> 'awaiting_response'
    or exists (select 1 from public.vendor_enquiry_responses where enquiry_id = target_enquiry.id) then
    raise exception 'A response has already been recorded for this enquiry';
  end if;

  insert into public.vendor_enquiry_responses (
    enquiry_id, response, message, quote_amount, quote_currency, quote_valid_until,
    responder_name, responder_email
  ) values (
    target_enquiry.id,
    _response,
    clean_message,
    case when _response = 'available' then _quote_amount else null end,
    case when _response = 'available' and _quote_amount is not null then clean_currency else null end,
    case when _response = 'available' and _quote_amount is not null then _quote_valid_until else null end,
    target_enquiry.recipient_name,
    target_enquiry.recipient_email
  ) returning * into created_response;

  update public.vendor_enquiries
  set response_status = _response, responded_at = now()
  where id = target_enquiry.id;

  return jsonb_build_object(
    'id', created_response.id,
    'response', created_response.response,
    'message', created_response.message,
    'quoteAmount', created_response.quote_amount,
    'quoteCurrency', created_response.quote_currency,
    'quoteValidUntil', created_response.quote_valid_until,
    'createdAt', created_response.created_at
  );
end;
$$;

revoke all on function public.get_vendor_enquiry_response_context(uuid) from public;
revoke all on function public.respond_to_vendor_enquiry(uuid, text, text, numeric, text, date) from public;
grant execute on function public.get_vendor_enquiry_response_context(uuid) to anon, authenticated;
grant execute on function public.respond_to_vendor_enquiry(uuid, text, text, numeric, text, date) to anon, authenticated;

comment on table public.vendor_enquiry_responses is
  'External vendor replies to Zania enquiries. An indicative amount is not a confirmed quote or booking.';

notify pgrst, 'reload schema';
