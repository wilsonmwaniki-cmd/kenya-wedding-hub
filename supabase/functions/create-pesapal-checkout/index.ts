import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { AbuseProtectionError, assertRecentFunctionEventLimit } from '../_shared/abuseProtection.ts';
import {
  buildPesapalMerchantReference,
  fetchPesapalToken,
  loadPesapalConfig,
  submitPesapalOrder,
} from '../_shared/pesapal.ts';
import { loadPricingCheckoutConfig, loadPricingPaymentCatalog } from '../_shared/pricingCatalog.ts';
import { logFunctionEvent } from '../_shared/runtimeLogger.ts';
import { createCorsHeaders } from '../_shared/cors.ts';
import { assertActiveAuthSession, isAuthSessionError } from '../_shared/sessionGuard.ts';

function splitName(fullName: string | null | undefined) {
  const normalized = fullName?.trim();
  if (!normalized) {
    return {
      firstName: '',
      middleName: '',
      lastName: '',
    };
  }

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return {
      firstName: parts[0],
      middleName: '',
      lastName: '',
    };
  }

  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts.at(-1) ?? '',
  };
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);

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

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Billing environment variables are not fully configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const pricingCheckoutConfig = await loadPricingCheckoutConfig(serviceClient);
    const paymentCatalog = await loadPricingPaymentCatalog(serviceClient);

    const {
      audience,
      feature,
      lookupKey,
      cadence,
      weddingId,
      successUrl,
      cancelUrl,
    } = await req.json();

    if (!lookupKey || typeof lookupKey !== 'string' || !pricingCheckoutConfig.allowedLookupKeys.includes(lookupKey)) {
      return new Response(JSON.stringify({ error: 'Invalid pricing lookup key.' }), {
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

    const pricingItem = paymentCatalog[lookupKey];
    if (!pricingItem || pricingItem.amountKes == null || pricingItem.amountKes <= 0) {
      return new Response(JSON.stringify({ error: 'This product is not fully priced for Pesapal yet.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    await assertActiveAuthSession(serviceClient, authHeader, user.id);

    await assertRecentFunctionEventLimit(serviceClient, {
      functionName: 'create-pesapal-checkout',
      userId: user.id,
      eventType: 'checkout_start_requested',
      lookbackMs: 10 * 60 * 1000,
      maxAttempts: 6,
      message: 'Too many checkout attempts in a short period. Please wait a few minutes before trying again.',
      retryAfterSeconds: 5 * 60,
    });

    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('id, role, full_name, company_name, company_email, company_phone')
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

    const config = loadPesapalConfig();
    const merchantReference = buildPesapalMerchantReference('pzania');
    const { firstName, middleName, lastName } = splitName(profile.full_name);

    const orderPayload = {
      id: merchantReference,
      currency: 'KES',
      amount: pricingItem.amountKes,
      description: pricingItem.title.slice(0, 100),
      callback_url: successUrl,
      cancellation_url: cancelUrl,
      notification_id: config.notificationId,
      billing_address: {
        email_address: profile.company_email || user.email || '',
        phone_number: profile.company_phone || user.phone || '',
        country_code: 'KE',
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        line_1: profile.company_name || profile.full_name || '',
        line_2: '',
        city: '',
        state: '',
        postal_code: '',
        zip_code: '',
      },
    };

    const { data: insertedRows, error: insertError } = await serviceClient
      .from('payment_transactions')
      .insert({
        provider: 'pesapal',
        user_id: user.id,
        wedding_id: typeof weddingId === 'string' ? weddingId : null,
        audience: typeof audience === 'string' ? audience : pricingItem.audience,
        feature: typeof feature === 'string' ? feature : pricingItem.feature,
        lookup_key: lookupKey,
        merchant_reference: merchantReference,
        status: 'processing',
        currency: 'KES',
        amount: pricingItem.amountKes,
        callback_url: successUrl,
        cancel_url: cancelUrl,
        notification_id: config.notificationId,
        raw_request: orderPayload,
        metadata: {
          cadence: typeof cadence === 'string' ? cadence : pricingItem.cadence,
          request_id: requestId,
        },
      })
      .select('id')
      .limit(1);

    if (insertError) {
      throw insertError;
    }

    const transactionId = insertedRows?.[0]?.id ?? null;

    await logFunctionEvent({
      functionName: 'create-pesapal-checkout',
      severity: 'info',
      status: 'success',
      eventType: 'checkout_start_requested',
      message: 'Pesapal checkout creation requested.',
      userId: user.id,
      audience: typeof audience === 'string' ? audience : null,
      entityId: typeof weddingId === 'string' ? weddingId : null,
      requestId,
      details: {
        lookupKey,
        feature: typeof feature === 'string' ? feature : null,
        transactionId,
      },
    });

    const token = await fetchPesapalToken(config);
    const order = await submitPesapalOrder(config, token.token, orderPayload);

    await serviceClient
      .from('payment_transactions')
      .update({
        provider_reference: order.orderTrackingId,
        redirect_url: order.redirectUrl,
        raw_response: {
          auth: token.raw,
          order: order.raw,
        },
      })
      .eq('merchant_reference', merchantReference);

    await logFunctionEvent({
      functionName: 'create-pesapal-checkout',
      severity: 'info',
      status: 'success',
      eventType: 'checkout_session_created',
      message: 'Pesapal order created successfully.',
      userId: user.id,
      audience: typeof audience === 'string' ? audience : null,
      entityId: typeof weddingId === 'string' ? weddingId : null,
      requestId,
      details: {
        lookupKey,
        orderTrackingId: order.orderTrackingId,
        transactionId,
      },
    });

    return new Response(JSON.stringify({
      url: order.redirectUrl,
      reference: order.orderTrackingId,
      provider: 'pesapal',
      orderTrackingId: order.orderTrackingId,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('create-pesapal-checkout error:', error);

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

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown Pesapal checkout error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
