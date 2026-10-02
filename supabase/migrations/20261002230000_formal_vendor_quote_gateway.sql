alter table public.intelligence_gateway_confirmations
  drop constraint if exists intelligence_gateway_confirmations_capability_check;

alter table public.intelligence_gateway_confirmations
  add constraint intelligence_gateway_confirmations_capability_check
  check (capability in (
    'create_task',
    'update_task',
    'add_guest',
    'record_expense',
    'create_vendor_follow_up_reminder',
    'record_payment',
    'save_vendor_candidate',
    'assign_vendor_candidate',
    'promote_vendor_candidate',
    'send_vendor_enquiry',
    'apply_vendor_response',
    'request_formal_vendor_quote'
  ));

comment on constraint intelligence_gateway_confirmations_capability_check
  on public.intelligence_gateway_confirmations is
  'Allowlisted conversational write capabilities. Formal quote requests use the existing authenticated document request workflow and never promote indicative response amounts.';

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
    'vendor_enquiries',
    'document_requests'
  ));
