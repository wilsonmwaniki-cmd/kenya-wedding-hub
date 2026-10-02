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
  if nullif(trim(_contract.terms), '') is null then raise exception 'Add the contract terms before sending.'; end if;
  if _contract.terms ~ '\[[^]]+\]' then
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

revoke execute on function public.mark_professional_contract_sent(uuid) from public, anon;
grant execute on function public.mark_professional_contract_sent(uuid) to authenticated;
