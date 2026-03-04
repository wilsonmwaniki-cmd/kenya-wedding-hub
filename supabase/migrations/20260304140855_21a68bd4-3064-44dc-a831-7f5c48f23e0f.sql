
-- Add vendor_role and email to timeline_share_links for role-based views and reminders
ALTER TABLE public.timeline_share_links 
  ADD COLUMN IF NOT EXISTS vendor_role text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email text DEFAULT NULL;

-- Update RPC functions to include vendor_role in share link data
CREATE OR REPLACE FUNCTION public.get_assignee_timeline(_share_token uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  _timeline_id uuid;
  _assignee text;
  _vendor_role text;
BEGIN
  SELECT sl.timeline_id, sl.assignee_name, sl.vendor_role INTO _timeline_id, _assignee, _vendor_role
  FROM timeline_share_links sl
  WHERE sl.share_token = _share_token;

  IF _timeline_id IS NULL THEN RETURN NULL; END IF;

  SELECT json_build_object(
    'id', t.id,
    'title', t.title,
    'timeline_date', t.timeline_date,
    'assignee_name', _assignee,
    'vendor_role', _vendor_role,
    'events', COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', e.id,
          'event_time', e.event_time,
          'title', e.title,
          'description', e.description,
          'assigned_people', e.assigned_people,
          'sort_order', e.sort_order,
          'category', e.category
        ) ORDER BY e.event_time, e.sort_order
      )
      FROM timeline_events e
      WHERE e.timeline_id = t.id AND _assignee = ANY(e.assigned_people)
    ), '[]'::json)
  ) INTO result
  FROM timelines t
  WHERE t.id = _timeline_id;

  RETURN result;
END;
$function$;
