create or replace function public.get_shared_commercial_document_v2(_share_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _document jsonb;
  _metadata jsonb;
begin
  _document := public.get_shared_commercial_document(_share_token);

  if _document is null then
    return null;
  end if;

  select coalesce(cd.metadata, '{}'::jsonb)
    into _metadata
  from public.commercial_documents cd
  where cd.id = (_document ->> 'id')::uuid;

  return _document || jsonb_build_object(
    'paymentInstructions', nullif(trim(_metadata ->> 'paymentInstructions'), ''),
    'authorisedBy', nullif(trim(_metadata ->> 'authorisedBy'), '')
  );
end;
$$;

revoke execute on function public.get_shared_commercial_document_v2(uuid) from public;
revoke execute on function public.get_shared_commercial_document_v2(uuid) from anon, authenticated;
grant execute on function public.get_shared_commercial_document_v2(uuid) to anon, authenticated;
