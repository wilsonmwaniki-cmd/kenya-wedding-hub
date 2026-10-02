drop function if exists public.sign_shared_professional_contract(uuid, text, text, boolean);

create or replace function public.refresh_professional_contract_share_token(_contract_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _contract public.professional_contracts%rowtype;
  _share public.professional_contract_shares%rowtype;
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
  on conflict (contract_id)
  do update set
    share_token = gen_random_uuid(),
    expires_at = now() + interval '90 days',
    revoked_at = null,
    last_accessed_at = null,
    access_count = 0,
    updated_at = now()
  returning * into _share;

  perform public.append_professional_contract_event(
    _contract.id,
    'share_link_created',
    'owner',
    null,
    null,
    jsonb_build_object('share_token', _share.share_token, 'refreshed', true)
  );

  return _share.share_token;
end;
$$;

create or replace function public.revoke_professional_contract_share_token(_contract_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _contract public.professional_contracts%rowtype;
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

  update public.professional_contract_shares
    set revoked_at = now(),
        updated_at = now()
  where contract_id = _contract.id;

  perform public.append_professional_contract_event(
    _contract.id,
    'share_link_revoked',
    'owner',
    null,
    null,
    jsonb_build_object('revoked', true)
  );
end;
$$;

create or replace function public.sign_shared_professional_contract(
  _share_token uuid,
  _signed_name text,
  _signer_email text default null,
  _agreed_to_terms boolean default false,
  _signer_user_agent text default null,
  _signer_timezone text default null,
  _signer_locale text default null
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
    jsonb_build_object(
      'agreed_to_terms', true,
      'user_agent', nullif(trim(_signer_user_agent), ''),
      'timezone', nullif(trim(_signer_timezone), ''),
      'locale', nullif(trim(_signer_locale), '')
    )
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
    jsonb_build_object(
      'signature_method', 'typed',
      'timezone', nullif(trim(_signer_timezone), ''),
      'locale', nullif(trim(_signer_locale), '')
    )
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

grant execute on function public.refresh_professional_contract_share_token(uuid) to authenticated;
grant execute on function public.revoke_professional_contract_share_token(uuid) to authenticated;
grant execute on function public.sign_shared_professional_contract(uuid, text, text, boolean, text, text, text) to anon, authenticated;
