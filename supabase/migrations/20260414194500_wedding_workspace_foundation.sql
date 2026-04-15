-- Wedding workspace foundation
-- Introduces wedding-scoped ownership, membership, invite, and entitlement tables
-- without removing the legacy planner_clients/profile-first model yet.

create table if not exists public.weddings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text null,
  wedding_code text not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived', 'cancelled')),
  wedding_date date null,
  location_county text null,
  location_town text null,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists weddings_wedding_code_key
  on public.weddings (wedding_code);

create index if not exists weddings_created_by_user_id_idx
  on public.weddings (created_by_user_id);

drop trigger if exists update_weddings_updated_at on public.weddings;
create trigger update_weddings_updated_at
before update on public.weddings
for each row execute function public.update_updated_at_column();

create table if not exists public.wedding_memberships (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  email text not null,
  role text not null
    check (role in ('bride', 'groom', 'committee_chair', 'committee_member', 'planner', 'family_contributor', 'viewer')),
  membership_status text not null default 'invited'
    check (membership_status in ('invited', 'active', 'declined', 'revoked', 'expired')),
  is_owner boolean not null default false,
  invited_by_user_id uuid null references auth.users(id) on delete set null,
  accepted_at timestamptz null,
  revoked_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wedding_memberships_wedding_id_idx
  on public.wedding_memberships (wedding_id);

create index if not exists wedding_memberships_user_id_idx
  on public.wedding_memberships (user_id);

create index if not exists wedding_memberships_email_idx
  on public.wedding_memberships (lower(email));

create unique index if not exists wedding_memberships_unique_user_role_per_wedding
  on public.wedding_memberships (wedding_id, user_id, role)
  where user_id is not null and membership_status in ('invited', 'active');

create unique index if not exists wedding_memberships_unique_email_role_per_wedding
  on public.wedding_memberships (wedding_id, lower(email), role)
  where membership_status in ('invited', 'active');

create unique index if not exists wedding_memberships_max_two_owners
  on public.wedding_memberships (wedding_id, role)
  where is_owner = true and membership_status in ('invited', 'active') and role in ('bride', 'groom');

drop trigger if exists update_wedding_memberships_updated_at on public.wedding_memberships;
create trigger update_wedding_memberships_updated_at
before update on public.wedding_memberships
for each row execute function public.update_updated_at_column();

create table if not exists public.wedding_invites (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  membership_id uuid null references public.wedding_memberships(id) on delete set null,
  email text not null,
  invite_type text not null
    check (invite_type in ('partner', 'committee', 'planner', 'family_contributor', 'viewer')),
  proposed_role text not null
    check (proposed_role in ('bride', 'groom', 'committee_chair', 'committee_member', 'planner', 'family_contributor', 'viewer')),
  invite_token uuid not null default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  expires_at timestamptz null,
  sent_at timestamptz null,
  accepted_at timestamptz null,
  created_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists wedding_invites_invite_token_key
  on public.wedding_invites (invite_token);

create index if not exists wedding_invites_wedding_id_idx
  on public.wedding_invites (wedding_id);

create index if not exists wedding_invites_email_idx
  on public.wedding_invites (lower(email));

drop trigger if exists update_wedding_invites_updated_at on public.wedding_invites;
create trigger update_wedding_invites_updated_at
before update on public.wedding_invites
for each row execute function public.update_updated_at_column();

create table if not exists public.wedding_subscription_bundles (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  bundle_code text not null,
  bundle_type text not null
    check (bundle_type in ('wedding_pass', 'committee_bundle', 'planner_addon', 'export_addon', 'calendar_addon', 'ai_addon')),
  status text not null default 'inactive'
    check (status in ('inactive', 'active', 'expired', 'cancelled', 'grace')),
  billing_cycle text not null default 'annual'
    check (billing_cycle in ('one_time', 'annual', 'monthly')),
  seat_limit integer null,
  seats_used integer not null default 0,
  activated_at timestamptz null,
  expires_at timestamptz null,
  grace_ends_at timestamptz null,
  billing_provider text null,
  billing_reference text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (seat_limit is null or seat_limit >= 0),
  check (seats_used >= 0),
  check (seat_limit is null or seats_used <= seat_limit)
);

create index if not exists wedding_subscription_bundles_wedding_id_idx
  on public.wedding_subscription_bundles (wedding_id);

create index if not exists wedding_subscription_bundles_status_idx
  on public.wedding_subscription_bundles (status);

drop trigger if exists update_wedding_subscription_bundles_updated_at on public.wedding_subscription_bundles;
create trigger update_wedding_subscription_bundles_updated_at
before update on public.wedding_subscription_bundles
for each row execute function public.update_updated_at_column();

create table if not exists public.wedding_entitlements (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  feature_key text not null,
  status text not null default 'inactive'
    check (status in ('inactive', 'active', 'expired', 'revoked')),
  source_bundle_id uuid null references public.wedding_subscription_bundles(id) on delete set null,
  effective_from timestamptz not null default now(),
  effective_to timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists wedding_entitlements_unique_feature_per_wedding
  on public.wedding_entitlements (wedding_id, feature_key);

create index if not exists wedding_entitlements_wedding_id_idx
  on public.wedding_entitlements (wedding_id);

drop trigger if exists update_wedding_entitlements_updated_at on public.wedding_entitlements;
create trigger update_wedding_entitlements_updated_at
before update on public.wedding_entitlements
for each row execute function public.update_updated_at_column();

create table if not exists public.wedding_assignment_roles (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  email text null,
  assignment_role text not null,
  source_task_id uuid null references public.tasks(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wedding_assignment_roles_wedding_id_idx
  on public.wedding_assignment_roles (wedding_id);

create index if not exists wedding_assignment_roles_user_id_idx
  on public.wedding_assignment_roles (user_id);

drop trigger if exists update_wedding_assignment_roles_updated_at on public.wedding_assignment_roles;
create trigger update_wedding_assignment_roles_updated_at
before update on public.wedding_assignment_roles
for each row execute function public.update_updated_at_column();

alter table public.planner_clients
  add column if not exists wedding_id uuid null references public.weddings(id) on delete set null;

alter table public.tasks
  add column if not exists wedding_id uuid null references public.weddings(id) on delete cascade,
  add column if not exists assigned_membership_id uuid null references public.wedding_memberships(id) on delete set null;

alter table public.budget_categories
  add column if not exists wedding_id uuid null references public.weddings(id) on delete cascade;

alter table public.budget_payments
  add column if not exists wedding_id uuid null references public.weddings(id) on delete cascade;

alter table public.guests
  add column if not exists wedding_id uuid null references public.weddings(id) on delete cascade;

alter table public.vendors
  add column if not exists wedding_id uuid null references public.weddings(id) on delete cascade;

alter table public.wedding_committee_members
  add column if not exists wedding_id uuid null references public.weddings(id) on delete cascade,
  add column if not exists membership_id uuid null references public.wedding_memberships(id) on delete set null;

create index if not exists planner_clients_wedding_id_idx
  on public.planner_clients (wedding_id);

create index if not exists tasks_wedding_id_idx
  on public.tasks (wedding_id);

create index if not exists tasks_assigned_membership_id_idx
  on public.tasks (assigned_membership_id);

create index if not exists budget_categories_wedding_id_idx
  on public.budget_categories (wedding_id);

create index if not exists budget_payments_wedding_id_idx
  on public.budget_payments (wedding_id);

create index if not exists guests_wedding_id_idx
  on public.guests (wedding_id);

create index if not exists vendors_wedding_id_idx
  on public.vendors (wedding_id);

create index if not exists wedding_committee_members_wedding_id_idx
  on public.wedding_committee_members (wedding_id);
