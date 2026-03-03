
-- Recreate the view with security_invoker instead of security_definer
DROP VIEW IF EXISTS public.public_planner_profiles;

CREATE VIEW public.public_planner_profiles
WITH (security_invoker = true)
AS
SELECT id, user_id, full_name, company_name, avatar_url, bio, specialties
FROM public.profiles
WHERE role = 'planner'::app_role;

-- Grant access
GRANT SELECT ON public.public_planner_profiles TO anon;
GRANT SELECT ON public.public_planner_profiles TO authenticated;

-- Ensure anon users can read planner profiles (limited by the view columns)
CREATE POLICY "Anon can view planner profiles"
ON public.profiles
FOR SELECT
TO anon
USING (role = 'planner'::app_role);
