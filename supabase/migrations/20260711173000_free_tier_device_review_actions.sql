create or replace function public.admin_reset_free_tier_device_sessions(target_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  revoked_count integer := 0;
begin
  perform public.require_admin();

  update public.device_sessions
  set
    revoked_at = now(),
    is_current = false,
    updated_at = now()
  where user_id = target_user_id
    and revoked_at is null;

  get diagnostics revoked_count = row_count;

  update public.device_verification_challenges
  set
    status = case
      when status = 'pending' then 'expired'
      else status
    end,
    updated_at = now()
  where user_id = target_user_id
    and status = 'pending';

  perform public.log_account_audit_event(
    target_user_id,
    null,
    'DEVICE_TRUST_RESET',
    jsonb_build_object(
      'revoked_count', revoked_count,
      'triggered_by_admin', true
    )
  );

  return revoked_count;
end;
$$;

revoke execute on function public.admin_reset_free_tier_device_sessions(uuid) from public, anon;
grant execute on function public.admin_reset_free_tier_device_sessions(uuid) to authenticated;
