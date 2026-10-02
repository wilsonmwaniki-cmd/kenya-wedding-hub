-- Demo documents use the same entitlement triggers as production documents.
-- Seed short-lived, demo-only entitlements so the normal editors remain usable
-- without weakening those triggers for permanent accounts.
do $$
declare
  function_definition text;
begin
  select pg_get_functiondef('private.clear_demo_workspace(uuid)'::regprocedure)
    into function_definition;

  if function_definition not like '%delete from public.professional_document_templates%' then
    raise exception 'Expected demo cleanup statement was not found';
  end if;

  function_definition := replace(
    function_definition,
    'delete from public.professional_document_templates where user_id = target_user_id;',
    E'delete from public.professional_document_templates where user_id = target_user_id;\n  delete from public.professional_entitlements where user_id = target_user_id;'
  );
  execute function_definition;

  select pg_get_functiondef('private.seed_demo_workspace(uuid,text)'::regprocedure)
    into function_definition;

  if function_definition not like '%perform private.clear_demo_workspace(target_user_id);%' then
    raise exception 'Expected demo seed setup statement was not found';
  end if;

  function_definition := replace(
    function_definition,
    'perform private.clear_demo_workspace(target_user_id);',
    E'perform private.clear_demo_workspace(target_user_id);\n\n  insert into public.professional_entitlements (\n    user_id, audience, feature_key, status, source_lookup_key,\n    source_bundle_code, effective_from, effective_to, metadata\n  )\n  select\n    target_user_id,\n    case when target_role = ''couple'' then ''vendor'' else target_role end,\n    feature_key,\n    ''active'',\n    ''demo_workspace'',\n    ''role_demo'',\n    now(),\n    now() + interval ''24 hours'',\n    jsonb_build_object(''demo'', true)\n  from unnest(array[\n    ''directory_listing'',\n    ''verified_listing'',\n    ''booking_management'',\n    ''document_collaboration'',\n    ''invoicing'',\n    ''contract_management'',\n    ''public_reputation'',\n    ''media_portfolio''\n  ]) as feature_key\n  on conflict (user_id, audience, feature_key) do update\n    set status = ''active'',\n        source_lookup_key = excluded.source_lookup_key,\n        source_bundle_code = excluded.source_bundle_code,\n        effective_from = excluded.effective_from,\n        effective_to = excluded.effective_to,\n        metadata = excluded.metadata;'
  );
  execute function_definition;
end;
$$;
