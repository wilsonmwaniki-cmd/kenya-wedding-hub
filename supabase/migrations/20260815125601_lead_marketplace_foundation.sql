-- Anonymous, subscription-funded provider lead marketplace.
-- The couple's identity stays private until an explicit contact reveal.

create schema if not exists lead_marketplace_private;
revoke all on schema lead_marketplace_private from public, anon, authenticated;

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

create or replace function lead_marketplace_private.budget_band(amount numeric)
returns numeric[]
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  increment_value numeric;
  lower_value numeric;
  upper_value numeric;
begin
  if amount is null or amount <= 0 then
    return array[null::numeric, null::numeric];
  end if;
  increment_value := case
    when amount < 100000 then 10000
    when amount <= 500000 then 25000
    else 50000
  end;
  lower_value := floor(amount / increment_value) * increment_value;
  upper_value := ceil(amount / increment_value) * increment_value;
  if upper_value = lower_value then
    upper_value := upper_value + increment_value;
  end if;
  return array[greatest(0, lower_value), upper_value];
end;
$$;

create table public.lead_requests (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  requested_by_user_id uuid not null references auth.users(id) on delete cascade,
  provider_type text not null check (provider_type in ('vendor', 'planner')),
  category_key text not null,
  status text not null default 'open'
    check (status in ('open', 'matched', 'no_match', 'selected', 'closed', 'cancelled', 'expired')),
  max_invites integer not null default 5 check (max_invites = 5),
  max_matches integer not null default 3 check (max_matches = 3),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index lead_requests_one_live_category
  on public.lead_requests (wedding_id, provider_type, lower(category_key))
  where status in ('open', 'matched');
create index lead_requests_wedding_created_idx
  on public.lead_requests (wedding_id, created_at desc);

create table public.lead_briefs (
  lead_request_id uuid primary key references public.lead_requests(id) on delete cascade,
  wedding_date date not null,
  location_county text null,
  location_town text null,
  estimated_guest_count integer null check (estimated_guest_count is null or estimated_guest_count > 0),
  budget_min_kes numeric null check (budget_min_kes is null or budget_min_kes >= 0),
  budget_max_kes numeric null check (budget_max_kes is null or budget_max_kes >= budget_min_kes),
  wedding_type text null,
  top_priorities text[] not null default '{}',
  request_note text null check (request_note is null or char_length(request_note) <= 500),
  created_at timestamptz not null default now()
);

create table public.lead_matches (
  id uuid primary key default gen_random_uuid(),
  lead_request_id uuid not null references public.lead_requests(id) on delete cascade,
  provider_type text not null check (provider_type in ('vendor', 'planner')),
  provider_user_id uuid not null references auth.users(id) on delete cascade,
  vendor_listing_id uuid null references public.vendor_listings(id) on delete cascade,
  provider_name text not null,
  provider_category text not null,
  match_score integer not null default 0,
  match_reasons text[] not null default '{}',
  status text not null default 'invited'
    check (status in ('invited', 'accepted', 'passed', 'selected', 'not_selected', 'expired')),
  invited_at timestamptz not null default now(),
  responded_at timestamptz null,
  selected_at timestamptz null,
  unique (lead_request_id, provider_user_id)
);
create index lead_matches_provider_inbox_idx
  on public.lead_matches (provider_user_id, status, invited_at desc);
create index lead_matches_request_idx
  on public.lead_matches (lead_request_id, status, match_score desc);

create table public.lead_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.lead_matches(id) on delete cascade,
  sender_side text not null check (sender_side in ('couple', 'provider')),
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index lead_messages_match_time_idx on public.lead_messages (match_id, created_at);

create table public.lead_offers (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.lead_matches(id) on delete cascade,
  amount_kes numeric not null check (amount_kes >= 0),
  summary text not null check (char_length(btrim(summary)) between 1 and 1000),
  valid_until date null,
  status text not null default 'submitted'
    check (status in ('submitted', 'withdrawn', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);
create index lead_offers_match_time_idx on public.lead_offers (match_id, created_at desc);

create table public.lead_contact_reveals (
  match_id uuid primary key references public.lead_matches(id) on delete cascade,
  couple_name text null,
  couple_email text null,
  couple_phone text null,
  revealed_at timestamptz not null default now()
);

create table public.lead_prompt_states (
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  provider_type text not null check (provider_type in ('vendor', 'planner')),
  category_key text not null,
  state text not null check (state in ('shown', 'dismissed', 'snoozed', 'requested')),
  next_prompt_at timestamptz null,
  updated_at timestamptz not null default now(),
  primary key (wedding_id, provider_type, category_key)
);

alter table public.lead_requests enable row level security;
alter table public.lead_briefs enable row level security;
alter table public.lead_matches enable row level security;
alter table public.lead_messages enable row level security;
alter table public.lead_offers enable row level security;
alter table public.lead_contact_reveals enable row level security;
alter table public.lead_prompt_states enable row level security;

create policy "Wedding owners can view lead requests"
on public.lead_requests for select to authenticated
using (public.can_manage_wedding_memberships(wedding_id));

create policy "Wedding owners can create lead requests"
on public.lead_requests for insert to authenticated
with check (
  requested_by_user_id = (select auth.uid())
  and public.can_manage_wedding_memberships(wedding_id)
);

create policy "Wedding owners can cancel lead requests"
on public.lead_requests for update to authenticated
using (public.can_manage_wedding_memberships(wedding_id))
with check (public.can_manage_wedding_memberships(wedding_id));

create policy "Participants can view safe lead briefs"
on public.lead_briefs for select to authenticated
using (
  exists (
    select 1 from public.lead_requests request
    where request.id = lead_briefs.lead_request_id
      and public.can_manage_wedding_memberships(request.wedding_id)
  )
  or exists (
    select 1 from public.lead_matches match
    where match.lead_request_id = lead_briefs.lead_request_id
      and match.provider_user_id = (select auth.uid())
  )
);

create policy "Lead participants can view matches"
on public.lead_matches for select to authenticated
using (
  provider_user_id = (select auth.uid())
  or exists (
    select 1 from public.lead_requests request
    where request.id = lead_matches.lead_request_id
      and public.can_manage_wedding_memberships(request.wedding_id)
  )
);

create policy "Lead participants can update match status"
on public.lead_matches for update to authenticated
using (
  provider_user_id = (select auth.uid())
  or exists (
    select 1 from public.lead_requests request
    where request.id = lead_matches.lead_request_id
      and public.can_manage_wedding_memberships(request.wedding_id)
  )
)
with check (
  provider_user_id = (select auth.uid())
  or exists (
    select 1 from public.lead_requests request
    where request.id = lead_matches.lead_request_id
      and public.can_manage_wedding_memberships(request.wedding_id)
  )
);

create policy "Lead participants can view messages"
on public.lead_messages for select to authenticated
using (
  exists (
    select 1
    from public.lead_matches match
    join public.lead_requests request on request.id = match.lead_request_id
    where match.id = lead_messages.match_id
      and (
        match.provider_user_id = (select auth.uid())
        or public.can_manage_wedding_memberships(request.wedding_id)
      )
  )
);

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

create policy "Lead participants can view offers"
on public.lead_offers for select to authenticated
using (
  exists (
    select 1
    from public.lead_matches match
    join public.lead_requests request on request.id = match.lead_request_id
    where match.id = lead_offers.match_id
      and (
        match.provider_user_id = (select auth.uid())
        or public.can_manage_wedding_memberships(request.wedding_id)
      )
  )
);

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

create policy "Lead participants can view contact reveals"
on public.lead_contact_reveals for select to authenticated
using (
  exists (
    select 1
    from public.lead_matches match
    join public.lead_requests request on request.id = match.lead_request_id
    where match.id = lead_contact_reveals.match_id
      and (
        match.provider_user_id = (select auth.uid())
        or public.can_manage_wedding_memberships(request.wedding_id)
      )
  )
);

create policy "Wedding owners can reveal contact details"
on public.lead_contact_reveals for insert to authenticated
with check (
  exists (
    select 1
    from public.lead_matches match
    join public.lead_requests request on request.id = match.lead_request_id
    where match.id = lead_contact_reveals.match_id
      and match.status = 'selected'
      and public.can_manage_wedding_memberships(request.wedding_id)
  )
);

create policy "Wedding owners can manage lead prompt state"
on public.lead_prompt_states for all to authenticated
using (public.can_manage_wedding_memberships(wedding_id))
with check (public.can_manage_wedding_memberships(wedding_id));

create or replace function lead_marketplace_private.prepare_lead_request()
returns trigger
language plpgsql
security definer
set search_path = public, lead_marketplace_private, pg_temp
as $$
begin
  if auth.uid() is null or not public.can_manage_wedding_memberships(new.wedding_id) then
    raise exception 'Only a wedding owner can request provider help.' using errcode = '42501';
  end if;
  if new.provider_type = 'planner' then
    new.category_key := 'Wedding Planner / Planning Team';
  else
    new.category_key := lead_marketplace_private.canonical_category(new.category_key);
  end if;
  if new.category_key is null then
    raise exception 'Choose a provider category.' using errcode = '22023';
  end if;
  new.requested_by_user_id := auth.uid();
  new.status := 'open';
  new.max_invites := 5;
  new.max_matches := 3;
  new.expires_at := now() + interval '7 days';
  return new;
end;
$$;

create or replace function lead_marketplace_private.match_lead_request()
returns trigger
language plpgsql
security definer
set search_path = public, lead_marketplace_private, pg_temp
as $$
declare
  wedding_row public.weddings%rowtype;
  planning_row public.wedding_planning_profiles%rowtype;
  amount_value numeric;
  band numeric[];
  inserted_count integer := 0;
begin
  select * into wedding_row from public.weddings where id = new.wedding_id;
  if wedding_row.wedding_date is null then
    raise exception 'Add a wedding date before requesting matches.' using errcode = '22023';
  end if;

  select * into planning_row
  from public.wedding_planning_profiles
  where wedding_id = new.wedding_id;

  if new.provider_type = 'planner' then
    amount_value := coalesce(
      planning_row.estimated_budget,
      (select wedding_budget_goal from public.profiles where user_id = new.requested_by_user_id)
    );
  else
    select sum(category.allocated) into amount_value
    from public.budget_categories category
    where category.wedding_id = new.wedding_id
      and category.budget_scope = 'wedding'
      and lead_marketplace_private.canonical_category(category.name) = new.category_key;
  end if;
  band := lead_marketplace_private.budget_band(amount_value);

  insert into public.lead_briefs (
    lead_request_id, wedding_date, location_county, location_town,
    estimated_guest_count, budget_min_kes, budget_max_kes,
    wedding_type, top_priorities
  ) values (
    new.id, wedding_row.wedding_date, wedding_row.location_county, wedding_row.location_town,
    planning_row.estimated_guest_count, band[1], band[2],
    planning_row.wedding_type, coalesce(planning_row.top_priorities, '{}')
  );

  if new.provider_type = 'vendor' then
    insert into public.lead_matches (
      lead_request_id, provider_type, provider_user_id, vendor_listing_id,
      provider_name, provider_category, match_score, match_reasons
    )
    select
      new.id, 'vendor', listing.user_id, listing.id,
      listing.business_name,
      lead_marketplace_private.canonical_category(listing.category),
      (case
        when wedding_row.location_town is not null and lower(listing.location_town) = lower(wedding_row.location_town) then 6
        when wedding_row.location_county is not null and lower(listing.location_county) = lower(wedding_row.location_county) then 4
        when wedding_row.location_county is not null and exists (
          select 1 from unnest(coalesce(listing.service_areas, '{}')) area
          where lower(area) = lower(wedding_row.location_county)
        ) then 3
        when listing.travel_scope = 'nationwide' then 1 else 0
      end)
      + (case when band[1] is not null
        and listing.minimum_budget_kes <= band[2]
        and listing.maximum_budget_kes >= band[1]
        then 2 else 0 end),
      array_remove(array[
        case
          when wedding_row.location_town is not null and lower(listing.location_town) = lower(wedding_row.location_town) then 'Near the wedding location'
          when wedding_row.location_county is not null and lower(listing.location_county) = lower(wedding_row.location_county) then 'Serves the wedding county'
          when listing.travel_scope = 'nationwide' then 'Available nationwide'
          else 'Serves the wedding area'
        end,
        case when band[1] is not null
          and listing.minimum_budget_kes <= band[2]
          and listing.maximum_budget_kes >= band[1]
          then 'Fits the budget range' end
      ], null)
    from public.vendor_listings listing
    where listing.user_id is not null
      and listing.is_approved = true
      and listing.is_verified = true
      and listing.subscription_status = 'active'
      and (listing.subscription_expires_at is null or listing.subscription_expires_at > now())
      and listing.minimum_budget_kes is not null
      and listing.maximum_budget_kes is not null
      and lead_marketplace_private.canonical_category(listing.category) = new.category_key
      and (
        wedding_row.location_county is null
        or lower(listing.location_county) = lower(wedding_row.location_county)
        or exists (
          select 1 from unnest(coalesce(listing.service_areas, '{}')) area
          where lower(area) = lower(wedding_row.location_county)
        )
        or listing.travel_scope = 'nationwide'
      )
      and (
        band[1] is null
        or (listing.minimum_budget_kes <= band[2] and listing.maximum_budget_kes >= band[1])
      )
    order by 7 desc, listing.business_name
    limit 5;
  else
    insert into public.lead_matches (
      lead_request_id, provider_type, provider_user_id,
      provider_name, provider_category, match_score, match_reasons
    )
    select
      new.id, 'planner', profile.user_id,
      coalesce(nullif(profile.company_name, ''), nullif(profile.full_name, ''), 'Wedding planner'),
      'Wedding Planner / Planning Team',
      (case
        when wedding_row.location_town is not null and lower(profile.primary_town) = lower(wedding_row.location_town) then 6
        when wedding_row.location_county is not null and lower(profile.primary_county) = lower(wedding_row.location_county) then 4
        when wedding_row.location_county is not null and exists (
          select 1 from unnest(coalesce(profile.service_areas, '{}')) area
          where lower(area) = lower(wedding_row.location_county)
        ) then 3
        when profile.travel_scope = 'nationwide' then 1 else 0
      end)
      + (case when band[1] is not null
        and profile.minimum_budget_kes <= band[2]
        and profile.maximum_budget_kes >= band[1]
        then 2 else 0 end),
      array_remove(array[
        case
          when wedding_row.location_town is not null and lower(profile.primary_town) = lower(wedding_row.location_town) then 'Near the wedding location'
          when wedding_row.location_county is not null and lower(profile.primary_county) = lower(wedding_row.location_county) then 'Serves the wedding county'
          when profile.travel_scope = 'nationwide' then 'Available nationwide'
          else 'Serves the wedding area'
        end,
        case when band[1] is not null
          and profile.minimum_budget_kes <= band[2]
          and profile.maximum_budget_kes >= band[1]
          then 'Works with this wedding budget' end
      ], null)
    from public.profiles profile
    where profile.role = 'planner'
      and profile.planner_type is distinct from 'committee'
      and profile.planner_verified = true
      and profile.planner_subscription_status = 'active'
      and (profile.planner_subscription_expires_at is null or profile.planner_subscription_expires_at > now())
      and profile.minimum_budget_kes is not null
      and profile.maximum_budget_kes is not null
      and (
        wedding_row.location_county is null
        or lower(profile.primary_county) = lower(wedding_row.location_county)
        or exists (
          select 1 from unnest(coalesce(profile.service_areas, '{}')) area
          where lower(area) = lower(wedding_row.location_county)
        )
        or profile.travel_scope = 'nationwide'
      )
      and (
        band[1] is null
        or (profile.minimum_budget_kes <= band[2] and profile.maximum_budget_kes >= band[1])
      )
    order by 6 desc, coalesce(profile.company_name, profile.full_name)
    limit 5;
  end if;

  get diagnostics inserted_count = row_count;
  update public.lead_requests
  set status = case when inserted_count > 0 then 'matched' else 'no_match' end,
      updated_at = now()
  where id = new.id;

  insert into public.lead_prompt_states (wedding_id, provider_type, category_key, state)
  values (new.wedding_id, new.provider_type, new.category_key, 'requested')
  on conflict (wedding_id, provider_type, category_key)
  do update set state = 'requested', updated_at = now();

  return new;
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

create or replace function lead_marketplace_private.populate_revealed_contact()
returns trigger
language plpgsql
security definer
set search_path = public, lead_marketplace_private, auth, pg_temp
as $$
declare
  request_user_id uuid;
begin
  select request.requested_by_user_id into request_user_id
  from public.lead_matches match
  join public.lead_requests request on request.id = match.lead_request_id
  where match.id = new.match_id and match.status = 'selected';
  if request_user_id is null or request_user_id <> auth.uid() then
    raise exception 'Only the couple can share their contact details.' using errcode = '42501';
  end if;
  select profile.full_name, account.email, account.phone
  into new.couple_name, new.couple_email, new.couple_phone
  from auth.users account
  left join public.profiles profile on profile.user_id = account.id
  where account.id = request_user_id;
  new.revealed_at := now();
  return new;
end;
$$;

create trigger prepare_lead_request_trigger
before insert on public.lead_requests
for each row execute function lead_marketplace_private.prepare_lead_request();

create trigger match_lead_request_trigger
after insert on public.lead_requests
for each row execute function lead_marketplace_private.match_lead_request();

create trigger validate_lead_match_status_trigger
before update of status on public.lead_matches
for each row execute function lead_marketplace_private.validate_match_status_change();

create trigger validate_lead_request_status_trigger
before update of status on public.lead_requests
for each row execute function lead_marketplace_private.validate_request_status_change();

create trigger populate_revealed_contact_trigger
before insert on public.lead_contact_reveals
for each row execute function lead_marketplace_private.populate_revealed_contact();

create trigger update_lead_requests_updated_at
before update on public.lead_requests
for each row execute function public.update_updated_at_column();

create trigger update_lead_prompt_states_updated_at
before update on public.lead_prompt_states
for each row execute function public.update_updated_at_column();

revoke all on public.lead_requests, public.lead_briefs, public.lead_matches,
  public.lead_messages, public.lead_offers, public.lead_contact_reveals,
  public.lead_prompt_states from public, anon, authenticated;

grant select on public.lead_requests, public.lead_briefs, public.lead_matches,
  public.lead_messages, public.lead_offers, public.lead_contact_reveals,
  public.lead_prompt_states to authenticated;
grant insert (wedding_id, provider_type, category_key) on public.lead_requests to authenticated;
grant update (status) on public.lead_requests to authenticated;
grant update (status) on public.lead_matches to authenticated;
grant insert (match_id, sender_side, body) on public.lead_messages to authenticated;
grant insert (match_id, amount_kes, summary, valid_until) on public.lead_offers to authenticated;
grant insert (match_id) on public.lead_contact_reveals to authenticated;
grant insert (wedding_id, provider_type, category_key, state, next_prompt_at),
  update (state, next_prompt_at) on public.lead_prompt_states to authenticated;

revoke all on all functions in schema lead_marketplace_private from public, anon, authenticated;
;
