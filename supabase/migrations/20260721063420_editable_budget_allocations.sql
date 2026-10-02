alter table public.profiles
  add column if not exists wedding_budget_goal numeric null
  check (wedding_budget_goal is null or wedding_budget_goal >= 0);

alter table public.planner_clients
  add column if not exists wedding_budget_goal numeric null
  check (wedding_budget_goal is null or wedding_budget_goal >= 0);

alter table public.budget_categories
  add column if not exists suggested_allocated numeric null,
  add column if not exists suggested_percentage numeric null,
  add column if not exists allocation_manually_edited boolean not null default false,
  add column if not exists allocation_last_edited_field text null;

alter table public.budget_categories
  drop constraint if exists budget_categories_suggested_allocated_nonnegative,
  add constraint budget_categories_suggested_allocated_nonnegative
    check (suggested_allocated is null or suggested_allocated >= 0),
  drop constraint if exists budget_categories_suggested_percentage_nonnegative,
  add constraint budget_categories_suggested_percentage_nonnegative
    check (suggested_percentage is null or suggested_percentage >= 0),
  drop constraint if exists budget_categories_allocation_last_edited_field_check,
  add constraint budget_categories_allocation_last_edited_field_check
    check (allocation_last_edited_field is null or allocation_last_edited_field in ('amount', 'percentage'));

update public.budget_categories
set suggested_allocated = allocated
where suggested_allocated is null;

update public.profiles as profile
set wedding_budget_goal = totals.total_allocated
from (
  select user_id, sum(allocated) as total_allocated
  from public.budget_categories
  where coalesce(budget_scope, 'wedding') = 'wedding'
    and client_id is null
  group by user_id
) as totals
where profile.user_id = totals.user_id
  and profile.wedding_budget_goal is null;

update public.planner_clients as client
set wedding_budget_goal = totals.total_allocated
from (
  select client_id, sum(allocated) as total_allocated
  from public.budget_categories
  where coalesce(budget_scope, 'wedding') = 'wedding'
    and client_id is not null
  group by client_id
) as totals
where client.id = totals.client_id
  and client.wedding_budget_goal is null;

update public.budget_categories as category
set suggested_percentage = case
  when client.wedding_budget_goal > 0
    then (category.suggested_allocated / client.wedding_budget_goal) * 100
  else 0
end
from public.planner_clients as client
where category.client_id = client.id
  and coalesce(category.budget_scope, 'wedding') = 'wedding'
  and category.suggested_percentage is null;

update public.budget_categories as category
set suggested_percentage = case
  when profile.wedding_budget_goal > 0
    then (category.suggested_allocated / profile.wedding_budget_goal) * 100
  else 0
end
from public.profiles as profile
where category.client_id is null
  and category.user_id = profile.user_id
  and coalesce(category.budget_scope, 'wedding') = 'wedding'
  and category.suggested_percentage is null;
