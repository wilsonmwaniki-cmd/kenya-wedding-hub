
CREATE OR REPLACE FUNCTION public.get_shared_timeline(_share_token uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', t.id,
    'title', t.title,
    'timeline_date', t.timeline_date,
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
      FROM timeline_events e WHERE e.timeline_id = t.id
    ), '[]'::json)
  ) INTO result
  FROM timelines t
  WHERE t.share_token = _share_token;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_assignee_timeline(_share_token uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  _timeline_id uuid;
  _assignee text;
BEGIN
  SELECT sl.timeline_id, sl.assignee_name INTO _timeline_id, _assignee
  FROM timeline_share_links sl
  WHERE sl.share_token = _share_token;

  IF _timeline_id IS NULL THEN RETURN NULL; END IF;

  SELECT json_build_object(
    'id', t.id,
    'title', t.title,
    'timeline_date', t.timeline_date,
    'assignee_name', _assignee,
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
$$;
