
-- Add planner-specific profile columns
ALTER TABLE public.profiles
  ADD COLUMN company_name text,
  ADD COLUMN company_email text,
  ADD COLUMN company_phone text,
  ADD COLUMN company_website text,
  ADD COLUMN bio text,
  ADD COLUMN specialties text[];
