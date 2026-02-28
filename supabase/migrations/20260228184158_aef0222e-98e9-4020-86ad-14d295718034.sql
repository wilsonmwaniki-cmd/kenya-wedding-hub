
-- Allow public (unauthenticated) read access to planner profiles only
CREATE POLICY "Public can view planner profiles"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (role = 'planner');
