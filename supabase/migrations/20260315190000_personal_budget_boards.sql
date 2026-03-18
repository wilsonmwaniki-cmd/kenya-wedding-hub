ALTER TABLE public.budget_categories
  ADD COLUMN IF NOT EXISTS budget_scope text NOT NULL DEFAULT 'wedding',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

ALTER TABLE public.budget_categories
  DROP CONSTRAINT IF EXISTS budget_categories_budget_scope_check,
  ADD CONSTRAINT budget_categories_budget_scope_check
    CHECK (budget_scope IN ('wedding', 'personal'));

ALTER TABLE public.budget_categories
  DROP CONSTRAINT IF EXISTS budget_categories_visibility_check,
  ADD CONSTRAINT budget_categories_visibility_check
    CHECK (visibility IN ('public', 'private'));

CREATE INDEX IF NOT EXISTS budget_categories_scope_idx
  ON public.budget_categories (budget_scope);

CREATE INDEX IF NOT EXISTS budget_categories_visibility_idx
  ON public.budget_categories (visibility);

DROP POLICY IF EXISTS "Users can manage own budget" ON public.budget_categories;

CREATE POLICY "Users can manage own budget" ON public.budget_categories
FOR ALL
USING (
  auth.uid() = user_id
  OR (
    COALESCE(budget_scope, 'wedding') = 'wedding'
    AND COALESCE(visibility, 'public') = 'public'
    AND (
      public.is_linked_planner_of(user_id)
      OR public.is_linked_couple_of(client_id)
    )
  )
)
WITH CHECK (
  auth.uid() = user_id
  OR (
    COALESCE(budget_scope, 'wedding') = 'wedding'
    AND COALESCE(visibility, 'public') = 'public'
    AND (
      public.is_linked_planner_of(user_id)
      OR public.is_linked_couple_of(client_id)
    )
  )
);
