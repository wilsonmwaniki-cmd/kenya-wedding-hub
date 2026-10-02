-- Vendor categories now come from the shared catalog. Older estimator handoffs
-- created empty vendor rows solely to make those categories visible.
delete from public.vendors as vendor
where coalesce(vendor.notes, '') like 'Seeded from the cost estimator.%'
  and coalesce(vendor.phone, '') = ''
  and coalesce(vendor.email, '') = ''
  and coalesce(vendor.price, 0) = 0
  and vendor.vendor_listing_id is null
  and not exists (
    select 1 from public.budget_payments as payment where payment.vendor_id = vendor.id
  )
  and not exists (
    select 1 from public.commercial_documents as document where document.vendor_id = vendor.id
  )
  and not exists (
    select 1 from public.document_requests as request where request.vendor_id = vendor.id
  )
  and not exists (
    select 1 from public.professional_contracts as contract where contract.vendor_id = vendor.id
  )
  and not exists (
    select 1 from public.tasks as task where task.source_vendor_id = vendor.id
  )
  and not exists (
    select 1 from public.vendor_follow_up_reminders as reminder where reminder.vendor_id = vendor.id
  )
  and not exists (
    select 1 from public.vendor_price_observations as observation where observation.source_vendor_id = vendor.id
  )
  and not exists (
    select 1 from public.vendor_reputation_reviews as review where review.source_vendor_id = vendor.id
  )
  and not exists (
    select 1 from public.workspace_vendor_invites as invite where invite.vendor_id = vendor.id
  )
  and not exists (
    select 1 from public.workspace_vendor_task_suggestions as suggestion where suggestion.vendor_id = vendor.id
  )
  and not exists (
    select 1 from public.workspace_vendor_updates as update_event where update_event.vendor_id = vendor.id
  );
