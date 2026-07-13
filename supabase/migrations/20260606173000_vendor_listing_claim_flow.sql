alter table public.vendor_listings
  add column if not exists claim_contact_email text,
  add column if not exists claim_token uuid,
  add column if not exists claim_invited_at timestamptz,
  add column if not exists claim_expires_at timestamptz,
  add column if not exists claim_claimed_at timestamptz;

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
  featured_rank integer,
  claim_contact_email text,
  claim_invited_at timestamptz,
  claim_expires_at timestamptz
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
    v.featured_rank,
    v.claim_contact_email::text,
    v.claim_invited_at,
    v.claim_expires_at
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
      or coalesce(v.claim_contact_email, '') ilike '%' || search_query || '%'
    )
  order by
    v.featured_rank desc,
    v.updated_at desc
  limit greatest(1, least(limit_rows, 200))
  offset greatest(0, offset_rows);
end;
$$;

create or replace function public.admin_prepare_vendor_listing_claim(
  listing_id uuid,
  claim_email text
)
returns table (
  claim_token uuid,
  claim_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text;
  next_token uuid := gen_random_uuid();
begin
  perform public.require_admin();

  normalized_email := lower(trim(claim_email));
  if normalized_email is null or normalized_email = '' then
    raise exception 'Claim email is required'
      using errcode = 'P0001';
  end if;

  update public.vendor_listings
  set
    claim_contact_email = normalized_email,
    claim_token = next_token,
    claim_invited_at = now(),
    claim_expires_at = now() + interval '14 days',
    claim_claimed_at = null,
    updated_at = now()
  where id = listing_id
    and user_id is null;

  if not found then
    raise exception 'Only unclaimed vendor listings can receive claim invites'
      using errcode = 'P0002';
  end if;

  return query
  select
    next_token,
    format(
      'https://www.planwithzania.com/vendor-claim?token=%s&email=%s',
      next_token::text,
      normalized_email
    );
end;
$$;

create or replace function public.get_vendor_listing_claim(
  claim_token uuid
)
returns table (
  listing_id uuid,
  business_name text,
  category text,
  location text,
  claim_contact_email text,
  claim_expires_at timestamptz,
  claim_status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    v.id,
    v.business_name::text,
    v.category::text,
    v.location::text,
    v.claim_contact_email::text,
    v.claim_expires_at,
    case
      when v.user_id is not null or v.claim_claimed_at is not null then 'claimed'
      when v.claim_expires_at is not null and v.claim_expires_at < now() then 'expired'
      else 'ready'
    end::text as claim_status
  from public.vendor_listings v
  where v.claim_token = get_vendor_listing_claim.claim_token;
end;
$$;

create or replace function public.claim_vendor_listing(
  claim_token uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_listing public.vendor_listings%rowtype;
  active_user_id uuid := auth.uid();
  active_email text;
  existing_listing_id uuid;
  has_vendor_role boolean := false;
begin
  if active_user_id is null then
    raise exception 'Sign in first to claim this listing'
      using errcode = 'P0001';
  end if;

  select lower(u.email::text)
  into active_email
  from auth.users u
  where u.id = active_user_id;

  select exists(
    select 1
    from public.user_roles ur
    where ur.user_id = active_user_id
      and ur.role = 'vendor'::public.app_role
  ) or exists(
    select 1
    from public.profiles p
    where p.user_id = active_user_id
      and p.role = 'vendor'::public.app_role
  )
  into has_vendor_role;

  if not has_vendor_role then
    raise exception 'Finish setting up your vendor account before claiming this listing'
      using errcode = 'P0001';
  end if;

  select *
  into target_listing
  from public.vendor_listings v
  where v.claim_token = claim_vendor_listing.claim_token;

  if not found then
    raise exception 'This vendor claim link is invalid'
      using errcode = 'P0002';
  end if;

  if target_listing.claim_expires_at is not null and target_listing.claim_expires_at < now() then
    raise exception 'This vendor claim link has expired'
      using errcode = 'P0001';
  end if;

  if target_listing.user_id is not null or target_listing.claim_claimed_at is not null then
    if target_listing.user_id = active_user_id then
      return target_listing.id;
    end if;

    raise exception 'This vendor listing has already been claimed'
      using errcode = 'P0001';
  end if;

  if coalesce(active_email, '') = '' or lower(coalesce(target_listing.claim_contact_email, '')) <> active_email then
    raise exception 'Sign in with the invited email address to claim this vendor listing'
      using errcode = 'P0001';
  end if;

  select v.id
  into existing_listing_id
  from public.vendor_listings v
  where v.user_id = active_user_id
    and v.id <> target_listing.id
  limit 1;

  if existing_listing_id is not null then
    raise exception 'This vendor account already owns another listing'
      using errcode = 'P0001';
  end if;

  update public.vendor_listings
  set
    user_id = active_user_id,
    profile_kind = 'claimed',
    claimed_at = coalesce(claimed_at, now()),
    claim_claimed_at = now(),
    updated_at = now()
  where id = target_listing.id;

  return target_listing.id;
end;
$$;

revoke execute on function public.admin_list_vendor_listings(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_vendor_listings(text, text, integer, integer) to authenticated;

revoke execute on function public.admin_prepare_vendor_listing_claim(uuid, text) from public, anon;
grant execute on function public.admin_prepare_vendor_listing_claim(uuid, text) to authenticated;

revoke execute on function public.get_vendor_listing_claim(uuid) from public;
grant execute on function public.get_vendor_listing_claim(uuid) to anon, authenticated;

revoke execute on function public.claim_vendor_listing(uuid) from public, anon;
grant execute on function public.claim_vendor_listing(uuid) to authenticated;
