-- Let a professional keep several verified Paystack settlement destinations.
-- Existing destinations remain the default, so this migration does not alter
-- where any currently payable invoice settles.

alter table public.zania_pay_accounts
  drop constraint if exists zania_pay_accounts_user_audience_unique;

alter table public.zania_pay_accounts
  add column if not exists is_default boolean not null default false;

with ranked as (
  select id, row_number() over (
    partition by professional_user_id, audience
    order by (status = 'verified') desc, verified_at desc nulls last, created_at desc
  ) as position
  from public.zania_pay_accounts
)
update public.zania_pay_accounts account
set is_default = ranked.position = 1
from ranked
where ranked.id = account.id;

create unique index if not exists zania_pay_accounts_one_default_idx
  on public.zania_pay_accounts (professional_user_id, audience)
  where is_default;

create unique index if not exists zania_pay_accounts_provider_reference_idx
  on public.zania_pay_accounts (provider, mode, provider_account_reference)
  where provider_account_reference is not null;

alter table public.commercial_documents
  add column if not exists payout_account_id uuid null
    references public.zania_pay_accounts(id) on delete set null;

create index if not exists commercial_documents_payout_account_idx
  on public.commercial_documents (payout_account_id)
  where payout_account_id is not null;

-- Every connection attempt claims a new local destination. Paystack is then
-- called exactly once for that row; an existing provider destination is never
-- overwritten when a professional adds another account.
create or replace function public.claim_zania_pay_account_setup(
  p_professional_user_id uuid,
  p_audience text,
  p_vendor_listing_id uuid,
  p_mode text,
  p_destination_hint text,
  p_terms_version text,
  p_lock_token uuid
)
returns public.zania_pay_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.zania_pay_accounts;
begin
  if p_audience not in ('vendor', 'planner') or p_mode not in ('sandbox', 'live') then
    raise exception 'Invalid payout account setup request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_professional_user_id::text || ':' || p_audience, 0));

  insert into public.zania_pay_accounts (
    professional_user_id, audience, vendor_listing_id, provider, mode,
    status, provider_verification_status, settlement_currency,
    settlement_destination_hint, terms_accepted_at, terms_version,
    submitted_at, rejection_reason, setup_lock_token, setup_lock_until,
    is_default
  ) values (
    p_professional_user_id, p_audience,
    case when p_audience = 'vendor' then p_vendor_listing_id else null end,
    'paystack', p_mode, 'pending', 'pending', 'KES', p_destination_hint,
    now(), p_terms_version, now(), null, p_lock_token,
    now() + interval '2 minutes', false
  ) returning * into v_account;

  return v_account;
end;
$$;

create or replace function private.ensure_verified_zania_pay_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'verified' and new.provider_verification_status = 'verified'
     and not exists (
       select 1 from public.zania_pay_accounts account
       where account.professional_user_id = new.professional_user_id
         and account.audience = new.audience
         and account.is_default
         and account.status = 'verified'
         and account.provider_verification_status = 'verified'
     ) then
    perform pg_advisory_xact_lock(hashtextextended(new.professional_user_id::text || ':' || new.audience, 0));
    update public.zania_pay_accounts set is_default = false
      where professional_user_id = new.professional_user_id and audience = new.audience and is_default;
    update public.zania_pay_accounts set is_default = true where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_verified_zania_pay_default on public.zania_pay_accounts;
create trigger ensure_verified_zania_pay_default
after insert or update of status, provider_verification_status on public.zania_pay_accounts
for each row execute function private.ensure_verified_zania_pay_default();

-- A verified destination can be made the default without exposing payout
-- details or permitting a professional to target another user's account.
create or replace function public.set_default_zania_pay_account(_account_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.zania_pay_accounts%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into target from public.zania_pay_accounts
    where id = _account_id and professional_user_id = auth.uid() for update;
  if target.id is null then raise exception 'Payout account not found'; end if;
  if target.status <> 'verified' or target.provider_verification_status <> 'verified' then
    raise exception 'Only a verified payout account can be the default';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target.professional_user_id::text || ':' || target.audience, 0));
  update public.zania_pay_accounts set is_default = false, updated_at = now()
    where professional_user_id = target.professional_user_id and audience = target.audience and is_default;
  update public.zania_pay_accounts set is_default = true, updated_at = now() where id = target.id;
  return jsonb_build_object('id', target.id, 'isDefault', true);
end;
$$;

-- Owners may choose a verified destination for an invoice until a Zania Pay
-- order exists. Orders already snapshot professional_account_id and therefore
-- preserve payout/refund history even if the default changes later.
create or replace function public.set_commercial_document_payout_account(
  _document_id uuid,
  _account_id uuid default null
)
returns public.commercial_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  document_record public.commercial_documents%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into document_record from public.commercial_documents
    where id = _document_id and user_id = auth.uid() for update;
  if document_record.id is null then raise exception 'Invoice not found'; end if;
  if document_record.document_type <> 'invoice' then raise exception 'A payout destination can only be selected for an invoice'; end if;
  if exists (select 1 from public.zania_pay_orders where invoice_id = _document_id) then
    raise exception 'The payout destination is locked because payment has started';
  end if;
  if _account_id is not null and not exists (
    select 1 from public.zania_pay_accounts account
    where account.id = _account_id
      and account.professional_user_id = auth.uid()
      and account.audience = document_record.role
      and account.status = 'verified'
      and account.provider_verification_status = 'verified'
  ) then raise exception 'Choose one of your verified payout accounts'; end if;

  update public.commercial_documents set payout_account_id = _account_id, updated_at = now()
    where id = _document_id returning * into document_record;
  return document_record;
end;
$$;

create or replace function public.list_zania_pay_accounts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', account.id, 'audience', account.audience, 'status', account.status,
    'provider', account.provider, 'mode', account.mode,
    'providerVerificationStatus', account.provider_verification_status,
    'settlementCurrency', account.settlement_currency,
    'settlementDestinationHint', account.settlement_destination_hint,
    'destinationType', account.metadata ->> 'destination_type',
    'destinationName', account.metadata ->> 'destination_name',
    'isDefault', account.is_default, 'rejectionReason', account.rejection_reason,
    'submittedAt', account.submitted_at, 'verifiedAt', account.verified_at,
    'lastProviderSyncAt', account.last_provider_sync_at
  )) order by account.is_default desc, account.created_at desc), '[]'::jsonb)
  from public.zania_pay_accounts account
  where account.professional_user_id = auth.uid();
$$;

-- Preserve the latest Free-couple eligibility behavior while resolving the
-- invoice-selected destination first and the professional default second.
do $$
declare
  definition text := pg_get_functiondef('public.get_zania_pay_invoice_eligibility(uuid)'::regprocedure);
  old_query text := '  select * into account_record' || chr(10) ||
    '  from public.zania_pay_accounts account' || chr(10) ||
    '  where account.professional_user_id = invoice_record.user_id' || chr(10) ||
    '    and account.audience = invoice_record.role' || chr(10) ||
    '  limit 1;';
  new_query text := '  select * into account_record' || chr(10) ||
    '  from public.zania_pay_accounts account' || chr(10) ||
    '  where account.professional_user_id = invoice_record.user_id' || chr(10) ||
    '    and account.audience = invoice_record.role' || chr(10) ||
    '    and account.status = ''verified''' || chr(10) ||
    '    and account.provider_verification_status = ''verified''' || chr(10) ||
    '    and (invoice_record.payout_account_id is null or account.id = invoice_record.payout_account_id)' || chr(10) ||
    '  order by (account.id = invoice_record.payout_account_id) desc, account.is_default desc, account.verified_at desc nulls last' || chr(10) ||
    '  limit 1;';
begin
  if position(old_query in definition) = 0 then
    raise exception 'Unexpected invoice eligibility account lookup; review before changing destinations';
  end if;
  execute replace(definition, old_query, new_query);
end;
$$;

revoke all on function public.set_default_zania_pay_account(uuid) from public, anon;
revoke all on function public.set_commercial_document_payout_account(uuid, uuid) from public, anon;
revoke all on function public.list_zania_pay_accounts() from public, anon;
grant execute on function public.set_default_zania_pay_account(uuid) to authenticated;
grant execute on function public.set_commercial_document_payout_account(uuid, uuid) to authenticated;
grant execute on function public.list_zania_pay_accounts() to authenticated;

notify pgrst, 'reload schema';
