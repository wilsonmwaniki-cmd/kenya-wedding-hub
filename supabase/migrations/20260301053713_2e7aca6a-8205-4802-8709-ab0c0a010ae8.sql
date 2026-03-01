
-- Add linked_user_id to planner_clients to link to a real couple account
ALTER TABLE public.planner_clients ADD COLUMN linked_user_id uuid;

-- Create planner link requests table
CREATE TABLE public.planner_link_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_user_id uuid NOT NULL,
  planner_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(couple_user_id, planner_user_id)
);

ALTER TABLE public.planner_link_requests ENABLE ROW LEVEL SECURITY;

-- Couples can create and view their own requests
CREATE POLICY "Couples can insert own requests"
ON public.planner_link_requests FOR INSERT
WITH CHECK (auth.uid() = couple_user_id);

CREATE POLICY "Couples can view own requests"
ON public.planner_link_requests FOR SELECT
USING (auth.uid() = couple_user_id);

CREATE POLICY "Couples can delete own requests"
ON public.planner_link_requests FOR DELETE
USING (auth.uid() = couple_user_id);

-- Planners can view and update requests sent to them
CREATE POLICY "Planners can view requests to them"
ON public.planner_link_requests FOR SELECT
USING (auth.uid() = planner_user_id);

CREATE POLICY "Planners can update requests to them"
ON public.planner_link_requests FOR UPDATE
USING (auth.uid() = planner_user_id);

-- Trigger for updated_at
CREATE TRIGGER update_planner_link_requests_updated_at
BEFORE UPDATE ON public.planner_link_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Security definer functions for cross-access checks

-- Check if current user is a planner linked to the data owner
CREATE OR REPLACE FUNCTION public.is_linked_planner_of(_data_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM planner_clients
    WHERE planner_user_id = auth.uid() AND linked_user_id = _data_user_id
  )
$$;

-- Check if current user is a couple linked to a specific client record
CREATE OR REPLACE FUNCTION public.is_linked_couple_of(_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _client_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM planner_clients
    WHERE id = _client_id AND linked_user_id = auth.uid()
  )
$$;

-- Update RLS on tasks to allow shared access
DROP POLICY "Users can manage own tasks" ON public.tasks;
CREATE POLICY "Users can manage own tasks" ON public.tasks FOR ALL
USING (
  auth.uid() = user_id
  OR public.is_linked_planner_of(user_id)
  OR public.is_linked_couple_of(client_id)
)
WITH CHECK (
  auth.uid() = user_id
  OR public.is_linked_planner_of(user_id)
  OR public.is_linked_couple_of(client_id)
);

-- Update RLS on budget_categories
DROP POLICY "Users can manage own budget" ON public.budget_categories;
CREATE POLICY "Users can manage own budget" ON public.budget_categories FOR ALL
USING (
  auth.uid() = user_id
  OR public.is_linked_planner_of(user_id)
  OR public.is_linked_couple_of(client_id)
)
WITH CHECK (
  auth.uid() = user_id
  OR public.is_linked_planner_of(user_id)
  OR public.is_linked_couple_of(client_id)
);

-- Update RLS on guests
DROP POLICY "Users can manage own guests" ON public.guests;
CREATE POLICY "Users can manage own guests" ON public.guests FOR ALL
USING (
  auth.uid() = user_id
  OR public.is_linked_planner_of(user_id)
  OR public.is_linked_couple_of(client_id)
)
WITH CHECK (
  auth.uid() = user_id
  OR public.is_linked_planner_of(user_id)
  OR public.is_linked_couple_of(client_id)
);

-- Update RLS on vendors
DROP POLICY "Users can manage own vendors" ON public.vendors;
CREATE POLICY "Users can manage own vendors" ON public.vendors FOR ALL
USING (
  auth.uid() = user_id
  OR public.is_linked_planner_of(user_id)
  OR public.is_linked_couple_of(client_id)
)
WITH CHECK (
  auth.uid() = user_id
  OR public.is_linked_planner_of(user_id)
  OR public.is_linked_couple_of(client_id)
);
