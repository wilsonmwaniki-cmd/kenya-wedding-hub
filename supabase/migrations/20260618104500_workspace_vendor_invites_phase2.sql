create or replace function public.resolve_vendor_workspace_wedding_id(target_vendor_id uuid)
returns uuid
language sql
stable
set search_path = public
as $$
  with target_vendor as (
    select v.id, v.wedding_id, v.client_id, v.user_id
    from public.vendors v
    where v.id = target_vendor_id
  ),
  planner_client_match as (
    select pc.wedding_id
    from target_vendor tv
    join public.planner_clients pc on pc.id = tv.client_id
    where pc.wedding_id is not null
    limit 1
  ),
  owner_membership_match as (
    select wm.wedding_id
    from target_vendor tv
    join public.wedding_memberships wm on wm.user_id = tv.user_id
    where wm.is_owner = true
      and wm.membership_status = 'active'
      and wm.role in ('bride', 'groom')
    order by wm.created_at asc
    limit 1
  )
  select coalesce(
    (select tv.wedding_id from target_vendor tv),
    (select pcm.wedding_id from planner_client_match pcm),
    (select omm.wedding_id from owner_membership_match omm)
  );
$$;

update public.vendors v
set wedding_id = public.resolve_vendor_workspace_wedding_id(v.id)
where v.wedding_id is null
  and public.resolve_vendor_workspace_wedding_id(v.id) is not null;

create table if not exists public.workspace_vendor_invites (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  invited_by_user_id uuid null references auth.users(id) on delete set null,
  invite_contact_email text null,
  invite_contact_phone text null,
  invite_message text null,
  invite_token uuid not null default gen_random_uuid(),
  invite_status text not null default 'draft'
    check (invite_status in ('draft', 'pending', 'sent', 'opened', 'accepted', 'declined', 'expired', 'revoked')),
  invite_sent_at timestamptz null,
  invite_opened_at timestamptz null,
  invite_expires_at timestamptz null,
  invited_vendor_user_id uuid null references auth.users(id) on delete set null,
  claimed_vendor_listing_id uuid null references public.vendor_listings(id) on delete set null,
  public_profile_opt_in boolean not null default false,
  accepted_at timestamptz null,
  declined_at timestamptz null,
  revoked_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    coalesce(nullif(btrim(invite_contact_email), ''), nullif(btrim(invite_contact_phone), '')) is not null
  )
);

create unique index if not exists workspace_vendor_invites_invite_token_key
  on public.workspace_vendor_invites (invite_token);

create index if not exists workspace_vendor_invites_wedding_id_idx
  on public.workspace_vendor_invites (wedding_id, created_at desc);

create index if not exists workspace_vendor_invites_vendor_id_idx
  on public.workspace_vendor_invites (vendor_id, created_at desc);

create index if not exists workspace_vendor_invites_status_idx
  on public.workspace_vendor_invites (invite_status, invite_expires_at asc);

create index if not exists workspace_vendor_invites_contact_email_idx
  on public.workspace_vendor_invites (lower(invite_contact_email))
  where invite_contact_email is not null;

create unique index if not exists workspace_vendor_invites_one_active_invite_per_vendor
  on public.workspace_vendor_invites (vendor_id)
  where invite_status in ('draft', 'pending', 'sent', 'opened');

create or replace function public.validate_workspace_vendor_invite()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  resolved_wedding_id uuid;
begin
  if new.invite_contact_email is not null then
    new.invite_contact_email := lower(nullif(btrim(new.invite_contact_email), ''));
  end if;

  if new.invite_contact_phone is not null then
    new.invite_contact_phone := nullif(btrim(new.invite_contact_phone), '');
  end if;

  if new.invited_by_user_id is null and auth.uid() is not null then
    new.invited_by_user_id := auth.uid();
  end if;

  resolved_wedding_id := public.resolve_vendor_workspace_wedding_id(new.vendor_id);

  if resolved_wedding_id is null then
    raise exception 'Vendor must belong to a wedding workspace before invite records can be created'
      using errcode = 'P0001';
  end if;

  if new.wedding_id <> resolved_wedding_id then
    raise exception 'Vendor invite wedding does not match the vendor workspace'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_workspace_vendor_invite on public.workspace_vendor_invites;
create trigger validate_workspace_vendor_invite
before insert or update on public.workspace_vendor_invites
for each row execute function public.validate_workspace_vendor_invite();

drop trigger if exists update_workspace_vendor_invites_updated_at on public.workspace_vendor_invites;
create trigger update_workspace_vendor_invites_updated_at
before update on public.workspace_vendor_invites
for each row execute function public.update_updated_at_column();

alter table public.workspace_vendor_invites enable row level security;

grant select, insert, update, delete on public.workspace_vendor_invites to authenticated;

drop policy if exists "Wedding managers can view workspace vendor invites" on public.workspace_vendor_invites;
create policy "Wedding managers can view workspace vendor invites"
on public.workspace_vendor_invites for select
to authenticated
using (
  public.can_manage_wedding_memberships(wedding_id)
  or public.is_wedding_member(wedding_id)
  or lower(coalesce(invite_contact_email, '')) = public.current_user_email()
  or auth.uid() = invited_vendor_user_id
);

drop policy if exists "Wedding managers can create workspace vendor invites" on public.workspace_vendor_invites;
create policy "Wedding managers can create workspace vendor invites"
on public.workspace_vendor_invites for insert
to authenticated
with check (
  public.can_manage_wedding_memberships(wedding_id)
  and coalesce(invited_by_user_id, auth.uid()) = auth.uid()
);

drop policy if exists "Wedding managers can update workspace vendor invites" on public.workspace_vendor_invites;
create policy "Wedding managers can update workspace vendor invites"
on public.workspace_vendor_invites for update
to authenticated
using (public.can_manage_wedding_memberships(wedding_id))
with check (public.can_manage_wedding_memberships(wedding_id));

drop policy if exists "Wedding managers can delete workspace vendor invites" on public.workspace_vendor_invites;
create policy "Wedding managers can delete workspace vendor invites"
on public.workspace_vendor_invites for delete
to authenticated
using (public.can_manage_wedding_memberships(wedding_id));

create or replace function public.get_workspace_vendor_invite_claim(
  invite_token uuid
)
returns table (
  invite_id uuid,
  wedding_id uuid,
  wedding_name text,
  wedding_date date,
  vendor_id uuid,
  vendor_name text,
  vendor_category text,
  invite_contact_email text,
  invite_contact_phone text,
  invite_expires_at timestamptz,
  invite_status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    wvi.id,
    wvi.wedding_id,
    w.name::text,
    w.wedding_date,
    wvi.vendor_id,
    v.name::text,
    v.category::text,
    wvi.invite_contact_email::text,
    wvi.invite_contact_phone::text,
    wvi.invite_expires_at,
    case
      when wvi.invite_status in ('accepted', 'declined', 'revoked') then wvi.invite_status
      when wvi.invite_expires_at is not null and wvi.invite_expires_at < now() then 'expired'
      else wvi.invite_status
    end::text as invite_status
  from public.workspace_vendor_invites wvi
  join public.vendors v on v.id = wvi.vendor_id
  join public.weddings w on w.id = wvi.wedding_id
  where wvi.invite_token = get_workspace_vendor_invite_claim.invite_token;
end;
$$;

create or replace function public.claim_workspace_vendor_invite(
  invite_token uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invite public.workspace_vendor_invites%rowtype;
  active_user_id uuid := auth.uid();
  active_email text;
  has_vendor_role boolean := false;
begin
  if active_user_id is null then
    raise exception 'Sign in first to accept this vendor invite'
      using errcode = 'P0001';
  end if;

  select lower(u.email::text)
  into active_email
  from auth.users u
  where u.id = active_user_id;

  select exists(
    select 1
    from public.user_roles ur
    where ur.user_id = active_user_id
      and ur.role = 'vendor'::public.app_role
  ) or exists(
    select 1
    from public.profiles p
    where p.user_id = active_user_id
      and p.role = 'vendor'::public.app_role
  )
  into has_vendor_role;

  if not has_vendor_role then
    raise exception 'Finish setting up your vendor account before accepting this invite'
      using errcode = 'P0001';
  end if;

  select *
  into target_invite
  from public.workspace_vendor_invites wvi
  where wvi.invite_token = claim_workspace_vendor_invite.invite_token;

  if not found then
    raise exception 'This vendor invite link is invalid'
      using errcode = 'P0002';
  end if;

  if target_invite.invite_expires_at is not null and target_invite.invite_expires_at < now() then
    raise exception 'This vendor invite link has expired'
      using errcode = 'P0001';
  end if;

  if target_invite.invite_status in ('accepted', 'declined', 'revoked') then
    if target_invite.invited_vendor_user_id = active_user_id then
      return target_invite.id;
    end if;

    raise exception 'This vendor invite is no longer available'
      using errcode = 'P0001';
  end if;

  if coalesce(active_email, '') = '' or (
    target_invite.invite_contact_email is not null
    and lower(target_invite.invite_contact_email) <> active_email
  ) then
    raise exception 'Sign in with the invited email address to accept this vendor invite'
      using errcode = 'P0001';
  end if;

  update public.workspace_vendor_invites
  set
    invite_status = 'accepted',
    invited_vendor_user_id = active_user_id,
    accepted_at = coalesce(accepted_at, now()),
    invite_opened_at = coalesce(invite_opened_at, now()),
    updated_at = now()
  where id = target_invite.id;

  return target_invite.id;
end;
$$;

revoke execute on function public.get_workspace_vendor_invite_claim(uuid) from public;
grant execute on function public.get_workspace_vendor_invite_claim(uuid) to anon, authenticated;

revoke execute on function public.claim_workspace_vendor_invite(uuid) from public, anon;
grant execute on function public.claim_workspace_vendor_invite(uuid) to authenticated;

create or replace function public.update_vendor_workspace_record(
  target_vendor_id uuid,
  status_input text default null,
  contract_amount_input numeric default null,
  amount_paid_input numeric default null,
  payment_status_input text default null,
  payment_due_date_input date default null,
  internal_notes_input text default null
)
returns public.vendors
language plpgsql
security definer
set search_path = public
as $$
declare
  target_vendor public.vendors%rowtype;
  can_manage boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  select *
  into target_vendor
  from public.vendors
  where id = target_vendor_id;

  if not found then
    raise exception 'Vendor row not found'
      using errcode = 'P0002';
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
    raise exception 'You do not have access to update this vendor workspace record'
      using errcode = '42501';
  end if;

  if status_input is not null
     and status_input not in ('considering', 'contacted', 'quoted', 'booked', 'completed', 'rejected') then
    raise exception 'Invalid vendor status'
      using errcode = '22023';
  end if;

  if payment_status_input is not null
     and payment_status_input not in ('unpaid', 'deposit_due', 'deposit_paid', 'part_paid', 'paid_full') then
    raise exception 'Invalid payment status'
      using errcode = '22023';
  end if;

  if contract_amount_input is not null and contract_amount_input < 0 then
    raise exception 'Contract amount must be zero or greater'
      using errcode = '22023';
  end if;

  if amount_paid_input is not null and amount_paid_input < 0 then
    raise exception 'Amount paid must be zero or greater'
      using errcode = '22023';
  end if;

  update public.vendors
  set
    status = coalesce(status_input, status),
    price = coalesce(contract_amount_input, price),
    amount_paid = coalesce(amount_paid_input, amount_paid),
    payment_status = coalesce(payment_status_input, payment_status),
    payment_due_date = coalesce(payment_due_date_input, payment_due_date),
    vendor_internal_notes = case
      when internal_notes_input is null then vendor_internal_notes
      else nullif(btrim(internal_notes_input), '')
    end,
    selection_status = case
      when status_input = 'rejected' then 'declined'
      else selection_status
    end,
    last_payment_at = case
      when amount_paid_input is not null and amount_paid_input > coalesce(target_vendor.amount_paid, 0) then now()
      else last_payment_at
    end
  where id = target_vendor.id
  returning * into target_vendor;

  return target_vendor;
end;
$$;

revoke execute on function public.update_vendor_workspace_record(uuid, text, numeric, numeric, text, date, text) from public, anon;
grant execute on function public.update_vendor_workspace_record(uuid, text, numeric, numeric, text, date, text) to authenticated;

create or replace function public.update_vendor_workspace_task(
  target_task_id uuid,
  completed_input boolean default null
)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  target_task public.tasks%rowtype;
  can_manage boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  select *
  into target_task
  from public.tasks
  where id = target_task_id;

  if not found then
    raise exception 'Task not found'
      using errcode = 'P0002';
  end if;

  if target_task.source_vendor_id is null then
    raise exception 'This task is not linked to a vendor workspace record'
      using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from public.workspace_vendor_invites wvi
    where wvi.vendor_id = target_task.source_vendor_id
      and wvi.invited_vendor_user_id = auth.uid()
      and wvi.invite_status = 'accepted'
  ) or exists (
    select 1
    from public.vendors v
    join public.vendor_listings vl on vl.id = v.vendor_listing_id
    where v.id = target_task.source_vendor_id
      and vl.user_id = auth.uid()
      and public.vendor_listing_has_full_access(vl.id)
  ) or public.has_role(auth.uid(), 'admin'::public.app_role)
  into can_manage;

  if not can_manage then
    raise exception 'You do not have access to update this task'
      using errcode = '42501';
  end if;

  update public.tasks
  set completed = coalesce(completed_input, completed)
  where id = target_task.id
  returning * into target_task;

  return target_task;
end;
$$;

revoke execute on function public.update_vendor_workspace_task(uuid, boolean) from public, anon;
grant execute on function public.update_vendor_workspace_task(uuid, boolean) to authenticated;

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
