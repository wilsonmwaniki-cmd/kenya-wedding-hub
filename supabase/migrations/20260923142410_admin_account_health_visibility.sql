-- Give the admin portal a single, consistent read on access and verification.
-- These functions remain admin-only and intentionally derive their state from
-- the source-of-truth entitlement fields instead of maintaining duplicate flags.

drop function if exists public.admin_dashboard_metrics();

create function public.admin_dashboard_metrics()
returns table(
  total_users bigint,
  total_real_users bigint,
  total_couples bigint,
  total_planners bigint,
  total_vendors bigint,
  total_admins bigint,
  total_vendor_listings bigint,
  pending_vendor_approvals bigint,
  total_tasks bigint,
  total_guests bigint,
  total_budget_items bigint,
  total_clients bigint,
  open_link_requests bigint,
  paid_active_users bigint,
  expiring_soon_users bigint,
  expired_access_users bigint,
  free_users bigint,
  pending_verification_requests bigint,
  verified_professionals bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  return query
  with vendor_access as (
    select
      v.user_id,
      bool_or(v.subscription_status = 'active' and (v.subscription_expires_at is null or v.subscription_expires_at::date > current_date + 7)) as paid_active,
      bool_or(v.subscription_status = 'active' and v.subscription_expires_at::date between current_date and current_date + 7) as expiring_soon,
      bool_or(v.subscription_status in ('active', 'past_due', 'cancelled')) as has_subscription_state
    from public.vendor_listings v
    where v.user_id is not null
    group by v.user_id
  ),
  account_health as (
    select
      p.user_id,
      case
        when p.role = 'couple'::public.app_role
          and p.planning_pass_status = 'active'
          and (p.planning_pass_expires_at is null or p.planning_pass_expires_at::date > current_date + 7) then 'paid_active'
        when p.role = 'couple'::public.app_role
          and p.planning_pass_status = 'active'
          and p.planning_pass_expires_at::date between current_date and current_date + 7 then 'expiring_soon'
        when p.role = 'couple'::public.app_role
          and p.planning_pass_status in ('active', 'past_due', 'cancelled') then 'expired'
        when p.role = 'planner'::public.app_role
          and p.planner_subscription_status = 'active'
          and (p.planner_subscription_expires_at is null or p.planner_subscription_expires_at::date > current_date + 7) then 'paid_active'
        when p.role = 'planner'::public.app_role
          and p.planner_subscription_status = 'active'
          and p.planner_subscription_expires_at::date between current_date and current_date + 7 then 'expiring_soon'
        when p.role = 'planner'::public.app_role
          and p.planner_subscription_status in ('active', 'past_due', 'cancelled') then 'expired'
        when p.role = 'vendor'::public.app_role and coalesce(v.paid_active, false) then 'paid_active'
        when p.role = 'vendor'::public.app_role and coalesce(v.expiring_soon, false) then 'expiring_soon'
        when p.role = 'vendor'::public.app_role and coalesce(v.has_subscription_state, false) then 'expired'
        else 'free'
      end as health
    from public.profiles p
    left join vendor_access v on v.user_id = p.user_id
    where not coalesce(p.is_demo, false)
  )
  select
    (select count(*) from public.profiles),
    (select count(*) from public.profiles where not coalesce(is_demo, false)),
    (select count(*) from public.profiles where role = 'couple'::public.app_role),
    (select count(*) from public.profiles where role = 'planner'::public.app_role),
    (select count(*) from public.profiles where role = 'vendor'::public.app_role),
    (select count(*) from public.profiles where role = 'admin'::public.app_role),
    (select count(*) from public.vendor_listings),
    (select count(*) from public.vendor_listings where is_approved = false),
    (select count(*) from public.tasks),
    (select count(*) from public.guests),
    (select count(*) from public.budget_categories),
    (select count(*) from public.planner_clients),
    (select count(*) from public.planner_link_requests where status = 'pending'),
    (select count(*) from account_health where health = 'paid_active'),
    (select count(*) from account_health where health = 'expiring_soon'),
    (select count(*) from account_health where health = 'expired'),
    (select count(*) from account_health where health = 'free'),
    (
      (select count(*)
       from public.vendor_listings v
       join public.profiles p on p.user_id = v.user_id
       where not coalesce(p.is_demo, false)
         and v.verification_requested
         and not v.is_verified)
      +
      (select count(*)
       from public.profiles p
       where not coalesce(p.is_demo, false)
         and p.role = 'planner'::public.app_role
         and p.planner_verification_requested
         and not p.planner_verified)
    ),
    (
      select count(*) from (
        select distinct v.user_id
        from public.vendor_listings v
        join public.profiles p on p.user_id = v.user_id
        where not coalesce(p.is_demo, false) and v.is_verified
        union
        select p.user_id
        from public.profiles p
        where not coalesce(p.is_demo, false)
          and p.role = 'planner'::public.app_role
          and p.planner_verified
      ) verified
    );
end;
$$;

revoke all on function public.admin_dashboard_metrics() from public, anon;
grant execute on function public.admin_dashboard_metrics() to authenticated;

drop function if exists public.admin_list_users(text, text, text, integer, integer);

create function public.admin_list_users(
  search_query text default null,
  role_filter text default null,
  workspace_filter text default 'real',
  limit_rows integer default 100,
  offset_rows integer default 0
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  perform public.require_admin();

  if workspace_filter not in ('real', 'demo', 'all') then
    raise exception 'Unsupported workspace filter' using errcode = '22023';
  end if;

  select json_agg(row_to_json(t)) into result
  from (
    with vendor_access as (
      select
        v.user_id,
        case
          when bool_or(v.subscription_status = 'active') then 'active'
          when bool_or(v.subscription_status = 'past_due') then 'past_due'
          when bool_or(v.subscription_status = 'cancelled') then 'cancelled'
          else 'inactive'
        end as subscription_status,
        max(v.subscription_expires_at) as subscription_expires_at,
        bool_or(v.is_verified) as verified,
        bool_or(v.verification_requested and not v.is_verified) as verification_requested
      from public.vendor_listings v
      where v.user_id is not null
      group by v.user_id
    )
    select
      p.user_id,
      u.email,
      u.created_at,
      u.last_sign_in_at,
      p.full_name,
      p.role,
      p.company_name,
      p.wedding_date,
      p.is_demo,
      case
        when p.role = 'couple'::public.app_role then 'Wedding Planning Pass'
        when p.role = 'vendor'::public.app_role then 'Vendor subscription'
        when p.role = 'planner'::public.app_role and coalesce(p.planner_type, 'professional') = 'committee' then 'Committee subscription'
        when p.role = 'planner'::public.app_role then 'Planner subscription'
        else 'Admin account'
      end as access_plan,
      case
        when p.role = 'couple'::public.app_role then p.planning_pass_status::text
        when p.role = 'planner'::public.app_role then p.planner_subscription_status::text
        when p.role = 'vendor'::public.app_role then coalesce(v.subscription_status, 'inactive')
        else 'not_applicable'
      end as subscription_status,
      case
        when p.role = 'couple'::public.app_role then p.planning_pass_expires_at
        when p.role = 'planner'::public.app_role then p.planner_subscription_expires_at
        when p.role = 'vendor'::public.app_role then v.subscription_expires_at
        else null
      end as subscription_expires_at,
      case
        when p.role = 'planner'::public.app_role and p.planner_verified then 'verified'
        when p.role = 'planner'::public.app_role and p.planner_verification_requested then 'requested'
        when p.role = 'planner'::public.app_role then 'not_requested'
        when p.role = 'vendor'::public.app_role and coalesce(v.verified, false) then 'verified'
        when p.role = 'vendor'::public.app_role and coalesce(v.verification_requested, false) then 'requested'
        when p.role = 'vendor'::public.app_role then 'not_requested'
        else 'not_applicable'
      end as verification_status
    from public.profiles p
    left join auth.users u on u.id = p.user_id
    left join vendor_access v on v.user_id = p.user_id
    where (workspace_filter = 'all'
      or (workspace_filter = 'real' and not coalesce(p.is_demo, false))
      or (workspace_filter = 'demo' and coalesce(p.is_demo, false)))
      and (search_query is null
        or p.full_name ilike '%' || search_query || '%'
        or u.email ilike '%' || search_query || '%'
        or p.company_name ilike '%' || search_query || '%')
      and (role_filter is null or p.role::text = role_filter)
    order by u.created_at desc nulls last
    limit greatest(1, least(limit_rows, 200))
    offset greatest(0, offset_rows)
  ) t;

  return coalesce(result, '[]'::json);
end;
$$;

revoke all on function public.admin_list_users(text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_users(text, text, text, integer, integer) to authenticated;
