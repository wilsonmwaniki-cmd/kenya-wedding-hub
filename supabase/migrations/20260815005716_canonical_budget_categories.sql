begin;

create or replace function public.canonical_budget_category(category_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select case lower(trim(coalesce(category_name, '')))
    when 'accommodation' then 'Wedding Venue'
    when 'wedding licenses' then 'Wedding Licenses'
    when 'marriage license / legal fees' then 'Wedding Licenses'
    when 'church & officiating minister' then 'Church & Officiating Minister'
    when 'officiant / church fees' then 'Church & Officiating Minister'
    when 'marriage preparation' then 'Marriage Preparation'
    when 'pre-marital classes' then 'Marriage Preparation'
    when 'wedding venue' then 'Wedding Venue'
    when 'venue' then 'Wedding Venue'
    when 'ceremony venue' then 'Wedding Venue'
    when 'reception venue' then 'Wedding Venue'
    when 'wedding planner / planning team' then 'Wedding Planner / Planning Team'
    when 'wedding planner' then 'Wedding Planner / Planning Team'
    when 'planning' then 'Wedding Planner / Planning Team'
    when 'caterer' then 'Caterer'
    when 'catering' then 'Caterer'
    when 'cake artist & baker' then 'Cake Artist & Baker'
    when 'cake' then 'Cake Artist & Baker'
    when 'décor, tents, chairs, tables' then 'Décor, Tents, Chairs, Tables'
    when 'decor, tents, chairs, tables' then 'Décor, Tents, Chairs, Tables'
    when 'décor' then 'Décor, Tents, Chairs, Tables'
    when 'decor' then 'Décor, Tents, Chairs, Tables'
    when 'setup & rentals' then 'Décor, Tents, Chairs, Tables'
    when 'flowers' then 'Décor, Tents, Chairs, Tables'
    when 'rings' then 'Rings'
    when 'wedding bands' then 'Rings'
    when 'bridal gown, accessories, preparation' then 'Bridal Gown, Accessories, Preparation'
    when 'bride attire & body prep' then 'Bridal Gown, Accessories, Preparation'
    when 'bridal party' then 'Bridal Gown, Accessories, Preparation'
    when 'attire' then 'Bridal Gown, Accessories, Preparation'
    when 'attire/beauty' then 'Bridal Gown, Accessories, Preparation'
    when 'groom''s attire & accessories, preparation' then 'Groom''s Attire & Accessories, Preparation'
    when 'groom attire & grooming' then 'Groom''s Attire & Accessories, Preparation'
    when 'master of ceremonies' then 'Master of Ceremonies'
    when 'mc' then 'Master of Ceremonies'
    when 'dj (or band) and sound' then 'DJ (or Band) and Sound'
    when 'music / dj / band' then 'DJ (or Band) and Sound'
    when 'music/dj' then 'DJ (or Band) and Sound'
    when 'entertainment' then 'DJ (or Band) and Sound'
    when 'photographer' then 'Photographer'
    when 'photography' then 'Photographer'
    when 'cinematographer' then 'Cinematographer'
    when 'videography' then 'Cinematographer'
    when 'photo shoot venue' then 'Photo Shoot Venue'
    when 'transport' then 'Transport'
    when 'invitations' then 'Invitations'
    when 'stationery' then 'Invitations'
    when 'bride''s make-up artist' then 'Bride''s Make-up Artist'
    when 'make-up artist' then 'Bride''s Make-up Artist'
    when 'beauty' then 'Bride''s Make-up Artist'
    when 'bride''s hair stylist' then 'Bride''s Hair Stylist'
    when 'hair stylist' then 'Bride''s Hair Stylist'
    when 'honeymoon' then 'Honeymoon'
    else null
  end;
$$;

revoke all on function public.canonical_budget_category(text) from public, anon, authenticated;

create temporary table canonical_budget_catalog (
  name text primary key,
  budget_scope text not null,
  suggested_percentage numeric not null,
  sort_order integer not null
) on commit drop;

insert into canonical_budget_catalog (name, budget_scope, suggested_percentage, sort_order)
values
  ('Wedding Licenses', 'wedding', 1, 1),
  ('Church & Officiating Minister', 'wedding', 1, 2),
  ('Marriage Preparation', 'personal', 2, 3),
  ('Wedding Venue', 'wedding', 5, 4),
  ('Wedding Planner / Planning Team', 'wedding', 3, 5),
  ('Caterer', 'wedding', 24, 6),
  ('Cake Artist & Baker', 'wedding', 3, 7),
  ('Décor, Tents, Chairs, Tables', 'wedding', 20, 8),
  ('Rings', 'personal', 4, 9),
  ('Bridal Gown, Accessories, Preparation', 'personal', 5, 10),
  ('Groom''s Attire & Accessories, Preparation', 'personal', 3, 11),
  ('Master of Ceremonies', 'wedding', 3, 12),
  ('DJ (or Band) and Sound', 'wedding', 4, 13),
  ('Photographer', 'wedding', 5, 14),
  ('Cinematographer', 'wedding', 4, 15),
  ('Photo Shoot Venue', 'wedding', 1, 16),
  ('Transport', 'wedding', 2, 17),
  ('Invitations', 'wedding', 2, 18),
  ('Bride''s Make-up Artist', 'personal', 1, 19),
  ('Bride''s Hair Stylist', 'personal', 1, 20),
  ('Honeymoon', 'personal', 6, 21);

create temporary table budget_workspaces on commit drop as
select
  bc.user_id,
  bc.client_id,
  coalesce(
    pc.wedding_id,
    (
      select w.id
      from public.weddings w
      where w.created_by_user_id = bc.user_id
        and w.status = 'active'
        and w.deleted_at is null
      order by w.created_at
      limit 1
    ),
    min(bc.wedding_id::text)::uuid
  ) as wedding_id,
  coalesce(
    nullif(pc.wedding_budget_goal, 0),
    nullif(p.wedding_budget_goal, 0),
    greatest(max(bc.allocated), 0)
  ) as budget_goal
from public.budget_categories bc
left join public.profiles p on p.user_id = bc.user_id
left join public.planner_clients pc on pc.id = bc.client_id
group by bc.user_id, bc.client_id, pc.wedding_id, pc.wedding_budget_goal, p.wedding_budget_goal;

insert into public.budget_categories (
  user_id,
  client_id,
  wedding_id,
  name,
  allocated,
  suggested_allocated,
  suggested_percentage,
  allocation_manually_edited,
  allocation_last_edited_field,
  spent,
  budget_scope,
  visibility
)
select
  workspace.user_id,
  workspace.client_id,
  workspace.wedding_id,
  catalog.name,
  round(workspace.budget_goal * catalog.suggested_percentage / 100),
  round(workspace.budget_goal * catalog.suggested_percentage / 100),
  catalog.suggested_percentage,
  false,
  null,
  0,
  catalog.budget_scope,
  case when catalog.budget_scope = 'personal' then 'private' else 'public' end
from budget_workspaces workspace
cross join canonical_budget_catalog catalog
where not exists (
  select 1
  from public.budget_categories existing
  where existing.user_id = workspace.user_id
    and existing.client_id is not distinct from workspace.client_id
    and public.canonical_budget_category(existing.name) = catalog.name
);

create temporary table budget_category_repair on commit drop as
with candidates as (
  select
    category.id,
    category.user_id,
    category.client_id,
    workspace.wedding_id,
    catalog.name as target_name,
    catalog.budget_scope as target_scope,
    catalog.suggested_percentage,
    workspace.budget_goal,
    category.spent,
    category.created_at,
    count(payment.id) as payment_count
  from public.budget_categories category
  join budget_workspaces workspace
    on workspace.user_id = category.user_id
   and workspace.client_id is not distinct from category.client_id
  join canonical_budget_catalog catalog
    on catalog.name = public.canonical_budget_category(category.name)
  left join public.budget_payments payment on payment.budget_category_id = category.id
  group by
    category.id,
    category.user_id,
    category.client_id,
    workspace.wedding_id,
    catalog.name,
    catalog.budget_scope,
    catalog.suggested_percentage,
    workspace.budget_goal,
    category.spent,
    category.created_at
)
select
  candidates.*,
  first_value(id) over (
    partition by user_id, client_id, target_name
    order by payment_count desc, created_at, id
  ) as keep_id
from candidates;

update public.budget_payments payment
set
  budget_category_id = repair.keep_id,
  category_name = repair.target_name,
  budget_scope = repair.target_scope,
  wedding_id = repair.wedding_id
from budget_category_repair repair
where payment.budget_category_id = repair.id;

delete from public.budget_categories category
where not exists (
  select 1
  from budget_category_repair repair
  where repair.keep_id = category.id
);

with payment_totals as (
  select
    payment.budget_category_id,
    sum(payment.amount) as amount
  from public.budget_payments payment
  group by payment.budget_category_id
),
survivor_values as (
  select
    repair.keep_id,
    max(repair.target_name) as target_name,
    max(repair.target_scope) as target_scope,
    max(repair.wedding_id::text)::uuid as wedding_id,
    max(repair.budget_goal) as budget_goal,
    max(repair.suggested_percentage) as suggested_percentage,
    greatest(
      max(repair.spent),
      coalesce(max(payment_totals.amount), 0)
    ) as protected_spend
  from budget_category_repair repair
  left join payment_totals on payment_totals.budget_category_id = repair.keep_id
  group by repair.keep_id
)
update public.budget_categories category
set
  name = values.target_name,
  wedding_id = values.wedding_id,
  budget_scope = values.target_scope,
  visibility = case when values.target_scope = 'personal' then 'private' else 'public' end,
  allocated = greatest(
    round(values.budget_goal * values.suggested_percentage / 100),
    values.protected_spend
  ),
  suggested_allocated = round(values.budget_goal * values.suggested_percentage / 100),
  suggested_percentage = values.suggested_percentage,
  allocation_manually_edited = false,
  allocation_last_edited_field = null,
  spent = values.protected_spend
from survivor_values values
where category.id = values.keep_id;

with totals as (
  select
    workspace.user_id,
    workspace.client_id,
    workspace.budget_goal,
    sum(category.allocated) as allocated_total
  from budget_workspaces workspace
  join public.budget_categories category
    on category.user_id = workspace.user_id
   and category.client_id is not distinct from workspace.client_id
  group by workspace.user_id, workspace.client_id, workspace.budget_goal
)
update public.budget_categories category
set allocated = greatest(
  0,
  category.allocated + totals.budget_goal - totals.allocated_total
)
from totals
where category.user_id = totals.user_id
  and category.client_id is not distinct from totals.client_id
  and category.name = 'Wedding Planner / Planning Team';

update public.vendors vendor
set category = public.canonical_budget_category(vendor.category)
where public.canonical_budget_category(vendor.category) is not null
  and vendor.category is distinct from public.canonical_budget_category(vendor.category);

create or replace function public.normalize_budget_category_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text;
begin
  normalized_name := public.canonical_budget_category(new.name);

  if normalized_name is null then
    raise exception 'Budget category must use the planning catalog';
  end if;

  new.name := normalized_name;
  new.budget_scope := case
    when normalized_name in (
      'Marriage Preparation',
      'Rings',
      'Bridal Gown, Accessories, Preparation',
      'Groom''s Attire & Accessories, Preparation',
      'Bride''s Make-up Artist',
      'Bride''s Hair Stylist',
      'Honeymoon'
    ) then 'personal'
    else 'wedding'
  end;
  new.visibility := case when new.budget_scope = 'personal' then 'private' else 'public' end;
  return new;
end;
$$;

revoke all on function public.normalize_budget_category_name() from public, anon, authenticated;

drop trigger if exists normalize_budget_category_name_trigger on public.budget_categories;
create trigger normalize_budget_category_name_trigger
before insert or update of name on public.budget_categories
for each row execute function public.normalize_budget_category_name();

alter table public.budget_categories
  drop constraint if exists budget_categories_name_catalog_check,
  add constraint budget_categories_name_catalog_check check (
    name in (
      'Wedding Licenses',
      'Church & Officiating Minister',
      'Marriage Preparation',
      'Wedding Venue',
      'Wedding Planner / Planning Team',
      'Caterer',
      'Cake Artist & Baker',
      'Décor, Tents, Chairs, Tables',
      'Rings',
      'Bridal Gown, Accessories, Preparation',
      'Groom''s Attire & Accessories, Preparation',
      'Master of Ceremonies',
      'DJ (or Band) and Sound',
      'Photographer',
      'Cinematographer',
      'Photo Shoot Venue',
      'Transport',
      'Invitations',
      'Bride''s Make-up Artist',
      'Bride''s Hair Stylist',
      'Honeymoon'
    )
  );

create unique index if not exists budget_categories_workspace_name_uidx
  on public.budget_categories (user_id, coalesce(client_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

commit;
;
