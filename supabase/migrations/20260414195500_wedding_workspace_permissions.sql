-- Wedding workspace helper functions, RLS, and initial RPC scaffolding

create or replace function public.generate_wedding_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  generated_code text;
begin
  generated_code := 'ZN-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
  return generated_code;
end;
$$;

create or replace function public.current_user_email()
returns text
language sql
stable
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.is_wedding_member(target_wedding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.wedding_memberships wm
    where wm.wedding_id = target_wedding_id
      and wm.membership_status = 'active'
      and (
        wm.user_id = auth.uid()
        or lower(wm.email) = public.current_user_email()
      )
  );
$$;

create or replace function public.is_wedding_owner(target_wedding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.wedding_memberships wm
    where wm.wedding_id = target_wedding_id
      and wm.membership_status = 'active'
      and wm.is_owner = true
      and (
        wm.user_id = auth.uid()
        or lower(wm.email) = public.current_user_email()
      )
  );
$$;

create or replace function public.can_manage_wedding(target_wedding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when public.has_role(auth.uid(), 'admin'::public.app_role) then true
    else public.is_wedding_owner(target_wedding_id)
  end;
$$;

create or replace function public.can_manage_wedding_memberships(target_wedding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when public.has_role(auth.uid(), 'admin'::public.app_role) then true
    else exists (
      select 1
      from public.wedding_memberships wm
      where wm.wedding_id = target_wedding_id
        and wm.membership_status = 'active'
        and (
          wm.is_owner = true
          or wm.role = 'committee_chair'
        )
        and (
          wm.user_id = auth.uid()
          or lower(wm.email) = public.current_user_email()
        )
    )
  end;
$$;

create or replace function public.wedding_has_feature(
  target_wedding_id uuid,
  target_feature_key text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.wedding_entitlements we
    where we.wedding_id = target_wedding_id
      and we.feature_key = target_feature_key
      and we.status = 'active'
      and we.effective_from <= now()
      and (we.effective_to is null or we.effective_to > now())
  );
$$;

create or replace function public.available_committee_seats(target_wedding_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with active_bundle as (
    select max(wsb.seat_limit) as seat_limit
    from public.wedding_subscription_bundles wsb
    where wsb.wedding_id = target_wedding_id
      and wsb.bundle_type = 'committee_bundle'
      and wsb.status in ('active', 'grace')
      and (wsb.expires_at is null or wsb.expires_at > now())
  ),
  active_committee as (
    select count(*)::integer as seats_used
    from public.wedding_memberships wm
    where wm.wedding_id = target_wedding_id
      and wm.role in ('committee_chair', 'committee_member')
      and wm.membership_status in ('invited', 'active')
  )
  select case
    when ab.seat_limit is null then 0
    else greatest(ab.seat_limit - ac.seats_used, 0)
  end
  from active_bundle ab
  cross join active_committee ac;
$$;

alter table public.weddings enable row level security;
alter table public.wedding_memberships enable row level security;
alter table public.wedding_invites enable row level security;
alter table public.wedding_subscription_bundles enable row level security;
alter table public.wedding_entitlements enable row level security;
alter table public.wedding_assignment_roles enable row level security;

drop policy if exists "Wedding members can view weddings" on public.weddings;
create policy "Wedding members can view weddings"
on public.weddings for select
using (public.is_wedding_member(id) or public.can_manage_wedding(id));

drop policy if exists "Authenticated users can create weddings" on public.weddings;
create policy "Authenticated users can create weddings"
on public.weddings for insert
to authenticated
with check (auth.uid() = created_by_user_id);

drop policy if exists "Wedding owners can update weddings" on public.weddings;
create policy "Wedding owners can update weddings"
on public.weddings for update
using (public.can_manage_wedding(id))
with check (public.can_manage_wedding(id));

drop policy if exists "Wedding owners can delete weddings" on public.weddings;
create policy "Wedding owners can delete weddings"
on public.weddings for delete
using (public.can_manage_wedding(id));

drop policy if exists "Participants can view wedding memberships" on public.wedding_memberships;
create policy "Participants can view wedding memberships"
on public.wedding_memberships for select
using (
  public.is_wedding_member(wedding_id)
  or public.can_manage_wedding_memberships(wedding_id)
  or lower(email) = public.current_user_email()
);

drop policy if exists "Owners can insert wedding memberships" on public.wedding_memberships;
create policy "Owners can insert wedding memberships"
on public.wedding_memberships for insert
to authenticated
with check (public.can_manage_wedding_memberships(wedding_id));

drop policy if exists "Owners can update wedding memberships" on public.wedding_memberships;
create policy "Owners can update wedding memberships"
on public.wedding_memberships for update
using (
  public.can_manage_wedding_memberships(wedding_id)
  or lower(email) = public.current_user_email()
)
with check (
  public.can_manage_wedding_memberships(wedding_id)
  or lower(email) = public.current_user_email()
);

drop policy if exists "Owners can delete wedding memberships" on public.wedding_memberships;
create policy "Owners can delete wedding memberships"
on public.wedding_memberships for delete
using (public.can_manage_wedding_memberships(wedding_id));

drop policy if exists "Invitees can view wedding invites" on public.wedding_invites;
create policy "Invitees can view wedding invites"
on public.wedding_invites for select
using (
  public.can_manage_wedding_memberships(wedding_id)
  or lower(email) = public.current_user_email()
);

drop policy if exists "Owners can manage wedding invites" on public.wedding_invites;
create policy "Owners can manage wedding invites"
on public.wedding_invites for all
to authenticated
using (public.can_manage_wedding_memberships(wedding_id))
with check (public.can_manage_wedding_memberships(wedding_id));

drop policy if exists "Owners can view wedding bundles" on public.wedding_subscription_bundles;
create policy "Owners can view wedding bundles"
on public.wedding_subscription_bundles for select
using (public.can_manage_wedding(wedding_id));

drop policy if exists "Owners can manage wedding bundles" on public.wedding_subscription_bundles;
create policy "Owners can manage wedding bundles"
on public.wedding_subscription_bundles for all
to authenticated
using (public.can_manage_wedding(wedding_id))
with check (public.can_manage_wedding(wedding_id));

drop policy if exists "Members can view wedding entitlements" on public.wedding_entitlements;
create policy "Members can view wedding entitlements"
on public.wedding_entitlements for select
using (public.is_wedding_member(wedding_id) or public.can_manage_wedding(wedding_id));

drop policy if exists "Owners can manage wedding entitlements" on public.wedding_entitlements;
create policy "Owners can manage wedding entitlements"
on public.wedding_entitlements for all
to authenticated
using (public.can_manage_wedding(wedding_id))
with check (public.can_manage_wedding(wedding_id));

drop policy if exists "Members can view wedding assignment roles" on public.wedding_assignment_roles;
create policy "Members can view wedding assignment roles"
on public.wedding_assignment_roles for select
using (public.is_wedding_member(wedding_id) or public.can_manage_wedding_memberships(wedding_id));

drop policy if exists "Managers can manage wedding assignment roles" on public.wedding_assignment_roles;
create policy "Managers can manage wedding assignment roles"
on public.wedding_assignment_roles for all
to authenticated
using (public.can_manage_wedding_memberships(wedding_id))
with check (public.can_manage_wedding_memberships(wedding_id));

create or replace function public.create_wedding_workspace(
  wedding_name text,
  creator_role text,
  partner_email_input text default null,
  wedding_date_input date default null,
  location_county_input text default null,
  location_town_input text default null
)
returns table (
  wedding_id uuid,
  wedding_code text,
  owner_membership_id uuid,
  partner_invite_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  created_wedding_id uuid;
  created_wedding_code text;
  created_owner_membership_id uuid;
  created_partner_invite_id uuid;
  normalized_role text;
  normalized_partner_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  normalized_role := lower(trim(coalesce(creator_role, '')));
  if normalized_role not in ('bride', 'groom') then
    raise exception 'Creator role must be bride or groom'
      using errcode = '22023';
  end if;

  normalized_partner_email := nullif(lower(trim(coalesce(partner_email_input, ''))), '');

  insert into public.weddings (
    name,
    wedding_code,
    wedding_date,
    location_county,
    location_town,
    status,
    created_by_user_id
  )
  values (
    trim(wedding_name),
    public.generate_wedding_code(),
    wedding_date_input,
    nullif(trim(coalesce(location_county_input, '')), ''),
    nullif(trim(coalesce(location_town_input, '')), ''),
    'active',
    auth.uid()
  )
  returning id, wedding_code
  into created_wedding_id, created_wedding_code;

  insert into public.wedding_memberships (
    wedding_id,
    user_id,
    email,
    role,
    membership_status,
    is_owner,
    invited_by_user_id,
    accepted_at
  )
  values (
    created_wedding_id,
    auth.uid(),
    public.current_user_email(),
    normalized_role,
    'active',
    true,
    auth.uid(),
    now()
  )
  returning id into created_owner_membership_id;

  if normalized_partner_email is not null then
    insert into public.wedding_memberships (
      wedding_id,
      email,
      role,
      membership_status,
      is_owner,
      invited_by_user_id
    )
    values (
      created_wedding_id,
      normalized_partner_email,
      case when normalized_role = 'bride' then 'groom' else 'bride' end,
      'invited',
      true,
      auth.uid()
    );

    insert into public.wedding_invites (
      wedding_id,
      membership_id,
      email,
      invite_type,
      proposed_role,
      status,
      sent_at,
      expires_at,
      created_by_user_id
    )
    select
      wm.wedding_id,
      wm.id,
      wm.email,
      'partner',
      wm.role,
      'pending',
      now(),
      now() + interval '30 days',
      auth.uid()
    from public.wedding_memberships wm
    where wm.wedding_id = created_wedding_id
      and wm.email = normalized_partner_email
      and wm.is_owner = true
    limit 1
    returning id into created_partner_invite_id;
  end if;

  wedding_id := created_wedding_id;
  wedding_code := created_wedding_code;
  owner_membership_id := created_owner_membership_id;
  partner_invite_id := created_partner_invite_id;
  return next;
end;
$$;

create or replace function public.accept_wedding_invite(invite_token_input uuid)
returns table (
  wedding_id uuid,
  membership_id uuid,
  resolved_role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invite public.wedding_invites%rowtype;
  target_membership public.wedding_memberships%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select *
  into target_invite
  from public.wedding_invites wi
  where wi.invite_token = invite_token_input
    and wi.status = 'pending'
  limit 1;

  if target_invite.id is null then
    raise exception 'Invite not found or no longer active'
      using errcode = '22023';
  end if;

  if lower(target_invite.email) <> public.current_user_email() then
    raise exception 'Invite email does not match signed-in account'
      using errcode = '42501';
  end if;

  if target_invite.expires_at is not null and target_invite.expires_at <= now() then
    update public.wedding_invites
    set status = 'expired',
        updated_at = now()
    where id = target_invite.id;

    raise exception 'Invite has expired'
      using errcode = '22023';
  end if;

  if target_invite.membership_id is null then
    raise exception 'Invite is missing target membership'
      using errcode = '22023';
  end if;

  update public.wedding_memberships
  set user_id = auth.uid(),
      membership_status = 'active',
      accepted_at = now(),
      updated_at = now()
  where id = target_invite.membership_id
  returning *
  into target_membership;

  update public.wedding_invites
  set status = 'accepted',
      accepted_at = now(),
      updated_at = now()
  where id = target_invite.id;

  wedding_id := target_membership.wedding_id;
  membership_id := target_membership.id;
  resolved_role := target_membership.role;
  return next;
end;
$$;

revoke execute on function public.create_wedding_workspace(text, text, text, date, text, text) from public;
grant execute on function public.create_wedding_workspace(text, text, text, date, text, text) to authenticated;

revoke execute on function public.accept_wedding_invite(uuid) from public;
grant execute on function public.accept_wedding_invite(uuid) to authenticated;
