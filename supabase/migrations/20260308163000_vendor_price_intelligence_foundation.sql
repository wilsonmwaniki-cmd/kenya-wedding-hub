-- Vendor price intelligence foundation
-- 1) capture anonymized price observations
-- 2) sync existing vendor workflow prices automatically
-- 3) expose safe benchmark aggregates for planner-facing insights

CREATE TABLE IF NOT EXISTS public.vendor_price_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NULL REFERENCES public.planner_clients(id) ON DELETE CASCADE,
  source_vendor_id uuid NULL UNIQUE REFERENCES public.vendors(id) ON DELETE CASCADE,
  vendor_listing_id uuid NULL REFERENCES public.vendor_listings(id) ON DELETE SET NULL,
  vendor_name_snapshot text NOT NULL,
  category text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'KES' CHECK (char_length(currency) = 3),
  price_type text NOT NULL DEFAULT 'quote' CHECK (price_type IN ('quote', 'booked', 'final_paid')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'planner_vendor_entry', 'budget_entry', 'vendor_submission', 'admin_backfill')),
  venue_name text NULL,
  location_county text NULL,
  guest_count integer NULL CHECK (guest_count IS NULL OR guest_count > 0),
  wedding_style text NULL,
  event_date date NULL,
  notes text NULL,
  is_anonymized boolean NOT NULL DEFAULT true,
  recorded_by_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_price_observations_category
  ON public.vendor_price_observations (category);

CREATE INDEX IF NOT EXISTS idx_vendor_price_observations_vendor_listing_id
  ON public.vendor_price_observations (vendor_listing_id);

CREATE INDEX IF NOT EXISTS idx_vendor_price_observations_client_id
  ON public.vendor_price_observations (client_id);

CREATE INDEX IF NOT EXISTS idx_vendor_price_observations_created_at
  ON public.vendor_price_observations (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_price_observations_scope_lookup
  ON public.vendor_price_observations (category, venue_name, location_county, event_date DESC);

ALTER TABLE public.vendor_price_observations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_vendor_price_observation(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    auth.uid() = _user_id
    OR public.is_linked_planner_of(_user_id)
    OR public.is_linked_couple_of(_client_id)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
$$;

DROP POLICY IF EXISTS "Users can view accessible vendor price observations" ON public.vendor_price_observations;
CREATE POLICY "Users can view accessible vendor price observations"
ON public.vendor_price_observations FOR SELECT
USING (public.can_access_vendor_price_observation(user_id, client_id));

DROP POLICY IF EXISTS "Users can insert accessible vendor price observations" ON public.vendor_price_observations;
CREATE POLICY "Users can insert accessible vendor price observations"
ON public.vendor_price_observations FOR INSERT
WITH CHECK (
  public.can_access_vendor_price_observation(user_id, client_id)
  AND recorded_by_user_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can update accessible vendor price observations" ON public.vendor_price_observations;
CREATE POLICY "Users can update accessible vendor price observations"
ON public.vendor_price_observations FOR UPDATE
USING (public.can_access_vendor_price_observation(user_id, client_id))
WITH CHECK (
  public.can_access_vendor_price_observation(user_id, client_id)
  AND recorded_by_user_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can delete accessible vendor price observations" ON public.vendor_price_observations;
CREATE POLICY "Users can delete accessible vendor price observations"
ON public.vendor_price_observations FOR DELETE
USING (public.can_access_vendor_price_observation(user_id, client_id));

DROP TRIGGER IF EXISTS update_vendor_price_observations_updated_at ON public.vendor_price_observations;
CREATE TRIGGER update_vendor_price_observations_updated_at
BEFORE UPDATE ON public.vendor_price_observations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.record_vendor_price_observation(
  observation_amount numeric,
  observation_category text,
  vendor_name text,
  vendor_listing uuid DEFAULT NULL,
  client uuid DEFAULT NULL,
  price_type_input text DEFAULT 'quote',
  source_input text DEFAULT 'manual',
  venue_input text DEFAULT NULL,
  county_input text DEFAULT NULL,
  guest_count_input integer DEFAULT NULL,
  wedding_style_input text DEFAULT NULL,
  event_date_input date DEFAULT NULL,
  notes_input text DEFAULT NULL,
  is_anonymized_input boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_id uuid;
  resolved_venue text;
  resolved_event_date date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF observation_amount IS NULL OR observation_amount <= 0 THEN
    RAISE EXCEPTION 'Observation amount must be greater than zero'
      USING ERRCODE = '22003';
  END IF;

  IF NULLIF(trim(observation_category), '') IS NULL THEN
    RAISE EXCEPTION 'Observation category is required'
      USING ERRCODE = '23514';
  END IF;

  IF NULLIF(trim(vendor_name), '') IS NULL THEN
    RAISE EXCEPTION 'Vendor name is required'
      USING ERRCODE = '23514';
  END IF;

  IF price_type_input NOT IN ('quote', 'booked', 'final_paid') THEN
    RAISE EXCEPTION 'Unsupported price type: %', price_type_input
      USING ERRCODE = '22023';
  END IF;

  IF source_input NOT IN ('manual', 'planner_vendor_entry', 'budget_entry', 'vendor_submission', 'admin_backfill') THEN
    RAISE EXCEPTION 'Unsupported source: %', source_input
      USING ERRCODE = '22023';
  END IF;

  IF guest_count_input IS NOT NULL AND guest_count_input <= 0 THEN
    RAISE EXCEPTION 'Guest count must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  IF client IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.planner_clients pc
    WHERE pc.id = client
      AND (
        pc.planner_user_id = auth.uid()
        OR public.is_linked_couple_of(pc.id)
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  ) THEN
    RAISE EXCEPTION 'Client not accessible for this user'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    COALESCE(venue_input, pc.wedding_location, p.wedding_location),
    COALESCE(event_date_input, pc.wedding_date, p.wedding_date)
  INTO resolved_venue, resolved_event_date
  FROM public.profiles p
  LEFT JOIN public.planner_clients pc
    ON pc.id = client
  WHERE p.user_id = auth.uid()
  LIMIT 1;

  INSERT INTO public.vendor_price_observations (
    user_id,
    client_id,
    vendor_listing_id,
    vendor_name_snapshot,
    category,
    amount,
    currency,
    price_type,
    source,
    venue_name,
    location_county,
    guest_count,
    wedding_style,
    event_date,
    notes,
    is_anonymized,
    recorded_by_user_id
  )
  VALUES (
    auth.uid(),
    client,
    vendor_listing,
    trim(vendor_name),
    trim(observation_category),
    observation_amount,
    'KES',
    price_type_input,
    source_input,
    resolved_venue,
    NULLIF(trim(county_input), ''),
    guest_count_input,
    NULLIF(trim(wedding_style_input), ''),
    resolved_event_date,
    NULLIF(trim(notes_input), ''),
    COALESCE(is_anonymized_input, true),
    auth.uid()
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_vendor_price_observation_from_vendor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_category text;
  resolved_venue text;
  resolved_event_date date;
  resolved_recorded_by uuid;
BEGIN
  IF NEW.price IS NULL OR NEW.price <= 0 THEN
    DELETE FROM public.vendor_price_observations
    WHERE source_vendor_id = NEW.id;

    RETURN NEW;
  END IF;

  SELECT COALESCE(vl.category, NULLIF(NEW.category, ''), 'Other')
  INTO resolved_category
  FROM public.vendor_listings vl
  WHERE vl.id = NEW.vendor_listing_id;

  resolved_category := COALESCE(resolved_category, NULLIF(NEW.category, ''), 'Other');
  resolved_recorded_by := COALESCE(auth.uid(), NEW.user_id);

  SELECT
    COALESCE(pc.wedding_location, p.wedding_location),
    COALESCE(pc.wedding_date, p.wedding_date)
  INTO resolved_venue, resolved_event_date
  FROM public.profiles p
  LEFT JOIN public.planner_clients pc
    ON pc.id = NEW.client_id
  WHERE p.user_id = NEW.user_id
  LIMIT 1;

  INSERT INTO public.vendor_price_observations (
    user_id,
    client_id,
    source_vendor_id,
    vendor_listing_id,
    vendor_name_snapshot,
    category,
    amount,
    currency,
    price_type,
    source,
    venue_name,
    event_date,
    notes,
    is_anonymized,
    recorded_by_user_id
  )
  VALUES (
    NEW.user_id,
    NEW.client_id,
    NEW.id,
    NEW.vendor_listing_id,
    NEW.name,
    resolved_category,
    NEW.price,
    'KES',
    CASE WHEN NEW.status = 'booked' THEN 'booked' ELSE 'quote' END,
    'planner_vendor_entry',
    resolved_venue,
    resolved_event_date,
    NEW.notes,
    true,
    resolved_recorded_by
  )
  ON CONFLICT (source_vendor_id) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    client_id = EXCLUDED.client_id,
    vendor_listing_id = EXCLUDED.vendor_listing_id,
    vendor_name_snapshot = EXCLUDED.vendor_name_snapshot,
    category = EXCLUDED.category,
    amount = EXCLUDED.amount,
    price_type = EXCLUDED.price_type,
    source = EXCLUDED.source,
    venue_name = EXCLUDED.venue_name,
    event_date = EXCLUDED.event_date,
    notes = EXCLUDED.notes,
    is_anonymized = EXCLUDED.is_anonymized,
    recorded_by_user_id = EXCLUDED.recorded_by_user_id,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_vendor_price_observation_on_vendor_change ON public.vendors;
CREATE TRIGGER sync_vendor_price_observation_on_vendor_change
AFTER INSERT OR UPDATE OF name, category, price, status, notes, client_id, vendor_listing_id
ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.sync_vendor_price_observation_from_vendor();

INSERT INTO public.vendor_price_observations (
  user_id,
  client_id,
  source_vendor_id,
  vendor_listing_id,
  vendor_name_snapshot,
  category,
  amount,
  currency,
  price_type,
  source,
  venue_name,
  event_date,
  notes,
  is_anonymized,
  recorded_by_user_id
)
SELECT
  v.user_id,
  v.client_id,
  v.id,
  v.vendor_listing_id,
  v.name,
  COALESCE(vl.category, NULLIF(v.category, ''), 'Other'),
  v.price,
  'KES',
  CASE WHEN v.status = 'booked' THEN 'booked' ELSE 'quote' END,
  'planner_vendor_entry',
  COALESCE(pc.wedding_location, p.wedding_location),
  COALESCE(pc.wedding_date, p.wedding_date),
  v.notes,
  true,
  v.user_id
FROM public.vendors v
LEFT JOIN public.vendor_listings vl
  ON vl.id = v.vendor_listing_id
LEFT JOIN public.planner_clients pc
  ON pc.id = v.client_id
LEFT JOIN public.profiles p
  ON p.user_id = v.user_id
WHERE v.price IS NOT NULL
  AND v.price > 0
ON CONFLICT (source_vendor_id) DO UPDATE
SET
  user_id = EXCLUDED.user_id,
  client_id = EXCLUDED.client_id,
  vendor_listing_id = EXCLUDED.vendor_listing_id,
  vendor_name_snapshot = EXCLUDED.vendor_name_snapshot,
  category = EXCLUDED.category,
  amount = EXCLUDED.amount,
  price_type = EXCLUDED.price_type,
  source = EXCLUDED.source,
  venue_name = EXCLUDED.venue_name,
  event_date = EXCLUDED.event_date,
  notes = EXCLUDED.notes,
  is_anonymized = EXCLUDED.is_anonymized,
  recorded_by_user_id = EXCLUDED.recorded_by_user_id,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.get_vendor_price_benchmark(
  category_filter text DEFAULT NULL,
  venue_filter text DEFAULT NULL,
  county_filter text DEFAULT NULL,
  vendor_listing_filter uuid DEFAULT NULL,
  min_sample_size integer DEFAULT 5
)
RETURNS TABLE (
  sample_size bigint,
  benchmark_visible boolean,
  average_amount numeric,
  median_amount numeric,
  minimum_amount numeric,
  maximum_amount numeric,
  percentile_25_amount numeric,
  percentile_75_amount numeric,
  vendor_count bigint,
  last_observation_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  required_sample_size integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  required_sample_size := GREATEST(COALESCE(min_sample_size, 5), 1);

  RETURN QUERY
  WITH filtered AS (
    SELECT
      vpo.amount,
      vpo.vendor_listing_id,
      vpo.vendor_name_snapshot,
      vpo.created_at
    FROM public.vendor_price_observations vpo
    WHERE vpo.is_anonymized = true
      AND (category_filter IS NULL OR lower(vpo.category) = lower(category_filter))
      AND (venue_filter IS NULL OR lower(COALESCE(vpo.venue_name, '')) = lower(venue_filter))
      AND (county_filter IS NULL OR lower(COALESCE(vpo.location_county, '')) = lower(county_filter))
      AND (vendor_listing_filter IS NULL OR vpo.vendor_listing_id = vendor_listing_filter)
  ),
  aggregated AS (
    SELECT
      COUNT(*)::bigint AS sample_size,
      COUNT(DISTINCT COALESCE(vendor_listing_id::text, vendor_name_snapshot))::bigint AS vendor_count,
      ROUND(AVG(amount), 2) AS average_amount,
      ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY amount))::numeric, 2) AS median_amount,
      ROUND(MIN(amount), 2) AS minimum_amount,
      ROUND(MAX(amount), 2) AS maximum_amount,
      ROUND((percentile_cont(0.25) WITHIN GROUP (ORDER BY amount))::numeric, 2) AS percentile_25_amount,
      ROUND((percentile_cont(0.75) WITHIN GROUP (ORDER BY amount))::numeric, 2) AS percentile_75_amount,
      MAX(created_at) AS last_observation_at
    FROM filtered
  )
  SELECT
    aggregated.sample_size,
    aggregated.sample_size >= required_sample_size AS benchmark_visible,
    CASE WHEN aggregated.sample_size >= required_sample_size THEN aggregated.average_amount ELSE NULL END,
    CASE WHEN aggregated.sample_size >= required_sample_size THEN aggregated.median_amount ELSE NULL END,
    CASE WHEN aggregated.sample_size >= required_sample_size THEN aggregated.minimum_amount ELSE NULL END,
    CASE WHEN aggregated.sample_size >= required_sample_size THEN aggregated.maximum_amount ELSE NULL END,
    CASE WHEN aggregated.sample_size >= required_sample_size THEN aggregated.percentile_25_amount ELSE NULL END,
    CASE WHEN aggregated.sample_size >= required_sample_size THEN aggregated.percentile_75_amount ELSE NULL END,
    aggregated.vendor_count,
    aggregated.last_observation_at
  FROM aggregated;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_vendor_price_observation(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_vendor_price_observation(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.record_vendor_price_observation(numeric, text, text, uuid, uuid, text, text, text, text, integer, text, date, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_vendor_price_observation(numeric, text, text, uuid, uuid, text, text, text, text, integer, text, date, text, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_vendor_price_benchmark(text, text, text, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vendor_price_benchmark(text, text, text, uuid, integer) TO authenticated;
