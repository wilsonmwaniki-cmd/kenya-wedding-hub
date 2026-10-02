-- A professional demo uses the vendors table as a lightweight client pipeline.
-- Keep only one final choice per category/scope to satisfy the canonical vendor
-- uniqueness guard; other example clients remain editable pipeline records.
do $$
declare
  function_definition text;
  old_fragment text := '''Wanjiru & Mark'', ''Photography'', ''+254711100003'', ''wanjiru@example.invalid'', 165000, ''final'', ''booked''';
  new_fragment text := '''Wanjiru & Mark'', ''Photography'', ''+254711100003'', ''wanjiru@example.invalid'', 165000, ''shortlisted'', ''booked''';
begin
  select pg_get_functiondef('private.seed_demo_workspace(uuid,text)'::regprocedure)
    into function_definition;

  if position(old_fragment in function_definition) = 0 then
    raise exception 'Expected professional demo pipeline row was not found';
  end if;

  execute replace(function_definition, old_fragment, new_fragment);
end;
$$;
