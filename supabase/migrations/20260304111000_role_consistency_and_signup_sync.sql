-- Keep profiles.role in sync with user_roles and signup metadata.

-- Backfill profiles.role from user_roles for existing users.
WITH ranked_roles AS (
  SELECT
    user_id,
    (
      ARRAY_AGG(
        role
        ORDER BY CASE role
          WHEN 'vendor'::public.app_role THEN 3
          WHEN 'planner'::public.app_role THEN 2
          ELSE 1
        END DESC
      )
    )[1] AS chosen_role
  FROM public.user_roles
  GROUP BY user_id
)
UPDATE public.profiles p
SET role = r.chosen_role
FROM ranked_roles r
WHERE p.user_id = r.user_id
  AND p.role IS DISTINCT FROM r.chosen_role;

-- Ensure new signups write the same role to both profiles and user_roles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role_text text;
  requested_role public.app_role;
BEGIN
  requested_role_text := lower(COALESCE(NEW.raw_user_meta_data->>'role', 'couple'));

  requested_role := CASE
    WHEN requested_role_text = 'planner' THEN 'planner'::public.app_role
    WHEN requested_role_text = 'vendor' THEN 'vendor'::public.app_role
    ELSE 'couple'::public.app_role
  END;

  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    requested_role
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, requested_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
