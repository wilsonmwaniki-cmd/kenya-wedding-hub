drop policy if exists "Workspace events remain internal" on public.workspace_events;
create policy "Workspace events remain internal"
on public.workspace_events
for select
to authenticated
using (false);
