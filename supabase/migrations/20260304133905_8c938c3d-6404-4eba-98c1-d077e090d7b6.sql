
-- Timelines table
CREATE TABLE public.timelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.planner_clients(id) ON DELETE SET NULL,
  title text NOT NULL,
  timeline_date date,
  is_template boolean NOT NULL DEFAULT false,
  share_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.timelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own timelines" ON public.timelines
FOR ALL TO authenticated
USING (auth.uid() = user_id OR is_linked_planner_of(user_id) OR is_linked_couple_of(client_id))
WITH CHECK (auth.uid() = user_id OR is_linked_planner_of(user_id) OR is_linked_couple_of(client_id));

-- Timeline events
CREATE TABLE public.timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid NOT NULL REFERENCES public.timelines(id) ON DELETE CASCADE,
  event_time time WITHOUT TIME ZONE NOT NULL,
  title text NOT NULL,
  description text,
  assigned_people text[] NOT NULL DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

-- Security definer to check timeline ownership
CREATE OR REPLACE FUNCTION public.owns_timeline(_timeline_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM timelines
    WHERE id = _timeline_id
    AND (user_id = auth.uid() OR is_linked_planner_of(user_id) OR is_linked_couple_of(client_id))
  )
$$;

CREATE POLICY "Users can manage timeline events" ON public.timeline_events
FOR ALL TO authenticated
USING (public.owns_timeline(timeline_id))
WITH CHECK (public.owns_timeline(timeline_id));

-- Per-person share links
CREATE TABLE public.timeline_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid NOT NULL REFERENCES public.timelines(id) ON DELETE CASCADE,
  assignee_name text NOT NULL,
  share_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(timeline_id, assignee_name)
);

ALTER TABLE public.timeline_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own share links" ON public.timeline_share_links
FOR ALL TO authenticated
USING (public.owns_timeline(timeline_id))
WITH CHECK (public.owns_timeline(timeline_id));

-- Public access RPC: full timeline by share token
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
          'sort_order', e.sort_order
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

-- Public access RPC: per-person filtered timeline
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
          'sort_order', e.sort_order
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

-- Enable realtime for timeline events
ALTER PUBLICATION supabase_realtime ADD TABLE public.timeline_events;
