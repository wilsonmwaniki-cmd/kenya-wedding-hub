-- Consolidate legacy directory rows onto the single active professional listing
-- when the normalized business name has exactly one eligible recipient.
with canonical_matches as (
  select
    orphan.id as orphan_listing_id,
    min(linked.id::text)::uuid as canonical_listing_id
  from public.vendor_listings orphan
  join public.vendor_listings linked
    on linked.id <> orphan.id
   and linked.user_id is not null
   and linked.is_approved = true
   and lower(regexp_replace(btrim(linked.business_name), '[^[:alnum:]]+', '', 'g'))
       = lower(regexp_replace(btrim(orphan.business_name), '[^[:alnum:]]+', '', 'g'))
  where orphan.user_id is null
    and orphan.is_approved = true
  group by orphan.id
  having count(*) = 1
)
update public.vendors vendor
set vendor_listing_id = match.canonical_listing_id
from canonical_matches match
where vendor.vendor_listing_id = match.orphan_listing_id;

with canonical_matches as (
  select orphan.id as orphan_listing_id
  from public.vendor_listings orphan
  join public.vendor_listings linked
    on linked.id <> orphan.id
   and linked.user_id is not null
   and linked.is_approved = true
   and lower(regexp_replace(btrim(linked.business_name), '[^[:alnum:]]+', '', 'g'))
       = lower(regexp_replace(btrim(orphan.business_name), '[^[:alnum:]]+', '', 'g'))
  where orphan.user_id is null
    and orphan.is_approved = true
  group by orphan.id
  having count(*) = 1
)
update public.vendor_listings orphan
set is_approved = false,
    updated_at = now()
from canonical_matches match
where orphan.id = match.orphan_listing_id;

create or replace function public.request_vendor_quote(
  target_vendor_id uuid,
  request_message text default null,
  request_budget_amount numeric default null
)
returns public.document_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_user_id uuid := auth.uid();
  target_vendor public.vendors%rowtype;
  target_listing public.vendor_listings%rowtype;
  target_wedding public.weddings%rowtype;
  requester_profile public.profiles%rowtype;
  requester_email text;
  requester_display_name text;
  existing_request public.document_requests%rowtype;
  created_request public.document_requests%rowtype;
  resolved_wedding_id uuid;
  eligible_listing_count integer := 0;
begin
  if acting_user_id is null then
    raise exception 'Sign in before requesting a quote';
  end if;

  select * into target_vendor
  from public.vendors
  where id = target_vendor_id;

  if target_vendor.id is null then
    raise exception 'Vendor not found';
  end if;

  resolved_wedding_id := public.resolve_vendor_workspace_wedding_id(target_vendor.id);

  if resolved_wedding_id is null or not public.is_wedding_member(resolved_wedding_id) then
    raise exception 'You do not have access to this wedding vendor';
  end if;

  if target_vendor.vendor_listing_id is null then
    raise exception 'This vendor has not connected a professional account yet';
  end if;

  select * into target_listing
  from public.vendor_listings
  where id = target_vendor.vendor_listing_id;

  if target_listing.id is null then
    raise exception 'The vendor listing is unavailable';
  end if;

  if target_listing.user_id is null then
    select count(*) into eligible_listing_count
    from public.vendor_listings candidate
    where candidate.user_id is not null
      and candidate.is_approved = true
      and lower(regexp_replace(btrim(candidate.business_name), '[^[:alnum:]]+', '', 'g'))
          = lower(regexp_replace(btrim(target_listing.business_name), '[^[:alnum:]]+', '', 'g'));

    if eligible_listing_count = 1 then
      select * into target_listing
      from public.vendor_listings candidate
      where candidate.user_id is not null
        and candidate.is_approved = true
        and lower(regexp_replace(btrim(candidate.business_name), '[^[:alnum:]]+', '', 'g'))
            = lower(regexp_replace(btrim(target_listing.business_name), '[^[:alnum:]]+', '', 'g'))
      limit 1;
    end if;
  end if;

  if target_listing.user_id is null then
    raise exception 'This vendor has not connected a receiving account yet. Choose the connected listing or invite the vendor.';
  end if;

  if target_listing.user_id = acting_user_id then
    raise exception 'You cannot request a quote from your own account';
  end if;

  select * into target_wedding from public.weddings where id = resolved_wedding_id;
  select * into requester_profile from public.profiles where user_id = acting_user_id;
  select email::text into requester_email from auth.users where id = acting_user_id;

  requester_display_name := coalesce(
    nullif(btrim(target_wedding.name), ''),
    nullif(btrim(requester_profile.full_name), ''),
    'A Zania client'
  );

  select * into existing_request
  from public.document_requests
  where requester_user_id = acting_user_id
    and recipient_user_id = target_listing.user_id
    and vendor_id = target_vendor.id
    and request_type = 'quote'
    and status in ('new', 'viewed', 'changes_requested')
  order by created_at desc
  limit 1;

  if existing_request.id is not null then
    return existing_request;
  end if;

  insert into public.document_requests (
    requester_user_id,
    recipient_user_id,
    requester_role,
    recipient_role,
    request_type,
    wedding_id,
    client_id,
    vendor_id,
    vendor_listing_id,
    title,
    service_category,
    message,
    requester_name,
    requester_email,
    requester_phone,
    recipient_name,
    wedding_name,
    event_date,
    budget_amount,
    due_at,
    metadata
  )
  values (
    acting_user_id,
    target_listing.user_id,
    coalesce(requester_profile.role::text, 'couple'),
    'vendor',
    'quote',
    resolved_wedding_id,
    target_vendor.client_id,
    target_vendor.id,
    target_listing.id,
    'Quote for ' || coalesce(nullif(btrim(target_vendor.category), ''), target_listing.category, 'wedding service'),
    coalesce(nullif(btrim(target_vendor.category), ''), target_listing.category),
    nullif(btrim(request_message), ''),
    requester_display_name,
    nullif(btrim(requester_email), ''),
    nullif(btrim(requester_profile.company_phone), ''),
    target_listing.business_name,
    target_wedding.name,
    target_wedding.wedding_date,
    request_budget_amount,
    now() + interval '3 days',
    jsonb_build_object('source', 'wedding_vendor_workspace')
  )
  returning * into created_request;

  return created_request;
end;
$$;

revoke all on function public.request_vendor_quote(uuid, text, numeric) from public, anon;
grant execute on function public.request_vendor_quote(uuid, text, numeric) to authenticated;
