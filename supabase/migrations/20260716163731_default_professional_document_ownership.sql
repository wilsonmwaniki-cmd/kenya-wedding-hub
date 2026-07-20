ALTER TABLE public.professional_document_templates
ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.professional_contracts
ALTER COLUMN user_id SET DEFAULT auth.uid();
