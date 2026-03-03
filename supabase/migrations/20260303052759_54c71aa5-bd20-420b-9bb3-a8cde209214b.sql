
-- Trigger to reset is_approved when vendor updates critical fields
CREATE OR REPLACE FUNCTION public.reset_vendor_approval_on_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Reset approval if any critical field changed
  IF OLD.is_approved = true AND (
    NEW.business_name IS DISTINCT FROM OLD.business_name OR
    NEW.category IS DISTINCT FROM OLD.category OR
    NEW.description IS DISTINCT FROM OLD.description OR
    NEW.services IS DISTINCT FROM OLD.services OR
    NEW.phone IS DISTINCT FROM OLD.phone OR
    NEW.email IS DISTINCT FROM OLD.email OR
    NEW.website IS DISTINCT FROM OLD.website OR
    NEW.location IS DISTINCT FROM OLD.location OR
    NEW.logo_url IS DISTINCT FROM OLD.logo_url
  ) THEN
    NEW.is_approved = false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reset_vendor_approval_on_update
BEFORE UPDATE ON public.vendor_listings
FOR EACH ROW
EXECUTE FUNCTION public.reset_vendor_approval_on_update();
