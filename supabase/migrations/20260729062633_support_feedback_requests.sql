create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique
    default ('ZN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  user_name text null,
  user_role text not null check (user_role in ('couple', 'planner', 'vendor', 'admin')),
  category text not null check (category in ('bug', 'confusing', 'suggestion', 'billing')),
  message text not null check (char_length(message) between 5 and 4000),
  page_path text not null,
  page_url text null,
  workspace_label text null,
  wedding_id uuid null references public.weddings(id) on delete set null,
  planner_client_id uuid null references public.planner_clients(id) on delete set null,
  error_reference text null,
  browser_context jsonb not null default '{}'::jsonb,
  screenshot_name text null,
  screenshot_type text null,
  screenshot_size_bytes integer null check (screenshot_size_bytes is null or screenshot_size_bytes between 1 and 4194304),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_on_user', 'resolved', 'closed')),
  email_delivery_status text not null default 'pending' check (email_delivery_status in ('pending', 'sent', 'failed')),
  resend_email_id text null,
  resolved_at timestamptz null
);

create index support_requests_user_created_idx
  on public.support_requests (user_id, created_at desc);

create index support_requests_status_created_idx
  on public.support_requests (status, created_at desc);

drop trigger if exists update_support_requests_updated_at on public.support_requests;
create trigger update_support_requests_updated_at
before update on public.support_requests
for each row execute function public.update_updated_at_column();

alter table public.support_requests enable row level security;

revoke all on table public.support_requests from public, anon;
revoke insert, update, delete on table public.support_requests from authenticated;
grant select on table public.support_requests to authenticated;

create policy "Users can view their own support requests"
on public.support_requests
for select
to authenticated
using ((select auth.uid()) = user_id);
