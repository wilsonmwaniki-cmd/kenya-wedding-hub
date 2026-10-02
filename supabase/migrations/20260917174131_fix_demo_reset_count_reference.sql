-- Qualify reset_count inside the table-returning function so PostgreSQL does
-- not confuse the column with the output parameter of the same name.
do $$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.reset_demo_session()'::regprocedure)
    into function_definition;

  if function_definition not like '%update public.demo_sessions%returning reset_count into next_reset_count%' then
    raise exception 'Expected demo reset update was not found';
  end if;

  function_definition := replace(
    function_definition,
    'update public.demo_sessions\n    set',
    'update public.demo_sessions as ds\n    set'
  );
  function_definition := replace(
    function_definition,
    'returning reset_count into next_reset_count',
    'returning ds.reset_count into next_reset_count'
  );
  execute function_definition;
end;
$$;
