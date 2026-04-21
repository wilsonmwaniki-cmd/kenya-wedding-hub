create table if not exists public.professional_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  audience text not null
    check (audience in ('planner', 'vendor')),
  feature_key text not null
    check (
      feature_key in (
        'directory_listing',
        'verified_listing',
        'booking_management',
        'invoicing',
        'contract_management',
        'public_reputation',
        'media_portfolio',
        'advertising',
        'team_workspace'
      )
    ),
  status text not null default 'active'
    check (status in ('inactive', 'active', 'expired', 'revoked')),
  source_lookup_key text null,
  source_bundle_code text null,
  seat_limit integer null
    check (seat_limit is null or seat_limit >= 0),
  effective_from timestamptz not null default now(),
  effective_to timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists professional_entitlements_user_feature_unique
  on public.professional_entitlements (user_id, audience, feature_key);

create index if not exists professional_entitlements_user_id_idx
  on public.professional_entitlements (user_id);

create index if not exists professional_entitlements_audience_idx
  on public.professional_entitlements (audience);

drop trigger if exists update_professional_entitlements_updated_at on public.professional_entitlements;
create trigger update_professional_entitlements_updated_at
before update on public.professional_entitlements
for each row execute function public.update_updated_at_column();

alter table public.professional_entitlements enable row level security;

drop policy if exists "Professionals can view own entitlements" on public.professional_entitlements;
create policy "Professionals can view own entitlements"
on public.professional_entitlements for select
to authenticated
using (auth.uid() = user_id);
