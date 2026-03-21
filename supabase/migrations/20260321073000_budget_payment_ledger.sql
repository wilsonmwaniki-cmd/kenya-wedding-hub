create table if not exists public.budget_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid null references public.planner_clients(id) on delete cascade,
  budget_category_id uuid null references public.budget_categories(id) on delete set null,
  vendor_id uuid null references public.vendors(id) on delete set null,
  budget_scope text not null default 'wedding' check (budget_scope in ('wedding', 'personal')),
  category_name text not null,
  payee_name text not null,
  amount numeric not null default 0 check (amount >= 0),
  payment_date date not null default current_date,
  reference text null,
  notes text null,
  created_at timestamptz not null default now()
);

alter table public.budget_payments enable row level security;

drop policy if exists "Users can view their budget payments" on public.budget_payments;
create policy "Users can view their budget payments"
on public.budget_payments
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their budget payments" on public.budget_payments;
create policy "Users can insert their budget payments"
on public.budget_payments
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their budget payments" on public.budget_payments;
create policy "Users can update their budget payments"
on public.budget_payments
for update
using (auth.uid() = user_id);

drop policy if exists "Users can delete their budget payments" on public.budget_payments;
create policy "Users can delete their budget payments"
on public.budget_payments
for delete
using (auth.uid() = user_id);

create index if not exists budget_payments_user_id_idx on public.budget_payments(user_id);
create index if not exists budget_payments_client_id_idx on public.budget_payments(client_id);
create index if not exists budget_payments_vendor_id_idx on public.budget_payments(vendor_id);
create index if not exists budget_payments_payment_date_idx on public.budget_payments(payment_date desc);
