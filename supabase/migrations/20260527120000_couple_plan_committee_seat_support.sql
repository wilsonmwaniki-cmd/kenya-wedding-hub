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
      and wsb.bundle_type in ('committee_bundle', 'wedding_pass')
      and wsb.seat_limit is not null
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
