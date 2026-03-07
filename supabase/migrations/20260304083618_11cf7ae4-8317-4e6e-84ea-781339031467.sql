
-- Table for vendor connection requests
CREATE TABLE public.vendor_connection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id uuid NOT NULL,
  vendor_listing_id uuid NOT NULL REFERENCES public.vendor_listings(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.planner_clients(id) ON DELETE CASCADE,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requester_user_id, vendor_listing_id)
);

-- Enable RLS
ALTER TABLE public.vendor_connection_requests ENABLE ROW LEVEL SECURITY;

-- Requesters can insert their own requests
CREATE POLICY "Requesters can insert own requests"
ON public.vendor_connection_requests
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = requester_user_id);

-- Requesters can view own requests
CREATE POLICY "Requesters can view own requests"
ON public.vendor_connection_requests
FOR SELECT TO authenticated
USING (auth.uid() = requester_user_id);

-- Requesters can delete own pending requests
CREATE POLICY "Requesters can delete own pending requests"
ON public.vendor_connection_requests
FOR DELETE TO authenticated
USING (auth.uid() = requester_user_id AND status = 'pending');

-- Vendors can view requests to their listings
CREATE POLICY "Vendors can view requests to their listings"
ON public.vendor_connection_requests
FOR SELECT TO authenticated
USING (vendor_listing_id IN (SELECT id FROM public.vendor_listings WHERE user_id = auth.uid()));

-- Vendors can update (accept/decline) requests to their listings
CREATE POLICY "Vendors can update requests to their listings"
ON public.vendor_connection_requests
FOR UPDATE TO authenticated
USING (vendor_listing_id IN (SELECT id FROM public.vendor_listings WHERE user_id = auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_vendor_connection_requests_updated_at
  BEFORE UPDATE ON public.vendor_connection_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
