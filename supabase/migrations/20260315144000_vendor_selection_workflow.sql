ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS selection_status text NOT NULL DEFAULT 'shortlisted',
ADD COLUMN IF NOT EXISTS selection_updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.vendors
DROP CONSTRAINT IF EXISTS vendors_selection_status_check;

ALTER TABLE public.vendors
ADD CONSTRAINT vendors_selection_status_check
CHECK (selection_status IN ('shortlisted', 'final', 'backup', 'declined'));

UPDATE public.vendors
SET
  selection_status = CASE
    WHEN status = 'rejected' THEN 'declined'
    ELSE 'shortlisted'
  END,
  selection_updated_at = now()
WHERE selection_status IS NULL
   OR selection_status NOT IN ('shortlisted', 'final', 'backup', 'declined');

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_one_final_choice_per_scope
ON public.vendors (
  user_id,
  COALESCE(client_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(category)
)
WHERE selection_status = 'final';

CREATE OR REPLACE FUNCTION public.set_vendor_selection_status(
  vendor_id_input uuid,
  selection_status_input text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_vendor public.vendors%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized'
      USING ERRCODE = '42501';
  END IF;

  IF selection_status_input NOT IN ('shortlisted', 'final', 'backup', 'declined') THEN
    RAISE EXCEPTION 'Invalid selection status'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO target_vendor
  FROM public.vendors
  WHERE id = vendor_id_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor row not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF target_vendor.user_id <> auth.uid()
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Unauthorized'
      USING ERRCODE = '42501';
  END IF;

  IF selection_status_input = 'final' THEN
    UPDATE public.vendors
    SET
      selection_status = CASE
        WHEN status = 'rejected' THEN 'declined'
        ELSE 'backup'
      END,
      selection_updated_at = now()
    WHERE user_id = target_vendor.user_id
      AND COALESCE(client_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(target_vendor.client_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND lower(category) = lower(target_vendor.category)
      AND id <> target_vendor.id
      AND selection_status = 'final';
  END IF;

  UPDATE public.vendors
  SET
    selection_status = selection_status_input,
    selection_updated_at = now()
  WHERE id = target_vendor.id;

  RETURN selection_status_input;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_vendor_selection_status(uuid, text) TO authenticated;
