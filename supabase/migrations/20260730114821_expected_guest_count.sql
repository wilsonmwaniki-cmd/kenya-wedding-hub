alter table public.profiles
  add column if not exists expected_guest_count integer null
  check (expected_guest_count is null or expected_guest_count > 0);

alter table public.planner_clients
  add column if not exists expected_guest_count integer null
  check (expected_guest_count is null or expected_guest_count > 0);
