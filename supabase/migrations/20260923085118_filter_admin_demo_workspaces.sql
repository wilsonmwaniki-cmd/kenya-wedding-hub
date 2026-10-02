drop function if exists public.admin_list_couple_planning_passes(text, text, integer, integer);

create function public.admin_list_couple_planning_passes(
  search_query text default null,
  status_filter text default 'all',
  workspace_filter text default 'real',
  limit_rows integer default 100,
  offset_rows integer default 0
)
returns table (
  profile_id uuid,
  user_id uuid,
  full_name text,
  wedding_location text,
  wedding_date date,
  planning_pass_status text,
  planning_pass_expires_at timestamptz,
  updated_at timestamptz,
  email text,
  is_demo boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  if workspace_filter not in ('real', 'demo', 'all') then
    raise exception 'Unsupported workspace filter' using errcode = '22023';
  end if;

  return query
  select
    p.id,
    p.user_id,
    p.full_name::text,
    p.wedding_location::text,
    p.wedding_date,
    p.planning_pass_status::text,
    p.planning_pass_expires_at,
    p.updated_at::timestamptz,
    u.email::text,
    p.is_demo
  from public.profiles p
  left join auth.users u on u.id = p.user_id
  where p.role = 'couple'::public.app_role
    and (
      workspace_filter = 'all'
      or (workspace_filter = 'real' and not coalesce(p.is_demo, false))
      or (workspace_filter = 'demo' and coalesce(p.is_demo, false))
    )
    and (status_filter = 'all' or p.planning_pass_status = status_filter)
    and (
      search_query is null
      or p.full_name ilike '%' || search_query || '%'
      or p.wedding_location ilike '%' || search_query || '%'
      or u.email ilike '%' || search_query || '%'
    )
  order by p.updated_at desc
  limit greatest(1, least(limit_rows, 200))
  offset greatest(0, offset_rows);
end;
$$;

revoke all on function public.admin_list_couple_planning_passes(text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_couple_planning_passes(text, text, text, integer, integer) to authenticated;
