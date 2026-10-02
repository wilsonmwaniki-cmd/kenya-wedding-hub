insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('external-contract-ingestion', 'external-contract-ingestion', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload their temporary contracts" on storage.objects;
create policy "Users upload their temporary contracts"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'external-contract-ingestion'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users read their temporary contracts" on storage.objects;
create policy "Users read their temporary contracts"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'external-contract-ingestion'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete their temporary contracts" on storage.objects;
create policy "Users delete their temporary contracts"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'external-contract-ingestion'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create table if not exists public.external_contract_ingestions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  agreement_id uuid references public.vendor_agreement_records(id) on delete set null,
  original_filename text not null,
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  storage_path text not null unique,
  status text not null default 'awaiting_upload' check (status in (
    'awaiting_upload', 'processing', 'extracted_pending_cleanup', 'extracted', 'confirmed', 'failed', 'discarded'
  )),
  extracted_data jsonb,
  confirmed_data jsonb,
  extraction_model text,
  provider_request_id text,
  failure_message text,
  extracted_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  file_deleted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (extracted_data is null or jsonb_typeof(extracted_data) = 'object'),
  check (confirmed_data is null or jsonb_typeof(confirmed_data) = 'object')
);

create index if not exists external_contract_ingestions_wedding_idx
  on public.external_contract_ingestions (wedding_id, created_at desc);
create index if not exists external_contract_ingestions_expiry_idx
  on public.external_contract_ingestions (expires_at)
  where file_deleted_at is null and status not in ('discarded', 'confirmed');

alter table public.external_contract_ingestions enable row level security;
drop policy if exists "Wedding members view external contract ingestions" on public.external_contract_ingestions;
create policy "Wedding members view external contract ingestions"
  on public.external_contract_ingestions for select to authenticated
  using (public.is_wedding_member(wedding_id));

revoke all on table public.external_contract_ingestions from public, anon, authenticated;
grant select on table public.external_contract_ingestions to authenticated;

create or replace function public.create_external_contract_ingestion(
  _wedding_id uuid,
  _agreement_id uuid,
  _filename text,
  _mime_type text,
  _size_bytes bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_id uuid := gen_random_uuid();
  safe_filename text;
  saved_path text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if _wedding_id is null or not public.is_wedding_member(_wedding_id) then raise exception 'Wedding access required'; end if;
  if _mime_type is distinct from 'application/pdf' then raise exception 'Only PDF contracts are supported'; end if;
  if coalesce(_size_bytes, 0) <= 0 or _size_bytes > 10485760 then raise exception 'Contract file must be 10 MB or smaller'; end if;
  safe_filename := left(regexp_replace(coalesce(nullif(btrim(_filename), ''), 'contract.pdf'), '[^a-zA-Z0-9._-]+', '-', 'g'), 180);
  if lower(right(safe_filename, 4)) <> '.pdf' then safe_filename := safe_filename || '.pdf'; end if;
  if _agreement_id is not null and not exists (
    select 1 from public.vendor_agreement_records agreement
    where agreement.id = _agreement_id and agreement.wedding_id = _wedding_id
  ) then raise exception 'Agreement does not belong to this wedding'; end if;
  saved_path := auth.uid()::text || '/' || saved_id::text || '/' || safe_filename;
  insert into public.external_contract_ingestions (
    id, owner_user_id, wedding_id, agreement_id, original_filename, mime_type, size_bytes, storage_path
  ) values (
    saved_id, auth.uid(), _wedding_id, _agreement_id, safe_filename, _mime_type, _size_bytes, saved_path
  );
  return jsonb_build_object('id', saved_id, 'storagePath', saved_path, 'expiresAt', now() + interval '24 hours');
end;
$$;

create or replace function public.confirm_external_contract_ingestion(
  _ingestion_id uuid,
  _confirmed_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ingestion public.external_contract_ingestions%rowtype;
  agreement public.vendor_agreement_records%rowtype;
  cleaned jsonb;
  schedule jsonb;
  item jsonb;
  total_amount numeric;
  deposit_amount numeric;
  currency_code text;
  event_date date;
  findings jsonb := '[]'::jsonb;
  found_discrepancies integer := 0;
  found_unknowns integer := 0;
  quote_amount numeric;
  quote_currency text;
  quote_event_date date;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into ingestion from public.external_contract_ingestions where id = _ingestion_id for update;
  if ingestion.id is null or not public.is_wedding_member(ingestion.wedding_id) then raise exception 'Contract extraction not found'; end if;
  if ingestion.status <> 'extracted' or ingestion.file_deleted_at is null then raise exception 'Contract extraction is not ready for confirmation'; end if;
  if _confirmed_data is null or jsonb_typeof(_confirmed_data) <> 'object' then raise exception 'Confirmed contract facts are required'; end if;

  currency_code := upper(nullif(btrim(_confirmed_data ->> 'currency'), ''));
  if currency_code is not null and currency_code !~ '^[A-Z]{3}$' then raise exception 'Currency must use a three-letter code'; end if;
  if coalesce(_confirmed_data ->> 'totalAmount', '') <> '' then
    if (_confirmed_data ->> 'totalAmount') !~ '^\d+(\.\d{1,2})?$' then raise exception 'Total amount is invalid'; end if;
    total_amount := (_confirmed_data ->> 'totalAmount')::numeric;
  end if;
  if coalesce(_confirmed_data ->> 'depositAmount', '') <> '' then
    if (_confirmed_data ->> 'depositAmount') !~ '^\d+(\.\d{1,2})?$' then raise exception 'Deposit amount is invalid'; end if;
    deposit_amount := (_confirmed_data ->> 'depositAmount')::numeric;
  end if;
  if total_amount is not null and deposit_amount is not null and deposit_amount > total_amount then raise exception 'Deposit cannot exceed the total'; end if;
  if coalesce(_confirmed_data ->> 'eventDate', '') <> '' then
    if (_confirmed_data ->> 'eventDate') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Event date is invalid'; end if;
    event_date := (_confirmed_data ->> 'eventDate')::date;
  end if;
  schedule := coalesce(_confirmed_data -> 'paymentSchedule', '[]'::jsonb);
  if jsonb_typeof(schedule) <> 'array' or jsonb_array_length(schedule) > 24 then raise exception 'Payment schedule is invalid'; end if;
  for item in select value from jsonb_array_elements(schedule) loop
    if nullif(btrim(item ->> 'title'), '') is null
      or coalesce(item ->> 'amount', '') !~ '^\d+(\.\d{1,2})?$'
      or coalesce(item ->> 'dueDate', '') !~ '^\d{4}-\d{2}-\d{2}$'
    then raise exception 'Each payment requires a title, amount and due date'; end if;
  end loop;

  cleaned := jsonb_build_object(
    'sourceType', 'external_pdf', 'ingestionId', ingestion.id,
    'title', ingestion.original_filename,
    'vendorName', nullif(btrim(_confirmed_data ->> 'vendorName'), ''),
    'clientName', nullif(btrim(_confirmed_data ->> 'clientName'), ''),
    'eventDate', event_date, 'location', nullif(btrim(_confirmed_data ->> 'location'), ''),
    'currency', currency_code, 'totalAmount', total_amount, 'depositAmount', deposit_amount,
    'paymentSchedule', schedule,
    'serviceScope', coalesce(_confirmed_data -> 'serviceScope', '[]'::jsonb),
    'deliverables', coalesce(_confirmed_data -> 'deliverables', '[]'::jsonb),
    'cancellation', nullif(btrim(_confirmed_data ->> 'cancellation'), ''),
    'postponement', nullif(btrim(_confirmed_data ->> 'postponement'), ''),
    'forceMajeure', nullif(btrim(_confirmed_data ->> 'forceMajeure'), ''),
    'overtime', nullif(btrim(_confirmed_data ->> 'overtime'), ''),
    'travel', nullif(btrim(_confirmed_data ->> 'travel'), ''),
    'termination', nullif(btrim(_confirmed_data ->> 'termination'), ''),
    'disputeResolution', nullif(btrim(_confirmed_data ->> 'disputeResolution'), ''),
    'unknowns', coalesce(_confirmed_data -> 'unknowns', '[]'::jsonb),
    'confirmedAt', now(), 'confirmedBy', auth.uid()
  );

  update public.external_contract_ingestions set
    status = 'confirmed', confirmed_data = cleaned, confirmed_at = now(), confirmed_by = auth.uid(), updated_at = now()
  where id = ingestion.id;

  if ingestion.agreement_id is not null then
    select * into agreement from public.vendor_agreement_records where id = ingestion.agreement_id for update;
    quote_amount := nullif(agreement.accepted_quote_snapshot ->> 'totalAmount', '')::numeric;
    quote_currency := upper(nullif(agreement.accepted_quote_snapshot ->> 'currency', ''));
    quote_event_date := nullif(agreement.accepted_quote_snapshot ->> 'eventDate', '')::date;
    if total_amount is null then
      findings := findings || jsonb_build_array(jsonb_build_object('code','contract_amount_unrecorded','field','amount','severity','unknown','message','The uploaded contract has no confirmed total amount.','agreedValue',quote_amount,'contractValue',null));
      found_unknowns := found_unknowns + 1;
    elsif quote_amount is not null and (total_amount <> quote_amount or currency_code is distinct from quote_currency) then
      findings := findings || jsonb_build_array(jsonb_build_object('code','contract_amount_changed','field','amount','severity','high','message','The uploaded contract amount or currency differs from the accepted quote.','agreedValue',jsonb_build_object('currency',quote_currency,'amount',quote_amount),'contractValue',jsonb_build_object('currency',currency_code,'amount',total_amount)));
      found_discrepancies := found_discrepancies + 1;
    end if;
    if quote_event_date is not null and event_date is null then
      findings := findings || jsonb_build_array(jsonb_build_object('code','contract_event_date_unrecorded','field','event_date','severity','unknown','message','The uploaded contract has no confirmed event date.','agreedValue',quote_event_date,'contractValue',null));
      found_unknowns := found_unknowns + 1;
    elsif quote_event_date is not null and event_date <> quote_event_date then
      findings := findings || jsonb_build_array(jsonb_build_object('code','contract_event_date_changed','field','event_date','severity','high','message','The uploaded contract event date differs from the accepted quote.','agreedValue',quote_event_date,'contractValue',event_date));
      found_discrepancies := found_discrepancies + 1;
    end if;
    update public.vendor_agreement_records set
      contract_snapshot = cleaned,
      state = 'reviewed',
      review_status = case when found_discrepancies > 0 or found_unknowns > 0 then 'needs_review' else 'aligned' end,
      comparison = findings,
      discrepancy_count = found_discrepancies,
      unknown_count = found_unknowns,
      compared_at = now(), updated_at = now()
    where id = agreement.id;
  end if;

  return jsonb_build_object('id', ingestion.id, 'status', 'confirmed', 'agreementId', ingestion.agreement_id);
end;
$$;

create or replace function public.discard_external_contract_ingestion(_ingestion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare ingestion public.external_contract_ingestions%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into ingestion from public.external_contract_ingestions where id = _ingestion_id for update;
  if ingestion.id is null or ingestion.owner_user_id <> auth.uid() then raise exception 'Contract extraction not found'; end if;
  if ingestion.status = 'confirmed' then raise exception 'Confirmed contract facts cannot be discarded'; end if;
  update public.external_contract_ingestions set status = 'discarded', file_deleted_at = coalesce(file_deleted_at, now()), updated_at = now() where id = ingestion.id;
end;
$$;

create or replace function public.get_agreement_review(_wedding_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if _wedding_id is null or not public.is_wedding_member(_wedding_id) then raise exception 'Wedding access required'; end if;
  return jsonb_build_object(
    'agreements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', agreement.id, 'vendorName', coalesce(vendor.name, agreement.contract_snapshot ->> 'vendorName', 'Vendor'),
        'state', agreement.state, 'reviewStatus', agreement.review_status,
        'acceptedQuote', agreement.accepted_quote_snapshot,
        'contractId', agreement.contract_id,
        'contractTitle', agreement.contract_snapshot ->> 'title',
        'contractStatus', coalesce(contract.status, case when agreement.contract_snapshot ->> 'sourceType' = 'external_pdf' then 'externally_confirmed' end),
        'contractFinancials', case when agreement.contract_snapshot is null then null else jsonb_build_object(
          'currency', coalesce(contract.currency, agreement.contract_snapshot ->> 'currency'),
          'totalAmount', coalesce(contract.total_amount, nullif(agreement.contract_snapshot ->> 'totalAmount', '')::numeric),
          'depositAmount', coalesce(contract.deposit_amount, nullif(agreement.contract_snapshot ->> 'depositAmount', '')::numeric),
          'paymentSchedule', coalesce(contract.payment_schedule, agreement.contract_snapshot -> 'paymentSchedule', '[]'::jsonb)
        ) end,
        'proposedObligations', coalesce((
          select jsonb_agg(jsonb_build_object(
            'kind','payment','title',btrim(entry ->> 'title'),'amount',(entry ->> 'amount')::numeric,
            'currency',coalesce(contract.currency, agreement.contract_snapshot ->> 'currency'),'dueDate',entry ->> 'dueDate',
            'source',case when agreement.contract_snapshot ->> 'sourceType' = 'external_pdf' then 'external_contract_payment_schedule' else 'contract_payment_schedule' end
          ) order by entry_index)
          from jsonb_array_elements(coalesce(contract.payment_schedule, agreement.contract_snapshot -> 'paymentSchedule', '[]'::jsonb)) with ordinality schedule(entry, entry_index)
          where nullif(btrim(entry ->> 'title'), '') is not null
            and coalesce(entry ->> 'amount','') ~ '^\d+(\.\d{1,2})?$'
            and coalesce(entry ->> 'dueDate','') ~ '^\d{4}-\d{2}-\d{2}$'
        ), '[]'::jsonb),
        'comparison', agreement.comparison, 'discrepancyCount', agreement.discrepancy_count,
        'unknownCount', agreement.unknown_count, 'comparedAt', agreement.compared_at
      ) order by agreement.updated_at desc)
      from public.vendor_agreement_records agreement
      left join public.vendors vendor on vendor.id = agreement.vendor_id
      left join public.professional_contracts contract on contract.id = agreement.contract_id
      where agreement.wedding_id = _wedding_id
    ), '[]'::jsonb),
    'externalContracts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ingestion.id, 'filename', ingestion.original_filename, 'status', ingestion.status,
        'agreementId', ingestion.agreement_id, 'facts', coalesce(ingestion.confirmed_data, ingestion.extracted_data),
        'fileDeletedAt', ingestion.file_deleted_at, 'createdAt', ingestion.created_at
      ) order by ingestion.created_at desc)
      from public.external_contract_ingestions ingestion
      where ingestion.wedding_id = _wedding_id and ingestion.status in ('extracted','confirmed')
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.create_external_contract_ingestion(uuid,uuid,text,text,bigint) from public, anon;
revoke all on function public.confirm_external_contract_ingestion(uuid,jsonb) from public, anon;
revoke all on function public.discard_external_contract_ingestion(uuid) from public, anon;
revoke all on function public.get_agreement_review(uuid) from public, anon;
grant execute on function public.create_external_contract_ingestion(uuid,uuid,text,text,bigint) to authenticated;
grant execute on function public.confirm_external_contract_ingestion(uuid,jsonb) to authenticated;
grant execute on function public.discard_external_contract_ingestion(uuid) to authenticated;
grant execute on function public.get_agreement_review(uuid) to authenticated;

comment on table public.external_contract_ingestions is
  'Private, temporary external PDF contract ingestion records. Extracted facts remain untrusted until a wedding member confirms them.';
comment on function public.confirm_external_contract_ingestion(uuid,jsonb) is
  'Validates and confirms reviewed external contract facts, optionally comparing them with an existing accepted-quote Agreement Record. It creates no tasks or financial records.';

notify pgrst, 'reload schema';
