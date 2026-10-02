drop function if exists public.admin_list_users(text, text, integer, integer);

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
    select
      p.user_id,
      u.email,
      u.created_at,
      u.last_sign_in_at,
      p.full_name,
      p.role,
      p.company_name,
      p.wedding_date,
      p.is_demo
    from public.profiles p
    left join auth.users u on u.id = p.user_id
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
