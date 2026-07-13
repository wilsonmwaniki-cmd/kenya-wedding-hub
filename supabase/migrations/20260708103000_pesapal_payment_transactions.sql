create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  provider text not null
    check (provider in ('stripe', 'pesapal')),
  user_id uuid not null references auth.users(id) on delete cascade,
  wedding_id uuid null references public.weddings(id) on delete cascade,
  audience text not null
    check (audience in ('couple', 'planner', 'vendor')),
  feature text null,
  lookup_key text not null,
  merchant_reference text not null unique,
  provider_reference text null unique,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed', 'invalid')),
  currency text not null default 'KES',
  amount numeric(12, 2) not null check (amount >= 0),
  callback_url text null,
  cancel_url text null,
  redirect_url text null,
  notification_id text null,
  payment_method text null,
  payment_account text null,
  confirmation_code text null,
  provider_status_code text null,
  provider_status_description text null,
  provider_created_at timestamptz null,
  raw_request jsonb not null default '{}'::jsonb,
  raw_response jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_transactions_user_id_idx
  on public.payment_transactions (user_id);

create index if not exists payment_transactions_wedding_id_idx
  on public.payment_transactions (wedding_id);

create index if not exists payment_transactions_provider_status_idx
  on public.payment_transactions (provider, status);

create index if not exists payment_transactions_lookup_key_idx
  on public.payment_transactions (lookup_key);

drop trigger if exists update_payment_transactions_updated_at on public.payment_transactions;
create trigger update_payment_transactions_updated_at
before update on public.payment_transactions
for each row execute function public.update_updated_at_column();

alter table public.payment_transactions enable row level security;

drop policy if exists "Users can view own payment transactions" on public.payment_transactions;
create policy "Users can view own payment transactions"
on public.payment_transactions for select
to authenticated
using (auth.uid() = user_id);
