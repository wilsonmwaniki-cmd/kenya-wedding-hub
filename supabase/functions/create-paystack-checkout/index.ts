import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { AbuseProtectionError, assertRecentFunctionEventLimit } from '../_shared/abuseProtection.ts';
import {
  buildPaystackReference,
  initializePaystackTransaction,
  loadPaystackConfig,
  toPaystackSubunit,
} from '../_shared/paystack.ts';
import { loadPricingCheckoutConfig, loadPricingPaymentCatalog } from '../_shared/pricingCatalog.ts';
import { logFunctionEvent } from '../_shared/runtimeLogger.ts';
import { createCorsHeaders } from '../_shared/cors.ts';
import { assertActiveAuthSession, isAuthSessionError } from '../_shared/sessionGuard.ts';

function callbackUrlWithProvider(value: string) {
  const url = new URL(value);
  url.searchParams.set('payment_provider', 'paystack');
  return url.toString();
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error('Billing environment variables are not fully configured.');
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const pricingCheckoutConfig = await loadPricingCheckoutConfig(serviceClient);
    const paymentCatalog = await loadPricingPaymentCatalog(serviceClient);
    const body = await req.json();
    const { audience, feature, lookupKey, cadence, weddingId, successUrl, cancelUrl } = body;

    if (!lookupKey || typeof lookupKey !== 'string' || !pricingCheckoutConfig.allowedLookupKeys.includes(lookupKey)) {
      return new Response(JSON.stringify({ error: 'Invalid pricing lookup key.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (typeof successUrl !== 'string' || typeof cancelUrl !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing success or cancel URL.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pricingItem = paymentCatalog[lookupKey];
    if (!pricingItem || pricingItem.amountKes == null || pricingItem.amountKes <= 0) {
      return new Response(JSON.stringify({ error: 'This product is not fully priced for Paystack yet.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (pricingItem.audience !== audience) {
      return new Response(JSON.stringify({ error: 'This pricing product does not match the requested account type.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'You must be signed in before checkout can start.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await assertActiveAuthSession(serviceClient, authHeader, user.id);
    await assertRecentFunctionEventLimit(serviceClient, {
      functionName: 'create-paystack-checkout',
      userId: user.id,
      eventType: 'checkout_start_requested',
      lookbackMs: 10 * 60 * 1000,
      maxAttempts: 6,
      message: 'Too many checkout attempts in a short period. Please wait a few minutes before trying again.',
      retryAfterSeconds: 5 * 60,
    });

    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('role, full_name, company_name, company_email, company_phone')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profileError || !profile) throw new Error('Could not find a profile for this account.');

    if (audience === 'couple') {
      if (!weddingId || typeof weddingId !== 'string') {
        return new Response(JSON.stringify({ error: 'Choose or create a wedding workspace before checkout can start.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: membership, error: membershipError } = await serviceClient
        .from('wedding_memberships')
        .select('role, is_owner, membership_status')
        .eq('wedding_id', weddingId)
        .eq('user_id', user.id)
        .eq('membership_status', 'active')
        .maybeSingle();
      const canManage = membership?.is_owner === true || ['wedding_owner', 'bride', 'groom'].includes(membership?.role ?? '');
      if (membershipError || !membership || !canManage) {
        return new Response(JSON.stringify({ error: 'Only active wedding owners can purchase the Collaborative plan.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const email = profile.company_email || user.email;
    if (!email) {
      return new Response(JSON.stringify({ error: 'Add an email address to this account before checkout.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const config = loadPaystackConfig();
    const reference = buildPaystackReference();
    const callbackUrl = callbackUrlWithProvider(successUrl);
    const metadata = {
      zania_transaction_reference: reference,
      lookup_key: lookupKey,
      audience: typeof audience === 'string' ? audience : pricingItem.audience,
      feature: typeof feature === 'string' ? feature : pricingItem.feature,
      cadence: typeof cadence === 'string' ? cadence : pricingItem.cadence,
      user_id: user.id,
      wedding_id: typeof weddingId === 'string' ? weddingId : null,
      cancel_url: cancelUrl,
      request_id: requestId,
      custom_fields: [
        { display_name: 'Product', variable_name: 'product', value: pricingItem.title },
      ],
    };
    const paystackPayload = {
      email,
      amount: String(toPaystackSubunit(pricingItem.amountKes)),
      currency: config.currency,
      reference,
      callback_url: callbackUrl,
      metadata: JSON.stringify(metadata),
    };

    const { data: rows, error: insertError } = await serviceClient
      .from('payment_transactions')
      .insert({
        provider: 'paystack',
        user_id: user.id,
        wedding_id: typeof weddingId === 'string' ? weddingId : null,
        audience: typeof audience === 'string' ? audience : pricingItem.audience,
        feature: typeof feature === 'string' ? feature : pricingItem.feature,
        lookup_key: lookupKey,
        merchant_reference: reference,
        provider_reference: reference,
        status: 'processing',
        currency: config.currency,
        amount: pricingItem.amountKes,
        callback_url: callbackUrl,
        cancel_url: cancelUrl,
        raw_request: paystackPayload,
        metadata,
      })
      .select('id')
      .limit(1);
    if (insertError) throw insertError;

    await logFunctionEvent({
      functionName: 'create-paystack-checkout',
      severity: 'info',
      status: 'success',
      eventType: 'checkout_start_requested',
      message: 'Paystack checkout creation requested.',
      userId: user.id,
      audience: typeof audience === 'string' ? audience : null,
      entityId: typeof weddingId === 'string' ? weddingId : null,
      requestId,
      details: { lookupKey, transactionId: rows?.[0]?.id ?? null },
    });

    const initialized = await initializePaystackTransaction(config, paystackPayload);
    await serviceClient.from('payment_transactions').update({
      provider_reference: initialized.reference,
      redirect_url: initialized.authorizationUrl,
      raw_response: initialized.raw,
      metadata: { ...metadata, access_code: initialized.accessCode },
    }).eq('merchant_reference', reference);

    await logFunctionEvent({
      functionName: 'create-paystack-checkout',
      severity: 'info',
      status: 'success',
      eventType: 'checkout_session_created',
      message: 'Paystack checkout created successfully.',
      userId: user.id,
      audience: typeof audience === 'string' ? audience : null,
      entityId: typeof weddingId === 'string' ? weddingId : null,
      requestId,
      details: { lookupKey, reference: initialized.reference },
    });

    return new Response(JSON.stringify({
      url: initialized.authorizationUrl,
      reference: initialized.reference,
      provider: 'paystack',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('create-paystack-checkout error:', error);
    if (error instanceof AbuseProtectionError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          ...(error.retryAfterSeconds ? { 'Retry-After': String(error.retryAfterSeconds) } : {}),
        },
      });
    }
    if (isAuthSessionError(error)) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown Paystack checkout error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
