create or replace function public.create_wedding_workspace(
  wedding_name text,
  creator_role text,
  partner_email_input text default null::text,
  wedding_date_input date default null::date,
  location_county_input text default null::text,
  location_town_input text default null::text
)
returns table (
  wedding_id uuid,
  wedding_code text,
  owner_membership_id uuid,
  partner_invite_id uuid
)
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  returning public.weddings.id, public.weddings.wedding_code
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
      null,
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
$function$;

create or replace function public.upsert_partner_invite(
  target_wedding_id uuid,
  partner_email_input text
)
returns table (
  wedding_id uuid,
  membership_id uuid,
  invite_id uuid,
  proposed_role text,
  expires_at timestamp with time zone
)
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    where public.wedding_memberships.id = target_membership.id
    returning *
    into target_membership;
  end if;

  update public.wedding_invites wi
  set status = 'revoked',
      updated_at = now()
  where wi.wedding_id = target_wedding_id
    and lower(wi.email) = normalized_partner_email
    and wi.invite_type = 'partner'
    and wi.status = 'pending';

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
    null,
    now() + interval '30 days',
    auth.uid()
  )
  returning *
  into created_invite;

  return query
  select
    target_wedding_id,
    target_membership.id,
    created_invite.id,
    created_invite.proposed_role,
    created_invite.expires_at;
end;
$function$;

update public.wedding_invites
set sent_at = null
where invite_type = 'partner'
  and status = 'pending';
