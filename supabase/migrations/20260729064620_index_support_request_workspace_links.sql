create index if not exists support_requests_wedding_id_idx
  on public.support_requests (wedding_id)
  where wedding_id is not null;

create index if not exists support_requests_planner_client_id_idx
  on public.support_requests (planner_client_id)
  where planner_client_id is not null;
