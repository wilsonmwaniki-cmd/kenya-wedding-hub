alter table public.professional_network_relationships
  add column if not exists target_acknowledged boolean not null default false,
  add column if not exists target_acknowledged_at timestamptz null;

drop policy if exists "Authors can update professional relationships" on public.professional_network_relationships;
drop policy if exists "Participants can update professional relationships" on public.professional_network_relationships;
create policy "Participants can update professional relationships"
on public.professional_network_relationships
for update
to authenticated
using (
  source_user_id = auth.uid()
  or target_user_id = auth.uid()
  or exists (
    select 1
    from public.vendor_listings vl
    where vl.id = target_vendor_listing_id
      and vl.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'::public.app_role
  )
)
with check (
  source_user_id = auth.uid()
  or target_user_id = auth.uid()
  or exists (
    select 1
    from public.vendor_listings vl
    where vl.id = target_vendor_listing_id
      and vl.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'::public.app_role
  )
);
