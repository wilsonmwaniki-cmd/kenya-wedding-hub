-- Wedding workspace backfill
-- Safely maps legacy profile-, planner_client-, and committee-first records
-- into the new wedding-scoped ownership model without removing legacy access paths.

alter table public.weddings
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create or replace function public.legacy_backfill_wedding_name(
  primary_name text,
  partner_name text,
  fallback_name text default 'Wedding Workspace'
)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    nullif(
      trim(
        concat_ws(
          ' & ',
          nullif(trim(coalesce(primary_name, '')), ''),
          nullif(trim(coalesce(partner_name, '')), '')
        )
      ),
      ''
    ),
    nullif(trim(coalesce(primary_name, '')), ''),
    nullif(trim(coalesce(fallback_name, '')), ''),
    'Wedding Workspace'
  );
$$;

create or replace function public.infer_owner_membership_role(target_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with auth_source as (
    select lower(
      coalesce(
        au.raw_user_meta_data ->> 'wedding_role',
        au.raw_user_meta_data ->> 'couple_role',
        case
          when au.raw_user_meta_data ->> 'role' in ('bride', 'groom') then au.raw_user_meta_data ->> 'role'
          else null
        end,
        ''
      )
    ) as inferred_role
    from auth.users au
    where au.id = target_user_id
  )
  select case
    when inferred_role = 'groom' then 'groom'
    else 'bride'
  end
  from auth_source;
$$;

-- Couple-owned weddings from legacy couple profiles.
insert into public.weddings (
  name,
  wedding_code,
  status,
  wedding_date,
  location_town,
  created_by_user_id,
  metadata
)
select
  public.legacy_backfill_wedding_name(
    p.full_name,
    p.partner_name,
    'Wedding Workspace'
  ) as name,
  coalesce(nullif(trim(p.collaboration_code), ''), public.generate_wedding_code()) as wedding_code,
  case
    when p.planning_pass_status in ('active', 'past_due') then 'active'
    else 'draft'
  end as status,
  p.wedding_date,
  nullif(trim(coalesce(p.wedding_location, '')), '') as location_town,
  p.user_id,
  jsonb_build_object(
    'legacy_source', 'profile_owner',
    'legacy_profile_id', p.id,
    'legacy_user_id', p.user_id,
    'backfilled_at', now()
  )
from public.profiles p
where p.role = 'couple'::public.app_role
  and not exists (
    select 1
    from public.weddings w
    where w.metadata ->> 'legacy_profile_id' = p.id::text
  );

-- Couple owner memberships.
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
  w.id,
  p.user_id,
  lower(au.email),
  public.infer_owner_membership_role(p.user_id),
  'active',
  true,
  p.user_id,
  now(),
  jsonb_build_object(
    'legacy_source', 'profile_owner',
    'legacy_profile_id', p.id,
    'role_inferred', true
  )
from public.profiles p
join auth.users au
  on au.id = p.user_id
join public.weddings w
  on w.metadata ->> 'legacy_profile_id' = p.id::text
where p.role = 'couple'::public.app_role
  and au.email is not null
  and not exists (
    select 1
    from public.wedding_memberships wm
    where wm.wedding_id = w.id
      and wm.user_id = p.user_id
      and wm.is_owner = true
  );

-- Couple planning pass subscriptions become legacy wedding bundles.
insert into public.wedding_subscription_bundles (
  wedding_id,
  bundle_code,
  bundle_type,
  status,
  billing_cycle,
  activated_at,
  expires_at,
  metadata
)
select
  w.id,
  'legacy_wedding_pass',
  'wedding_pass',
  case p.planning_pass_status
    when 'active' then 'active'
    when 'past_due' then 'grace'
    when 'cancelled' then 'cancelled'
    else 'inactive'
  end,
  'annual',
  p.planning_pass_started_at,
  p.planning_pass_expires_at,
  jsonb_build_object(
    'legacy_source', 'profile_planning_pass',
    'legacy_profile_id', p.id
  )
from public.profiles p
join public.weddings w
  on w.metadata ->> 'legacy_profile_id' = p.id::text
where p.role = 'couple'::public.app_role
  and p.planning_pass_status <> 'inactive'
  and not exists (
    select 1
    from public.wedding_subscription_bundles wsb
    where wsb.wedding_id = w.id
      and wsb.bundle_code = 'legacy_wedding_pass'
  );

insert into public.wedding_entitlements (
  wedding_id,
  feature_key,
  status,
  source_bundle_id,
  effective_from,
  effective_to,
  metadata
)
select
  wsb.wedding_id,
  'wedding_collaboration',
  case
    when wsb.status in ('active', 'grace') then 'active'
    when wsb.status = 'cancelled' then 'revoked'
    else 'inactive'
  end,
  wsb.id,
  coalesce(wsb.activated_at, now()),
  wsb.expires_at,
  jsonb_build_object(
    'legacy_source', 'profile_planning_pass_bundle'
  )
from public.wedding_subscription_bundles wsb
where wsb.bundle_code = 'legacy_wedding_pass'
  and not exists (
    select 1
    from public.wedding_entitlements we
    where we.wedding_id = wsb.wedding_id
      and we.feature_key = 'wedding_collaboration'
  );

-- Planner clients linked to a real couple should point at that couple-owned wedding.
update public.planner_clients pc
set wedding_id = w.id
from public.profiles p
join public.weddings w
  on w.metadata ->> 'legacy_profile_id' = p.id::text
where pc.wedding_id is null
  and pc.linked_user_id = p.user_id
  and p.role = 'couple'::public.app_role;

-- Create draft weddings for planner-owned client records with no linked couple yet.
insert into public.weddings (
  name,
  wedding_code,
  status,
  wedding_date,
  location_town,
  created_by_user_id,
  metadata
)
select
  public.legacy_backfill_wedding_name(
    pc.client_name,
    pc.partner_name,
    'Planner Client Workspace'
  ) as name,
  public.generate_wedding_code(),
  'draft',
  pc.wedding_date,
  nullif(trim(coalesce(pc.wedding_location, '')), '') as location_town,
  pc.planner_user_id,
  jsonb_build_object(
    'legacy_source', 'planner_client',
    'legacy_planner_client_id', pc.id,
    'legacy_planner_user_id', pc.planner_user_id,
    'backfilled_at', now()
  )
from public.planner_clients pc
where pc.wedding_id is null
  and not exists (
    select 1
    from public.weddings w
    where w.metadata ->> 'legacy_planner_client_id' = pc.id::text
  );

update public.planner_clients pc
set wedding_id = w.id
from public.weddings w
where pc.wedding_id is null
  and w.metadata ->> 'legacy_planner_client_id' = pc.id::text;

-- Planner memberships for any planner-client-linked workspace.
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
select distinct
  pc.wedding_id,
  pc.planner_user_id,
  lower(au.email),
  'planner',
  'active',
  false,
  pc.planner_user_id,
  now(),
  jsonb_build_object(
    'legacy_source', 'planner_client',
    'legacy_planner_client_id', pc.id
  )
from public.planner_clients pc
join auth.users au
  on au.id = pc.planner_user_id
where pc.wedding_id is not null
  and au.email is not null
  and not exists (
    select 1
    from public.wedding_memberships wm
    where wm.wedding_id = pc.wedding_id
      and wm.user_id = pc.planner_user_id
      and wm.role = 'planner'
  );

-- Attach committee rows where the chair cleanly resolves to exactly one workspace.
with resolved_chair_workspace as (
  select
    wm.user_id as chair_user_id,
    min(wm.wedding_id::text)::uuid as wedding_id
  from public.wedding_memberships wm
  where wm.user_id is not null
    and wm.membership_status = 'active'
  group by wm.user_id
  having count(distinct wm.wedding_id) = 1
)
update public.wedding_committee_members wcm
set wedding_id = rcw.wedding_id
from resolved_chair_workspace rcw
where wcm.wedding_id is null
  and wcm.chair_user_id = rcw.chair_user_id;

-- Create one committee workspace per unresolved chair as a safe fallback.
insert into public.weddings (
  name,
  wedding_code,
  status,
  created_by_user_id,
  metadata
)
select
  public.legacy_backfill_wedding_name(
    p.committee_name,
    null,
    coalesce(nullif(trim(p.full_name), ''), 'Committee Workspace')
  ) as name,
  public.generate_wedding_code(),
  'draft',
  wcm.chair_user_id,
  jsonb_build_object(
    'legacy_source', 'committee_workspace',
    'legacy_committee_chair_user_id', wcm.chair_user_id,
    'workspace_kind', 'committee_fallback',
    'requires_owner_resolution', true,
    'ownership_model', 'backfill_committee_only',
    'backfilled_at', now()
  )
from (
  select distinct chair_user_id
  from public.wedding_committee_members
  where wedding_id is null
) wcm
left join public.profiles p
  on p.user_id = wcm.chair_user_id
where not exists (
  select 1
  from public.weddings w
  where w.metadata ->> 'legacy_committee_chair_user_id' = wcm.chair_user_id::text
);

update public.wedding_committee_members wcm
set wedding_id = w.id
from public.weddings w
where wcm.wedding_id is null
  and w.metadata ->> 'legacy_committee_chair_user_id' = wcm.chair_user_id::text;

-- Committee chair memberships on any workspace that now contains their committee rows.
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
select distinct
  wcm.wedding_id,
  wcm.chair_user_id,
  lower(au.email),
  'committee_chair',
  'active',
  false,
  wcm.chair_user_id,
  now(),
  jsonb_build_object(
    'legacy_source', 'committee_chair',
    'committee_rows_backfilled', true
  )
from public.wedding_committee_members wcm
join auth.users au
  on au.id = wcm.chair_user_id
where wcm.wedding_id is not null
  and au.email is not null
  and not exists (
    select 1
    from public.wedding_memberships wm
    where wm.wedding_id = wcm.wedding_id
      and wm.user_id = wcm.chair_user_id
      and wm.role = 'committee_chair'
  );

-- Email-backed committee memberships.
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
  wcm.wedding_id,
  au.id,
  lower(wcm.email),
  case
    when wcm.permission_level = 'chair' then 'committee_chair'
    else 'committee_member'
  end,
  case
    when wcm.status = 'active' then 'active'
    else 'revoked'
  end,
  false,
  wcm.chair_user_id,
  case when wcm.status = 'active' then now() else null end,
  jsonb_build_object(
    'legacy_source', 'committee_member_row',
    'legacy_committee_member_id', wcm.id,
    'legacy_permission_level', wcm.permission_level
  )
from public.wedding_committee_members wcm
left join auth.users au
  on lower(au.email) = lower(wcm.email)
where wcm.wedding_id is not null
  and nullif(lower(trim(coalesce(wcm.email, ''))), '') is not null
  and not exists (
    select 1
    from public.wedding_memberships wm
    where wm.wedding_id = wcm.wedding_id
      and lower(wm.email) = lower(wcm.email)
      and wm.role = case
        when wcm.permission_level = 'chair' then 'committee_chair'
        else 'committee_member'
      end
  );

update public.wedding_committee_members wcm
set membership_id = wm.id
from public.wedding_memberships wm
where wcm.wedding_id = wm.wedding_id
  and wcm.membership_id is null
  and nullif(lower(trim(coalesce(wcm.email, ''))), '') is not null
  and lower(wm.email) = lower(wcm.email)
  and wm.role = case
    when wcm.permission_level = 'chair' then 'committee_chair'
    else 'committee_member'
  end;

-- Backfill committee bundle seat limits from the number of active committee seats already in use.
insert into public.wedding_subscription_bundles (
  wedding_id,
  bundle_code,
  bundle_type,
  status,
  billing_cycle,
  seat_limit,
  seats_used,
  activated_at,
  metadata
)
select
  wm.wedding_id,
  'legacy_committee_bundle',
  'committee_bundle',
  'active',
  'annual',
  greatest(count(*)::integer, 1),
  count(*)::integer,
  now(),
  jsonb_build_object(
    'legacy_source', 'committee_memberships'
  )
from public.wedding_memberships wm
where wm.role in ('committee_chair', 'committee_member')
  and wm.membership_status = 'active'
group by wm.wedding_id
having not exists (
  select 1
  from public.wedding_subscription_bundles wsb
  where wsb.wedding_id = wm.wedding_id
    and wsb.bundle_code = 'legacy_committee_bundle'
);

insert into public.wedding_entitlements (
  wedding_id,
  feature_key,
  status,
  source_bundle_id,
  effective_from,
  metadata
)
select
  wsb.wedding_id,
  'committee_collaboration',
  'active',
  wsb.id,
  coalesce(wsb.activated_at, now()),
  jsonb_build_object(
    'legacy_source', 'committee_bundle'
  )
from public.wedding_subscription_bundles wsb
where wsb.bundle_code = 'legacy_committee_bundle'
  and not exists (
    select 1
    from public.wedding_entitlements we
    where we.wedding_id = wsb.wedding_id
      and we.feature_key = 'committee_collaboration'
  );

-- Legacy table sweep: planner-linked records first, then couple-owned records.
update public.tasks t
set wedding_id = pc.wedding_id
from public.planner_clients pc
where t.wedding_id is null
  and t.client_id = pc.id
  and pc.wedding_id is not null;

update public.budget_categories bc
set wedding_id = pc.wedding_id
from public.planner_clients pc
where bc.wedding_id is null
  and bc.client_id = pc.id
  and pc.wedding_id is not null;

update public.budget_payments bp
set wedding_id = pc.wedding_id
from public.planner_clients pc
where bp.wedding_id is null
  and bp.client_id = pc.id
  and pc.wedding_id is not null;

update public.guests g
set wedding_id = pc.wedding_id
from public.planner_clients pc
where g.wedding_id is null
  and g.client_id = pc.id
  and pc.wedding_id is not null;

update public.vendors v
set wedding_id = pc.wedding_id
from public.planner_clients pc
where v.wedding_id is null
  and v.client_id = pc.id
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
update public.tasks t
set wedding_id = ow.wedding_id
from owner_workspace ow
where t.wedding_id is null
  and t.user_id = ow.user_id;

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
update public.budget_categories bc
set wedding_id = ow.wedding_id
from owner_workspace ow
where bc.wedding_id is null
  and bc.user_id = ow.user_id;

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
update public.budget_payments bp
set wedding_id = ow.wedding_id
from owner_workspace ow
where bp.wedding_id is null
  and bp.user_id = ow.user_id;

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
update public.vendors v
set wedding_id = ow.wedding_id
from owner_workspace ow
where v.wedding_id is null
  and v.user_id = ow.user_id;

-- Conservative task assignment backfill: only exact email matches.
update public.tasks t
set assigned_membership_id = wm.id
from public.wedding_memberships wm
where t.wedding_id = wm.wedding_id
  and t.assigned_membership_id is null
  and t.assigned_to is not null
  and position('@' in t.assigned_to) > 0
  and lower(trim(t.assigned_to)) = lower(wm.email);

-- Capture legacy assignment roles without forcing membership ownership.
insert into public.wedding_assignment_roles (
  wedding_id,
  assignment_role,
  source_task_id,
  metadata
)
select
  t.wedding_id,
  t.recommended_role,
  t.id,
  jsonb_build_object(
    'legacy_source', 'task_recommended_role',
    'template_source', t.template_source
  )
from public.tasks t
where t.wedding_id is not null
  and nullif(trim(coalesce(t.recommended_role, '')), '') is not null
  and not exists (
    select 1
    from public.wedding_assignment_roles war
    where war.wedding_id = t.wedding_id
      and war.assignment_role = t.recommended_role
      and war.source_task_id = t.id
  );
