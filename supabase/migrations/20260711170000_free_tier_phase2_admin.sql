create or replace function public.admin_free_tier_risk_summary()
returns table (
  flagged_accounts bigint,
  high_risk_accounts bigint,
  medium_risk_accounts bigint,
  pending_reviews bigint,
  restricted_reviews bigint,
  deleted_weddings bigint
)
language sql
security definer
set search_path = public
as $$
  with risk_profiles as (
    select *
    from public.profiles p
    where p.role = 'couple'::public.app_role
  )
  select
    count(*) filter (where professional_use_risk_score > 0)::bigint as flagged_accounts,
    count(*) filter (where professional_use_risk_level = 'high')::bigint as high_risk_accounts,
    count(*) filter (where professional_use_risk_level = 'medium')::bigint as medium_risk_accounts,
    count(*) filter (where support_review_status = 'pending')::bigint as pending_reviews,
    count(*) filter (where support_review_status = 'restricted')::bigint as restricted_reviews,
    (
      select count(*)
      from public.weddings w
      where w.status = 'deleted'
        or w.deleted_at is not null
    )::bigint as deleted_weddings
  from risk_profiles;
$$;

create or replace function public.admin_list_free_tier_risk_accounts(
  search_query text default null,
  risk_level_filter text default 'all',
  review_status_filter text default 'all',
  limit_rows integer default 100,
  offset_rows integer default 0
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  role text,
  account_purpose text,
  verified_couple boolean,
  professional_use_risk_score integer,
  professional_use_risk_level text,
  last_risk_calculated_at timestamptz,
  support_review_status text,
  support_review_notes text,
  lifetime_wedding_count bigint,
  active_wedding_count bigint,
  deleted_wedding_count bigint,
  archived_wedding_count bigint,
  device_count bigint,
  current_trusted_device_count bigint,
  device_switches_last_90_days bigint,
  otp_requests_last_30_days bigint,
  otp_failures_last_30_days bigint,
  collaborator_invite_attempts bigint,
  export_count bigint,
  last_wedding_created_at timestamptz,
  last_deleted_wedding_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  with base as (
    select
      p.user_id,
      au.email::text as email,
      p.full_name,
      p.role::text as role,
      p.account_purpose,
      p.verified_couple,
      p.professional_use_risk_score,
      p.professional_use_risk_level,
      p.last_risk_calculated_at,
      p.support_review_status,
      p.support_review_notes
    from public.profiles p
    join auth.users au on au.id = p.user_id
    where p.role = 'couple'::public.app_role
      and (
        coalesce(search_query, '') = ''
        or coalesce(p.full_name, '') ilike '%' || search_query || '%'
        or coalesce(au.email, '') ilike '%' || search_query || '%'
        or coalesce(p.account_purpose, '') ilike '%' || search_query || '%'
      )
      and (
        coalesce(risk_level_filter, 'all') = 'all'
        or p.professional_use_risk_level = risk_level_filter
      )
      and (
        coalesce(review_status_filter, 'all') = 'all'
        or p.support_review_status = review_status_filter
      )
  ),
  wedding_counts as (
    select
      wlh.user_id,
      count(*)::bigint as lifetime_wedding_count,
      count(*) filter (where w.status = 'active' and w.deleted_at is null)::bigint as active_wedding_count,
      count(*) filter (where w.status = 'deleted' or w.deleted_at is not null)::bigint as deleted_wedding_count,
      count(*) filter (where w.status = 'archived')::bigint as archived_wedding_count,
      max(wlh.created_at) as last_wedding_created_at,
      max(wlh.deleted_at) as last_deleted_wedding_at
    from public.wedding_lifecycle_history wlh
    left join public.weddings w on w.id = wlh.wedding_id
    group by wlh.user_id
  ),
  device_counts as (
    select
      ds.user_id,
      count(*)::bigint as device_count,
      count(*) filter (where ds.trusted_at is not null and ds.revoked_at is null and ds.is_current = true)::bigint as current_trusted_device_count
    from public.device_sessions ds
    group by ds.user_id
  ),
  audit_counts as (
    select
      ae.user_id,
      count(*) filter (
        where ae.event_type = 'DEVICE_SWITCHED'
          and ae.created_at > now() - interval '90 days'
      )::bigint as device_switches_last_90_days,
      count(*) filter (
        where ae.event_type in ('COLLABORATOR_INVITE_ATTEMPTED', 'PLANNER_ROLE_ATTEMPTED')
      )::bigint as collaborator_invite_attempts,
      count(*) filter (
        where ae.event_type = 'EXPORT_GENERATED'
      )::bigint as export_count
    from public.account_audit_events ae
    group by ae.user_id
  ),
  otp_counts as (
    select
      oe.user_id,
      count(*) filter (
        where oe.status = 'requested'
          and oe.created_at > now() - interval '30 days'
      )::bigint as otp_requests_last_30_days,
      count(*) filter (
        where oe.status in ('failed', 'locked')
          and oe.created_at > now() - interval '30 days'
      )::bigint as otp_failures_last_30_days
    from public.otp_audit_events oe
    group by oe.user_id
  )
  select
    b.user_id,
    b.email,
    b.full_name,
    b.role,
    b.account_purpose,
    b.verified_couple,
    b.professional_use_risk_score,
    b.professional_use_risk_level,
    b.last_risk_calculated_at,
    b.support_review_status,
    b.support_review_notes,
    coalesce(wc.lifetime_wedding_count, 0),
    coalesce(wc.active_wedding_count, 0),
    coalesce(wc.deleted_wedding_count, 0),
    coalesce(wc.archived_wedding_count, 0),
    coalesce(dc.device_count, 0),
    coalesce(dc.current_trusted_device_count, 0),
    coalesce(ac.device_switches_last_90_days, 0),
    coalesce(oc.otp_requests_last_30_days, 0),
    coalesce(oc.otp_failures_last_30_days, 0),
    coalesce(ac.collaborator_invite_attempts, 0),
    coalesce(ac.export_count, 0),
    wc.last_wedding_created_at,
    wc.last_deleted_wedding_at
  from base b
  left join wedding_counts wc on wc.user_id = b.user_id
  left join device_counts dc on dc.user_id = b.user_id
  left join audit_counts ac on ac.user_id = b.user_id
  left join otp_counts oc on oc.user_id = b.user_id
  order by
    b.professional_use_risk_score desc,
    b.last_risk_calculated_at desc nulls last,
    b.full_name asc nulls last
  limit greatest(coalesce(limit_rows, 100), 1)
  offset greatest(coalesce(offset_rows, 0), 0);
$$;

create or replace function public.admin_list_user_wedding_lifecycle(target_user_id uuid)
returns table (
  wedding_id uuid,
  created_at timestamptz,
  deleted_at timestamptz,
  archived_at timestamptz,
  restored_at timestamptz,
  wedding_date date,
  status text,
  is_meaningful boolean,
  became_meaningful_at timestamptz,
  workspace_lifetime_days integer,
  guest_count_at_deletion integer,
  vendor_count_at_deletion integer,
  export_count integer,
  collaborator_invite_count integer,
  created_wedding_name text,
  deletion_reason text
)
language sql
security definer
set search_path = public
as $$
  select
    wlh.wedding_id,
    wlh.created_at,
    wlh.deleted_at,
    null::timestamptz as archived_at,
    null::timestamptz as restored_at,
    wlh.wedding_date,
    coalesce(w.status::text, 'deleted') as status,
    wlh.is_meaningful,
    wlh.became_meaningful_at,
    wlh.workspace_lifetime_days,
    wlh.guest_count_at_deletion,
    wlh.vendor_count_at_deletion,
    wlh.export_count,
    wlh.collaborator_invite_count,
    wlh.created_wedding_name,
    wlh.deletion_reason
  from public.wedding_lifecycle_history wlh
  left join public.weddings w on w.id = wlh.wedding_id
  where wlh.user_id = target_user_id
  order by wlh.created_at desc;
$$;

create or replace function public.admin_list_user_account_audit_events(
  target_user_id uuid,
  limit_rows integer default 30
)
returns table (
  id uuid,
  created_at timestamptz,
  wedding_id uuid,
  device_session_id uuid,
  event_type text,
  metadata jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    ae.id,
    ae.created_at,
    ae.wedding_id,
    ae.device_session_id,
    ae.event_type,
    ae.metadata
  from public.account_audit_events ae
  where ae.user_id = target_user_id
  order by ae.created_at desc
  limit greatest(coalesce(limit_rows, 30), 1);
$$;

create or replace function public.admin_set_free_tier_review_state(
  target_user_id uuid,
  new_review_status text,
  new_review_notes text default null,
  new_verified_couple boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_verified_couple boolean;
begin
  perform public.require_admin();

  if new_review_status not in ('none', 'pending', 'approved', 'restricted') then
    raise exception 'Unsupported review status'
      using errcode = 'P0001';
  end if;

  select verified_couple
  into resolved_verified_couple
  from public.profiles
  where user_id = target_user_id;

  update public.profiles
  set
    support_review_status = new_review_status,
    support_review_notes = nullif(trim(coalesce(new_review_notes, '')), ''),
    verified_couple = coalesce(new_verified_couple, resolved_verified_couple),
    updated_at = now()
  where user_id = target_user_id;

  if not found then
    raise exception 'Profile not found'
      using errcode = 'P0002';
  end if;

  perform public.log_account_audit_event(
    target_user_id,
    null,
    'SUPPORT_REVIEW_UPDATED',
    jsonb_build_object(
      'support_review_status', new_review_status,
      'verified_couple', coalesce(new_verified_couple, resolved_verified_couple),
      'review_notes_present', nullif(trim(coalesce(new_review_notes, '')), '') is not null
    )
  );

  perform public.recalculate_professional_risk(target_user_id);
end;
$$;

create or replace function public.admin_restore_deleted_wedding(target_wedding_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  perform public.restore_deleted_wedding_workspace(target_wedding_id);
end;
$$;

revoke execute on function public.admin_free_tier_risk_summary() from public, anon;
grant execute on function public.admin_free_tier_risk_summary() to authenticated;

revoke execute on function public.admin_list_free_tier_risk_accounts(text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_free_tier_risk_accounts(text, text, text, integer, integer) to authenticated;

revoke execute on function public.admin_list_user_wedding_lifecycle(uuid) from public, anon;
grant execute on function public.admin_list_user_wedding_lifecycle(uuid) to authenticated;

revoke execute on function public.admin_list_user_account_audit_events(uuid, integer) from public, anon;
grant execute on function public.admin_list_user_account_audit_events(uuid, integer) to authenticated;

revoke execute on function public.admin_set_free_tier_review_state(uuid, text, text, boolean) from public, anon;
grant execute on function public.admin_set_free_tier_review_state(uuid, text, text, boolean) to authenticated;

revoke execute on function public.admin_restore_deleted_wedding(uuid) from public, anon;
grant execute on function public.admin_restore_deleted_wedding(uuid) to authenticated;
