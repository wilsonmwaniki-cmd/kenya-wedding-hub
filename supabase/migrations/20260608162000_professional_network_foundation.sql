create table if not exists public.professional_network_relationships (
  id uuid primary key default gen_random_uuid(),
  source_user_id uuid not null references auth.users(id) on delete cascade,
  source_role public.app_role not null,
  target_user_id uuid null references auth.users(id) on delete cascade,
  target_vendor_listing_id uuid null references public.vendor_listings(id) on delete cascade,
  relationship_type text not null,
  note text null,
  is_public boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_network_relationships_target_check
    check ((target_user_id is not null and target_vendor_listing_id is null) or (target_user_id is null and target_vendor_listing_id is not null)),
  constraint professional_network_relationships_role_check
    check (source_role in ('planner', 'vendor', 'admin')),
  constraint professional_network_relationships_type_check
    check (relationship_type in ('recommended', 'worked_with', 'preferred_vendor', 'trusted_collaborator'))
);

create unique index if not exists professional_network_relationships_unique_public_signal
  on public.professional_network_relationships (source_user_id, coalesce(target_user_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(target_vendor_listing_id, '00000000-0000-0000-0000-000000000000'::uuid), relationship_type);

create index if not exists professional_network_relationships_target_user_idx
  on public.professional_network_relationships (target_user_id)
  where target_user_id is not null;

create index if not exists professional_network_relationships_target_vendor_idx
  on public.professional_network_relationships (target_vendor_listing_id)
  where target_vendor_listing_id is not null;

create index if not exists professional_network_relationships_source_user_idx
  on public.professional_network_relationships (source_user_id, created_at desc);

alter table public.professional_network_relationships enable row level security;

drop policy if exists "Public can view public professional relationships" on public.professional_network_relationships;
create policy "Public can view public professional relationships"
on public.professional_network_relationships
for select
using (active = true and is_public = true);

drop policy if exists "Participants can view professional relationships" on public.professional_network_relationships;
create policy "Participants can view professional relationships"
on public.professional_network_relationships
for select
to authenticated
using (
  source_user_id = auth.uid()
  or target_user_id = auth.uid()
  or exists (
    select 1
    from public.vendor_listings vl
    where vl.id = target_vendor_listing_id
      and vl.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'::public.app_role
  )
);

drop policy if exists "Professionals can create professional relationships" on public.professional_network_relationships;
create policy "Professionals can create professional relationships"
on public.professional_network_relationships
for insert
to authenticated
with check (
  source_user_id = auth.uid()
  and source_role in ('planner'::public.app_role, 'vendor'::public.app_role, 'admin'::public.app_role)
  and (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role = source_role
    )
    or exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'admin'::public.app_role
    )
  )
);

drop policy if exists "Authors can update professional relationships" on public.professional_network_relationships;
create policy "Authors can update professional relationships"
on public.professional_network_relationships
for update
to authenticated
using (
  source_user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'::public.app_role
  )
)
with check (
  source_user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'::public.app_role
  )
);

drop policy if exists "Authors can delete professional relationships" on public.professional_network_relationships;
create policy "Authors can delete professional relationships"
on public.professional_network_relationships
for delete
to authenticated
using (
  source_user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'::public.app_role
  )
);

grant select on public.professional_network_relationships to anon;
grant select, insert, update, delete on public.professional_network_relationships to authenticated;

drop trigger if exists update_professional_network_relationships_updated_at on public.professional_network_relationships;
create trigger update_professional_network_relationships_updated_at
before update on public.professional_network_relationships
for each row execute function public.update_updated_at_column();

create table if not exists public.professional_network_threads (
  id uuid primary key default gen_random_uuid(),
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  created_by_role public.app_role not null,
  planner_user_id uuid not null references auth.users(id) on delete cascade,
  vendor_user_id uuid not null references auth.users(id) on delete cascade,
  vendor_listing_id uuid not null references public.vendor_listings(id) on delete cascade,
  subject text not null,
  context_type text not null default 'general',
  archived_by_planner boolean not null default false,
  archived_by_vendor boolean not null default false,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_network_threads_creator_role_check
    check (created_by_role in ('planner', 'vendor', 'admin')),
  constraint professional_network_threads_context_type_check
    check (context_type in ('introduction', 'booking', 'partnership', 'general'))
);

create index if not exists professional_network_threads_planner_idx
  on public.professional_network_threads (planner_user_id, last_message_at desc);

create index if not exists professional_network_threads_vendor_idx
  on public.professional_network_threads (vendor_user_id, last_message_at desc);

create index if not exists professional_network_threads_vendor_listing_idx
  on public.professional_network_threads (vendor_listing_id, last_message_at desc);

alter table public.professional_network_threads enable row level security;

drop policy if exists "Participants can view professional threads" on public.professional_network_threads;
create policy "Participants can view professional threads"
on public.professional_network_threads
for select
to authenticated
using (
  planner_user_id = auth.uid()
  or vendor_user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'::public.app_role
  )
);

drop policy if exists "Participants can create professional threads" on public.professional_network_threads;
create policy "Participants can create professional threads"
on public.professional_network_threads
for insert
to authenticated
with check (
  created_by_user_id = auth.uid()
  and (
    planner_user_id = auth.uid()
    or vendor_user_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'admin'::public.app_role
    )
  )
);

drop policy if exists "Participants can update professional threads" on public.professional_network_threads;
create policy "Participants can update professional threads"
on public.professional_network_threads
for update
to authenticated
using (
  planner_user_id = auth.uid()
  or vendor_user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'::public.app_role
  )
)
with check (
  planner_user_id = auth.uid()
  or vendor_user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'::public.app_role
  )
);

grant select, insert, update on public.professional_network_threads to authenticated;

drop trigger if exists update_professional_network_threads_updated_at on public.professional_network_threads;
create trigger update_professional_network_threads_updated_at
before update on public.professional_network_threads
for each row execute function public.update_updated_at_column();

create table if not exists public.professional_network_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.professional_network_threads(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_role public.app_role not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint professional_network_messages_sender_role_check
    check (sender_role in ('planner', 'vendor', 'admin'))
);

create index if not exists professional_network_messages_thread_idx
  on public.professional_network_messages (thread_id, created_at asc);

alter table public.professional_network_messages enable row level security;

drop policy if exists "Participants can view professional messages" on public.professional_network_messages;
create policy "Participants can view professional messages"
on public.professional_network_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.professional_network_threads t
    where t.id = thread_id
      and (
        t.planner_user_id = auth.uid()
        or t.vendor_user_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.user_id = auth.uid()
            and p.role = 'admin'::public.app_role
        )
      )
  )
);

drop policy if exists "Participants can create professional messages" on public.professional_network_messages;
create policy "Participants can create professional messages"
on public.professional_network_messages
for insert
to authenticated
with check (
  sender_user_id = auth.uid()
  and exists (
    select 1
    from public.professional_network_threads t
    where t.id = thread_id
      and (
        t.planner_user_id = auth.uid()
        or t.vendor_user_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.user_id = auth.uid()
            and p.role = 'admin'::public.app_role
        )
      )
  )
);

grant select, insert on public.professional_network_messages to authenticated;
