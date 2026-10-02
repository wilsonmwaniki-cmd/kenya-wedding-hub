-- A private, owner-scoped address book for professional document recipients.
-- Contacts intentionally belong to the professional who created them, rather than
-- to a client workspace, so a vendor or planner can reuse a relationship safely.
create table public.professional_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  contact_type text not null default 'client' check (contact_type in ('client', 'couple', 'vendor', 'other')),
  display_name text not null check (char_length(trim(display_name)) between 1 and 160),
  organisation_name text,
  primary_email text,
  primary_email_normalized text generated always as (lower(nullif(trim(primary_email), ''))) stored,
  phone text,
  additional_emails text[] not null default '{}',
  notes text,
  last_document_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_contacts_additional_emails_limit check (cardinality(additional_emails) <= 10)
);

-- Both indexes match the queries used by recipient suggestions and the Contacts page.
create unique index professional_contacts_owner_email_unique
  on public.professional_contacts (owner_user_id, primary_email_normalized)
  where primary_email_normalized is not null;

create index professional_contacts_owner_recent_idx
  on public.professional_contacts (owner_user_id, last_document_sent_at desc nulls last, updated_at desc);

alter table public.professional_contacts enable row level security;

revoke all on table public.professional_contacts from anon;
grant select, insert, update, delete on table public.professional_contacts to authenticated;

create policy "Professionals can view their own contacts"
  on public.professional_contacts for select to authenticated
  using (
    (select auth.uid()) = owner_user_id
    and exists (select 1 from public.profiles where user_id = (select auth.uid()) and role in ('vendor', 'planner'))
  );

create policy "Professionals can add their own contacts"
  on public.professional_contacts for insert to authenticated
  with check (
    (select auth.uid()) = owner_user_id
    and exists (select 1 from public.profiles where user_id = (select auth.uid()) and role in ('vendor', 'planner'))
  );

create policy "Professionals can update their own contacts"
  on public.professional_contacts for update to authenticated
  using (
    (select auth.uid()) = owner_user_id
    and exists (select 1 from public.profiles where user_id = (select auth.uid()) and role in ('vendor', 'planner'))
  )
  with check (
    (select auth.uid()) = owner_user_id
    and exists (select 1 from public.profiles where user_id = (select auth.uid()) and role in ('vendor', 'planner'))
  );

create policy "Professionals can delete their own contacts"
  on public.professional_contacts for delete to authenticated
  using (
    (select auth.uid()) = owner_user_id
    and exists (select 1 from public.profiles where user_id = (select auth.uid()) and role in ('vendor', 'planner'))
  );

create trigger update_professional_contacts_updated_at
before update on public.professional_contacts
for each row execute function public.update_updated_at_column();
