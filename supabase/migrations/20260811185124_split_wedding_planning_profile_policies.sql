drop policy if exists "Wedding owners can manage planning profiles"
on public.wedding_planning_profiles;
drop policy if exists "Wedding owners can create planning profiles"
on public.wedding_planning_profiles;
drop policy if exists "Wedding owners can update planning profiles"
on public.wedding_planning_profiles;
drop policy if exists "Wedding owners can delete planning profiles"
on public.wedding_planning_profiles;
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
