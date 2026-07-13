import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { fetchPesapalToken, getPesapalTransactionStatus, loadPesapalConfig, mapPesapalStatus } from '../_shared/pesapal.ts';
import { loadPricingCheckoutConfig } from '../_shared/pricingCatalog.ts';
import { logFunctionEvent } from '../_shared/runtimeLogger.ts';
import { createCorsHeaders } from '../_shared/cors.ts';
import { assertActiveAuthSession, isAuthSessionError } from '../_shared/sessionGuard.ts';

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
      audienceValue?: string | null,
    ) => {
      await logFunctionEvent({
        functionName: 'sync-pesapal-professional-checkout',
        severity: status >= 500 ? 'error' : 'warn',
        status: 'failure',
        eventType,
        message,
        userId,
        audience: audienceValue,
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

    const { orderTrackingId, audience } = await req.json();

    if (!orderTrackingId || typeof orderTrackingId !== 'string') {
      return await respondWithError(400, 'Missing Pesapal order tracking id.', 'order_tracking_id_missing');
    }

    if (audience !== 'planner' && audience !== 'vendor') {
      return await respondWithError(400, 'Invalid professional audience.', 'audience_invalid', { audience });
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
      return await respondWithError(404, 'This Pesapal transaction could not be found.', 'transaction_missing', { orderTrackingId }, user.id, audience);
    }

    if (transaction.user_id !== user.id) {
      return await respondWithError(403, 'This Pesapal transaction does not belong to the current user.', 'user_transaction_mismatch', { orderTrackingId }, user.id, transaction.audience);
    }

    if (transaction.audience !== audience) {
      return await respondWithError(400, 'This Pesapal transaction does not match the requested professional audience.', 'audience_mismatch', { transactionAudience: transaction.audience, requestedAudience: audience }, user.id, transaction.audience);
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
        raw_response: statusResult.raw,
      })
      .eq('id', transaction.id);

    if (mappedStatus !== 'completed') {
      return await respondWithError(400, 'Pesapal payment is not complete yet.', 'checkout_incomplete', {
        orderTrackingId,
        paymentStatus: statusResult.paymentStatusDescription,
        statusCode: statusResult.statusCode,
      }, user.id, transaction.audience);
    }

    const mapping = pricingCheckoutConfig.professionalCheckoutMap[transaction.lookup_key];
    if (!mapping) {
      return await respondWithError(400, 'This Pesapal transaction is not a supported professional add-on.', 'entitlement_unsupported', { lookupKey: transaction.lookup_key }, user.id, transaction.audience);
    }

    const entitlementWrites = await Promise.all(
      mapping.features.map(async (featureKey) => {
        const { data: existingRow } = await serviceClient
          .from('professional_entitlements')
          .select('id, seat_limit')
          .eq('user_id', user.id)
          .eq('audience', audience)
          .eq('feature_key', featureKey)
          .maybeSingle();

        const seatLimit = featureKey === 'team_workspace'
          ? Math.max(existingRow?.seat_limit ?? 0, mapping.seatLimit ?? 0)
          : existingRow?.seat_limit ?? null;

        const { error } = await serviceClient
          .from('professional_entitlements')
          .upsert(
            {
              id: existingRow?.id,
              user_id: user.id,
              audience,
              feature_key: featureKey,
              status: 'active',
              source_lookup_key: transaction.lookup_key,
              source_bundle_code: transaction.lookup_key,
              seat_limit: seatLimit,
              effective_from: new Date().toISOString(),
              effective_to: null,
              metadata: {
                order_tracking_id: orderTrackingId,
                merchant_reference: transaction.merchant_reference,
              },
            },
            {
              onConflict: 'user_id,audience,feature_key',
            },
          );

        if (error) throw error;
        return featureKey;
      }),
    );

    await logFunctionEvent({
      functionName: 'sync-pesapal-professional-checkout',
      severity: 'info',
      status: 'success',
      eventType: 'checkout_sync_succeeded',
      message: `Activated professional Pesapal add-on ${transaction.lookup_key}.`,
      userId: user.id,
      audience: transaction.audience,
      requestId,
      details: {
        orderTrackingId,
        activatedFeatures: entitlementWrites,
        seatLimit: mapping.seatLimit ?? null,
      },
    });

    return new Response(JSON.stringify({
      audience,
      activatedFeatures: entitlementWrites,
      seatLimit: mapping.seatLimit ?? null,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('sync-pesapal-professional-checkout error:', error);

    if (isAuthSessionError(error)) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await logFunctionEvent({
      functionName: 'sync-pesapal-professional-checkout',
      severity: 'error',
      status: 'failure',
      eventType: 'checkout_sync_failed',
      message: error instanceof Error ? error.message : 'Unknown Pesapal professional checkout sync error',
      requestId,
      details: {
        error: error instanceof Error ? error.stack ?? error.message : String(error),
      },
    });

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown Pesapal professional checkout sync error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
