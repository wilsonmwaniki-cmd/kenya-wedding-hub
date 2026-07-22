-- Professional pricing has one free tier and one paid Professional tier.
-- Verification and collaboration are free; paid access covers business operations.
update public.pricing_catalog
set config = jsonb_set(
  jsonb_set(
    jsonb_set(
      config - 'professionalAddons',
      '{professionalPlans}',
      $${
        "planner": {
          "free": {
            "title": "Free",
            "annualPriceKes": null,
            "monthlyPriceKes": null,
            "bundleCode": null,
            "checkoutMonthlyLookupKey": null,
            "checkoutAnnualLookupKey": null
          },
          "premium": {
            "title": "Professional",
            "annualPriceKes": 9000,
            "monthlyPriceKes": 1000,
            "bundleCode": "planner_premium_annual",
            "checkoutMonthlyLookupKey": "planner_premium_monthly",
            "checkoutAnnualLookupKey": "planner_premium_annual"
          }
        },
        "vendor": {
          "free": {
            "title": "Free",
            "annualPriceKes": null,
            "monthlyPriceKes": null,
            "bundleCode": null,
            "checkoutMonthlyLookupKey": null,
            "checkoutAnnualLookupKey": null
          },
          "premium": {
            "title": "Professional",
            "annualPriceKes": 9000,
            "monthlyPriceKes": 1000,
            "bundleCode": "vendor_premium_annual",
            "checkoutMonthlyLookupKey": "vendor_premium_monthly",
            "checkoutAnnualLookupKey": "vendor_premium_annual"
          }
        }
      }$$::jsonb,
      true
    ),
    '{checkout,allowedLookupKeys}',
    '[
      "committee_pass_one_time",
      "couple_collaborative_monthly",
      "couple_collaborative_annual",
      "planner_premium_monthly",
      "planner_premium_annual",
      "vendor_premium_monthly",
      "vendor_premium_annual"
    ]'::jsonb,
    true
  ),
  '{checkout,professionalCheckoutMap}',
  $${
    "planner_premium_monthly": {
      "features": ["booking_management", "invoicing", "contract_management", "media_portfolio"]
    },
    "planner_premium_annual": {
      "features": ["booking_management", "invoicing", "contract_management", "media_portfolio"]
    },
    "vendor_premium_monthly": {
      "features": ["booking_management", "invoicing", "contract_management", "media_portfolio"]
    },
    "vendor_premium_annual": {
      "features": ["booking_management", "invoicing", "contract_management", "media_portfolio"]
    }
  }$$::jsonb,
  true
),
updated_at = now()
where is_active = true;

update public.pricing_catalog
set config = jsonb_set(
  jsonb_set(
    config,
    '{audiencePlans,planner}',
    $${
      "title": "Professional Planners",
      "billingCadence": "monthly_or_annual",
      "displayOneTimePriceKes": null,
      "displayMonthlyPriceKes": 1000,
      "displayAnnualPriceKes": 9000,
      "freeTierName": "Free",
      "paidTierName": "Professional",
      "entitlementCode": "booking_management",
      "billingProductKey": "planner_premium",
      "checkoutMonthlyLookupKey": "planner_premium_monthly",
      "checkoutAnnualLookupKey": "planner_premium_annual",
      "checkoutOneTimeLookupKey": null,
      "successPath": "/pricing?upgrade=success&professionalAudience=planner&professionalPlan=premium",
      "cancelPath": "/pricing?upgrade=cancelled"
    }$$::jsonb,
    true
  ),
  '{audiencePlans,vendor}',
  $${
    "title": "Vendors",
    "billingCadence": "monthly_or_annual",
    "displayOneTimePriceKes": null,
    "displayMonthlyPriceKes": 1000,
    "displayAnnualPriceKes": 9000,
    "freeTierName": "Free",
    "paidTierName": "Professional",
    "entitlementCode": "booking_management",
    "billingProductKey": "vendor_premium",
    "checkoutMonthlyLookupKey": "vendor_premium_monthly",
    "checkoutAnnualLookupKey": "vendor_premium_annual",
    "checkoutOneTimeLookupKey": null,
    "successPath": "/pricing?upgrade=success&professionalAudience=vendor&professionalPlan=premium",
    "cancelPath": "/pricing?upgrade=cancelled"
  }$$::jsonb,
  true
),
updated_at = now()
where is_active = true;

create or replace function public.planner_profile_is_collaboration_ready(target_planner_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = target_planner_user_id
      and p.role = 'planner'::public.app_role
      and p.planner_verified = true
      and coalesce(p.directory_opt_out, false) = false
  );
$$;

create or replace function public.vendor_listing_is_collaboration_ready(target_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vendor_listings vl
    where vl.id = target_listing_id
      and vl.is_approved = true
      and vl.is_verified = true
      and coalesce(vl.directory_opt_out, false) = false
  );
$$;

revoke execute on function public.planner_profile_is_collaboration_ready(uuid) from public;
revoke execute on function public.vendor_listing_is_collaboration_ready(uuid) from public;
grant execute on function public.planner_profile_is_collaboration_ready(uuid) to anon, authenticated;
grant execute on function public.vendor_listing_is_collaboration_ready(uuid) to anon, authenticated;

create or replace function public.request_planner_verification()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.profiles
  set
    planner_verification_requested = true,
    planner_verification_requested_at = now(),
    updated_at = now()
  where user_id = auth.uid()
    and role = 'planner'::public.app_role
    and planner_verified = false;

  if not found then
    raise exception 'Planner profile not found or already verified' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.request_vendor_verification()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.vendor_listings
  set
    verification_requested = true,
    verification_requested_at = now(),
    updated_at = now()
  where user_id = auth.uid()
    and is_approved = true
    and is_verified = false;

  if not found then
    raise exception 'An approved, unverified vendor listing is required' using errcode = 'P0001';
  end if;
end;
$$;

drop view if exists public.public_planner_profiles;
create view public.public_planner_profiles
with (security_invoker = true)
as
select
  id,
  user_id,
  full_name,
  company_name,
  avatar_url,
  bio,
  specialties,
  company_email,
  company_phone,
  company_website,
  primary_county,
  primary_town,
  service_areas,
  travel_scope,
  minimum_budget_kes,
  maximum_budget_kes,
  founding_planner_contributor
from public.profiles
where role = 'planner'::public.app_role
  and planner_verified = true
  and directory_opt_out = false;

grant select on public.public_planner_profiles to anon, authenticated;

drop policy if exists "Couples can insert own requests" on public.planner_link_requests;
create policy "Couples can insert own requests"
on public.planner_link_requests for insert
to authenticated
with check (
  (select auth.uid()) = couple_user_id
  and public.planner_profile_is_collaboration_ready(planner_user_id)
);

drop policy if exists "Planners can view requests to them" on public.planner_link_requests;
create policy "Planners can view requests to them"
on public.planner_link_requests for select
to authenticated
using (
  (select auth.uid()) = planner_user_id
  and public.planner_profile_is_collaboration_ready(planner_user_id)
);

drop policy if exists "Planners can update requests to them" on public.planner_link_requests;
create policy "Planners can update requests to them"
on public.planner_link_requests for update
to authenticated
using (
  (select auth.uid()) = planner_user_id
  and public.planner_profile_is_collaboration_ready(planner_user_id)
)
with check (
  (select auth.uid()) = planner_user_id
  and public.planner_profile_is_collaboration_ready(planner_user_id)
);

drop policy if exists "Requesters can insert own requests" on public.vendor_connection_requests;
create policy "Requesters can insert own requests"
on public.vendor_connection_requests for insert
to authenticated
with check (
  (select auth.uid()) = requester_user_id
  and public.vendor_listing_is_collaboration_ready(vendor_listing_id)
);

drop policy if exists "Vendors can view requests to their listings" on public.vendor_connection_requests;
create policy "Vendors can view requests to their listings"
on public.vendor_connection_requests for select
to authenticated
using (
  exists (
    select 1
    from public.vendor_listings vl
    where vl.id = vendor_listing_id
      and vl.user_id = (select auth.uid())
      and public.vendor_listing_is_collaboration_ready(vl.id)
  )
);

drop policy if exists "Vendors can update requests to their listings" on public.vendor_connection_requests;
create policy "Vendors can update requests to their listings"
on public.vendor_connection_requests for update
to authenticated
using (
  exists (
    select 1
    from public.vendor_listings vl
    where vl.id = vendor_listing_id
      and vl.user_id = (select auth.uid())
      and public.vendor_listing_is_collaboration_ready(vl.id)
  )
)
with check (
  exists (
    select 1
    from public.vendor_listings vl
    where vl.id = vendor_listing_id
      and vl.user_id = (select auth.uid())
      and public.vendor_listing_is_collaboration_ready(vl.id)
  )
);
