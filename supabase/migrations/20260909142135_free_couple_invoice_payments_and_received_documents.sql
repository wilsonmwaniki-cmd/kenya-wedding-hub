-- Invoice payment is not a subscription benefit. Keep workspace authorization,
-- professional eligibility, and the Edge Function's live pilot gates unchanged.
do $$
declare
  definition text := pg_get_functiondef('public.get_zania_pay_invoice_eligibility(uuid)'::regprocedure);
  old_check text := 'couple_can_send := public.wedding_has_feature(resolved_wedding_id, ''payments_send'');';
begin
  if position(old_check in definition) = 0 then
    raise exception 'Unexpected invoice eligibility definition; review before changing payment access';
  end if;
  definition := replace(definition, old_check, 'couple_can_send := true; -- All connected couples, including Free.');
  definition := replace(definition, '    when not couple_can_send then ''couple_upgrade''' || chr(10), '');
  execute definition;
end;
$$;

create index if not exists commercial_documents_recipient_inbox_idx
  on public.commercial_documents (lower(btrim(recipient_email)), updated_at desc)
  where status <> 'draft';
create index if not exists professional_contracts_recipient_inbox_idx
  on public.professional_contracts (lower(btrim(recipient_email)), updated_at desc)
  where status <> 'draft';

-- Narrow recipient projection; do not give recipients owner-table access.
-- The definer implementation stays outside the exposed public schema.
create schema if not exists private;
create or replace function private.list_received_documents()
returns table (
  id uuid, document_type text, document_number text, title text,
  status text, currency text, total_amount numeric, updated_at timestamptz,
  share_token uuid
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  recipient_id uuid := auth.uid();
  verified_email text;
begin
  if recipient_id is null then raise exception 'Authentication required'; end if;
  select lower(btrim(u.email)) into verified_email
    from auth.users u where u.id = recipient_id and u.email_confirmed_at is not null;
  if nullif(verified_email, '') is null then return; end if;
  return query
    select d.id, d.document_type, d.document_number, d.title,
      d.status, d.currency, d.total_amount, d.updated_at, s.share_token
    from public.commercial_documents d
    join public.commercial_document_shares s on s.document_id = d.id
    where lower(btrim(d.recipient_email)) = verified_email
      and d.user_id <> recipient_id and d.status <> 'draft'
      and s.revoked_at is null and (s.expires_at is null or s.expires_at > now())
    union all
    select c.id, 'contract'::text, null::text, c.title,
      c.status, null::text, null::numeric, c.updated_at, s.share_token
    from public.professional_contracts c
    join public.professional_contract_shares s on s.contract_id = c.id
    where lower(btrim(c.recipient_email)) = verified_email
      and c.user_id <> recipient_id and c.status <> 'draft'
      and s.revoked_at is null and (s.expires_at is null or s.expires_at > now())
    order by 8 desc, 1;
end;
$$;
revoke all on function private.list_received_documents() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.list_received_documents() to authenticated;

create or replace function public.list_received_documents()
returns table (
  id uuid, document_type text, document_number text, title text,
  status text, currency text, total_amount numeric, updated_at timestamptz,
  share_token uuid
)
language sql stable security invoker set search_path = ''
as $$ select * from private.list_received_documents(); $$;
revoke all on function public.list_received_documents() from public, anon;
grant execute on function public.list_received_documents() to authenticated;
