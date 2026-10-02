-- Prevent concurrent payout-account setup requests from creating more than one
-- provider subaccount for the same professional.

alter table public.zania_pay_accounts
  add column if not exists setup_lock_token uuid null,
  add column if not exists setup_lock_until timestamptz null;

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

  insert into public.zania_pay_accounts (
    professional_user_id,
    audience,
    vendor_listing_id,
    provider,
    mode,
    status,
    provider_verification_status,
    settlement_currency,
    settlement_destination_hint,
    terms_accepted_at,
    terms_version,
    submitted_at,
    rejection_reason,
    setup_lock_token,
    setup_lock_until
  ) values (
    p_professional_user_id,
    p_audience,
    case when p_audience = 'vendor' then p_vendor_listing_id else null end,
    'paystack',
    p_mode,
    'pending',
    'pending',
    'KES',
    p_destination_hint,
    now(),
    p_terms_version,
    now(),
    null,
    p_lock_token,
    now() + interval '2 minutes'
  )
  on conflict (professional_user_id, audience) do nothing;

  select * into v_account
  from public.zania_pay_accounts
  where professional_user_id = p_professional_user_id
    and audience = p_audience
  for update;

  if v_account.setup_lock_token is distinct from p_lock_token
     and v_account.setup_lock_until is not null
     and v_account.setup_lock_until > now() then
    raise exception using
      errcode = '55P03',
      message = 'Payout setup is already in progress';
  end if;

  update public.zania_pay_accounts
  set vendor_listing_id = case when p_audience = 'vendor' then p_vendor_listing_id else null end,
      provider = 'paystack',
      mode = p_mode,
      provider_account_reference = case
        when mode = p_mode then provider_account_reference
        else null
      end,
      status = 'pending',
      provider_verification_status = 'pending',
      settlement_currency = 'KES',
      settlement_destination_hint = p_destination_hint,
      terms_accepted_at = now(),
      terms_version = p_terms_version,
      submitted_at = now(),
      verified_at = null,
      rejection_reason = null,
      setup_lock_token = p_lock_token,
      setup_lock_until = now() + interval '2 minutes',
      updated_at = now()
  where id = v_account.id
  returning * into v_account;

  return v_account;
end;
$$;

create or replace function public.finish_zania_pay_account_setup(
  p_account_id uuid,
  p_professional_user_id uuid,
  p_lock_token uuid,
  p_provider_reference text,
  p_provider_verified boolean,
  p_destination_type text,
  p_destination_name text
)
returns public.zania_pay_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.zania_pay_accounts;
begin
  update public.zania_pay_accounts
  set provider_account_reference = p_provider_reference,
      status = case when p_provider_verified then 'verified' else 'pending' end,
      provider_verification_status = case when p_provider_verified then 'verified' else 'pending' end,
      verified_at = case when p_provider_verified then now() else null end,
      last_provider_sync_at = now(),
      metadata = jsonb_build_object(
        'destination_type', p_destination_type,
        'destination_name', p_destination_name
      ),
      setup_lock_token = null,
      setup_lock_until = null,
      updated_at = now()
  where id = p_account_id
    and professional_user_id = p_professional_user_id
    and setup_lock_token = p_lock_token
  returning * into v_account;

  if v_account.id is null then
    raise exception 'Payout setup lock is no longer valid';
  end if;
  return v_account;
end;
$$;

create or replace function public.fail_zania_pay_account_setup(
  p_account_id uuid,
  p_professional_user_id uuid,
  p_lock_token uuid,
  p_reason text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.zania_pay_accounts
  set status = 'rejected',
      provider_verification_status = 'failed',
      rejection_reason = left(coalesce(nullif(trim(p_reason), ''), 'Could not verify this payout account.'), 240),
      setup_lock_token = null,
      setup_lock_until = null,
      updated_at = now()
  where id = p_account_id
    and professional_user_id = p_professional_user_id
    and setup_lock_token = p_lock_token;
$$;

revoke all on function public.claim_zania_pay_account_setup(uuid, text, uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.finish_zania_pay_account_setup(uuid, uuid, uuid, text, boolean, text, text) from public, anon, authenticated;
revoke all on function public.fail_zania_pay_account_setup(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_zania_pay_account_setup(uuid, text, uuid, text, text, text, uuid) to service_role;
grant execute on function public.finish_zania_pay_account_setup(uuid, uuid, uuid, text, boolean, text, text) to service_role;
grant execute on function public.fail_zania_pay_account_setup(uuid, uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';
