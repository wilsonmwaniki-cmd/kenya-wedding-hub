import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.25.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
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
        functionName: 'sync-professional-checkout',
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
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY) {
      return await respondWithError(500, 'Checkout sync environment variables are not fully configured.', 'sync_environment_incomplete');
    }

    const { sessionId, audience } = await req.json();

    if (!sessionId || typeof sessionId !== 'string') {
      return await respondWithError(400, 'Missing Stripe checkout session id.', 'session_id_missing');
    }

    if (audience !== 'planner' && audience !== 'vendor') {
      return await respondWithError(400, 'Invalid professional audience.', 'audience_invalid', { audience });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const pricingCheckoutConfig = await loadPricingCheckoutConfig(serviceClient);
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return await respondWithError(401, 'You must be signed in before checkout sync can run.', 'user_missing');
    }

    await assertActiveAuthSession(serviceClient, authHeader, user.id);

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const entitlementCode = session.metadata?.entitlement_code;
    const checkoutUserId = session.metadata?.user_id;
    const checkoutAudience = session.metadata?.audience;

    if (checkoutUserId !== user.id) {
      return await respondWithError(403, 'This checkout session does not belong to the current user.', 'user_session_mismatch', { checkoutUserId, sessionId }, user.id, checkoutAudience);
    }

    if (checkoutAudience !== audience) {
      return await respondWithError(400, 'This checkout session does not match the requested professional audience.', 'audience_mismatch', { checkoutAudience, requestedAudience: audience, sessionId }, user.id, checkoutAudience);
    }

    if (session.status !== 'complete') {
      return await respondWithError(400, 'Stripe checkout is not complete yet.', 'checkout_incomplete', { stripeStatus: session.status, sessionId }, user.id, checkoutAudience);
    }

    const mapping = entitlementCode ? pricingCheckoutConfig.professionalCheckoutMap[entitlementCode] : null;
    if (!mapping) {
      return await respondWithError(400, 'This checkout session is not a supported professional add-on.', 'entitlement_unsupported', { entitlementCode, sessionId }, user.id, checkoutAudience);
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
              source_lookup_key: entitlementCode,
              source_bundle_code: entitlementCode,
              seat_limit: seatLimit,
              effective_from: new Date().toISOString(),
              effective_to: null,
              metadata: {
                checkout_session_id: session.id,
                customer_id: session.customer,
                subscription_id: session.subscription,
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
      functionName: 'sync-professional-checkout',
      severity: 'info',
      status: 'success',
      eventType: 'checkout_sync_succeeded',
      message: `Activated professional add-on ${entitlementCode}.`,
      userId: user.id,
      audience: checkoutAudience,
      requestId,
      details: {
        sessionId,
        activatedFeatures: entitlementWrites,
        seatLimit: mapping.seatLimit ?? null,
      },
    });

    return new Response(
      JSON.stringify({
        audience,
        activatedFeatures: entitlementWrites,
        seatLimit: mapping.seatLimit ?? null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('sync-professional-checkout error:', error);
    if (isAuthSessionError(error)) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await logFunctionEvent({
      functionName: 'sync-professional-checkout',
      severity: 'error',
      status: 'failure',
      eventType: 'checkout_sync_failed',
      message: error instanceof Error ? error.message : 'Unknown professional checkout sync error',
      requestId,
      details: {
        error: error instanceof Error ? error.stack ?? error.message : String(error),
      },
    });
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
