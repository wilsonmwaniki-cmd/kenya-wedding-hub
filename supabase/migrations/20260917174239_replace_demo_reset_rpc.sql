create or replace function public.reset_demo_session()
returns table (demo_role text, destination_path text, expires_at timestamptz, reset_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_role text;
  next_expiry timestamptz := now() + interval '24 hours';
  next_reset_count integer;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;

  select session.demo_role
    into selected_role
  from public.demo_sessions as session
  where session.user_id = current_user_id
    and session.status = 'active'
  for update;

  if selected_role is null then raise exception 'Active demo session not found'; end if;

  perform private.seed_demo_workspace(current_user_id, selected_role);

  update public.demo_sessions as session
  set expires_at = next_expiry,
      last_reset_at = now(),
      reset_count = session.reset_count + 1
  where session.user_id = current_user_id
  returning session.reset_count into next_reset_count;

  return query
    select selected_role,
      case selected_role
        when 'couple' then '/dashboard'
        when 'vendor' then '/vendor-dashboard'
        else '/clients'
      end,
      next_expiry,
      next_reset_count;
end;
$$;

revoke all on function public.reset_demo_session() from public, anon;
grant execute on function public.reset_demo_session() to authenticated;
