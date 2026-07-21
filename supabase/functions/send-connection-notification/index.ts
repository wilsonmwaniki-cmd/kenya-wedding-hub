import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createConnectionResponseToken } from "../_shared/connectionTokens.ts";
import {
  AbuseProtectionError,
  assertMaxLength,
  assertRecentFunctionEventLimit,
} from "../_shared/abuseProtection.ts";
import { logFunctionEvent } from "../_shared/runtimeLogger.ts";
import { createCorsHeaders } from "../_shared/cors.ts";
import { assertActiveAuthSession, isAuthSessionError } from "../_shared/sessionGuard.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ??
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
  '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

type ConnectionRequestType = 'planner' | 'vendor';

interface PlannerLinkRequestRow {
  id: string;
  couple_user_id: string;
  planner_user_id: string;
  status: string;
}

interface VendorConnectionRequestRow {
  id: string;
  requester_user_id: string;
  vendor_listing_id: string;
  status: string;
}

function htmlEscape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'Supabase auth configuration is missing' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: authData, error: authError } = await authClient.auth.getUser();

  if (authError || !authData.user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  const user = authData.user;

  try {
    await assertActiveAuthSession(serviceClient, authHeader, user.id);
  } catch (error) {
    if (isAuthSessionError(error)) {
      return jsonResponse(error.status, { error: error.message });
    }
    throw error;
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'Zania <hello@planwithzania.com>';

  if (!RESEND_API_KEY) {
    return jsonResponse(500, { error: 'RESEND_API_KEY not configured' });
  }

  try {
    const { message, type, requestId } = await req.json();

    if (!requestId || typeof requestId !== 'string') {
      return jsonResponse(400, { error: 'requestId is required.' });
    }

    if (type !== 'planner' && type !== 'vendor') {
      return jsonResponse(400, { error: 'A valid connection type is required.' });
    }

    assertMaxLength(typeof message === 'string' ? message : null, 500, 'Message');

    await assertRecentFunctionEventLimit(serviceClient, {
      functionName: 'send-connection-notification',
      userId: user.id,
      eventType: 'connection_notification_requested',
      audience: type,
      lookbackMs: 60 * 60 * 1000,
      maxAttempts: 12,
      message: 'Too many connection email attempts in the last hour. Please wait before trying again.',
      retryAfterSeconds: 60 * 60,
    });

    await assertRecentFunctionEventLimit(serviceClient, {
      functionName: 'send-connection-notification',
      userId: user.id,
      eventType: 'connection_notification_sent',
      audience: type,
      entityId: requestId,
      lookbackMs: 5 * 60 * 1000,
      maxAttempts: 1,
      message: 'This connection email was already sent recently. Please wait before resending it.',
      retryAfterSeconds: 5 * 60,
    });

    await logFunctionEvent({
      functionName: 'send-connection-notification',
      severity: 'info',
      status: 'success',
      eventType: 'connection_notification_requested',
      message: 'Connection notification requested.',
      userId: user.id,
      audience: type,
      entityId: requestId,
    });

    const { data: requesterProfile } = await serviceClient
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle();

    const requesterName = requesterProfile?.full_name?.trim() || user.user_metadata?.full_name || user.email || 'A couple';

    let recipientEmail: string | null = null;
    let recipientName = type === 'planner' ? 'Planner' : 'Vendor';
    let requestType: ConnectionRequestType = type;

    if (type === 'planner') {
      const { data: requestRow, error: requestError } = await authClient
        .from('planner_link_requests')
        .select('id, couple_user_id, planner_user_id, status')
        .eq('id', requestId)
        .maybeSingle();

      const plannerRequest = requestRow as PlannerLinkRequestRow | null;

      if (requestError || !plannerRequest || plannerRequest.couple_user_id !== user.id) {
        return jsonResponse(404, { error: 'Connection request not found.' });
      }

      if (plannerRequest.status !== 'pending') {
        return jsonResponse(409, { error: 'Only pending connection requests can be emailed.' });
      }

      const { data: plannerProfile } = await serviceClient
        .from('profiles')
        .select('full_name, company_name, company_email')
        .eq('user_id', plannerRequest.planner_user_id)
        .maybeSingle();

      recipientEmail = plannerProfile?.company_email?.trim() || null;
      recipientName = plannerProfile?.company_name?.trim() || plannerProfile?.full_name?.trim() || 'Planner';
    } else {
      const { data: requestRow, error: requestError } = await authClient
        .from('vendor_connection_requests')
        .select('id, requester_user_id, vendor_listing_id, status')
        .eq('id', requestId)
        .maybeSingle();

      const vendorRequest = requestRow as VendorConnectionRequestRow | null;

      if (requestError || !vendorRequest || vendorRequest.requester_user_id !== user.id) {
        return jsonResponse(404, { error: 'Connection request not found.' });
      }

      if (vendorRequest.status !== 'pending') {
        return jsonResponse(409, { error: 'Only pending connection requests can be emailed.' });
      }

      const { data: vendorListing } = await serviceClient
        .from('vendor_listings')
        .select('business_name, email')
        .eq('id', vendorRequest.vendor_listing_id)
        .maybeSingle();

      recipientEmail = vendorListing?.email?.trim() || null;
      recipientName = vendorListing?.business_name?.trim() || 'Vendor';
    }

    if (!recipientEmail) {
      return jsonResponse(400, { error: 'The recipient does not have an email address configured yet.' });
    }

    const subject = `New connection request from ${requesterName}`;
    const baseUrl = SUPABASE_URL;

    let actionButtons = '';

    if (requestId && baseUrl) {
      const exp = Date.now() + (7 * 24 * 60 * 60 * 1000);
      const acceptToken = await createConnectionResponseToken({
        requestId,
        action: 'accept',
        requestType,
        exp,
      });
      const declineToken = await createConnectionResponseToken({
        requestId,
        action: 'decline',
        requestType,
        exp,
      });

      const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
      const acceptUrl = `${normalizedBaseUrl}/functions/v1/handle-connection-response?id=${requestId}&action=accept&token=${acceptToken}&type=${requestType}&exp=${exp}`;
      const declineUrl = `${normalizedBaseUrl}/functions/v1/handle-connection-response?id=${requestId}&action=decline&token=${declineToken}&type=${requestType}&exp=${exp}`;

      actionButtons = `
        <div style="margin: 28px 0; text-align: center;">
          <a href="${acceptUrl}" style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #8B7355 0%, #A0926B 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; margin-right: 12px;">
            Accept
          </a>
          <a href="${declineUrl}" style="display: inline-block; padding: 12px 28px; background: #ffffff; color: #8B7355; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; border: 2px solid #e8e0d8;">
            Decline
          </a>
        </div>
        <p style="margin: 12px 0 0; color: #999; font-size: 12px; text-align: center;">
          These response links expire in 7 days.
        </p>
      `;
    }

    const safeRecipientName = htmlEscape(recipientName);
    const safeRequesterName = htmlEscape(requesterName);
    const safeMessage = typeof message === 'string' && message.trim().length > 0
      ? htmlEscape(message.trim())
      : null;

    const htmlBody = `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e8e0d8;">
        <div style="background: linear-gradient(135deg, #8B7355 0%, #A0926B 100%); padding: 32px 30px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 22px; margin: 0; letter-spacing: 1px;">New Connection Request</h1>
        </div>
        <div style="padding: 32px 30px; color: #4a4a4a; line-height: 1.7;">
          <p style="font-size: 16px;">Hi <strong>${safeRecipientName}</strong>,</p>
          <p><strong>${safeRequesterName}</strong> is interested in working with you and has sent a connection request.</p>
          ${safeMessage ? `
            <div style="margin: 20px 0; padding: 15px; background: #f9f6f2; border-left: 3px solid #8B7355;">
              <p style="margin: 0; font-style: italic; color: #666;">"${safeMessage}"</p>
            </div>
          ` : ''}
          ${actionButtons || '<p>Log in to your dashboard to review and respond to this request.</p>'}
          <p style="margin-top: 24px; color: #999; font-size: 14px;">Don&apos;t keep them waiting. Great connections start with a quick reply.</p>
        </div>
        <div style="background: #f9f6f2; padding: 16px 30px; text-align: center; font-size: 12px; color: #999;">
          Sent via Zania
        </div>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [recipientEmail],
        subject,
        html: htmlBody,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('send-connection-notification resend error:', data);
      await logFunctionEvent({
        functionName: 'send-connection-notification',
        severity: 'error',
        status: 'failure',
        eventType: 'connection_notification_failed',
        message: data?.message || 'Failed to send connection email.',
        userId: user.id,
        audience: type,
        entityId: requestId,
        details: {
          resend: data,
        },
      });
      return jsonResponse(res.status, { error: data.message || 'Failed to send email.' });
    }

    await logFunctionEvent({
      functionName: 'send-connection-notification',
      severity: 'info',
      status: 'success',
      eventType: 'connection_notification_sent',
      message: 'Connection notification sent successfully.',
      userId: user.id,
      audience: type,
      entityId: requestId,
      details: {
        emailId: data?.id ?? null,
        recipientEmail,
      },
    });

    return jsonResponse(200, { success: true, id: data.id });
  } catch (error) {
    console.error('send-connection-notification error:', error);

    if (error instanceof AbuseProtectionError) {
      await logFunctionEvent({
        functionName: 'send-connection-notification',
        severity: 'warn',
        status: 'failure',
        eventType: 'connection_notification_rate_limited',
        message: error.message,
        userId: user.id,
      });

      return jsonResponse(
        error.status,
        { error: error.message },
        error.retryAfterSeconds ? { 'Retry-After': String(error.retryAfterSeconds) } : undefined,
      );
    }

    await logFunctionEvent({
      functionName: 'send-connection-notification',
      severity: 'error',
      status: 'failure',
      eventType: 'connection_notification_failed',
      message: error instanceof Error ? error.message : 'Unknown connection notification error',
      userId: user.id,
    });

    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Unknown error' });
  }
});
