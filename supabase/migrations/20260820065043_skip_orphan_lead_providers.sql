-- A provider match must point to an account that can receive and answer the lead.
-- Historical curated/test listings could retain a user_id after that auth account
-- was removed, causing the whole matching transaction to fail its auth.users FK.
update public.vendor_listings listing
set user_id = null,
    subscription_status = 'inactive',
    is_verified = false
where listing.user_id is not null
  and not exists (
    select 1
    from auth.users account
    where account.id = listing.user_id
  );

alter table public.vendor_listings
  add constraint vendor_listings_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete set null;
;
