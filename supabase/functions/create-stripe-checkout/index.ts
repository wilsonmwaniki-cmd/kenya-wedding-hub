import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.25.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { AbuseProtectionError, assertRecentFunctionEventLimit } from '../_shared/abuseProtection.ts';
import { loadPricingCheckoutConfig } from '../_shared/pricingCatalog.ts';
import { logFunctionEvent } from '../_shared/runtimeLogger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function mergeAllowedLookupKeys(baseLookupKeys: string[]) {
  const envValue = Deno.env.get('STRIPE_ALLOWED_LOOKUP_KEYS')?.trim();
  if (!envValue) return new Set(baseLookupKeys);

  try {
    const parsed = envValue.startsWith('[')
      ? JSON.parse(envValue)
      : envValue.split(',').map((item) => item.trim()).filter(Boolean);

    if (!Array.isArray(parsed)) {
      console.warn('STRIPE_ALLOWED_LOOKUP_KEYS is not an array-like value. Falling back to Supabase/default lookup keys.');
      return new Set(baseLookupKeys);
    }

    const normalized = parsed
      .map((item) => typeof item === 'string' ? item.trim() : '')
      .filter(Boolean);

    return new Set([...baseLookupKeys, ...normalized]);
  } catch (error) {
    console.warn('Could not parse STRIPE_ALLOWED_LOOKUP_KEYS. Falling back to Supabase/default lookup keys.', error);
    return new Set(baseLookupKeys);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'Billing environment variables are not fully configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      audience,
      feature,
      lookupKey,
      cadence,
      weddingId,
      successUrl,
      cancelUrl,
    } = await req.json();

    if (!lookupKey || typeof lookupKey !== 'string' || !allowedLookupKeys.has(lookupKey)) {
      return new Response(JSON.stringify({ error: 'Invalid Stripe price lookup key.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!successUrl || !cancelUrl) {
      return new Response(JSON.stringify({ error: 'Missing success or cancel URL.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const pricingCheckoutConfig = await loadPricingCheckoutConfig(serviceClient);
    const allowedLookupKeys = mergeAllowedLookupKeys(pricingCheckoutConfig.allowedLookupKeys);

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'You must be signed in before checkout can start.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await assertRecentFunctionEventLimit(serviceClient, {
      functionName: 'create-stripe-checkout',
      userId: user.id,
      eventType: 'checkout_start_requested',
      lookbackMs: 10 * 60 * 1000,
      maxAttempts: 6,
      message: 'Too many checkout attempts in a short period. Please wait a few minutes before trying again.',
      retryAfterSeconds: 5 * 60,
    });

    await logFunctionEvent({
      functionName: 'create-stripe-checkout',
      severity: 'info',
      status: 'success',
      eventType: 'checkout_start_requested',
      message: 'Checkout session creation requested.',
      userId: user.id,
      audience: typeof audience === 'string' ? audience : null,
      entityId: typeof weddingId === 'string' ? weddingId : null,
      requestId,
      details: {
        lookupKey,
        feature: typeof feature === 'string' ? feature : null,
      },
    });

    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('id, role, full_name, company_name, stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Could not find a profile for this account.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (audience === 'couple') {
      if (!weddingId || typeof weddingId !== 'string') {
        return new Response(JSON.stringify({ error: 'Choose or create a wedding workspace before checkout can start.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: membership, error: membershipError } = await serviceClient
        .from('wedding_memberships')
        .select('id, role, is_owner, membership_status')
        .eq('wedding_id', weddingId)
        .eq('user_id', user.id)
        .eq('membership_status', 'active')
        .maybeSingle();

      if (membershipError || !membership) {
        return new Response(JSON.stringify({ error: 'You must be an active member of this wedding to start checkout.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const canManageWedding =
        membership.is_owner === true ||
        membership.role === 'wedding_owner' ||
        membership.role === 'bride' ||
        membership.role === 'groom';

      if (!canManageWedding) {
        return new Response(JSON.stringify({ error: 'Only the couple owners can purchase wedding plans and add-ons.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });

    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      active: true,
      limit: 1,
    });

    const price = prices.data[0];
    if (!price?.id) {
      return new Response(JSON.stringify({ error: 'The requested Stripe price could not be found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile.company_name || profile.full_name || user.email || undefined,
        metadata: {
          user_id: user.id,
          role: profile.role,
        },
      });

      customerId = customer.id;

      await serviceClient
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id);
    }

    const mode = price.type === 'recurring' ? 'subscription' : 'payment';
    const metadata = {
      audience: String(audience || ''),
      feature: String(feature || ''),
      cadence: String(cadence || ''),
      entitlement_code: lookupKey,
      user_id: user.id,
      wedding_id: typeof weddingId === 'string' ? weddingId : '',
    };

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: user.id,
      mode,
      allow_promotion_codes: true,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      ...(mode === 'subscription'
        ? { subscription_data: { metadata } }
        : { payment_intent_data: { metadata } }),
    });

    await logFunctionEvent({
      functionName: 'create-stripe-checkout',
      severity: 'info',
      status: 'success',
      eventType: 'checkout_session_created',
      message: 'Checkout session created successfully.',
      userId: user.id,
      audience: typeof audience === 'string' ? audience : null,
      entityId: typeof weddingId === 'string' ? weddingId : null,
      requestId,
      details: {
        lookupKey,
        sessionId: session.id,
      },
    });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('create-stripe-checkout error:', error);
    if (error instanceof AbuseProtectionError) {
      await logFunctionEvent({
        functionName: 'create-stripe-checkout',
        severity: 'warn',
        status: 'failure',
        eventType: 'checkout_rate_limited',
        message: error.message,
        requestId,
        details: {
          retryAfterSeconds: error.retryAfterSeconds,
        },
      });
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          ...(error.retryAfterSeconds ? { 'Retry-After': String(error.retryAfterSeconds) } : {}),
        },
      });
    }

    await logFunctionEvent({
      functionName: 'create-stripe-checkout',
      severity: 'error',
      status: 'failure',
      eventType: 'checkout_start_failed',
      message: error instanceof Error ? error.message : 'Unknown checkout start error',
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
