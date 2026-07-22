alter function public.can_manage_own_commercial_document(uuid, text)
  set search_path = public;

alter function public.can_access_own_commercial_document(uuid)
  set search_path = public;

revoke all on function public.has_active_professional_entitlement(uuid, text, text) from public;
grant execute on function public.has_active_professional_entitlement(uuid, text, text) to authenticated;

revoke all on function public.enforce_commercial_document_entitlement() from public;
revoke all on function public.enforce_commercial_document_child_entitlement() from public;
