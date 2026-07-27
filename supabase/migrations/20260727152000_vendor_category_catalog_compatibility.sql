CREATE OR REPLACE FUNCTION public.canonical_vendor_category(category_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE lower(btrim(COALESCE(category_input, '')))
    WHEN 'venue' THEN 'wedding venue'
    WHEN 'wedding venue' THEN 'wedding venue'
    WHEN 'catering' THEN 'caterer'
    WHEN 'caterer' THEN 'caterer'
    WHEN 'cake' THEN 'cake artist & baker'
    WHEN 'cake artist & baker' THEN 'cake artist & baker'
    WHEN 'décor' THEN 'décor, tents, chairs, tables'
    WHEN 'decor' THEN 'décor, tents, chairs, tables'
    WHEN 'décor, tents, chairs, tables' THEN 'décor, tents, chairs, tables'
    WHEN 'mc' THEN 'master of ceremonies'
    WHEN 'master of ceremonies' THEN 'master of ceremonies'
    WHEN 'music/dj' THEN 'dj (or band) and sound'
    WHEN 'dj (or band) and sound' THEN 'dj (or band) and sound'
    WHEN 'photography' THEN 'photographer'
    WHEN 'photographer' THEN 'photographer'
    WHEN 'videography' THEN 'cinematographer'
    WHEN 'cinematographer' THEN 'cinematographer'
    WHEN 'wedding bands' THEN 'rings'
    WHEN 'rings' THEN 'rings'
    WHEN 'pre-marital classes' THEN 'marriage preparation'
    WHEN 'marriage preparation' THEN 'marriage preparation'
    WHEN 'bride attire & body prep' THEN 'bridal gown, accessories, preparation'
    WHEN 'bridal gown, accessories, preparation' THEN 'bridal gown, accessories, preparation'
    WHEN 'groom attire & grooming' THEN 'groom''s attire & accessories, preparation'
    WHEN 'groom''s attire & accessories, preparation' THEN 'groom''s attire & accessories, preparation'
    WHEN 'make-up artist' THEN 'bride''s make-up artist'
    WHEN 'bride''s make-up artist' THEN 'bride''s make-up artist'
    WHEN 'hair stylist' THEN 'bride''s hair stylist'
    WHEN 'bride''s hair stylist' THEN 'bride''s hair stylist'
    WHEN 'stationery' THEN 'invitations'
    WHEN 'invitations' THEN 'invitations'
    WHEN 'marriage license / legal fees' THEN 'wedding licenses'
    WHEN 'wedding licenses' THEN 'wedding licenses'
    WHEN 'officiant / church fees' THEN 'church & officiating minister'
    WHEN 'church & officiating minister' THEN 'church & officiating minister'
    ELSE lower(btrim(COALESCE(category_input, '')))
  END
$$;

DROP INDEX IF EXISTS public.idx_vendors_one_final_choice_per_scope;

CREATE UNIQUE INDEX idx_vendors_one_final_choice_per_scope
ON public.vendors (
  user_id,
  COALESCE(client_id, '00000000-0000-0000-0000-000000000000'::uuid),
  public.canonical_vendor_category(category)
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
      AND public.canonical_vendor_category(category)
        = public.canonical_vendor_category(target_vendor.category)
      AND id <> target_vendor.id
      AND selection_status = 'final';
  END IF;

  UPDATE public.vendors
  SET selection_status = selection_status_input, selection_updated_at = now()
  WHERE id = target_vendor.id;

  RETURN selection_status_input;
END;
$$;

REVOKE ALL ON FUNCTION public.canonical_vendor_category(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.canonical_vendor_category(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_vendor_category(text) TO service_role;

REVOKE ALL ON FUNCTION public.set_vendor_selection_status(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_vendor_selection_status(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_vendor_selection_status(uuid, text) TO authenticated;
