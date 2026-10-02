create or replace function public.cancel_professional_contract(_contract_id uuid)
returns public.professional_contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  _contract public.professional_contracts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  select * into _contract
  from public.professional_contracts
  where id = _contract_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Contract not found.';
  end if;
  if _contract.status = 'completed' then
    raise exception 'A completed contract cannot be cancelled.';
  end if;
  if _contract.status = 'cancelled' then
    return _contract;
  end if;

  update public.professional_contracts
  set status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
  where id = _contract_id
  returning * into _contract;

  update public.professional_contract_shares
  set revoked_at = coalesce(revoked_at, now()),
      updated_at = now()
  where contract_id = _contract_id;

  perform public.append_professional_contract_event(
    _contract_id,
    'cancelled',
    'owner',
    null,
    null,
    jsonb_build_object('cancelled_at', _contract.cancelled_at)
  );

  return _contract;
end;
$$;

revoke all on function public.cancel_professional_contract(uuid) from public, anon;
grant execute on function public.cancel_professional_contract(uuid) to authenticated;
