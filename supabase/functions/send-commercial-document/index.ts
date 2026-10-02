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

function documentTypeLabel(value: string) {
  if (value === 'invoice') return 'Invoice';
  if (value === 'receipt') return 'Receipt';
  return 'Quote';
}

function formatAmount(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function emailRecipients(primaryEmail: unknown, additionalEmails: unknown) {
  const primary = String(primaryEmail ?? '').trim().toLowerCase();
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!pattern.test(primary)) return { emails: [] as string[], error: 'Enter a valid client email before sending.' };
  const extras = Array.isArray(additionalEmails) ? additionalEmails : [];
  const invalidExtra = extras.some((email) => typeof email !== 'string' || !pattern.test(email.trim()));
  if (invalidExtra) return { emails: [] as string[], error: 'One of the additional recipient emails is invalid.' };
  const emails = [...new Set([primary, ...extras.map((email) => String(email).trim().toLowerCase()).filter((email) => email !== primary)])];
  if (emails.length > 11) return { emails: [] as string[], error: 'A document can have up to 10 additional recipients.' };
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
    return json(500, { error: 'Document email is not configured.' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(401, { error: 'Sign in before sending a document.' });

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) return json(401, { error: 'Sign in before sending a document.' });
    if (isTemporaryDemoUser(authData.user)) return json(403, { error: DEMO_EXTERNAL_ACTION_MESSAGE, code: 'demo_action_blocked' });
    await assertActiveAuthSession(serviceClient, authHeader, authData.user.id);

    const payload: unknown = await req.json().catch(() => ({}));
    const documentId = payload && typeof payload === 'object' && 'documentId' in payload && typeof payload.documentId === 'string'
      ? payload.documentId
      : '';
    if (!documentId) return json(400, { error: 'Choose a document to send.' });

    const { data: document, error: documentError } = await authClient
      .from('commercial_documents')
      .select('id, user_id, document_type, document_number, title, status, currency, recipient_name, recipient_email, total_amount, due_date, metadata')
      .eq('id', documentId)
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (documentError || !document) return json(404, { error: 'Document not found.' });

    const documentType = String(document.document_type ?? 'quote');
    if ((documentType === 'quote' && ['rejected', 'expired'].includes(String(document.status))) ||
        (documentType !== 'quote' && String(document.status) === 'void')) {
      return json(400, { error: `This ${documentType} can no longer be sent.` });
    }

    const recipientEmail = String(document.recipient_email ?? '').trim().toLowerCase();
    if (!recipientEmail) return json(400, { error: 'Add the client email before sending.' });
    const recipientList = emailRecipients(recipientEmail, (document.metadata as Record<string, unknown> | null)?.additionalRecipientEmails);
    if (recipientList.error) return json(400, { error: recipientList.error });
    const recipientEmails = recipientList.emails;

    const { data: ensuredToken, error: tokenError } = await authClient.rpc('ensure_commercial_document_share_token', {
      _document_id: documentId,
    });
    if (tokenError || !ensuredToken) return json(400, { error: tokenError?.message ?? 'Could not prepare the document link.' });

    let shareToken = String(ensuredToken);
    const { data: existingShare, error: shareError } = await serviceClient
      .from('commercial_document_shares')
      .select('id, expires_at, revoked_at')
      .eq('document_id', documentId)
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (shareError || !existingShare) return json(500, { error: 'Could not prepare the document link.' });

    const shareExpired = existingShare.expires_at && new Date(existingShare.expires_at).getTime() <= Date.now();
    if (existingShare.revoked_at || shareExpired) {
      shareToken = crypto.randomUUID();
      const { error: refreshError } = await serviceClient
        .from('commercial_document_shares')
        .update({
          share_token: shareToken,
          revoked_at: null,
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          last_accessed_at: null,
          access_count: 0,
        })
        .eq('id', existingShare.id)
        .eq('user_id', authData.user.id);
      if (refreshError) return json(500, { error: 'Could not refresh the document link.' });
    }

    const { data: sharedDocument, error: sharedError } = await serviceClient.rpc('get_shared_commercial_document', {
      _share_token: shareToken,
    });
    if (sharedError || !sharedDocument || typeof sharedDocument !== 'object') {
      return json(500, { error: 'Could not prepare the document email.' });
    }

    const shared = sharedDocument as Record<string, unknown>;
    const issuerName = String(shared.issuerName ?? 'Zania professional');
    const issuerEmail = typeof shared.issuerEmail === 'string' && shared.issuerEmail.includes('@') ? shared.issuerEmail : null;
    const recipientName = String(document.recipient_name ?? 'there');
    const typeLabel = documentTypeLabel(documentType);
    const title = String(document.title ?? typeLabel);
    const documentNumber = String(document.document_number ?? '');
    const currency = String(document.currency ?? 'KES');
    const totalAmount = Number(document.total_amount ?? 0);
    const dueDate = formatDate(document.due_date ? String(document.due_date) : null);
    const shareUrl = `${APP_BASE_URL}/documents/share/${shareToken}`;
    const subject = `${typeLabel} ${documentNumber} from ${issuerName}`;
    const actionLabel = documentType === 'quote' ? 'Review and respond to quote' : `View ${typeLabel.toLowerCase()}`;
    const requestId = crypto.randomUUID();

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `commercial-document-${documentId}-${requestId}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: recipientEmails,
        ...(issuerEmail ? { reply_to: issuerEmail } : {}),
        subject,
        html: `
          <div style="margin:0;background:#f4f0ea;padding:32px 16px;color:#29231f;font-family:Arial,sans-serif">
            <div style="max-width:600px;margin:0 auto;background:#fffdf9;border:1px solid #ded6cc">
              <div style="padding:32px 32px 20px;border-bottom:3px solid #c96f48">
                <div style="font-size:12px;letter-spacing:2px;color:#8a7d73">${escapeHtml(issuerName.toUpperCase())}</div>
                <h1 style="margin:14px 0 0;font-family:Georgia,serif;font-size:28px;line-height:1.25">${escapeHtml(title)}</h1>
                <div style="margin-top:10px;font-size:13px;color:#8a7d73">${escapeHtml(documentNumber)}</div>
              </div>
              <div style="padding:28px 32px;line-height:1.65">
                <p>Hello ${escapeHtml(recipientName)},</p>
                <p><strong>${escapeHtml(issuerName)}</strong> sent you this ${typeLabel.toLowerCase()}.</p>
                <div style="margin:22px 0;padding:18px;border:1px solid #ded6cc;background:#faf8f5">
                  <div style="font-size:12px;letter-spacing:1.4px;color:#8a7d73">TOTAL</div>
                  <div style="margin-top:6px;font-family:Georgia,serif;font-size:24px;font-weight:700">${escapeHtml(formatAmount(currency, totalAmount))}</div>
                  ${dueDate ? `<div style="margin-top:8px;font-size:13px;color:#6f645d">Due ${escapeHtml(dueDate)}</div>` : ''}
                </div>
                <p style="margin:26px 0"><a href="${shareUrl}" style="display:inline-block;background:#c96f48;color:white;text-decoration:none;padding:12px 20px;border-radius:4px;font-weight:600">${actionLabel}</a></p>
                <p style="font-size:14px;color:#6f645d">${documentType === 'quote'
                  ? 'No Zania account is needed to open, accept, or request changes to this quote.'
                  : 'No Zania account is needed to open this document.'}</p>
              </div>
              <div style="padding:18px 32px;border-top:1px solid #ded6cc;font-size:12px;color:#8a7d73">Sent securely through Zania for ${escapeHtml(issuerName)}.</div>
            </div>
          </div>
        `,
      }),
    });

    const resend = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('send-commercial-document Resend error:', resend);
      return json(502, { error: `The ${typeLabel.toLowerCase()} is ready, but the email could not be sent. Try again.` });
    }

    const shouldAwaitRecipient = documentType !== 'receipt'
      && (document.status === 'draft' || (documentType === 'quote' && document.status === 'changes_requested'));
    const nextStatus = shouldAwaitRecipient ? 'sent' : String(document.status);
    if (nextStatus !== document.status) {
      const { error: statusError } = await serviceClient
        .from('commercial_documents')
        .update({ status: nextStatus })
        .eq('id', documentId)
        .eq('user_id', authData.user.id);
      if (statusError) console.error('send-commercial-document status update error:', statusError.message);
    }

    const { error: historyError } = await serviceClient.from('commercial_document_email_events').insert({
      document_id: documentId,
      user_id: authData.user.id,
        recipient_email: recipientEmail,
      subject,
      provider_message_id: typeof resend?.id === 'string' ? resend.id : null,
      metadata: {
        request_id: requestId,
        document_type: documentType,
        document_number: documentNumber,
        share_token: shareToken,
        recipient_emails: recipientEmails,
      },
    });
    if (historyError) console.error('send-commercial-document history error:', historyError.message);

    return json(200, {
      success: true,
      recipientEmail,
      recipientEmails,
      shareUrl,
      sentAt: new Date().toISOString(),
      status: nextStatus,
    });
  } catch (error) {
    if (isAuthSessionError(error)) return json(error.status, { error: error.message });
    console.error('send-commercial-document error:', error);
    return json(500, { error: error instanceof Error ? error.message : 'Could not send the document.' });
  }
});
