-- A later private-schema hardening migration intentionally removed schema
-- usage from authenticated users. These public wrappers were still SECURITY
-- INVOKER, so PostgREST callers could no longer resolve their private
-- implementations. Keep the private schema closed and let the narrow public
-- wrappers run with their owner privileges instead. The private functions
-- continue to authorize and filter with auth.uid().

create or replace function public.list_received_documents()
returns table (
  id uuid,
  document_type text,
  document_number text,
  title text,
  status text,
  currency text,
  total_amount numeric,
  updated_at timestamptz,
  share_token uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.list_received_documents();
$$;

revoke all on function public.list_received_documents() from public, anon;
grant execute on function public.list_received_documents() to authenticated;

create or replace function public.get_document_organiser(_wedding_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.get_document_organiser(_wedding_id);
$$;

revoke all on function public.get_document_organiser(uuid) from public, anon;
grant execute on function public.get_document_organiser(uuid) to authenticated;
