create table if not exists public.vendor_enquiries (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  planner_client_id uuid null references public.planner_clients(id) on delete set null,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  vendor_listing_id uuid null references public.vendor_listings(id) on delete set null,
  recipient_name text not null,
  recipient_email text not null,
  recipient_source text not null check (recipient_source in ('tracker', 'zania_listing', 'explicit')),
  sender_name text not null,
  subject text not null,
  message text not null,
  channel text not null default 'email' check (channel = 'email'),
  delivery_provider text not null default 'resend' check (delivery_provider = 'resend'),
  delivery_status text not null default 'sending' check (delivery_status in ('sending', 'sent', 'failed')),
  provider_message_id text null,
  sent_at timestamptz null,
  failed_at timestamptz null,
  failure_message text null,
  gateway_idempotency_key uuid not null,
  created_via text not null default 'intelligence_gateway',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists vendor_enquiries_gateway_idempotency_key_unique
  on public.vendor_enquiries (gateway_idempotency_key);
create index if not exists vendor_enquiries_owner_created_idx
  on public.vendor_enquiries (owner_user_id, created_at desc);
create index if not exists vendor_enquiries_vendor_created_idx
  on public.vendor_enquiries (vendor_id, created_at desc);

drop trigger if exists update_vendor_enquiries_updated_at on public.vendor_enquiries;
create trigger update_vendor_enquiries_updated_at
before update on public.vendor_enquiries
for each row execute function public.update_updated_at_column();

alter table public.vendor_enquiries enable row level security;
revoke all on table public.vendor_enquiries from anon;
grant select, insert, update on table public.vendor_enquiries to authenticated;

drop policy if exists "Enquiry senders can view their enquiries" on public.vendor_enquiries;
create policy "Enquiry senders can view their enquiries"
on public.vendor_enquiries for select to authenticated
using (owner_user_id = auth.uid());

drop policy if exists "Wedding managers can create their enquiries" on public.vendor_enquiries;
create policy "Wedding managers can create their enquiries"
on public.vendor_enquiries for insert to authenticated
with check (
  owner_user_id = auth.uid()
  and (
    public.can_manage_wedding_memberships(wedding_id)
    or exists (
      select 1 from public.planner_clients pc
      where pc.id = planner_client_id
        and pc.wedding_id = wedding_id
        and pc.planner_user_id = auth.uid()
        and pc.is_archived = false
        and pc.linked_user_id is null
    )
  )
  and exists (
    select 1 from public.vendors v
    where v.id = vendor_id and v.wedding_id = wedding_id
  )
);

drop policy if exists "Enquiry senders can update their enquiries" on public.vendor_enquiries;
create policy "Enquiry senders can update their enquiries"
on public.vendor_enquiries for update to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

alter table public.intelligence_gateway_confirmations
  add column if not exists result_vendor_enquiry_id uuid
    references public.vendor_enquiries(id) on delete set null;

alter table public.intelligence_gateway_confirmations
  drop constraint if exists intelligence_gateway_confirmations_capability_check;

alter table public.intelligence_gateway_confirmations
  add constraint intelligence_gateway_confirmations_capability_check
  check (capability in (
    'create_task',
    'update_task',
    'add_guest',
    'record_expense',
    'create_vendor_follow_up_reminder',
    'record_payment',
    'save_vendor_candidate',
    'assign_vendor_candidate',
    'promote_vendor_candidate',
    'send_vendor_enquiry'
  ));

comment on table public.vendor_enquiries is
  'Confirmed outbound vendor enquiries. These records do not represent bookings or verified quotes.';
