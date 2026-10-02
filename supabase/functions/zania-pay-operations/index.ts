import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  loadPaystackConfig,
  loadPaystackTestConfig,
  mapPaystackStatus,
  verifyPaystackTransaction,
} from '../_shared/paystack.ts';
import {
  parsePaystackSettlements,
  paystackTransactionsIncludeReference,
  type PaystackSettlementSummary,
} from '../_shared/paystackSettlement.ts';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function paystackConfig(mode: unknown) {
  return mode === 'live' ? loadPaystackConfig() : loadPaystackTestConfig();
}

async function paystackGet(config: ReturnType<typeof paystackConfig>, path: string) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${config.secretKey}` },
  });
  const raw = asRecord(await response.json().catch(() => ({})));
  if (!response.ok || raw.status !== true) {
    throw new Error(textValue(raw.message) || 'Could not fetch Paystack settlement status.');
  }
  return raw;
}

async function settlementContainsTransaction(
  config: ReturnType<typeof paystackConfig>,
  settlementId: string,
  transactionReference: string,
) {
  for (let page = 1; page <= 10; page += 1) {
    const raw = await paystackGet(
      config,
      `/settlement/${encodeURIComponent(settlementId)}/transactions?perPage=100&page=${page}`,
    );
    if (paystackTransactionsIncludeReference(raw.data, transactionReference)) return true;
    const meta = asRecord(raw.meta);
    const pageCount = numberValue(meta?.pageCount) ?? numberValue(meta?.page_count) ?? 1;
    if (page >= pageCount) return false;
  }
  return false;
}

async function findPaystackSettlement(
  config: ReturnType<typeof paystackConfig>,
  subaccount: string,
  transactionReference: string,
  paidAt: string,
): Promise<PaystackSettlementSummary | null> {
  const start = new Date(paidAt);
  if (Number.isNaN(start.getTime())) throw new Error('Payment date is unavailable for settlement reconciliation.');
  start.setUTCDate(start.getUTCDate() - 1);
  const from = start.toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  for (let page = 1; page <= 10; page += 1) {
    const query = new URLSearchParams({ subaccount, from, to, perPage: '100', page: String(page) });
    const raw = await paystackGet(config, `/settlement?${query.toString()}`);
    const settlements = parsePaystackSettlements(raw.data);
    for (const settlement of settlements) {
      if (await settlementContainsTransaction(config, settlement.id, transactionReference)) return settlement;
    }
    const meta = asRecord(raw.meta);
    const pageCount = numberValue(meta?.pageCount) ?? numberValue(meta?.page_count) ?? 1;
    if (page >= pageCount) return null;
  }
  return null;
}

async function requireAdmin(req: Request, supabaseUrl: string, anonKey: string) {
  const authorization = req.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw new Error('Admin authentication required.');
  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new Error('Admin authentication required.');
  const { error } = await client.rpc('admin_list_zania_pay_ledger', { _limit: 1 });
  if (error) throw new Error('Admin access required.');
  return client;
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-zania-reconcile-token',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
    if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error('Supabase service configuration is missing.');
    const body = asRecord(await req.json().catch(() => ({})));
    const action = textValue(body.action) || 'reconcile';
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    if (action === 'refund') {
      const authClient = await requireAdmin(req, supabaseUrl, anonKey);
      const orderId = textValue(body.orderId);
      const invoiceAmount = numberValue(body.invoiceAmount);
      const reason = textValue(body.reason);
      const idempotencyKey = textValue(body.idempotencyKey);
      if (!orderId || !invoiceAmount || !idempotencyKey) throw new Error('Order, refund amount, and retry key are required.');

      const { data: requested, error: requestError } = await authClient.rpc('admin_request_zania_pay_refund', {
        _order_id: orderId,
        _invoice_amount: invoiceAmount,
        _reason: reason || null,
        _idempotency_key: idempotencyKey,
      });
      if (requestError) throw requestError;
      const refund = asRecord(requested);
      const refundId = textValue(refund.id);
      const { data: claimed, error: claimError } = await serviceClient.rpc('claim_zania_pay_refund', { _refund_id: refundId });
      if (claimError) throw claimError;
      const claimedRefund = asRecord(claimed);
      if (!textValue(claimedRefund.id)) {
        return Response.json({ refund }, { headers: corsHeaders });
      }

      const { data: order, error: orderError } = await serviceClient.from('zania_pay_orders')
        .select('provider_reference, mode, currency').eq('id', orderId).single();
      if (orderError || !order?.provider_reference) throw orderError || new Error('Payment reference is missing.');
      const config = paystackConfig(order.mode);
      const response = await fetch(`${config.apiBaseUrl}/refund`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.secretKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction: order.provider_reference,
          amount: Math.round(Number(claimedRefund.amount) * 100),
          currency: order.currency,
          customer_note: reason || 'Refund from Zania',
          merchant_note: `Zania refund ${refundId}`,
        }),
      });
      const raw = asRecord(await response.json().catch(() => ({})));
      const data = asRecord(raw.data);
      if (!response.ok || raw.status !== true) {
        const message = textValue(raw.message) || 'Paystack refund request failed.';
        await serviceClient.rpc('fail_zania_pay_refund_request', { _refund_id: refundId, _message: message });
        throw new Error(message);
      }
      const providerRefundId = String(data.id ?? data.refund_reference ?? '');
      const providerStatus = textValue(data.status) || 'pending';
      await serviceClient.rpc('finish_zania_pay_refund_request', {
        _refund_id: refundId,
        _provider_reference: order.provider_reference,
        _provider_refund_id: providerRefundId,
        _provider_status: providerStatus,
      });
      if (providerStatus === 'processed') {
        await serviceClient.rpc('apply_zania_pay_refund_event', {
          _transaction_reference: order.provider_reference,
          _refund_reference: providerRefundId,
          _provider_status: providerStatus,
          _amount: Number(claimedRefund.amount),
        });
      }
      return Response.json({ refundId, status: providerStatus }, { headers: corsHeaders });
    }

    const expectedToken = Deno.env.get('ZANIA_PAY_RECONCILIATION_TOKEN')?.trim();
    const suppliedToken = req.headers.get('x-zania-reconcile-token')?.trim();
    if (!expectedToken || suppliedToken !== expectedToken) {
      await requireAdmin(req, supabaseUrl, anonKey);
    }

    const { data: claimed, error: claimError } = await serviceClient.rpc('claim_zania_pay_reconciliation_batch', { _limit: 20 });
    if (claimError) throw claimError;
    const orders = Array.isArray(claimed) ? claimed.map(asRecord) : [];
    const results: Record<string, unknown>[] = [];
    for (const order of orders) {
      const orderId = textValue(order.order_id);
      const reference = textValue(order.provider_reference);
      try {
        const payment = await verifyPaystackTransaction(paystackConfig(order.mode), reference);
        const mapped = mapPaystackStatus(payment.status);
        if (mapped === 'completed') {
          const rawData = asRecord(asRecord(payment.raw).data);
          const providerFee = Math.max(0, (numberValue(rawData.fees) ?? 0) / 100);
          const { error: finalizeError } = await serviceClient.rpc('finalize_zania_pay_order', {
            _provider: 'paystack', _provider_reference: reference,
            _amount: Number(order.charge_amount), _provider_fee: providerFee,
            _paid_at: payment.paidAt || new Date().toISOString(),
          });
          if (finalizeError) throw finalizeError;
          await serviceClient.rpc('finish_zania_pay_reconciliation', { _order_id: orderId, _status: 'verified', _error: null });
          await serviceClient.from('zania_pay_attempts').update({ status: 'succeeded', updated_at: new Date().toISOString() }).eq('order_id', orderId);
          await serviceClient.from('zania_pay_provider_events').update({ processing_status: 'processed', processing_error: null, processed_at: new Date().toISOString() }).eq('provider_reference', reference).eq('processing_status', 'failed');
          results.push({ orderId, status: 'paid' });
        } else if (mapped === 'failed' || mapped === 'cancelled' || mapped === 'reversed') {
          await serviceClient.rpc('fail_zania_pay_order', {
            _provider: 'paystack', _provider_reference: reference,
            _failure_code: `reconciliation.${mapped}`,
            _failure_message: payment.gatewayResponse || `Paystack reported ${mapped}.`,
          });
          await serviceClient.rpc('finish_zania_pay_reconciliation', { _order_id: orderId, _status: 'verified', _error: null });
          results.push({ orderId, status: mapped });
        } else {
          await serviceClient.rpc('finish_zania_pay_reconciliation', { _order_id: orderId, _status: 'pending', _error: null });
          results.push({ orderId, status: 'pending' });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        await serviceClient.rpc('finish_zania_pay_reconciliation', { _order_id: orderId, _status: 'failed', _error: message.slice(0, 500) });
        results.push({ orderId, status: 'failed', error: message });
      }
    }

    const { data: claimedRefunds, error: refundClaimError } = await serviceClient.rpc(
      'claim_zania_pay_refund_reconciliation_batch',
      { _limit: 20 },
    );
    if (refundClaimError) throw refundClaimError;
    const refunds = Array.isArray(claimedRefunds) ? claimedRefunds.map(asRecord) : [];
    const refundResults: Record<string, unknown>[] = [];
    for (const refund of refunds) {
      const refundId = textValue(refund.refund_id);
      const providerRefundId = textValue(refund.provider_refund_id);
      const transactionReference = textValue(refund.transaction_reference);
      try {
        const config = paystackConfig(refund.mode);
        const response = await fetch(`${config.apiBaseUrl}/refund/${encodeURIComponent(providerRefundId)}`, {
          headers: { Authorization: `Bearer ${config.secretKey}` },
        });
        const raw = asRecord(await response.json().catch(() => ({})));
        const data = asRecord(raw.data);
        if (!response.ok || raw.status !== true) {
          throw new Error(textValue(raw.message) || 'Could not fetch Paystack refund status.');
        }
        const providerStatus = textValue(data.status) || 'pending';
        const providerAmount = Math.max(0, (numberValue(data.amount) ?? 0) / 100);
        await serviceClient.rpc('apply_zania_pay_refund_event', {
          _transaction_reference: transactionReference,
          _refund_reference: providerRefundId,
          _provider_status: providerStatus,
          _amount: providerAmount,
        });
        const terminal = ['processed', 'failed', 'needs-attention'].includes(providerStatus.toLowerCase());
        await serviceClient.rpc('finish_zania_pay_refund_reconciliation', {
          _refund_id: refundId,
          _status: terminal ? 'verified' : 'pending',
          _error: null,
        });
        refundResults.push({ refundId, status: providerStatus });
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        await serviceClient.rpc('finish_zania_pay_refund_reconciliation', {
          _refund_id: refundId,
          _status: 'failed',
          _error: message.slice(0, 500),
        });
        refundResults.push({ refundId, status: 'failed', error: message });
      }
    }

    const { data: claimedSettlements, error: settlementClaimError } = await serviceClient.rpc(
      'claim_zania_pay_settlement_reconciliation_batch',
      { _limit: 20 },
    );
    if (settlementClaimError) throw settlementClaimError;
    const settlements = Array.isArray(claimedSettlements) ? claimedSettlements.map(asRecord) : [];
    const settlementResults: Record<string, unknown>[] = [];
    for (const settlement of settlements) {
      const settlementId = textValue(settlement.settlement_id);
      try {
        const matched = await findPaystackSettlement(
          paystackConfig(settlement.mode),
          textValue(settlement.provider_account_reference),
          textValue(settlement.provider_reference),
          textValue(settlement.payment_paid_at),
        );
        await serviceClient.rpc('finish_zania_pay_settlement_reconciliation', {
          _settlement_id: settlementId,
          _status: matched?.status ?? 'pending',
          _provider_settlement_reference: matched?.id ?? null,
          _expected_at: matched?.settlementDate ?? null,
          _paid_at: matched?.paidAt ?? null,
          _error: null,
        });
        settlementResults.push({ settlementId, status: matched?.status ?? 'pending' });
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error);
        await serviceClient.rpc('finish_zania_pay_settlement_reconciliation', {
          _settlement_id: settlementId,
          _status: 'pending',
          _provider_settlement_reference: null,
          _expected_at: null,
          _paid_at: null,
          _error: message.slice(0, 500),
        });
        settlementResults.push({ settlementId, status: 'pending', error: message });
      }
    }
    return Response.json({
      checked: results.length + refundResults.length + settlementResults.length,
      paymentChecked: results.length,
      refundChecked: refundResults.length,
      settlementChecked: settlementResults.length,
      results,
      refundResults,
      settlementResults,
    }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return Response.json({ error: message || 'Zania Pay operation failed.' }, { status: 400, headers: corsHeaders });
  }
});
