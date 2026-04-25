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
  selected_wedding public.weddings%rowtype;
  resolved_owner_role text;
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

  if owner_membership.id is not null then
    select w.*
    into selected_wedding
    from public.weddings w
    where w.id = owner_membership.wedding_id
    limit 1;

    resolved_owner_role := owner_membership.role;
  else
    select w.*
    into selected_wedding
    from public.weddings w
    where w.created_by_user_id = auth.uid()
    order by w.created_at desc
    limit 1;

    if selected_wedding.id is null then
      return;
    end if;
  end if;

  return query
  with self_membership as (
    select wm.role
    from public.wedding_memberships wm
    where wm.wedding_id = selected_wedding.id
      and wm.role in ('bride', 'groom')
      and (
        wm.user_id = auth.uid()
        or lower(wm.email) = public.current_user_email()
      )
    order by case when wm.membership_status = 'active' then 0 else 1 end, wm.created_at asc
    limit 1
  ), partner_membership as (
    select wm.email, wm.role, wm.membership_status
    from public.wedding_memberships wm
    where wm.wedding_id = selected_wedding.id
      and wm.is_owner = true
      and not (
        wm.user_id = auth.uid()
        or lower(wm.email) = public.current_user_email()
      )
    order by case when wm.membership_status = 'active' then 0 else 1 end, wm.created_at asc
    limit 1
  ), pending_invite as (
    select wi.email, wi.proposed_role, wi.expires_at
    from public.wedding_invites wi
    where wi.wedding_id = selected_wedding.id
      and wi.invite_type = 'partner'
      and wi.status = 'pending'
    order by wi.created_at desc
    limit 1
  )
  select
    selected_wedding.id,
    selected_wedding.name,
    selected_wedding.wedding_code,
    selected_wedding.wedding_date,
    selected_wedding.location_county,
    selected_wedding.location_town,
    coalesce(
      resolved_owner_role,
      (select sm.role from self_membership sm),
      case
        when pm.role = 'groom' then 'bride'
        when pm.role = 'bride' then 'groom'
        when pi.proposed_role = 'groom' then 'bride'
        when pi.proposed_role = 'bride' then 'groom'
        else 'bride'
      end
    )::text,
    coalesce(pm.email, pi.email),
    coalesce(pm.role, pi.proposed_role)::text,
    case
      when pm.membership_status = 'active' then 'active'
      when pi.email is not null or pm.membership_status = 'invited' then 'pending'
      else 'not_invited'
    end::text,
    pi.expires_at
  from (select 1) base
  left join partner_membership pm on true
  left join pending_invite pi on true;
end;
$$;

grant execute on function public.get_my_wedding_ownership() to authenticated;

with direct_owned_weddings as (
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
  order by wm.user_id, wm.created_at desc
), created_owned_weddings as (
  select distinct on (w.created_by_user_id)
    w.created_by_user_id as user_id,
    w.wedding_code,
    w.wedding_date,
    w.location_county,
    w.location_town
  from public.weddings w
  where w.created_by_user_id is not null
  order by w.created_by_user_id, w.created_at desc
), resolved_owned_weddings as (
  select * from direct_owned_weddings
  union all
  select cow.*
  from created_owned_weddings cow
  where not exists (
    select 1
    from direct_owned_weddings dow
    where dow.user_id = cow.user_id
  )
)
update public.profiles p
set
  collaboration_code = coalesce(p.collaboration_code, row.wedding_code),
  wedding_date = coalesce(p.wedding_date, row.wedding_date),
  wedding_county = coalesce(p.wedding_county, row.location_county),
  wedding_town = coalesce(p.wedding_town, row.location_town),
  wedding_location = coalesce(
    p.wedding_location,
    nullif(concat_ws(', ', row.location_town, row.location_county), '')
  ),
  updated_at = now()
from resolved_owned_weddings row
where p.user_id = row.user_id;
