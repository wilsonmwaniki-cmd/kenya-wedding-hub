create or replace function public.sync_document_response_deep_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_action_path text;
  resolved_share_token uuid;
begin
  if new.status <> 'responded' then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.status is not distinct from old.status
    and new.response_document_id is not distinct from old.response_document_id
    and new.response_contract_id is not distinct from old.response_contract_id then
    return new;
  end if;

  if new.request_type = 'quote' and new.response_document_id is not null then
    insert into public.commercial_document_shares (
      user_id,
      document_id,
      expires_at,
      revoked_at
    )
    values (
      new.recipient_user_id,
      new.response_document_id,
      now() + interval '365 days',
      null
    )
    on conflict (document_id) do update set
      share_token = case
        when public.commercial_document_shares.revoked_at is not null
          or public.commercial_document_shares.expires_at <= now()
          then gen_random_uuid()
        else public.commercial_document_shares.share_token
      end,
      expires_at = greatest(public.commercial_document_shares.expires_at, now() + interval '365 days'),
      revoked_at = null,
      updated_at = now()
    returning share_token into resolved_share_token;

    resolved_action_path := '/documents/share/' || resolved_share_token::text;
  elsif new.request_type = 'contract' and new.response_contract_id is not null then
    insert into public.professional_contract_shares (
      user_id,
      contract_id,
      expires_at,
      revoked_at
    )
    values (
      new.recipient_user_id,
      new.response_contract_id,
      now() + interval '365 days',
      null
    )
    on conflict (contract_id) do update set
      share_token = case
        when public.professional_contract_shares.revoked_at is not null
          or public.professional_contract_shares.expires_at <= now()
          then gen_random_uuid()
        else public.professional_contract_shares.share_token
      end,
      expires_at = greatest(public.professional_contract_shares.expires_at, now() + interval '365 days'),
      revoked_at = null,
      updated_at = now()
    returning share_token into resolved_share_token;

    resolved_action_path := '/contracts/share/' || resolved_share_token::text;
  end if;

  if resolved_action_path is not null then
    update public.attention_items
    set
      action_path = resolved_action_path,
      action_label = 'Open document',
      updated_at = now()
    where recipient_user_id = new.requester_user_id
      and source_type = 'document_request'
      and source_id = new.id
      and dedupe_key = 'document_request:' || new.id::text || ':requester_update:responded';
  end if;

  return new;
end;
$$;

drop trigger if exists zz_sync_document_response_deep_link on public.document_requests;
create trigger zz_sync_document_response_deep_link
after insert or update of status, response_document_id, response_contract_id
on public.document_requests
for each row execute function public.sync_document_response_deep_link();

revoke all on function public.sync_document_response_deep_link() from public, anon, authenticated;

insert into public.commercial_document_shares (
  user_id,
  document_id,
  expires_at,
  revoked_at
)
select
  request.recipient_user_id,
  request.response_document_id,
  now() + interval '365 days',
  null
from public.document_requests request
where request.status = 'responded'
  and request.request_type = 'quote'
  and request.response_document_id is not null
on conflict (document_id) do update set
  share_token = case
    when public.commercial_document_shares.revoked_at is not null
      or public.commercial_document_shares.expires_at <= now()
      then gen_random_uuid()
    else public.commercial_document_shares.share_token
  end,
  expires_at = greatest(public.commercial_document_shares.expires_at, now() + interval '365 days'),
  revoked_at = null,
  updated_at = now();

insert into public.professional_contract_shares (
  user_id,
  contract_id,
  expires_at,
  revoked_at
)
select
  request.recipient_user_id,
  request.response_contract_id,
  now() + interval '365 days',
  null
from public.document_requests request
where request.status = 'responded'
  and request.request_type = 'contract'
  and request.response_contract_id is not null
on conflict (contract_id) do update set
  share_token = case
    when public.professional_contract_shares.revoked_at is not null
      or public.professional_contract_shares.expires_at <= now()
      then gen_random_uuid()
    else public.professional_contract_shares.share_token
  end,
  expires_at = greatest(public.professional_contract_shares.expires_at, now() + interval '365 days'),
  revoked_at = null,
  updated_at = now();

update public.attention_items attention
set
  action_path = '/documents/share/' || share.share_token::text,
  action_label = 'Open document',
  updated_at = now()
from public.document_requests request
join public.commercial_document_shares share
  on share.document_id = request.response_document_id
where attention.source_type = 'document_request'
  and attention.source_id = request.id
  and attention.recipient_user_id = request.requester_user_id
  and attention.dedupe_key = 'document_request:' || request.id::text || ':requester_update:responded'
  and request.status = 'responded'
  and request.request_type = 'quote';

update public.attention_items attention
set
  action_path = '/contracts/share/' || share.share_token::text,
  action_label = 'Open document',
  updated_at = now()
from public.document_requests request
join public.professional_contract_shares share
  on share.contract_id = request.response_contract_id
where attention.source_type = 'document_request'
  and attention.source_id = request.id
  and attention.recipient_user_id = request.requester_user_id
  and attention.dedupe_key = 'document_request:' || request.id::text || ':requester_update:responded'
  and request.status = 'responded'
  and request.request_type = 'contract';
