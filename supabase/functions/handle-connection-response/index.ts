import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function hmacHex(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    .then(k => crypto.subtle.sign('HMAC', k, enc.encode(data)))
    .then(sig => [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join(''));
}

function htmlPage(title: string, message: string, success: boolean) {
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
    <body style="font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9f6f2;">
      <div style="max-width:440px;text-align:center;padding:40px;">
        <div style="font-size:48px;margin-bottom:16px;">${success ? '✅' : '⚠️'}</div>
        <h1 style="color:#4a4a4a;font-size:22px;margin-bottom:12px;">${title}</h1>
        <p style="color:#777;line-height:1.6;">${message}</p>
        <p style="margin-top:24px;"><a href="${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app') || '#'}" 
          style="color:#8B7355;text-decoration:underline;">Go to Dashboard</a></p>
      </div>
    </body>
    </html>
  `, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const requestId = url.searchParams.get('id');
  const action = url.searchParams.get('action');
  const token = url.searchParams.get('token');
  const requestType = url.searchParams.get('type') || 'vendor'; // 'vendor' or 'planner'

  if (!requestId || !action || !token) {
    return htmlPage('Invalid Link', 'This link is missing required parameters.', false);
  }

  if (action !== 'accept' && action !== 'decline') {
    return htmlPage('Invalid Action', 'The action must be either accept or decline.', false);
  }

  // Verify HMAC token
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const expectedToken = await hmacHex(secret, `${requestId}:${action}`);
  if (token !== expectedToken) {
    return htmlPage('Invalid Link', 'This link has expired or is invalid.', false);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    secret,
  );

  if (requestType === 'planner') {
    // Handle planner link request
    const { data: linkReq, error: fetchErr } = await supabase
      .from('planner_link_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchErr || !linkReq) {
      return htmlPage('Request Not Found', 'This connection request no longer exists.', false);
    }

    if (linkReq.status !== 'pending') {
      return htmlPage('Already Handled', `This request was already ${linkReq.status}.`, false);
    }

    if (action === 'accept') {
      // Get couple name
      const { data: coupleProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', linkReq.couple_user_id)
        .single();

      // Create planner_client record
      await supabase.from('planner_clients').insert({
        planner_user_id: linkReq.planner_user_id,
        client_name: coupleProfile?.full_name || 'Client',
        linked_user_id: linkReq.couple_user_id,
      });

      await supabase.from('planner_link_requests').update({ status: 'approved' }).eq('id', requestId);
      return htmlPage('Request Accepted! 🎉', `You've accepted the connection. The couple's wedding is now linked to your dashboard.`, true);
    } else {
      await supabase.from('planner_link_requests').update({ status: 'rejected' }).eq('id', requestId);
      return htmlPage('Request Declined', 'The connection request has been declined.', true);
    }
  } else {
    // Handle vendor connection request
    const { data: connReq, error: fetchErr } = await supabase
      .from('vendor_connection_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchErr || !connReq) {
      return htmlPage('Request Not Found', 'This connection request no longer exists.', false);
    }

    if (connReq.status !== 'pending') {
      return htmlPage('Already Handled', `This request was already ${connReq.status}.`, false);
    }

    if (action === 'accept') {
      // Get vendor listing details
      const { data: listing } = await supabase
        .from('vendor_listings')
        .select('business_name, category, email, phone')
        .eq('id', connReq.vendor_listing_id)
        .single();

      // Auto-add vendor to the requester's vendor list
      await supabase.from('vendors').insert({
        user_id: connReq.requester_user_id,
        name: listing?.business_name || 'Vendor',
        category: listing?.category || 'Other',
        email: listing?.email || null,
        phone: listing?.phone || null,
        status: 'booked',
        vendor_listing_id: connReq.vendor_listing_id,
        client_id: connReq.client_id || null,
      });

      await supabase.from('vendor_connection_requests').update({ status: 'accepted' }).eq('id', requestId);
      return htmlPage('Connection Accepted! 🎉', `You've accepted the request. The couple can now see your contact details and you've been added to their vendor list.`, true);
    } else {
      await supabase.from('vendor_connection_requests').update({ status: 'declined' }).eq('id', requestId);
      return htmlPage('Request Declined', 'The connection request has been declined.', true);
    }
  }
});
