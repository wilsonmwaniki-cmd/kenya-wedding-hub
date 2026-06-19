update public.guests g
set wedding_id = pc.wedding_id
from public.planner_clients pc
where g.wedding_id is null
  and g.client_id = pc.id
  and pc.wedding_id is not null;

with owner_workspace as (
  select distinct on (wm.user_id)
    wm.user_id,
    wm.wedding_id
  from public.wedding_memberships wm
  where wm.user_id is not null
    and wm.is_owner = true
    and wm.membership_status = 'active'
  order by wm.user_id, wm.accepted_at nulls last, wm.created_at
)
update public.guests g
set wedding_id = ow.wedding_id
from owner_workspace ow
where g.wedding_id is null
  and g.user_id = ow.user_id;
