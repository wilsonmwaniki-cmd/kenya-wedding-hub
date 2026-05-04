create table if not exists public.contribution_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  client_id uuid null references public.planner_clients(id) on delete cascade,
  title text not null,
  goal_amount numeric(12,2) not null default 0,
  notes text null,
  starts_on date null,
  ends_on date null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wedding_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  client_id uuid null references public.planner_clients(id) on delete cascade,
  round_id uuid null references public.contribution_rounds(id) on delete set null,
  contributor_name text not null,
  contributor_phone text null,
  contributor_group text null,
  contribution_type text not null default 'cash'
    check (contribution_type in ('cash', 'in_kind')),
  status text not null default 'pledged'
    check (status in ('pledged', 'partial', 'paid', 'in_kind', 'cancelled')),
  payment_method text not null default 'mpesa'
    check (payment_method in ('mpesa', 'cash', 'bank', 'other', 'in_kind')),
  pledged_amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  in_kind_value numeric(12,2) not null default 0,
  in_kind_item text null,
  purpose text null,
  paid_on date null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contribution_rounds_user_id_idx
  on public.contribution_rounds(user_id);

create index if not exists contribution_rounds_client_id_idx
  on public.contribution_rounds(client_id);

create index if not exists wedding_contributions_user_id_idx
  on public.wedding_contributions(user_id);

create index if not exists wedding_contributions_client_id_idx
  on public.wedding_contributions(client_id);

create index if not exists wedding_contributions_round_id_idx
  on public.wedding_contributions(round_id);

create or replace function public.can_access_contribution_record(_user_id uuid, _client_id uuid)
returns boolean
language sql
stable
as $$
  select
    auth.uid() = _user_id
    or public.is_linked_planner_of(_user_id)
    or public.is_linked_couple_of(_client_id);
$$;

alter table public.contribution_rounds enable row level security;
alter table public.wedding_contributions enable row level security;

drop policy if exists "Users can manage own contribution rounds" on public.contribution_rounds;
create policy "Users can manage own contribution rounds"
on public.contribution_rounds
for all
using (public.can_access_contribution_record(user_id, client_id))
with check (public.can_access_contribution_record(user_id, client_id));

drop policy if exists "Users can manage own wedding contributions" on public.wedding_contributions;
create policy "Users can manage own wedding contributions"
on public.wedding_contributions
for all
using (public.can_access_contribution_record(user_id, client_id))
with check (public.can_access_contribution_record(user_id, client_id));

drop trigger if exists update_contribution_rounds_updated_at on public.contribution_rounds;
create trigger update_contribution_rounds_updated_at
before update on public.contribution_rounds
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_wedding_contributions_updated_at on public.wedding_contributions;
create trigger update_wedding_contributions_updated_at
before update on public.wedding_contributions
for each row
execute function public.update_updated_at_column();
