-- Keep provider access independent from the couple-only lead request policy.

drop policy if exists "Lead participants can view messages" on public.lead_messages;
create policy "Lead participants can view messages"
on public.lead_messages for select to authenticated
using (
  exists (
    select 1 from public.lead_matches match
    where match.id = lead_messages.match_id
      and match.provider_user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.lead_matches match
    join public.lead_requests request on request.id = match.lead_request_id
    where match.id = lead_messages.match_id
      and public.can_manage_wedding_memberships(request.wedding_id)
  )
);

drop policy if exists "Lead participants can send messages" on public.lead_messages;
create policy "Lead participants can send messages"
on public.lead_messages for insert to authenticated
with check (
  (
    lead_messages.sender_side = 'provider'
    and exists (
      select 1 from public.lead_matches match
      where match.id = lead_messages.match_id
        and match.provider_user_id = (select auth.uid())
        and match.status in ('accepted', 'selected')
        and (
          (match.provider_type = 'vendor' and exists (
            select 1 from public.vendor_listings listing
            where listing.id = match.vendor_listing_id
              and listing.subscription_status = 'active'
              and (listing.subscription_expires_at is null or listing.subscription_expires_at > now())
          ))
          or (match.provider_type = 'planner' and exists (
            select 1 from public.profiles profile
            where profile.user_id = match.provider_user_id
              and profile.planner_subscription_status = 'active'
              and (profile.planner_subscription_expires_at is null or profile.planner_subscription_expires_at > now())
          ))
        )
    )
  )
  or (
    lead_messages.sender_side = 'couple'
    and exists (
      select 1
      from public.lead_matches match
      join public.lead_requests request on request.id = match.lead_request_id
      where match.id = lead_messages.match_id
        and match.status in ('accepted', 'selected')
        and public.can_manage_wedding_memberships(request.wedding_id)
    )
  )
);

drop policy if exists "Lead participants can view offers" on public.lead_offers;
create policy "Lead participants can view offers"
on public.lead_offers for select to authenticated
using (
  exists (
    select 1 from public.lead_matches match
    where match.id = lead_offers.match_id
      and match.provider_user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.lead_matches match
    join public.lead_requests request on request.id = match.lead_request_id
    where match.id = lead_offers.match_id
      and public.can_manage_wedding_memberships(request.wedding_id)
  )
);

drop policy if exists "Lead participants can view contact reveals" on public.lead_contact_reveals;
create policy "Lead participants can view contact reveals"
on public.lead_contact_reveals for select to authenticated
using (
  exists (
    select 1 from public.lead_matches match
    where match.id = lead_contact_reveals.match_id
      and match.provider_user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.lead_matches match
    join public.lead_requests request on request.id = match.lead_request_id
    where match.id = lead_contact_reveals.match_id
      and public.can_manage_wedding_memberships(request.wedding_id)
  )
);
;
