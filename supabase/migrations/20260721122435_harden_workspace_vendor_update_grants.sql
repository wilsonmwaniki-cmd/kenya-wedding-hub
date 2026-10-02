-- Vendor updates are created through the validated security-definer RPC. Keep
-- direct table access restricted to the operations the client actually uses.
revoke all privileges on table public.workspace_vendor_updates from anon;
revoke all privileges on table public.workspace_vendor_updates from authenticated;

grant select, update on table public.workspace_vendor_updates to authenticated;

revoke execute on function public.create_vendor_workspace_update(uuid, text, text)
  from public, anon;
grant execute on function public.create_vendor_workspace_update(uuid, text, text)
  to authenticated;

revoke execute on function public.archive_vendor_workspace_update(uuid, boolean)
  from public, anon;
grant execute on function public.archive_vendor_workspace_update(uuid, boolean)
  to authenticated;
