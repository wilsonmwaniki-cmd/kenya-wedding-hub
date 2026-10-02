import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createCorsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Retain this endpoint as an explicit tombstone so stale clients cannot
  // initiate a Pesapal payment. Historical callbacks are handled separately.
  return new Response(JSON.stringify({
    error: 'Pesapal checkout is no longer available. Please use Paystack.',
    code: 'provider_retired',
  }), {
    status: 410,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
