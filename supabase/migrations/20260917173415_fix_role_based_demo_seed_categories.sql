-- Align the sample couple budget with the canonical planning catalog enforced
-- by normalize_budget_category_name(). Keep this as a follow-up migration
-- because the original demo migration is already present in remote history.
do $$
declare
  function_definition text;
begin
  select pg_get_functiondef('private.seed_demo_workspace(uuid,text)'::regprocedure)
    into function_definition;

  if function_definition not like '%''Attire & beauty''%' then
    raise exception 'Expected demo seed category was not found';
  end if;

  function_definition := replace(
    function_definition,
    '''Attire & beauty''',
    '''Bridal Gown, Accessories, Preparation'''
  );
  execute function_definition;
end;
$$;

-- Failed seed transactions cannot create a demo_sessions row. Clean up those
-- explicitly marked anonymous demo users as well as completed/expired demos.
create or replace function private.purge_expired_demo_users()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  with deleted as (
    delete from auth.users u
    where (
      exists (
        select 1
        from public.demo_sessions ds
        where ds.user_id = u.id
          and (
            ds.expires_at < now() - interval '1 hour'
            or (ds.status = 'ended' and ds.started_at < now() - interval '1 hour')
          )
      )
      or (
        u.is_anonymous is true
        and coalesce((u.raw_user_meta_data ->> 'zania_demo')::boolean, false)
        and u.created_at < now() - interval '1 hour'
        and not exists (
          select 1 from public.demo_sessions ds where ds.user_id = u.id
        )
      )
    )
    returning u.id
  )
  select count(*)::integer into deleted_count from deleted;
  return deleted_count;
end;
$$;

revoke all on function private.purge_expired_demo_users() from public, anon, authenticated;
