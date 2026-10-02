import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  AbuseProtectionError,
  assertMaxLength,
  assertRecentFunctionEventLimit,
} from '../_shared/abuseProtection.ts';
import { createCorsHeaders } from '../_shared/cors.ts';
import { logFunctionEvent } from '../_shared/runtimeLogger.ts';
import { assertActiveAuthSession, isAuthSessionError } from '../_shared/sessionGuard.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ??
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
  '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Zania <hello@planwithzania.com>';
const SUPPORT_EMAIL = Deno.env.get('SUPPORT_EMAIL') ?? 'hello@planwithzania.com';

const categories = new Set(['bug', 'confusing', 'suggestion', 'billing']);
const allowedScreenshotTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxScreenshotBytes = 4 * 1024 * 1024;

function htmlEscape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cleanOptionalString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  if (!cleaned) return null;
  if (cleaned.length > maxLength) {
    throw new AbuseProtectionError('Some support context was too long.', 400);
  }
  return cleaned;
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  const jsonResponse = (status: number, payload: Record<string, unknown>, headers?: HeadersInit) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        ...(headers ?? {}),
      },
    });

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed.' });

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    console.error('submit-support-request configuration is incomplete');
    return jsonResponse(500, { error: 'Support is temporarily unavailable. Please email hello@planwithzania.com.' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse(401, { error: 'Please sign in before sending a support message.' });

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: authData, error: authError } = await authClient.auth.getUser();
  const user = authData.user;

  if (authError || !user?.email) {
    return jsonResponse(401, { error: 'Your session could not be verified. Please sign in again.' });
  }

  try {
    await assertActiveAuthSession(serviceClient, authHeader, user.id);

    await assertRecentFunctionEventLimit(serviceClient, {
      functionName: 'submit-support-request',
      userId: user.id,
      eventType: 'support_request_submitted',
      lookbackMs: 60 * 60 * 1000,
      maxAttempts: 10,
      message: 'You have sent several messages recently. Please wait a little before sending another.',
      retryAfterStrategy: 'window',
    });

    const body = await req.json();
    const category = typeof body?.category === 'string' ? body.category.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!categories.has(category)) {
      return jsonResponse(400, { error: 'Choose what you need help with.' });
    }
    if (message.length < 5) {
      return jsonResponse(400, { error: 'Add a short message so we know how to help.' });
    }
    assertMaxLength(message, 4000, 'Message');

    const pagePath = cleanOptionalString(body?.pagePath, 500) ?? '/';
    const pageUrl = cleanOptionalString(body?.pageUrl, 1200);
    const workspaceLabel = cleanOptionalString(body?.workspaceLabel, 240);
    const weddingId = cleanOptionalString(body?.weddingId, 80);
    const plannerClientId = cleanOptionalString(body?.plannerClientId, 80);
    const errorReference = cleanOptionalString(body?.errorReference, 160);
    const screenshotName = cleanOptionalString(body?.screenshot?.name, 240);
    const screenshotType = cleanOptionalString(body?.screenshot?.type, 100);
    const screenshotContent = cleanOptionalString(body?.screenshot?.content, 6_000_000);
    const screenshotSize = Number(body?.screenshot?.size ?? 0);

    if (screenshotContent) {
      if (!screenshotName || !screenshotType || !allowedScreenshotTypes.has(screenshotType)) {
        return jsonResponse(400, { error: 'Attach a JPG, PNG, or WebP screenshot.' });
      }
      if (!Number.isInteger(screenshotSize) || screenshotSize < 1 || screenshotSize > maxScreenshotBytes) {
        return jsonResponse(400, { error: 'Screenshots must be smaller than 4 MB.' });
      }
    }

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('full_name, role')
      .eq('user_id', user.id)
      .maybeSingle();

    const userRole = ['couple', 'planner', 'vendor', 'admin'].includes(profile?.role)
      ? profile.role
      : 'couple';
    const userName = profile?.full_name?.trim() || user.email;
    const browserContext = {
      userAgent: cleanOptionalString(body?.browserContext?.userAgent, 600),
      language: cleanOptionalString(body?.browserContext?.language, 40),
      viewport: cleanOptionalString(body?.browserContext?.viewport, 80),
      timezone: cleanOptionalString(body?.browserContext?.timezone, 120),
    };

    const { data: supportRequest, error: insertError } = await serviceClient
      .from('support_requests')
      .insert({
        user_id: user.id,
        user_email: user.email,
        user_name: userName,
        user_role: userRole,
        category,
        message,
        page_path: pagePath,
        page_url: pageUrl,
        workspace_label: workspaceLabel,
        wedding_id: weddingId,
        planner_client_id: plannerClientId,
        error_reference: errorReference,
        browser_context: browserContext,
        screenshot_name: screenshotContent ? screenshotName : null,
        screenshot_type: screenshotContent ? screenshotType : null,
        screenshot_size_bytes: screenshotContent ? screenshotSize : null,
      })
      .select('id, reference')
      .single();

    if (insertError || !supportRequest) {
      console.error('submit-support-request insert failed:', insertError);
      return jsonResponse(500, { error: 'We could not save your message. Please try again.' });
    }

    const safeMessage = htmlEscape(message).replaceAll('\n', '<br />');
    const safeName = htmlEscape(userName);
    const safeEmail = htmlEscape(user.email);
    const safeReference = htmlEscape(supportRequest.reference);
    const safeWorkspace = htmlEscape(workspaceLabel ?? 'Not specified');
    const safePagePath = htmlEscape(pagePath);
    const safeErrorReference = errorReference ? htmlEscape(errorReference) : null;

    const resendPayload: Record<string, unknown> = {
      from: RESEND_FROM_EMAIL,
      to: [SUPPORT_EMAIL],
      reply_to: user.email,
      subject: `[${supportRequest.reference}] ${category === 'bug' ? 'Issue' : category === 'confusing' ? 'Question' : category === 'billing' ? 'Billing help' : 'Feedback'} from ${userName}`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#2f241f;max-width:680px;margin:0 auto;">
          <div style="padding:26px 30px;background:#4a3029;color:#fff;border-radius:18px 18px 0 0;">
            <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#e5c995;">Zania support</div>
            <h1 style="font-size:24px;margin:10px 0 0;">${safeReference}</h1>
          </div>
          <div style="padding:30px;border:1px solid #eadbca;border-top:0;border-radius:0 0 18px 18px;background:#fffdfa;">
            <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">${safeMessage}</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.6;">
              <tr><td style="padding:7px 0;color:#8a7b73;width:150px;">From</td><td>${safeName} · ${safeEmail}</td></tr>
              <tr><td style="padding:7px 0;color:#8a7b73;">Account</td><td>${htmlEscape(userRole)}</td></tr>
              <tr><td style="padding:7px 0;color:#8a7b73;">Category</td><td>${htmlEscape(category)}</td></tr>
              <tr><td style="padding:7px 0;color:#8a7b73;">Workspace</td><td>${safeWorkspace}</td></tr>
              <tr><td style="padding:7px 0;color:#8a7b73;">Page</td><td>${safePagePath}</td></tr>
              ${safeErrorReference ? `<tr><td style="padding:7px 0;color:#8a7b73;">Error reference</td><td>${safeErrorReference}</td></tr>` : ''}
            </table>
            <p style="margin:22px 0 0;color:#8a7b73;font-size:13px;">Reply to this email to respond directly to ${safeName}.</p>
          </div>
        </div>
      `,
      tags: [
        { name: 'type', value: 'support_request' },
        { name: 'category', value: category },
      ],
    };

    if (screenshotContent && screenshotName) {
      resendPayload.attachments = [{ filename: screenshotName, content: screenshotContent }];
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `support-request/${supportRequest.id}`,
      },
      body: JSON.stringify(resendPayload),
    });
    const resendData = await resendResponse.json();

    await serviceClient
      .from('support_requests')
      .update({
        email_delivery_status: resendResponse.ok ? 'sent' : 'failed',
        resend_email_id: resendResponse.ok ? resendData.id ?? null : null,
      })
      .eq('id', supportRequest.id);

    await logFunctionEvent({
      functionName: 'submit-support-request',
      severity: resendResponse.ok ? 'info' : 'error',
      status: resendResponse.ok ? 'success' : 'failure',
      eventType: resendResponse.ok ? 'support_request_submitted' : 'support_request_email_failed',
      message: resendResponse.ok ? 'Support request submitted.' : 'Support request saved but email delivery failed.',
      userId: user.id,
      audience: userRole,
      entityId: supportRequest.id,
      details: { category, reference: supportRequest.reference },
    });

    if (!resendResponse.ok) {
      console.error('submit-support-request resend failed:', resendData);
    }

    return jsonResponse(200, {
      reference: supportRequest.reference,
      emailDelivered: resendResponse.ok,
    });
  } catch (error) {
    if (isAuthSessionError(error)) {
      return jsonResponse(error.status, { error: error.message });
    }
    if (error instanceof AbuseProtectionError) {
      return jsonResponse(error.status, { error: error.message }, error.retryAfterSeconds
        ? { 'Retry-After': String(error.retryAfterSeconds) }
        : undefined);
    }

    console.error('submit-support-request failed:', error);
    return jsonResponse(500, { error: 'We could not send your message. Please try again or email hello@planwithzania.com.' });
  }
});
