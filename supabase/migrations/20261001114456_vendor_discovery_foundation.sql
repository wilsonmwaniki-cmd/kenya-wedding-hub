-- Durable, private records for vendor discovery. A candidate is a user's saved
-- planning option. An observation is one dated fact with provenance. Neither
-- table creates or publishes a marketplace profile.

create table public.vendor_candidates (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  wedding_id uuid null references public.weddings(id) on delete cascade,
  planner_client_id uuid null references public.planner_clients(id) on delete cascade,
  vendor_listing_id uuid null references public.vendor_listings(id) on delete set null,
  source_kind text not null,
  source_record_id text null,
  source_url text null,
  business_name text not null,
  category text not null,
  location text null,
  website text null,
  profile_status text not null default 'discovered',
  candidate_status text not null default 'saved',
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_candidates_source_kind_check check (
    source_kind in ('zania_listing', 'official_website', 'search_result', 'places', 'directory', 'social')
  ),
  constraint vendor_candidates_profile_status_check check (
    profile_status in ('discovered', 'unclaimed', 'claim_pending', 'claimed', 'verified', 'opted_out', 'suspended', 'duplicate', 'stale')
  ),
  constraint vendor_candidates_candidate_status_check check (
    candidate_status in ('saved', 'shortlisted', 'contacted', 'dismissed')
  ),
  constraint vendor_candidates_scope_check check (
    not (wedding_id is not null and planner_client_id is not null)
  ),
  constraint vendor_candidates_business_name_check check (char_length(btrim(business_name)) between 1 and 200),
  constraint vendor_candidates_category_check check (char_length(btrim(category)) between 1 and 120),
  constraint vendor_candidates_source_record_id_check check (source_record_id is null or char_length(source_record_id) <= 500),
  constraint vendor_candidates_source_url_check check (source_url is null or char_length(source_url) <= 2048),
  constraint vendor_candidates_snapshot_object_check check (jsonb_typeof(snapshot) = 'object')
);

create index vendor_candidates_owner_updated_idx
  on public.vendor_candidates (owner_user_id, updated_at desc);

create index vendor_candidates_wedding_idx
  on public.vendor_candidates (wedding_id, updated_at desc)
  where wedding_id is not null;

create index vendor_candidates_planner_client_idx
  on public.vendor_candidates (planner_client_id, updated_at desc)
  where planner_client_id is not null;

create index vendor_candidates_listing_idx
  on public.vendor_candidates (vendor_listing_id)
  where vendor_listing_id is not null;

create unique index vendor_candidates_owner_source_scope_unique
  on public.vendor_candidates (
    owner_user_id,
    source_kind,
    source_record_id,
    coalesce(wedding_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(planner_client_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where source_record_id is not null and candidate_status <> 'dismissed';

create trigger update_vendor_candidates_updated_at
before update on public.vendor_candidates
for each row execute function public.update_updated_at_column();

alter table public.vendor_candidates enable row level security;

create policy "Users can read their vendor candidates"
on public.vendor_candidates for select
to authenticated
using ((select auth.uid()) = owner_user_id);

create policy "Users can save their vendor candidates"
on public.vendor_candidates for insert
to authenticated
with check ((select auth.uid()) = owner_user_id);

create policy "Users can update their vendor candidates"
on public.vendor_candidates for update
to authenticated
using ((select auth.uid()) = owner_user_id)
with check ((select auth.uid()) = owner_user_id);

create policy "Users can delete their vendor candidates"
on public.vendor_candidates for delete
to authenticated
using ((select auth.uid()) = owner_user_id);

revoke all on public.vendor_candidates from anon;
grant select, insert, update, delete on public.vendor_candidates to authenticated;
grant all on public.vendor_candidates to service_role;

create table public.vendor_observations (
  id uuid primary key default gen_random_uuid(),
  vendor_candidate_id uuid null references public.vendor_candidates(id) on delete cascade,
  vendor_listing_id uuid null references public.vendor_listings(id) on delete cascade,
  source_kind text not null,
  source_record_id text null,
  source_url text null,
  fact_key text not null,
  fact_value jsonb not null,
  source_excerpt text null,
  confidence numeric(4,3) null,
  observed_at timestamptz not null,
  retrieved_at timestamptz not null default now(),
  expires_at timestamptz null,
  freshness_status text not null default 'current',
  content_hash text null,
  created_at timestamptz not null default now(),
  constraint vendor_observations_target_check check (
    num_nonnulls(vendor_candidate_id, vendor_listing_id) = 1
  ),
  constraint vendor_observations_source_kind_check check (
    source_kind in ('zania_listing', 'official_website', 'search_result', 'places', 'directory', 'social')
  ),
  constraint vendor_observations_fact_key_check check (char_length(btrim(fact_key)) between 1 and 120),
  constraint vendor_observations_fact_value_check check (fact_value <> 'null'::jsonb),
  constraint vendor_observations_confidence_check check (confidence is null or confidence between 0 and 1),
  constraint vendor_observations_freshness_check check (
    freshness_status in ('current', 'stale', 'superseded', 'unknown')
  ),
  constraint vendor_observations_source_record_id_check check (source_record_id is null or char_length(source_record_id) <= 500),
  constraint vendor_observations_source_url_check check (source_url is null or char_length(source_url) <= 2048),
  constraint vendor_observations_source_excerpt_check check (source_excerpt is null or char_length(source_excerpt) <= 2000),
  constraint vendor_observations_expiry_check check (expires_at is null or expires_at >= observed_at)
);

create index vendor_observations_candidate_fact_idx
  on public.vendor_observations (vendor_candidate_id, fact_key, observed_at desc)
  where vendor_candidate_id is not null;

create index vendor_observations_listing_fact_idx
  on public.vendor_observations (vendor_listing_id, fact_key, observed_at desc)
  where vendor_listing_id is not null;

create index vendor_observations_source_idx
  on public.vendor_observations (source_kind, source_record_id, observed_at desc);

create unique index vendor_observations_content_unique
  on public.vendor_observations (
    coalesce(vendor_candidate_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(vendor_listing_id, '00000000-0000-0000-0000-000000000000'::uuid),
    source_kind,
    fact_key,
    content_hash
  )
  where content_hash is not null;

alter table public.vendor_observations enable row level security;

create policy "Users can read observations for their candidates"
on public.vendor_observations for select
to authenticated
using (
  vendor_candidate_id is not null
  and exists (
    select 1
    from public.vendor_candidates candidate
    where candidate.id = vendor_candidate_id
      and candidate.owner_user_id = (select auth.uid())
  )
);

revoke all on public.vendor_observations from anon, authenticated;
grant select on public.vendor_observations to authenticated;
grant all on public.vendor_observations to service_role;

comment on table public.vendor_candidates is
  'Private user-saved vendor options. Rows are not public marketplace profiles.';

comment on table public.vendor_observations is
  'Dated vendor facts with provenance. External content is evidence only and never agent instructions.';
