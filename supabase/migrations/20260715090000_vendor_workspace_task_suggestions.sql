create table if not exists public.workspace_vendor_task_suggestions (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  description text null check (description is null or char_length(description) <= 2000),
  suggested_due_date date null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'dismissed')),
  accepted_task_id uuid null references public.tasks(id) on delete set null,
  resolved_by_user_id uuid null references auth.users(id) on delete set null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_vendor_task_suggestions_vendor_idx
  on public.workspace_vendor_task_suggestions (vendor_id, created_at desc);

create index if not exists workspace_vendor_task_suggestions_wedding_idx
  on public.workspace_vendor_task_suggestions (wedding_id, status, created_at desc);

create unique index if not exists workspace_vendor_task_suggestions_pending_title_idx
  on public.workspace_vendor_task_suggestions (vendor_id, lower(title))
  where status = 'pending';

drop trigger if exists update_workspace_vendor_task_suggestions_updated_at
  on public.workspace_vendor_task_suggestions;
create trigger update_workspace_vendor_task_suggestions_updated_at
before update on public.workspace_vendor_task_suggestions
for each row execute function public.update_updated_at_column();

alter table public.workspace_vendor_task_suggestions enable row level security;

revoke all on public.workspace_vendor_task_suggestions from public, anon;
grant select on public.workspace_vendor_task_suggestions to authenticated;

drop policy if exists "Workspace participants can view vendor task suggestions"
  on public.workspace_vendor_task_suggestions;
create policy "Workspace participants can view vendor task suggestions"
on public.workspace_vendor_task_suggestions
for select
to authenticated
using (
  public.can_manage_wedding_memberships(wedding_id)
  or public.is_wedding_member(wedding_id)
  or exists (
    select 1
    from public.workspace_vendor_invites wvi
    where wvi.vendor_id = workspace_vendor_task_suggestions.vendor_id
      and wvi.invited_vendor_user_id = (select auth.uid())
      and wvi.invite_status = 'accepted'
  )
  or exists (
    select 1
    from public.vendors v
    join public.vendor_listings vl on vl.id = v.vendor_listing_id
    where v.id = workspace_vendor_task_suggestions.vendor_id
      and vl.user_id = (select auth.uid())
      and public.vendor_listing_has_full_access(vl.id)
  )
);

create or replace function public.create_vendor_workspace_task_suggestion(
  target_vendor_id uuid,
  title_input text,
  description_input text default null,
  suggested_due_date_input date default null
)
returns public.workspace_vendor_task_suggestions
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_vendor public.vendors%rowtype;
  target_wedding_id uuid;
  can_suggest boolean := false;
  created_row public.workspace_vendor_task_suggestions%rowtype;
  normalized_title text := nullif(btrim(title_input), '');
begin
  if auth.uid() is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  if normalized_title is null or char_length(normalized_title) not between 3 and 160 then
    raise exception 'Suggestion title must be between 3 and 160 characters'
      using errcode = '22023';
  end if;

  if description_input is not null and char_length(description_input) > 2000 then
    raise exception 'Suggestion description is too long' using errcode = '22023';
  end if;

  select * into target_vendor
  from public.vendors
  where id = target_vendor_id;

  if not found then
    raise exception 'Vendor row not found' using errcode = 'P0002';
  end if;

  target_wedding_id := public.resolve_vendor_workspace_wedding_id(target_vendor.id);
  if target_wedding_id is null then
    raise exception 'Vendor is not attached to a wedding workspace' using errcode = 'P0001';
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
  into can_suggest;

  if not can_suggest then
    raise exception 'You do not have access to suggest tasks for this vendor workspace'
      using errcode = '42501';
  end if;

  insert into public.workspace_vendor_task_suggestions (
    wedding_id,
    vendor_id,
    created_by_user_id,
    title,
    description,
    suggested_due_date
  ) values (
    target_wedding_id,
    target_vendor.id,
    auth.uid(),
    normalized_title,
    nullif(btrim(description_input), ''),
    suggested_due_date_input
  )
  returning * into created_row;

  return created_row;
end;
$$;

create or replace function public.accept_vendor_workspace_task_suggestion(
  target_suggestion_id uuid
)
returns public.workspace_vendor_task_suggestions
language plpgsql
security definer
set search_path = ''
as $$
declare
  suggestion_row public.workspace_vendor_task_suggestions%rowtype;
  target_vendor public.vendors%rowtype;
  wedding_owner_id uuid;
  created_task_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  select * into suggestion_row
  from public.workspace_vendor_task_suggestions
  where id = target_suggestion_id
  for update;

  if not found then
    raise exception 'Task suggestion not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_wedding_memberships(suggestion_row.wedding_id) then
    raise exception 'You do not have access to accept this task suggestion'
      using errcode = '42501';
  end if;

  if suggestion_row.status <> 'pending' then
    raise exception 'Task suggestion has already been resolved' using errcode = 'P0001';
  end if;

  select * into target_vendor
  from public.vendors
  where id = suggestion_row.vendor_id;

  select coalesce(
    (
      select wm.user_id
      from public.wedding_memberships wm
      where wm.wedding_id = suggestion_row.wedding_id
        and wm.is_owner = true
        and wm.membership_status = 'active'
        and wm.user_id is not null
      order by wm.created_at asc
      limit 1
    ),
    w.created_by_user_id
  ) into wedding_owner_id
  from public.weddings w
  where w.id = suggestion_row.wedding_id;

  insert into public.tasks (
    user_id,
    wedding_id,
    client_id,
    title,
    description,
    due_date,
    category,
    source_vendor_id,
    visibility,
    delegatable,
    recommended_role,
    priority_level,
    template_source
  ) values (
    wedding_owner_id,
    suggestion_row.wedding_id,
    target_vendor.client_id,
    suggestion_row.title,
    suggestion_row.description,
    suggestion_row.suggested_due_date,
    target_vendor.category,
    suggestion_row.vendor_id,
    'public',
    true,
    'couple',
    2,
    'vendor_suggestion'
  ) returning id into created_task_id;

  update public.workspace_vendor_task_suggestions
  set status = 'accepted',
      accepted_task_id = created_task_id,
      resolved_by_user_id = auth.uid(),
      resolved_at = now()
  where id = suggestion_row.id
  returning * into suggestion_row;

  return suggestion_row;
end;
$$;

create or replace function public.dismiss_vendor_workspace_task_suggestion(
  target_suggestion_id uuid
)
returns public.workspace_vendor_task_suggestions
language plpgsql
security definer
set search_path = ''
as $$
declare
  suggestion_row public.workspace_vendor_task_suggestions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  select * into suggestion_row
  from public.workspace_vendor_task_suggestions
  where id = target_suggestion_id
  for update;

  if not found then
    raise exception 'Task suggestion not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_wedding_memberships(suggestion_row.wedding_id) then
    raise exception 'You do not have access to dismiss this task suggestion'
      using errcode = '42501';
  end if;

  if suggestion_row.status <> 'pending' then
    raise exception 'Task suggestion has already been resolved' using errcode = 'P0001';
  end if;

  update public.workspace_vendor_task_suggestions
  set status = 'dismissed',
      resolved_by_user_id = auth.uid(),
      resolved_at = now()
  where id = suggestion_row.id
  returning * into suggestion_row;

  return suggestion_row;
end;
$$;

revoke execute on function public.create_vendor_workspace_task_suggestion(uuid, text, text, date) from public, anon;
revoke execute on function public.accept_vendor_workspace_task_suggestion(uuid) from public, anon;
revoke execute on function public.dismiss_vendor_workspace_task_suggestion(uuid) from public, anon;

grant execute on function public.create_vendor_workspace_task_suggestion(uuid, text, text, date) to authenticated;
grant execute on function public.accept_vendor_workspace_task_suggestion(uuid) to authenticated;
grant execute on function public.dismiss_vendor_workspace_task_suggestion(uuid) to authenticated;
