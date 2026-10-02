-- These records are created directly from authenticated professional clients.
-- Bind ownership at the database boundary so vendor and planner inserts satisfy
-- the existing auth.uid() RLS checks without trusting a client-supplied UUID.
alter table public.professional_document_templates
  alter column user_id set default auth.uid();

alter table public.professional_contracts
  alter column user_id set default auth.uid();
