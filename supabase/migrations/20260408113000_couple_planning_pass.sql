ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS planning_pass_status text NOT NULL DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS planning_pass_started_at timestamptz,
ADD COLUMN IF NOT EXISTS planning_pass_expires_at timestamptz;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_planning_pass_status_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_planning_pass_status_check
CHECK (planning_pass_status IN ('inactive', 'active', 'past_due', 'cancelled'));
