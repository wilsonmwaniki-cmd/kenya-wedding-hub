-- These helpers are invoked only by privileged wrapper functions, triggers, or
-- one-time migrations. Signed-in clients should not call them through RPC.
revoke execute on function public.append_professional_contract_event(uuid, text, text, text, text, jsonb) from authenticated;
revoke execute on function public.assert_current_auth_session_active() from authenticated;
revoke execute on function public.assert_wedding_feature_enabled(uuid, text, text) from authenticated;
revoke execute on function public.current_user_primary_owned_wedding_id() from authenticated;
revoke execute on function public.primary_owned_wedding_id(uuid) from authenticated;
revoke execute on function public.generate_next_commercial_document_number(uuid, text, date) from authenticated;
revoke execute on function public.recalculate_commercial_document_totals(uuid) from authenticated;
revoke execute on function public.lock_planner_free_wedding_slot(uuid) from authenticated;
revoke execute on function public.log_public_token_access(text, uuid, text, text, jsonb) from authenticated;
revoke execute on function public.rls_auto_enable() from authenticated;
revoke execute on function public.seed_professional_contract_created_events() from authenticated;
revoke execute on function public.sync_professional_contract_completion_event(uuid) from authenticated;
revoke execute on function public.trust_current_device_session(text, text, text, text, text) from authenticated;
revoke execute on function public.upsert_wedding_lifecycle_history(uuid) from authenticated;

-- New functions must explicitly declare whether signed-in clients may call them.
alter default privileges for role postgres in schema public
  revoke execute on functions from authenticated;
