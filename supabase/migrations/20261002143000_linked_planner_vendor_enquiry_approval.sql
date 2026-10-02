alter table public.planner_change_requests
  drop constraint if exists planner_change_requests_target_table_check;

alter table public.planner_change_requests
  add constraint planner_change_requests_target_table_check
  check (target_table in (
    'guests',
    'wedding_contributions',
    'contribution_rounds',
    'budget_categories',
    'budget_payments',
    'tasks',
    'vendors',
    'timelines',
    'timeline_events',
    'vendor_enquiries'
  ));

alter table public.vendor_enquiries
  add column if not exists planner_change_request_id uuid
    references public.planner_change_requests(id) on delete set null,
  add column if not exists initiated_by_user_id uuid
    references auth.users(id) on delete set null,
  add column if not exists approved_by_user_id uuid
    references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz null;

create unique index if not exists vendor_enquiries_planner_change_request_unique
  on public.vendor_enquiries (planner_change_request_id)
  where planner_change_request_id is not null;

drop policy if exists "Enquiry senders can view their enquiries" on public.vendor_enquiries;
create policy "Enquiry participants can view their enquiries"
on public.vendor_enquiries for select to authenticated
using (
  owner_user_id = auth.uid()
  or initiated_by_user_id = auth.uid()
  or approved_by_user_id = auth.uid()
  or exists (
    select 1 from public.planner_clients pc
    where pc.id = planner_client_id
      and pc.linked_user_id = auth.uid()
  )
);

comment on column public.vendor_enquiries.planner_change_request_id is
  'Linked planner request whose couple approval authorized this external enquiry.';
