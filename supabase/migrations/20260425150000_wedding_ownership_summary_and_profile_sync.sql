create or replace function public.get_my_wedding_ownership()
returns table (
  wedding_id uuid,
  wedding_name text,
  wedding_code text,
  wedding_date date,
  location_county text,
  location_town text,
  owner_role text,
  partner_email text,
  partner_role text,
  partner_status text,
  partner_invite_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_membership public.wedding_memberships%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select wm.*
  into owner_membership
  from public.wedding_memberships wm
  where wm.membership_status = 'active'
    and wm.is_owner = true
    and wm.role in ('bride', 'groom')
    and (
      wm.user_id = auth.uid()
      or lower(wm.email) = public.current_user_email()
    )
  order by wm.created_at asc
  limit 1;

  if owner_membership.id is null then
    return;
  end if;

  return query
  with partner_membership as (
    select wm.email, wm.role, wm.membership_status
    from public.wedding_memberships wm
    where wm.wedding_id = owner_membership.wedding_id
      and wm.is_owner = true
      and wm.id <> owner_membership.id
    order by wm.created_at asc
    limit 1
  ), pending_invite as (
    select wi.email, wi.proposed_role, wi.expires_at
    from public.wedding_invites wi
    where wi.wedding_id = owner_membership.wedding_id
      and wi.invite_type = 'partner'
      and wi.status = 'pending'
    order by wi.created_at desc
    limit 1
  )
  select
    w.id,
    w.name,
    w.wedding_code,
    w.wedding_date,
    w.location_county,
    w.location_town,
    owner_membership.role::text,
    coalesce(pm.email, pi.email),
    coalesce(pm.role, pi.proposed_role)::text,
    case
      when pm.membership_status = 'active' then 'active'
      when pi.email is not null or pm.membership_status = 'invited' then 'pending'
      else 'not_invited'
    end::text,
    pi.expires_at
  from public.weddings w
  left join partner_membership pm on true
  left join pending_invite pi on true
  where w.id = owner_membership.wedding_id;
end;
$$;

grant execute on function public.get_my_wedding_ownership() to authenticated;

with active_owned_weddings as (
  select distinct on (wm.user_id)
    wm.user_id,
    w.wedding_code,
    w.wedding_date,
    w.location_county,
    w.location_town
  from public.wedding_memberships wm
  join public.weddings w on w.id = wm.wedding_id
  where wm.user_id is not null
    and wm.is_owner = true
    and wm.membership_status = 'active'
    and wm.role in ('bride', 'groom')
  order by wm.user_id, wm.created_at asc
)
update public.profiles p
set
  collaboration_code = coalesce(p.collaboration_code, aow.wedding_code),
  wedding_date = coalesce(p.wedding_date, aow.wedding_date),
  wedding_county = coalesce(p.wedding_county, aow.location_county),
  wedding_town = coalesce(p.wedding_town, aow.location_town),
  wedding_location = coalesce(
    p.wedding_location,
    nullif(concat_ws(', ', aow.location_town, aow.location_county), '')
  ),
  updated_at = now()
from active_owned_weddings aow
where p.user_id = aow.user_id;
