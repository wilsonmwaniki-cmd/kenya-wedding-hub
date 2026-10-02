-- Repair stale planner links and keep every approved planner/couple relationship
-- attached to the couple's canonical wedding workspace.

with stale_matches as (
  select
    pc.id as client_id,
    au.id as couple_user_id,
    count(*) over (partition by pc.id) as match_count
  from public.planner_clients pc
  left join auth.users current_auth_user
    on current_auth_user.id = pc.linked_user_id
   and current_auth_user.deleted_at is null
  join auth.users au
    on lower(au.email::text) = lower(pc.email)
   and au.deleted_at is null
  join public.profiles p
    on p.user_id = au.id
   and p.role = 'couple'::public.app_role
  where pc.linked_user_id is not null
    and current_auth_user.id is null
    and pc.email is not null
    and pc.is_archived = false
    and public.get_planner_business_identity_key(pc.planner_user_id) is not null
),
unique_stale_matches as (
  select client_id, couple_user_id
  from stale_matches
  where match_count = 1
)
update public.planner_clients pc
set
  linked_user_id = match.couple_user_id,
  updated_at = now()
from unique_stale_matches match
where pc.id = match.client_id;

with primary_weddings as (
  select distinct on (wm.user_id)
    wm.user_id,
    wm.wedding_id
  from public.wedding_memberships wm
  join public.weddings w on w.id = wm.wedding_id
  where wm.user_id is not null
    and wm.membership_status = 'active'
    and w.deleted_at is null
  order by
    wm.user_id,
    wm.is_owner desc,
    w.updated_at desc,
    w.created_at desc
)
update public.planner_clients pc
set
  wedding_id = primary_weddings.wedding_id,
  updated_at = now()
from primary_weddings
where pc.linked_user_id = primary_weddings.user_id
  and pc.is_archived = false
  and public.get_planner_business_identity_key(pc.planner_user_id) is not null
  and pc.wedding_id is distinct from primary_weddings.wedding_id;

with linked_client_details as (
  select
    pc.id,
    p.full_name,
    p.partner_name,
    p.wedding_date as profile_wedding_date,
    p.wedding_location,
    w.wedding_date as workspace_wedding_date
  from public.planner_clients pc
  join public.profiles p on p.user_id = pc.linked_user_id
    and p.role = 'couple'::public.app_role
  left join public.weddings w on w.id = pc.wedding_id
  where pc.is_archived = false
    and public.get_planner_business_identity_key(pc.planner_user_id) is not null
)
update public.planner_clients pc
set
  client_name = coalesce(nullif(trim(details.full_name), ''), pc.client_name),
  partner_name = coalesce(nullif(trim(details.partner_name), ''), pc.partner_name),
  wedding_date = coalesce(details.workspace_wedding_date, details.profile_wedding_date, pc.wedding_date),
  wedding_location = coalesce(nullif(trim(details.wedding_location), ''), pc.wedding_location),
  updated_at = now()
from linked_client_details details
where pc.id = details.id;

insert into public.wedding_memberships (
  wedding_id,
  user_id,
  email,
  role,
  membership_status,
  is_owner,
  invited_by_user_id,
  accepted_at,
  metadata
)
select
  pc.wedding_id,
  pc.planner_user_id,
  lower(au.email::text),
  'planner',
  'active',
  false,
  pc.linked_user_id,
  now(),
  jsonb_build_object(
    'source', 'planner_couple_link',
    'planner_client_id', pc.id
  )
from public.planner_clients pc
join auth.users au on au.id = pc.planner_user_id
where pc.wedding_id is not null
  and pc.linked_user_id is not null
  and pc.is_archived = false
  and public.get_planner_business_identity_key(pc.planner_user_id) is not null
  and not exists (
    select 1
    from public.wedding_memberships wm
    where wm.wedding_id = pc.wedding_id
      and wm.user_id = pc.planner_user_id
      and wm.role = 'planner'
      and wm.membership_status in ('invited', 'active')
  );

update public.planner_free_wedding_entitlements entitlement
set
  locked_wedding_id = pc.wedding_id,
  updated_at = now()
from public.planner_clients pc
where entitlement.locked_client_id = pc.id
  and pc.wedding_id is not null
  and entitlement.locked_wedding_id is distinct from pc.wedding_id;

create or replace function public.approve_planner_code_link_request(request_id_input uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.planner_link_requests%rowtype;
  couple_profile public.profiles%rowtype;
  couple_email text;
  planner_email text;
  client_id uuid;
  couple_wedding_id uuid;
  acting_role public.app_role;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select role
  into acting_role
  from public.profiles
  where user_id = auth.uid()
  limit 1;

  if acting_role not in ('couple'::public.app_role, 'admin'::public.app_role) then
    raise exception 'Only couples can approve this request';
  end if;

  select *
  into req
  from public.planner_link_requests
  where id = request_id_input
    and couple_user_id = auth.uid()
    and status = 'pending'
    and request_source = 'planner_code'
  limit 1;

  if req.id is null then
    raise exception 'Link request not found';
  end if;

  select *
  into couple_profile
  from public.profiles
  where user_id = auth.uid()
  limit 1;

  select email::text
  into couple_email
  from auth.users
  where id = auth.uid()
    and deleted_at is null
  limit 1;

  select email::text
  into planner_email
  from auth.users
  where id = req.planner_user_id
    and deleted_at is null
  limit 1;

  select wm.wedding_id
  into couple_wedding_id
  from public.wedding_memberships wm
  join public.weddings w on w.id = wm.wedding_id
  where wm.user_id = req.couple_user_id
    and wm.membership_status = 'active'
    and w.deleted_at is null
  order by wm.is_owner desc, w.updated_at desc, w.created_at desc
  limit 1;

  if couple_wedding_id is null then
    raise exception 'Create your wedding workspace before approving a planner';
  end if;

  select pc.id
  into client_id
  from public.planner_clients pc
  where pc.planner_user_id = req.planner_user_id
    and (
      pc.linked_user_id = req.couple_user_id
      or (
        couple_email is not null
        and pc.email is not null
        and lower(pc.email) = lower(couple_email)
      )
    )
  order by
    (pc.linked_user_id = req.couple_user_id) desc,
    pc.updated_at desc
  limit 1;

  if client_id is null then
    insert into public.planner_clients (
      planner_user_id,
      client_name,
      partner_name,
      wedding_date,
      wedding_location,
      email,
      linked_user_id,
      wedding_id,
      is_archived,
      workspace_status
    )
    values (
      req.planner_user_id,
      coalesce(couple_profile.full_name, 'Client'),
      couple_profile.partner_name,
      couple_profile.wedding_date,
      couple_profile.wedding_location,
      couple_email,
      req.couple_user_id,
      couple_wedding_id,
      false,
      'active'
    )
    returning id into client_id;
  else
    update public.planner_clients
    set
      client_name = coalesce(couple_profile.full_name, client_name),
      partner_name = coalesce(couple_profile.partner_name, partner_name),
      wedding_date = coalesce(couple_profile.wedding_date, wedding_date),
      wedding_location = coalesce(couple_profile.wedding_location, wedding_location),
      email = coalesce(couple_email, email),
      linked_user_id = req.couple_user_id,
      wedding_id = couple_wedding_id,
      is_archived = false,
      workspace_status = 'active',
      archived_at = null,
      archived_by_user_id = null,
      updated_at = now()
    where id = client_id;
  end if;

  insert into public.wedding_memberships (
    wedding_id,
    user_id,
    email,
    role,
    membership_status,
    is_owner,
    invited_by_user_id,
    accepted_at,
    metadata
  )
  select
    couple_wedding_id,
    req.planner_user_id,
    lower(planner_email),
    'planner',
    'active',
    false,
    req.couple_user_id,
    now(),
    jsonb_build_object(
      'source', 'planner_code',
      'planner_client_id', client_id,
      'link_request_id', req.id
    )
  where planner_email is not null
    and not exists (
      select 1
      from public.wedding_memberships wm
      where wm.wedding_id = couple_wedding_id
        and wm.user_id = req.planner_user_id
        and wm.role = 'planner'
        and wm.membership_status in ('invited', 'active')
    );

  perform public.lock_planner_free_wedding_slot(client_id);

  update public.planner_link_requests
  set
    status = 'approved',
    updated_at = now()
  where id = req.id;

  return client_id;
end;
$$;

grant execute on function public.approve_planner_code_link_request(uuid) to authenticated;
