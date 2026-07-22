import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { activateCoupleCheckout, activateProfessionalCheckout } from '../_shared/checkoutEntitlements.ts';
import { loadPricingCheckoutConfig } from '../_shared/pricingCatalog.ts';
import {
  assertPaystackPaymentMatches,
  loadPaystackConfig,
  mapPaystackStatus,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
} from '../_shared/paystack.ts';

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const rawBody = await req.text();
    const config = loadPaystackConfig();
    const signatureValid = await verifyPaystackWebhookSignature(
      rawBody,
      req.headers.get('x-paystack-signature'),
      config.secretKey,
    );
    if (!signatureValid) return new Response('Invalid signature', { status: 401 });

    const event = JSON.parse(rawBody) as { event?: unknown; data?: { reference?: unknown } };
    if (event.event !== 'charge.success') return new Response('OK', { status: 200 });
    const reference = typeof event.data?.reference === 'string' ? event.data.reference.trim() : '';
    if (!reference) return new Response('Missing reference', { status: 400 });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase service configuration is missing.');
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: transaction, error } = await serviceClient
      .from('payment_transactions')
      .select('*')
      .eq('provider', 'paystack')
      .eq('provider_reference', reference)
      .maybeSingle();
    if (error) throw error;
    if (!transaction) return new Response('OK', { status: 200 });

    const payment = await verifyPaystackTransaction(config, reference);
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
      raw_response: { webhook: event, transaction: payment.raw },
    }).eq('id', transaction.id);

    if (status === 'completed') {
      const pricing = await loadPricingCheckoutConfig(serviceClient);
      const paymentContext = {
        provider: 'paystack',
        reference,
        paidAt: payment.paidAt || new Date().toISOString(),
      };

      if (transaction.audience === 'couple') {
        const mapping = pricing.coupleCheckoutMap[transaction.lookup_key];
        if (!mapping) throw new Error(`Unsupported couple checkout lookup key: ${transaction.lookup_key}`);
        await activateCoupleCheckout(serviceClient, transaction, mapping, paymentContext);
      } else if (transaction.audience === 'planner' || transaction.audience === 'vendor') {
        const mapping = pricing.professionalCheckoutMap[transaction.lookup_key];
        if (!mapping) throw new Error(`Unsupported professional checkout lookup key: ${transaction.lookup_key}`);
        await activateProfessionalCheckout(serviceClient, transaction, mapping, paymentContext);
      }
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('paystack-webhook error:', error);
    return new Response('Webhook processing failed', { status: 500 });
  }
});
