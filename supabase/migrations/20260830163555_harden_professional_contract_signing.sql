alter table public.professional_contracts
  add column if not exists content_version integer not null default 1,
  add column if not exists locked_at timestamptz null,
  add column if not exists locked_snapshot jsonb null,
  add column if not exists locked_hash text null;

create table if not exists public.professional_contract_signing_otps (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.professional_contracts(id) on delete cascade,
  share_id uuid not null references public.professional_contract_shares(id) on delete cascade,
  recipient_email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  verified_at timestamptz null,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id)
);

alter table public.professional_contract_signing_otps enable row level security;
revoke all on table public.professional_contract_signing_otps from public, anon, authenticated;
grant all on table public.professional_contract_signing_otps to service_role;

drop trigger if exists update_professional_contract_signing_otps_updated_at on public.professional_contract_signing_otps;
create trigger update_professional_contract_signing_otps_updated_at
before update on public.professional_contract_signing_otps
for each row execute function public.update_updated_at_column();

alter table public.professional_contract_events
  drop constraint if exists professional_contract_events_event_type_check;
alter table public.professional_contract_events
  add constraint professional_contract_events_event_type_check check (
    event_type in (
      'created',
      'share_link_created',
      'share_link_revoked',
      'sent_for_signature',
      'email_sent',
      'share_viewed',
      'signed_by_client',
      'signed_by_issuer',
      'completed',
      'cancelled'
    )
  );

revoke insert, update, delete on table public.professional_contract_shares from authenticated;
revoke insert, update, delete on table public.professional_contract_signers from authenticated;
revoke insert, update, delete on table public.professional_contract_events from authenticated;
grant select on table public.professional_contract_shares to authenticated;
grant select on table public.professional_contract_signers to authenticated;
grant select on table public.professional_contract_events to authenticated;

create or replace function public.build_professional_contract_snapshot(_contract_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _contract public.professional_contracts%rowtype;
  _profile public.profiles%rowtype;
  _listing_name text;
  _listing_email text;
  _listing_phone text;
  _listing_website text;
  _listing_county text;
  _listing_town text;
begin
  select * into _contract
  from public.professional_contracts
  where id = _contract_id;

  if not found then
    raise exception 'Contract not found.';
  end if;

  select * into _profile
  from public.profiles
  where user_id = _contract.user_id;

  if _contract.vendor_listing_id is not null then
    select business_name, email, phone, website, primary_county, primary_town
    into _listing_name, _listing_email, _listing_phone, _listing_website, _listing_county, _listing_town
    from public.vendor_listings
    where id = _contract.vendor_listing_id;
  end if;

  return jsonb_build_object(
    'id', _contract.id,
    'role', _contract.role,
    'title', _contract.title,
    'recipientName', _contract.recipient_name,
    'recipientEmail', _contract.recipient_email,
    'recipientPhone', _contract.recipient_phone,
    'weddingName', _contract.wedding_name,
    'eventDate', _contract.event_date,
    'summary', _contract.summary,
    'terms', _contract.terms,
    'issuerName', coalesce(_listing_name, _profile.company_name, _profile.full_name, 'Zania issuer'),
    'issuerEmail', coalesce(_listing_email, _profile.company_email),
    'issuerPhone', coalesce(_listing_phone, _profile.company_phone),
    'issuerWebsite', coalesce(_listing_website, _profile.company_website),
    'issuerLocation', nullif(trim(both ', ' from concat_ws(', ', _listing_town, _listing_county, _profile.primary_town, _profile.primary_county)), ''),
    'contentVersion', _contract.content_version
  );
end;
$$;

do $$
declare
  _contract_id uuid;
  _snapshot jsonb;
begin
  for _contract_id in
    select id
    from public.professional_contracts
    where locked_snapshot is null
      and status in ('sent', 'awaiting_signature', 'countersigned', 'completed')
  loop
    _snapshot := public.build_professional_contract_snapshot(_contract_id);
    update public.professional_contracts
    set locked_at = coalesce(sent_at, updated_at, created_at),
        locked_snapshot = _snapshot,
        locked_hash = encode(extensions.digest(convert_to(_snapshot::text, 'UTF8'), 'sha256'), 'hex')
    where id = _contract_id;
  end loop;
end;
$$;

create or replace function public.update_professional_contract_draft(
  _contract_id uuid,
  _patch jsonb
)
returns public.professional_contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _contract public.professional_contracts%rowtype;
begin
  if _uid is null then raise exception 'Authentication required'; end if;

  select * into _contract
  from public.professional_contracts
  where id = _contract_id and user_id = _uid
  for update;

  if not found then raise exception 'Contract not found.'; end if;
  if not public.has_active_professional_entitlement(_uid, _contract.role, 'contract_management') then
    raise exception 'Professional plan required for contracts.';
  end if;
  if _contract.locked_at is not null then
    raise exception 'This contract has been sent and can no longer be edited. Create a new contract for revised terms.';
  end if;

  update public.professional_contracts set
    title = case when _patch ? 'title' then nullif(trim(_patch ->> 'title'), '') else title end,
    recipient_name = case when _patch ? 'recipient_name' then nullif(trim(_patch ->> 'recipient_name'), '') else recipient_name end,
    recipient_email = case when _patch ? 'recipient_email' then nullif(trim(_patch ->> 'recipient_email'), '') else recipient_email end,
    recipient_phone = case when _patch ? 'recipient_phone' then nullif(trim(_patch ->> 'recipient_phone'), '') else recipient_phone end,
    wedding_name = case when _patch ? 'wedding_name' then nullif(trim(_patch ->> 'wedding_name'), '') else wedding_name end,
    event_date = case when _patch ? 'event_date' then nullif(_patch ->> 'event_date', '')::date else event_date end,
    summary = case when _patch ? 'summary' then nullif(trim(_patch ->> 'summary'), '') else summary end,
    notes = case when _patch ? 'notes' then nullif(trim(_patch ->> 'notes'), '') else notes end,
    terms = case when _patch ? 'terms' then nullif(trim(_patch ->> 'terms'), '') else terms end,
    content_version = content_version + 1
  where id = _contract_id
  returning * into _contract;

  return _contract;
end;
$$;

create or replace function public.mark_professional_contract_sent(_contract_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _uid uuid := auth.uid();
  _contract public.professional_contracts%rowtype;
  _token uuid;
  _snapshot jsonb;
  _hash text;
begin
  if _uid is null then raise exception 'Authentication required'; end if;

  select * into _contract
  from public.professional_contracts
  where id = _contract_id and user_id = _uid
  for update;

  if not found then raise exception 'Contract not found'; end if;
  if nullif(trim(_contract.recipient_email), '') is null then raise exception 'Add the client email before sending.'; end if;
  if nullif(trim(_contract.summary), '') is null then raise exception 'Add the agreed services before sending.'; end if;
  if nullif(trim(_contract.terms), '') is null then raise exception 'Add the contract terms before sending.'; end if;
  if _contract.summary ~ '\[[^]]+\]' or _contract.terms ~ '\[[^]]+\]' then
    raise exception 'Replace every bracketed placeholder before sending.';
  end if;

  if _contract.locked_at is null then
    _snapshot := public.build_professional_contract_snapshot(_contract.id);
    _hash := encode(extensions.digest(convert_to(_snapshot::text, 'UTF8'), 'sha256'), 'hex');
    update public.professional_contracts set
      locked_at = now(),
      locked_snapshot = _snapshot,
      locked_hash = _hash,
      status = 'awaiting_signature',
      sent_at = coalesce(sent_at, now())
    where id = _contract.id
    returning * into _contract;
  end if;

  _token := public.ensure_professional_contract_share_token(_contract.id);

  if not exists (
    select 1 from public.professional_contract_events
    where contract_id = _contract.id and event_type = 'sent_for_signature'
  ) then
    perform public.append_professional_contract_event(
      _contract.id,
      'sent_for_signature',
      'owner',
      null,
      null,
      jsonb_build_object('content_version', _contract.content_version, 'document_hash', _contract.locked_hash)
    );
  end if;

  return _token;
end;
$$;

create or replace function public.get_shared_professional_contract(_share_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _share public.professional_contract_shares%rowtype;
  _contract public.professional_contracts%rowtype;
  _snapshot jsonb;
  _signers jsonb;
  _events jsonb;
begin
  select * into _share
  from public.professional_contract_shares
  where share_token = _share_token;

  if not found or _share.revoked_at is not null or (_share.expires_at is not null and _share.expires_at <= now()) then
    return null;
  end if;

  select * into _contract
  from public.professional_contracts
  where id = _share.contract_id;

  if not found or _contract.locked_snapshot is null then return null; end if;
  _snapshot := _contract.locked_snapshot;

  update public.professional_contract_shares
  set last_accessed_at = now(), access_count = access_count + 1
  where id = _share.id;

  if coalesce(_share.access_count, 0) = 0 then
    perform public.append_professional_contract_event(
      _contract.id, 'share_viewed', 'public_signer',
      _contract.recipient_name, _contract.recipient_email,
      jsonb_build_object('content_version', _contract.content_version, 'document_hash', _contract.locked_hash)
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'signerRole', signer_role,
    'signerName', signer_name,
    'signerEmail', signer_email,
    'signerTitle', signer_title,
    'signatureMethod', signature_method,
    'signedName', signed_name,
    'signedAt', signed_at
  ) order by case when signer_role = 'issuer' then 0 else 1 end, created_at), '[]'::jsonb)
  into _signers
  from public.professional_contract_signers
  where contract_id = _contract.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'eventType', event_type,
    'actorSource', actor_source,
    'actorName', actor_name,
    'actorEmail', actor_email,
    'payload', payload,
    'createdAt', created_at
  ) order by created_at desc), '[]'::jsonb)
  into _events
  from public.professional_contract_events
  where contract_id = _contract.id;

  return _snapshot || jsonb_build_object(
    'status', _contract.status,
    'sentAt', _contract.sent_at,
    'signedAt', _contract.signed_at,
    'shareExpiresAt', _share.expires_at,
    'documentHash', _contract.locked_hash,
    'lockedAt', _contract.locked_at,
    'signers', _signers,
    'events', _events
  );
end;
$$;

drop function if exists public.sign_shared_professional_contract(uuid, text, text, boolean, text, text, text);
create or replace function public.sign_shared_professional_contract(
  _share_token uuid,
  _signed_name text,
  _verification_code text,
  _agreed_to_terms boolean default false,
  _signer_user_agent text default null,
  _signer_timezone text default null,
  _signer_locale text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _share public.professional_contract_shares%rowtype;
  _contract public.professional_contracts%rowtype;
  _otp public.professional_contract_signing_otps%rowtype;
  _issuer_signed boolean := false;
  _clean_name text := nullif(trim(_signed_name), '');
begin
  if not _agreed_to_terms then raise exception 'Confirm that you agree to the contract.'; end if;
  if _clean_name is null then raise exception 'Enter your full name.'; end if;

  select * into _share
  from public.professional_contract_shares
  where share_token = _share_token;

  if not found or _share.revoked_at is not null or (_share.expires_at is not null and _share.expires_at <= now()) then
    raise exception 'This contract link is no longer active.';
  end if;

  select * into _contract
  from public.professional_contracts
  where id = _share.contract_id
  for update;

  if not found or _contract.locked_snapshot is null then raise exception 'Contract not found.'; end if;
  if _contract.status = 'cancelled' then raise exception 'This contract has been cancelled.'; end if;

  if exists (
    select 1 from public.professional_contract_signers
    where contract_id = _contract.id and signer_role = 'client' and signed_at is not null
  ) then
    return public.get_shared_professional_contract(_share_token);
  end if;

  select * into _otp
  from public.professional_contract_signing_otps
  where contract_id = _contract.id and share_id = _share.id
  for update;

  if not found or _otp.expires_at <= now() then raise exception 'The verification code has expired. Ask the sender to resend the contract.'; end if;
  if _otp.attempt_count >= 5 then raise exception 'Too many incorrect codes. Ask the sender to resend the contract.'; end if;

  update public.professional_contract_signing_otps
  set attempt_count = attempt_count + 1
  where id = _otp.id;

  if _otp.code_hash <> encode(extensions.digest(trim(_verification_code), 'sha256'), 'hex') then
    raise exception 'That verification code is not correct.';
  end if;

  update public.professional_contract_signing_otps
  set verified_at = now()
  where id = _otp.id;

  insert into public.professional_contract_signers (
    contract_id, signer_role, signer_name, signer_email, signer_title,
    signed_name, signed_at, metadata
  ) values (
    _contract.id, 'client', _contract.recipient_name, _otp.recipient_email, 'Client',
    _clean_name, now(), jsonb_build_object(
      'agreed_to_terms', true,
      'email_verified', true,
      'signature_method', 'typed',
      'user_agent', nullif(trim(_signer_user_agent), ''),
      'timezone', nullif(trim(_signer_timezone), ''),
      'locale', nullif(trim(_signer_locale), ''),
      'content_version', _contract.content_version,
      'document_hash', _contract.locked_hash
    )
  );

  perform public.append_professional_contract_event(
    _contract.id, 'signed_by_client', 'public_signer', _clean_name, _otp.recipient_email,
    jsonb_build_object(
      'signature_method', 'typed',
      'email_verified', true,
      'content_version', _contract.content_version,
      'document_hash', _contract.locked_hash
    )
  );

  select exists(select 1 from public.professional_contract_signers
    where contract_id = _contract.id and signer_role = 'issuer' and signed_at is not null)
  into _issuer_signed;

  update public.professional_contracts
  set status = case when _issuer_signed then 'completed' else 'countersigned' end,
      signed_at = case when _issuer_signed then coalesce(signed_at, now()) else signed_at end
  where id = _contract.id;

  if _issuer_signed then perform public.sync_professional_contract_completion_event(_contract.id); end if;
  return public.get_shared_professional_contract(_share_token);
end;
$$;

create or replace function public.sign_owned_professional_contract(
  _contract_id uuid,
  _signed_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _contract public.professional_contracts%rowtype;
  _snapshot jsonb;
  _issuer_name text;
  _issuer_email text;
  _client_signed boolean := false;
  _token uuid;
begin
  if _uid is null then raise exception 'Authentication required'; end if;
  select * into _contract from public.professional_contracts
  where id = _contract_id and user_id = _uid for update;
  if not found then raise exception 'Contract not found'; end if;
  if _contract.locked_snapshot is null then raise exception 'Send the contract before signing it.'; end if;
  if _contract.status = 'cancelled' then raise exception 'This contract has been cancelled.'; end if;

  _snapshot := _contract.locked_snapshot;
  _issuer_name := coalesce(nullif(trim(_signed_name), ''), _snapshot ->> 'issuerName', 'Zania issuer');
  _issuer_email := _snapshot ->> 'issuerEmail';

  if not exists (select 1 from public.professional_contract_signers
    where contract_id = _contract.id and signer_role = 'issuer' and signed_at is not null) then
    insert into public.professional_contract_signers (
      contract_id, signer_role, signer_name, signer_email, signer_title,
      signed_name, signed_at, metadata
    ) values (
      _contract.id, 'issuer', _issuer_name, _issuer_email,
      case when _contract.role = 'planner' then 'Planner' else 'Vendor' end,
      _issuer_name, now(), jsonb_build_object(
        'signed_by_user_id', _uid,
        'content_version', _contract.content_version,
        'document_hash', _contract.locked_hash
      )
    );

    perform public.append_professional_contract_event(
      _contract.id, 'signed_by_issuer', 'owner', _issuer_name, _issuer_email,
      jsonb_build_object('content_version', _contract.content_version, 'document_hash', _contract.locked_hash)
    );
  end if;

  select exists(select 1 from public.professional_contract_signers
    where contract_id = _contract.id and signer_role = 'client' and signed_at is not null)
  into _client_signed;

  update public.professional_contracts
  set status = case when _client_signed then 'completed' else 'awaiting_signature' end,
      signed_at = case when _client_signed then coalesce(signed_at, now()) else signed_at end
  where id = _contract.id;

  if _client_signed then perform public.sync_professional_contract_completion_event(_contract.id); end if;
  select share_token into _token from public.professional_contract_shares where contract_id = _contract.id;
  return public.get_shared_professional_contract(_token);
end;
$$;

drop policy if exists "Users can update own professional contracts" on public.professional_contracts;
revoke update on table public.professional_contracts from authenticated;

drop policy if exists "Users can delete own professional contracts" on public.professional_contracts;
create policy "Users can delete unsigned professional contract drafts"
on public.professional_contracts for delete to authenticated
using (
  (select auth.uid()) = user_id
  and locked_at is null
  and public.has_active_professional_entitlement(user_id, role, 'contract_management')
);

revoke execute on function public.append_professional_contract_event(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.sync_professional_contract_completion_event(uuid) from public, anon, authenticated;
revoke execute on function public.build_professional_contract_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.append_professional_contract_event(uuid, text, text, text, text, jsonb) to service_role;
grant execute on function public.sync_professional_contract_completion_event(uuid) to service_role;
grant execute on function public.build_professional_contract_snapshot(uuid) to service_role;
revoke execute on function public.update_professional_contract_draft(uuid, jsonb) from public, anon;
revoke execute on function public.mark_professional_contract_sent(uuid) from public, anon;
revoke execute on function public.sign_owned_professional_contract(uuid, text) from public, anon;
revoke execute on function public.get_shared_professional_contract(uuid) from public;
revoke execute on function public.sign_shared_professional_contract(uuid, text, text, boolean, text, text, text) from public;
grant execute on function public.update_professional_contract_draft(uuid, jsonb) to authenticated;
grant execute on function public.mark_professional_contract_sent(uuid) to authenticated;
grant execute on function public.sign_owned_professional_contract(uuid, text) to authenticated;
grant execute on function public.get_shared_professional_contract(uuid) to anon, authenticated;
grant execute on function public.sign_shared_professional_contract(uuid, text, text, boolean, text, text, text) to anon, authenticated;

insert into public.professional_document_templates (
  user_id,
  role,
  template_type,
  name,
  description,
  default_title,
  default_notes,
  default_terms,
  default_items,
  metadata
)
select
  account.id,
  'vendor',
  'contract',
  'Mwaniki Weddings Photography Agreement',
  'Wedding photography service agreement with coverage, delivery, payment, cancellation and usage terms.',
  'Wedding photography agreement',
  'Wedding photography coverage for up to 12 hours by two photographers at [enter venue]. Deliverables: all edited photographs through a private online gallery within 4–6 weeks. Total fee: KES [enter amount]. Payment schedule: 50% (KES [amount]) due [date]; 35% (KES [amount]) due [date]; 15% (KES [amount]) due after image delivery.',
  $terms$1. Services and delivery
Mwaniki Weddings will provide wedding photography coverage for the agreed event, including two photographers for up to 12 hours. The finished package will include all edited photographs delivered through a private online gallery. Editing and delivery are expected within 4–6 weeks after the event, subject to any delay caused by circumstances outside reasonable control.

2. Fees and payment
The total package fee and payment dates stated in the service summary form part of this agreement. The payment schedule is 50% to reserve the date, 35% as the agreed instalment and 15% after delivery of the images.

Payments may be made by:
• M-Pesa: 0725 744 695
• I&M Bank: Account 00304656976150, Wilson Muhia Mwaniki
• M-Pesa Paybill 542542 using the bank account number above as the account reference

3. Reservation of the date
The event date is reserved only after this agreement is signed and the reservation payment is received. Mwaniki Weddings may release the date if an agreed payment is not received on time.

4. Copyright and permitted use
The delivered photographs belong to the client. Mwaniki Weddings may only publish or otherwise use the photographs with the client’s permission.

5. Meals, access and accommodation
The client will provide a courtesy meal for the photography team. If no meal is provided, the team may leave the reception for up to 60 minutes to obtain one and will not be responsible for moments missed during that absence. Destination weddings require suitable accommodation for the team.

The client is responsible for obtaining permissions, access and clearances needed for photography and for providing reasonable shelter from unsafe weather or extreme temperatures.

6. Conditions affecting coverage
Venue rules, guest interference, safety conditions, weather, lighting and other physical restrictions may affect the quality or extent of coverage. Mwaniki Weddings will use reasonable professional skill but cannot guarantee images that restrictions or unsafe conditions make impracticable.

7. Postponement and cancellation
If the client postpones or cancels more than three months before the event, amounts paid will be refunded less a reservation fee equal to 25% of the total package price. If cancellation occurs within three months of the event, payments already made are non-refundable.

8. Events outside either party’s control
Mwaniki Weddings will not be liable for delay or non-performance caused by fire, natural disaster, war, terrorism, epidemic or pandemic, government action, national or regional emergency, illness, injury, an act of God or another event outside reasonable control. Mwaniki Weddings will notify the client as soon as reasonably practicable and may work with the client to find an available replacement date.

If no suitable replacement date is agreed, Mwaniki Weddings may refund fees paid less reasonable costs and the value of work already completed, including pre-wedding communication, timeline preparation and equipment preparation. This refund is the limit of Mwaniki Weddings’ liability for the event described in this clause.

9. Disputes and governing law
This agreement is governed by the laws of Kenya. The parties will first try to resolve any dispute through good-faith discussion, considering both parties’ interests. An unresolved dispute may be referred to the appropriate authority or process available under Kenyan law.

10. Acceptance
By signing, each party confirms that they have read, understood and agreed to this contract. The verified electronic signatures recorded by Zania form the signed copy of this agreement.$terms$,
  '[]'::jsonb,
  jsonb_build_object('source', 'mwaniki_general_contract_2026', 'owner_email', 'info@mwaniki.co.ke')
from auth.users account
where lower(account.email) = 'info@mwaniki.co.ke'
on conflict (user_id, name) do update set
  description = excluded.description,
  default_title = excluded.default_title,
  default_notes = excluded.default_notes,
  default_terms = excluded.default_terms,
  metadata = excluded.metadata,
  updated_at = now();
