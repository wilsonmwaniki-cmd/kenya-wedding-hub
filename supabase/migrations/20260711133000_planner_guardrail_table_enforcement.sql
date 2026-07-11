create or replace function public.normalize_planner_client_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.is_archived := coalesce(new.is_archived, false);
    new.workspace_status := case when new.is_archived then 'archived' else coalesce(new.workspace_status, 'active') end;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if coalesce(new.is_archived, false) then
      new.workspace_status := 'archived';
      new.archived_at := coalesce(new.archived_at, now());
      new.archived_by_user_id := coalesce(new.archived_by_user_id, auth.uid());
      return new;
    end if;

    new.workspace_status := 'active';
    new.archived_at := null;
    new.archived_by_user_id := null;

    return new;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_planner_client_guardrails()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(new.is_archived, false) then
    perform public.lock_planner_free_wedding_slot(new.id);
  end if;

  return new;
end;
$$;

create or replace function public.prevent_planner_client_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.planner_has_active_subscription(old.planner_user_id) then
    return old;
  end if;

  raise exception 'Planner workspaces on the free tier cannot be permanently deleted. Archive them instead.'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists normalize_planner_client_state on public.planner_clients;
create trigger normalize_planner_client_state
before insert or update on public.planner_clients
for each row execute function public.normalize_planner_client_state();

drop trigger if exists enforce_planner_client_guardrails on public.planner_clients;
create trigger enforce_planner_client_guardrails
after insert or update on public.planner_clients
for each row execute function public.enforce_planner_client_guardrails();

drop trigger if exists prevent_planner_client_delete on public.planner_clients;
create trigger prevent_planner_client_delete
before delete on public.planner_clients
for each row execute function public.prevent_planner_client_delete();

grant execute on function public.normalize_planner_client_state() to authenticated;
grant execute on function public.enforce_planner_client_guardrails() to authenticated;
grant execute on function public.prevent_planner_client_delete() to authenticated;
