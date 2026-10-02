revoke all on function public.approve_planner_code_link_request(uuid) from public;
revoke all on function public.approve_planner_code_link_request(uuid) from anon;
grant execute on function public.approve_planner_code_link_request(uuid) to authenticated;
