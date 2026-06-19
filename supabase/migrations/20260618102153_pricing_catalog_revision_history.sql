create table if not exists public.pricing_catalog_revisions (
  id uuid primary key default gen_random_uuid(),
  catalog_key text not null references public.pricing_catalog(catalog_key) on delete cascade,
  display_name text not null,
  config jsonb not null default '{}'::jsonb,
  change_source text not null default 'admin_save',
  created_by_user_id uuid null,
  created_at timestamptz not null default now(),
  constraint pricing_catalog_revisions_config_is_object check (jsonb_typeof(config) = 'object')
);

create index if not exists pricing_catalog_revisions_catalog_key_created_at_idx
  on public.pricing_catalog_revisions (catalog_key, created_at desc);

alter table public.pricing_catalog_revisions enable row level security;

revoke all on table public.pricing_catalog_revisions from public;
revoke all on table public.pricing_catalog_revisions from anon;
revoke all on table public.pricing_catalog_revisions from authenticated;
grant all on table public.pricing_catalog_revisions to service_role;

insert into public.pricing_catalog_revisions (
  catalog_key,
  display_name,
  config,
  change_source,
  created_by_user_id,
  created_at
)
select
  catalog_key,
  display_name,
  config,
  'initial_import',
  null,
  now()
from public.pricing_catalog
where is_active = true
  and not exists (
    select 1
    from public.pricing_catalog_revisions revision
    where revision.catalog_key = public.pricing_catalog.catalog_key
  );

create or replace function public.admin_get_active_pricing_catalog()
returns table (
  catalog_key text,
  display_name text,
  is_active boolean,
  config jsonb,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Only admins can view pricing catalog settings.';
  end if;

  return query
  select
    pc.catalog_key,
    pc.display_name,
    pc.is_active,
    pc.config,
    pc.updated_at
  from public.pricing_catalog pc
  where pc.is_active = true
  order by pc.updated_at desc
  limit 1;
end;
$$;

create or replace function public.admin_list_pricing_catalog_revisions(limit_rows integer default 12)
returns table (
  id uuid,
  catalog_key text,
  display_name text,
  config jsonb,
  change_source text,
  created_by_user_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Only admins can view pricing catalog revision history.';
  end if;

  return query
  select
    revision.id,
    revision.catalog_key,
    revision.display_name,
    revision.config,
    revision.change_source,
    revision.created_by_user_id,
    revision.created_at
  from public.pricing_catalog_revisions revision
  order by revision.created_at desc
  limit greatest(coalesce(limit_rows, 12), 1);
end;
$$;

create or replace function public.admin_set_active_pricing_catalog(
  next_config jsonb,
  next_display_name text default null
)
returns public.pricing_catalog
language plpgsql
security definer
set search_path = public
as $$
declare
  target_row public.pricing_catalog%rowtype;
  resolved_display_name text;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Only admins can update pricing catalog settings.';
  end if;

  if next_config is null or jsonb_typeof(next_config) <> 'object' then
    raise exception 'Pricing catalog config must be a JSON object.';
  end if;

  select *
  into target_row
  from public.pricing_catalog
  where is_active = true
  order by updated_at desc
  limit 1;

  resolved_display_name := coalesce(
    nullif(trim(next_display_name), ''),
    target_row.display_name,
    'Default Live Pricing Catalog'
  );

  if target_row.catalog_key is null then
    insert into public.pricing_catalog (
      catalog_key,
      display_name,
      is_active,
      config
    )
    values (
      'default_live',
      resolved_display_name,
      true,
      next_config
    )
    returning *
    into target_row;
  else
    update public.pricing_catalog
    set
      display_name = resolved_display_name,
      config = next_config
    where catalog_key = target_row.catalog_key
    returning *
    into target_row;
  end if;

  insert into public.pricing_catalog_revisions (
    catalog_key,
    display_name,
    config,
    change_source,
    created_by_user_id
  )
  values (
    target_row.catalog_key,
    target_row.display_name,
    target_row.config,
    'admin_save',
    auth.uid()
  );

  return target_row;
end;
$$;

create or replace function public.admin_restore_pricing_catalog_revision(revision_id uuid)
returns public.pricing_catalog
language plpgsql
security definer
set search_path = public
as $$
declare
  target_row public.pricing_catalog%rowtype;
  revision_row public.pricing_catalog_revisions%rowtype;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Only admins can restore pricing catalog revisions.';
  end if;

  select *
  into revision_row
  from public.pricing_catalog_revisions
  where id = revision_id
  limit 1;

  if revision_row.id is null then
    raise exception 'Pricing revision not found.';
  end if;

  select *
  into target_row
  from public.pricing_catalog
  where catalog_key = revision_row.catalog_key
  limit 1;

  if target_row.catalog_key is null then
    raise exception 'Active pricing catalog could not be found.';
  end if;

  update public.pricing_catalog
  set
    display_name = revision_row.display_name,
    config = revision_row.config,
    is_active = true
  where catalog_key = target_row.catalog_key
  returning *
  into target_row;

  insert into public.pricing_catalog_revisions (
    catalog_key,
    display_name,
    config,
    change_source,
    created_by_user_id
  )
  values (
    target_row.catalog_key,
    target_row.display_name,
    target_row.config,
    'admin_restore',
    auth.uid()
  );

  return target_row;
end;
$$;

revoke execute on function public.admin_get_active_pricing_catalog() from public, anon;
grant execute on function public.admin_get_active_pricing_catalog() to authenticated;

revoke execute on function public.admin_list_pricing_catalog_revisions(integer) from public, anon;
grant execute on function public.admin_list_pricing_catalog_revisions(integer) to authenticated;

revoke execute on function public.admin_set_active_pricing_catalog(jsonb, text) from public, anon;
grant execute on function public.admin_set_active_pricing_catalog(jsonb, text) to authenticated;

revoke execute on function public.admin_restore_pricing_catalog_revision(uuid) from public, anon;
grant execute on function public.admin_restore_pricing_catalog_revision(uuid) to authenticated;
