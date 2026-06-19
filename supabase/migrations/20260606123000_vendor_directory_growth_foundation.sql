alter table public.profiles
  add column if not exists founding_planner_contributor boolean not null default false;

alter table public.vendor_listings
  add column if not exists profile_kind text not null default 'claimed',
  add column if not exists public_listing_note text,
  add column if not exists claimed_at timestamp with time zone,
  add column if not exists featured_rank integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vendor_listings_profile_kind_check'
  ) then
    alter table public.vendor_listings
      add constraint vendor_listings_profile_kind_check
      check (profile_kind in ('claimed', 'curated', 'featured'));
  end if;
end $$;

update public.vendor_listings
set
  profile_kind = case
    when profile_kind in ('claimed', 'curated', 'featured') then profile_kind
    else 'claimed'
  end,
  claimed_at = coalesce(claimed_at, created_at)
where user_id is not null;

create table if not exists public.vendor_planner_recommendations (
  id uuid primary key default gen_random_uuid(),
  vendor_listing_id uuid not null references public.vendor_listings(id) on delete cascade,
  planner_user_id uuid not null references auth.users(id) on delete cascade,
  planner_public_name text not null,
  planner_company_name text,
  planner_is_founding boolean not null default false,
  recommendation_note text,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (vendor_listing_id, planner_user_id)
);

alter table public.vendor_planner_recommendations enable row level security;

drop policy if exists "Public can view active vendor planner recommendations" on public.vendor_planner_recommendations;
create policy "Public can view active vendor planner recommendations"
on public.vendor_planner_recommendations
for select
using (active = true);

drop policy if exists "Planner or admin can insert vendor recommendations" on public.vendor_planner_recommendations;
create policy "Planner or admin can insert vendor recommendations"
on public.vendor_planner_recommendations
for insert
to authenticated
with check (
  auth.uid() = planner_user_id
  and exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        (p.role = 'planner'::public.app_role and p.founding_planner_contributor = true)
        or p.role = 'admin'::public.app_role
      )
  )
);

drop policy if exists "Planner or admin can update vendor recommendations" on public.vendor_planner_recommendations;
create policy "Planner or admin can update vendor recommendations"
on public.vendor_planner_recommendations
for update
to authenticated
using (
  auth.uid() = planner_user_id
  and exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        (p.role = 'planner'::public.app_role and p.founding_planner_contributor = true)
        or p.role = 'admin'::public.app_role
      )
  )
)
with check (
  auth.uid() = planner_user_id
  and exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        (p.role = 'planner'::public.app_role and p.founding_planner_contributor = true)
        or p.role = 'admin'::public.app_role
      )
  )
);

drop trigger if exists update_vendor_planner_recommendations_updated_at on public.vendor_planner_recommendations;
create trigger update_vendor_planner_recommendations_updated_at
before update on public.vendor_planner_recommendations
for each row
execute function public.update_updated_at_column();

create table if not exists public.vendor_suggestions (
  id uuid primary key default gen_random_uuid(),
  suggested_by_user_id uuid references auth.users(id) on delete set null,
  suggester_role text,
  vendor_name text not null,
  category text not null,
  instagram_or_website text,
  location text,
  recommendation_reason text not null,
  status text not null default 'pending',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.vendor_suggestions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vendor_suggestions_status_check'
  ) then
    alter table public.vendor_suggestions
      add constraint vendor_suggestions_status_check
      check (status in ('pending', 'reviewed', 'converted', 'rejected'));
  end if;
end $$;

drop policy if exists "Authenticated users can submit vendor suggestions" on public.vendor_suggestions;
create policy "Authenticated users can submit vendor suggestions"
on public.vendor_suggestions
for insert
to authenticated
with check (
  suggested_by_user_id = auth.uid()
);

drop policy if exists "Admins can read vendor suggestions" on public.vendor_suggestions;
create policy "Admins can read vendor suggestions"
on public.vendor_suggestions
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'::public.app_role
  )
);

drop trigger if exists update_vendor_suggestions_updated_at on public.vendor_suggestions;
create trigger update_vendor_suggestions_updated_at
before update on public.vendor_suggestions
for each row
execute function public.update_updated_at_column();

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
