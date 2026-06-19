alter table public.ai_plan_configs enable row level security;
alter table public.ai_assistant_usage_logs enable row level security;
alter table public.public_token_access_logs enable row level security;

drop policy if exists "Admins can view AI plan configs" on public.ai_plan_configs;
create policy "Admins can view AI plan configs"
on public.ai_plan_configs
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admins can view AI assistant usage logs" on public.ai_assistant_usage_logs;
create policy "Admins can view AI assistant usage logs"
on public.ai_assistant_usage_logs
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admins can view public token access logs" on public.public_token_access_logs;
create policy "Admins can view public token access logs"
on public.public_token_access_logs
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

revoke execute on function public.admin_ai_usage_metrics() from public, anon;
grant execute on function public.admin_ai_usage_metrics() to authenticated;

revoke execute on function public.admin_beta_readiness_snapshot() from public, anon;
grant execute on function public.admin_beta_readiness_snapshot() to authenticated;

revoke execute on function public.admin_dashboard_metrics() from public, anon;
grant execute on function public.admin_dashboard_metrics() to authenticated;

revoke execute on function public.admin_list_ai_plan_configs() from public, anon;
grant execute on function public.admin_list_ai_plan_configs() to authenticated;

revoke execute on function public.admin_list_ai_usage(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_ai_usage(text, text, integer, integer) to authenticated;

revoke execute on function public.admin_list_couple_planning_passes(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_couple_planning_passes(text, text, integer, integer) to authenticated;

revoke execute on function public.admin_list_planner_profiles(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_planner_profiles(text, text, integer, integer) to authenticated;

revoke execute on function public.admin_list_users(text, public.app_role, integer, integer) from public, anon;
grant execute on function public.admin_list_users(text, public.app_role, integer, integer) to authenticated;

revoke execute on function public.admin_list_vendor_listings(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_vendor_listings(text, text, integer, integer) to authenticated;

revoke execute on function public.admin_list_vendor_reputation_reviews(text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_vendor_reputation_reviews(text, text, text, integer, integer) to authenticated;

revoke execute on function public.admin_recent_function_events(text, integer) from public, anon;
grant execute on function public.admin_recent_function_events(text, integer) to authenticated;

revoke execute on function public.admin_reputation_review_metrics() from public, anon;
grant execute on function public.admin_reputation_review_metrics() to authenticated;

revoke execute on function public.admin_review_vendor_listing(uuid, boolean, boolean) from public, anon;
grant execute on function public.admin_review_vendor_listing(uuid, boolean, boolean) to authenticated;

revoke execute on function public.admin_set_ai_plan_config(text, integer, boolean, boolean, text, text) from public, anon;
grant execute on function public.admin_set_ai_plan_config(text, integer, boolean, boolean, text, text) to authenticated;
