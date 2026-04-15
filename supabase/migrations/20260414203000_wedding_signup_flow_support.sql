-- Wedding signup flow support
-- Adds code-based join helpers and partner invite management on top of the
-- initial wedding workspace RPCs.

create unique index if not exists wedding_invites_unique_pending_membership_idx
  on public.wedding_invites (membership_id)
  where membership_id is not null and status = 'pending';

create unique index if not exists wedding_invites_unique_pending_email_type_idx
  on public.wedding_invites (wedding_id, lower(email), invite_type)
  where status = 'pending';

create or replace function public.upsert_partner_invite(
  target_wedding_id uuid,
  partner_email_input text
)
returns table (
  wedding_id uuid,
  membership_id uuid,
  invite_id uuid,
  proposed_role text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_partner_email text;
  owner_membership public.wedding_memberships%rowtype;
  target_membership public.wedding_memberships%rowtype;
  created_invite public.wedding_invites%rowtype;
  resolved_partner_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not public.can_manage_wedding_memberships(target_wedding_id) then
    raise exception 'You do not have permission to manage invitations for this wedding'
      using errcode = '42501';
  end if;

  normalized_partner_email := nullif(lower(trim(coalesce(partner_email_input, ''))), '');
  if normalized_partner_email is null then
    raise exception 'Partner email is required'
      using errcode = '22023';
  end if;

  select *
  into owner_membership
  from public.wedding_memberships wm
  where wm.wedding_id = target_wedding_id
    and wm.is_owner = true
    and wm.membership_status = 'active'
    and (
      wm.user_id = auth.uid()
      or lower(wm.email) = public.current_user_email()
    )
  order by wm.created_at asc
  limit 1;

  if owner_membership.id is null then
    raise exception 'Only an active wedding owner can invite a partner'
      using errcode = '42501';
  end if;

  if normalized_partner_email = lower(owner_membership.email) then
    raise exception 'Partner email cannot match the current owner email'
      using errcode = '22023';
  end if;

  resolved_partner_role := case
    when owner_membership.role = 'bride' then 'groom'
    else 'bride'
  end;

  select *
  into target_membership
  from public.wedding_memberships wm
  where wm.wedding_id = target_wedding_id
    and wm.is_owner = true
    and lower(wm.email) = normalized_partner_email
  order by wm.created_at desc
  limit 1;

  if target_membership.id is null then
    insert into public.wedding_memberships (
      wedding_id,
      email,
      role,
      membership_status,
      is_owner,
      invited_by_user_id
    )
    values (
      target_wedding_id,
      normalized_partner_email,
      resolved_partner_role,
      'invited',
      true,
      auth.uid()
    )
    returning *
    into target_membership;
  else
    update public.wedding_memberships
    set role = resolved_partner_role,
        membership_status = 'invited',
        is_owner = true,
        invited_by_user_id = auth.uid(),
        accepted_at = null,
        revoked_at = null,
        updated_at = now()
    where id = target_membership.id
    returning *
    into target_membership;
  end if;

  update public.wedding_invites
  set status = 'revoked',
      updated_at = now()
  where wedding_id = target_wedding_id
    and lower(email) = normalized_partner_email
    and invite_type = 'partner'
    and status = 'pending';

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
  values (
    target_wedding_id,
    target_membership.id,
    normalized_partner_email,
    'partner',
    resolved_partner_role,
    'pending',
    now(),
    now() + interval '30 days',
    auth.uid()
  )
  returning *
  into created_invite;

  wedding_id := target_wedding_id;
  membership_id := target_membership.id;
  invite_id := created_invite.id;
  proposed_role := created_invite.proposed_role;
  expires_at := created_invite.expires_at;
  return next;
end;
$$;

create or replace function public.preview_join_wedding_by_code(
  wedding_code_input text
)
returns table (
  wedding_id uuid,
  wedding_name text,
  wedding_code text,
  wedding_date date,
  location_county text,
  location_town text,
  invite_id uuid,
  invite_type text,
  proposed_role text,
  membership_status text,
  expires_at timestamptz,
  invited_by_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_wedding_code text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  normalized_wedding_code := upper(trim(coalesce(wedding_code_input, '')));
  if normalized_wedding_code = '' then
    raise exception 'Wedding code is required'
      using errcode = '22023';
  end if;

  return query
  select
    w.id,
    w.name,
    w.wedding_code,
    w.wedding_date,
    w.location_county,
    w.location_town,
    wi.id,
    wi.invite_type,
    wi.proposed_role,
    wm.membership_status,
    wi.expires_at,
    coalesce(inviter_profile.full_name, inviter_user.email::text, 'Wedding owner') as invited_by_name
  from public.wedding_invites wi
  join public.weddings w
    on w.id = wi.wedding_id
  left join public.wedding_memberships wm
    on wm.id = wi.membership_id
  left join auth.users inviter_user
    on inviter_user.id = wi.created_by_user_id
  left join public.profiles inviter_profile
    on inviter_profile.user_id = wi.created_by_user_id
  where upper(w.wedding_code) = normalized_wedding_code
    and lower(wi.email) = public.current_user_email()
    and wi.status = 'pending'
  order by wi.created_at desc
  limit 1;

  if not found then
    raise exception 'No pending invite found for this wedding code and signed-in email'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.join_wedding_by_code(
  wedding_code_input text
)
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
  normalized_wedding_code text;
  target_invite public.wedding_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  normalized_wedding_code := upper(trim(coalesce(wedding_code_input, '')));
  if normalized_wedding_code = '' then
    raise exception 'Wedding code is required'
      using errcode = '22023';
  end if;

  select wi.*
  into target_invite
  from public.wedding_invites wi
  join public.weddings w
    on w.id = wi.wedding_id
  where upper(w.wedding_code) = normalized_wedding_code
    and lower(wi.email) = public.current_user_email()
    and wi.status = 'pending'
  order by wi.created_at desc
  limit 1;

  if target_invite.id is null then
    raise exception 'No pending invite found for this wedding code and signed-in email'
      using errcode = '22023';
  end if;

  return query
  select *
  from public.accept_wedding_invite(target_invite.invite_token);
end;
$$;

create or replace function public.list_my_pending_wedding_invites()
returns table (
  invite_id uuid,
  wedding_id uuid,
  wedding_name text,
  wedding_code text,
  invite_type text,
  proposed_role text,
  expires_at timestamptz,
  invited_by_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    wi.id,
    wi.wedding_id,
    w.name,
    w.wedding_code,
    wi.invite_type,
    wi.proposed_role,
    wi.expires_at,
    coalesce(inviter_profile.full_name, inviter_user.email::text, 'Wedding owner') as invited_by_name
  from public.wedding_invites wi
  join public.weddings w
    on w.id = wi.wedding_id
  left join auth.users inviter_user
    on inviter_user.id = wi.created_by_user_id
  left join public.profiles inviter_profile
    on inviter_profile.user_id = wi.created_by_user_id
  where lower(wi.email) = public.current_user_email()
    and wi.status = 'pending'
  order by wi.created_at desc;
$$;

revoke execute on function public.upsert_partner_invite(uuid, text) from public;
grant execute on function public.upsert_partner_invite(uuid, text) to authenticated;

revoke execute on function public.preview_join_wedding_by_code(text) from public;
grant execute on function public.preview_join_wedding_by_code(text) to authenticated;

revoke execute on function public.join_wedding_by_code(text) from public;
grant execute on function public.join_wedding_by_code(text) to authenticated;

revoke execute on function public.list_my_pending_wedding_invites() from public;
grant execute on function public.list_my_pending_wedding_invites() to authenticated;
