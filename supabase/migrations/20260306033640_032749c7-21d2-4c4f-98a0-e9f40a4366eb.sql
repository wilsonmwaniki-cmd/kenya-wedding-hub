
-- Wedding Portfolios table
CREATE TABLE public.wedding_portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.planner_clients(id) ON DELETE SET NULL,
  title text NOT NULL,
  wedding_date date,
  wedding_location text,
  guest_count integer DEFAULT 0,
  style_tags text[] DEFAULT '{}'::text[],
  description text,
  cover_photo_url text,
  is_published boolean NOT NULL DEFAULT false,
  share_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wedding_portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own portfolios"
  ON public.wedding_portfolios FOR ALL TO authenticated
  USING (auth.uid() = user_id OR is_linked_planner_of(user_id) OR is_linked_couple_of(client_id))
  WITH CHECK (auth.uid() = user_id OR is_linked_planner_of(user_id) OR is_linked_couple_of(client_id));

CREATE POLICY "Anyone can view published portfolios"
  ON public.wedding_portfolios FOR SELECT TO anon, authenticated
  USING (is_published = true);

-- Portfolio vendors (links vendors who participated)
CREATE TABLE public.portfolio_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.wedding_portfolios(id) ON DELETE CASCADE,
  vendor_listing_id uuid REFERENCES public.vendor_listings(id) ON DELETE SET NULL,
  vendor_name text NOT NULL,
  vendor_category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portfolio owner manages vendors"
  ON public.portfolio_vendors FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM wedding_portfolios wp
    WHERE wp.id = portfolio_id
    AND (wp.user_id = auth.uid() OR is_linked_planner_of(wp.user_id) OR is_linked_couple_of(wp.client_id))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM wedding_portfolios wp
    WHERE wp.id = portfolio_id
    AND (wp.user_id = auth.uid() OR is_linked_planner_of(wp.user_id) OR is_linked_couple_of(wp.client_id))
  ));

CREATE POLICY "Anyone can view published portfolio vendors"
  ON public.portfolio_vendors FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM wedding_portfolios wp
    WHERE wp.id = portfolio_id AND wp.is_published = true
  ));

-- Vendor Reviews table
CREATE TABLE public.vendor_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_listing_id uuid NOT NULL REFERENCES public.vendor_listings(id) ON DELETE CASCADE,
  portfolio_id uuid REFERENCES public.wedding_portfolios(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  reviewer_name text,
  reviewer_role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(reviewer_user_id, vendor_listing_id, portfolio_id)
);

ALTER TABLE public.vendor_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reviews"
  ON public.vendor_reviews FOR ALL TO authenticated
  USING (auth.uid() = reviewer_user_id)
  WITH CHECK (auth.uid() = reviewer_user_id);

CREATE POLICY "Anyone can view reviews"
  ON public.vendor_reviews FOR SELECT TO anon, authenticated
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_wedding_portfolios_updated_at
  BEFORE UPDATE ON public.wedding_portfolios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendor_reviews_updated_at
  BEFORE UPDATE ON public.vendor_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
