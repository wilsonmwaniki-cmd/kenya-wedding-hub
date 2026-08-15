-- Bring the staging lead marketplace to the reviewed privacy and eligibility rules.

create or replace function lead_marketplace_private.canonical_category(value text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '', 'g')
    when 'catering' then 'Caterer'
    when 'caterer' then 'Caterer'
    when 'cake' then 'Cake Artist & Baker'
    when 'cakeartistbaker' then 'Cake Artist & Baker'
    when 'photography' then 'Photographer'
    when 'photographer' then 'Photographer'
    when 'videography' then 'Cinematographer'
    when 'videographer' then 'Cinematographer'
    when 'cinematographer' then 'Cinematographer'
    when 'mc' then 'Master of Ceremonies'
    when 'masterofceremonies' then 'Master of Ceremonies'
    when 'venue' then 'Wedding Venue'
    when 'weddingvenue' then 'Wedding Venue'
    when 'planning' then 'Wedding Planner / Planning Team'
    when 'planner' then 'Wedding Planner / Planning Team'
    when 'weddingplannerplanningteam' then 'Wedding Planner / Planning Team'
    when 'decor' then 'Décor, Tents, Chairs, Tables'
    when 'decortentschairstables' then 'Décor, Tents, Chairs, Tables'
    when 'attire' then 'Bridal Gown, Accessories, Preparation'
    when 'bridalgownaccessoriespreparation' then 'Bridal Gown, Accessories, Preparation'
    when 'beauty' then 'Bride''s Makeup'
    when 'transportation' then 'Transport'
    else nullif(btrim(value), '')
  end;
$$;

create or replace function lead_marketplace_private.validate_match_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, lead_marketplace_private, pg_temp
as $$
declare
  request_row public.lead_requests%rowtype;
  accepted_count integer;
begin
  if old.status = new.status then return new; end if;
  if pg_trigger_depth() > 1 then return new; end if;
  select * into request_row from public.lead_requests where id = old.lead_request_id for update;

  if auth.uid() = old.provider_user_id then
    if old.status <> 'invited' or new.status not in ('accepted', 'passed') then
      raise exception 'This lead response is not allowed.' using errcode = '42501';
    end if;
    if new.status = 'accepted' then
      if old.provider_type = 'vendor' and not exists (
        select 1 from public.vendor_listings listing
        where listing.id = old.vendor_listing_id
          and listing.user_id = auth.uid()
          and listing.is_approved = true
          and listing.is_verified = true
          and listing.subscription_status = 'active'
          and (listing.subscription_expires_at is null or listing.subscription_expires_at > now())
      ) then
        raise exception 'An active verified subscription is required to accept leads.' using errcode = '42501';
      elsif old.provider_type = 'planner' and not exists (
        select 1 from public.profiles profile
        where profile.user_id = auth.uid()
          and profile.planner_verified = true
          and profile.planner_subscription_status = 'active'
          and (profile.planner_subscription_expires_at is null or profile.planner_subscription_expires_at > now())
      ) then
        raise exception 'An active verified subscription is required to accept leads.' using errcode = '42501';
      end if;
      select count(*) into accepted_count from public.lead_matches
      where lead_request_id = old.lead_request_id and status in ('accepted', 'selected');
      if accepted_count >= request_row.max_matches then
        raise exception 'This request already has three interested providers.' using errcode = '23514';
      end if;
    end if;
    new.responded_at := now();
    return new;
  end if;

  if public.can_manage_wedding_memberships(request_row.wedding_id) then
    if old.status <> 'accepted' or new.status <> 'selected' then
      raise exception 'Only an interested provider can be selected.' using errcode = '42501';
    end if;
    new.selected_at := now();
    update public.lead_matches
    set status = 'not_selected'
    where lead_request_id = old.lead_request_id and id <> old.id and status = 'accepted';
    update public.lead_requests set status = 'selected', updated_at = now() where id = old.lead_request_id;
    return new;
  end if;

  raise exception 'You cannot change this match.' using errcode = '42501';
end;
$$;

create or replace function lead_marketplace_private.validate_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, lead_marketplace_private, pg_temp
as $$
begin
  if old.status = new.status or pg_trigger_depth() > 1 then return new; end if;
  if not public.can_manage_wedding_memberships(old.wedding_id)
    or new.status <> 'cancelled'
    or old.status not in ('open', 'matched', 'no_match')
  then
    raise exception 'This lead request cannot be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_lead_request_status_trigger on public.lead_requests;
create trigger validate_lead_request_status_trigger
before update of status on public.lead_requests
for each row execute function lead_marketplace_private.validate_request_status_change();

drop policy if exists "Lead participants can send messages" on public.lead_messages;
create policy "Lead participants can send messages"
on public.lead_messages for insert to authenticated
with check (
  exists (
    select 1
    from public.lead_matches match
    join public.lead_requests request on request.id = match.lead_request_id
    where match.id = lead_messages.match_id
      and match.status in ('accepted', 'selected')
      and (
        (lead_messages.sender_side = 'provider'
          and match.provider_user_id = (select auth.uid())
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
        or (lead_messages.sender_side = 'couple' and public.can_manage_wedding_memberships(request.wedding_id))
      )
  )
);

drop policy if exists "Accepted providers can submit offers" on public.lead_offers;
create policy "Accepted providers can submit offers"
on public.lead_offers for insert to authenticated
with check (
  exists (
    select 1 from public.lead_matches match
    where match.id = lead_offers.match_id
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
);

revoke all on all functions in schema lead_marketplace_private from public, anon, authenticated;
