
-- Allow linked couples to update their own planner_clients record (to clear linked_user_id)
CREATE POLICY "Linked couples can update their client record"
ON public.planner_clients
FOR UPDATE
USING (auth.uid() = linked_user_id);
