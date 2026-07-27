create or replace function public.get_couple_vendor_contract(_vendor_id uuid)
returns table (
  contract_id uuid,
  title text,
  status text,
  sent_at timestamptz,
  signed_at timestamptz,
  updated_at timestamptz,
  share_token uuid,
  share_expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _requester_id uuid := auth.uid();
begin
  if _requester_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.vendors as vendor
    where vendor.id = _vendor_id
      and (
        vendor.user_id = _requester_id
        or exists (
          select 1
          from public.planner_clients as client
          where client.planner_user_id = _requester_id
            and (
              client.id = vendor.client_id
              or client.linked_user_id = vendor.user_id
            )
        )
      )
  ) then
    raise exception 'Vendor not found or access denied';
  end if;

  return query
  select
    contract.id,
    contract.title,
    contract.status,
    contract.sent_at,
    contract.signed_at,
    contract.updated_at,
    case
      when contract.status in ('sent', 'awaiting_signature', 'countersigned', 'completed')
        and share.revoked_at is null
        and (share.expires_at is null or share.expires_at > now())
      then share.share_token
      else null
    end as share_token,
    case
      when share.revoked_at is null
        and (share.expires_at is null or share.expires_at > now())
      then share.expires_at
      else null
    end as share_expires_at
  from public.professional_contracts as contract
  left join public.professional_contract_shares as share
    on share.contract_id = contract.id
  where contract.vendor_id = _vendor_id
  order by contract.created_at desc
  limit 1;
end;
$$;

revoke all on function public.get_couple_vendor_contract(uuid) from public;
revoke all on function public.get_couple_vendor_contract(uuid) from anon;
grant execute on function public.get_couple_vendor_contract(uuid) to authenticated;
