-- Demo workspaces are intentionally excluded from every operational queue.
-- Their interest signal is retained privately as anonymous, aggregate-friendly activity.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.demo_activity_events (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null,
  demo_role text not null check (demo_role in ('couple', 'vendor', 'planner')),
  event_type text not null check (event_type in ('started', 'reset')),
  occurred_at timestamptz not null default now()
);

create unique index if not exists demo_activity_events_first_start_idx
  on private.demo_activity_events (visitor_id, event_type)
  where event_type = 'started';

create index if not exists demo_activity_events_occurred_at_idx
  on private.demo_activity_events (occurred_at desc);

-- Preserve the interest signal available today before expired demo accounts are purged.
insert into private.demo_activity_events (visitor_id, demo_role, event_type, occurred_at)
select ds.user_id, ds.demo_role, 'started', ds.started_at
from public.demo_sessions ds
on conflict do nothing;

create or replace function public.start_demo_session(target_role text)
returns table (demo_role text, destination_path text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  anonymous_claim boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if not anonymous_claim then raise exception 'Demo sessions require a temporary anonymous account'; end if;
  if target_role not in ('couple', 'vendor', 'planner') then raise exception 'Choose couple, vendor or planner'; end if;

  insert into public.demo_sessions (user_id, demo_role, status, started_at, expires_at, metadata)
  values (current_user_id, target_role, 'active', now(), now() + interval '24 hours', jsonb_build_object('version', 1))
  on conflict (user_id) do update
    set demo_role = excluded.demo_role,
        status = 'active',
        started_at = now(),
        expires_at = now() + interval '24 hours',
        last_reset_at = null,
        reset_count = 0,
        metadata = excluded.metadata;

  insert into private.demo_activity_events (visitor_id, demo_role, event_type)
  values (current_user_id, target_role, 'started')
  on conflict do nothing;

  perform private.seed_demo_workspace(current_user_id, target_role);

  return query select target_role,
    case target_role when 'couple' then '/dashboard' when 'vendor' then '/vendor-dashboard' else '/clients' end,
    now() + interval '24 hours';
end;
$$;

create or replace function public.reset_demo_session()
returns table (demo_role text, destination_path text, expires_at timestamptz, reset_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_role text;
  next_expiry timestamptz := now() + interval '24 hours';
  next_reset_count integer;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  select ds.demo_role into selected_role from public.demo_sessions ds
    where ds.user_id = current_user_id and ds.status = 'active' for update;
  if selected_role is null then raise exception 'Active demo session not found'; end if;

  perform private.seed_demo_workspace(current_user_id, selected_role);
  update public.demo_sessions
    set expires_at = next_expiry, last_reset_at = now(), reset_count = reset_count + 1
    where user_id = current_user_id
    returning reset_count into next_reset_count;

  insert into private.demo_activity_events (visitor_id, demo_role, event_type)
  values (current_user_id, selected_role, 'reset');

  return query select selected_role,
    case selected_role when 'couple' then '/dashboard' when 'vendor' then '/vendor-dashboard' else '/clients' end,
    next_expiry, next_reset_count;
end;
$$;

create or replace function public.admin_demo_activity_metrics()
returns table (
  total_demo_visitors bigint,
  demo_starts_last_7_days bigint,
  active_demo_sessions bigint,
  couple_demo_visitors bigint,
  vendor_demo_visitors bigint,
  planner_demo_visitors bigint,
  demo_resets bigint
)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform public.require_admin();

  return query
  select
    (select count(distinct visitor_id) from private.demo_activity_events where event_type = 'started'),
    (select count(distinct visitor_id) from private.demo_activity_events where event_type = 'started' and occurred_at >= now() - interval '7 days'),
    (select count(*) from public.demo_sessions where status = 'active' and expires_at > now()),
    (select count(distinct visitor_id) from private.demo_activity_events where event_type = 'started' and demo_role = 'couple'),
    (select count(distinct visitor_id) from private.demo_activity_events where event_type = 'started' and demo_role = 'vendor'),
    (select count(distinct visitor_id) from private.demo_activity_events where event_type = 'started' and demo_role = 'planner'),
    (select count(*) from private.demo_activity_events where event_type = 'reset');
end;
$$;

revoke all on function public.admin_demo_activity_metrics() from public, anon;
grant execute on function public.admin_demo_activity_metrics() to authenticated;

drop function if exists public.admin_list_vendor_listings(text, text, integer, integer);
create function public.admin_list_vendor_listings(
  search_query text default null,
  status_filter text default 'all',
  limit_rows integer default 100,
  offset_rows integer default 0
)
returns table (
  listing_id uuid, user_id uuid, business_name text, category text, location text,
  is_approved boolean, is_verified boolean, verification_requested boolean,
  verification_requested_at timestamptz, subscription_status text,
  subscription_expires_at timestamptz, updated_at timestamptz, owner_name text,
  owner_email text, profile_kind text, public_listing_note text, featured_rank integer,
  claim_contact_email text, claim_invited_at timestamptz, claim_expires_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_admin();
  return query
  select v.id, v.user_id, v.business_name::text, v.category::text, v.location::text,
    v.is_approved, v.is_verified, v.verification_requested, v.verification_requested_at,
    v.subscription_status::text, v.subscription_expires_at, v.updated_at::timestamptz,
    p.full_name::text, u.email::text, v.profile_kind::text, v.public_listing_note::text,
    v.featured_rank, v.claim_contact_email::text, v.claim_invited_at, v.claim_expires_at
  from public.vendor_listings v
  left join public.profiles p on p.user_id = v.user_id
  left join auth.users u on u.id = v.user_id
  where (v.user_id is null or not coalesce(p.is_demo, false))
    and (status_filter = 'all'
      or (status_filter = 'pending' and v.is_approved = false)
      or (status_filter = 'approved' and v.is_approved = true)
      or (status_filter = 'claimed' and v.profile_kind = 'claimed')
      or (status_filter = 'curated' and v.profile_kind = 'curated')
      or (status_filter = 'featured' and v.profile_kind = 'featured'))
    and (search_query is null
      or v.business_name ilike '%' || search_query || '%'
      or v.category ilike '%' || search_query || '%'
      or coalesce(v.location, '') ilike '%' || search_query || '%'
      or coalesce(p.full_name, '') ilike '%' || search_query || '%'
      or coalesce(u.email, '') ilike '%' || search_query || '%'
      or coalesce(v.claim_contact_email, '') ilike '%' || search_query || '%')
  order by v.featured_rank desc, v.updated_at desc
  limit greatest(1, least(limit_rows, 200)) offset greatest(0, offset_rows);
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
  profile_id uuid, user_id uuid, full_name text, company_name text, company_email text,
  planner_type text, committee_name text, planner_verified boolean,
  planner_verification_requested boolean, planner_verification_requested_at timestamptz,
  planner_subscription_status text, planner_subscription_expires_at timestamptz,
  updated_at timestamptz, founding_planner_contributor boolean
)
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_admin();
  return query
  select p.id, p.user_id, p.full_name, p.company_name, p.company_email,
    coalesce(p.planner_type, 'professional')::text, p.committee_name, p.planner_verified,
    p.planner_verification_requested, p.planner_verification_requested_at,
    p.planner_subscription_status::text, p.planner_subscription_expires_at, p.updated_at,
    p.founding_planner_contributor
  from public.profiles p
  where p.role = 'planner'::public.app_role
    and not coalesce(p.is_demo, false)
    and (search_query is null
      or p.full_name ilike '%' || search_query || '%'
      or p.company_name ilike '%' || search_query || '%'
      or p.company_email ilike '%' || search_query || '%'
      or p.committee_name ilike '%' || search_query || '%')
    and (verification_filter = 'all'
      or (verification_filter = 'requested' and p.planner_verification_requested = true and p.planner_verified = false)
      or (verification_filter = 'pending' and p.planner_verified = false)
      or (verification_filter = 'verified' and p.planner_verified = true)
      or (verification_filter = 'founding' and p.founding_planner_contributor = true))
  order by p.updated_at desc
  limit greatest(1, least(limit_rows, 200)) offset greatest(0, offset_rows);
end;
$$;

revoke execute on function public.admin_list_vendor_listings(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_vendor_listings(text, text, integer, integer) to authenticated;
revoke execute on function public.admin_list_planner_profiles(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_planner_profiles(text, text, integer, integer) to authenticated;
