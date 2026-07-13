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
    encode(extensions.digest(raw_code, 'sha256'), 'hex'),
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
