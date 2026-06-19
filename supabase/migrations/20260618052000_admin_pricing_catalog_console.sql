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

  if target_row.catalog_key is null then
    insert into public.pricing_catalog (
      catalog_key,
      display_name,
      is_active,
      config
    )
    values (
      'default_live',
      coalesce(nullif(trim(next_display_name), ''), 'Default Live Pricing Catalog'),
      true,
      next_config
    )
    returning *
    into target_row;
  else
    update public.pricing_catalog
    set
      display_name = coalesce(nullif(trim(next_display_name), ''), target_row.display_name),
      config = next_config
    where catalog_key = target_row.catalog_key
    returning *
    into target_row;
  end if;

  return target_row;
end;
$$;

revoke execute on function public.admin_get_active_pricing_catalog() from public, anon;
grant execute on function public.admin_get_active_pricing_catalog() to authenticated;

revoke execute on function public.admin_set_active_pricing_catalog(jsonb, text) from public, anon;
grant execute on function public.admin_set_active_pricing_catalog(jsonb, text) to authenticated;
