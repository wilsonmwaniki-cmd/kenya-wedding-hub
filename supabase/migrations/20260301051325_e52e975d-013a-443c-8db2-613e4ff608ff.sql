
-- Add social media columns to vendor_listings
ALTER TABLE public.vendor_listings
  ADD COLUMN social_instagram text,
  ADD COLUMN social_facebook text,
  ADD COLUMN social_tiktok text,
  ADD COLUMN social_twitter text;
