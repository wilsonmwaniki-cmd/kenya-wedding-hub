create table if not exists public.ai_assistant_memories (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  workspace_key text not null default 'personal',
  memory_type text not null,
  memory_key text not null,
  memory_value jsonb not null,
  source text not null default 'assistant_confirmation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_assistant_memories_type_check
    check (memory_type in ('preference', 'decision', 'dismissed_suggestion')),
  constraint ai_assistant_memories_workspace_key_check
    check (length(trim(workspace_key)) between 1 and 120),
  constraint ai_assistant_memories_key_check
    check (length(trim(memory_key)) between 1 and 120),
  constraint ai_assistant_memories_value_size_check
    check (octet_length(memory_value::text) <= 8000),
  constraint ai_assistant_memories_owner_workspace_key_unique
    unique (owner_user_id, workspace_key, memory_type, memory_key)
);

create index if not exists ai_assistant_memories_owner_workspace_idx
  on public.ai_assistant_memories (owner_user_id, workspace_key, updated_at desc);

alter table public.ai_assistant_memories enable row level security;

revoke all on table public.ai_assistant_memories from public, anon, authenticated;
grant select, insert, update, delete on table public.ai_assistant_memories to authenticated;
grant all on table public.ai_assistant_memories to service_role;

drop policy if exists "Users can read their own assistant memories" on public.ai_assistant_memories;
create policy "Users can read their own assistant memories"
  on public.ai_assistant_memories
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = owner_user_id);

drop policy if exists "Users can create their own assistant memories" on public.ai_assistant_memories;
create policy "Users can create their own assistant memories"
  on public.ai_assistant_memories
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = owner_user_id);

drop policy if exists "Users can update their own assistant memories" on public.ai_assistant_memories;
create policy "Users can update their own assistant memories"
  on public.ai_assistant_memories
  for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = owner_user_id);

drop policy if exists "Users can delete their own assistant memories" on public.ai_assistant_memories;
create policy "Users can delete their own assistant memories"
  on public.ai_assistant_memories
  for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = owner_user_id);
