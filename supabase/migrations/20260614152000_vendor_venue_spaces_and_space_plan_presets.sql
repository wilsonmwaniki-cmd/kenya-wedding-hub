create table if not exists public.vendor_listing_spaces (
  id uuid primary key default gen_random_uuid(),
  vendor_listing_id uuid not null references public.vendor_listings(id) on delete cascade,
  space_name text not null,
  space_type text not null default 'Reception hall',
  width_meters numeric(8,2) not null check (width_meters > 0),
  length_meters numeric(8,2) not null check (length_meters > 0),
  max_seated_capacity integer null check (max_seated_capacity is null or max_seated_capacity > 0),
  max_standing_capacity integer null check (max_standing_capacity is null or max_standing_capacity > 0),
  recommended_guest_count integer null check (recommended_guest_count is null or recommended_guest_count > 0),
  location_notes text null,
  setup_notes text null,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendor_listing_spaces_vendor_listing_id_idx
  on public.vendor_listing_spaces (vendor_listing_id, is_active desc, is_featured desc, sort_order asc, created_at asc);

create index if not exists vendor_listing_spaces_active_idx
  on public.vendor_listing_spaces (is_active, is_featured desc);

drop trigger if exists update_vendor_listing_spaces_updated_at on public.vendor_listing_spaces;
create trigger update_vendor_listing_spaces_updated_at
before update on public.vendor_listing_spaces
for each row execute function public.update_updated_at_column();

alter table public.vendor_listing_spaces enable row level security;

drop policy if exists "Authenticated users can view public venue spaces" on public.vendor_listing_spaces;
create policy "Authenticated users can view public venue spaces"
on public.vendor_listing_spaces
for select
to authenticated
using (
  exists (
    select 1
    from public.vendor_listings vl
    where vl.id = vendor_listing_id
      and (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        or vl.user_id = auth.uid()
        or (is_active and vl.is_approved)
      )
  )
);

drop policy if exists "Venue owners can insert own venue spaces" on public.vendor_listing_spaces;
create policy "Venue owners can insert own venue spaces"
on public.vendor_listing_spaces
for insert
to authenticated
with check (
  exists (
    select 1
    from public.vendor_listings vl
    where vl.id = vendor_listing_id
      and (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        or vl.user_id = auth.uid()
      )
  )
);

drop policy if exists "Venue owners can update own venue spaces" on public.vendor_listing_spaces;
create policy "Venue owners can update own venue spaces"
on public.vendor_listing_spaces
for update
to authenticated
using (
  exists (
    select 1
    from public.vendor_listings vl
    where vl.id = vendor_listing_id
      and (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        or vl.user_id = auth.uid()
      )
  )
)
with check (
  exists (
    select 1
    from public.vendor_listings vl
    where vl.id = vendor_listing_id
      and (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        or vl.user_id = auth.uid()
      )
  )
);

drop policy if exists "Venue owners can delete own venue spaces" on public.vendor_listing_spaces;
create policy "Venue owners can delete own venue spaces"
on public.vendor_listing_spaces
for delete
to authenticated
using (
  exists (
    select 1
    from public.vendor_listings vl
    where vl.id = vendor_listing_id
      and (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        or vl.user_id = auth.uid()
      )
  )
);

grant select, insert, update, delete on public.vendor_listing_spaces to authenticated;

alter table public.wedding_space_plans
  add column if not exists venue_listing_id uuid null references public.vendor_listings(id) on delete set null,
  add column if not exists venue_space_id uuid null references public.vendor_listing_spaces(id) on delete set null;

create index if not exists wedding_space_plans_venue_listing_id_idx
  on public.wedding_space_plans (venue_listing_id);

create index if not exists wedding_space_plans_venue_space_id_idx
  on public.wedding_space_plans (venue_space_id);
