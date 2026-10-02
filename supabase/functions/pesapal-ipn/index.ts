import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { fetchPesapalToken, getPesapalTransactionStatus, loadPesapalConfig, mapPesapalStatus } from '../_shared/pesapal.ts';
import { createCorsHeaders } from '../_shared/cors.ts';

function readIpnPayload(req: Request, body: Record<string, unknown> | null) {
  const url = new URL(req.url);

  return {
    orderTrackingId:
      url.searchParams.get('OrderTrackingId')
      || (typeof body?.OrderTrackingId === 'string' ? body.OrderTrackingId : null),
    orderMerchantReference:
      url.searchParams.get('OrderMerchantReference')
      || (typeof body?.OrderMerchantReference === 'string' ? body.OrderMerchantReference : null),
    orderNotificationType:
      url.searchParams.get('OrderNotificationType')
      || (typeof body?.OrderNotificationType === 'string' ? body.OrderNotificationType : null),
  };
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Supabase service configuration is missing.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rawBody = req.method === 'POST' ? await req.json().catch(() => null) : null;
  const payload = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
    ? rawBody as Record<string, unknown>
    : null;
  const parsed = readIpnPayload(req, payload);

  if (!parsed.orderTrackingId) {
    return new Response(JSON.stringify({ error: 'Missing OrderTrackingId.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const config = loadPesapalConfig();
  const token = await fetchPesapalToken(config);
  const statusResult = await getPesapalTransactionStatus(config, token.token, parsed.orderTrackingId);
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
      raw_response: {
        ipn: payload,
        transaction_status: statusResult.raw,
      },
    })
    .eq('provider', 'pesapal')
    .eq('provider_reference', parsed.orderTrackingId);

  return new Response(JSON.stringify({
    orderNotificationType: parsed.orderNotificationType ?? 'IPNCHANGE',
    orderTrackingId: parsed.orderTrackingId,
    orderMerchantReference: parsed.orderMerchantReference,
    status: 200,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
