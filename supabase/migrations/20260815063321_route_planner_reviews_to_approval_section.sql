create or replace function public.route_planner_change_review_attention()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.source_type = 'planner_change_request' and new.action_path = '/dashboard' then
    new.action_path := '/dashboard#planner-change-requests';
  end if;

  return new;
end;
$$;

drop trigger if exists route_planner_change_review_attention_trigger on public.attention_items;
create trigger route_planner_change_review_attention_trigger
before insert or update of source_type, action_path on public.attention_items
for each row execute function public.route_planner_change_review_attention();

update public.attention_items
set action_path = '/dashboard#planner-change-requests'
where source_type = 'planner_change_request'
  and action_path = '/dashboard';;
