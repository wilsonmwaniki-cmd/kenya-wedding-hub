import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { AbuseProtectionError, assertRecentFunctionEventLimit } from '../_shared/abuseProtection.ts';
import { createCorsHeaders } from '../_shared/cors.ts';
import { assertActiveAuthSession, isAuthSessionError } from '../_shared/sessionGuard.ts';
import { logFunctionEvent } from '../_shared/runtimeLogger.ts';
import { assertLivePaystackKey } from '../_shared/zaniaPayPilot.ts';
import { DEMO_EXTERNAL_ACTION_MESSAGE, isTemporaryDemoUser } from '../_shared/demoGuard.ts';
import {
  buildPaystackReference,
  initializePaystackTransaction,
  loadPaystackConfig,
  loadPaystackTestConfig,
  toPaystackSubunit,
} from '../_shared/paystack.ts';

function jsonResponse(body: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

function normalizeKenyanPhone(value: unknown) {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '');
  if (/^254[17]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^0[17]\d{8}$/.test(digits)) return `+254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `+254${digits}`;
  return null;
}

function calculatePayerProcessingFee(amount: number, rate: number) {
  return Math.ceil((amount * rate) / (1 - rate));
}

const ZANIA_SERVICE_FEE_KES = 50;
const ZANIA_PAY_MINIMUM_PAYMENT_KES = 1_000;

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405, corsHeaders);

  const requestId = crypto.randomUUID();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Sign in before starting payment.' }, 401, corsHeaders);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: 'Payment services are not configured.' }, 500, corsHeaders);
    }

    const paymentMode = Deno.env.get('ZANIA_PAY_MODE') === 'live' ? 'live' : 'sandbox';
    const paymentsEnabled = paymentMode === 'live'
      ? Deno.env.get('ZANIA_PAY_LIVE_ENABLED') === 'true'
      : Deno.env.get('ZANIA_PAY_SANDBOX_ENABLED') === 'true';
    if (!paymentsEnabled) {
      return jsonResponse({ error: 'Zania Pay is not open for payments yet.' }, 503, corsHeaders);
    }

    const paystackConfig = paymentMode === 'live' ? loadPaystackConfig() : loadPaystackTestConfig();
    if (paymentMode === 'live') assertLivePaystackKey(paystackConfig.secretKey);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: 'Sign in before starting payment.' }, 401, corsHeaders);
    if (isTemporaryDemoUser(user)) return jsonResponse({ error: DEMO_EXTERNAL_ACTION_MESSAGE, code: 'demo_action_blocked' }, 403, corsHeaders);

    await assertActiveAuthSession(serviceClient, authHeader, user.id);
    await assertRecentFunctionEventLimit(serviceClient, {
      functionName: 'create-zania-pay-order',
      userId: user.id,
      eventType: 'payment_order_requested',
      lookbackMs: 10 * 60 * 1000,
      maxAttempts: 5,
      message: 'Too many payment attempts. Wait a few minutes and try again.',
      retryAfterSeconds: 5 * 60,
    });

    const body = await req.json();
    const invoiceId = typeof body.invoiceId === 'string' ? body.invoiceId : '';
    const amount = Number(body.amount);
    const paymentMethod = body.paymentMethod === 'mpesa' || body.paymentMethod === 'card'
      ? body.paymentMethod
      : null;
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';
    const phone = paymentMethod === 'mpesa' ? normalizeKenyanPhone(body.phone) : null;

    if (!invoiceId || !Number.isFinite(amount) || amount <= 0 || !paymentMethod || !idempotencyKey) {
      return jsonResponse({ error: 'Check the payment details and try again.' }, 400, corsHeaders);
    }
    if (amount < ZANIA_PAY_MINIMUM_PAYMENT_KES) {
      return jsonResponse({ error: 'Zania Pay payments start at KES 1,000.' }, 400, corsHeaders);
    }
    if (paymentMethod === 'mpesa' && !phone) {
      return jsonResponse({ error: 'Enter a valid Kenyan M-Pesa number.' }, 400, corsHeaders);
    }
    if (paymentMethod === 'card') {
      return jsonResponse({ error: 'Card payments will open after automatic fee passing is enabled.' }, 503, corsHeaders);
    }

    const { data: order, error: orderError } = await authClient.rpc('create_zania_pay_order', {
      _invoice_id: invoiceId,
      _amount: amount,
      _payment_method: paymentMethod,
      _idempotency_key: idempotencyKey,
    });
    if (orderError || !order) {
      return jsonResponse({ error: orderError?.message || 'Could not start this payment.' }, 400, corsHeaders);
    }

    const paymentOrder = order as Record<string, unknown>;
    const orderId = String(paymentOrder.id || '');
    if (!orderId || paymentOrder.payer_user_id !== user.id) {
      throw new Error('Payment order ownership check failed.');
    }
    if (Number(paymentOrder.amount) !== amount || paymentOrder.invoice_id !== invoiceId || paymentOrder.payment_method !== paymentMethod) {
      return jsonResponse({ error: 'Payment details changed. Start a new payment request.' }, 409, corsHeaders);
    }
    if (new Date(String(paymentOrder.expires_at)).getTime() <= Date.now()) {
      return jsonResponse({ error: 'This payment request expired. Start again.' }, 409, corsHeaders);
    }

    const serviceFee = Number(paymentOrder.zania_fee ?? ZANIA_SERVICE_FEE_KES);
    if (serviceFee !== ZANIA_SERVICE_FEE_KES) {
      throw new Error('The Zania service fee does not match the current checkout fee. Start again.');
    }
    const processingFee = calculatePayerProcessingFee(amount + serviceFee, 0.015);
    const totalCharged = amount + processingFee + serviceFee;
    const { data: professionalAccount, error: accountError } = await serviceClient
      .from('zania_pay_accounts')
      .select('provider_account_reference, status, mode, provider_verification_status')
      .eq('id', String(paymentOrder.professional_account_id || ''))
      .maybeSingle();
    if (accountError) throw accountError;
    if (!professionalAccount || professionalAccount.status !== 'verified') {
      return jsonResponse({ error: 'This professional is not ready to receive payments.' }, 409, corsHeaders);
    }
    if (professionalAccount.mode !== paymentMode) {
      return jsonResponse({ error: 'This professional must reconnect their payout account before receiving payments.' }, 409, corsHeaders);
    }
    if (paymentMode === 'live' && professionalAccount.provider_verification_status !== 'verified') {
      return jsonResponse({ error: 'Paystack must verify this payout destination before live payment.' }, 409, corsHeaders);
    }

    const providerAccountReference = typeof professionalAccount.provider_account_reference === 'string'
      ? professionalAccount.provider_account_reference.trim()
      : '';
    const allowTestMainAccount = paymentMode === 'sandbox' && Deno.env.get('ZANIA_PAY_ALLOW_TEST_MAIN_ACCOUNT') === 'true';
    if (!providerAccountReference && !allowTestMainAccount) {
      return jsonResponse({ error: 'This professional has not connected a payout account yet.' }, 409, corsHeaders);
    }

    const { data: share } = await serviceClient
      .from('commercial_document_shares')
      .select('share_token')
      .eq('document_id', invoiceId)
      .is('revoked_at', null)
      .maybeSingle();
    const appUrl = (Deno.env.get('PUBLIC_APP_URL') || 'https://www.planwithzania.com').replace(/\/$/, '');
    const callbackUrl = share?.share_token
      ? `${appUrl}/documents/share/${share.share_token}`
      : `${appUrl}/dashboard`;
    const requestedReference = buildPaystackReference('zania-pay');
    const initializePayload: Record<string, unknown> = {
      email: user.email,
      amount: toPaystackSubunit(totalCharged),
      currency: String(paymentOrder.currency || 'KES'),
      reference: requestedReference,
      channels: ['mobile_money'],
      callback_url: callbackUrl,
      metadata: JSON.stringify({
        zania_pay_order_id: orderId,
        invoice_id: invoiceId,
        invoice_payment_amount: amount,
        payer_processing_fee: processingFee,
        zania_service_fee: serviceFee,
        total_charged: totalCharged,
        fee_bearer: 'payer',
      }),
    };
    if (providerAccountReference) {
      initializePayload.subaccount = providerAccountReference;
      initializePayload.transaction_charge = toPaystackSubunit(processingFee + serviceFee);
      initializePayload.bearer = 'account';
    }

    const initialized = await initializePaystackTransaction(paystackConfig, initializePayload);
    const providerReference = initialized.reference;
    const phoneHint = phone ? `${phone.slice(0, 5)}•••${phone.slice(-3)}` : null;
    const { error: attemptError } = await serviceClient.from('zania_pay_attempts').insert({
      order_id: orderId,
      attempt_number: 1,
      status: 'submitted',
      provider_reference: providerReference,
      phone_hint: phoneHint,
    });
    if (attemptError && attemptError.code !== '23505') throw attemptError;

    const { error: updateError } = await serviceClient
      .from('zania_pay_orders')
      .update({
        status: 'awaiting_authorization',
        provider: 'paystack',
        provider_reference: providerReference,
        payer_processing_fee: processingFee,
        fee_bearer: 'payer',
        mode: paymentMode,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('payer_user_id', user.id);
    if (updateError) throw updateError;

    await logFunctionEvent({
      functionName: 'create-zania-pay-order',
      severity: 'info',
      status: 'success',
      eventType: 'payment_order_requested',
      message: paymentMode === 'live' ? 'Paystack Zania Pay order initiated.' : 'Paystack test Zania Pay order initiated.',
      userId: user.id,
      entityId: orderId,
      requestId,
      details: { invoiceId, paymentMethod, mode: paymentMode, feeBearer: 'payer', zaniaServiceFee: serviceFee },
    });

    return jsonResponse({
      mode: paymentMode,
      message: paymentMode === 'live'
        ? 'Secure Paystack checkout created.'
        : 'Paystack test checkout created. No real payment will be collected.',
      authorizationUrl: initialized.authorizationUrl,
      order: {
        id: orderId,
        invoiceId,
        amount,
        processingFee,
        serviceFee,
        totalCharged,
        currency: String(paymentOrder.currency || 'KES'),
        paymentMethod,
        status: 'awaiting_authorization',
        expiresAt: String(paymentOrder.expires_at),
      },
    }, 200, corsHeaders);
  } catch (error) {
    console.error('create-zania-pay-order failed:', error);
    const status = error instanceof AbuseProtectionError
      ? 429
      : isAuthSessionError(error)
        ? 401
        : 500;
    const message = error instanceof Error ? error.message : 'Could not start payment.';
    return jsonResponse({ error: message }, status, corsHeaders);
  }
});
