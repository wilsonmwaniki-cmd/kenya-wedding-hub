UPDATE public.vendors
SET
  selection_status = 'shortlisted',
  selection_updated_at = now()
WHERE selection_status = 'final'
  AND vendor_listing_id IS NULL
  AND NULLIF(BTRIM(COALESCE(phone, '')), '') IS NULL
  AND NULLIF(BTRIM(COALESCE(email, '')), '') IS NULL
  AND COALESCE(price, 0) <= 0
  AND LOWER(BTRIM(name)) = LOWER(BTRIM(category) || ' shortlist');

ALTER TABLE public.vendors
DROP CONSTRAINT IF EXISTS vendors_final_requires_recorded_vendor;

ALTER TABLE public.vendors
ADD CONSTRAINT vendors_final_requires_recorded_vendor
CHECK (
  selection_status <> 'final'
  OR vendor_listing_id IS NOT NULL
  OR NULLIF(BTRIM(COALESCE(phone, '')), '') IS NOT NULL
  OR NULLIF(BTRIM(COALESCE(email, '')), '') IS NOT NULL
  OR COALESCE(price, 0) > 0
  OR LOWER(BTRIM(name)) <> LOWER(BTRIM(category) || ' shortlist')
);

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
  is_empty_estimator_placeholder boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF selection_status_input NOT IN ('shortlisted', 'final', 'backup', 'declined') THEN
    RAISE EXCEPTION 'Invalid selection status' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO target_vendor FROM public.vendors WHERE id = vendor_id_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor row not found' USING ERRCODE = 'P0002';
  END IF;

  IF target_vendor.user_id <> auth.uid()
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  is_empty_estimator_placeholder :=
    target_vendor.vendor_listing_id IS NULL
    AND NULLIF(BTRIM(COALESCE(target_vendor.phone, '')), '') IS NULL
    AND NULLIF(BTRIM(COALESCE(target_vendor.email, '')), '') IS NULL
    AND COALESCE(target_vendor.price, 0) <= 0
    AND LOWER(BTRIM(target_vendor.name)) = LOWER(BTRIM(target_vendor.category) || ' shortlist');

  IF selection_status_input = 'final' AND is_empty_estimator_placeholder THEN
    RAISE EXCEPTION 'Record or link a vendor before choosing a final option'
      USING ERRCODE = '22023';
  END IF;

  IF selection_status_input = 'final' THEN
    UPDATE public.vendors
    SET
      selection_status = CASE WHEN status = 'rejected' THEN 'declined' ELSE 'backup' END,
      selection_updated_at = now()
    WHERE user_id = target_vendor.user_id
      AND COALESCE(client_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(target_vendor.client_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND lower(category) = lower(target_vendor.category)
      AND id <> target_vendor.id
      AND selection_status = 'final';
  END IF;

  UPDATE public.vendors
  SET selection_status = selection_status_input, selection_updated_at = now()
  WHERE id = target_vendor.id;

  RETURN selection_status_input;
END;
$$;

REVOKE ALL ON FUNCTION public.set_vendor_selection_status(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_vendor_selection_status(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_vendor_selection_status(uuid, text) TO authenticated;
