-- Remove inherited PUBLIC execution from privileged functions while preserving
-- the access already available to signed-in clients and server-side code.
do $$
declare
  function_record record;
  function_signature text;
begin
  for function_record in
    select
      p.oid,
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) as identity_arguments,
      has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
      has_function_privilege('service_role', p.oid, 'execute') as service_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    function_signature := format(
      '%I.%I(%s)',
      function_record.nspname,
      function_record.proname,
      function_record.identity_arguments
    );

    execute format('revoke execute on function %s from public, anon', function_signature);

    if function_record.authenticated_execute then
      execute format('grant execute on function %s to authenticated', function_signature);
    end if;

    if function_record.service_execute then
      execute format('grant execute on function %s to service_role', function_signature);
    end if;
  end loop;
end;
$$;

-- Anonymous access is limited to deliberate public and token-scoped surfaces.
grant execute on function public.get_public_budget_estimate(integer, text, text, text, integer) to anon;
grant execute on function public.get_public_platform_stats() to anon;
grant execute on function public.get_shared_commercial_document(uuid) to anon;
grant execute on function public.get_shared_contributions_summary(uuid) to anon;
grant execute on function public.get_shared_professional_contract(uuid) to anon;
grant execute on function public.get_shared_timeline(uuid) to anon;
grant execute on function public.get_assignee_timeline(uuid) to anon;
grant execute on function public.public_rsvp_lookup(uuid) to anon;
grant execute on function public.public_rsvp_respond(uuid, text) to anon;
grant execute on function public.sign_shared_professional_contract(uuid, text, text, boolean, text, text, text) to anon;
grant execute on function public.get_vendor_listing_claim(uuid) to anon;
grant execute on function public.get_workspace_vendor_invite_claim(uuid) to anon;
grant execute on function public.get_vendor_reputation_overview(uuid, integer) to anon;
grant execute on function public.planner_profile_has_full_access(uuid) to anon;
grant execute on function public.vendor_listing_has_full_access(uuid) to anon;

-- Future functions must opt into client execution explicitly.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;
