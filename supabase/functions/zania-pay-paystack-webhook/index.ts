import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { paystackEventReference } from '../_shared/paystackEventReference.ts';
import {
  assertPaystackPaymentMatches,
  loadPaystackConfig,
  loadPaystackTestConfig,
  mapPaystackStatus,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
} from '../_shared/paystack.ts';

type PaystackEvent = {
  event?: unknown;
  data?: Record<string, unknown>;
};

function textValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let serviceClient: ReturnType<typeof createClient> | null = null;
  let providerEventId = '';

  try {
    const rawBody = await req.text();
    const event = JSON.parse(rawBody) as PaystackEvent;
    const eventType = textValue(event.event) || 'unknown';
    const eventTransaction = event.data?.transaction;
    const eventTransactionRecord = eventTransaction && typeof eventTransaction === 'object' && !Array.isArray(eventTransaction)
      ? eventTransaction as Record<string, unknown>
      : null;
    const reference = paystackEventReference(event.data)
      || textValue(event.data?.transaction_reference)
      || textValue(eventTransactionRecord?.reference)
      || (typeof eventTransaction === 'string' ? eventTransaction : '');
    const transactionId = textValue(event.data?.id) || String(numberValue(event.data?.id) ?? '');
    const payloadHash = await sha256(rawBody);
    providerEventId = `${eventType}:${transactionId || reference || payloadHash}`;

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase service configuration is missing.');
    serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: order, error: orderError } = reference
      ? await serviceClient
        .from('zania_pay_orders')
        .select('id, amount, charge_amount, currency, status, mode')
        .eq('provider', 'paystack')
        .eq('provider_reference', reference)
        .maybeSingle()
      : { data: null, error: null };
    if (orderError) throw orderError;

    const candidateConfigs = order?.mode === 'live'
      ? [loadPaystackConfig()]
      : order?.mode === 'sandbox'
        ? [loadPaystackTestConfig()]
        : [loadPaystackConfig(), loadPaystackTestConfig()];
    const signature = req.headers.get('x-paystack-signature');
    let config = candidateConfigs[0];
    let validSignature = false;
    for (const candidate of candidateConfigs) {
      if (await verifyPaystackWebhookSignature(rawBody, signature, candidate.secretKey)) {
        config = candidate;
        validSignature = true;
        break;
      }
    }
    if (!validSignature) return new Response('Invalid signature', { status: 401 });

    const { data: inserted, error: eventError } = await serviceClient.rpc('record_zania_pay_provider_event', {
      _provider: 'paystack',
      _provider_event_id: providerEventId,
      _event_type: eventType,
      _provider_reference: reference || null,
      _payload_hash: payloadHash,
      _payload: event,
    });
    if (eventError) throw eventError;

    if (!inserted) {
      const { data: existing, error: existingError } = await serviceClient
        .from('zania_pay_provider_events')
        .select('processing_status')
        .eq('provider', 'paystack')
        .eq('provider_event_id', providerEventId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing?.processing_status !== 'failed') return new Response('OK', { status: 200 });
    }

    if (eventType.startsWith('refund.')) {
      const transaction = event.data?.transaction;
      const transactionRecord = transaction && typeof transaction === 'object' && !Array.isArray(transaction)
        ? transaction as Record<string, unknown>
        : null;
      const transactionReference = textValue(event.data?.transaction_reference)
        || textValue(transactionRecord?.reference)
        || (typeof transaction === 'string' ? transaction : '');
      const refundReference = textValue(event.data?.refund_reference) || transactionId;
      const providerStatus = textValue(event.data?.status) || eventType.replace('refund.', '');
      const refundAmount = Math.max(0, (numberValue(event.data?.amount) ?? 0) / 100);
      const { error: refundError } = await serviceClient.rpc('apply_zania_pay_refund_event', {
        _transaction_reference: transactionReference,
        _refund_reference: refundReference,
        _provider_status: providerStatus,
        _amount: refundAmount,
      });
      if (refundError) throw refundError;
      await serviceClient.from('zania_pay_provider_events').update({
        processing_status: 'processed', processing_error: null, processed_at: new Date().toISOString(),
      }).eq('provider', 'paystack').eq('provider_event_id', providerEventId);
      return new Response('OK', { status: 200 });
    }

    if (eventType.startsWith('charge.dispute.')) {
      const transaction = event.data?.transaction;
      const transactionRecord = transaction && typeof transaction === 'object' && !Array.isArray(transaction)
        ? transaction as Record<string, unknown>
        : null;
      const transactionReference = textValue(event.data?.transaction_reference) || textValue(transactionRecord?.reference);
      const disputeReference = transactionId || textValue(event.data?.reference);
      const { error: disputeError } = await serviceClient.rpc('apply_zania_pay_dispute_event', {
        _transaction_reference: transactionReference,
        _dispute_reference: disputeReference,
        _event_type: eventType,
        _reason: textValue(event.data?.reason) || null,
        _evidence_due_at: textValue(event.data?.due_at) || null,
        _metadata: event.data || {},
      });
      if (disputeError) throw disputeError;
      await serviceClient.from('zania_pay_provider_events').update({
        processing_status: 'processed', processing_error: null, processed_at: new Date().toISOString(),
      }).eq('provider', 'paystack').eq('provider_event_id', providerEventId);
      return new Response('OK', { status: 200 });
    }

    if (!reference) {
      await serviceClient.from('zania_pay_provider_events').update({
        processing_status: 'ignored',
        processed_at: new Date().toISOString(),
      }).eq('provider', 'paystack').eq('provider_event_id', providerEventId);
      return new Response('OK', { status: 200 });
    }

    if (!order) {
      await serviceClient.from('zania_pay_provider_events').update({
        processing_status: 'ignored',
        processed_at: new Date().toISOString(),
      }).eq('provider', 'paystack').eq('provider_event_id', providerEventId);
      return new Response('OK', { status: 200 });
    }

    if (eventType !== 'charge.success') {
      if (eventType === 'charge.failed') {
        const failureMessage = textValue(event.data?.gateway_response) || 'Payment was not completed.';
        const { error: failureError } = await serviceClient.rpc('fail_zania_pay_order', {
          _provider: 'paystack',
          _provider_reference: reference,
          _failure_code: eventType,
          _failure_message: failureMessage,
        });
        if (failureError) throw failureError;
        const { error: reconciliationError } = await serviceClient.rpc('finish_zania_pay_reconciliation', {
          _order_id: order.id,
          _status: 'verified',
          _error: null,
        });
        if (reconciliationError) throw reconciliationError;
      }

      await serviceClient.from('zania_pay_provider_events').update({
        processing_status: eventType === 'charge.failed' ? 'processed' : 'ignored',
        processed_at: new Date().toISOString(),
      }).eq('provider', 'paystack').eq('provider_event_id', providerEventId);
      return new Response('OK', { status: 200 });
    }

    const payment = await verifyPaystackTransaction(config, reference);
    assertPaystackPaymentMatches(payment, {
      reference,
      amountKes: Number(order.charge_amount),
      currency: String(order.currency),
    });
    if (mapPaystackStatus(payment.status) !== 'completed') {
      throw new Error('Paystack has not confirmed this payment.');
    }

    const rawData = payment.raw && typeof payment.raw === 'object' && !Array.isArray(payment.raw)
      ? (payment.raw as Record<string, unknown>).data
      : null;
    const verifiedData = rawData && typeof rawData === 'object' && !Array.isArray(rawData)
      ? rawData as Record<string, unknown>
      : null;
    const providerFee = Math.max(0, (numberValue(verifiedData?.fees) ?? 0) / 100);

    const { error: finalizeError } = await serviceClient.rpc('finalize_zania_pay_order', {
      _provider: 'paystack',
      _provider_reference: reference,
      _amount: Number(order.charge_amount),
      _provider_fee: providerFee,
      _paid_at: payment.paidAt || new Date().toISOString(),
    });
    if (finalizeError) throw finalizeError;

    const { error: reconciliationError } = await serviceClient.rpc('finish_zania_pay_reconciliation', {
      _order_id: order.id,
      _status: 'verified',
      _error: null,
    });
    if (reconciliationError) throw reconciliationError;

    await serviceClient.from('zania_pay_attempts').update({
      status: 'succeeded',
      updated_at: new Date().toISOString(),
    }).eq('provider_reference', reference);

    await serviceClient.from('zania_pay_provider_events').update({
      processing_status: 'processed',
      processing_error: null,
      processed_at: new Date().toISOString(),
    }).eq('provider', 'paystack').eq('provider_event_id', providerEventId);

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('zania-pay-paystack-webhook failed:', error);
    const processingError = error instanceof Error
      ? error.message
      : JSON.stringify(error);
    if (serviceClient && providerEventId) {
      await serviceClient.from('zania_pay_provider_events').update({
        processing_status: 'failed',
        processing_error: processingError || 'Webhook processing failed.',
        retry_count: 1,
        last_retry_at: new Date().toISOString(),
        next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      }).eq('provider', 'paystack').eq('provider_event_id', providerEventId);
    }
    return new Response('Webhook processing failed', { status: 500 });
  }
});
