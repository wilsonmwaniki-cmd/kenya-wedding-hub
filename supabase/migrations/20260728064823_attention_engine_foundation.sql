create table if not exists public.workspace_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid null references auth.users(id) on delete set null,
  wedding_id uuid null references public.weddings(id) on delete cascade,
  event_type text not null,
  subject_type text not null,
  subject_id uuid null,
  title text not null,
  summary text null,
  dedupe_key text not null unique,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists workspace_events_wedding_time_idx
  on public.workspace_events (wedding_id, occurred_at desc);

create index if not exists workspace_events_subject_idx
  on public.workspace_events (subject_type, subject_id);

alter table public.workspace_events enable row level security;
revoke all on table public.workspace_events from public, anon, authenticated;

create table if not exists public.attention_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_role text not null check (recipient_role in ('couple', 'planner', 'vendor')),
  wedding_id uuid null references public.weddings(id) on delete cascade,
  event_id uuid null references public.workspace_events(id) on delete set null,
  source_type text not null,
  source_id uuid null,
  attention_kind text not null check (attention_kind in ('action', 'waiting', 'update')),
  priority text not null default 'info' check (priority in ('info', 'action', 'urgent')),
  status text not null default 'unread' check (status in ('unread', 'read', 'completed', 'dismissed')),
  title text not null,
  summary text null,
  action_label text null,
  action_path text null,
  due_at timestamptz null,
  read_at timestamptz null,
  completed_at timestamptz null,
  dismissed_at timestamptz null,
  dedupe_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  unique (recipient_user_id, dedupe_key)
);

create index if not exists attention_items_recipient_inbox_idx
  on public.attention_items (recipient_user_id, status, priority, created_at desc);

create index if not exists attention_items_wedding_idx
  on public.attention_items (wedding_id, recipient_user_id, created_at desc);

drop trigger if exists update_attention_items_updated_at on public.attention_items;
create trigger update_attention_items_updated_at
before update on public.attention_items
for each row execute function public.update_updated_at_column();

alter table public.attention_items enable row level security;

revoke all on table public.attention_items from public, anon;
revoke insert, update, delete on table public.attention_items from authenticated;
grant select on table public.attention_items to authenticated;

drop policy if exists "Users can view their own attention items" on public.attention_items;
create policy "Users can view their own attention items"
on public.attention_items
for select
to authenticated
using ((select auth.uid()) = recipient_user_id);

create or replace function public.set_attention_item_state(
  attention_id_input uuid,
  next_status_input text
)
returns public.attention_items
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_item public.attention_items%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in to update attention items';
  end if;

  if next_status_input not in ('read', 'completed', 'dismissed') then
    raise exception 'Unsupported attention state';
  end if;

  update public.attention_items
  set
    status = next_status_input,
    read_at = case
      when next_status_input in ('read', 'completed', 'dismissed') then coalesce(read_at, now())
      else read_at
    end,
    completed_at = case when next_status_input = 'completed' then coalesce(completed_at, now()) else completed_at end,
    dismissed_at = case when next_status_input = 'dismissed' then coalesce(dismissed_at, now()) else dismissed_at end
  where id = attention_id_input
    and recipient_user_id = auth.uid()
    and status not in ('completed', 'dismissed')
  returning * into updated_item;

  if updated_item.id is null then
    raise exception 'Attention item not found or already closed';
  end if;

  return updated_item;
end;
$$;

create or replace function public.sync_document_request_attention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.workspace_events%rowtype;
  recipient_path text;
  requester_path text;
  event_key text;
begin
  recipient_path := case
    when new.recipient_role = 'vendor' then '/vendor-documents'
    else '/planner-documents'
  end;
  requester_path := case
    when new.vendor_id is not null then '/vendors'
    else '/planners'
  end;

  if tg_op = 'INSERT' then
    event_key := 'document_request:' || new.id::text || ':created';

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
      new.requester_user_id,
      new.wedding_id,
      'document_request.created',
      'document_request',
      new.id,
      case when new.request_type = 'contract' then 'Contract requested' else 'Quote requested' end,
      new.requester_name || ' requested ' || case when new.request_type = 'contract' then 'a contract' else 'a quote' end,
      event_key,
      jsonb_build_object(
        'request_type', new.request_type,
        'requester_role', new.requester_role,
        'recipient_role', new.recipient_role,
        'service_category', new.service_category
      )
    )
    on conflict (dedupe_key) do update set
      summary = excluded.summary,
      metadata = excluded.metadata
    returning * into event_row;

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
      due_at,
      dedupe_key,
      metadata
    )
    values (
      new.recipient_user_id,
      new.recipient_role,
      new.wedding_id,
      event_row.id,
      'document_request',
      new.id,
      'action',
      'action',
      'unread',
      case when new.request_type = 'contract' then 'New contract request' else 'New quote request' end,
      new.requester_name || coalesce(' · ' || nullif(new.service_category, ''), ''),
      case when new.request_type = 'contract' then 'Review contract request' else 'Review quote' end,
      recipient_path,
      new.due_at,
      'document_request:' || new.id::text || ':recipient_action',
      jsonb_build_object(
        'requester_name', new.requester_name,
        'wedding_name', new.wedding_name,
        'request_type', new.request_type
      )
    )
    on conflict (recipient_user_id, dedupe_key) do update set
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

    return new;
  end if;

  if new.status is distinct from old.status then
    event_key := 'document_request:' || new.id::text || ':status:' || new.status;

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
      new.wedding_id,
      'document_request.' || new.status,
      'document_request',
      new.id,
      'Document request ' || replace(new.status, '_', ' '),
      new.title,
      event_key,
      jsonb_build_object('request_type', new.request_type, 'status', new.status)
    )
    on conflict (dedupe_key) do update set
      occurred_at = now(),
      actor_user_id = excluded.actor_user_id,
      metadata = excluded.metadata
    returning * into event_row;

    if new.status = 'viewed' then
      update public.attention_items
      set status = 'read', read_at = coalesce(read_at, now())
      where recipient_user_id = new.recipient_user_id
        and dedupe_key = 'document_request:' || new.id::text || ':recipient_action'
        and status = 'unread';
    elsif new.status = 'changes_requested' then
      insert into public.attention_items (
        recipient_user_id, recipient_role, wedding_id, event_id, source_type, source_id,
        attention_kind, priority, status, title, summary, action_label, action_path,
        due_at, dedupe_key, metadata
      )
      values (
        new.recipient_user_id, new.recipient_role, new.wedding_id, event_row.id,
        'document_request', new.id, 'action', 'action', 'unread',
        'Quote changes requested', new.requester_name || ' needs an amended quote',
        'Amend quote', recipient_path, new.due_at,
        'document_request:' || new.id::text || ':recipient_action',
        jsonb_build_object('request_type', new.request_type, 'wedding_name', new.wedding_name)
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
        dismissed_at = null;
    elsif new.status in ('responded', 'declined', 'cancelled') then
      update public.attention_items
      set
        status = 'completed',
        read_at = coalesce(read_at, now()),
        completed_at = coalesce(completed_at, now())
      where recipient_user_id = new.recipient_user_id
        and dedupe_key = 'document_request:' || new.id::text || ':recipient_action'
        and status not in ('completed', 'dismissed');

      if new.status in ('responded', 'declined') then
        insert into public.attention_items (
          recipient_user_id, recipient_role, wedding_id, event_id, source_type, source_id,
          attention_kind, priority, status, title, summary, action_label, action_path,
          dedupe_key, metadata
        )
        values (
          new.requester_user_id, new.requester_role, new.wedding_id, event_row.id,
          'document_request', new.id, 'update',
          case when new.status = 'responded' then 'action' else 'info' end,
          'unread',
          case
            when new.status = 'responded' and new.request_type = 'contract' then 'Contract received'
            when new.status = 'responded' then 'Quote received'
            else 'Request declined'
          end,
          new.recipient_name || case when new.status = 'responded' then ' responded to your request' else ' declined your request' end,
          case when new.status = 'responded' then 'Review response' else null end,
          requester_path,
          'document_request:' || new.id::text || ':requester_update:' || new.status,
          jsonb_build_object(
            'request_type', new.request_type,
            'wedding_name', new.wedding_name,
            'recipient_name', new.recipient_name
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
          dismissed_at = null;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_document_request_attention_trigger on public.document_requests;
create trigger sync_document_request_attention_trigger
after insert or update of status on public.document_requests
for each row execute function public.sync_document_request_attention();

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
select
  request.requester_user_id,
  request.wedding_id,
  'document_request.created',
  'document_request',
  request.id,
  case when request.request_type = 'contract' then 'Contract requested' else 'Quote requested' end,
  request.requester_name || ' requested ' || case when request.request_type = 'contract' then 'a contract' else 'a quote' end,
  'document_request:' || request.id::text || ':created',
  jsonb_build_object('request_type', request.request_type, 'backfilled', true)
from public.document_requests request
on conflict (dedupe_key) do nothing;

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
  due_at,
  read_at,
  dedupe_key,
  metadata
)
select
  request.recipient_user_id,
  request.recipient_role,
  request.wedding_id,
  event.id,
  'document_request',
  request.id,
  'action',
  'action',
  case when request.status = 'new' then 'unread' else 'read' end,
  case when request.status = 'changes_requested' then 'Quote changes requested'
       when request.request_type = 'contract' then 'New contract request'
       else 'New quote request'
  end,
  request.requester_name || coalesce(' · ' || nullif(request.service_category, ''), ''),
  case when request.status = 'changes_requested' then 'Amend quote'
       when request.request_type = 'contract' then 'Review contract request'
       else 'Review quote'
  end,
  case when request.recipient_role = 'vendor' then '/vendor-documents' else '/planner-documents' end,
  request.due_at,
  case when request.status = 'new' then null else coalesce(request.viewed_at, now()) end,
  'document_request:' || request.id::text || ':recipient_action',
  jsonb_build_object('request_type', request.request_type, 'backfilled', true)
from public.document_requests request
join public.workspace_events event
  on event.dedupe_key = 'document_request:' || request.id::text || ':created'
where request.status in ('new', 'viewed', 'changes_requested')
on conflict (recipient_user_id, dedupe_key) do nothing;

revoke all on function public.set_attention_item_state(uuid, text) from public, anon;
grant execute on function public.set_attention_item_state(uuid, text) to authenticated;

revoke all on function public.sync_document_request_attention() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'attention_items'
  ) then
    alter publication supabase_realtime add table public.attention_items;
  end if;
end
$$;
