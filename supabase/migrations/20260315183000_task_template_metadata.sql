alter table public.tasks
add column if not exists phase text;

alter table public.tasks
add column if not exists visibility text not null default 'public';

alter table public.tasks
add column if not exists delegatable boolean not null default false;

alter table public.tasks
add column if not exists recommended_role text;

alter table public.tasks
add column if not exists priority_level integer;

alter table public.tasks
add column if not exists template_source text;

alter table public.tasks
drop constraint if exists tasks_phase_check;

alter table public.tasks
add constraint tasks_phase_check
check (
  phase is null
  or phase in (
    'foundation',
    'research',
    'selection_booking',
    'second_payment',
    'closure_final_payment'
  )
);

alter table public.tasks
drop constraint if exists tasks_visibility_check;

alter table public.tasks
add constraint tasks_visibility_check
check (visibility in ('private', 'public'));

alter table public.tasks
drop constraint if exists tasks_priority_level_check;

alter table public.tasks
add constraint tasks_priority_level_check
check (priority_level is null or priority_level between 1 and 4);

create index if not exists tasks_phase_idx on public.tasks (phase);
create index if not exists tasks_visibility_idx on public.tasks (visibility);
create index if not exists tasks_template_source_idx on public.tasks (template_source);
