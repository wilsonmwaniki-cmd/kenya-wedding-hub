ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS collaboration_code text;

CREATE OR REPLACE FUNCTION public.generate_collaboration_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  already_exists boolean;
  idx integer;
BEGIN
  LOOP
    candidate := 'ZN-';
    FOR idx IN 1..6 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    END LOOP;

    SELECT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE collaboration_code = candidate
    ) INTO already_exists;

    IF NOT already_exists THEN
      RETURN candidate;
    END IF;
  END LOOP;
END;
$$;

UPDATE public.profiles
SET collaboration_code = public.generate_collaboration_code()
WHERE collaboration_code IS NULL
  AND role IN ('couple'::public.app_role, 'admin'::public.app_role);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_collaboration_code_unique
ON public.profiles (collaboration_code)
WHERE collaboration_code IS NOT NULL;

ALTER TABLE public.planner_link_requests
ADD COLUMN IF NOT EXISTS request_source text NOT NULL DEFAULT 'couple_interest';

ALTER TABLE public.planner_link_requests
DROP CONSTRAINT IF EXISTS planner_link_requests_request_source_check;

ALTER TABLE public.planner_link_requests
ADD CONSTRAINT planner_link_requests_request_source_check
CHECK (request_source IN ('couple_interest', 'planner_code'));

CREATE OR REPLACE FUNCTION public.ensure_my_collaboration_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_role public.app_role;
  current_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT role, collaboration_code
  INTO current_role, current_code
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF current_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF current_code IS NULL THEN
    UPDATE public.profiles
    SET collaboration_code = public.generate_collaboration_code()
    WHERE user_id = auth.uid()
      AND collaboration_code IS NULL;

    SELECT collaboration_code
    INTO current_code
    FROM public.profiles
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;

  RETURN current_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_planner_link_by_code(
  collaboration_code_input text,
  note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acting_role public.app_role;
  target_profile public.profiles%ROWTYPE;
  existing_request_id uuid;
  existing_client_id uuid;
  normalized_code text;
  planner_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT role, COALESCE(company_name, full_name, 'Planner')
  INTO acting_role, planner_name
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF acting_role NOT IN ('planner'::public.app_role, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only planners can request collaboration by code';
  END IF;

  normalized_code := upper(trim(collaboration_code_input));

  SELECT *
  INTO target_profile
  FROM public.profiles
  WHERE collaboration_code = normalized_code
    AND role IN ('couple'::public.app_role, 'admin'::public.app_role)
  LIMIT 1;

  IF target_profile.user_id IS NULL THEN
    RAISE EXCEPTION 'No couple found for that collaboration code';
  END IF;

  IF target_profile.user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot link your own account';
  END IF;

  SELECT id
  INTO existing_client_id
  FROM public.planner_clients
  WHERE planner_user_id = auth.uid()
    AND linked_user_id = target_profile.user_id
  LIMIT 1;

  IF existing_client_id IS NOT NULL THEN
    RETURN json_build_object(
      'status', 'already_linked',
      'client_id', existing_client_id,
      'couple_name', COALESCE(target_profile.full_name, 'Couple')
    );
  END IF;

  SELECT id
  INTO existing_request_id
  FROM public.planner_link_requests
  WHERE planner_user_id = auth.uid()
    AND couple_user_id = target_profile.user_id
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF existing_request_id IS NOT NULL THEN
    RETURN json_build_object(
      'status', 'already_pending',
      'request_id', existing_request_id,
      'couple_name', COALESCE(target_profile.full_name, 'Couple')
    );
  END IF;

  INSERT INTO public.planner_link_requests (
    planner_user_id,
    couple_user_id,
    message,
    status,
    request_source
  )
  VALUES (
    auth.uid(),
    target_profile.user_id,
    COALESCE(NULLIF(trim(note), ''), planner_name || ' would like to collaborate on your wedding workspace.'),
    'pending',
    'planner_code'
  )
  RETURNING id
  INTO existing_request_id;

  RETURN json_build_object(
    'status', 'requested',
    'request_id', existing_request_id,
    'couple_name', COALESCE(target_profile.full_name, 'Couple')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_planner_code_link_request(request_id_input uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.planner_link_requests%ROWTYPE;
  couple_profile public.profiles%ROWTYPE;
  couple_email text;
  client_id uuid;
  acting_role public.app_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT role
  INTO acting_role
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF acting_role NOT IN ('couple'::public.app_role, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only couples can approve this request';
  END IF;

  SELECT *
  INTO req
  FROM public.planner_link_requests
  WHERE id = request_id_input
    AND couple_user_id = auth.uid()
    AND status = 'pending'
    AND request_source = 'planner_code'
  LIMIT 1;

  IF req.id IS NULL THEN
    RAISE EXCEPTION 'Link request not found';
  END IF;

  SELECT *
  INTO couple_profile
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  SELECT email::text
  INTO couple_email
  FROM auth.users
  WHERE id = auth.uid()
  LIMIT 1;

  SELECT id
  INTO client_id
  FROM public.planner_clients
  WHERE planner_user_id = req.planner_user_id
    AND linked_user_id = req.couple_user_id
  LIMIT 1;

  IF client_id IS NULL THEN
    INSERT INTO public.planner_clients (
      planner_user_id,
      client_name,
      partner_name,
      wedding_date,
      wedding_location,
      email,
      linked_user_id
    )
    VALUES (
      req.planner_user_id,
      COALESCE(couple_profile.full_name, 'Client'),
      couple_profile.partner_name,
      couple_profile.wedding_date,
      couple_profile.wedding_location,
      couple_email,
      req.couple_user_id
    )
    RETURNING id
    INTO client_id;
  ELSE
    UPDATE public.planner_clients
    SET
      client_name = COALESCE(couple_profile.full_name, client_name),
      partner_name = COALESCE(couple_profile.partner_name, partner_name),
      wedding_date = COALESCE(couple_profile.wedding_date, wedding_date),
      wedding_location = COALESCE(couple_profile.wedding_location, wedding_location),
      email = COALESCE(couple_email, email),
      linked_user_id = req.couple_user_id
    WHERE id = client_id;
  END IF;

  UPDATE public.planner_link_requests
  SET status = 'approved'
  WHERE id = req.id;

  RETURN client_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_planner_code_link_request(request_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acting_role public.app_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT role
  INTO acting_role
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF acting_role NOT IN ('couple'::public.app_role, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only couples can reject this request';
  END IF;

  UPDATE public.planner_link_requests
  SET status = 'rejected'
  WHERE id = request_id_input
    AND couple_user_id = auth.uid()
    AND status = 'pending'
    AND request_source = 'planner_code';
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_my_collaboration_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_planner_link_by_code(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_planner_code_link_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_planner_code_link_request(uuid) TO authenticated;
