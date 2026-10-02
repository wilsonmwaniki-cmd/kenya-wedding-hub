create or replace function public.route_planner_change_review_attention()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.source_type = 'planner_change_request' and new.source_id is not null then
    new.action_path := '/dashboard#planner-change-' || new.source_id::text;
  end if;

  return new;
end;
$$;

update public.attention_items
set action_path = '/dashboard#planner-change-' || source_id::text
where source_type = 'planner_change_request'
  and source_id is not null;;
