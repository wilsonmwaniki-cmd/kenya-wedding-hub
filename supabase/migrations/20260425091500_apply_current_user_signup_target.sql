CREATE OR REPLACE FUNCTION public.apply_current_user_signup_target(
  target_role_text text,
  target_planner_type_text text DEFAULT NULL,
  target_full_name text DEFAULT NULL,
  target_committee_name text DEFAULT NULL
)
RETURNS TABLE (
  role text,
  planner_type text,
  committee_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_role public.app_role;
  resolved_planner_type text;
  resolved_committee_name text;
  normalized_role text;
  normalized_planner_type text;
  normalized_full_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '42501';
  END IF;

  normalized_role := lower(COALESCE(target_role_text, ''));
  normalized_planner_type := lower(COALESCE(target_planner_type_text, ''));
  normalized_full_name := NULLIF(trim(COALESCE(target_full_name, '')), '');

  IF normalized_role NOT IN ('couple', 'planner', 'vendor', 'admin', 'committee') THEN
    RAISE EXCEPTION 'Unsupported target role: %', target_role_text;
  END IF;

  resolved_role := CASE
    WHEN normalized_role IN ('planner', 'committee') THEN 'planner'::public.app_role
    WHEN normalized_role = 'vendor' THEN 'vendor'::public.app_role
    WHEN normalized_role = 'admin' AND public.has_role(auth.uid(), 'admin'::public.app_role) THEN 'admin'::public.app_role
    ELSE 'couple'::public.app_role
  END;

  resolved_planner_type := CASE
    WHEN normalized_role = 'committee' THEN 'committee'
    WHEN resolved_role = 'planner'::public.app_role AND normalized_planner_type = 'committee' THEN 'committee'
    WHEN resolved_role = 'planner'::public.app_role THEN 'professional'
    ELSE NULL
  END;

  resolved_committee_name := CASE
    WHEN resolved_planner_type = 'committee'
      THEN NULLIF(trim(COALESCE(target_committee_name, '')), '')
    ELSE NULL
  END;

  INSERT INTO public.profiles (
    user_id,
    full_name,
    role,
    planner_type,
    committee_name
  )
  VALUES (
    auth.uid(),
    COALESCE(normalized_full_name, ''),
    resolved_role,
    resolved_planner_type,
    resolved_committee_name
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    role = EXCLUDED.role,
    planner_type = EXCLUDED.planner_type,
    committee_name = CASE
      WHEN EXCLUDED.planner_type = 'committee' THEN COALESCE(EXCLUDED.committee_name, public.profiles.committee_name)
      ELSE NULL
    END,
    full_name = CASE
      WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name
      ELSE public.profiles.full_name
    END,
    updated_at = now();

  DELETE FROM public.user_roles
  WHERE user_id = auth.uid()
    AND role <> resolved_role;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), resolved_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN QUERY
  SELECT
    resolved_role::text,
    resolved_planner_type,
    resolved_committee_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_current_user_signup_target(text, text, text, text) TO authenticated;
