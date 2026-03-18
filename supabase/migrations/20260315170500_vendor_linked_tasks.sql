ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS source_vendor_id uuid NULL REFERENCES public.vendors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_source_vendor_id
  ON public.tasks (source_vendor_id)
  WHERE source_vendor_id IS NOT NULL;
