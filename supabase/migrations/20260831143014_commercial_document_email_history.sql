create table if not exists public.commercial_document_email_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.commercial_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text not null,
  subject text not null,
  provider text not null default 'resend',
  provider_message_id text null,
  sent_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists commercial_document_email_events_document_sent_idx
  on public.commercial_document_email_events (document_id, sent_at desc);

create index if not exists commercial_document_email_events_user_sent_idx
  on public.commercial_document_email_events (user_id, sent_at desc);

alter table public.commercial_document_email_events enable row level security;

drop policy if exists "Users can view own commercial document email history"
  on public.commercial_document_email_events;
create policy "Users can view own commercial document email history"
on public.commercial_document_email_events
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.commercial_document_email_events from anon;
revoke insert, update, delete on table public.commercial_document_email_events from authenticated;
grant select on table public.commercial_document_email_events to authenticated;
