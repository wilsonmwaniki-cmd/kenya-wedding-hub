create table if not exists public.professional_exchange_questions (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null references auth.users(id) on delete cascade,
  author_role public.app_role not null,
  author_vendor_listing_id uuid null references public.vendor_listings(id) on delete set null,
  title text not null,
  body text not null,
  category text not null,
  urgency text not null default 'planning',
  location_county text null,
  is_resolved boolean not null default false,
  best_answer_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_exchange_questions_author_role_check
    check (author_role in ('planner', 'vendor', 'admin')),
  constraint professional_exchange_questions_category_check
    check (category in ('sourcing', 'decor', 'venue_logistics', 'power_av', 'catering', 'transport', 'staffing', 'pricing', 'workflow', 'emergency')),
  constraint professional_exchange_questions_urgency_check
    check (urgency in ('planning', 'this_week', 'event_day')),
  constraint professional_exchange_questions_vendor_link_check
    check (
      (author_role = 'vendor'::public.app_role and author_vendor_listing_id is not null)
      or (author_role <> 'vendor'::public.app_role and author_vendor_listing_id is null)
    )
);

create table if not exists public.professional_exchange_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.professional_exchange_questions(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  author_role public.app_role not null,
  author_vendor_listing_id uuid null references public.vendor_listings(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_exchange_answers_author_role_check
    check (author_role in ('planner', 'vendor', 'admin')),
  constraint professional_exchange_answers_vendor_link_check
    check (
      (author_role = 'vendor'::public.app_role and author_vendor_listing_id is not null)
      or (author_role <> 'vendor'::public.app_role and author_vendor_listing_id is null)
    )
);

alter table public.professional_exchange_questions
  add constraint professional_exchange_questions_best_answer_fk
  foreign key (best_answer_id)
  references public.professional_exchange_answers(id)
  on delete set null;

create index if not exists professional_exchange_questions_created_idx
  on public.professional_exchange_questions (created_at desc);

create index if not exists professional_exchange_questions_status_idx
  on public.professional_exchange_questions (is_resolved, urgency, created_at desc);

create index if not exists professional_exchange_questions_category_idx
  on public.professional_exchange_questions (category, created_at desc);

create index if not exists professional_exchange_questions_county_idx
  on public.professional_exchange_questions (location_county, created_at desc)
  where location_county is not null;

create index if not exists professional_exchange_answers_question_idx
  on public.professional_exchange_answers (question_id, created_at asc);

alter table public.professional_exchange_questions enable row level security;
alter table public.professional_exchange_answers enable row level security;

drop policy if exists "Authenticated professionals can view exchange questions" on public.professional_exchange_questions;
create policy "Authenticated professionals can view exchange questions"
on public.professional_exchange_questions
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role in ('planner'::public.app_role, 'vendor'::public.app_role, 'admin'::public.app_role)
  )
);

drop policy if exists "Authenticated professionals can create exchange questions" on public.professional_exchange_questions;
create policy "Authenticated professionals can create exchange questions"
on public.professional_exchange_questions
for insert
to authenticated
with check (
  author_user_id = auth.uid()
  and author_role in ('planner'::public.app_role, 'vendor'::public.app_role, 'admin'::public.app_role)
  and (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role = author_role
    )
    or exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'admin'::public.app_role
    )
  )
  and (
    author_role <> 'vendor'::public.app_role
    or exists (
      select 1
      from public.vendor_listings vl
      where vl.id = author_vendor_listing_id
        and vl.user_id = auth.uid()
    )
  )
);

drop policy if exists "Question authors can update exchange questions" on public.professional_exchange_questions;
create policy "Question authors can update exchange questions"
on public.professional_exchange_questions
for update
to authenticated
using (
  author_user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'::public.app_role
  )
)
with check (
  author_user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'::public.app_role
  )
);

drop policy if exists "Authenticated professionals can view exchange answers" on public.professional_exchange_answers;
create policy "Authenticated professionals can view exchange answers"
on public.professional_exchange_answers
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role in ('planner'::public.app_role, 'vendor'::public.app_role, 'admin'::public.app_role)
  )
);

drop policy if exists "Authenticated professionals can create exchange answers" on public.professional_exchange_answers;
create policy "Authenticated professionals can create exchange answers"
on public.professional_exchange_answers
for insert
to authenticated
with check (
  author_user_id = auth.uid()
  and author_role in ('planner'::public.app_role, 'vendor'::public.app_role, 'admin'::public.app_role)
  and exists (
    select 1
    from public.professional_exchange_questions q
    where q.id = question_id
  )
  and (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role = author_role
    )
    or exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'admin'::public.app_role
    )
  )
  and (
    author_role <> 'vendor'::public.app_role
    or exists (
      select 1
      from public.vendor_listings vl
      where vl.id = author_vendor_listing_id
        and vl.user_id = auth.uid()
    )
  )
);

drop policy if exists "Answer authors can update exchange answers" on public.professional_exchange_answers;
create policy "Answer authors can update exchange answers"
on public.professional_exchange_answers
for update
to authenticated
using (
  author_user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'::public.app_role
  )
)
with check (
  author_user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'::public.app_role
  )
);

grant select, insert, update on public.professional_exchange_questions to authenticated;
grant select, insert, update on public.professional_exchange_answers to authenticated;

drop trigger if exists update_professional_exchange_questions_updated_at on public.professional_exchange_questions;
create trigger update_professional_exchange_questions_updated_at
before update on public.professional_exchange_questions
for each row execute function public.update_updated_at_column();

drop trigger if exists update_professional_exchange_answers_updated_at on public.professional_exchange_answers;
create trigger update_professional_exchange_answers_updated_at
before update on public.professional_exchange_answers
for each row execute function public.update_updated_at_column();
