create table if not exists public.professional_network_recommendation_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  requester_role public.app_role not null,
  requester_vendor_listing_id uuid null references public.vendor_listings(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_vendor_listing_id uuid null references public.vendor_listings(id) on delete cascade,
  requested_relationship_type text not null,
  request_message text null,
  response_note text null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz null,
  updated_at timestamptz not null default now(),
  constraint professional_network_recommendation_requests_role_check
    check (requester_role in ('planner', 'vendor', 'admin')),
  constraint professional_network_recommendation_requests_type_check
    check (requested_relationship_type in ('recommended', 'worked_with', 'preferred_vendor', 'trusted_collaborator')),
  constraint professional_network_recommendation_requests_status_check
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  constraint professional_network_recommendation_requests_vendor_link_check
    check (
      (requester_role = 'vendor'::public.app_role and requester_vendor_listing_id is not null)
      or (requester_role <> 'vendor'::public.app_role and requester_vendor_listing_id is null)
    )
);

create unique index if not exists professional_network_recommendation_requests_unique_pending
  on public.professional_network_recommendation_requests (
    requester_user_id,
    coalesce(requester_vendor_listing_id, '00000000-0000-0000-0000-000000000000'::uuid),
    recipient_user_id,
    coalesce(recipient_vendor_listing_id, '00000000-0000-0000-0000-000000000000'::uuid),
    requested_relationship_type
  )
  where status = 'pending';

create index if not exists professional_network_recommendation_requests_requester_idx
  on public.professional_network_recommendation_requests (requester_user_id, created_at desc);

create index if not exists professional_network_recommendation_requests_recipient_idx
  on public.professional_network_recommendation_requests (recipient_user_id, created_at desc);

create index if not exists professional_network_recommendation_requests_recipient_vendor_idx
  on public.professional_network_recommendation_requests (recipient_vendor_listing_id, created_at desc)
  where recipient_vendor_listing_id is not null;

alter table public.professional_network_recommendation_requests enable row level security;

drop policy if exists "Participants can view recommendation requests" on public.professional_network_recommendation_requests;
create policy "Participants can view recommendation requests"
on public.professional_network_recommendation_requests
for select
to authenticated
using (
  requester_user_id = auth.uid()
  or recipient_user_id = auth.uid()
  or exists (
    select 1
    from public.vendor_listings vl
    where vl.id = recipient_vendor_listing_id
      and vl.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'::public.app_role
  )
);

drop policy if exists "Professionals can create recommendation requests" on public.professional_network_recommendation_requests;
create policy "Professionals can create recommendation requests"
on public.professional_network_recommendation_requests
for insert
to authenticated
with check (
  requester_user_id = auth.uid()
  and requester_role in ('planner'::public.app_role, 'vendor'::public.app_role, 'admin'::public.app_role)
  and recipient_user_id <> auth.uid()
  and (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role = requester_role
    )
    or exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'admin'::public.app_role
    )
  )
  and (
    requester_role <> 'vendor'::public.app_role
    or exists (
      select 1
      from public.vendor_listings vl
      where vl.id = requester_vendor_listing_id
        and vl.user_id = auth.uid()
    )
  )
);

drop policy if exists "Participants can update recommendation requests" on public.professional_network_recommendation_requests;
create policy "Participants can update recommendation requests"
on public.professional_network_recommendation_requests
for update
to authenticated
using (
  requester_user_id = auth.uid()
  or recipient_user_id = auth.uid()
  or exists (
    select 1
    from public.vendor_listings vl
    where vl.id = recipient_vendor_listing_id
      and vl.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'::public.app_role
  )
)
with check (
  requester_user_id = auth.uid()
  or recipient_user_id = auth.uid()
  or exists (
    select 1
    from public.vendor_listings vl
    where vl.id = recipient_vendor_listing_id
      and vl.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'::public.app_role
  )
);

grant select, insert, update on public.professional_network_recommendation_requests to authenticated;

drop trigger if exists update_professional_network_recommendation_requests_updated_at on public.professional_network_recommendation_requests;
create trigger update_professional_network_recommendation_requests_updated_at
before update on public.professional_network_recommendation_requests
for each row execute function public.update_updated_at_column();
