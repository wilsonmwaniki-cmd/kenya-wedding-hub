import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import type { CoupleCheckoutMapping, ProfessionalCheckoutMapping } from './pricingCatalog.ts';

type PaymentTransaction = {
  id: string;
  user_id: string;
  wedding_id: string | null;
  audience: string;
  lookup_key: string;
  merchant_reference: string;
};

type ServiceClient = SupabaseClient;

function calculateAccessExpiry(paidAt: string, billingCycle: 'monthly' | 'annual' | 'one_time') {
  if (billingCycle === 'one_time') return null;

  const expiry = new Date(paidAt);
  if (Number.isNaN(expiry.getTime())) throw new Error('The payment completion time is invalid.');

  if (billingCycle === 'monthly') expiry.setUTCMonth(expiry.getUTCMonth() + 1);
  if (billingCycle === 'annual') expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
  return expiry.toISOString();
}

export async function activateCoupleCheckout(
  serviceClient: ServiceClient,
  transaction: PaymentTransaction,
  mapping: CoupleCheckoutMapping,
  payment: { provider: string; reference: string; paidAt: string },
) {
  if (!transaction.wedding_id) throw new Error('This payment is missing a wedding workspace reference.');

  const { data: membership, error: membershipError } = await serviceClient
    .from('wedding_memberships')
    .select('role, is_owner, membership_status')
    .eq('wedding_id', transaction.wedding_id)
    .eq('user_id', transaction.user_id)
    .eq('membership_status', 'active')
    .maybeSingle();
  const canManage = membership?.is_owner === true || ['wedding_owner', 'bride', 'groom'].includes(membership?.role ?? '');
  if (membershipError || !membership || !canManage) {
    throw new Error('Only an active wedding owner can activate this purchase.');
  }

  const billingCycle = transaction.lookup_key.endsWith('_monthly')
    ? 'monthly'
    : transaction.lookup_key.endsWith('_annual')
      ? 'annual'
      : 'one_time';
  const accessExpiresAt = calculateAccessExpiry(payment.paidAt, billingCycle);
  const { data: existingRows, error: existingError } = await serviceClient
    .from('wedding_subscription_bundles')
    .select('id, seat_limit')
    .eq('wedding_id', transaction.wedding_id)
    .eq('bundle_code', mapping.bundleCode)
    .eq('bundle_type', mapping.bundleType)
    .order('created_at', { ascending: false })
    .limit(1);
  if (existingError) throw existingError;
  const existing = existingRows?.[0] ?? null;

  const { data: bundleRows, error: bundleError } = await serviceClient
    .from('wedding_subscription_bundles')
    .upsert({
      id: existing?.id,
      wedding_id: transaction.wedding_id,
      bundle_code: mapping.bundleCode,
      bundle_type: mapping.bundleType,
      status: 'active',
      billing_cycle: billingCycle,
      seat_limit: mapping.seatLimits?.committee ?? existing?.seat_limit ?? null,
      activated_at: payment.paidAt,
      expires_at: accessExpiresAt,
      grace_ends_at: null,
      billing_provider: payment.provider,
      billing_reference: payment.reference,
      metadata: {
        provider: payment.provider,
        provider_reference: payment.reference,
        merchant_reference: transaction.merchant_reference,
        entitlement_code: transaction.lookup_key,
        couple_plan_tier: mapping.couplePlanTier,
        committee_seat_limit: mapping.seatLimits?.committee ?? null,
        family_seat_limit: mapping.seatLimits?.family ?? null,
      },
    }, { onConflict: 'id' })
    .select('id')
    .limit(1);
  if (bundleError) throw bundleError;
  const sourceBundleId = bundleRows?.[0]?.id;
  if (!sourceBundleId) throw new Error('The wedding bundle could not be persisted.');

  const activatedFeatures = await Promise.all(mapping.features.map(async (featureKey) => {
    const { error } = await serviceClient.from('wedding_entitlements').upsert({
      wedding_id: transaction.wedding_id,
      feature_key: featureKey,
      status: 'active',
      source_bundle_id: sourceBundleId,
      effective_from: payment.paidAt,
      effective_to: accessExpiresAt,
      metadata: {
        provider: payment.provider,
        provider_reference: payment.reference,
        entitlement_code: transaction.lookup_key,
      },
    }, { onConflict: 'wedding_id,feature_key' });
    if (error) throw error;
    return featureKey;
  }));

  return {
    weddingId: transaction.wedding_id,
    bundleCode: mapping.bundleCode,
    bundleType: mapping.bundleType,
    activatedFeatures,
    couplePlanTier: mapping.couplePlanTier,
    seatLimits: mapping.seatLimits,
  };
}

export async function activateProfessionalCheckout(
  serviceClient: ServiceClient,
  transaction: PaymentTransaction,
  mapping: ProfessionalCheckoutMapping,
  payment: { provider: string; reference: string; paidAt: string },
) {
  const audience = transaction.audience;
  if (audience !== 'planner' && audience !== 'vendor') throw new Error('Invalid professional payment audience.');
  const billingCycle = transaction.lookup_key.endsWith('_monthly') ? 'monthly' : 'annual';
  const accessExpiresAt = calculateAccessExpiry(payment.paidAt, billingCycle);

  const activatedFeatures = await Promise.all(mapping.features.map(async (featureKey) => {
    const { data: existing, error: existingError } = await serviceClient
      .from('professional_entitlements')
      .select('id, seat_limit')
      .eq('user_id', transaction.user_id)
      .eq('audience', audience)
      .eq('feature_key', featureKey)
      .maybeSingle();
    if (existingError) throw existingError;
    const seatLimit = featureKey === 'team_workspace'
      ? Math.max(existing?.seat_limit ?? 0, mapping.seatLimit ?? 0)
      : existing?.seat_limit ?? null;

    const { error } = await serviceClient.from('professional_entitlements').upsert({
      id: existing?.id,
      user_id: transaction.user_id,
      audience,
      feature_key: featureKey,
      status: 'active',
      source_lookup_key: transaction.lookup_key,
      source_bundle_code: transaction.lookup_key,
      seat_limit: seatLimit,
      effective_from: payment.paidAt,
      effective_to: accessExpiresAt,
      metadata: {
        provider: payment.provider,
        provider_reference: payment.reference,
        merchant_reference: transaction.merchant_reference,
      },
    }, { onConflict: 'user_id,audience,feature_key' });
    if (error) throw error;
    return featureKey;
  }));

  if (audience === 'planner') {
    const { error } = await serviceClient
      .from('profiles')
      .update({
        planner_subscription_status: 'active',
        planner_subscription_started_at: payment.paidAt,
        planner_subscription_expires_at: accessExpiresAt,
      })
      .eq('user_id', transaction.user_id)
      .eq('role', 'planner');
    if (error) throw error;
  } else {
    const { error } = await serviceClient
      .from('vendor_listings')
      .update({
        subscription_status: 'active',
        subscription_started_at: payment.paidAt,
        subscription_expires_at: accessExpiresAt,
      })
      .eq('user_id', transaction.user_id);
    if (error) throw error;
  }

  return {
    audience,
    activatedFeatures,
    seatLimit: mapping.seatLimit ?? null,
    accessExpiresAt,
  };
}
