alter table public.vendor_listings
  alter column user_id drop not null;

drop policy if exists "Vendors can view own listing" on public.vendor_listings;
create policy "Vendors can view own listing"
on public.vendor_listings
for select
using (user_id is not null and auth.uid() = user_id);

drop policy if exists "Vendors can insert own listing" on public.vendor_listings;
create policy "Vendors can insert own listing"
on public.vendor_listings
for insert
with check (user_id is not null and auth.uid() = user_id);

drop policy if exists "Vendors can update own listing" on public.vendor_listings;
create policy "Vendors can update own listing"
on public.vendor_listings
for update
using (user_id is not null and auth.uid() = user_id);

drop policy if exists "Vendors can delete own listing" on public.vendor_listings;
create policy "Vendors can delete own listing"
on public.vendor_listings
for delete
using (user_id is not null and auth.uid() = user_id);

drop function if exists public.admin_list_vendor_listings(text, text, integer, integer);
create function public.admin_list_vendor_listings(
  search_query text default null,
  status_filter text default 'all',
  limit_rows integer default 100,
  offset_rows integer default 0
)
returns table (
  listing_id uuid,
  user_id uuid,
  business_name text,
  category text,
  location text,
  is_approved boolean,
  is_verified boolean,
  verification_requested boolean,
  verification_requested_at timestamptz,
  subscription_status text,
  subscription_expires_at timestamptz,
  updated_at timestamptz,
  owner_name text,
  owner_email text,
  profile_kind text,
  public_listing_note text,
  featured_rank integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  return query
  select
    v.id,
    v.user_id,
    v.business_name::text,
    v.category::text,
    v.location::text,
    v.is_approved,
    v.is_verified,
    v.verification_requested,
    v.verification_requested_at,
    v.subscription_status::text,
    v.subscription_expires_at,
    v.updated_at::timestamptz,
    p.full_name::text,
    u.email::text,
    v.profile_kind::text,
    v.public_listing_note::text,
    v.featured_rank
  from public.vendor_listings v
  left join public.profiles p
    on p.user_id = v.user_id
  left join auth.users u
    on u.id = v.user_id
  where
    (
      status_filter = 'all'
      or (status_filter = 'pending' and v.is_approved = false)
      or (status_filter = 'approved' and v.is_approved = true)
      or (status_filter = 'claimed' and v.profile_kind = 'claimed')
      or (status_filter = 'curated' and v.profile_kind = 'curated')
      or (status_filter = 'featured' and v.profile_kind = 'featured')
    )
    and (
      search_query is null
      or v.business_name ilike '%' || search_query || '%'
      or v.category ilike '%' || search_query || '%'
      or coalesce(v.location, '') ilike '%' || search_query || '%'
      or coalesce(p.full_name, '') ilike '%' || search_query || '%'
      or coalesce(u.email, '') ilike '%' || search_query || '%'
    )
  order by
    v.featured_rank desc,
    v.updated_at desc
  limit greatest(1, least(limit_rows, 200))
  offset greatest(0, offset_rows);
end;
$$;

drop function if exists public.admin_list_planner_profiles(text, text, integer, integer);
create function public.admin_list_planner_profiles(
  search_query text default null,
  verification_filter text default 'all',
  limit_rows integer default 100,
  offset_rows integer default 0
)
returns table (
  profile_id uuid,
  user_id uuid,
  full_name text,
  company_name text,
  company_email text,
  planner_type text,
  committee_name text,
  planner_verified boolean,
  planner_verification_requested boolean,
  planner_verification_requested_at timestamptz,
  planner_subscription_status text,
  planner_subscription_expires_at timestamptz,
  updated_at timestamptz,
  founding_planner_contributor boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  return query
  select
    p.id,
    p.user_id,
    p.full_name,
    p.company_name,
    p.company_email,
    coalesce(p.planner_type, 'professional')::text,
    p.committee_name,
    p.planner_verified,
    p.planner_verification_requested,
    p.planner_verification_requested_at,
    p.planner_subscription_status::text,
    p.planner_subscription_expires_at,
    p.updated_at,
    p.founding_planner_contributor
  from public.profiles p
  where p.role = 'planner'::public.app_role
    and (
      search_query is null
      or p.full_name ilike '%' || search_query || '%'
      or p.company_name ilike '%' || search_query || '%'
      or p.company_email ilike '%' || search_query || '%'
      or p.committee_name ilike '%' || search_query || '%'
    )
    and (
      verification_filter = 'all'
      or (verification_filter = 'requested' and p.planner_verification_requested = true and p.planner_verified = false)
      or (verification_filter = 'pending' and p.planner_verified = false)
      or (verification_filter = 'verified' and p.planner_verified = true)
      or (verification_filter = 'founding' and p.founding_planner_contributor = true)
    )
  order by p.updated_at desc
  limit greatest(1, least(limit_rows, 200))
  offset greatest(0, offset_rows);
end;
$$;

create or replace function public.admin_set_planner_founding_contributor(
  target_user_id uuid,
  new_founding_planner_contributor boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  update public.profiles
  set
    founding_planner_contributor = new_founding_planner_contributor,
    updated_at = now()
  where user_id = target_user_id
    and role = 'planner'::public.app_role;

  if not found then
    raise exception 'Planner profile not found'
      using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_set_vendor_listing_profile(
  listing_id uuid,
  new_profile_kind text,
  new_public_listing_note text default null,
  new_featured_rank integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  if new_profile_kind not in ('claimed', 'curated', 'featured') then
    raise exception 'Unsupported profile kind'
      using errcode = 'P0001';
  end if;

  update public.vendor_listings
  set
    profile_kind = new_profile_kind,
    public_listing_note = nullif(trim(new_public_listing_note), ''),
    featured_rank = greatest(0, coalesce(new_featured_rank, 0)),
    updated_at = now()
  where id = listing_id;

  if not found then
    raise exception 'Vendor listing not found'
      using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_list_vendor_suggestions(
  search_query text default null,
  status_filter text default 'pending',
  limit_rows integer default 100,
  offset_rows integer default 0
)
returns table (
  suggestion_id uuid,
  vendor_name text,
  category text,
  instagram_or_website text,
  location text,
  recommendation_reason text,
  status text,
  created_at timestamptz,
  suggester_role text,
  suggester_name text,
  suggester_email text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  return query
  select
    s.id,
    s.vendor_name,
    s.category,
    s.instagram_or_website,
    s.location,
    s.recommendation_reason,
    s.status,
    s.created_at,
    s.suggester_role,
    p.full_name,
    u.email::text
  from public.vendor_suggestions s
  left join public.profiles p
    on p.user_id = s.suggested_by_user_id
  left join auth.users u
    on u.id = s.suggested_by_user_id
  where
    (
      status_filter = 'all'
      or s.status = status_filter
    )
    and (
      search_query is null
      or s.vendor_name ilike '%' || search_query || '%'
      or s.category ilike '%' || search_query || '%'
      or coalesce(s.location, '') ilike '%' || search_query || '%'
      or coalesce(p.full_name, '') ilike '%' || search_query || '%'
      or coalesce(u.email, '') ilike '%' || search_query || '%'
    )
  order by s.created_at desc
  limit greatest(1, least(limit_rows, 200))
  offset greatest(0, offset_rows);
end;
$$;

create or replace function public.admin_set_vendor_suggestion_status(
  suggestion_id uuid,
  new_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  if new_status not in ('pending', 'reviewed', 'converted', 'rejected') then
    raise exception 'Unsupported suggestion status'
      using errcode = 'P0001';
  end if;

  update public.vendor_suggestions
  set
    status = new_status,
    updated_at = now()
  where id = suggestion_id;

  if not found then
    raise exception 'Vendor suggestion not found'
      using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_convert_vendor_suggestion(
  suggestion_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  suggestion_row public.vendor_suggestions%rowtype;
  new_listing_id uuid;
begin
  perform public.require_admin();

  select *
  into suggestion_row
  from public.vendor_suggestions
  where id = suggestion_id;

  if not found then
    raise exception 'Vendor suggestion not found'
      using errcode = 'P0002';
  end if;

  insert into public.vendor_listings (
    user_id,
    business_name,
    category,
    description,
    website,
    location,
    is_approved,
    is_verified,
    profile_kind,
    public_listing_note,
    featured_rank
  )
  values (
    null,
    suggestion_row.vendor_name,
    suggestion_row.category,
    suggestion_row.recommendation_reason,
    suggestion_row.instagram_or_website,
    suggestion_row.location,
    true,
    false,
    'curated',
    'Listed from public business information and Zania curation.',
    0
  )
  returning id into new_listing_id;

  update public.vendor_suggestions
  set
    status = 'converted',
    updated_at = now()
  where id = suggestion_id;

  return new_listing_id;
end;
$$;

revoke execute on function public.admin_list_vendor_listings(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_vendor_listings(text, text, integer, integer) to authenticated;

revoke execute on function public.admin_list_planner_profiles(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_planner_profiles(text, text, integer, integer) to authenticated;

revoke execute on function public.admin_set_planner_founding_contributor(uuid, boolean) from public, anon;
grant execute on function public.admin_set_planner_founding_contributor(uuid, boolean) to authenticated;

revoke execute on function public.admin_set_vendor_listing_profile(uuid, text, text, integer) from public, anon;
grant execute on function public.admin_set_vendor_listing_profile(uuid, text, text, integer) to authenticated;

revoke execute on function public.admin_list_vendor_suggestions(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_vendor_suggestions(text, text, integer, integer) to authenticated;

revoke execute on function public.admin_set_vendor_suggestion_status(uuid, text) from public, anon;
grant execute on function public.admin_set_vendor_suggestion_status(uuid, text) to authenticated;

revoke execute on function public.admin_convert_vendor_suggestion(uuid) from public, anon;
grant execute on function public.admin_convert_vendor_suggestion(uuid) to authenticated;
