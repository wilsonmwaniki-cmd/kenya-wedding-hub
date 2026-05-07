create table if not exists public.professional_contracts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('vendor', 'planner')),
  title text not null,
  status text not null check (status in ('draft', 'sent', 'awaiting_signature', 'countersigned', 'completed', 'cancelled')) default 'draft',
  recipient_name text not null,
  recipient_email text null,
  recipient_phone text null,
  wedding_name text null,
  client_id uuid null references public.planner_clients(id) on delete set null,
  vendor_listing_id uuid null references public.vendor_listings(id) on delete set null,
  vendor_id uuid null references public.vendors(id) on delete set null,
  event_date date null,
  sent_at timestamptz null,
  signed_at timestamptz null,
  cancelled_at timestamptz null,
  summary text null,
  notes text null,
  terms text null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.professional_document_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('vendor', 'planner')),
  template_type text not null check (template_type in ('quote', 'invoice', 'receipt', 'contract')),
  name text not null,
  description text null,
  default_title text null,
  default_notes text null,
  default_terms text null,
  default_items jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  constraint professional_document_templates_user_name_key unique (user_id, name)
);

create index if not exists professional_contracts_user_id_idx on public.professional_contracts(user_id);
create index if not exists professional_contracts_role_idx on public.professional_contracts(role);
create index if not exists professional_contracts_status_idx on public.professional_contracts(status);
create index if not exists professional_contracts_client_id_idx on public.professional_contracts(client_id);
create index if not exists professional_contracts_vendor_listing_id_idx on public.professional_contracts(vendor_listing_id);
create index if not exists professional_contracts_vendor_id_idx on public.professional_contracts(vendor_id);
create index if not exists professional_contracts_event_date_idx on public.professional_contracts(event_date desc);

create index if not exists professional_document_templates_user_id_idx on public.professional_document_templates(user_id);
create index if not exists professional_document_templates_role_idx on public.professional_document_templates(role);
create index if not exists professional_document_templates_template_type_idx on public.professional_document_templates(template_type);

alter table public.professional_contracts enable row level security;
alter table public.professional_document_templates enable row level security;

drop policy if exists "Users can view own professional contracts" on public.professional_contracts;
create policy "Users can view own professional contracts"
on public.professional_contracts
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own professional contracts" on public.professional_contracts;
create policy "Users can insert own professional contracts"
on public.professional_contracts
for insert
with check (auth.uid() = user_id and role in ('vendor', 'planner'));

drop policy if exists "Users can update own professional contracts" on public.professional_contracts;
create policy "Users can update own professional contracts"
on public.professional_contracts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id and role in ('vendor', 'planner'));

drop policy if exists "Users can delete own professional contracts" on public.professional_contracts;
create policy "Users can delete own professional contracts"
on public.professional_contracts
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own document templates" on public.professional_document_templates;
create policy "Users can view own document templates"
on public.professional_document_templates
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own document templates" on public.professional_document_templates;
create policy "Users can insert own document templates"
on public.professional_document_templates
for insert
with check (auth.uid() = user_id and role in ('vendor', 'planner'));

drop policy if exists "Users can update own document templates" on public.professional_document_templates;
create policy "Users can update own document templates"
on public.professional_document_templates
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id and role in ('vendor', 'planner'));

drop policy if exists "Users can delete own document templates" on public.professional_document_templates;
create policy "Users can delete own document templates"
on public.professional_document_templates
for delete
using (auth.uid() = user_id);

drop trigger if exists update_professional_contracts_updated_at on public.professional_contracts;
create trigger update_professional_contracts_updated_at
before update on public.professional_contracts
for each row execute function public.update_updated_at_column();

drop trigger if exists update_professional_document_templates_updated_at on public.professional_document_templates;
create trigger update_professional_document_templates_updated_at
before update on public.professional_document_templates
for each row execute function public.update_updated_at_column();
