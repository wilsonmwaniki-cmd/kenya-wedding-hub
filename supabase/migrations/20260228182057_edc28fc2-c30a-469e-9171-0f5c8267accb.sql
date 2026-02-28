
-- Create planner_clients table for planners to manage multiple wedding clients
CREATE TABLE public.planner_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planner_user_id uuid NOT NULL,
  client_name text NOT NULL,
  partner_name text,
  wedding_date date,
  wedding_location text,
  email text,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.planner_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Planners can manage own clients"
  ON public.planner_clients FOR ALL
  TO authenticated
  USING (auth.uid() = planner_user_id)
  WITH CHECK (auth.uid() = planner_user_id);

CREATE TRIGGER update_planner_clients_updated_at
  BEFORE UPDATE ON public.planner_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add client_id to planning tables so planners can associate data with specific clients
ALTER TABLE public.budget_categories ADD COLUMN client_id uuid REFERENCES public.planner_clients(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN client_id uuid REFERENCES public.planner_clients(id) ON DELETE CASCADE;
ALTER TABLE public.guests ADD COLUMN client_id uuid REFERENCES public.planner_clients(id) ON DELETE CASCADE;
ALTER TABLE public.vendors ADD COLUMN client_id uuid REFERENCES public.planner_clients(id) ON DELETE CASCADE;
