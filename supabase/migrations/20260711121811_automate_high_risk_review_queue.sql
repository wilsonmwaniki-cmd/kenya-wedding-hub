create or replace function public.queue_high_risk_account_for_review()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.professional_use_risk_level = 'high'
    and new.support_review_status = 'none'
    and not coalesce(new.verified_couple, false)
  then
    new.support_review_status := 'pending';

    perform public.log_account_audit_event(
      new.user_id,
      null,
      'AUTOMATED_REVIEW_QUEUED',
      jsonb_build_object(
        'risk_score', new.professional_use_risk_score,
        'risk_level', new.professional_use_risk_level,
        'high_risk_threshold', public.get_zania_flag_int('PROFESSIONAL_RISK_THRESHOLD_HIGH', 60),
        'previous_review_status', old.support_review_status,
        'reason', 'high_professional_use_risk'
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists queue_high_risk_account_for_review on public.profiles;
create trigger queue_high_risk_account_for_review
before update of professional_use_risk_score, professional_use_risk_level on public.profiles
for each row
execute function public.queue_high_risk_account_for_review();

-- Queue existing high-risk accounts without overriding prior human decisions.
with queued_accounts as (
  update public.profiles
  set
    support_review_status = 'pending',
    updated_at = now()
  where role = 'couple'::public.app_role
    and professional_use_risk_level = 'high'
    and support_review_status = 'none'
    and not verified_couple
  returning user_id, professional_use_risk_score, professional_use_risk_level
)
insert into public.account_audit_events (user_id, event_type, metadata)
select
  user_id,
  'AUTOMATED_REVIEW_QUEUED',
  jsonb_build_object(
    'risk_score', professional_use_risk_score,
    'risk_level', professional_use_risk_level,
    'high_risk_threshold', public.get_zania_flag_int('PROFESSIONAL_RISK_THRESHOLD_HIGH', 60),
    'previous_review_status', 'none',
    'reason', 'migration_backfill'
  )
from queued_accounts;

revoke execute on function public.queue_high_risk_account_for_review() from public, anon, authenticated;
revoke execute on function public.log_account_audit_event(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.recalculate_professional_risk(uuid) from public, anon, authenticated;

grant execute on function public.log_account_audit_event(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.recalculate_professional_risk(uuid) to service_role;
