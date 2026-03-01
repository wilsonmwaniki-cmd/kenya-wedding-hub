
-- Allow couples to view planner_clients records where they are linked
CREATE POLICY "Linked couples can view their client record"
ON public.planner_clients
FOR SELECT
USING (auth.uid() = linked_user_id);

-- Allow couples to view profiles of planners (needed for linked planner name lookup)
-- Profiles already have a policy for viewing planner profiles publicly, so this is covered.
