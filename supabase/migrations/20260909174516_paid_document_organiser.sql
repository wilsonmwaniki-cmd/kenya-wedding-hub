-- Recipient-only change history. Never expose issuer notes or drafts.
create table private.document_activity (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  document_type text not null,
  recipient_email text not null,
  status text not null,
  previous_status text,
  occurred_at timestamptz not null default now()
);
alter table private.document_activity enable row level security;
revoke all on private.document_activity from public, anon, authenticated;
create index document_activity_recipient_time_idx
  on private.document_activity (recipient_email, occurred_at desc);
create index document_activity_document_time_idx
  on private.document_activity (document_id, occurred_at desc);

create or replace function private.capture_document_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  current_row jsonb := to_jsonb(new);
  old_row jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  watched_keys text[] := array['status','title','recipient_email','total_amount','amount_paid','balance_due','due_date','terms'];
begin
  if new.status = 'draft' or nullif(btrim(new.recipient_email), '') is null then return new; end if;
  if tg_op = 'UPDATE' and not exists (
    select 1 from unnest(watched_keys) k where current_row -> k is distinct from old_row -> k
  ) then return new; end if;
  insert into private.document_activity(document_id, document_type, recipient_email, status, previous_status)
    values(new.id, coalesce(current_row ->> 'document_type','contract'), lower(btrim(new.recipient_email)), new.status, old_row ->> 'status');
  return new;
end; $$;
revoke all on function private.capture_document_activity() from public, anon, authenticated;
create trigger capture_recipient_commercial_activity after insert or update
  on public.commercial_documents for each row execute function private.capture_document_activity();
create trigger capture_recipient_contract_activity after insert or update
  on public.professional_contracts for each row execute function private.capture_document_activity();

create or replace function private.get_document_organiser(_wedding_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  docs jsonb;
  events jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if _wedding_id is null or not public.is_wedding_member(_wedding_id) then
    return jsonb_build_object('enabled',false,'documents','[]'::jsonb,'events','[]'::jsonb);
  end if;
  if not (public.wedding_has_feature(_wedding_id,'wedding_collaboration')
    or public.wedding_has_feature(_wedding_id,'planner_collaboration')
    or public.wedding_has_feature(_wedding_id,'vendor_collaboration')) then
    return jsonb_build_object('enabled',false,'documents','[]'::jsonb,'events','[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(to_jsonb(received) || jsonb_build_object(
    'professional_id',coalesce(d.user_id,c.user_id),
    'professional_name',coalesce(nullif(v.business_name,''),nullif(p.full_name,''),'Professional'),
    'professional_role',coalesce(d.role,c.role),
    'source_id',case when d.document_type = 'receipt' then coalesce(d.metadata ->> 'source_invoice_id',d.quote_source_id::text) else d.quote_source_id::text end,
    'due_date',d.due_date,'amount_paid',d.amount_paid,'balance_due',d.balance_due,
    'items',coalesce((select jsonb_agg(jsonb_build_object('description',i.description,'quantity',i.quantity,'unit_price',i.unit_price,'line_total',i.line_total) order by i.sort_order)
      from public.commercial_document_items i where i.document_id=d.id),'[]'::jsonb)
  ) order by received.updated_at desc),'[]'::jsonb) into docs
  from private.list_received_documents() received
  left join public.commercial_documents d on d.id=received.id and received.document_type<>'contract'
  left join public.professional_contracts c on c.id=received.id and received.document_type='contract'
  left join public.vendor_listings v on v.id=coalesce(d.vendor_listing_id,c.vendor_listing_id)
  left join public.profiles p on p.user_id=coalesce(d.user_id,c.user_id);

  select coalesce(jsonb_agg(to_jsonb(e) order by e.occurred_at desc),'[]'::jsonb) into events
  from (
    select a.id,a.document_id,a.document_type,a.status,a.previous_status,a.occurred_at,
      r.title,r.document_number,r.share_token
    from private.document_activity a
    join private.list_received_documents() r on r.id=a.document_id and r.document_type=a.document_type
    where a.recipient_email=(select lower(btrim(u.email)) from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null)
    order by a.occurred_at desc limit 100
  ) e;
  return jsonb_build_object('enabled',true,'documents',docs,'events',events);
end; $$;
revoke all on function private.get_document_organiser(uuid) from public, anon;
grant execute on function private.get_document_organiser(uuid) to authenticated;
create or replace function public.get_document_organiser(_wedding_id uuid)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.get_document_organiser(_wedding_id); $$;
revoke all on function public.get_document_organiser(uuid) from public, anon;
grant execute on function public.get_document_organiser(uuid) to authenticated;

-- Share activation/refresh is activity; public opens must not create notices.
create or replace function private.capture_document_share_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d record;
begin
  if new.revoked_at is not null then return new; end if;
  if tg_op='UPDATE' and new.share_token is not distinct from old.share_token
    and new.revoked_at is not distinct from old.revoked_at
    and new.expires_at is not distinct from old.expires_at then return new; end if;
  if tg_table_name='commercial_document_shares' then
    select id,document_type,recipient_email,status into d from public.commercial_documents where id=new.document_id;
  else
    select id,'contract'::text as document_type,recipient_email,status into d from public.professional_contracts where id=new.contract_id;
  end if;
  if d.id is null or d.status='draft' or nullif(btrim(d.recipient_email),'') is null then return new; end if;
  -- Avoid duplicate notices when send and share activation happen together.
  if not exists(select 1 from private.document_activity a where a.document_id=d.id and a.occurred_at=now()) then
    insert into private.document_activity(document_id,document_type,recipient_email,status,previous_status)
    values(d.id,d.document_type,lower(btrim(d.recipient_email)),d.status,d.status);
  end if;
  return new;
end; $$;
revoke all on function private.capture_document_share_activity() from public,anon,authenticated;
create trigger capture_recipient_commercial_share after insert or update on public.commercial_document_shares
  for each row execute function private.capture_document_share_activity();
create trigger capture_recipient_contract_share after insert or update on public.professional_contract_shares
  for each row execute function private.capture_document_share_activity();
