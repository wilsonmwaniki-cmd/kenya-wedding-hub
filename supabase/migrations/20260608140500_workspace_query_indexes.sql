-- Align index coverage with the legacy/shared workspace read paths that still use
-- user_id OR client_id filters across the main planning surfaces.

create index if not exists planner_clients_planner_user_created_idx
  on public.planner_clients (planner_user_id, created_at desc);

create index if not exists planner_clients_linked_user_idx
  on public.planner_clients (linked_user_id)
  where linked_user_id is not null;

create index if not exists tasks_user_due_date_idx
  on public.tasks (user_id, due_date asc);

create index if not exists tasks_client_due_date_idx
  on public.tasks (client_id, due_date asc)
  where client_id is not null;

create index if not exists tasks_user_source_vendor_due_date_idx
  on public.tasks (user_id, source_vendor_id, due_date asc)
  where source_vendor_id is not null;

create index if not exists tasks_client_source_vendor_due_date_idx
  on public.tasks (client_id, source_vendor_id, due_date asc)
  where client_id is not null and source_vendor_id is not null;

create index if not exists budget_categories_user_created_at_idx
  on public.budget_categories (user_id, created_at desc);

create index if not exists budget_categories_client_created_at_idx
  on public.budget_categories (client_id, created_at desc)
  where client_id is not null;

create index if not exists budget_categories_user_scope_name_idx
  on public.budget_categories (user_id, budget_scope, name);

create index if not exists budget_categories_client_scope_name_idx
  on public.budget_categories (client_id, budget_scope, name)
  where client_id is not null;

create index if not exists guests_user_name_idx
  on public.guests (user_id, name);

create index if not exists guests_client_name_idx
  on public.guests (client_id, name)
  where client_id is not null;

create index if not exists vendors_user_created_at_idx
  on public.vendors (user_id, created_at desc);

create index if not exists vendors_client_created_at_idx
  on public.vendors (client_id, created_at desc)
  where client_id is not null;

create index if not exists vendors_user_category_status_idx
  on public.vendors (user_id, category, selection_status);

create index if not exists vendors_client_category_status_idx
  on public.vendors (client_id, category, selection_status)
  where client_id is not null;

create index if not exists vendors_user_payment_due_date_idx
  on public.vendors (user_id, payment_due_date asc)
  where payment_due_date is not null;

create index if not exists vendors_client_payment_due_date_idx
  on public.vendors (client_id, payment_due_date asc)
  where client_id is not null and payment_due_date is not null;

create index if not exists vendor_listings_user_id_idx
  on public.vendor_listings (user_id)
  where user_id is not null;

create index if not exists vendor_listings_public_directory_idx
  on public.vendor_listings (featured_rank desc, is_verified desc, category, business_name)
  where is_approved = true and directory_opt_out = false;
