create or replace function public.is_active_auth_session(
  target_session_id uuid,
  target_user_id uuid
)
returns boolean
language sql
security definer
set search_path = auth, public
as $$
  select exists (
    select 1
    from auth.sessions sessions
    where sessions.id = target_session_id
      and sessions.user_id = target_user_id
      and (
        sessions.not_after is null
        or sessions.not_after > now()
      )
  );
$$;

revoke execute on function public.is_active_auth_session(uuid, uuid) from public, anon;
grant execute on function public.is_active_auth_session(uuid, uuid) to service_role;

create or replace function public.assert_current_auth_session_active()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  current_session_id_text text := nullif(auth.jwt() ->> 'session_id', '');
  current_session_id uuid;
begin
  if current_user_id is null then
    raise exception 'Sign in first'
      using errcode = 'P0001';
  end if;

  if current_session_id_text is null
     or current_session_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Your session has expired. Please sign in again.'
      using errcode = 'P0001';
  end if;

  current_session_id := current_session_id_text::uuid;

  if not public.is_active_auth_session(current_session_id, current_user_id) then
    raise exception 'Your session has expired. Please sign in again.'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.assert_current_auth_session_active() from public, anon;
grant execute on function public.assert_current_auth_session_active() to authenticated, service_role;

create or replace function public.set_self_marketing_opt_out(
  new_opt_out boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_current_auth_session_active();

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
  perform public.assert_current_auth_session_active();

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
  perform public.assert_current_auth_session_active();

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
