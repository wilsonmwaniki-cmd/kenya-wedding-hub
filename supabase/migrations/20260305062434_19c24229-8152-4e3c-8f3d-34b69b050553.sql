
-- Add new columns to guests table
ALTER TABLE public.guests 
  ADD COLUMN IF NOT EXISTS group_name text,
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS checked_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checked_in_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS rsvp_token uuid NOT NULL DEFAULT gen_random_uuid();

-- Unique index on rsvp_token for public lookups
CREATE UNIQUE INDEX IF NOT EXISTS guests_rsvp_token_idx ON public.guests(rsvp_token);

-- Public RSVP function (no auth needed, security definer)
CREATE OR REPLACE FUNCTION public.public_rsvp_respond(_token uuid, _status text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _guest record;
BEGIN
  IF _status NOT IN ('confirmed', 'declined') THEN
    RETURN json_build_object('error', 'Invalid status');
  END IF;

  SELECT id, name, rsvp_status INTO _guest
  FROM guests WHERE rsvp_token = _token;

  IF _guest.id IS NULL THEN
    RETURN json_build_object('error', 'Invalid link');
  END IF;

  UPDATE guests SET rsvp_status = _status WHERE id = _guest.id;

  RETURN json_build_object('success', true, 'name', _guest.name, 'status', _status);
END;
$$;

-- Public lookup function to get guest info by token
CREATE OR REPLACE FUNCTION public.public_rsvp_lookup(_token uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _guest record;
  _profile record;
BEGIN
  SELECT g.id, g.name, g.rsvp_status, g.user_id INTO _guest
  FROM guests g WHERE g.rsvp_token = _token;

  IF _guest.id IS NULL THEN
    RETURN json_build_object('error', 'Invalid link');
  END IF;

  SELECT p.full_name, p.partner_name, p.wedding_date, p.wedding_location INTO _profile
  FROM profiles p WHERE p.user_id = _guest.user_id;

  RETURN json_build_object(
    'guest_name', _guest.name,
    'rsvp_status', _guest.rsvp_status,
    'couple_name', CASE WHEN _profile.full_name IS NOT NULL AND _profile.partner_name IS NOT NULL
      THEN _profile.full_name || ' & ' || _profile.partner_name
      ELSE _profile.full_name END,
    'wedding_date', _profile.wedding_date,
    'wedding_location', _profile.wedding_location
  );
END;
$$;
