
-- Add 'vendor' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vendor';

-- Create vendor_listings table (the public directory)
CREATE TABLE public.vendor_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  business_name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  location TEXT,
  services TEXT[] DEFAULT '{}',
  is_approved BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.vendor_listings ENABLE ROW LEVEL SECURITY;

-- Public can view approved listings
CREATE POLICY "Anyone can view approved vendor listings"
ON public.vendor_listings
FOR SELECT
USING (is_approved = true);

-- Vendors can view their own listing (even if not approved yet)
CREATE POLICY "Vendors can view own listing"
ON public.vendor_listings
FOR SELECT
USING (auth.uid() = user_id);

-- Vendors can insert their own listing
CREATE POLICY "Vendors can insert own listing"
ON public.vendor_listings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Vendors can update their own listing
CREATE POLICY "Vendors can update own listing"
ON public.vendor_listings
FOR UPDATE
USING (auth.uid() = user_id);

-- Vendors can delete their own listing
CREATE POLICY "Vendors can delete own listing"
ON public.vendor_listings
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_vendor_listings_updated_at
BEFORE UPDATE ON public.vendor_listings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
