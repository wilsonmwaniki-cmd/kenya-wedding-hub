import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { getPesapalTransactionStatus, fetchPesapalToken, loadPesapalConfig, mapPesapalStatus } from '../_shared/pesapal.ts';
import { loadPricingCheckoutConfig } from '../_shared/pricingCatalog.ts';
import { logFunctionEvent } from '../_shared/runtimeLogger.ts';
import { createCorsHeaders } from '../_shared/cors.ts';
import { assertActiveAuthSession, isAuthSessionError } from '../_shared/sessionGuard.ts';

function toIsoOrNull(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = req.headers.get('x-request-id');

  try {
    const respondWithError = async (
      status: number,
      message: string,
      eventType: string,
      details?: Record<string, unknown>,
      userId?: string | null,
      audience?: string | null,
      entityId?: string | null,
    ) => {
      await logFunctionEvent({
        functionName: 'sync-pesapal-couple-checkout',
        severity: status >= 500 ? 'error' : 'warn',
        status: 'failure',
        eventType,
        message,
        userId,
        audience,
        entityId,
        requestId,
        details,
      });

      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    };

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return await respondWithError(401, 'Missing Authorization header.', 'authorization_missing');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return await respondWithError(500, 'Checkout sync environment variables are not fully configured.', 'sync_environment_incomplete');
    }

    const { orderTrackingId } = await req.json();
    if (!orderTrackingId || typeof orderTrackingId !== 'string') {
      return await respondWithError(400, 'Missing Pesapal order tracking id.', 'order_tracking_id_missing');
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const pricingCheckoutConfig = await loadPricingCheckoutConfig(serviceClient);

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return await respondWithError(401, 'You must be signed in before checkout sync can run.', 'user_missing');
    }

    await assertActiveAuthSession(serviceClient, authHeader, user.id);

    const { data: transaction, error: transactionError } = await serviceClient
      .from('payment_transactions')
      .select('*')
      .eq('provider', 'pesapal')
      .eq('provider_reference', orderTrackingId)
      .maybeSingle();

    if (transactionError || !transaction) {
      return await respondWithError(404, 'This Pesapal transaction could not be found.', 'transaction_missing', { orderTrackingId }, user.id, 'couple');
    }

    if (transaction.user_id !== user.id) {
      return await respondWithError(403, 'This Pesapal transaction does not belong to the current user.', 'user_transaction_mismatch', { orderTrackingId }, user.id, transaction.audience, transaction.wedding_id);
    }

    if (transaction.audience !== 'couple') {
      return await respondWithError(400, 'This Pesapal transaction is not for a couple checkout.', 'audience_mismatch', { orderTrackingId, audience: transaction.audience }, user.id, transaction.audience, transaction.wedding_id);
    }

    const config = loadPesapalConfig();
    const token = await fetchPesapalToken(config);
    const statusResult = await getPesapalTransactionStatus(config, token.token, orderTrackingId);
    const mappedStatus = mapPesapalStatus(statusResult.statusCode ?? statusResult.paymentStatusDescription ?? null);

    await serviceClient
      .from('payment_transactions')
      .update({
        status: mappedStatus,
        payment_method: statusResult.paymentMethod,
        payment_account: statusResult.paymentAccount,
        confirmation_code: statusResult.confirmationCode,
        provider_status_code: statusResult.statusCode == null ? null : String(statusResult.statusCode),
        provider_status_description: statusResult.paymentStatusDescription,
        provider_created_at: toIsoOrNull(statusResult.createdDate),
        raw_response: statusResult.raw,
      })
      .eq('id', transaction.id);

    if (mappedStatus !== 'completed') {
      return await respondWithError(
        400,
        'Pesapal payment is not complete yet.',
        'checkout_incomplete',
        { orderTrackingId, paymentStatus: statusResult.paymentStatusDescription, statusCode: statusResult.statusCode },
        user.id,
        transaction.audience,
        transaction.wedding_id,
      );
    }

    const mapping = pricingCheckoutConfig.coupleCheckoutMap[transaction.lookup_key];
    if (!mapping) {
      return await respondWithError(400, 'This Pesapal transaction is not a supported couple plan.', 'entitlement_unsupported', { lookupKey: transaction.lookup_key }, user.id, transaction.audience, transaction.wedding_id);
    }

    if (!transaction.wedding_id) {
      return await respondWithError(400, 'This Pesapal transaction is missing a wedding workspace reference.', 'wedding_missing', { orderTrackingId }, user.id, transaction.audience, null);
    }

    const { data: membership, error: membershipError } = await serviceClient
      .from('wedding_memberships')
      .select('id, role, is_owner, membership_status')
      .eq('wedding_id', transaction.wedding_id)
      .eq('user_id', user.id)
      .eq('membership_status', 'active')
      .maybeSingle();

    if (membershipError || !membership) {
      return await respondWithError(403, 'You must still be an active owner of this wedding to activate the upgrade.', 'membership_missing', { orderTrackingId }, user.id, transaction.audience, transaction.wedding_id);
    }

    const canManageWedding =
      membership.is_owner === true ||
      membership.role === 'bride' ||
      membership.role === 'groom';

    if (!canManageWedding) {
      return await respondWithError(403, 'Only wedding owners can activate the Collaborative plan.', 'owner_required', { membershipRole: membership.role, orderTrackingId }, user.id, transaction.audience, transaction.wedding_id);
    }

    const activatedAt = toIsoOrNull(statusResult.createdDate) ?? new Date().toISOString();
    const billingCycle =
      transaction.lookup_key.endsWith('_monthly')
        ? 'monthly'
        : transaction.lookup_key.endsWith('_annual')
          ? 'annual'
          : 'one_time';

    const { data: existingBundles, error: existingBundleError } = await serviceClient
      .from('wedding_subscription_bundles')
      .select('id, metadata, seat_limit')
      .eq('wedding_id', transaction.wedding_id)
      .eq('bundle_code', mapping.bundleCode)
      .eq('bundle_type', mapping.bundleType)
      .order('created_at', { ascending: false })
      .limit(1);

    if (existingBundleError) throw existingBundleError;

    const existingBundle = existingBundles?.[0] ?? null;

    const { data: bundleRows, error: bundleError } = await serviceClient
      .from('wedding_subscription_bundles')
      .upsert({
        id: existingBundle?.id,
        wedding_id: transaction.wedding_id,
        bundle_code: mapping.bundleCode,
        bundle_type: mapping.bundleType,
        status: 'active',
        billing_cycle: billingCycle,
        seat_limit: mapping.seatLimits?.committee ?? existingBundle?.seat_limit ?? null,
        activated_at: activatedAt,
        expires_at: null,
        grace_ends_at: null,
        billing_provider: 'pesapal',
        billing_reference: orderTrackingId,
        metadata: {
          order_tracking_id: orderTrackingId,
          merchant_reference: transaction.merchant_reference,
          entitlement_code: transaction.lookup_key,
          couple_plan_tier: mapping.couplePlanTier,
          committee_seat_limit: mapping.seatLimits?.committee ?? null,
          family_seat_limit: mapping.seatLimits?.family ?? null,
        },
      }, {
        onConflict: 'id',
      })
      .select('id')
      .limit(1);

    if (bundleError) throw bundleError;

    const sourceBundleId = bundleRows?.[0]?.id;
    if (!sourceBundleId) throw new Error('The wedding bundle could not be persisted.');

    const entitlementWrites = await Promise.all(
      mapping.features.map(async (featureKey) => {
        const { error } = await serviceClient
          .from('wedding_entitlements')
          .upsert(
            {
              wedding_id: transaction.wedding_id,
              feature_key: featureKey,
              status: 'active',
              source_bundle_id: sourceBundleId,
              effective_from: activatedAt,
              effective_to: null,
              metadata: {
                order_tracking_id: orderTrackingId,
                entitlement_code: transaction.lookup_key,
              },
            },
            {
              onConflict: 'wedding_id,feature_key',
            },
          );

        if (error) throw error;
        return featureKey;
      }),
    );

    await logFunctionEvent({
      functionName: 'sync-pesapal-couple-checkout',
      severity: 'info',
      status: 'success',
      eventType: 'checkout_sync_succeeded',
      message: `Activated couple Pesapal purchase ${transaction.lookup_key}.`,
      userId: user.id,
      audience: transaction.audience,
      entityId: transaction.wedding_id,
      requestId,
      details: {
        orderTrackingId,
        activatedFeatures: entitlementWrites,
      },
    });

    return new Response(JSON.stringify({
      weddingId: transaction.wedding_id,
      bundleCode: mapping.bundleCode,
      bundleType: mapping.bundleType,
      activatedFeatures: entitlementWrites,
      couplePlanTier: mapping.couplePlanTier,
      seatLimits: mapping.seatLimits,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('sync-pesapal-couple-checkout error:', error);

    if (isAuthSessionError(error)) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await logFunctionEvent({
      functionName: 'sync-pesapal-couple-checkout',
      severity: 'error',
      status: 'failure',
      eventType: 'checkout_sync_failed',
      message: error instanceof Error ? error.message : 'Unknown Pesapal couple checkout sync error',
      requestId,
      details: {
        error: error instanceof Error ? error.stack ?? error.message : String(error),
      },
    });

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown Pesapal couple checkout sync error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
