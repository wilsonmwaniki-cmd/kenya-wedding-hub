-- The public directory should expose only its curated projection, never every
-- column on a planner's profile row.
revoke select on table public.profiles from anon;

grant select (
  id,
  user_id,
  full_name,
  company_name,
  avatar_url,
  bio,
  specialties,
  company_email,
  company_phone,
  company_website,
  primary_county,
  primary_town,
  service_areas,
  travel_scope,
  minimum_budget_kes,
  maximum_budget_kes,
  founding_planner_contributor,
  role,
  planner_verified,
  directory_opt_out,
  planner_subscription_status,
  planner_subscription_expires_at,
  beta_trial_status,
  beta_trial_expires_at
) on table public.profiles to anon;

alter view public.public_planner_profiles
set (security_invoker = true);

-- Admin functions validate the caller with require_admin(), but they should
-- still be unreachable before authentication.
do $$
declare
  function_signature text;
begin
  for function_signature in
    select format(
      '%I.%I(%s)',
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid)
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'admin\_%' escape '\'
  loop
    execute format('revoke execute on function %s from public, anon', function_signature);
    execute format('grant execute on function %s to authenticated', function_signature);
  end loop;
end;
$$;

-- Trigger functions execute through their triggers and are not client RPCs.
do $$
declare
  function_signature text;
begin
  for function_signature in
    select format(
      '%I.%I(%s)',
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid)
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype = 'pg_catalog.trigger'::regtype
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      function_signature
    );
  end loop;
end;
$$;

-- Accepting a wedding invite requires a signed-in recipient.
revoke execute on function public.accept_wedding_invite(uuid) from public, anon;
grant execute on function public.accept_wedding_invite(uuid) to authenticated;

-- Authorization helpers are internal implementation details, not public RPCs.
revoke execute on function public.require_admin() from public, anon;
revoke execute on function public.require_planner_or_admin() from public, anon;
