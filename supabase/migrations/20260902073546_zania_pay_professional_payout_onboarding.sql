alter table public.zania_pay_accounts
  add column if not exists mode text not null default 'sandbox'
    check (mode in ('sandbox', 'live')),
  add column if not exists provider_verification_status text not null default 'not_started'
    check (provider_verification_status in ('not_started', 'pending', 'verified', 'failed')),
  add column if not exists rejection_reason text null,
  add column if not exists last_provider_sync_at timestamptz null,
  add column if not exists terms_version text null;

update public.zania_pay_accounts
set provider = 'paystack'
where provider in ('sandbox', 'test', '');

alter table public.zania_pay_accounts
  alter column provider set default 'paystack';

alter table public.zania_pay_accounts
  drop constraint if exists zania_pay_accounts_provider_check;

alter table public.zania_pay_accounts
  add constraint zania_pay_accounts_provider_check check (provider = 'paystack');

-- Payout details must only cross the authenticated Edge Function boundary. The
-- earlier RPC could create a misleading pending account without registering a
-- destination with Paystack, so it is no longer part of the client API.
revoke execute on function public.request_zania_pay_account(text, uuid, text) from authenticated;

create or replace function public.get_zania_pay_account_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  account_record public.zania_pay_accounts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into account_record
  from public.zania_pay_accounts
  where professional_user_id = auth.uid()
  order by created_at desc
  limit 1;

  if account_record.id is null then
    return jsonb_build_object('status', 'not_started');
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'id', account_record.id,
    'audience', account_record.audience,
    'status', account_record.status,
    'provider', account_record.provider,
    'mode', account_record.mode,
    'providerVerificationStatus', account_record.provider_verification_status,
    'settlementCurrency', account_record.settlement_currency,
    'settlementDestinationHint', account_record.settlement_destination_hint,
    'rejectionReason', account_record.rejection_reason,
    'submittedAt', account_record.submitted_at,
    'verifiedAt', account_record.verified_at,
    'lastProviderSyncAt', account_record.last_provider_sync_at
  ));
end;
$$;

revoke execute on function public.get_zania_pay_account_status() from public, anon;
grant execute on function public.get_zania_pay_account_status() to authenticated;

notify pgrst, 'reload schema';
