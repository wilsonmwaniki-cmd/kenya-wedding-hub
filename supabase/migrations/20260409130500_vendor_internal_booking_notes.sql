alter table public.vendors
add column if not exists vendor_internal_notes text null;

drop function if exists public.update_vendor_booking_internal_notes(uuid, text);
create function public.update_vendor_booking_internal_notes(
  target_vendor_id uuid,
  internal_notes_input text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_notes text;
begin
  if not exists (
    select 1
    from public.vendors v
    join public.vendor_listings vl on vl.id = v.vendor_listing_id
    where v.id = target_vendor_id
      and vl.user_id = auth.uid()
      and public.vendor_listing_has_full_access(vl.id)
  ) then
    raise exception 'You do not have access to update private notes for this booking.';
  end if;

  update public.vendors
  set vendor_internal_notes = nullif(trim(internal_notes_input), '')
  where id = target_vendor_id
  returning vendor_internal_notes into saved_notes;

  return saved_notes;
end;
$$;

grant execute on function public.update_vendor_booking_internal_notes(uuid, text) to authenticated;
