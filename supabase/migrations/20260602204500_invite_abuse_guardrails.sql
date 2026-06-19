alter table public.guests
  add column if not exists invite_last_sent_at timestamptz null,
  add column if not exists invite_send_count integer not null default 0,
  add column if not exists invite_last_sent_by_user_id uuid null references auth.users(id) on delete set null;

create index if not exists guests_invite_last_sent_at_idx
  on public.guests (invite_last_sent_at desc)
  where invite_last_sent_at is not null;

create index if not exists function_event_logs_function_user_created_idx
  on public.function_event_logs (function_name, user_id, created_at desc);

create index if not exists function_event_logs_event_type_created_idx
  on public.function_event_logs (event_type, created_at desc);
