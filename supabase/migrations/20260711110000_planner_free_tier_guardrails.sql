alter table public.planner_clients
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz null,
  add column if not exists archived_by_user_id uuid null,
  add column if not exists workspace_status text not null default 'active';

alter table public.planner_clients
  drop constraint if exists planner_clients_workspace_status_check;

alter table public.planner_clients
  add constraint planner_clients_workspace_status_check
  check (workspace_status in ('active', 'archived'));

create index if not exists planner_clients_planner_user_archived_idx
  on public.planner_clients (planner_user_id, is_archived, created_at desc);

create table if not exists public.planner_free_wedding_entitlements (
  planner_user_id uuid primary key,
  business_identity_key text not null,
  locked_client_id uuid null references public.planner_clients(id) on delete set null,
  locked_wedding_id uuid null references public.weddings(id) on delete set null,
  locked_relationship_key text null,
  locked_became_meaningful_at timestamptz null,
  replacement_used boolean not null default false,
  released_test_client_id uuid null references public.planner_clients(id) on delete set null,
  released_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists update_planner_free_wedding_entitlements_updated_at on public.planner_free_wedding_entitlements;
create trigger update_planner_free_wedding_entitlements_updated_at
before update on public.planner_free_wedding_entitlements
for each row execute function public.update_updated_at_column();

create or replace function public.planner_has_active_subscription(target_planner_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = target_planner_user_id
      and p.role = 'planner'::public.app_role
      and p.planner_subscription_status = 'active'
      and (p.planner_subscription_expires_at is null or p.planner_subscription_expires_at > now())
  );
$$;

create or replace function public.get_planner_business_identity_key(target_planner_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(lower(trim(p.company_website)), ''),
    nullif(lower(trim(p.company_email)), ''),
    nullif(lower(trim(p.company_phone)), ''),
    nullif(lower(trim(p.full_name)), ''),
    target_planner_user_id::text
  )
  from public.profiles p
  where p.user_id = target_planner_user_id
  limit 1;
$$;

create or replace function public.get_planner_client_relationship_key(target_client_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select concat_ws(
    '|',
    coalesce(pc.wedding_id::text, ''),
    coalesce(pc.linked_user_id::text, ''),
    coalesce(lower(trim(pc.email)), ''),
    coalesce(regexp_replace(pc.phone, '[^0-9]+', '', 'g'), ''),
    coalesce(pc.wedding_date::text, ''),
    coalesce(lower(trim(pc.client_name)), ''),
    coalesce(lower(trim(pc.partner_name)), '')
  )
  from public.planner_clients pc
  where pc.id = target_client_id
  limit 1;
$$;

create or replace function public.planner_client_is_meaningful(target_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.planner_clients pc
    where pc.id = target_client_id
      and (
        pc.linked_user_id is not null
        or pc.wedding_id is not null
        or nullif(trim(pc.email), '') is not null
        or nullif(trim(pc.phone), '') is not null
        or pc.wedding_date is not null
        or nullif(trim(pc.wedding_location), '') is not null
        or nullif(trim(pc.partner_name), '') is not null
        or nullif(trim(pc.notes), '') is not null
      )
  );
$$;

create or replace function public.lock_planner_free_wedding_slot(target_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  client_record public.planner_clients%rowtype;
  entitlement_record public.planner_free_wedding_entitlements%rowtype;
  planner_business_key text;
  client_is_meaningful boolean;
begin
  select *
  into client_record
  from public.planner_clients
  where id = target_client_id
  limit 1;

  if client_record.id is null then
    raise exception 'Planner workspace not found';
  end if;

  if public.planner_has_active_subscription(client_record.planner_user_id) then
    return;
  end if;

  planner_business_key := public.get_planner_business_identity_key(client_record.planner_user_id);
  client_is_meaningful := public.planner_client_is_meaningful(client_record.id);

  insert into public.planner_free_wedding_entitlements (
    planner_user_id,
    business_identity_key
  )
  values (
    client_record.planner_user_id,
    planner_business_key
  )
  on conflict (planner_user_id) do nothing;

  select *
  into entitlement_record
  from public.planner_free_wedding_entitlements
  where planner_user_id = client_record.planner_user_id
  for update;

  if entitlement_record.locked_client_id is null then
    update public.planner_free_wedding_entitlements
    set
      business_identity_key = planner_business_key,
      locked_client_id = client_record.id,
      locked_wedding_id = client_record.wedding_id,
      locked_relationship_key = public.get_planner_client_relationship_key(client_record.id),
      locked_became_meaningful_at = case
        when client_is_meaningful and locked_became_meaningful_at is null then now()
        else locked_became_meaningful_at
      end
    where planner_user_id = client_record.planner_user_id;
    return;
  end if;

  if entitlement_record.locked_client_id = client_record.id then
    update public.planner_free_wedding_entitlements
    set
      business_identity_key = planner_business_key,
      locked_wedding_id = client_record.wedding_id,
      locked_relationship_key = public.get_planner_client_relationship_key(client_record.id),
      locked_became_meaningful_at = case
        when client_is_meaningful and locked_became_meaningful_at is null then now()
        else locked_became_meaningful_at
      end
    where planner_user_id = client_record.planner_user_id;
    return;
  end if;

  raise exception 'Your free planner tier already has a wedding workspace. Archive one unused test workspace once, or upgrade to Planner Pro.'
    using errcode = 'P0001';
end;
$$;

create or replace function public.get_planner_free_wedding_status()
returns table (
  planner_user_id uuid,
  active_client_count integer,
  archived_client_count integer,
  meaningful_client_count integer,
  free_tier_locked_client_id uuid,
  free_tier_replacement_available boolean,
  free_tier_consumed boolean,
  can_add_wedding boolean,
  gating_reason text,
  business_identity_key text,
  locked_client_is_meaningful boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  entitlement_record public.planner_free_wedding_entitlements%rowtype;
  subscription_active boolean;
  active_count integer;
  archived_count integer;
  meaningful_count integer;
  replacement_available boolean;
  can_add boolean;
  reason text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  subscription_active := public.planner_has_active_subscription(auth.uid());

  select count(*)
  into active_count
  from public.planner_clients pc
  where pc.planner_user_id = auth.uid()
    and coalesce(pc.is_archived, false) = false;

  select count(*)
  into archived_count
  from public.planner_clients pc
  where pc.planner_user_id = auth.uid()
    and coalesce(pc.is_archived, false) = true;

  select count(*)
  into meaningful_count
  from public.planner_clients pc
  where pc.planner_user_id = auth.uid()
    and public.planner_client_is_meaningful(pc.id);

  select *
  into entitlement_record
  from public.planner_free_wedding_entitlements
  where planner_user_id = auth.uid();

  replacement_available := entitlement_record.locked_client_id is not null
    and entitlement_record.replacement_used = false
    and not public.planner_client_is_meaningful(entitlement_record.locked_client_id);

  can_add := subscription_active or entitlement_record.locked_client_id is null;

  reason := case
    when subscription_active then null
    when entitlement_record.locked_client_id is null then null
    when replacement_available then 'Archive the unused test workspace to unlock your one replacement.'
    else 'Your free planner tier already has its wedding workspace. Upgrade to Planner Pro to manage another wedding.'
  end;

  return query
  select
    auth.uid(),
    active_count,
    archived_count,
    meaningful_count,
    entitlement_record.locked_client_id,
    replacement_available,
    entitlement_record.locked_client_id is not null or entitlement_record.replacement_used or entitlement_record.released_test_client_id is not null,
    can_add,
    reason,
    coalesce(entitlement_record.business_identity_key, public.get_planner_business_identity_key(auth.uid())),
    case
      when entitlement_record.locked_client_id is null then false
      else public.planner_client_is_meaningful(entitlement_record.locked_client_id)
    end;
end;
$$;

create or replace function public.create_planner_client_guarded(
  client_name_input text,
  partner_name_input text default null,
  wedding_date_input date default null,
  wedding_location_input text default null,
  email_input text default null,
  phone_input text default null
)
returns public.planner_clients
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_role public.app_role;
  new_client public.planner_clients%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select role
  into acting_role
  from public.profiles
  where user_id = auth.uid()
  limit 1;

  if acting_role not in ('planner'::public.app_role, 'admin'::public.app_role) then
    raise exception 'Only planners can create planner workspaces';
  end if;

  insert into public.planner_clients (
    planner_user_id,
    client_name,
    partner_name,
    wedding_date,
    wedding_location,
    email,
    phone,
    is_archived,
    workspace_status
  )
  values (
    auth.uid(),
    trim(client_name_input),
    nullif(trim(partner_name_input), ''),
    wedding_date_input,
    nullif(trim(wedding_location_input), ''),
    nullif(lower(trim(email_input)), ''),
    nullif(trim(phone_input), ''),
    false,
    'active'
  )
  returning *
  into new_client;

  perform public.lock_planner_free_wedding_slot(new_client.id);

  return new_client;
exception
  when others then
    if new_client.id is not null then
      delete from public.planner_clients where id = new_client.id;
    end if;
    raise;
end;
$$;

create or replace function public.archive_planner_client_guarded(target_client_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_role public.app_role;
  client_record public.planner_clients%rowtype;
  entitlement_record public.planner_free_wedding_entitlements%rowtype;
  client_is_meaningful boolean;
  released_free_slot boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select role
  into acting_role
  from public.profiles
  where user_id = auth.uid()
  limit 1;

  if acting_role not in ('planner'::public.app_role, 'admin'::public.app_role) then
    raise exception 'Only planners can archive planner workspaces';
  end if;

  select *
  into client_record
  from public.planner_clients
  where id = target_client_id
    and planner_user_id = auth.uid()
  limit 1;

  if client_record.id is null then
    raise exception 'Planner workspace not found';
  end if;

  update public.planner_clients
  set
    is_archived = true,
    workspace_status = 'archived',
    archived_at = coalesce(archived_at, now()),
    archived_by_user_id = auth.uid(),
    updated_at = now()
  where id = client_record.id;

  if public.planner_has_active_subscription(auth.uid()) then
    return json_build_object(
      'archived', true,
      'released_free_tier_slot', false,
      'replacement_used', false
    );
  end if;

  select *
  into entitlement_record
  from public.planner_free_wedding_entitlements
  where planner_user_id = auth.uid()
  for update;

  if entitlement_record.locked_client_id = client_record.id then
    client_is_meaningful := public.planner_client_is_meaningful(client_record.id);

    if not client_is_meaningful and entitlement_record.replacement_used = false then
      update public.planner_free_wedding_entitlements
      set
        locked_client_id = null,
        locked_wedding_id = null,
        locked_relationship_key = null,
        locked_became_meaningful_at = null,
        released_test_client_id = client_record.id,
        released_at = now(),
        replacement_used = true
      where planner_user_id = auth.uid();

      released_free_slot := true;
    end if;
  end if;

  return json_build_object(
    'archived', true,
    'released_free_tier_slot', released_free_slot,
    'replacement_used', coalesce(entitlement_record.replacement_used, false) or released_free_slot
  );
end;
$$;

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
  client_id uuid;
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
  limit 1;

  select id
  into client_id
  from public.planner_clients
  where planner_user_id = req.planner_user_id
    and linked_user_id = req.couple_user_id
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
      false,
      'active'
    )
    returning id
    into client_id;

    perform public.lock_planner_free_wedding_slot(client_id);
  else
    update public.planner_clients
    set
      client_name = coalesce(couple_profile.full_name, client_name),
      partner_name = coalesce(couple_profile.partner_name, partner_name),
      wedding_date = coalesce(couple_profile.wedding_date, wedding_date),
      wedding_location = coalesce(couple_profile.wedding_location, wedding_location),
      email = coalesce(couple_email, email),
      linked_user_id = req.couple_user_id,
      is_archived = false,
      workspace_status = 'active',
      archived_at = null,
      archived_by_user_id = null
    where id = client_id;

    perform public.lock_planner_free_wedding_slot(client_id);
  end if;

  update public.planner_link_requests
  set status = 'approved'
  where id = req.id;

  return client_id;
exception
  when others then
    if client_id is not null then
      update public.planner_clients
      set
        is_archived = true,
        workspace_status = 'archived',
        archived_at = coalesce(archived_at, now()),
        archived_by_user_id = req.couple_user_id
      where id = client_id
        and linked_user_id = req.couple_user_id
        and not exists (
          select 1
          from public.planner_free_wedding_entitlements pfe
          where pfe.locked_client_id = client_id
        );
    end if;
    raise;
end;
$$;

grant execute on function public.planner_has_active_subscription(uuid) to authenticated;
grant execute on function public.get_planner_business_identity_key(uuid) to authenticated;
grant execute on function public.get_planner_client_relationship_key(uuid) to authenticated;
grant execute on function public.planner_client_is_meaningful(uuid) to authenticated;
grant execute on function public.get_planner_free_wedding_status() to authenticated;
grant execute on function public.create_planner_client_guarded(text, text, date, text, text, text) to authenticated;
grant execute on function public.archive_planner_client_guarded(uuid) to authenticated;
