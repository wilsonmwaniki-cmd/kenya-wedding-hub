-- Preserve paid access for professionals whose subscriptions predate the
-- professional_entitlements ledger. Paystack-created rows always win because
-- this backfill never overwrites an existing user/audience/feature record.
with professional_features(feature_key) as (
  values
    ('booking_management'::text),
    ('invoicing'::text),
    ('contract_management'::text),
    ('media_portfolio'::text)
), active_vendor_subscriptions as (
  select distinct
    vl.user_id,
    coalesce(vl.subscription_started_at, vl.created_at, now()) as effective_from,
    vl.subscription_expires_at as effective_to
  from public.vendor_listings vl
  where vl.subscription_status = 'active'
    and (vl.subscription_expires_at is null or vl.subscription_expires_at > now())
    and exists (
      select 1
      from auth.users auth_user
      where auth_user.id = vl.user_id
    )
)
insert into public.professional_entitlements (
  user_id,
  audience,
  feature_key,
  status,
  source_lookup_key,
  source_bundle_code,
  effective_from,
  effective_to,
  metadata
)
select
  subscription.user_id,
  'vendor',
  feature.feature_key,
  'active',
  'legacy_vendor_active_subscription',
  'vendor_premium_legacy',
  subscription.effective_from,
  subscription.effective_to,
  jsonb_build_object('source', 'legacy_subscription_backfill')
from active_vendor_subscriptions subscription
cross join professional_features feature
on conflict (user_id, audience, feature_key) do nothing;

with professional_features(feature_key) as (
  values
    ('booking_management'::text),
    ('invoicing'::text),
    ('contract_management'::text),
    ('media_portfolio'::text)
), active_planner_subscriptions as (
  select
    p.user_id,
    coalesce(p.planner_subscription_started_at, p.created_at, now()) as effective_from,
    p.planner_subscription_expires_at as effective_to
  from public.profiles p
  where p.role = 'planner'::public.app_role
    and coalesce(p.planner_type, 'professional') <> 'committee'
    and p.planner_subscription_status = 'active'
    and (p.planner_subscription_expires_at is null or p.planner_subscription_expires_at > now())
    and exists (
      select 1
      from auth.users auth_user
      where auth_user.id = p.user_id
    )
)
insert into public.professional_entitlements (
  user_id,
  audience,
  feature_key,
  status,
  source_lookup_key,
  source_bundle_code,
  effective_from,
  effective_to,
  metadata
)
select
  subscription.user_id,
  'planner',
  feature.feature_key,
  'active',
  'legacy_planner_active_subscription',
  'planner_premium_legacy',
  subscription.effective_from,
  subscription.effective_to,
  jsonb_build_object('source', 'legacy_subscription_backfill')
from active_planner_subscriptions subscription
cross join professional_features feature
on conflict (user_id, audience, feature_key) do nothing;
