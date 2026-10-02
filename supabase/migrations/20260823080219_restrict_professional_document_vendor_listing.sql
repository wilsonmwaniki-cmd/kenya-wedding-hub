create or replace function public.validate_professional_document_vendor_listing()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.vendor_listing_id is null then
    return new;
  end if;

  if new.role <> 'vendor'
    or not exists (
      select 1
      from public.vendor_listings as listing
      where listing.id = new.vendor_listing_id
        and listing.user_id = new.user_id
    )
  then
    raise exception 'Vendor listing must belong to the document owner'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_professional_document_vendor_listing() from public;

drop trigger if exists validate_commercial_document_vendor_listing
  on public.commercial_documents;

create trigger validate_commercial_document_vendor_listing
before insert or update of user_id, role, vendor_listing_id
on public.commercial_documents
for each row
execute function public.validate_professional_document_vendor_listing();

drop trigger if exists validate_professional_contract_vendor_listing
  on public.professional_contracts;

create trigger validate_professional_contract_vendor_listing
before insert or update of user_id, role, vendor_listing_id
on public.professional_contracts
for each row
execute function public.validate_professional_document_vendor_listing();
