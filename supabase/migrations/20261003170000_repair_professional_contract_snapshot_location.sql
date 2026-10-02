create or replace function public.build_professional_contract_snapshot(_contract_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _contract public.professional_contracts%rowtype;
  _profile public.profiles%rowtype;
  _listing_name text;
  _listing_email text;
  _listing_phone text;
  _listing_website text;
  _listing_county text;
  _listing_town text;
begin
  select * into _contract
  from public.professional_contracts
  where id = _contract_id;

  if not found then
    raise exception 'Contract not found.';
  end if;

  select * into _profile
  from public.profiles
  where user_id = _contract.user_id;

  if _contract.vendor_listing_id is not null then
    select business_name, email, phone, website, location_county, location_town
    into _listing_name, _listing_email, _listing_phone, _listing_website, _listing_county, _listing_town
    from public.vendor_listings
    where id = _contract.vendor_listing_id;
  end if;

  return jsonb_build_object(
    'id', _contract.id,
    'role', _contract.role,
    'title', _contract.title,
    'recipientName', _contract.recipient_name,
    'recipientEmail', _contract.recipient_email,
    'recipientPhone', _contract.recipient_phone,
    'weddingName', _contract.wedding_name,
    'eventDate', _contract.event_date,
    'summary', _contract.summary,
    'terms', _contract.terms,
    'issuerName', coalesce(_listing_name, _profile.company_name, _profile.full_name, 'Zania issuer'),
    'issuerEmail', coalesce(_listing_email, _profile.company_email),
    'issuerPhone', coalesce(_listing_phone, _profile.company_phone),
    'issuerWebsite', coalesce(_listing_website, _profile.company_website),
    'issuerLocation', nullif(trim(both ', ' from concat_ws(', ', _listing_town, _listing_county, _profile.primary_town, _profile.primary_county)), ''),
    'contentVersion', _contract.content_version
  );
end;
$$;

notify pgrst, 'reload schema';
