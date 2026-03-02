-- Add assigned_to column for task delegation
ALTER TABLE public.tasks ADD COLUMN assigned_to text DEFAULT NULL;