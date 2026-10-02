alter table public.professional_contracts
  add column if not exists currency text not null default 'KES'
    check (currency ~ '^[A-Z]{3}$'),
  add column if not exists total_amount numeric(14,2)
    check (total_amount is null or total_amount >= 0),
  add column if not exists deposit_amount numeric(14,2)
    check (deposit_amount is null or deposit_amount >= 0),
  add column if not exists payment_schedule jsonb not null default '[]'::jsonb
    check (jsonb_typeof(payment_schedule) = 'array');

alter table public.professional_contracts
  drop constraint if exists professional_contracts_deposit_within_total_check;
alter table public.professional_contracts
  add constraint professional_contracts_deposit_within_total_check
  check (total_amount is null or deposit_amount is null or deposit_amount <= total_amount);

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
  select * into _contract from public.professional_contracts where id = _contract_id;
  if not found then raise exception 'Contract not found.'; end if;
  select * into _profile from public.profiles where user_id = _contract.user_id;

  if _contract.vendor_listing_id is not null then
    select business_name, email, phone, website, location_county, location_town
    into _listing_name, _listing_email, _listing_phone, _listing_website, _listing_county, _listing_town
    from public.vendor_listings where id = _contract.vendor_listing_id;
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
    'currency', _contract.currency,
    'totalAmount', _contract.total_amount,
    'depositAmount', _contract.deposit_amount,
    'paymentSchedule', _contract.payment_schedule,
    'issuerName', coalesce(_listing_name, _profile.company_name, _profile.full_name, 'Zania issuer'),
    'issuerEmail', coalesce(_listing_email, _profile.company_email),
    'issuerPhone', coalesce(_listing_phone, _profile.company_phone),
    'issuerWebsite', coalesce(_listing_website, _profile.company_website),
    'issuerLocation', nullif(trim(both ', ' from concat_ws(', ', _listing_town, _listing_county, _profile.primary_town, _profile.primary_county)), ''),
    'contentVersion', _contract.content_version
  );
end;
$$;

create or replace function public.update_professional_contract_draft(
  _contract_id uuid,
  _patch jsonb
)
returns public.professional_contracts
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _contract public.professional_contracts%rowtype;
  _schedule jsonb;
  _currency text;
  _total numeric;
  _deposit numeric;
begin
  if _uid is null then raise exception 'Authentication required'; end if;
  select * into _contract from public.professional_contracts
  where id = _contract_id and user_id = _uid for update;
  if not found then raise exception 'Contract not found.'; end if;
  if not public.has_active_professional_entitlement(_uid, _contract.role, 'contract_management') then
    raise exception 'Professional plan required for contracts.';
  end if;
  if _contract.locked_at is not null then
    raise exception 'This contract has been sent and can no longer be edited. Create a new contract for revised terms.';
  end if;

  _currency := case when _patch ? 'currency' then upper(nullif(btrim(_patch ->> 'currency'), '')) else _contract.currency end;
  if _currency is null or _currency !~ '^[A-Z]{3}$' then raise exception 'Use a valid three-letter currency code.'; end if;
  _total := case when _patch ? 'total_amount' then nullif(_patch ->> 'total_amount', '')::numeric else _contract.total_amount end;
  _deposit := case when _patch ? 'deposit_amount' then nullif(_patch ->> 'deposit_amount', '')::numeric else _contract.deposit_amount end;
  _schedule := case when _patch ? 'payment_schedule' then coalesce(_patch -> 'payment_schedule', '[]'::jsonb) else _contract.payment_schedule end;
  if _total is not null and _total < 0 then raise exception 'Contract total cannot be negative.'; end if;
  if _deposit is not null and (_deposit < 0 or (_total is not null and _deposit > _total)) then raise exception 'Deposit must be between zero and the contract total.'; end if;
  if jsonb_typeof(_schedule) <> 'array' or jsonb_array_length(_schedule) > 20 then raise exception 'Payment schedule must contain at most 20 rows.'; end if;
  if exists (
    select 1 from jsonb_array_elements(_schedule) entry
    where nullif(btrim(entry ->> 'title'), '') is null
      or not case
        when coalesce(entry ->> 'amount', '') ~ '^\d+(\.\d{1,2})?$'
        then (entry ->> 'amount')::numeric > 0
        else false
      end
      or coalesce(entry ->> 'dueDate', '') !~ '^\d{4}-\d{2}-\d{2}$'
  ) then raise exception 'Every payment schedule row needs a title, positive amount and due date.'; end if;

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
    metadata = (case when _patch ? 'metadata' then coalesce(_patch -> 'metadata', '{}'::jsonb) else metadata end)
      || jsonb_build_object('currency', _currency, 'totalAmount', _total, 'depositAmount', _deposit),
    currency = _currency,
    total_amount = _total,
    deposit_amount = _deposit,
    payment_schedule = _schedule,
    content_version = content_version + 1
  where id = _contract_id returning * into _contract;
  return _contract;
end;
$$;

drop trigger if exists refresh_vendor_agreement_from_contract_trigger on public.professional_contracts;
create trigger refresh_vendor_agreement_from_contract_trigger
after update of status, signed_at, event_date, summary, terms, metadata, locked_snapshot,
  currency, total_amount, deposit_amount, payment_schedule
on public.professional_contracts
for each row execute function public.refresh_vendor_agreement_from_contract();

create or replace function public.get_agreement_review(_wedding_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if _wedding_id is null or not public.is_wedding_member(_wedding_id) then raise exception 'Wedding access required'; end if;

  return jsonb_build_object('agreements', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', agreement.id,
      'vendorName', coalesce(vendor.name, 'Vendor'),
      'state', agreement.state,
      'reviewStatus', agreement.review_status,
      'acceptedQuote', agreement.accepted_quote_snapshot,
      'contractId', agreement.contract_id,
      'contractTitle', agreement.contract_snapshot ->> 'title',
      'contractStatus', contract.status,
      'contractFinancials', case when contract.id is null then null else jsonb_build_object(
        'currency', contract.currency,
        'totalAmount', contract.total_amount,
        'depositAmount', contract.deposit_amount,
        'paymentSchedule', contract.payment_schedule
      ) end,
      'proposedObligations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'kind', 'payment',
          'title', btrim(entry ->> 'title'),
          'amount', (entry ->> 'amount')::numeric,
          'currency', contract.currency,
          'dueDate', entry ->> 'dueDate',
          'source', 'contract_payment_schedule'
        ) order by entry_index)
        from jsonb_array_elements(contract.payment_schedule) with ordinality schedule(entry, entry_index)
        where nullif(btrim(entry ->> 'title'), '') is not null
          and coalesce(entry ->> 'amount', '') ~ '^\d+(\.\d{1,2})?$'
          and coalesce(entry ->> 'dueDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
      ), '[]'::jsonb),
      'comparison', agreement.comparison,
      'discrepancyCount', agreement.discrepancy_count,
      'unknownCount', agreement.unknown_count,
      'comparedAt', agreement.compared_at
    ) order by agreement.updated_at desc)
    from public.vendor_agreement_records agreement
    left join public.vendors vendor on vendor.id = agreement.vendor_id
    left join public.professional_contracts contract on contract.id = agreement.contract_id
    where agreement.wedding_id = _wedding_id
  ), '[]'::jsonb));
end;
$$;

revoke all on function public.get_agreement_review(uuid) from public, anon;
grant execute on function public.get_agreement_review(uuid) to authenticated;

notify pgrst, 'reload schema';
