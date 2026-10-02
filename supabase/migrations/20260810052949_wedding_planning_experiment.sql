create table public.wedding_planning_profiles (
  wedding_id uuid primary key references public.weddings(id) on delete cascade,
  estimated_budget numeric not null check (estimated_budget >= 0),
  estimated_guest_count integer not null check (estimated_guest_count >= 0),
  wedding_type text not null check (wedding_type in ('traditional', 'civil', 'church', 'garden', 'destination', 'other')),
  top_priorities text[] not null default '{}'::text[] check (cardinality(top_priorities) <= 3),
  booked_categories text[] not null default '{}'::text[],
  primary_next_action jsonb not null default '{}'::jsonb,
  secondary_actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.wedding_planning_profiles enable row level security;
create policy "Wedding members can view planning profiles"
on public.wedding_planning_profiles for select
to authenticated
using (public.is_wedding_member(wedding_id) or public.can_manage_wedding_memberships(wedding_id));
create policy "Wedding owners can create planning profiles"
on public.wedding_planning_profiles for insert
to authenticated
with check (public.can_manage_wedding_memberships(wedding_id));
create policy "Wedding owners can update planning profiles"
on public.wedding_planning_profiles for update
to authenticated
using (public.can_manage_wedding_memberships(wedding_id))
with check (public.can_manage_wedding_memberships(wedding_id));
create policy "Wedding owners can delete planning profiles"
on public.wedding_planning_profiles for delete
to authenticated
using (public.can_manage_wedding_memberships(wedding_id));
create trigger set_wedding_planning_profiles_updated_at
before update on public.wedding_planning_profiles
for each row execute function public.update_updated_at_column();
