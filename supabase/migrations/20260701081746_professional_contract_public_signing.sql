create table if not exists public.professional_contract_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contract_id uuid not null references public.professional_contracts(id) on delete cascade,
  share_token uuid not null default gen_random_uuid(),
  expires_at timestamptz null,
  revoked_at timestamptz null,
  last_accessed_at timestamptz null,
  access_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_contract_shares_contract_id_key unique (contract_id),
  constraint professional_contract_shares_share_token_key unique (share_token)
);

create table if not exists public.professional_contract_signers (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.professional_contracts(id) on delete cascade,
  signer_role text not null check (signer_role in ('issuer', 'client')),
  signer_name text not null,
  signer_email text null,
  signer_title text null,
  signature_method text not null default 'typed' check (signature_method in ('typed')),
  signed_name text null,
  signed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_contract_signers_contract_role_key unique (contract_id, signer_role)
);

create table if not exists public.professional_contract_events (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.professional_contracts(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'created',
      'share_link_created',
      'sent_for_signature',
      'share_viewed',
      'signed_by_client',
      'signed_by_issuer',
      'completed',
      'cancelled'
    )
  ),
  actor_source text not null default 'system' check (actor_source in ('system', 'owner', 'public_signer')),
  actor_name text null,
  actor_email text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists professional_contract_shares_user_id_idx
  on public.professional_contract_shares (user_id);
create index if not exists professional_contract_shares_contract_id_idx
  on public.professional_contract_shares (contract_id);
create index if not exists professional_contract_shares_share_token_idx
  on public.professional_contract_shares (share_token);
create index if not exists professional_contract_signers_contract_id_idx
  on public.professional_contract_signers (contract_id);
create index if not exists professional_contract_events_contract_id_idx
  on public.professional_contract_events (contract_id, created_at desc);

alter table public.professional_contract_shares enable row level security;
alter table public.professional_contract_signers enable row level security;
alter table public.professional_contract_events enable row level security;

grant select, insert, update, delete on public.professional_contract_shares to authenticated;
grant select, insert, update, delete on public.professional_contract_signers to authenticated;
grant select, insert, update, delete on public.professional_contract_events to authenticated;

drop policy if exists "Users can manage own professional contract shares" on public.professional_contract_shares;
create policy "Users can manage own professional contract shares"
on public.professional_contract_shares
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage signers for own professional contracts" on public.professional_contract_signers;
create policy "Users can manage signers for own professional contracts"
on public.professional_contract_signers
for all
to authenticated
using (
  exists (
    select 1
    from public.professional_contracts pc
    where pc.id = professional_contract_signers.contract_id
      and pc.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.professional_contracts pc
    where pc.id = professional_contract_signers.contract_id
      and pc.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage events for own professional contracts" on public.professional_contract_events;
create policy "Users can manage events for own professional contracts"
on public.professional_contract_events
for all
to authenticated
using (
  exists (
    select 1
    from public.professional_contracts pc
    where pc.id = professional_contract_events.contract_id
      and pc.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.professional_contracts pc
    where pc.id = professional_contract_events.contract_id
      and pc.user_id = auth.uid()
  )
);

drop trigger if exists update_professional_contract_shares_updated_at on public.professional_contract_shares;
create trigger update_professional_contract_shares_updated_at
before update on public.professional_contract_shares
for each row execute function public.update_updated_at_column();

drop trigger if exists update_professional_contract_signers_updated_at on public.professional_contract_signers;
create trigger update_professional_contract_signers_updated_at
before update on public.professional_contract_signers
for each row execute function public.update_updated_at_column();

create or replace function public.append_professional_contract_event(
  _contract_id uuid,
  _event_type text,
  _actor_source text default 'system',
  _actor_name text default null,
  _actor_email text default null,
  _payload jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.professional_contract_events (
    contract_id,
    event_type,
    actor_source,
    actor_name,
    actor_email,
    payload
  )
  values (
    _contract_id,
    _event_type,
    _actor_source,
    _actor_name,
    _actor_email,
    coalesce(_payload, '{}'::jsonb)
  );
$$;

create or replace function public.sync_professional_contract_completion_event(_contract_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _contract public.professional_contracts%rowtype;
begin
  select *
    into _contract
  from public.professional_contracts
  where id = _contract_id;

  if not found then
    return;
  end if;

  if _contract.status = 'completed' then
    if not exists (
      select 1
      from public.professional_contract_events e
      where e.contract_id = _contract_id
        and e.event_type = 'completed'
    ) then
      perform public.append_professional_contract_event(
        _contract_id,
        'completed',
        'system',
        null,
        null,
        jsonb_build_object('status', _contract.status)
      );
    end if;
  end if;
end;
$$;

create or replace function public.ensure_professional_contract_share_token(_contract_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _contract public.professional_contracts%rowtype;
  _share_token uuid;
begin
  if _uid is null then
    raise exception 'Authentication required';
  end if;

  select *
    into _contract
  from public.professional_contracts
  where id = _contract_id
    and user_id = _uid;

  if not found then
    raise exception 'Contract not found';
  end if;

  select share_token
    into _share_token
  from public.professional_contract_shares
  where contract_id = _contract.id;

  if _share_token is not null then
    return _share_token;
  end if;

  insert into public.professional_contract_shares (
    user_id,
    contract_id,
    expires_at
  )
  values (
    _uid,
    _contract.id,
    now() + interval '90 days'
  )
  returning share_token into _share_token;

  perform public.append_professional_contract_event(
    _contract.id,
    'share_link_created',
    'owner',
    null,
    null,
    jsonb_build_object('share_token', _share_token)
  );

  return _share_token;
end;
$$;

create or replace function public.mark_professional_contract_sent(_contract_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _contract public.professional_contracts%rowtype;
  _token uuid;
begin
  if _uid is null then
    raise exception 'Authentication required';
  end if;

  select *
    into _contract
  from public.professional_contracts
  where id = _contract_id
    and user_id = _uid;

  if not found then
    raise exception 'Contract not found';
  end if;

  _token := public.ensure_professional_contract_share_token(_contract.id);

  if _contract.status in ('draft', 'sent') then
    update public.professional_contracts
      set status = 'awaiting_signature',
          sent_at = coalesce(sent_at, now())
    where id = _contract.id;
  end if;

  perform public.append_professional_contract_event(
    _contract.id,
    'sent_for_signature',
    'owner',
    null,
    null,
    jsonb_build_object('share_token', _token)
  );

  return _token;
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
  _profile public.profiles%rowtype;
  _listing record;
  _issuer_name text;
  _issuer_email text;
  _client_signed boolean := false;
begin
  if _uid is null then
    raise exception 'Authentication required';
  end if;

  select *
    into _contract
  from public.professional_contracts
  where id = _contract_id
    and user_id = _uid;

  if not found then
    raise exception 'Contract not found';
  end if;

  select *
    into _profile
  from public.profiles
  where user_id = _uid;

  if _contract.vendor_listing_id is not null then
    select business_name, email
      into _listing
    from public.vendor_listings
    where id = _contract.vendor_listing_id;
  end if;

  _issuer_name := coalesce(
    nullif(trim(_signed_name), ''),
    _listing.business_name,
    _profile.company_name,
    _profile.full_name,
    'Zania issuer'
  );
  _issuer_email := coalesce(_listing.email, _profile.company_email);

  insert into public.professional_contract_signers (
    contract_id,
    signer_role,
    signer_name,
    signer_email,
    signer_title,
    signed_name,
    signed_at,
    metadata
  )
  values (
    _contract.id,
    'issuer',
    _issuer_name,
    _issuer_email,
    case when _contract.role = 'planner' then 'Planner' else 'Vendor' end,
    _issuer_name,
    now(),
    jsonb_build_object('signed_by_user_id', _uid)
  )
  on conflict (contract_id, signer_role)
  do update set
    signer_name = excluded.signer_name,
    signer_email = excluded.signer_email,
    signer_title = excluded.signer_title,
    signed_name = excluded.signed_name,
    signed_at = coalesce(public.professional_contract_signers.signed_at, excluded.signed_at),
    metadata = public.professional_contract_signers.metadata || excluded.metadata,
    updated_at = now();

  perform public.append_professional_contract_event(
    _contract.id,
    'signed_by_issuer',
    'owner',
    _issuer_name,
    _issuer_email,
    '{}'::jsonb
  );

  select exists(
    select 1
    from public.professional_contract_signers pcs
    where pcs.contract_id = _contract.id
      and pcs.signer_role = 'client'
      and pcs.signed_at is not null
  ) into _client_signed;

  update public.professional_contracts
    set status = case when _client_signed then 'completed' else 'awaiting_signature' end,
        sent_at = coalesce(sent_at, now()),
        signed_at = case when _client_signed then coalesce(signed_at, now()) else signed_at end
  where id = _contract.id;

  if _client_signed then
    perform public.sync_professional_contract_completion_event(_contract.id);
  end if;

  return public.get_shared_professional_contract(
    (select share_token from public.professional_contract_shares where contract_id = _contract.id)
  );
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
  _profile public.profiles%rowtype;
  _listing record;
  _issuer_name text;
  _issuer_email text;
  _issuer_phone text;
  _issuer_website text;
  _issuer_location text;
  _signers jsonb;
  _events jsonb;
begin
  select *
    into _share
  from public.professional_contract_shares
  where share_token = _share_token;

  if not found or _share.revoked_at is not null or (_share.expires_at is not null and _share.expires_at <= now()) then
    return null;
  end if;

  select *
    into _contract
  from public.professional_contracts
  where id = _share.contract_id;

  if not found then
    return null;
  end if;

  select *
    into _profile
  from public.profiles
  where user_id = _share.user_id;

  if _contract.vendor_listing_id is not null then
    select
      business_name,
      email,
      phone,
      website,
      primary_county,
      primary_town
    into _listing
    from public.vendor_listings
    where id = _contract.vendor_listing_id;
  end if;

  _issuer_name := coalesce(_listing.business_name, _profile.company_name, _profile.full_name, 'Zania issuer');
  _issuer_email := coalesce(_listing.email, _profile.company_email);
  _issuer_phone := coalesce(_listing.phone, _profile.company_phone);
  _issuer_website := coalesce(_listing.website, _profile.company_website);
  _issuer_location := trim(both ', ' from concat_ws(', ', _listing.primary_town, _listing.primary_county, _profile.primary_town, _profile.primary_county));

  update public.professional_contract_shares
    set last_accessed_at = now(),
        access_count = access_count + 1
  where id = _share.id;

  if coalesce(_share.access_count, 0) = 0 then
    perform public.append_professional_contract_event(
      _contract.id,
      'share_viewed',
      'public_signer',
      _contract.recipient_name,
      _contract.recipient_email,
      '{}'::jsonb
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', pcs.id,
        'signerRole', pcs.signer_role,
        'signerName', pcs.signer_name,
        'signerEmail', pcs.signer_email,
        'signerTitle', pcs.signer_title,
        'signatureMethod', pcs.signature_method,
        'signedName', pcs.signed_name,
        'signedAt', pcs.signed_at
      )
      order by case when pcs.signer_role = 'issuer' then 0 else 1 end, pcs.created_at asc
    ),
    '[]'::jsonb
  )
  into _signers
  from public.professional_contract_signers pcs
  where pcs.contract_id = _contract.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', pce.id,
        'eventType', pce.event_type,
        'actorSource', pce.actor_source,
        'actorName', pce.actor_name,
        'actorEmail', pce.actor_email,
        'payload', pce.payload,
        'createdAt', pce.created_at
      )
      order by pce.created_at desc
    ),
    '[]'::jsonb
  )
  into _events
  from public.professional_contract_events pce
  where pce.contract_id = _contract.id;

  return jsonb_build_object(
    'id', _contract.id,
    'role', _contract.role,
    'title', _contract.title,
    'status', _contract.status,
    'recipientName', _contract.recipient_name,
    'recipientEmail', _contract.recipient_email,
    'recipientPhone', _contract.recipient_phone,
    'weddingName', _contract.wedding_name,
    'eventDate', _contract.event_date,
    'sentAt', _contract.sent_at,
    'signedAt', _contract.signed_at,
    'summary', _contract.summary,
    'notes', _contract.notes,
    'terms', _contract.terms,
    'issuerName', _issuer_name,
    'issuerEmail', _issuer_email,
    'issuerPhone', _issuer_phone,
    'issuerWebsite', _issuer_website,
    'issuerLocation', nullif(_issuer_location, ''),
    'shareExpiresAt', _share.expires_at,
    'signers', _signers,
    'events', _events
  );
end;
$$;

create or replace function public.sign_shared_professional_contract(
  _share_token uuid,
  _signed_name text,
  _signer_email text default null,
  _agreed_to_terms boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _share public.professional_contract_shares%rowtype;
  _contract public.professional_contracts%rowtype;
  _issuer_signed boolean := false;
  _clean_name text := nullif(trim(_signed_name), '');
  _clean_email text := nullif(trim(_signer_email), '');
begin
  if not _agreed_to_terms then
    raise exception 'You must agree to the contract terms before signing.';
  end if;

  if _clean_name is null then
    raise exception 'Please type your full name to sign this contract.';
  end if;

  select *
    into _share
  from public.professional_contract_shares
  where share_token = _share_token;

  if not found or _share.revoked_at is not null or (_share.expires_at is not null and _share.expires_at <= now()) then
    raise exception 'This contract link is no longer active.';
  end if;

  select *
    into _contract
  from public.professional_contracts
  where id = _share.contract_id;

  if not found then
    raise exception 'Contract not found.';
  end if;

  insert into public.professional_contract_signers (
    contract_id,
    signer_role,
    signer_name,
    signer_email,
    signer_title,
    signed_name,
    signed_at,
    metadata
  )
  values (
    _contract.id,
    'client',
    _contract.recipient_name,
    coalesce(_clean_email, _contract.recipient_email),
    'Client',
    _clean_name,
    now(),
    jsonb_build_object('agreed_to_terms', true)
  )
  on conflict (contract_id, signer_role)
  do update set
    signer_email = coalesce(excluded.signer_email, public.professional_contract_signers.signer_email),
    signed_name = coalesce(public.professional_contract_signers.signed_name, excluded.signed_name),
    signed_at = coalesce(public.professional_contract_signers.signed_at, excluded.signed_at),
    metadata = public.professional_contract_signers.metadata || excluded.metadata,
    updated_at = now();

  perform public.append_professional_contract_event(
    _contract.id,
    'signed_by_client',
    'public_signer',
    _clean_name,
    coalesce(_clean_email, _contract.recipient_email),
    '{}'::jsonb
  );

  select exists(
    select 1
    from public.professional_contract_signers pcs
    where pcs.contract_id = _contract.id
      and pcs.signer_role = 'issuer'
      and pcs.signed_at is not null
  ) into _issuer_signed;

  update public.professional_contracts
    set status = case when _issuer_signed then 'completed' else 'countersigned' end,
        sent_at = coalesce(sent_at, now()),
        signed_at = case when _issuer_signed then coalesce(signed_at, now()) else signed_at end
  where id = _contract.id;

  if _issuer_signed then
    perform public.sync_professional_contract_completion_event(_contract.id);
  end if;

  return public.get_shared_professional_contract(_share_token);
end;
$$;

create or replace function public.seed_professional_contract_created_events()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.professional_contract_events (
    contract_id,
    event_type,
    actor_source,
    payload,
    created_at
  )
  select
    pc.id,
    'created',
    'system',
    jsonb_build_object('status', pc.status),
    pc.created_at
  from public.professional_contracts pc
  where not exists (
    select 1
    from public.professional_contract_events e
    where e.contract_id = pc.id
      and e.event_type = 'created'
  );
$$;

create or replace function public.handle_professional_contract_created_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.append_professional_contract_event(
    new.id,
    'created',
    'system',
    null,
    null,
    jsonb_build_object('status', new.status)
  );
  return new;
end;
$$;

select public.seed_professional_contract_created_events();

drop trigger if exists professional_contract_created_event_trigger on public.professional_contracts;
create trigger professional_contract_created_event_trigger
after insert on public.professional_contracts
for each row execute function public.handle_professional_contract_created_event();

grant execute on function public.append_professional_contract_event(uuid, text, text, text, text, jsonb) to authenticated;
grant execute on function public.sync_professional_contract_completion_event(uuid) to authenticated;
grant execute on function public.ensure_professional_contract_share_token(uuid) to authenticated;
grant execute on function public.mark_professional_contract_sent(uuid) to authenticated;
grant execute on function public.sign_owned_professional_contract(uuid, text) to authenticated;
grant execute on function public.get_shared_professional_contract(uuid) to anon, authenticated;
grant execute on function public.sign_shared_professional_contract(uuid, text, text, boolean) to anon, authenticated;
