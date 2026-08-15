create index if not exists lead_matches_vendor_listing_id_idx
  on public.lead_matches(vendor_listing_id)
  where vendor_listing_id is not null;

create index if not exists lead_requests_requested_by_user_id_idx
  on public.lead_requests(requested_by_user_id);
