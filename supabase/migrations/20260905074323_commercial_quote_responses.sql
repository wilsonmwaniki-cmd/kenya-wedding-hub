create table if not exists public.commercial_quote_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  document_id uuid not null references public.commercial_documents(id) on delete cascade,
  responder_user_id uuid not null references auth.users(id) on delete cascade,
  response text not null check (response in ('accepted', 'changes_requested')),
  message text null,
  responder_name text not null,
  responder_email text null,
  metadata jsonb not null default '{}'::jsonb,
  check (
    response = 'accepted'
    or (message is not null and char_length(btrim(message)) between 3 and 2000)
  )
);

create index if not exists commercial_quote_responses_document_idx
  on public.commercial_quote_responses (document_id, created_at desc);

alter table public.commercial_quote_responses enable row level security;

revoke all on table public.commercial_quote_responses from public, anon;
revoke insert, update, delete on table public.commercial_quote_responses from authenticated;
grant select on table public.commercial_quote_responses to authenticated;

drop policy if exists "Quote participants can view responses" on public.commercial_quote_responses;
create policy "Quote participants can view responses"
on public.commercial_quote_responses
for select
to authenticated
using (
  (select auth.uid()) = responder_user_id
  or exists (
    select 1
    from public.commercial_documents document
    where document.id = commercial_quote_responses.document_id
      and document.user_id = (select auth.uid())
  )
);

create or replace function public.commercial_document_status_allowed(
  _document_type text,
  _status text
)
returns boolean
language sql
immutable
as $$
  select case _document_type
    when 'quote' then _status in ('draft', 'sent', 'changes_requested', 'accepted', 'rejected', 'expired')
    when 'invoice' then _status in ('draft', 'sent', 'part_paid', 'paid', 'void')
    when 'receipt' then _status in ('issued', 'void')
    else false
  end;
$$;

create or replace function public.get_shared_quote_response_context(_share_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_user_id uuid := auth.uid();
  target_document public.commercial_documents%rowtype;
  target_share public.commercial_document_shares%rowtype;
  acting_email text;
  acting_role text;
  can_respond boolean := false;
  latest_response public.commercial_quote_responses%rowtype;
begin
  select * into target_share
  from public.commercial_document_shares share
  where share.share_token = _share_token
    and public.is_public_token_active(share.expires_at, share.revoked_at);

  if target_share.id is null then
    return jsonb_build_object('available', false, 'canRespond', false);
  end if;

  select * into target_document
  from public.commercial_documents document
  where document.id = target_share.document_id
    and document.document_type = 'quote';

  if target_document.id is null then
    return jsonb_build_object('available', false, 'canRespond', false);
  end if;

  if acting_user_id is not null and acting_user_id <> target_document.user_id then
    select lower(email::text) into acting_email from auth.users where id = acting_user_id;
    select role::text into acting_role from public.profiles where user_id = acting_user_id;

    can_respond := coalesce(acting_role in ('couple', 'planner') and (
      (target_document.recipient_email is not null and lower(btrim(target_document.recipient_email)) = acting_email)
      or exists (
        select 1 from public.vendors vendor
        where vendor.id = target_document.vendor_id and vendor.user_id = acting_user_id
      )
      or exists (
        select 1 from public.planner_clients client
        where client.id = target_document.client_id and client.linked_user_id = acting_user_id
      )
    ), false);
  end if;

  if acting_user_id is not null and (can_respond or acting_user_id = target_document.user_id) then
    select * into latest_response
    from public.commercial_quote_responses response
    where response.document_id = target_document.id
    order by response.created_at desc
    limit 1;
  end if;

  return jsonb_build_object(
    'available', true,
    'canRespond', can_respond,
    'status', target_document.status,
    'latestResponse', case
      when latest_response.id is null then null
      else jsonb_build_object(
        'id', latest_response.id,
        'response', latest_response.response,
        'message', latest_response.message,
        'responderName', latest_response.responder_name,
        'createdAt', latest_response.created_at
      )
    end
  );
end;
$$;

create or replace function public.respond_to_shared_quote(
  _share_token uuid,
  _response text,
  _message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_user_id uuid := auth.uid();
  target_document public.commercial_documents%rowtype;
  target_share public.commercial_document_shares%rowtype;
  acting_profile public.profiles%rowtype;
  acting_email text;
  can_respond boolean := false;
  clean_message text := nullif(btrim(_message), '');
  created_response public.commercial_quote_responses%rowtype;
  linked_request_id uuid;
  resolved_wedding_id uuid;
  event_id_value uuid;
begin
  if acting_user_id is null then
    raise exception 'Sign in to respond to this quote';
  end if;

  if _response not in ('accepted', 'changes_requested') then
    raise exception 'Choose whether to accept the quote or request changes';
  end if;

  if _response = 'changes_requested' and (clean_message is null or char_length(clean_message) not between 3 and 2000) then
    raise exception 'Explain the changes you need in 3 to 2000 characters';
  end if;

  select * into target_share
  from public.commercial_document_shares share
  where share.share_token = _share_token
    and public.is_public_token_active(share.expires_at, share.revoked_at)
  for update;

  if target_share.id is null then
    raise exception 'This quote link is no longer available';
  end if;

  select * into target_document
  from public.commercial_documents document
  where document.id = target_share.document_id
    and document.document_type = 'quote'
  for update;

  if target_document.id is null then
    raise exception 'Quote not found';
  end if;

  if target_document.status <> 'sent' then
    raise exception 'This quote is not awaiting a response';
  end if;

  if acting_user_id = target_document.user_id then
    raise exception 'The sender cannot respond to their own quote';
  end if;

  select * into acting_profile from public.profiles where user_id = acting_user_id;
  select lower(email::text) into acting_email from auth.users where id = acting_user_id;

  can_respond := coalesce(acting_profile.role::text in ('couple', 'planner') and (
    (target_document.recipient_email is not null and lower(btrim(target_document.recipient_email)) = acting_email)
    or exists (
      select 1 from public.vendors vendor
      where vendor.id = target_document.vendor_id and vendor.user_id = acting_user_id
    )
    or exists (
      select 1 from public.planner_clients client
      where client.id = target_document.client_id and client.linked_user_id = acting_user_id
    )
  ), false);

  if not can_respond then
    raise exception 'Only the couple or planner this quote was prepared for can respond';
  end if;

  insert into public.commercial_quote_responses (
    document_id,
    responder_user_id,
    response,
    message,
    responder_name,
    responder_email,
    metadata
  ) values (
    target_document.id,
    acting_user_id,
    _response,
    case when _response = 'changes_requested' then clean_message else null end,
    coalesce(nullif(btrim(acting_profile.full_name), ''), nullif(btrim(target_document.recipient_name), ''), 'Quote recipient'),
    acting_email,
    jsonb_build_object('share_id', target_share.id)
  ) returning * into created_response;

  update public.commercial_documents
  set
    status = _response,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'latestQuoteResponse', jsonb_build_object(
        'id', created_response.id,
        'response', created_response.response,
        'message', created_response.message,
        'responderName', created_response.responder_name,
        'createdAt', created_response.created_at
      )
    )
  where id = target_document.id;

  update public.attention_items
  set
    status = 'completed',
    read_at = coalesce(read_at, now()),
    completed_at = coalesce(completed_at, now())
  where recipient_user_id = acting_user_id
    and source_type = 'commercial_document'
    and source_id = target_document.id
    and status not in ('completed', 'dismissed');

  if _response = 'changes_requested' then
    select request.id into linked_request_id
    from public.document_requests request
    where request.response_document_id = target_document.id
      and request.requester_user_id = acting_user_id
      and request.status = 'responded'
    order by request.created_at desc
    limit 1;

    update public.document_requests
    set
      status = 'changes_requested',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'quoteChangeSuggestion', clean_message,
        'quoteResponseId', created_response.id
      )
    where id = linked_request_id;

    if linked_request_id is null then
      if target_document.vendor_id is not null then
        select vendor.wedding_id into resolved_wedding_id
        from public.vendors vendor where vendor.id = target_document.vendor_id;
      elsif target_document.client_id is not null then
        select client.wedding_id into resolved_wedding_id
        from public.planner_clients client where client.id = target_document.client_id;
      end if;

      event_id_value := public.record_workspace_event(
        resolved_wedding_id,
        'commercial_document.changes_requested',
        'commercial_document',
        target_document.id,
        'Quote changes requested',
        created_response.responder_name || ' requested changes to ' || target_document.document_number,
        'commercial_document:' || target_document.id::text || ':response:' || created_response.id::text,
        jsonb_build_object('document_number', target_document.document_number, 'response_id', created_response.id)
      );

      insert into public.attention_items (
        recipient_user_id, recipient_role, wedding_id, event_id, source_type, source_id,
        attention_kind, priority, status, title, summary, action_label, action_path,
        dedupe_key, metadata
      ) values (
        target_document.user_id, target_document.role, resolved_wedding_id, event_id_value,
        'commercial_document', target_document.id, 'action', 'action', 'unread',
        'Quote changes requested', created_response.responder_name || ' left suggestions for ' || target_document.document_number,
        'Amend quote', case when target_document.role = 'vendor' then '/vendor-documents/quotes' else '/planner-documents/quotes' end,
        'commercial_document:' || target_document.id::text || ':issuer:changes_requested',
        jsonb_build_object('document_number', target_document.document_number, 'response_id', created_response.id)
      )
      on conflict (recipient_user_id, dedupe_key) do update set
        event_id = excluded.event_id,
        status = 'unread',
        summary = excluded.summary,
        read_at = null,
        completed_at = null,
        dismissed_at = null,
        metadata = excluded.metadata;
    end if;
  end if;

  return jsonb_build_object(
    'id', created_response.id,
    'documentId', target_document.id,
    'response', created_response.response,
    'message', created_response.message,
    'responderName', created_response.responder_name,
    'createdAt', created_response.created_at
  );
end;
$$;

revoke all on function public.get_shared_quote_response_context(uuid) from public;
revoke all on function public.respond_to_shared_quote(uuid, text, text) from public;
grant execute on function public.get_shared_quote_response_context(uuid) to anon, authenticated;
grant execute on function public.respond_to_shared_quote(uuid, text, text) to authenticated;

grant select on table public.commercial_quote_responses to authenticated;

notify pgrst, 'reload schema';
