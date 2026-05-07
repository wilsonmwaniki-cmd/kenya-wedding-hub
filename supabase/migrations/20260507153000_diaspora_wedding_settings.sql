alter table public.weddings
  add column if not exists planning_mode text not null default 'local',
  add column if not exists planning_country text,
  add column if not exists reference_currency text,
  add column if not exists owner_timezone text;

alter table public.weddings
  drop constraint if exists weddings_planning_mode_check;

alter table public.weddings
  add constraint weddings_planning_mode_check
  check (planning_mode in ('local', 'diaspora'));

alter table public.weddings
  drop constraint if exists weddings_reference_currency_check;

alter table public.weddings
  add constraint weddings_reference_currency_check
  check (
    reference_currency is null
    or reference_currency in ('GBP', 'USD', 'EUR', 'CAD', 'AUD')
  );
