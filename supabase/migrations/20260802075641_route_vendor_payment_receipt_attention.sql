create or replace function public.sync_vendor_receipt_attention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_wedding_id uuid;
  professional_user_id uuid;
  professional_name text;
  event_id_value uuid;
  event_key text;
begin
  if new.vendor_id is null then
    return new;
  end if;

  select
    coalesce(vendor.wedding_id, client.wedding_id),
    listing.user_id,
    listing.business_name
  into resolved_wedding_id, professional_user_id, professional_name
  from public.vendors vendor
  left join public.planner_clients client on client.id = vendor.client_id
  left join public.vendor_listings listing on listing.id = vendor.vendor_listing_id
  where vendor.id = new.vendor_id;

  if professional_user_id is null or professional_user_id = auth.uid() then
    return new;
  end if;

  event_key := 'budget_payment:' || new.id::text || ':receipt_review';
  event_id_value := public.record_workspace_event(
    resolved_wedding_id,
    'budget_payment.receipt_review',
    'budget_payment',
    new.id,
    'Payment ready for receipt confirmation',
    'KES ' || trim(to_char(new.amount, 'FM999G999G999G990D00')) || ' from ' || new.payee_name,
    event_key,
    jsonb_build_object(
      'vendor_id', new.vendor_id,
      'payee_name', new.payee_name,
      'amount', new.amount,
      'payment_date', new.payment_date,
      'reference', new.reference,
      'receipt_ready', true
    )
  );

  insert into public.attention_items (
    recipient_user_id,
    recipient_role,
    wedding_id,
    event_id,
    source_type,
    source_id,
    attention_kind,
    priority,
    status,
    title,
    summary,
    action_label,
    action_path,
    dedupe_key,
    metadata
  )
  values (
    professional_user_id,
    'vendor',
    resolved_wedding_id,
    event_id_value,
    'budget_payment',
    new.id,
    'action',
    'action',
    'unread',
    'Confirm payment and issue receipt',
    'KES ' || trim(to_char(new.amount, 'FM999G999G999G990D00')) || ' was recorded for ' || coalesce(professional_name, new.payee_name),
    'Review and issue receipt',
    '/vendor-documents/receipts',
    event_key || ':vendor:' || professional_user_id::text,
    jsonb_build_object(
      'vendor_id', new.vendor_id,
      'payee_name', new.payee_name,
      'amount', new.amount,
      'payment_date', new.payment_date,
      'reference', new.reference,
      'receipt_ready', true
    )
  )
  on conflict (recipient_user_id, dedupe_key) do update set
    event_id = excluded.event_id,
    status = 'unread',
    title = excluded.title,
    summary = excluded.summary,
    action_label = excluded.action_label,
    action_path = excluded.action_path,
    read_at = null,
    completed_at = null,
    dismissed_at = null,
    metadata = excluded.metadata;

  return new;
end;
$$;

drop trigger if exists sync_vendor_receipt_attention_trigger on public.budget_payments;
create trigger sync_vendor_receipt_attention_trigger
after insert on public.budget_payments
for each row execute function public.sync_vendor_receipt_attention();

create or replace function public.sync_contract_counterparty_attention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_user_id uuid;
  resolved_wedding_id uuid;
  linked_role text;
  event_id_value uuid;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.client_id is not null then
    select client.linked_user_id, client.wedding_id
    into linked_user_id, resolved_wedding_id
    from public.planner_clients client
    where client.id = new.client_id;
  elsif new.vendor_id is not null then
    select vendor.user_id, vendor.wedding_id
    into linked_user_id, resolved_wedding_id
    from public.vendors vendor
    where vendor.id = new.vendor_id;
  end if;

  if new.status = 'countersigned' then
    update public.attention_items
    set
      attention_kind = 'action',
      priority = 'urgent',
      title = 'Client signed the contract',
      summary = new.recipient_name || ' signed ' || new.title,
      action_label = 'Countersign contract',
      action_path = case when new.role = 'vendor' then '/vendor-documents/contracts' else '/planner-documents/contracts' end,
      status = 'unread',
      read_at = null,
      completed_at = null,
      dismissed_at = null
    where recipient_user_id = new.user_id
      and dedupe_key = 'professional_contract:' || new.id::text || ':issuer:countersigned';
  end if;

  if new.status = 'completed' and linked_user_id is not null then
    select case when profile.role in ('couple', 'planner', 'vendor') then profile.role else 'couple' end
    into linked_role
    from public.profiles profile
    where profile.user_id = linked_user_id;

    event_id_value := public.record_workspace_event(
      resolved_wedding_id,
      'professional_contract.sealed',
      'professional_contract',
      new.id,
      'Contract complete',
      new.title,
      'professional_contract:' || new.id::text || ':sealed',
      jsonb_build_object('contract_title', new.title, 'status', new.status)
    );

    insert into public.attention_items (
      recipient_user_id, recipient_role, wedding_id, event_id, source_type, source_id,
      attention_kind, priority, status, title, summary, action_label, action_path,
      dedupe_key, metadata
    )
    values (
      linked_user_id, coalesce(linked_role, 'couple'), resolved_wedding_id, event_id_value,
      'professional_contract', new.id, 'update', 'info', 'unread',
      'Contract signed by everyone', new.title || ' is now complete.',
      'Open signed contract', case when new.vendor_id is not null then '/vendors' else '/dashboard' end,
      'professional_contract:' || new.id::text || ':recipient:sealed',
      jsonb_build_object('contract_title', new.title, 'status', new.status)
    )
    on conflict (recipient_user_id, dedupe_key) do update set
      event_id = excluded.event_id,
      status = 'unread',
      title = excluded.title,
      summary = excluded.summary,
      action_label = excluded.action_label,
      action_path = excluded.action_path,
      read_at = null,
      completed_at = null,
      dismissed_at = null,
      metadata = excluded.metadata;
  end if;

  return new;
end;
$$;

drop trigger if exists z_sync_contract_counterparty_attention_trigger on public.professional_contracts;
create trigger z_sync_contract_counterparty_attention_trigger
after update of status on public.professional_contracts
for each row execute function public.sync_contract_counterparty_attention();

revoke all on function public.sync_vendor_receipt_attention() from public, anon, authenticated;
revoke all on function public.sync_contract_counterparty_attention() from public, anon, authenticated;
