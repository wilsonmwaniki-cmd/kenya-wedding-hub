alter table public.vendors
add column if not exists vendor_calendar_synced_at timestamptz null;

drop policy if exists "Vendors can view linked couple profiles for bookings" on public.profiles;
create policy "Vendors can view linked couple profiles for bookings"
on public.profiles
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.vendors v
    join public.vendor_listings vl on vl.id = v.vendor_listing_id
    where v.user_id = profiles.user_id
      and vl.user_id = auth.uid()
      and public.vendor_listing_has_full_access(vl.id)
  )
);

drop policy if exists "Vendors can view linked tasks" on public.tasks;
create policy "Vendors can view linked tasks"
on public.tasks
for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_linked_planner_of(user_id)
  or public.is_linked_couple_of(client_id)
  or exists (
    select 1
    from public.vendors v
    join public.vendor_listings vl on vl.id = v.vendor_listing_id
    where v.id = tasks.source_vendor_id
      and vl.user_id = auth.uid()
      and public.vendor_listing_has_full_access(vl.id)
  )
);

drop policy if exists "Vendors can view linked budget payments" on public.budget_payments;
create policy "Vendors can view linked budget payments"
on public.budget_payments
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.vendors v
    join public.vendor_listings vl on vl.id = v.vendor_listing_id
    where v.id = budget_payments.vendor_id
      and vl.user_id = auth.uid()
      and public.vendor_listing_has_full_access(vl.id)
  )
);

drop function if exists public.mark_vendor_booking_calendar_synced(uuid);
create function public.mark_vendor_booking_calendar_synced(target_vendor_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  synced_at timestamptz;
begin
  if not exists (
    select 1
    from public.vendors v
    join public.vendor_listings vl on vl.id = v.vendor_listing_id
    where v.id = target_vendor_id
      and vl.user_id = auth.uid()
      and public.vendor_listing_has_full_access(vl.id)
  ) then
    raise exception 'You do not have access to update this booking.';
  end if;

  update public.vendors
  set vendor_calendar_synced_at = now()
  where id = target_vendor_id
  returning vendor_calendar_synced_at into synced_at;

  return synced_at;
end;
$$;

grant execute on function public.mark_vendor_booking_calendar_synced(uuid) to authenticated;
