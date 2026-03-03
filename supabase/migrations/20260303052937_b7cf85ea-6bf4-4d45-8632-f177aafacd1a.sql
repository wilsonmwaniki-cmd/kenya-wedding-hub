
-- Drop the overly broad public planner profile policy
DROP POLICY IF EXISTS "Public can view planner profiles" ON public.profiles;

-- Add a restricted policy: authenticated users can view planner profiles (full data)
CREATE POLICY "Authenticated can view planner profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (role = 'planner'::app_role);

-- Create a view exposing only non-sensitive planner fields for public/anonymous access
CREATE OR REPLACE VIEW public.public_planner_profiles AS
SELECT id, user_id, full_name, company_name, avatar_url, bio, specialties
FROM public.profiles
WHERE role = 'planner'::app_role;

-- Grant access to the view for anonymous users
GRANT SELECT ON public.public_planner_profiles TO anon;
GRANT SELECT ON public.public_planner_profiles TO authenticated;
