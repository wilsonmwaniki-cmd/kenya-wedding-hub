import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { activateCoupleCheckout } from '../_shared/checkoutEntitlements.ts';
import { createCorsHeaders } from '../_shared/cors.ts';
import {
  assertPaystackPaymentMatches,
  loadPaystackConfig,
  mapPaystackStatus,
  verifyPaystackTransaction,
} from '../_shared/paystack.ts';
import { loadPricingCheckoutConfig } from '../_shared/pricingCatalog.ts';
import { logFunctionEvent } from '../_shared/runtimeLogger.ts';
import { assertActiveAuthSession, isAuthSessionError } from '../_shared/sessionGuard.ts';

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw Object.assign(new Error('Missing Authorization header.'), { status: 401 });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error('Checkout sync environment variables are not fully configured.');

    const body = await req.json();
    const reference = typeof body?.reference === 'string' ? body.reference.trim() : '';
    if (!reference) throw Object.assign(new Error('Missing Paystack transaction reference.'), { status: 400 });

    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) throw Object.assign(new Error('You must be signed in before checkout sync can run.'), { status: 401 });
    await assertActiveAuthSession(serviceClient, authHeader, user.id);

    const { data: transaction, error: transactionError } = await serviceClient
      .from('payment_transactions')
      .select('*')
      .eq('provider', 'paystack')
      .eq('provider_reference', reference)
      .maybeSingle();
    if (transactionError || !transaction) throw Object.assign(new Error('This Paystack transaction could not be found.'), { status: 404 });
    if (transaction.user_id !== user.id) throw Object.assign(new Error('This Paystack transaction does not belong to the current user.'), { status: 403 });
    if (transaction.audience !== 'couple') throw Object.assign(new Error('This Paystack transaction is not for a couple checkout.'), { status: 400 });

    const payment = await verifyPaystackTransaction(loadPaystackConfig(), reference);
    assertPaystackPaymentMatches(payment, {
      reference: transaction.provider_reference,
      amountKes: Number(transaction.amount),
      currency: transaction.currency,
    });
    const status = mapPaystackStatus(payment.status);
    await serviceClient.from('payment_transactions').update({
      status,
      payment_method: payment.channel,
      payment_account: payment.customerEmail,
      confirmation_code: payment.authorizationCode || (payment.id == null ? null : String(payment.id)),
      provider_status_code: payment.status,
      provider_status_description: payment.gatewayResponse,
      provider_created_at: payment.paidAt,
      raw_response: payment.raw,
    }).eq('id', transaction.id);
    if (status !== 'completed') throw Object.assign(new Error('Paystack payment is not complete yet.'), { status: 400 });

    const config = await loadPricingCheckoutConfig(serviceClient);
    const mapping = config.coupleCheckoutMap[transaction.lookup_key];
    if (!mapping) throw Object.assign(new Error('This Paystack transaction is not a supported couple plan.'), { status: 400 });

    const result = await activateCoupleCheckout(serviceClient, transaction, mapping, {
      provider: 'paystack',
      reference,
      paidAt: payment.paidAt || new Date().toISOString(),
    });
    await logFunctionEvent({
      functionName: 'sync-paystack-couple-checkout',
      severity: 'info',
      status: 'success',
      eventType: 'checkout_sync_succeeded',
      message: `Activated couple Paystack purchase ${transaction.lookup_key}.`,
      userId: user.id,
      audience: transaction.audience,
      entityId: transaction.wedding_id,
      requestId,
      details: { reference, activatedFeatures: result.activatedFeatures },
    });
    return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    const status = isAuthSessionError(error)
      ? error.status
      : typeof (error as { status?: unknown })?.status === 'number'
        ? (error as { status: number }).status
        : 500;
    const message = error instanceof Error ? error.message : 'Unknown Paystack couple checkout sync error';
    await logFunctionEvent({
      functionName: 'sync-paystack-couple-checkout',
      severity: status >= 500 ? 'error' : 'warn',
      status: 'failure',
      eventType: 'checkout_sync_failed',
      message,
      requestId,
      details: { error: error instanceof Error ? error.stack ?? error.message : String(error) },
    });
    return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
