-- Repair legacy functions that no longer compile cleanly against the current
-- schema. Each replacement is guarded so schema drift fails the migration
-- instead of silently leaving a partially repaired function behind.

do $migration$
declare
  original_definition text;
  repaired_definition text;
begin
  select pg_get_functiondef(
    'public.upsert_committee_invite(uuid,text,text)'::regprocedure
  ) into original_definition;

  repaired_definition := replace(
    original_definition,
    E'  update public.wedding_invites\n  set status = \'revoked\',\n      updated_at = now()\n  where wedding_id = target_wedding_id\n    and lower(email) = normalized_committee_email\n    and invite_type = \'committee\'\n    and status = \'pending\';',
    E'  update public.wedding_invites wi\n  set status = \'revoked\',\n      updated_at = now()\n  where wi.wedding_id = target_wedding_id\n    and lower(wi.email) = normalized_committee_email\n    and wi.invite_type = \'committee\'\n    and wi.status = \'pending\';'
  );

  if repaired_definition = original_definition then
    raise exception 'Expected upsert_committee_invite definition was not found';
  end if;

  execute repaired_definition;
end;
$migration$;

do $migration$
declare
  original_definition text;
  repaired_definition text;
begin
  select pg_get_functiondef(
    'public.get_planner_free_wedding_status()'::regprocedure
  ) into original_definition;

  repaired_definition := replace(
    original_definition,
    E'  from public.planner_free_wedding_entitlements\n  where planner_user_id = auth.uid();',
    E'  from public.planner_free_wedding_entitlements pfwe\n  where pfwe.planner_user_id = auth.uid();'
  );

  if repaired_definition = original_definition then
    raise exception 'Expected get_planner_free_wedding_status definition was not found';
  end if;

  execute repaired_definition;
end;
$migration$;

do $migration$
declare
  original_definition text;
  repaired_definition text;
begin
  select pg_get_functiondef(
    'public.get_shared_contributions_summary(uuid)'::regprocedure
  ) into original_definition;

  repaired_definition := replace(
    original_definition,
    E'    p.wedding_name,\n    p.full_name',
    E'    case\n      when nullif(trim(p.full_name), \'\') is not null\n        and nullif(trim(p.partner_name), \'\') is not null\n        then trim(p.full_name) || \' & \' || trim(p.partner_name) || \' Wedding\'\n      when nullif(trim(p.full_name), \'\') is not null\n        then trim(p.full_name) || \' Wedding\'\n      else null\n    end as wedding_name,\n    p.full_name'
  );

  if repaired_definition = original_definition then
    raise exception 'Expected get_shared_contributions_summary definition was not found';
  end if;

  execute repaired_definition;
end;
$migration$;

do $migration$
declare
  original_definition text;
  repaired_definition text;
begin
  select pg_get_functiondef(
    'public.get_shared_commercial_document(uuid)'::regprocedure
  ) into original_definition;

  repaired_definition := replace(
    original_definition,
    E'      vl.primary_county,\n      vl.primary_town',
    E'      vl.location_county as primary_county,\n      vl.location_town as primary_town'
  );

  if repaired_definition = original_definition then
    raise exception 'Expected get_shared_commercial_document definition was not found';
  end if;

  execute repaired_definition;
end;
$migration$;

do $migration$
declare
  original_definition text;
  repaired_definition text;
begin
  select pg_get_functiondef(
    'public.get_shared_professional_contract(uuid)'::regprocedure
  ) into original_definition;

  repaired_definition := replace(
    original_definition,
    E'    select\n      business_name,\n      email,\n      phone,\n      website,\n      primary_county,\n      primary_town\n    into _listing\n    from public.vendor_listings\n    where id = _contract.vendor_listing_id;',
    E'    select\n      vl.business_name,\n      vl.email,\n      vl.phone,\n      vl.website,\n      vl.location_county as primary_county,\n      vl.location_town as primary_town\n    into _listing\n    from public.vendor_listings vl\n    where vl.id = _contract.vendor_listing_id;'
  );

  if repaired_definition = original_definition then
    raise exception 'Expected get_shared_professional_contract definition was not found';
  end if;

  execute repaired_definition;
end;
$migration$;
