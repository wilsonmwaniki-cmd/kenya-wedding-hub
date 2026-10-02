import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createCorsHeaders } from '../_shared/cors.ts';
import { assertActiveAuthSession, isAuthSessionError } from '../_shared/sessionGuard.ts';
import { DEMO_EXTERNAL_ACTION_MESSAGE, isTemporaryDemoUser } from '../_shared/demoGuard.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Zania <hello@planwithzania.com>';
const APP_BASE_URL = (Deno.env.get('PUBLIC_APP_URL') ?? Deno.env.get('SITE_URL') ?? 'https://www.planwithzania.com').replace(/\/$/, '');

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function verificationCode() {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return String(100000 + (random[0] % 900000));
}

function additionalRecipientEmails(metadata: unknown, primaryEmail: string) {
  const raw = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>).additionalRecipientEmails
    : [];
  const candidates = Array.isArray(raw) ? raw : [];
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (candidates.some((email) => typeof email !== 'string' || !pattern.test(email.trim()))) {
    return { emails: [] as string[], error: 'One of the additional recipient emails is invalid.' };
  }
  const emails = [...new Set(candidates.map((email) => String(email).trim().toLowerCase()).filter((email) => email && email !== primaryEmail))];
  if (emails.length > 10) return { emails: [] as string[], error: 'A contract can have up to 10 additional recipients.' };
  return { emails, error: null };
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    return json(500, { error: 'Contract email is not configured.' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(401, { error: 'Sign in before sending a contract.' });

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) return json(401, { error: 'Sign in before sending a contract.' });
    if (isTemporaryDemoUser(authData.user)) return json(403, { error: DEMO_EXTERNAL_ACTION_MESSAGE, code: 'demo_action_blocked' });
    await assertActiveAuthSession(serviceClient, authHeader, authData.user.id);

    const payload: unknown = await req.json().catch(() => ({}));
    const contractId = payload && typeof payload === 'object' && 'contractId' in payload && typeof payload.contractId === 'string'
      ? payload.contractId
      : '';
    if (!contractId) return json(400, { error: 'Choose a contract to send.' });

    const { data: shareToken, error: sendError } = await authClient.rpc('mark_professional_contract_sent', {
      _contract_id: contractId,
    });
    if (sendError || !shareToken) return json(400, { error: sendError?.message ?? 'Could not prepare the contract.' });

    const { data: contract, error: contractError } = await serviceClient
      .from('professional_contracts')
      .select('id, user_id, title, recipient_name, recipient_email, event_date, content_version, locked_hash, locked_snapshot, metadata')
      .eq('id', contractId)
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (contractError || !contract) return json(404, { error: 'Contract not found.' });

    const recipientEmail = String(contract.recipient_email ?? '').trim().toLowerCase();
    if (!recipientEmail) return json(400, { error: 'Add the client email before sending.' });
    const additionalRecipients = additionalRecipientEmails(contract.metadata, recipientEmail);
    if (additionalRecipients.error) return json(400, { error: additionalRecipients.error });

    const { data: share, error: shareError } = await serviceClient
      .from('professional_contract_shares')
      .select('id, expires_at')
      .eq('contract_id', contractId)
      .eq('share_token', shareToken)
      .single();
    if (shareError || !share) return json(500, { error: 'Could not prepare the signing link.' });

    const code = verificationCode();
    const codeHash = await sha256(code);
    const codeExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: otpError } = await serviceClient.from('professional_contract_signing_otps').upsert({
      contract_id: contractId,
      share_id: share.id,
      recipient_email: recipientEmail,
      code_hash: codeHash,
      expires_at: codeExpiresAt,
      verified_at: null,
      attempt_count: 0,
    }, { onConflict: 'contract_id' });
    if (otpError) return json(500, { error: 'Could not prepare client verification.' });

    const snapshot = (contract.locked_snapshot ?? {}) as Record<string, unknown>;
    const issuerName = String(snapshot.issuerName ?? 'Mwaniki Weddings');
    const issuerEmail = typeof snapshot.issuerEmail === 'string' ? snapshot.issuerEmail : null;
    const clientName = String(contract.recipient_name ?? 'there');
    const contractTitle = String(contract.title ?? 'Service agreement');
    const signingUrl = `${APP_BASE_URL}/contracts/share/${shareToken}`;
    const eventDate = contract.event_date
      ? new Date(`${contract.event_date}T00:00:00`).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
      : null;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `contract-${contractId}-v${contract.content_version}-${codeHash.slice(0, 16)}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [recipientEmail],
        ...(issuerEmail ? { reply_to: issuerEmail } : {}),
        subject: `${issuerName} sent you ${contractTitle}`,
        html: `
          <div style="margin:0;background:#f4f0ea;padding:32px 16px;color:#29231f;font-family:Arial,sans-serif">
            <div style="max-width:600px;margin:0 auto;background:#fffdf9;border:1px solid #ded6cc">
              <div style="padding:32px 32px 20px;border-bottom:3px solid #c96f48">
                <div style="font-size:12px;letter-spacing:2px;color:#8a7d73">MWANIKI WEDDINGS</div>
                <h1 style="margin:14px 0 0;font-family:Georgia,serif;font-size:28px;line-height:1.25">${escapeHtml(contractTitle)}</h1>
              </div>
              <div style="padding:28px 32px;line-height:1.65">
                <p>Hello ${escapeHtml(clientName)},</p>
                <p><strong>${escapeHtml(issuerName)}</strong> has sent you a photography agreement to review and sign.</p>
                ${eventDate ? `<p><strong>Event date:</strong> ${escapeHtml(eventDate)}</p>` : ''}
                <p style="margin:26px 0"><a href="${signingUrl}" style="display:inline-block;background:#c96f48;color:white;text-decoration:none;padding:12px 20px;border-radius:4px;font-weight:600">Review and sign</a></p>
                <div style="margin:24px 0;padding:18px;border:1px solid #ded6cc;background:#faf8f5">
                  <div style="font-size:12px;letter-spacing:1.4px;color:#8a7d73">VERIFICATION CODE</div>
                  <div style="margin-top:8px;font-size:28px;font-weight:700;letter-spacing:6px">${code}</div>
                  <div style="margin-top:8px;font-size:13px;color:#6f645d">Enter this code when signing. It expires in 7 days.</div>
                </div>
                <p style="font-size:14px;color:#6f645d">You do not need a Zania account. Keep this email and signing link private.</p>
              </div>
              <div style="padding:18px 32px;border-top:1px solid #ded6cc;font-size:12px;color:#8a7d73">Sent securely through Zania for ${escapeHtml(issuerName)}.</div>
            </div>
          </div>
        `,
      }),
    });

    const resend = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('send-professional-contract Resend error:', resend);
      return json(502, { error: 'The contract is ready, but the email could not be sent. Try again.' });
    }

    if (additionalRecipients.emails.length > 0) {
      const copyResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `contract-copy-${contractId}-v${contract.content_version}-${codeHash.slice(0, 16)}`,
        },
        body: JSON.stringify({
          from: RESEND_FROM_EMAIL,
          to: additionalRecipients.emails,
          ...(issuerEmail ? { reply_to: issuerEmail } : {}),
          subject: `${issuerName} shared ${contractTitle} with you`,
          html: `<div style="margin:0;background:#f4f0ea;padding:32px 16px;color:#29231f;font-family:Arial,sans-serif"><div style="max-width:600px;margin:0 auto;background:#fffdf9;border:1px solid #ded6cc"><div style="padding:32px;border-bottom:3px solid #c96f48"><h1 style="margin:0;font-family:Georgia,serif;font-size:28px">${escapeHtml(contractTitle)}</h1></div><div style="padding:28px 32px;line-height:1.65"><p>Hello,</p><p><strong>${escapeHtml(issuerName)}</strong> shared this agreement with you for review.</p><p style="margin:26px 0"><a href="${signingUrl}" style="display:inline-block;background:#c96f48;color:white;text-decoration:none;padding:12px 20px;border-radius:4px;font-weight:600">Review agreement</a></p><p style="font-size:14px;color:#6f645d">This is a review copy. Only ${escapeHtml(clientName)} can sign the agreement using their verification code.</p></div></div></div>`,
        }),
      });
      if (!copyResponse.ok) {
        console.error('send-professional-contract copy recipients error:', await copyResponse.json().catch(() => ({})));
        return json(502, { error: 'The contract was sent to the main client, but the additional recipients could not be emailed. Try again.' });
      }
    }

    const { error: eventError } = await serviceClient.from('professional_contract_events').insert({
      contract_id: contractId,
      event_type: 'email_sent',
      actor_source: 'owner',
      actor_name: issuerName,
      actor_email: authData.user.email ?? null,
      payload: {
        resend_email_id: resend?.id ?? null,
        recipient_email: recipientEmail,
        additional_recipient_emails: additionalRecipients.emails,
        content_version: contract.content_version,
        document_hash: contract.locked_hash,
      },
    });
    if (eventError) console.error('send-professional-contract audit event error:', eventError.message);

    return json(200, {
      success: true,
      recipientEmail,
      recipientEmails: [recipientEmail, ...additionalRecipients.emails],
      shareUrl: signingUrl,
      expiresAt: share.expires_at,
    });
  } catch (error) {
    if (isAuthSessionError(error)) return json(error.status, { error: error.message });
    console.error('send-professional-contract error:', error);
    return json(500, { error: error instanceof Error ? error.message : 'Could not send the contract.' });
  }
});
