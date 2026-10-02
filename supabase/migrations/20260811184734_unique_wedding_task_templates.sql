create unique index tasks_wedding_template_unique
on public.tasks (wedding_id, template_source, template_key)
where template_source = 'planning_experiment_v1';
