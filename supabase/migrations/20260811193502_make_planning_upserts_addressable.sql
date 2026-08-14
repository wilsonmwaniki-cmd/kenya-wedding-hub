drop index if exists public.budget_categories_wedding_name_unique;

create unique index budget_categories_wedding_name_unique
on public.budget_categories (wedding_id, name);

drop index if exists public.tasks_wedding_template_unique;

create unique index tasks_wedding_template_unique
on public.tasks (wedding_id, template_source, template_key)
where template_source = 'planning_experiment_v1';
