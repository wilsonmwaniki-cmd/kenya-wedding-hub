DROP FUNCTION IF EXISTS public.admin_list_couple_planning_passes(text, text, integer, integer);
CREATE FUNCTION public.admin_list_couple_planning_passes(
  search_query text DEFAULT NULL,
  status_filter text DEFAULT 'all',
  limit_rows integer DEFAULT 100,
  offset_rows integer DEFAULT 0
)
RETURNS TABLE (
  profile_id uuid,
  user_id uuid,
  full_name text,
  wedding_location text,
  wedding_date date,
  planning_pass_status text,
  planning_pass_expires_at timestamptz,
  updated_at timestamptz,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();

  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.full_name::text,
    p.wedding_location::text,
    p.wedding_date,
    p.planning_pass_status::text,
    p.planning_pass_expires_at,
    p.updated_at::timestamptz,
    u.email::text
  FROM public.profiles p
  LEFT JOIN auth.users u
    ON u.id = p.user_id
  WHERE p.role = 'couple'::public.app_role
    AND (
      status_filter = 'all'
      OR p.planning_pass_status = status_filter
    )
    AND (
      search_query IS NULL
      OR p.full_name ILIKE '%' || search_query || '%'
      OR p.wedding_location ILIKE '%' || search_query || '%'
      OR u.email ILIKE '%' || search_query || '%'
    )
  ORDER BY p.updated_at DESC
  LIMIT GREATEST(1, LEAST(limit_rows, 200))
  OFFSET GREATEST(0, offset_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_couple_planning_pass(
  target_user_id uuid,
  new_planning_pass_status text,
  new_planning_pass_expires_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();

  IF new_planning_pass_status NOT IN ('inactive', 'active', 'past_due', 'cancelled') THEN
    RAISE EXCEPTION 'Unsupported planning pass status'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles
  SET
    planning_pass_status = new_planning_pass_status,
    planning_pass_started_at = CASE
      WHEN new_planning_pass_status = 'active' THEN COALESCE(planning_pass_started_at, now())
      ELSE planning_pass_started_at
    END,
    planning_pass_expires_at = new_planning_pass_expires_at,
    updated_at = now()
  WHERE user_id = target_user_id
    AND role = 'couple'::public.app_role;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Couple profile not found'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_couple_planning_passes(text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_couple_planning_pass(uuid, text, timestamptz) TO authenticated;
