-- Some demo sessions created before profile.is_demo was introduced still carry
-- the original demo marker in auth metadata. Reconcile only those explicitly
-- marked records so the admin's real-user view remains trustworthy.
update public.profiles p
set is_demo = true,
    updated_at = now()
from auth.users u
where u.id = p.user_id
  and not p.is_demo
  and lower(coalesce(u.raw_user_meta_data ->> 'zania_demo', 'false')) = 'true';

-- Add a real-user tally while preserving the existing admin-only boundary.
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
  open_link_requests bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  return query
  select
    (select count(*) from public.profiles),
    (select count(*) from public.profiles where not is_demo),
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
    (select count(*) from public.planner_link_requests where status = 'pending');
end;
$$;

revoke all on function public.admin_dashboard_metrics() from public, anon;
grant execute on function public.admin_dashboard_metrics() to authenticated;
