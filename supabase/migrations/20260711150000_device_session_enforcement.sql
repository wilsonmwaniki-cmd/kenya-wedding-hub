insert into public.zania_feature_flags (key, value, description)
values
  ('OTP_EXPIRY_MINUTES', '10'::jsonb, 'Minutes before a device verification OTP expires.'),
  ('OTP_MAX_ATTEMPTS', '5'::jsonb, 'Maximum OTP verification attempts before the challenge is locked.'),
  ('OTP_RESEND_COOLDOWN_SECONDS', '60'::jsonb, 'Cooldown before another device verification OTP can be sent.'),
  ('OTP_MAX_SENDS_PER_HOUR', '5'::jsonb, 'Maximum device verification OTP sends per hour.')
on conflict (key) do update
set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();

create table if not exists public.device_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_session_id uuid not null references public.device_sessions(id) on delete cascade,
  auth_session_id uuid null,
  otp_purpose text not null default 'new_device_login',
  otp_code_hash text not null,
  expires_at timestamptz not null,
  resend_available_at timestamptz not null,
  max_attempts integer not null default 5,
  attempt_count integer not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_attempt_at timestamptz null,
  verified_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  check (otp_purpose in ('new_device_login', 'password_reset', 'sensitive_change', 'device_trust_reset')),
  check (status in ('pending', 'verified', 'failed', 'expired', 'locked')),
  check (attempt_count >= 0),
  check (max_attempts >= 1)
);

create index if not exists device_verification_challenges_user_created_idx
  on public.device_verification_challenges (user_id, created_at desc);

create index if not exists device_verification_challenges_device_created_idx
  on public.device_verification_challenges (device_session_id, created_at desc);

alter table public.device_sessions
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists update_device_sessions_updated_at on public.device_sessions;
create trigger update_device_sessions_updated_at
before update on public.device_sessions
for each row execute function public.update_updated_at_column();

drop trigger if exists update_device_verification_challenges_updated_at on public.device_verification_challenges;
create trigger update_device_verification_challenges_updated_at
before update on public.device_verification_challenges
for each row execute function public.update_updated_at_column();

alter table public.device_verification_challenges enable row level security;

drop policy if exists "Users can view own device verification challenges" on public.device_verification_challenges;
create policy "Users can view own device verification challenges"
on public.device_verification_challenges
for select
to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'::public.app_role));

create or replace function public.get_zania_flag_text(flag_key text, fallback_value text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  raw_value jsonb;
begin
  select value
  into raw_value
  from public.zania_feature_flags
  where key = flag_key;

  if raw_value is null then
    return fallback_value;
  end if;

  return coalesce(nullif(trim(both '"' from raw_value::text), ''), fallback_value);
end;
$$;

create or replace function public.current_auth_session_uuid()
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  current_session_id_text text := nullif(auth.jwt() ->> 'session_id', '');
begin
  if current_session_id_text is null
     or current_session_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;

  return current_session_id_text::uuid;
end;
$$;

create or replace function public.mask_email_address(input_email text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  local_part text;
  domain_part text;
begin
  if input_email is null or position('@' in input_email) = 0 then
    return 'your email';
  end if;

  local_part := split_part(input_email, '@', 1);
  domain_part := split_part(input_email, '@', 2);

  if length(local_part) <= 2 then
    return left(local_part, 1) || '*' || '@' || domain_part;
  end if;

  return left(local_part, 1) || repeat('*', greatest(length(local_part) - 2, 1)) || right(local_part, 1) || '@' || domain_part;
end;
$$;

create or replace function public.free_device_enforcement_required(target_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  profile_record public.profiles%rowtype;
  has_paid_couple_plan boolean := false;
begin
  if target_user_id is null then
    return false;
  end if;

  select *
  into profile_record
  from public.profiles
  where user_id = target_user_id;

  if profile_record.user_id is null then
    return false;
  end if;

  if profile_record.role in ('planner'::public.app_role, 'vendor'::public.app_role, 'admin'::public.app_role) then
    return false;
  end if;

  select exists (
    select 1
    from public.wedding_memberships wm
    join public.wedding_entitlements we
      on we.wedding_id = wm.wedding_id
     and we.feature_key in (
       'planner_collaboration',
       'committee_collaboration',
       'vendor_collaboration',
       'advanced_exports'
     )
     and we.effective_from <= now()
     and (we.effective_to is null or we.effective_to > now())
    join public.weddings w
      on w.id = wm.wedding_id
    where wm.user_id = target_user_id
      and wm.membership_status = 'active'
      and wm.is_owner = true
      and w.deleted_at is null
      and w.status <> 'deleted'
  )
  into has_paid_couple_plan;

  if has_paid_couple_plan then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.trust_current_device_session(
  target_device_id text,
  target_device_name text default null,
  target_platform text default null,
  target_browser text default null,
  target_app_installation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_session_id uuid := public.current_auth_session_uuid();
  enforcement_required boolean := public.free_device_enforcement_required(auth.uid());
  trusted_limit integer := public.get_zania_flag_int('FREE_PLAN_MAX_TRUSTED_DEVICES', 1);
  existing_other_current_count integer := 0;
  trusted_device_count integer := 0;
  device_row public.device_sessions%rowtype;
begin
  if current_user_id is null then
    raise exception 'Sign in first'
      using errcode = 'P0001';
  end if;

  if current_session_id is null then
    raise exception 'Your session has expired. Please sign in again.'
      using errcode = 'P0001';
  end if;

  if coalesce(trim(target_device_id), '') = '' then
    raise exception 'A device ID is required'
      using errcode = 'P0001';
  end if;

  insert into public.device_sessions (
    user_id,
    device_id,
    device_name,
    platform,
    browser,
    app_installation_id,
    first_seen_at,
    last_seen_at,
    trusted_at,
    revoked_at,
    is_current,
    metadata
  )
  values (
    current_user_id,
    trim(target_device_id),
    nullif(trim(target_device_name), ''),
    nullif(trim(target_platform), ''),
    nullif(trim(target_browser), ''),
    nullif(trim(target_app_installation_id), ''),
    now(),
    now(),
    now(),
    null,
    true,
    jsonb_build_object(
      'auth_session_id', current_session_id::text,
      'last_verified_at', now()
    )
  )
  on conflict (user_id, device_id) do update
  set
    device_name = coalesce(excluded.device_name, public.device_sessions.device_name),
    platform = coalesce(excluded.platform, public.device_sessions.platform),
    browser = coalesce(excluded.browser, public.device_sessions.browser),
    app_installation_id = coalesce(excluded.app_installation_id, public.device_sessions.app_installation_id),
    last_seen_at = now(),
    trusted_at = coalesce(public.device_sessions.trusted_at, now()),
    revoked_at = null,
    is_current = true,
    metadata = coalesce(public.device_sessions.metadata, '{}'::jsonb) || jsonb_build_object(
      'auth_session_id', current_session_id::text,
      'last_verified_at', now()
    );

  select *
  into device_row
  from public.device_sessions
  where user_id = current_user_id
    and device_id = trim(target_device_id);

  if enforcement_required then
    select count(*)
    into trusted_device_count
    from public.device_sessions
    where user_id = current_user_id
      and trusted_at is not null
      and revoked_at is null;

    if trusted_device_count > trusted_limit then
      update public.device_sessions
      set
        revoked_at = now(),
        is_current = false,
        updated_at = now()
      where user_id = current_user_id
        and device_id <> trim(target_device_id)
        and revoked_at is null;
    end if;

    select count(*)
    into existing_other_current_count
    from public.device_sessions
    where user_id = current_user_id
      and device_id <> trim(target_device_id)
      and revoked_at is null
      and is_current = true;

    update public.device_sessions
    set
      revoked_at = now(),
      is_current = false,
      updated_at = now()
    where user_id = current_user_id
      and device_id <> trim(target_device_id)
      and revoked_at is null
      and is_current = true;
  end if;

  perform public.log_account_audit_event(
    current_user_id,
    null,
    case when existing_other_current_count > 0 then 'DEVICE_SWITCHED' else 'DEVICE_ADDED' end,
    jsonb_build_object(
      'device_id', trim(target_device_id),
      'device_session_id', device_row.id,
      'auth_session_id', current_session_id::text,
      'enforcement_required', enforcement_required
    )
  );

  return jsonb_build_object(
    'status', 'active',
    'deviceSessionId', device_row.id,
    'deviceId', device_row.device_id,
    'enforcementRequired', enforcement_required
  );
end;
$$;

create or replace function public.register_current_device_session(
  target_device_id text,
  target_device_name text default null,
  target_platform text default null,
  target_browser text default null,
  target_app_installation_id text default null,
  target_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_session_id uuid := public.current_auth_session_uuid();
  enforcement_required boolean := public.free_device_enforcement_required(auth.uid());
  current_device_row public.device_sessions%rowtype;
  current_trusted_row public.device_sessions%rowtype;
begin
  if current_user_id is null then
    raise exception 'Sign in first'
      using errcode = 'P0001';
  end if;

  if current_session_id is null then
    raise exception 'Your session has expired. Please sign in again.'
      using errcode = 'P0001';
  end if;

  if coalesce(trim(target_device_id), '') = '' then
    raise exception 'A device ID is required'
      using errcode = 'P0001';
  end if;

  insert into public.device_sessions (
    user_id,
    device_id,
    device_name,
    platform,
    browser,
    app_installation_id,
    first_seen_at,
    last_seen_at,
    metadata
  )
  values (
    current_user_id,
    trim(target_device_id),
    nullif(trim(target_device_name), ''),
    nullif(trim(target_platform), ''),
    nullif(trim(target_browser), ''),
    nullif(trim(target_app_installation_id), ''),
    now(),
    now(),
    jsonb_build_object(
      'pending_auth_session_id', current_session_id::text,
      'last_seen_at', now()
    )
  )
  on conflict (user_id, device_id) do update
  set
    device_name = coalesce(excluded.device_name, public.device_sessions.device_name),
    platform = coalesce(excluded.platform, public.device_sessions.platform),
    browser = coalesce(excluded.browser, public.device_sessions.browser),
    app_installation_id = coalesce(excluded.app_installation_id, public.device_sessions.app_installation_id),
    last_seen_at = now(),
    metadata = coalesce(public.device_sessions.metadata, '{}'::jsonb) || jsonb_build_object(
      'pending_auth_session_id', current_session_id::text,
      'last_seen_at', now()
    );

  select *
  into current_device_row
  from public.device_sessions
  where user_id = current_user_id
    and device_id = trim(target_device_id);

  if not enforcement_required then
    return public.trust_current_device_session(
      trim(target_device_id),
      target_device_name,
      target_platform,
      target_browser,
      target_app_installation_id
    );
  end if;

  select *
  into current_trusted_row
  from public.device_sessions
  where user_id = current_user_id
    and revoked_at is null
    and trusted_at is not null
    and is_current = true
  order by last_seen_at desc
  limit 1;

  if current_trusted_row.id is null or current_trusted_row.device_id = trim(target_device_id) then
    return public.trust_current_device_session(
      trim(target_device_id),
      target_device_name,
      target_platform,
      target_browser,
      target_app_installation_id
    );
  end if;

  return jsonb_build_object(
    'status', 'verification_required',
    'deviceSessionId', current_device_row.id,
    'deviceId', current_device_row.device_id,
    'message', 'We noticed a sign-in from a new device. Enter the OTP sent to your email to continue.',
    'emailHint', public.mask_email_address(target_email),
    'enforcementRequired', true
  );
end;
$$;

create or replace function public.admin_issue_device_verification_challenge(
  target_user_id uuid,
  target_device_id text,
  target_email text,
  target_auth_session_id uuid
)
returns table (
  challenge_id uuid,
  otp_code text,
  expires_at timestamptz,
  retry_after_seconds integer,
  email_hint text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  cooldown_seconds integer := public.get_zania_flag_int('OTP_RESEND_COOLDOWN_SECONDS', 60);
  expiry_minutes integer := public.get_zania_flag_int('OTP_EXPIRY_MINUTES', 10);
  max_attempts integer := public.get_zania_flag_int('OTP_MAX_ATTEMPTS', 5);
  max_sends_per_hour integer := public.get_zania_flag_int('OTP_MAX_SENDS_PER_HOUR', 5);
  send_count_last_hour integer := 0;
  existing_pending public.device_verification_challenges%rowtype;
  device_row public.device_sessions%rowtype;
  raw_code text;
begin
  if target_user_id is null or coalesce(trim(target_device_id), '') = '' then
    raise exception 'A user ID and device ID are required';
  end if;

  select *
  into device_row
  from public.device_sessions
  where user_id = target_user_id
    and device_id = trim(target_device_id);

  if device_row.id is null then
    raise exception 'Device session not found';
  end if;

  select count(*)
  into send_count_last_hour
  from public.device_verification_challenges
  where user_id = target_user_id
    and otp_purpose = 'new_device_login'
    and created_at > now() - interval '1 hour';

  if send_count_last_hour >= max_sends_per_hour then
    raise exception 'Too many verification codes were sent recently. Please try again later.';
  end if;

  select *
  into existing_pending
  from public.device_verification_challenges
  where user_id = target_user_id
    and device_session_id = device_row.id
    and status = 'pending'
  order by created_at desc
  limit 1;

  if existing_pending.id is not null and existing_pending.resend_available_at > now() then
    challenge_id := existing_pending.id;
    otp_code := null;
    expires_at := existing_pending.expires_at;
    retry_after_seconds := greatest(1, ceil(extract(epoch from (existing_pending.resend_available_at - now())))::integer);
    email_hint := public.mask_email_address(target_email);
    return next;
    return;
  end if;

  raw_code := lpad(((floor(random() * 1000000))::integer)::text, 6, '0');

  insert into public.device_verification_challenges (
    user_id,
    device_session_id,
    auth_session_id,
    otp_purpose,
    otp_code_hash,
    expires_at,
    resend_available_at,
    max_attempts,
    metadata
  )
  values (
    target_user_id,
    device_row.id,
    target_auth_session_id,
    'new_device_login',
    encode(digest(raw_code, 'sha256'), 'hex'),
    now() + make_interval(mins => expiry_minutes),
    now() + make_interval(secs => cooldown_seconds),
    max_attempts,
    jsonb_build_object(
      'device_id', trim(target_device_id),
      'email_hint', public.mask_email_address(target_email)
    )
  )
  returning id, public.device_verification_challenges.expires_at
  into challenge_id, expires_at;

  perform public.log_account_audit_event(
    target_user_id,
    null,
    'OTP_REQUESTED',
    jsonb_build_object(
      'device_id', trim(target_device_id),
      'device_session_id', device_row.id,
      'challenge_id', challenge_id,
      'otp_purpose', 'new_device_login'
    )
  );

  insert into public.otp_audit_events (
    user_id,
    device_session_id,
    otp_purpose,
    delivery_channel,
    status,
    metadata
  )
  values (
    target_user_id,
    device_row.id,
    'new_device_login',
    'email',
    'requested',
    jsonb_build_object(
      'challenge_id', challenge_id,
      'device_id', trim(target_device_id)
    )
  );

  retry_after_seconds := 0;
  email_hint := public.mask_email_address(target_email);
  otp_code := raw_code;
  return next;
end;
$$;

create or replace function public.verify_device_verification_otp(
  target_challenge_id uuid,
  submitted_code text,
  target_device_id text,
  target_device_name text default null,
  target_platform text default null,
  target_browser text default null,
  target_app_installation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  challenge_record public.device_verification_challenges%rowtype;
  hashed_submitted_code text;
  attempt_limit integer;
  trust_result jsonb;
  remaining_attempts integer;
begin
  if current_user_id is null then
    raise exception 'Sign in first'
      using errcode = 'P0001';
  end if;

  if target_challenge_id is null or coalesce(trim(submitted_code), '') = '' then
    raise exception 'Challenge ID and OTP code are required'
      using errcode = 'P0001';
  end if;

  select *
  into challenge_record
  from public.device_verification_challenges
  where id = target_challenge_id
    and user_id = current_user_id;

  if challenge_record.id is null then
    raise exception 'Verification challenge not found'
      using errcode = 'P0001';
  end if;

  attempt_limit := coalesce(challenge_record.max_attempts, public.get_zania_flag_int('OTP_MAX_ATTEMPTS', 5));

  if challenge_record.status <> 'pending' then
    raise exception 'This verification challenge is no longer active'
      using errcode = 'P0001';
  end if;

  if challenge_record.expires_at <= now() then
    update public.device_verification_challenges
    set
      status = 'expired',
      updated_at = now()
    where id = challenge_record.id;

    insert into public.otp_audit_events (
      user_id,
      device_session_id,
      otp_purpose,
      delivery_channel,
      status,
      metadata
    )
    values (
      current_user_id,
      challenge_record.device_session_id,
      'new_device_login',
      'email',
      'expired',
      jsonb_build_object('challenge_id', challenge_record.id)
    );

    return jsonb_build_object(
      'verified', false,
      'status', 'expired',
      'message', 'That verification code expired. Request a new code and try again.'
    );
  end if;

  hashed_submitted_code := encode(digest(trim(submitted_code), 'sha256'), 'hex');

  if hashed_submitted_code <> challenge_record.otp_code_hash then
    update public.device_verification_challenges
    set
      attempt_count = attempt_count + 1,
      last_attempt_at = now(),
      status = case
        when attempt_count + 1 >= attempt_limit then 'locked'
        else status
      end,
      updated_at = now()
    where id = challenge_record.id
    returning greatest(attempt_limit - attempt_count, 0)
    into remaining_attempts;

    insert into public.otp_audit_events (
      user_id,
      device_session_id,
      otp_purpose,
      delivery_channel,
      status,
      attempt_count,
      metadata
    )
    values (
      current_user_id,
      challenge_record.device_session_id,
      'new_device_login',
      'email',
      case when remaining_attempts <= 0 then 'locked' else 'failed' end,
      challenge_record.attempt_count + 1,
      jsonb_build_object('challenge_id', challenge_record.id)
    );

    return jsonb_build_object(
      'verified', false,
      'status', case when remaining_attempts <= 0 then 'locked' else 'failed' end,
      'remainingAttempts', remaining_attempts,
      'message', case
        when remaining_attempts <= 0 then 'Too many incorrect codes were entered. Request a new code to continue.'
        else 'That code did not match. Please try again.'
      end
    );
  end if;

  update public.device_verification_challenges
  set
    status = 'verified',
    verified_at = now(),
    last_attempt_at = now(),
    updated_at = now()
  where id = challenge_record.id;

  insert into public.otp_audit_events (
    user_id,
    device_session_id,
    otp_purpose,
    delivery_channel,
    status,
    attempt_count,
    metadata
  )
  values (
    current_user_id,
    challenge_record.device_session_id,
    'new_device_login',
    'email',
    'verified',
    challenge_record.attempt_count + 1,
    jsonb_build_object('challenge_id', challenge_record.id)
  );

  trust_result := public.trust_current_device_session(
    trim(target_device_id),
    target_device_name,
    target_platform,
    target_browser,
    target_app_installation_id
  );

  return jsonb_build_object(
    'verified', true,
    'status', 'verified',
    'message', 'This is now your active device. Your previous Zania session has been signed out.',
    'trustResult', trust_result
  );
end;
$$;

create or replace function public.sign_out_other_device_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_session_id uuid := public.current_auth_session_uuid();
  signed_out_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'Sign in first'
      using errcode = 'P0001';
  end if;

  update public.device_sessions
  set
    revoked_at = now(),
    is_current = false,
    updated_at = now()
  where user_id = current_user_id
    and coalesce(metadata->>'auth_session_id', '') <> coalesce(current_session_id::text, '')
    and revoked_at is null;

  get diagnostics signed_out_count = row_count;

  if signed_out_count > 0 then
    perform public.log_account_audit_event(
      current_user_id,
      null,
      'DEVICE_SWITCHED',
      jsonb_build_object(
        'signed_out_other_devices', true,
        'count', signed_out_count
      )
    );
  end if;

  return signed_out_count;
end;
$$;

create or replace function public.is_current_trusted_auth_session(
  target_session_id uuid,
  target_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  if target_session_id is null or target_user_id is null then
    return false;
  end if;

  if not public.is_active_auth_session(target_session_id, target_user_id) then
    return false;
  end if;

  if not public.free_device_enforcement_required(target_user_id) then
    return true;
  end if;

  return exists (
    select 1
    from public.device_sessions ds
    where ds.user_id = target_user_id
      and ds.revoked_at is null
      and ds.trusted_at is not null
      and ds.is_current = true
      and coalesce(ds.metadata->>'auth_session_id', '') = target_session_id::text
  );
end;
$$;

create or replace function public.assert_current_auth_session_active()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  current_session_id uuid := public.current_auth_session_uuid();
begin
  if current_user_id is null then
    raise exception 'Sign in first'
      using errcode = 'P0001';
  end if;

  if current_session_id is null or not public.is_current_trusted_auth_session(current_session_id, current_user_id) then
    raise exception 'Your session has expired. Please sign in again.'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.get_zania_flag_text(text, text) from public, anon;
grant execute on function public.get_zania_flag_text(text, text) to authenticated, service_role;

revoke execute on function public.current_auth_session_uuid() from public, anon;
grant execute on function public.current_auth_session_uuid() to authenticated, service_role;

revoke execute on function public.mask_email_address(text) from public, anon;
grant execute on function public.mask_email_address(text) to authenticated, service_role;

revoke execute on function public.free_device_enforcement_required(uuid) from public, anon;
grant execute on function public.free_device_enforcement_required(uuid) to authenticated, service_role;

revoke execute on function public.trust_current_device_session(text, text, text, text, text) from public, anon;
grant execute on function public.trust_current_device_session(text, text, text, text, text) to authenticated;

revoke execute on function public.register_current_device_session(text, text, text, text, text, text) from public, anon;
grant execute on function public.register_current_device_session(text, text, text, text, text, text) to authenticated;

revoke execute on function public.admin_issue_device_verification_challenge(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_issue_device_verification_challenge(uuid, text, text, uuid) to service_role;

revoke execute on function public.verify_device_verification_otp(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.verify_device_verification_otp(uuid, text, text, text, text, text, text) to authenticated;

revoke execute on function public.sign_out_other_device_sessions() from public, anon;
grant execute on function public.sign_out_other_device_sessions() to authenticated;

revoke execute on function public.is_current_trusted_auth_session(uuid, uuid) from public, anon;
grant execute on function public.is_current_trusted_auth_session(uuid, uuid) to service_role;
