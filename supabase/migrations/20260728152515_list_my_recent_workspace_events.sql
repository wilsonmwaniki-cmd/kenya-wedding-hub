create or replace function public.list_my_recent_workspace_events(
  limit_input integer default 5
)
returns table (
  id uuid,
  occurred_at timestamptz,
  event_type text,
  subject_type text,
  subject_id uuid,
  title text,
  summary text,
  action_label text,
  action_path text,
  metadata jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  return query
  with addressed_events as (
    select distinct on (event.id)
      event.id,
      event.occurred_at,
      event.event_type,
      event.subject_type,
      event.subject_id,
      event.title,
      event.summary,
      attention.action_label,
      attention.action_path,
      event.metadata || attention.metadata as metadata
    from public.workspace_events event
    join public.attention_items attention
      on attention.event_id = event.id
     and attention.recipient_user_id = auth.uid()
    order by event.id, attention.created_at desc
  )
  select
    addressed.id,
    addressed.occurred_at,
    addressed.event_type,
    addressed.subject_type,
    addressed.subject_id,
    addressed.title,
    addressed.summary,
    addressed.action_label,
    addressed.action_path,
    addressed.metadata
  from addressed_events addressed
  order by addressed.occurred_at desc
  limit least(greatest(coalesce(limit_input, 5), 1), 20);
end;
$$;

revoke all on function public.list_my_recent_workspace_events(integer) from public, anon;
grant execute on function public.list_my_recent_workspace_events(integer) to authenticated;
