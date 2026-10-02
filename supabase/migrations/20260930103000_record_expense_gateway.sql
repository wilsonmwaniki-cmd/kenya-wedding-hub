create table if not exists public.budget_expense_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  client_id uuid null references public.planner_clients(id) on delete cascade,
  budget_category_id uuid null references public.budget_categories(id) on delete set null,
  category_name text not null,
  payee_name text not null,
  amount numeric(14,2) not null check (amount > 0),
  expense_date date not null,
  notes text null,
  idempotency_key uuid not null unique,
  created_via text not null default 'intelligence_gateway',
  created_at timestamptz not null default now()
);

create index if not exists budget_expense_adjustments_wedding_date_idx
  on public.budget_expense_adjustments (wedding_id, expense_date desc);

create index if not exists budget_expense_adjustments_category_idx
  on public.budget_expense_adjustments (budget_category_id, expense_date desc);

alter table public.budget_expense_adjustments enable row level security;

create policy "Users can view own budget expense adjustments"
  on public.budget_expense_adjustments for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create own budget expense adjustments"
  on public.budget_expense_adjustments for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own budget expense adjustments"
  on public.budget_expense_adjustments for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.budget_expense_adjustments from anon;
grant select, insert, delete on table public.budget_expense_adjustments to authenticated;

create or replace function public.apply_budget_expense_adjustment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.budget_category_id is not null then
    update public.budget_categories
    set spent = round((coalesce(spent, 0) + new.amount)::numeric, 2)
    where id = new.budget_category_id
      and wedding_id = new.wedding_id;
    if not found then
      raise exception 'Budget category is not available for this wedding';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' and old.budget_category_id is not null then
    update public.budget_categories
    set spent = greatest(round((coalesce(spent, 0) - old.amount)::numeric, 2), 0)
    where id = old.budget_category_id
      and wedding_id = old.wedding_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists apply_budget_expense_adjustment_trigger on public.budget_expense_adjustments;
create trigger apply_budget_expense_adjustment_trigger
after insert or delete on public.budget_expense_adjustments
for each row execute function public.apply_budget_expense_adjustment();

alter table public.intelligence_gateway_confirmations
  add column if not exists result_expense_id uuid references public.budget_expense_adjustments(id) on delete set null;

alter table public.intelligence_gateway_confirmations
  drop constraint if exists intelligence_gateway_confirmations_capability_check;

alter table public.intelligence_gateway_confirmations
  add constraint intelligence_gateway_confirmations_capability_check
  check (capability in ('create_task', 'update_task', 'add_guest', 'record_expense'));
