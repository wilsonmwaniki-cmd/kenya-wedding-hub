import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Zania <hello@planwithzania.com>';
const SITE_URL = (Deno.env.get('PUBLIC_SITE_URL') ?? 'https://www.planwithzania.com').replace(/\/$/, '');

type Delivery = {
  delivery_id: string;
  recipient_user_id: string;
  recipient_email: string;
  recipient_name: string;
  recipient_role: 'couple' | 'planner';
  category_key: string;
  wedding_name: string;
  action_path: string;
  attempt_number: number;
};

const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const suppliedKey = request.headers.get('apikey') ?? '';
  const suppliedKeyIsBuiltIn = Boolean(SUPABASE_ANON_KEY && suppliedKey === SUPABASE_ANON_KEY);
  const suppliedKeyIsProjectKey = suppliedKeyIsBuiltIn || (Boolean(suppliedKey) && await fetch(
    `${SUPABASE_URL}/auth/v1/settings`,
    { headers: { apikey: suppliedKey } },
  ).then((response) => response.ok).catch(() => false));

  if (!suppliedKeyIsProjectKey) {
    return json(401, { error: 'Unauthorized' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Supabase service configuration is missing' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: matchSummary, error: matchingError } = await admin.rpc(
    'process_proactive_provider_matches',
    { batch_limit: 50 },
  );
  if (matchingError) {
    console.error('process_proactive_provider_matches failed', matchingError);
    return json(500, { error: 'Provider matching failed' });
  }

  if (!RESEND_API_KEY) {
    return json(200, {
      matching: matchSummary,
      email: 'disabled',
    });
  }

  const { data, error: claimError } = await admin.rpc(
    'claim_lead_match_notification_deliveries',
    { batch_limit: 25 },
  );
  if (claimError) {
    console.error('claim_lead_match_notification_deliveries failed', claimError);
    return json(500, { error: 'Could not claim notification deliveries' });
  }

  const deliveries = (data ?? []) as Delivery[];
  let sent = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    const destination = `${SITE_URL}${delivery.action_path}`;
    const name = escapeHtml(delivery.recipient_name || 'there');
    const category = escapeHtml(delivery.category_key);
    const weddingName = escapeHtml(delivery.wedding_name);
    const roleLine = delivery.recipient_role === 'planner'
      ? `You received this because the couple allowed you to manage vendors for ${weddingName}.`
      : `Zania found a provider that fits ${weddingName}.`;

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Idempotency-Key': `provider-match-${delivery.delivery_id}`,
        },
        body: JSON.stringify({
          from: RESEND_FROM_EMAIL,
          to: [delivery.recipient_email],
          subject: `A suitable ${delivery.category_key} is now available`,
          html: `
            <div style="background:#fbf7f2;padding:32px 16px;font-family:Arial,sans-serif;color:#2c211c">
              <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5d8cc;padding:32px">
                <p style="margin:0 0 20px;color:#c96f48;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Zania provider matching</p>
                <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25">A ${category} match is available</h1>
                <p style="margin:0 0 12px;font-size:16px;line-height:1.6">Hello ${name},</p>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.6">${roleLine} Their contact details remain private until the couple chooses to share them.</p>
                <a href="${destination}" style="display:inline-block;background:#c96f48;color:#ffffff;text-decoration:none;padding:13px 20px;font-weight:700">View the match</a>
                <p style="margin:24px 0 0;color:#7d7069;font-size:13px;line-height:1.5">You will not receive another alert for this same search.</p>
              </div>
            </div>
          `,
        }),
      });

      const resendPayload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(resendPayload?.message ?? 'Email delivery failed');

      const { error: completeError } = await admin.rpc(
        'complete_lead_match_notification_delivery',
        {
          delivery_id_input: delivery.delivery_id,
          delivered: true,
          resend_email_id_input: resendPayload?.id ?? null,
          error_message_input: null,
        },
      );
      if (completeError) throw completeError;
      sent += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : 'Unknown delivery error';
      console.error('lead match email failed', { deliveryId: delivery.delivery_id, message });
      await admin.rpc('complete_lead_match_notification_delivery', {
        delivery_id_input: delivery.delivery_id,
        delivered: false,
        resend_email_id_input: null,
        error_message_input: message,
      });
    }
  }

  return json(200, {
    matching: matchSummary,
    claimed: deliveries.length,
    sent,
    failed,
  });
});
