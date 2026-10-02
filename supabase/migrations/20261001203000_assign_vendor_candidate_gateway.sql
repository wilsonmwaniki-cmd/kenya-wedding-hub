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
    'assign_vendor_candidate'
  ));
