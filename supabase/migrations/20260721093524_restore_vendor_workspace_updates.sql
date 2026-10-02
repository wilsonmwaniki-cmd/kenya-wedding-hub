create table if not exists public.workspace_vendor_updates (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  update_type text not null
    check (update_type in ('waiting_on_couple', 'need_approval', 'on_track', 'delivered', 'freeform')),
  note_message text null,
  is_archived boolean not null default false,
  archived_at timestamptz null,
  archived_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_vendor_updates_vendor_id_idx
  on public.workspace_vendor_updates (vendor_id, created_at desc);

create index if not exists workspace_vendor_updates_wedding_id_idx
  on public.workspace_vendor_updates (wedding_id, created_at desc);

drop trigger if exists update_workspace_vendor_updates_updated_at on public.workspace_vendor_updates;
create trigger update_workspace_vendor_updates_updated_at
before update on public.workspace_vendor_updates
for each row execute function public.update_updated_at_column();

alter table public.workspace_vendor_updates enable row level security;

grant select, insert, update on public.workspace_vendor_updates to authenticated;

drop policy if exists "Workspace members can view vendor updates" on public.workspace_vendor_updates;
create policy "Workspace members can view vendor updates"
on public.workspace_vendor_updates
for select
to authenticated
using (
  public.can_manage_wedding_memberships(wedding_id)
  or public.is_wedding_member(wedding_id)
  or exists (
    select 1
    from public.workspace_vendor_invites wvi
    where wvi.vendor_id = workspace_vendor_updates.vendor_id
      and wvi.invited_vendor_user_id = auth.uid()
      and wvi.invite_status = 'accepted'
  )
  or exists (
    select 1
    from public.vendors v
    join public.vendor_listings vl on vl.id = v.vendor_listing_id
    where v.id = workspace_vendor_updates.vendor_id
      and vl.user_id = auth.uid()
      and public.vendor_listing_has_full_access(vl.id)
  )
);

drop policy if exists "Wedding managers can archive vendor updates" on public.workspace_vendor_updates;
create policy "Wedding managers can archive vendor updates"
on public.workspace_vendor_updates
for update
to authenticated
using (public.can_manage_wedding_memberships(wedding_id))
with check (public.can_manage_wedding_memberships(wedding_id));

create or replace function public.create_vendor_workspace_update(
  target_vendor_id uuid,
  update_type_input text,
  note_message_input text default null
)
returns public.workspace_vendor_updates
language plpgsql
security definer
set search_path = public
as $$
declare
  target_vendor public.vendors%rowtype;
  target_wedding_id uuid;
  can_manage boolean := false;
  created_row public.workspace_vendor_updates%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  if update_type_input not in ('waiting_on_couple', 'need_approval', 'on_track', 'delivered', 'freeform') then
    raise exception 'Invalid vendor update type'
      using errcode = '22023';
  end if;

  select *
  into target_vendor
  from public.vendors
  where id = target_vendor_id;

  if not found then
    raise exception 'Vendor row not found'
      using errcode = 'P0002';
  end if;

  target_wedding_id := public.resolve_vendor_workspace_wedding_id(target_vendor.id);
  if target_wedding_id is null then
    raise exception 'Vendor is not attached to a wedding workspace'
      using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from public.workspace_vendor_invites wvi
    where wvi.vendor_id = target_vendor.id
      and wvi.invited_vendor_user_id = auth.uid()
      and wvi.invite_status = 'accepted'
  ) or exists (
    select 1
    from public.vendor_listings vl
    where vl.id = target_vendor.vendor_listing_id
      and vl.user_id = auth.uid()
      and public.vendor_listing_has_full_access(vl.id)
  ) or public.has_role(auth.uid(), 'admin'::public.app_role)
  into can_manage;

  if not can_manage then
    raise exception 'You do not have access to post an update for this vendor workspace record'
      using errcode = '42501';
  end if;

  insert into public.workspace_vendor_updates (
    wedding_id,
    vendor_id,
    created_by_user_id,
    update_type,
    note_message
  )
  values (
    target_wedding_id,
    target_vendor.id,
    auth.uid(),
    update_type_input,
    nullif(btrim(note_message_input), '')
  )
  returning * into created_row;

  return created_row;
end;
$$;

create or replace function public.archive_vendor_workspace_update(
  target_update_id uuid,
  archived_input boolean default true
)
returns public.workspace_vendor_updates
language plpgsql
security definer
set search_path = public
as $$
declare
  target_update public.workspace_vendor_updates%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  select *
  into target_update
  from public.workspace_vendor_updates
  where id = target_update_id;

  if not found then
    raise exception 'Vendor update not found'
      using errcode = 'P0002';
  end if;

  if not public.can_manage_wedding_memberships(target_update.wedding_id) then
    raise exception 'You do not have access to archive this vendor update'
      using errcode = '42501';
  end if;

  update public.workspace_vendor_updates
  set
    is_archived = archived_input,
    archived_at = case when archived_input then now() else null end,
    archived_by_user_id = case when archived_input then auth.uid() else null end
  where id = target_update.id
  returning * into target_update;

  return target_update;
end;
$$;

revoke execute on function public.create_vendor_workspace_update(uuid, text, text) from public, anon;
grant execute on function public.create_vendor_workspace_update(uuid, text, text) to authenticated;

revoke execute on function public.archive_vendor_workspace_update(uuid, boolean) from public, anon;
grant execute on function public.archive_vendor_workspace_update(uuid, boolean) to authenticated;
