create or replace function public.record_workspace_event(
  wedding_id_input uuid,
  event_type_input text,
  subject_type_input text,
  subject_id_input uuid,
  title_input text,
  summary_input text,
  dedupe_key_input text,
  metadata_input jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  event_id_output uuid;
begin
  insert into public.workspace_events (
    actor_user_id,
    wedding_id,
    event_type,
    subject_type,
    subject_id,
    title,
    summary,
    dedupe_key,
    metadata
  )
  values (
    auth.uid(),
    wedding_id_input,
    event_type_input,
    subject_type_input,
    subject_id_input,
    title_input,
    summary_input,
    dedupe_key_input,
    coalesce(metadata_input, '{}'::jsonb)
  )
  on conflict (dedupe_key) do update set
    occurred_at = now(),
    actor_user_id = excluded.actor_user_id,
    title = excluded.title,
    summary = excluded.summary,
    metadata = excluded.metadata
  returning id into event_id_output;

  return event_id_output;
end;
$$;

create or replace function public.create_collaboration_attention(
  wedding_id_input uuid,
  event_id_input uuid,
  source_type_input text,
  source_id_input uuid,
  attention_kind_input text,
  priority_input text,
  title_input text,
  summary_input text,
  action_label_input text,
  action_path_input text,
  dedupe_key_prefix_input text,
  metadata_input jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient record;
  inserted_count integer := 0;
  resolved_role text;
begin
  if wedding_id_input is null then
    return 0;
  end if;

  for recipient in
    select wm.user_id, wm.role, profile.role as profile_role
    from public.wedding_memberships wm
    left join public.profiles profile on profile.user_id = wm.user_id
    where wm.wedding_id = wedding_id_input
      and wm.membership_status = 'active'
      and wm.user_id is not null
      and (auth.uid() is null or wm.user_id <> auth.uid())
  loop
    resolved_role := case
      when recipient.profile_role in ('couple', 'planner', 'vendor') then recipient.profile_role
      when recipient.role = 'planner' then 'planner'
      when recipient.role = 'vendor' then 'vendor'
      else 'couple'
    end;

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
      recipient.user_id,
      resolved_role,
      wedding_id_input,
      event_id_input,
      source_type_input,
      source_id_input,
      attention_kind_input,
      priority_input,
      'unread',
      title_input,
      summary_input,
      action_label_input,
      action_path_input,
      dedupe_key_prefix_input || ':recipient:' || recipient.user_id::text,
      coalesce(metadata_input, '{}'::jsonb)
    )
    on conflict (recipient_user_id, dedupe_key) do update set
      event_id = excluded.event_id,
      status = 'unread',
      priority = excluded.priority,
      title = excluded.title,
      summary = excluded.summary,
      action_label = excluded.action_label,
      action_path = excluded.action_path,
      read_at = null,
      completed_at = null,
      dismissed_at = null,
      metadata = excluded.metadata;

    inserted_count := inserted_count + 1;
  end loop;

  return inserted_count;
end;
$$;

create or replace function public.sync_professional_contract_attention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_user_id uuid;
  linked_role text;
  resolved_wedding_id uuid;
  resolved_wedding_name text;
  event_id_value uuid;
  issuer_path text;
  recipient_path text;
  event_key text;
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

  select wedding.name
  into resolved_wedding_name
  from public.weddings wedding
  where wedding.id = resolved_wedding_id;

  resolved_wedding_name := coalesce(new.wedding_name, resolved_wedding_name);
  issuer_path := case when new.role = 'vendor' then '/vendor-documents/contracts' else '/planner-documents/contracts' end;
  recipient_path := case when new.vendor_id is not null then '/vendors' else '/dashboard' end;
  event_key := 'professional_contract:' || new.id::text || ':status:' || new.status;

  event_id_value := public.record_workspace_event(
    resolved_wedding_id,
    'professional_contract.' || new.status,
    'professional_contract',
    new.id,
    'Contract ' || replace(new.status, '_', ' '),
    new.title,
    event_key,
    jsonb_build_object(
      'contract_title', new.title,
      'recipient_name', new.recipient_name,
      'wedding_name', resolved_wedding_name,
      'status', new.status
    )
  );

  if new.status in ('sent', 'awaiting_signature') and linked_user_id is not null then
    select case when profile.role in ('couple', 'planner', 'vendor') then profile.role else 'couple' end
    into linked_role
    from public.profiles profile
    where profile.user_id = linked_user_id;

    insert into public.attention_items (
      recipient_user_id, recipient_role, wedding_id, event_id, source_type, source_id,
      attention_kind, priority, status, title, summary, action_label, action_path,
      dedupe_key, metadata
    )
    values (
      linked_user_id, coalesce(linked_role, 'couple'), resolved_wedding_id, event_id_value,
      'professional_contract', new.id, 'action', 'action', 'unread',
      'Contract ready to review',
      new.title || coalesce(' · ' || nullif(new.wedding_name, ''), ''),
      'Review contract', recipient_path,
      'professional_contract:' || new.id::text || ':recipient:review',
      jsonb_build_object('wedding_name', resolved_wedding_name, 'status', new.status)
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

  if new.status = 'countersigned'
    or (new.status = 'completed' and (auth.uid() is null or auth.uid() <> new.user_id)) then
    insert into public.attention_items (
      recipient_user_id, recipient_role, wedding_id, event_id, source_type, source_id,
      attention_kind, priority, status, title, summary, action_label, action_path,
      dedupe_key, metadata
    )
    values (
      new.user_id, new.role, resolved_wedding_id, event_id_value,
      'professional_contract', new.id, 'update', 'action', 'unread',
      case when new.status = 'completed' then 'Contract fully signed' else 'Client signed the contract' end,
      new.recipient_name || ' · ' || new.title,
      'Open contract', issuer_path,
      'professional_contract:' || new.id::text || ':issuer:' || new.status,
      jsonb_build_object('wedding_name', resolved_wedding_name, 'status', new.status)
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

  if new.status in ('completed', 'cancelled') and linked_user_id is not null then
    update public.attention_items
    set
      status = 'completed',
      read_at = coalesce(read_at, now()),
      completed_at = coalesce(completed_at, now())
    where recipient_user_id = linked_user_id
      and dedupe_key = 'professional_contract:' || new.id::text || ':recipient:review'
      and status not in ('completed', 'dismissed');
  end if;

  return new;
end;
$$;

drop trigger if exists sync_professional_contract_attention_trigger on public.professional_contracts;
create trigger sync_professional_contract_attention_trigger
after update of status on public.professional_contracts
for each row execute function public.sync_professional_contract_attention();

create or replace function public.sync_commercial_document_attention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_user_id uuid;
  linked_role text;
  resolved_wedding_id uuid;
  resolved_wedding_name text;
  event_id_value uuid;
  issuer_path text;
  recipient_path text;
  document_label text;
  event_key text;
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

  select wedding.name
  into resolved_wedding_name
  from public.weddings wedding
  where wedding.id = resolved_wedding_id;

  resolved_wedding_name := coalesce(new.wedding_name, resolved_wedding_name);
  document_label := initcap(new.document_type);
  issuer_path := case
    when new.role = 'vendor' then '/vendor-documents/' || new.document_type || 's'
    else '/planner-documents/' || new.document_type || 's'
  end;
  recipient_path := case when new.vendor_id is not null then '/vendors' else '/dashboard' end;
  event_key := 'commercial_document:' || new.id::text || ':status:' || new.status;

  event_id_value := public.record_workspace_event(
    resolved_wedding_id,
    'commercial_document.' || new.status,
    'commercial_document',
    new.id,
    document_label || ' ' || replace(new.status, '_', ' '),
    new.document_number || ' · ' || new.title,
    event_key,
    jsonb_build_object(
      'document_type', new.document_type,
      'document_number', new.document_number,
      'wedding_name', resolved_wedding_name,
      'status', new.status,
      'total_amount', new.total_amount
    )
  );

  if (
    (new.document_type in ('quote', 'invoice') and new.status = 'sent')
    or (new.document_type = 'receipt' and new.status = 'issued')
  ) and linked_user_id is not null then
    select case when profile.role in ('couple', 'planner', 'vendor') then profile.role else 'couple' end
    into linked_role
    from public.profiles profile
    where profile.user_id = linked_user_id;

    insert into public.attention_items (
      recipient_user_id, recipient_role, wedding_id, event_id, source_type, source_id,
      attention_kind, priority, status, title, summary, action_label, action_path,
      due_at, dedupe_key, metadata
    )
    values (
      linked_user_id, coalesce(linked_role, 'couple'), resolved_wedding_id, event_id_value,
      'commercial_document', new.id, 'action',
      case when new.document_type = 'invoice' then 'action' else 'info' end,
      'unread',
      document_label || ' received',
      new.document_number || ' from ' || coalesce(
        (select profile.full_name from public.profiles profile where profile.user_id = new.user_id),
        new.role
      ),
      'Review ' || new.document_type,
      recipient_path,
      case when new.due_date is not null then new.due_date::timestamptz else null end,
      'commercial_document:' || new.id::text || ':recipient:review',
      jsonb_build_object(
        'wedding_name', resolved_wedding_name,
        'document_type', new.document_type,
        'document_number', new.document_number,
        'total_amount', new.total_amount
      )
    )
    on conflict (recipient_user_id, dedupe_key) do update set
      event_id = excluded.event_id,
      status = 'unread',
      priority = excluded.priority,
      title = excluded.title,
      summary = excluded.summary,
      action_label = excluded.action_label,
      action_path = excluded.action_path,
      due_at = excluded.due_at,
      read_at = null,
      completed_at = null,
      dismissed_at = null,
      metadata = excluded.metadata;
  end if;

  if new.status in ('accepted', 'rejected', 'part_paid', 'paid')
    and (auth.uid() is null or auth.uid() <> new.user_id) then
    insert into public.attention_items (
      recipient_user_id, recipient_role, wedding_id, event_id, source_type, source_id,
      attention_kind, priority, status, title, summary, action_label, action_path,
      dedupe_key, metadata
    )
    values (
      new.user_id, new.role, resolved_wedding_id, event_id_value,
      'commercial_document', new.id, 'update',
      case when new.status in ('rejected', 'part_paid') then 'action' else 'info' end,
      'unread',
      document_label || ' ' || replace(new.status, '_', ' '),
      new.recipient_name || ' · ' || new.document_number,
      'Open ' || new.document_type,
      issuer_path,
      'commercial_document:' || new.id::text || ':issuer:' || new.status,
      jsonb_build_object(
        'wedding_name', resolved_wedding_name,
        'document_type', new.document_type,
        'document_number', new.document_number,
        'status', new.status
      )
    )
    on conflict (recipient_user_id, dedupe_key) do update set
      event_id = excluded.event_id,
      status = 'unread',
      priority = excluded.priority,
      title = excluded.title,
      summary = excluded.summary,
      action_label = excluded.action_label,
      action_path = excluded.action_path,
      read_at = null,
      completed_at = null,
      dismissed_at = null,
      metadata = excluded.metadata;
  end if;

  if new.status in ('accepted', 'rejected', 'paid', 'void', 'expired') and linked_user_id is not null then
    update public.attention_items
    set
      status = 'completed',
      read_at = coalesce(read_at, now()),
      completed_at = coalesce(completed_at, now())
    where recipient_user_id = linked_user_id
      and dedupe_key = 'commercial_document:' || new.id::text || ':recipient:review'
      and status not in ('completed', 'dismissed');
  end if;

  return new;
end;
$$;

drop trigger if exists sync_commercial_document_attention_trigger on public.commercial_documents;
create trigger sync_commercial_document_attention_trigger
after update of status on public.commercial_documents
for each row execute function public.sync_commercial_document_attention();

create or replace function public.sync_planner_change_request_attention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_wedding_id uuid;
  resolved_wedding_name text;
  event_id_value uuid;
  event_key text;
begin
  select client.wedding_id, wedding.name
  into resolved_wedding_id, resolved_wedding_name
  from public.planner_clients client
  left join public.weddings wedding on wedding.id = client.wedding_id
  where client.id = new.client_id;

  if tg_op = 'INSERT' then
    event_key := 'planner_change_request:' || new.id::text || ':pending';
    event_id_value := public.record_workspace_event(
      resolved_wedding_id,
      'planner_change_request.pending',
      'planner_change_request',
      new.id,
      'Planner change needs review',
      initcap(new.change_type) || ' ' || replace(new.target_table, '_', ' '),
      event_key,
      jsonb_build_object(
        'wedding_name', resolved_wedding_name,
        'target_table', new.target_table,
        'change_type', new.change_type
      )
    );

    insert into public.attention_items (
      recipient_user_id, recipient_role, wedding_id, event_id, source_type, source_id,
      attention_kind, priority, status, title, summary, action_label, action_path,
      dedupe_key, metadata
    )
    values (
      new.couple_user_id, 'couple', resolved_wedding_id, event_id_value,
      'planner_change_request', new.id, 'action', 'action', 'unread',
      'Planner change needs approval',
      initcap(new.change_type) || ' ' || replace(new.target_table, '_', ' '),
      'Review change', '/dashboard',
      'planner_change_request:' || new.id::text || ':couple:review',
      jsonb_build_object(
        'wedding_name', resolved_wedding_name,
        'target_table', new.target_table,
        'change_type', new.change_type
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
  end if;

  if new.status is distinct from old.status and new.status in ('approved', 'rejected', 'cancelled') then
    event_key := 'planner_change_request:' || new.id::text || ':status:' || new.status;
    event_id_value := public.record_workspace_event(
      resolved_wedding_id,
      'planner_change_request.' || new.status,
      'planner_change_request',
      new.id,
      'Planner change ' || new.status,
      initcap(new.change_type) || ' ' || replace(new.target_table, '_', ' '),
      event_key,
      jsonb_build_object(
        'wedding_name', resolved_wedding_name,
        'target_table', new.target_table,
        'change_type', new.change_type,
        'status', new.status
      )
    );

    update public.attention_items
    set
      status = 'completed',
      read_at = coalesce(read_at, now()),
      completed_at = coalesce(completed_at, now())
    where recipient_user_id = new.couple_user_id
      and dedupe_key = 'planner_change_request:' || new.id::text || ':couple:review'
      and status not in ('completed', 'dismissed');

    if new.status in ('approved', 'rejected') then
      insert into public.attention_items (
        recipient_user_id, recipient_role, wedding_id, event_id, source_type, source_id,
        attention_kind, priority, status, title, summary, action_label, action_path,
        dedupe_key, metadata
      )
      values (
        new.planner_user_id, 'planner', resolved_wedding_id, event_id_value,
        'planner_change_request', new.id, 'update',
        case when new.status = 'rejected' then 'action' else 'info' end,
        'unread',
        'Change request ' || new.status,
        initcap(new.change_type) || ' ' || replace(new.target_table, '_', ' '),
        'Open wedding', '/clients',
        'planner_change_request:' || new.id::text || ':planner:' || new.status,
        jsonb_build_object(
          'wedding_name', resolved_wedding_name,
          'target_table', new.target_table,
          'change_type', new.change_type,
          'status', new.status
        )
      )
      on conflict (recipient_user_id, dedupe_key) do update set
        event_id = excluded.event_id,
        status = 'unread',
        priority = excluded.priority,
        title = excluded.title,
        summary = excluded.summary,
        action_label = excluded.action_label,
        action_path = excluded.action_path,
        read_at = null,
        completed_at = null,
        dismissed_at = null,
        metadata = excluded.metadata;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_planner_change_request_attention_trigger on public.planner_change_requests;
create trigger sync_planner_change_request_attention_trigger
after insert or update of status on public.planner_change_requests
for each row execute function public.sync_planner_change_request_attention();

create or replace function public.sync_budget_payment_attention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_wedding_id uuid;
  resolved_wedding_name text;
  event_id_value uuid;
  event_key text;
begin
  resolved_wedding_id := new.wedding_id;

  if resolved_wedding_id is null and new.client_id is not null then
    select client.wedding_id
    into resolved_wedding_id
    from public.planner_clients client
    where client.id = new.client_id;
  end if;

  if resolved_wedding_id is null then
    return new;
  end if;

  select wedding.name
  into resolved_wedding_name
  from public.weddings wedding
  where wedding.id = resolved_wedding_id;

  event_key := 'budget_payment:' || new.id::text || ':recorded';
  event_id_value := public.record_workspace_event(
    resolved_wedding_id,
    'budget_payment.recorded',
    'budget_payment',
    new.id,
    'Payment recorded',
    'KES ' || trim(to_char(new.amount, 'FM999G999G999G990D00')) || ' to ' || new.payee_name,
    event_key,
    jsonb_build_object(
      'wedding_name', resolved_wedding_name,
      'category_name', new.category_name,
      'payee_name', new.payee_name,
      'amount', new.amount,
      'payment_date', new.payment_date
    )
  );

  perform public.create_collaboration_attention(
    resolved_wedding_id,
    event_id_value,
    'budget_payment',
    new.id,
    'update',
    'action',
    'Payment recorded',
    'KES ' || trim(to_char(new.amount, 'FM999G999G999G990D00')) || ' to ' || new.payee_name,
    'Review payment',
    '/budget',
    event_key,
    jsonb_build_object(
      'wedding_name', resolved_wedding_name,
      'category_name', new.category_name,
      'payee_name', new.payee_name,
      'amount', new.amount,
      'payment_date', new.payment_date
    )
  );

  return new;
end;
$$;

drop trigger if exists sync_budget_payment_attention_trigger on public.budget_payments;
create trigger sync_budget_payment_attention_trigger
after insert on public.budget_payments
for each row execute function public.sync_budget_payment_attention();

create or replace function public.sync_task_completion_attention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_wedding_id uuid;
  resolved_wedding_name text;
  event_id_value uuid;
  event_key text;
begin
  if new.completed is not distinct from old.completed then
    return new;
  end if;

  resolved_wedding_id := new.wedding_id;
  if resolved_wedding_id is null and new.client_id is not null then
    select client.wedding_id
    into resolved_wedding_id
    from public.planner_clients client
    where client.id = new.client_id;
  end if;

  if resolved_wedding_id is null then
    return new;
  end if;

  select wedding.name
  into resolved_wedding_name
  from public.weddings wedding
  where wedding.id = resolved_wedding_id;

  event_key := 'task:' || new.id::text || ':completed:' || new.completed::text;
  event_id_value := public.record_workspace_event(
    resolved_wedding_id,
    case when new.completed then 'task.completed' else 'task.reopened' end,
    'task',
    new.id,
    case when new.completed then 'Task completed' else 'Task reopened' end,
    new.title,
    event_key,
    jsonb_build_object(
      'wedding_name', resolved_wedding_name,
      'task_title', new.title,
      'completed', new.completed,
      'due_date', new.due_date
    )
  );

  perform public.create_collaboration_attention(
    resolved_wedding_id,
    event_id_value,
    'task',
    new.id,
    case when new.completed then 'update' else 'action' end,
    case when new.completed then 'info' else 'action' end,
    case when new.completed then 'Task completed' else 'Task reopened' end,
    new.title,
    'View task',
    '/tasks?task=' || new.id::text,
    event_key,
    jsonb_build_object(
      'wedding_name', resolved_wedding_name,
      'task_title', new.title,
      'completed', new.completed,
      'due_date', new.due_date
    )
  );

  return new;
end;
$$;

drop trigger if exists sync_task_completion_attention_trigger on public.tasks;
create trigger sync_task_completion_attention_trigger
after update of completed on public.tasks
for each row execute function public.sync_task_completion_attention();

revoke all on function public.record_workspace_event(uuid, text, text, uuid, text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.create_collaboration_attention(uuid, uuid, text, uuid, text, text, text, text, text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.sync_professional_contract_attention()
  from public, anon, authenticated;
revoke all on function public.sync_commercial_document_attention()
  from public, anon, authenticated;
revoke all on function public.sync_planner_change_request_attention()
  from public, anon, authenticated;
revoke all on function public.sync_budget_payment_attention()
  from public, anon, authenticated;
revoke all on function public.sync_task_completion_attention()
  from public, anon, authenticated;
