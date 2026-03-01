
-- Add vendor_listing_id to vendors table to link bookings to directory vendors
ALTER TABLE public.vendors ADD COLUMN vendor_listing_id uuid REFERENCES public.vendor_listings(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_vendors_vendor_listing_id ON public.vendors(vendor_listing_id);

-- Allow vendors to see bookings that reference their listing (SELECT only)
CREATE POLICY "Vendors can view their bookings"
ON public.vendors
FOR SELECT
TO authenticated
USING (
  vendor_listing_id IS NOT NULL
  AND vendor_listing_id IN (
    SELECT id FROM public.vendor_listings WHERE user_id = auth.uid()
  )
);
