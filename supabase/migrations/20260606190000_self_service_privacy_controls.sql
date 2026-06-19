alter table public.profiles
  add column if not exists marketing_opt_out boolean not null default false,
  add column if not exists marketing_opt_out_at timestamptz,
  add column if not exists directory_opt_out boolean not null default false,
  add column if not exists directory_opt_out_at timestamptz,
  add column if not exists privacy_data_deleted_at timestamptz;

alter table public.vendor_listings
  add column if not exists directory_opt_out boolean not null default false,
  add column if not exists directory_opt_out_at timestamptz;

drop view if exists public.public_planner_profiles;
create view public.public_planner_profiles as
select
  id,
  user_id,
  full_name,
  company_name,
  avatar_url,
  bio,
  specialties,
  company_email,
  company_phone,
  company_website,
  primary_county,
  primary_town,
  service_areas,
  travel_scope,
  minimum_budget_kes,
  maximum_budget_kes,
  founding_planner_contributor
from public.profiles
where role = 'planner'::public.app_role
  and planner_verified = true
  and directory_opt_out = false
  and (
    (
      planner_subscription_status = 'active'
      and (planner_subscription_expires_at is null or planner_subscription_expires_at > now())
    )
    or (
      beta_trial_status = 'active'
      and beta_trial_expires_at is not null
      and beta_trial_expires_at > now()
    )
  );

grant select on public.public_planner_profiles to anon;
grant select on public.public_planner_profiles to authenticated;

create or replace function public.set_self_marketing_opt_out(
  new_opt_out boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first'
      using errcode = 'P0001';
  end if;

  update public.profiles
  set
    marketing_opt_out = new_opt_out,
    marketing_opt_out_at = case
      when new_opt_out then coalesce(marketing_opt_out_at, now())
      else null
    end,
    updated_at = now()
  where user_id = auth.uid();

  if not found then
    raise exception 'Profile not found'
      using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.set_self_directory_opt_out(
  new_opt_out boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first'
      using errcode = 'P0001';
  end if;

  update public.profiles
  set
    directory_opt_out = new_opt_out,
    directory_opt_out_at = case
      when new_opt_out then coalesce(directory_opt_out_at, now())
      else null
    end,
    updated_at = now()
  where user_id = auth.uid();

  update public.vendor_listings
  set
    directory_opt_out = new_opt_out,
    directory_opt_out_at = case
      when new_opt_out then coalesce(directory_opt_out_at, now())
      else null
    end,
    is_approved = case when new_opt_out then false else is_approved end,
    updated_at = now()
  where user_id = auth.uid();
end;
$$;

create or replace function public.delete_my_zania_profile_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first'
      using errcode = 'P0001';
  end if;

  update public.profiles
  set
    full_name = 'Deleted user',
    partner_name = null,
    wedding_date = null,
    wedding_location = null,
    wedding_county = null,
    wedding_town = null,
    collaboration_code = null,
    company_name = null,
    company_email = null,
    company_phone = null,
    company_website = null,
    bio = null,
    specialties = '{}'::text[],
    avatar_url = null,
    committee_name = null,
    planner_verified = false,
    planner_verification_requested = false,
    planner_verification_requested_at = null,
    primary_county = null,
    primary_town = null,
    service_areas = '{}'::text[],
    travel_scope = 'selected_counties',
    minimum_budget_kes = null,
    maximum_budget_kes = null,
    marketing_opt_out = true,
    marketing_opt_out_at = coalesce(marketing_opt_out_at, now()),
    directory_opt_out = true,
    directory_opt_out_at = coalesce(directory_opt_out_at, now()),
    privacy_data_deleted_at = now(),
    updated_at = now()
  where user_id = auth.uid();

  update public.vendor_listings
  set
    business_name = 'Hidden vendor profile',
    description = null,
    phone = null,
    email = null,
    website = null,
    location = null,
    location_county = null,
    location_town = null,
    services = '{}'::text[],
    social_instagram = null,
    social_facebook = null,
    social_tiktok = null,
    social_twitter = null,
    service_areas = '{}'::text[],
    travel_scope = 'selected_counties',
    minimum_budget_kes = null,
    maximum_budget_kes = null,
    is_approved = false,
    is_verified = false,
    verification_requested = false,
    verification_requested_at = null,
    directory_opt_out = true,
    directory_opt_out_at = coalesce(directory_opt_out_at, now()),
    public_listing_note = 'Removed by vendor for privacy.',
    claim_contact_email = null,
    claim_token = null,
    claim_invited_at = null,
    claim_expires_at = null,
    updated_at = now()
  where user_id = auth.uid();
end;
$$;

revoke execute on function public.set_self_marketing_opt_out(boolean) from public, anon;
grant execute on function public.set_self_marketing_opt_out(boolean) to authenticated;

revoke execute on function public.set_self_directory_opt_out(boolean) from public, anon;
grant execute on function public.set_self_directory_opt_out(boolean) to authenticated;

revoke execute on function public.delete_my_zania_profile_data() from public, anon;
grant execute on function public.delete_my_zania_profile_data() to authenticated;
