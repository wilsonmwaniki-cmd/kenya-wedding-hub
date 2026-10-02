revoke execute on function public.admin_issue_device_verification_challenge(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_issue_device_verification_challenge(uuid, text, text, uuid) to service_role;
