create table public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  audience text not null check (audience in ('couple', 'planner', 'committee', 'vendor')),
  status text not null default 'active' check (status in ('active', 'archived')),
  title text not null default 'Ask Zania',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index assistant_conversations_one_active_per_audience_idx
  on public.assistant_conversations (user_id, audience)
  where status = 'active';

create index assistant_conversations_user_updated_idx
  on public.assistant_conversations (user_id, updated_at desc);

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  request_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 20000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (conversation_id, request_id, role)
);

create index assistant_messages_conversation_created_idx
  on public.assistant_messages (conversation_id, created_at, id);

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;

create policy "Users can read their assistant conversations"
  on public.assistant_conversations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read messages in their assistant conversations"
  on public.assistant_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.assistant_conversations conversation
      where conversation.id = assistant_messages.conversation_id
        and conversation.user_id = (select auth.uid())
    )
  );

revoke all on public.assistant_conversations from anon, authenticated;
revoke all on public.assistant_messages from anon, authenticated;
grant select on public.assistant_conversations to authenticated;
grant select on public.assistant_messages to authenticated;
grant all on public.assistant_conversations to service_role;
grant all on public.assistant_messages to service_role;

-- Ask Zania is included in the paid Collaborative couple plan. Keep the
-- database catalog aligned with the web and Edge Function entitlement checks.
update public.pricing_catalog
set config = jsonb_set(
  config,
  '{checkout,coupleCheckoutMap}',
  jsonb_set(
    jsonb_set(
      config #> '{checkout,coupleCheckoutMap}',
      '{couple_collaborative_monthly,features}',
      coalesce(config #> '{checkout,coupleCheckoutMap,couple_collaborative_monthly,features}', '[]'::jsonb)
        || '["ai_wedding_assistant"]'::jsonb,
      true
    ),
    '{couple_collaborative_annual,features}',
    coalesce(config #> '{checkout,coupleCheckoutMap,couple_collaborative_annual,features}', '[]'::jsonb)
      || '["ai_wedding_assistant"]'::jsonb,
    true
  ),
  true
), updated_at = now()
where is_active = true;

insert into public.wedding_entitlements (
  wedding_id,
  feature_key,
  status,
  source_bundle_id,
  effective_from,
  effective_to,
  metadata
)
select
  bundle.wedding_id,
  'ai_wedding_assistant',
  'active',
  bundle.id,
  coalesce(bundle.activated_at, now()),
  bundle.expires_at,
  jsonb_build_object('source', 'collaborative_assistant_backfill')
from public.wedding_subscription_bundles bundle
where bundle.bundle_code in ('couple_collaborative_monthly', 'couple_collaborative_annual')
  and bundle.status in ('active', 'grace')
on conflict (wedding_id, feature_key) do update
set status = 'active',
    source_bundle_id = excluded.source_bundle_id,
    effective_from = excluded.effective_from,
    effective_to = excluded.effective_to,
    metadata = public.wedding_entitlements.metadata || excluded.metadata,
    updated_at = now();
