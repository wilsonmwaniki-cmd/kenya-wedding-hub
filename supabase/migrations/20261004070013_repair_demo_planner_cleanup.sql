-- Expired demo-user deletion can cascade through profiles and weddings before
-- planner_clients is updated. Do not create a free-tier entitlement after the
-- owning planner profile has already been removed.
create or replace function public.enforce_planner_client_guardrails()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = new.planner_user_id
      and p.role = 'planner'::public.app_role
  ) then
    return new;
  end if;

  if not coalesce(new.is_archived, false) then
    perform public.lock_planner_free_wedding_slot(new.id);
  end if;

  return new;
end;
$$;

-- A planner_client whose owning profile no longer exists is an orphan, not an
-- active free-tier workspace. Allow the demo purge to remove that row while
-- preserving the normal archive-only rule for live free-tier planners.
create or replace function public.prevent_planner_client_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = old.planner_user_id
  ) then
    return old;
  end if;

  if public.planner_has_active_subscription(old.planner_user_id) then
    return old;
  end if;

  raise exception 'Planner workspaces on the free tier cannot be permanently deleted. Archive them instead.'
    using errcode = 'P0001';
end;
$$;

-- Retain the existing expiry rules, then remove planner-client rows belonging
-- only to users deleted by this purge. This avoids accumulating private orphan
-- workspaces without widening ordinary delete permissions.
create or replace function private.purge_expired_demo_users()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  with purge_targets as materialized (
    select u.id
    from auth.users u
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
          select 1
          from public.demo_sessions ds
          where ds.user_id = u.id
        )
      )
    )
  ),
  deleted_users as (
    delete from auth.users u
    using purge_targets target
    where u.id = target.id
    returning u.id
  ),
  deleted_planner_clients as (
    delete from public.planner_clients pc
    using deleted_users deleted_user
    where pc.planner_user_id = deleted_user.id
    returning pc.id
  )
  select count(*)::integer
  into deleted_count
  from deleted_users;

  return deleted_count;
end;
$$;
