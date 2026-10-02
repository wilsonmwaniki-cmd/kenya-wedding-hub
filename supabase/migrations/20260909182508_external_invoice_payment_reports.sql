create table private.external_invoice_payment_reports (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null,
  document_id uuid not null references public.commercial_documents(id) on delete cascade,
  payer_user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null,
  payment_method text not null check (payment_method in ('mpesa','bank','cash','card','other')),
  reference text,
  notes text,
  status text not null default 'pending' check (status in ('pending','confirmed','disputed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  commercial_payment_id uuid references public.commercial_document_payments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payer_user_id, client_request_id)
);
alter table private.external_invoice_payment_reports enable row level security;
revoke all on private.external_invoice_payment_reports from public, anon, authenticated;
create index external_invoice_payment_reports_document_time_idx
  on private.external_invoice_payment_reports (document_id, created_at desc);

create trigger update_external_invoice_payment_reports_updated_at
before update on private.external_invoice_payment_reports
for each row execute function public.update_updated_at_column();

create or replace function private.external_payment_report_json(_report private.external_invoice_payment_reports)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id',_report.id,'documentId',_report.document_id,'amount',_report.amount,
    'paymentDate',_report.payment_date,'paymentMethod',_report.payment_method,
    'reference',_report.reference,'notes',_report.notes,'status',_report.status,
    'reviewNote',_report.review_note,'reviewedAt',_report.reviewed_at,
    'createdAt',_report.created_at,'commercialPaymentId',_report.commercial_payment_id
  );
$$;
revoke all on function private.external_payment_report_json(private.external_invoice_payment_reports) from public,anon,authenticated;

create or replace function private.submit_external_invoice_payment(
  _share_token uuid, _client_request_id uuid, _amount numeric, _payment_date date,
  _payment_method text, _reference text default null, _notes text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d public.commercial_documents%rowtype;
  report private.external_invoice_payment_reports%rowtype;
  resolved_wedding_id uuid;
  event_id_value uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to report a payment'; end if;
  if _client_request_id is null then raise exception 'Payment request identifier is required'; end if;
  if _amount is null or _amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  if _payment_date is null or _payment_date > current_date then raise exception 'Choose today or an earlier payment date'; end if;
  if _payment_method not in ('mpesa','bank','cash','card','other') then raise exception 'Choose a supported payment method'; end if;
  if length(coalesce(_reference,'')) > 120 or length(coalesce(_notes,'')) > 1000 then raise exception 'Payment details are too long'; end if;

  select document.* into d
  from public.commercial_document_shares share
  join public.commercial_documents document on document.id=share.document_id
  where share.share_token=_share_token and share.revoked_at is null and share.expires_at>now()
    and document.document_type='invoice' and document.status in ('sent','part_paid')
    and exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null
      and lower(btrim(u.email))=lower(btrim(document.recipient_email)))
  for update of document;
  if d.id is null then raise exception 'This invoice is not available for external payment reporting'; end if;
  if _amount > d.balance_due then raise exception 'Enter an amount up to the outstanding invoice balance'; end if;

  insert into private.external_invoice_payment_reports(client_request_id,document_id,payer_user_id,amount,payment_date,payment_method,reference,notes)
  values(_client_request_id,d.id,auth.uid(),_amount,_payment_date,_payment_method,nullif(btrim(_reference),''),nullif(btrim(_notes),''))
  on conflict(payer_user_id,client_request_id) do update set client_request_id=excluded.client_request_id
  returning * into report;

  select coalesce(v.wedding_id,pc.wedding_id) into resolved_wedding_id
  from (select 1) seed
  left join public.vendors v on v.id=d.vendor_id
  left join public.planner_clients pc on pc.id=d.client_id;

  insert into public.workspace_events(actor_user_id,wedding_id,event_type,subject_type,subject_id,title,summary,dedupe_key,metadata)
  values(auth.uid(),resolved_wedding_id,'invoice.external_payment_reported','external_invoice_payment',report.id,
    'External payment reported',d.document_number||' · '||d.currency||' '||trim(to_char(report.amount,'FM999G999G999G990D00')),
    'external_invoice_payment:'||report.id::text||':reported',
    jsonb_build_object('document_id',d.id,'document_number',d.document_number,'amount',report.amount,'currency',d.currency,'status','pending'))
  on conflict(dedupe_key) do update set occurred_at=now(),summary=excluded.summary,metadata=excluded.metadata
  returning id into event_id_value;

  insert into public.attention_items(recipient_user_id,recipient_role,wedding_id,event_id,source_type,source_id,attention_kind,priority,status,title,summary,action_label,action_path,dedupe_key,metadata)
  values(d.user_id,d.role,resolved_wedding_id,event_id_value,'external_invoice_payment',report.id,'action','action','unread',
    'Confirm external invoice payment',d.document_number||' · '||d.currency||' '||trim(to_char(report.amount,'FM999G999G999G990D00')),
    'Review payment',case when d.role='planner' then '/planner-documents/invoices' else '/vendor-documents/invoices' end,
    'external_invoice_payment:'||report.id::text||':owner',jsonb_build_object('document_id',d.id,'report_id',report.id))
  on conflict(recipient_user_id,dedupe_key) do update set status='unread',event_id=excluded.event_id,summary=excluded.summary,read_at=null,completed_at=null,dismissed_at=null;
  return private.external_payment_report_json(report);
end; $$;

create or replace function private.list_external_invoice_payments_for_recipient(_share_token uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  if not exists(
    select 1 from public.commercial_document_shares s join public.commercial_documents d on d.id=s.document_id
    join auth.users u on u.id=auth.uid()
    where s.share_token=_share_token and s.revoked_at is null and s.expires_at>now()
      and u.email_confirmed_at is not null and lower(btrim(u.email))=lower(btrim(d.recipient_email))
  ) then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(private.external_payment_report_json(r) order by r.created_at desc),'[]'::jsonb) into result
  from private.external_invoice_payment_reports r
  join public.commercial_document_shares s on s.document_id=r.document_id and s.share_token=_share_token
  where r.payer_user_id=auth.uid();
  return result;
end; $$;

create or replace function private.list_external_invoice_payments_for_owner(_document_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.commercial_documents d where d.id=_document_id and d.user_id=auth.uid()) then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(private.external_payment_report_json(r) order by r.created_at desc),'[]'::jsonb) into result
  from private.external_invoice_payment_reports r where r.document_id=_document_id;
  return result;
end; $$;

create or replace function private.review_external_invoice_payment(_report_id uuid,_decision text,_review_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  report private.external_invoice_payment_reports%rowtype;
  d public.commercial_documents%rowtype;
  payment public.commercial_document_payments%rowtype;
  share_token uuid;
  resolved_wedding_id uuid;
  event_id_value uuid;
  fallback_category public.budget_categories%rowtype;
  fallback_budget_payment_id uuid;
  fallback_category_name text;
  professional_name text;
begin
  if auth.uid() is null then raise exception 'Sign in to review a payment'; end if;
  if _decision not in ('confirmed','disputed') then raise exception 'Choose confirm or dispute'; end if;
  if length(coalesce(_review_note,''))>500 then raise exception 'Review note is too long'; end if;
  select r.* into report
  from private.external_invoice_payment_reports r
  where r.id=_report_id for update;
  if report.id is not null then
    select doc.* into d from public.commercial_documents doc
    where doc.id=report.document_id and doc.user_id=auth.uid() for update;
  end if;
  if report.id is null or d.id is null then raise exception 'Payment report not found'; end if;
  if report.status<>'pending' then return private.external_payment_report_json(report); end if;
  if _decision='confirmed' then
    if d.status='void' or report.amount>d.balance_due then raise exception 'The invoice balance changed. Review it before confirming this payment'; end if;
    payment:=public.record_commercial_document_payment(d.id,report.amount,report.payment_date,report.payment_method,report.reference,
      concat_ws(E'\n',report.notes,'Confirmed from an external payment report.'),null);
    if payment.budget_payment_id is null then
      select wm.wedding_id into resolved_wedding_id
      from public.wedding_memberships wm
      join public.weddings w on w.id=wm.wedding_id
      where wm.user_id=report.payer_user_id and wm.membership_status='active'
      order by (lower(btrim(w.name))=lower(btrim(coalesce(d.wedding_name,'')))) desc,wm.is_owner desc,wm.accepted_at desc nulls last
      limit 1;
      if resolved_wedding_id is not null then
        select coalesce(nullif(vl.business_name,''),nullif(p.full_name,''),'Professional'),nullif(btrim(vl.category),'')
        into professional_name,fallback_category_name
        from (select 1) seed left join public.vendor_listings vl on vl.id=d.vendor_listing_id left join public.profiles p on p.user_id=d.user_id;
        if fallback_category_name is not null then
          select c.* into fallback_category from public.budget_categories c
          where c.user_id=report.payer_user_id and c.wedding_id=resolved_wedding_id and c.budget_scope='wedding'
            and lower(btrim(c.name))=lower(btrim(fallback_category_name)) order by c.created_at limit 1;
          if fallback_category.id is null then
            insert into public.budget_categories(user_id,wedding_id,name,allocated,spent,budget_scope,visibility,committee_role_in_charge,contract_status)
            values(report.payer_user_id,resolved_wedding_id,fallback_category_name,d.total_amount,0,'wedding','public','unassigned','not_started')
            returning * into fallback_category;
          end if;
          insert into public.budget_payments(user_id,wedding_id,budget_category_id,budget_scope,category_name,payee_name,amount,payment_date,reference,notes)
          values(report.payer_user_id,resolved_wedding_id,fallback_category.id,'wedding',fallback_category.name,professional_name,report.amount,report.payment_date,report.reference,
            concat_ws(E'\n',report.notes,'Confirmed external payment for '||d.document_number)) returning id into fallback_budget_payment_id;
          update public.budget_categories set spent=coalesce(spent,0)+report.amount where id=fallback_category.id;
          update public.commercial_document_payments set budget_payment_id=fallback_budget_payment_id where id=payment.id;
          payment.budget_payment_id:=fallback_budget_payment_id;
        end if;
      end if;
    end if;
  end if;
  update private.external_invoice_payment_reports set status=_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(btrim(_review_note),''),commercial_payment_id=payment.id
  where id=report.id returning * into report;
  update public.attention_items set status='completed',read_at=coalesce(read_at,now()),completed_at=now()
  where recipient_user_id=auth.uid() and dedupe_key='external_invoice_payment:'||report.id::text||':owner';
  select s.share_token into share_token from public.commercial_document_shares s where s.document_id=d.id and s.revoked_at is null and s.expires_at>now() order by s.created_at desc limit 1;
  select coalesce(v.wedding_id,pc.wedding_id) into resolved_wedding_id from (select 1) seed left join public.vendors v on v.id=d.vendor_id left join public.planner_clients pc on pc.id=d.client_id;
  insert into public.workspace_events(actor_user_id,wedding_id,event_type,subject_type,subject_id,title,summary,dedupe_key,metadata)
  values(auth.uid(),resolved_wedding_id,'invoice.external_payment_'||_decision,'external_invoice_payment',report.id,
    case when _decision='confirmed' then 'External payment confirmed' else 'External payment disputed' end,
    d.document_number||' · '||d.currency||' '||trim(to_char(report.amount,'FM999G999G999G990D00')),
    'external_invoice_payment:'||report.id::text||':'||_decision,jsonb_build_object('document_id',d.id,'status',_decision))
  on conflict(dedupe_key) do update set occurred_at=now() returning id into event_id_value;
  if share_token is not null then
    insert into public.attention_items(recipient_user_id,recipient_role,wedding_id,event_id,source_type,source_id,attention_kind,priority,status,title,summary,action_label,action_path,dedupe_key,metadata)
    values(report.payer_user_id,'couple',resolved_wedding_id,event_id_value,'external_invoice_payment',report.id,'update','info','unread','External payment '||_decision,
      d.document_number||' · '||d.currency||' '||trim(to_char(report.amount,'FM999G999G999G990D00')),'View invoice','/documents/share/'||share_token::text,
      'external_invoice_payment:'||report.id::text||':payer:'||_decision,jsonb_build_object('document_id',d.id,'report_id',report.id,'status',_decision))
    on conflict(recipient_user_id,dedupe_key) do update set status='unread',event_id=excluded.event_id,read_at=null,completed_at=null,dismissed_at=null;
  end if;
  return private.external_payment_report_json(report);
end; $$;

revoke all on function private.submit_external_invoice_payment(uuid,uuid,numeric,date,text,text,text) from public,anon;
revoke all on function private.list_external_invoice_payments_for_recipient(uuid) from public,anon;
revoke all on function private.list_external_invoice_payments_for_owner(uuid) from public,anon;
revoke all on function private.review_external_invoice_payment(uuid,text,text) from public,anon;
grant execute on function private.submit_external_invoice_payment(uuid,uuid,numeric,date,text,text,text) to authenticated;
grant execute on function private.list_external_invoice_payments_for_recipient(uuid) to authenticated;
grant execute on function private.list_external_invoice_payments_for_owner(uuid) to authenticated;
grant execute on function private.review_external_invoice_payment(uuid,text,text) to authenticated;

create or replace function public.submit_external_invoice_payment(_share_token uuid,_client_request_id uuid,_amount numeric,_payment_date date,_payment_method text,_reference text default null,_notes text default null)
returns jsonb language sql security invoker set search_path='' as $$ select private.submit_external_invoice_payment(_share_token,_client_request_id,_amount,_payment_date,_payment_method,_reference,_notes); $$;
create or replace function public.list_external_invoice_payments_for_recipient(_share_token uuid)
returns jsonb language sql stable security invoker set search_path='' as $$ select private.list_external_invoice_payments_for_recipient(_share_token); $$;
create or replace function public.list_external_invoice_payments_for_owner(_document_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$ select private.list_external_invoice_payments_for_owner(_document_id); $$;
create or replace function public.review_external_invoice_payment(_report_id uuid,_decision text,_review_note text default null)
returns jsonb language sql security invoker set search_path='' as $$ select private.review_external_invoice_payment(_report_id,_decision,_review_note); $$;
revoke all on function public.submit_external_invoice_payment(uuid,uuid,numeric,date,text,text,text) from public,anon;
revoke all on function public.list_external_invoice_payments_for_recipient(uuid) from public,anon;
revoke all on function public.list_external_invoice_payments_for_owner(uuid) from public,anon;
revoke all on function public.review_external_invoice_payment(uuid,text,text) from public,anon;
grant execute on function public.submit_external_invoice_payment(uuid,uuid,numeric,date,text,text,text) to authenticated;
grant execute on function public.list_external_invoice_payments_for_recipient(uuid) to authenticated;
grant execute on function public.list_external_invoice_payments_for_owner(uuid) to authenticated;
grant execute on function public.review_external_invoice_payment(uuid,text,text) to authenticated;
