-- Committee invite support on top of the wedding ownership model.

create or replace function public.upsert_committee_invite(
  target_wedding_id uuid,
  committee_email_input text,
  committee_role_input text default 'committee_member'
)
returns table (
  wedding_id uuid,
  membership_id uuid,
  invite_id uuid,
  proposed_role text,
  expires_at timestamptz,
  seats_remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_committee_email text;
  normalized_role text;
  target_membership public.wedding_memberships%rowtype;
  created_invite public.wedding_invites%rowtype;
  remaining_seats integer;
  seat_consumed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not public.can_manage_wedding_memberships(target_wedding_id) then
    raise exception 'You do not have permission to manage committee invites for this wedding'
      using errcode = '42501';
  end if;

  if not public.wedding_has_feature(target_wedding_id, 'committee_collaboration') then
    raise exception 'This wedding does not currently have committee collaboration enabled'
      using errcode = '42501';
  end if;

  normalized_committee_email := nullif(lower(trim(coalesce(committee_email_input, ''))), '');
  if normalized_committee_email is null then
    raise exception 'Committee email is required'
      using errcode = '22023';
  end if;

  normalized_role := lower(trim(coalesce(committee_role_input, 'committee_member')));
  if normalized_role not in ('committee_member', 'committee_chair') then
    raise exception 'Committee role must be committee_member or committee_chair'
      using errcode = '22023';
  end if;

  select *
  into target_membership
  from public.wedding_memberships wm
  where wm.wedding_id = target_wedding_id
    and wm.role in ('committee_member', 'committee_chair')
    and lower(wm.email) = normalized_committee_email
  order by wm.created_at desc
  limit 1;

  if target_membership.id is null then
    remaining_seats := public.available_committee_seats(target_wedding_id);
    if remaining_seats <= 0 then
      raise exception 'No committee bundle seats are available for this wedding'
        using errcode = '22023';
    end if;

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
      normalized_committee_email,
      normalized_role,
      'invited',
      false,
      auth.uid()
    )
    returning *
    into target_membership;

    seat_consumed := true;
  else
    update public.wedding_memberships
    set role = normalized_role,
        membership_status = case
          when membership_status = 'active' then membership_status
          else 'invited'
        end,
        invited_by_user_id = auth.uid(),
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
    and lower(email) = normalized_committee_email
    and invite_type = 'committee'
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
    normalized_committee_email,
    'committee',
    normalized_role,
    'pending',
    now(),
    now() + interval '21 days',
    auth.uid()
  )
  returning *
  into created_invite;

  remaining_seats := public.available_committee_seats(target_wedding_id);

  wedding_id := target_wedding_id;
  membership_id := target_membership.id;
  invite_id := created_invite.id;
  proposed_role := created_invite.proposed_role;
  expires_at := created_invite.expires_at;
  seats_remaining := remaining_seats;
  return next;
end;
$$;
