alter table public.intelligence_gateway_confirmations
  drop constraint if exists intelligence_gateway_confirmations_capability_check;

alter table public.intelligence_gateway_confirmations
  add constraint intelligence_gateway_confirmations_capability_check
  check (capability in (
    'create_task', 'update_task', 'add_guest', 'record_expense',
    'create_vendor_follow_up_reminder', 'record_payment', 'save_vendor_candidate',
    'assign_vendor_candidate', 'promote_vendor_candidate', 'send_vendor_enquiry',
    'apply_vendor_response', 'request_formal_vendor_quote', 'request_formal_quote_changes'
  ));

alter table public.planner_change_requests
  drop constraint if exists planner_change_requests_target_table_check;

alter table public.planner_change_requests
  add constraint planner_change_requests_target_table_check
  check (target_table in (
    'guests', 'wedding_contributions', 'contribution_rounds', 'budget_categories',
    'budget_payments', 'tasks', 'vendors', 'timelines', 'timeline_events',
    'vendor_enquiries', 'document_requests', 'commercial_quote_responses'
  ));

alter table public.commercial_quote_responses
  add column if not exists gateway_idempotency_key uuid;

create unique index if not exists commercial_quote_responses_gateway_idempotency_key_idx
  on public.commercial_quote_responses (gateway_idempotency_key)
  where gateway_idempotency_key is not null;

create or replace function public.request_formal_quote_changes(
  target_document_id uuid,
  change_message text,
  gateway_idempotency_key_input uuid
)
returns public.commercial_quote_responses
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_user_id uuid := auth.uid();
  clean_message text := nullif(btrim(change_message), '');
  target_document public.commercial_documents%rowtype;
  target_request public.document_requests%rowtype;
  acting_profile public.profiles%rowtype;
  acting_email text;
  created_response public.commercial_quote_responses%rowtype;
begin
  if acting_user_id is null then raise exception 'Authentication required'; end if;
  if target_document_id is null or gateway_idempotency_key_input is null then raise exception 'Quote references are required'; end if;
  if clean_message is null or char_length(clean_message) not between 3 and 2000 then
    raise exception 'Explain the changes you need in 3 to 2000 characters';
  end if;

  select * into created_response
  from public.commercial_quote_responses response
  where response.gateway_idempotency_key = gateway_idempotency_key_input;
  if created_response.id is not null then return created_response; end if;

  select * into target_request
  from public.document_requests request
  where request.response_document_id = target_document_id
    and request.request_type = 'quote'
    and request.requester_user_id = acting_user_id
  order by request.created_at desc
  limit 1
  for update;

  if target_request.id is null then raise exception 'Returned formal quote request not found'; end if;

  select * into target_document
  from public.commercial_documents document
  where document.id = target_document_id
    and document.document_type = 'quote'
  for update;

  if target_document.id is null then raise exception 'Formal quote not found'; end if;
  if target_request.status <> 'responded' or target_document.status <> 'sent' then
    raise exception 'This formal quote is no longer awaiting changes';
  end if;

  select * into acting_profile from public.profiles where user_id = acting_user_id;
  select lower(email::text) into acting_email from auth.users where id = acting_user_id;

  insert into public.commercial_quote_responses (
    document_id, responder_user_id, response, message, responder_name,
    responder_email, metadata, gateway_idempotency_key
  ) values (
    target_document.id, acting_user_id, 'changes_requested', clean_message,
    coalesce(nullif(btrim(acting_profile.full_name), ''), nullif(btrim(target_document.recipient_name), ''), 'Quote recipient'),
    coalesce(acting_email, target_document.recipient_email),
    jsonb_build_object('actor_source', 'intelligence_gateway', 'document_request_id', target_request.id),
    gateway_idempotency_key_input
  ) returning * into created_response;

  update public.commercial_documents
  set status = 'changes_requested',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'latestQuoteResponse', jsonb_build_object(
          'id', created_response.id, 'response', created_response.response,
          'message', created_response.message, 'responderName', created_response.responder_name,
          'createdAt', created_response.created_at, 'actorSource', 'intelligence_gateway'
        )
      )
  where id = target_document.id;

  update public.document_requests
  set status = 'changes_requested',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'quoteChangeSuggestion', clean_message,
        'quoteResponseId', created_response.id,
        'actorSource', 'intelligence_gateway'
      )
  where id = target_request.id;

  update public.attention_items
  set status = 'completed', read_at = coalesce(read_at, now()), completed_at = coalesce(completed_at, now())
  where recipient_user_id = acting_user_id
    and source_type = 'commercial_document'
    and source_id = target_document.id
    and status not in ('completed', 'dismissed');

  return created_response;
end;
$$;

revoke all on function public.request_formal_quote_changes(uuid, text, uuid) from public, anon;
grant execute on function public.request_formal_quote_changes(uuid, text, uuid) to authenticated;

comment on function public.request_formal_quote_changes(uuid, text, uuid) is
  'Requests exact changes to an authenticated requester''s returned formal quote. It rechecks request and document state and is idempotent for Intelligence Gateway confirmations.';

notify pgrst, 'reload schema';
