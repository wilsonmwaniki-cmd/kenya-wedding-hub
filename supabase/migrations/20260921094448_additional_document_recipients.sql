-- Additional recipients are stored in the existing private document metadata.
-- Contract draft updates go through this owner-checked function, so explicitly
-- allow metadata changes while preserving the same entitlement and lock checks.
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
    metadata = case when _patch ? 'metadata' then coalesce(_patch -> 'metadata', '{}'::jsonb) else metadata end,
    content_version = content_version + 1
  where id = _contract_id
  returning * into _contract;

  return _contract;
end;
$$;
