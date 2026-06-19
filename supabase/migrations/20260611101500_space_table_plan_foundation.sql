create or replace function public.can_edit_wedding_space_plan(target_wedding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when public.has_role(auth.uid(), 'admin'::public.app_role) then true
    else exists (
      select 1
      from public.wedding_memberships wm
      where wm.wedding_id = target_wedding_id
        and wm.membership_status = 'active'
        and wm.role in ('bride', 'groom', 'planner', 'committee_chair')
        and (
          wm.user_id = auth.uid()
          or lower(wm.email) = public.current_user_email()
        )
    )
  end;
$$;

create table if not exists public.wedding_space_plans (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  space_type text not null,
  event_label text null,
  notes text null,
  canvas_width integer not null default 1600 check (canvas_width > 0),
  canvas_height integer not null default 900 check (canvas_height > 0),
  status text not null default 'draft'
    check (status in ('draft', 'review', 'final')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wedding_space_plans_wedding_id_idx
  on public.wedding_space_plans (wedding_id, created_at desc);

create index if not exists wedding_space_plans_created_by_user_id_idx
  on public.wedding_space_plans (created_by_user_id, created_at desc);

create index if not exists wedding_space_plans_status_idx
  on public.wedding_space_plans (status);

drop trigger if exists update_wedding_space_plans_updated_at on public.wedding_space_plans;
create trigger update_wedding_space_plans_updated_at
before update on public.wedding_space_plans
for each row execute function public.update_updated_at_column();

create table if not exists public.wedding_space_plan_objects (
  id uuid primary key default gen_random_uuid(),
  space_plan_id uuid not null references public.wedding_space_plans(id) on delete cascade,
  object_type text not null,
  label text null,
  notes text null,
  x numeric(10,2) not null default 0,
  y numeric(10,2) not null default 0,
  width numeric(10,2) not null default 120 check (width > 0),
  height numeric(10,2) not null default 120 check (height > 0),
  rotation numeric(8,2) not null default 0,
  z_index integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wedding_space_plan_objects_space_plan_id_idx
  on public.wedding_space_plan_objects (space_plan_id, z_index asc, created_at asc);

create index if not exists wedding_space_plan_objects_type_idx
  on public.wedding_space_plan_objects (object_type);

drop trigger if exists update_wedding_space_plan_objects_updated_at on public.wedding_space_plan_objects;
create trigger update_wedding_space_plan_objects_updated_at
before update on public.wedding_space_plan_objects
for each row execute function public.update_updated_at_column();

create table if not exists public.wedding_space_plan_tables (
  id uuid primary key default gen_random_uuid(),
  space_plan_object_id uuid not null references public.wedding_space_plan_objects(id) on delete cascade,
  table_name text not null,
  shape text not null
    check (shape in ('round', 'rectangle', 'high_table', 'sweetheart')),
  capacity integer not null check (capacity > 0),
  vip boolean not null default false,
  decor_notes text null,
  service_notes text null,
  dietary_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists wedding_space_plan_tables_unique_object_idx
  on public.wedding_space_plan_tables (space_plan_object_id);

create index if not exists wedding_space_plan_tables_shape_idx
  on public.wedding_space_plan_tables (shape);

drop trigger if exists update_wedding_space_plan_tables_updated_at on public.wedding_space_plan_tables;
create trigger update_wedding_space_plan_tables_updated_at
before update on public.wedding_space_plan_tables
for each row execute function public.update_updated_at_column();

create table if not exists public.wedding_space_plan_guest_assignments (
  id uuid primary key default gen_random_uuid(),
  space_plan_table_id uuid not null references public.wedding_space_plan_tables(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  seat_label text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists wedding_space_plan_guest_assignments_unique_guest_per_table_idx
  on public.wedding_space_plan_guest_assignments (space_plan_table_id, guest_id);

create index if not exists wedding_space_plan_guest_assignments_guest_id_idx
  on public.wedding_space_plan_guest_assignments (guest_id);

drop trigger if exists update_wedding_space_plan_guest_assignments_updated_at on public.wedding_space_plan_guest_assignments;
create trigger update_wedding_space_plan_guest_assignments_updated_at
before update on public.wedding_space_plan_guest_assignments
for each row execute function public.update_updated_at_column();

alter table public.wedding_space_plans enable row level security;
alter table public.wedding_space_plan_objects enable row level security;
alter table public.wedding_space_plan_tables enable row level security;
alter table public.wedding_space_plan_guest_assignments enable row level security;

drop policy if exists "Wedding members can view space plans" on public.wedding_space_plans;
create policy "Wedding members can view space plans"
on public.wedding_space_plans
for select
to authenticated
using (
  public.is_wedding_member(wedding_id)
  or public.can_manage_wedding(wedding_id)
);

drop policy if exists "Editors can create space plans" on public.wedding_space_plans;
create policy "Editors can create space plans"
on public.wedding_space_plans
for insert
to authenticated
with check (
  created_by_user_id = auth.uid()
  and public.can_edit_wedding_space_plan(wedding_id)
);

drop policy if exists "Editors can update space plans" on public.wedding_space_plans;
create policy "Editors can update space plans"
on public.wedding_space_plans
for update
to authenticated
using (public.can_edit_wedding_space_plan(wedding_id))
with check (public.can_edit_wedding_space_plan(wedding_id));

drop policy if exists "Editors can delete space plans" on public.wedding_space_plans;
create policy "Editors can delete space plans"
on public.wedding_space_plans
for delete
to authenticated
using (public.can_edit_wedding_space_plan(wedding_id));

drop policy if exists "Wedding members can view space plan objects" on public.wedding_space_plan_objects;
create policy "Wedding members can view space plan objects"
on public.wedding_space_plan_objects
for select
to authenticated
using (
  exists (
    select 1
    from public.wedding_space_plans wsp
    where wsp.id = space_plan_id
      and (public.is_wedding_member(wsp.wedding_id) or public.can_manage_wedding(wsp.wedding_id))
  )
);

drop policy if exists "Editors can manage space plan objects" on public.wedding_space_plan_objects;
create policy "Editors can manage space plan objects"
on public.wedding_space_plan_objects
for all
to authenticated
using (
  exists (
    select 1
    from public.wedding_space_plans wsp
    where wsp.id = space_plan_id
      and public.can_edit_wedding_space_plan(wsp.wedding_id)
  )
)
with check (
  exists (
    select 1
    from public.wedding_space_plans wsp
    where wsp.id = space_plan_id
      and public.can_edit_wedding_space_plan(wsp.wedding_id)
  )
);

drop policy if exists "Wedding members can view space plan tables" on public.wedding_space_plan_tables;
create policy "Wedding members can view space plan tables"
on public.wedding_space_plan_tables
for select
to authenticated
using (
  exists (
    select 1
    from public.wedding_space_plan_objects wspo
    join public.wedding_space_plans wsp
      on wsp.id = wspo.space_plan_id
    where wspo.id = space_plan_object_id
      and (public.is_wedding_member(wsp.wedding_id) or public.can_manage_wedding(wsp.wedding_id))
  )
);

drop policy if exists "Editors can manage space plan tables" on public.wedding_space_plan_tables;
create policy "Editors can manage space plan tables"
on public.wedding_space_plan_tables
for all
to authenticated
using (
  exists (
    select 1
    from public.wedding_space_plan_objects wspo
    join public.wedding_space_plans wsp
      on wsp.id = wspo.space_plan_id
    where wspo.id = space_plan_object_id
      and public.can_edit_wedding_space_plan(wsp.wedding_id)
  )
)
with check (
  exists (
    select 1
    from public.wedding_space_plan_objects wspo
    join public.wedding_space_plans wsp
      on wsp.id = wspo.space_plan_id
    where wspo.id = space_plan_object_id
      and public.can_edit_wedding_space_plan(wsp.wedding_id)
  )
);

drop policy if exists "Wedding members can view space plan guest assignments" on public.wedding_space_plan_guest_assignments;
create policy "Wedding members can view space plan guest assignments"
on public.wedding_space_plan_guest_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.wedding_space_plan_tables wspt
    join public.wedding_space_plan_objects wspo
      on wspo.id = wspt.space_plan_object_id
    join public.wedding_space_plans wsp
      on wsp.id = wspo.space_plan_id
    where wspt.id = space_plan_table_id
      and (public.is_wedding_member(wsp.wedding_id) or public.can_manage_wedding(wsp.wedding_id))
  )
);

drop policy if exists "Editors can manage space plan guest assignments" on public.wedding_space_plan_guest_assignments;
create policy "Editors can manage space plan guest assignments"
on public.wedding_space_plan_guest_assignments
for all
to authenticated
using (
  exists (
    select 1
    from public.wedding_space_plan_tables wspt
    join public.wedding_space_plan_objects wspo
      on wspo.id = wspt.space_plan_object_id
    join public.wedding_space_plans wsp
      on wsp.id = wspo.space_plan_id
    where wspt.id = space_plan_table_id
      and public.can_edit_wedding_space_plan(wsp.wedding_id)
  )
)
with check (
  exists (
    select 1
    from public.wedding_space_plan_tables wspt
    join public.wedding_space_plan_objects wspo
      on wspo.id = wspt.space_plan_object_id
    join public.wedding_space_plans wsp
      on wsp.id = wspo.space_plan_id
    where wspt.id = space_plan_table_id
      and public.can_edit_wedding_space_plan(wsp.wedding_id)
  )
  and exists (
    select 1
    from public.wedding_space_plan_tables wspt
    join public.wedding_space_plan_objects wspo
      on wspo.id = wspt.space_plan_object_id
    join public.wedding_space_plans wsp
      on wsp.id = wspo.space_plan_id
    join public.guests g
      on g.id = guest_id
    where wspt.id = space_plan_table_id
      and g.wedding_id = wsp.wedding_id
  )
);

grant select, insert, update, delete on public.wedding_space_plans to authenticated;
grant select, insert, update, delete on public.wedding_space_plan_objects to authenticated;
grant select, insert, update, delete on public.wedding_space_plan_tables to authenticated;
grant select, insert, update, delete on public.wedding_space_plan_guest_assignments to authenticated;
