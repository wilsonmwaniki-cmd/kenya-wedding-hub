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
