create table if not exists public.wedding_registry_items (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  created_by_user_id uuid null references auth.users(id) on delete set null default auth.uid(),
  title text not null,
  description text null,
  category text null,
  estimated_price_kes numeric(12, 2) null,
  purchase_url text null,
  is_purchased boolean not null default false,
  purchased_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wedding_registry_items_title_not_blank check (char_length(trim(title)) > 0),
  constraint wedding_registry_items_estimated_price_non_negative check (
    estimated_price_kes is null or estimated_price_kes >= 0
  )
);

create index if not exists wedding_registry_items_wedding_id_idx
  on public.wedding_registry_items (wedding_id);

create index if not exists wedding_registry_items_wedding_purchase_status_idx
  on public.wedding_registry_items (wedding_id, is_purchased, created_at desc);

drop trigger if exists update_wedding_registry_items_updated_at on public.wedding_registry_items;
create trigger update_wedding_registry_items_updated_at
before update on public.wedding_registry_items
for each row execute function public.update_updated_at_column();

alter table public.wedding_registry_items enable row level security;

drop policy if exists "Members can view wedding registry items" on public.wedding_registry_items;
create policy "Members can view wedding registry items"
on public.wedding_registry_items for select
using (
  public.is_wedding_member(wedding_id)
  or public.can_manage_wedding(wedding_id)
  or public.can_manage_wedding_memberships(wedding_id)
);

drop policy if exists "Members can insert wedding registry items" on public.wedding_registry_items;
create policy "Members can insert wedding registry items"
on public.wedding_registry_items for insert
to authenticated
with check (
  public.is_wedding_member(wedding_id)
  or public.can_manage_wedding(wedding_id)
  or public.can_manage_wedding_memberships(wedding_id)
);

drop policy if exists "Members can update wedding registry items" on public.wedding_registry_items;
create policy "Members can update wedding registry items"
on public.wedding_registry_items for update
to authenticated
using (
  public.is_wedding_member(wedding_id)
  or public.can_manage_wedding(wedding_id)
  or public.can_manage_wedding_memberships(wedding_id)
)
with check (
  public.is_wedding_member(wedding_id)
  or public.can_manage_wedding(wedding_id)
  or public.can_manage_wedding_memberships(wedding_id)
);

drop policy if exists "Members can delete wedding registry items" on public.wedding_registry_items;
create policy "Members can delete wedding registry items"
on public.wedding_registry_items for delete
to authenticated
using (
  public.is_wedding_member(wedding_id)
  or public.can_manage_wedding(wedding_id)
  or public.can_manage_wedding_memberships(wedding_id)
);
