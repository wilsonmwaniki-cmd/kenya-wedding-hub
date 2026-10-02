-- Keep the owner overview focused on real customer conversion, not demo traffic.

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
  verified_professionals bigint,
  paid_couples bigint,
  free_couples bigint,
  couples_needing_renewal bigint,
  paid_vendors bigint,
  free_vendors bigint,
  vendors_needing_renewal bigint
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
  ),
  real_profiles as (
    select p.*, va.subscription_status as vendor_subscription_status, va.subscription_expires_at as vendor_subscription_expires_at,
      coalesce(va.verified, false) as vendor_verified, coalesce(va.verification_requested, false) as vendor_verification_requested
    from public.profiles p
    left join vendor_access va on va.user_id = p.user_id
    where not coalesce(p.is_demo, false)
  ),
  account_health as (
    select rp.user_id,
      case
        when rp.role = 'couple'::public.app_role and rp.planning_pass_status = 'active'
          and (rp.planning_pass_expires_at is null or rp.planning_pass_expires_at::date > current_date + 7) then 'paid_active'
        when rp.role = 'couple'::public.app_role and rp.planning_pass_status = 'active'
          and rp.planning_pass_expires_at::date between current_date and current_date + 7 then 'expiring_soon'
        when rp.role = 'couple'::public.app_role and rp.planning_pass_status in ('active', 'past_due', 'cancelled') then 'expired'
        when rp.role = 'planner'::public.app_role and rp.planner_subscription_status = 'active'
          and (rp.planner_subscription_expires_at is null or rp.planner_subscription_expires_at::date > current_date + 7) then 'paid_active'
        when rp.role = 'planner'::public.app_role and rp.planner_subscription_status = 'active'
          and rp.planner_subscription_expires_at::date between current_date and current_date + 7 then 'expiring_soon'
        when rp.role = 'planner'::public.app_role and rp.planner_subscription_status in ('active', 'past_due', 'cancelled') then 'expired'
        when rp.role = 'vendor'::public.app_role and rp.vendor_subscription_status = 'active'
          and (rp.vendor_subscription_expires_at is null or rp.vendor_subscription_expires_at::date > current_date + 7) then 'paid_active'
        when rp.role = 'vendor'::public.app_role and rp.vendor_subscription_status = 'active'
          and rp.vendor_subscription_expires_at::date between current_date and current_date + 7 then 'expiring_soon'
        when rp.role = 'vendor'::public.app_role and rp.vendor_subscription_status in ('active', 'past_due', 'cancelled') then 'expired'
        else 'free'
      end as health
    from real_profiles rp
  )
  select
    (select count(*) from public.profiles),
    (select count(*) from real_profiles),
    (select count(*) from real_profiles where role = 'couple'::public.app_role),
    (select count(*) from real_profiles where role = 'planner'::public.app_role),
    (select count(*) from real_profiles where role = 'vendor'::public.app_role),
    (select count(*) from real_profiles where role = 'admin'::public.app_role),
    (select count(*) from public.vendor_listings where user_id is null or user_id in (select user_id from real_profiles)),
    (select count(*) from public.vendor_listings v left join public.profiles p on p.user_id = v.user_id where v.is_approved = false and (v.user_id is null or not coalesce(p.is_demo, false))),
    (select count(*) from public.tasks t left join public.profiles p on p.user_id = t.user_id where not coalesce(p.is_demo, false)),
    (select count(*) from public.guests g left join public.profiles p on p.user_id = g.user_id where not coalesce(p.is_demo, false)),
    (select count(*) from public.budget_categories b left join public.profiles p on p.user_id = b.user_id where not coalesce(p.is_demo, false)),
    (select count(*) from public.planner_clients pc left join public.profiles p on p.user_id = pc.planner_user_id where not coalesce(p.is_demo, false)),
    (select count(*) from public.planner_link_requests where status = 'pending'),
    (select count(*) from account_health where health = 'paid_active'),
    (select count(*) from account_health where health = 'expiring_soon'),
    (select count(*) from account_health where health = 'expired'),
    (select count(*) from account_health where health = 'free'),
    (select count(*) from real_profiles where role = 'vendor'::public.app_role and vendor_verification_requested and not vendor_verified)
      + (select count(*) from real_profiles where role = 'planner'::public.app_role and planner_verification_requested and not planner_verified),
    (select count(distinct user_id) from real_profiles where (role = 'vendor'::public.app_role and vendor_verified) or (role = 'planner'::public.app_role and planner_verified)),
    (select count(*) from real_profiles where role = 'couple'::public.app_role and planning_pass_status = 'active' and (planning_pass_expires_at is null or planning_pass_expires_at::date >= current_date)),
    (select count(*) from real_profiles where role = 'couple'::public.app_role and planning_pass_status = 'inactive'),
    (select count(*) from real_profiles where role = 'couple'::public.app_role and (planning_pass_status in ('past_due', 'cancelled') or (planning_pass_status = 'active' and planning_pass_expires_at::date < current_date))),
    (select count(*) from real_profiles where role = 'vendor'::public.app_role and vendor_subscription_status = 'active' and (vendor_subscription_expires_at is null or vendor_subscription_expires_at::date >= current_date)),
    (select count(*) from real_profiles where role = 'vendor'::public.app_role and coalesce(vendor_subscription_status, 'inactive') = 'inactive'),
    (select count(*) from real_profiles where role = 'vendor'::public.app_role and (vendor_subscription_status in ('past_due', 'cancelled') or (vendor_subscription_status = 'active' and vendor_subscription_expires_at::date < current_date)));
end;
$$;

revoke all on function public.admin_dashboard_metrics() from public, anon;
grant execute on function public.admin_dashboard_metrics() to authenticated;
