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
    now(),
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
$$;
