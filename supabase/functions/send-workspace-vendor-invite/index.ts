import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCorsHeaders } from "../_shared/cors.ts";
import { assertActiveAuthSession, isAuthSessionError } from "../_shared/sessionGuard.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ??
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
  '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_BASE_URL = Deno.env.get('PUBLIC_APP_URL') ?? Deno.env.get('SITE_URL') ?? 'https://www.planwithzania.com';

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
  const jsonResponse = (status: number, payload: Record<string, unknown>) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
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

  try {
    await assertActiveAuthSession(serviceClient, authHeader, authData.user.id);
  } catch (error) {
    if (isAuthSessionError(error)) {
      return jsonResponse(error.status, { error: error.message });
    }
    throw error;
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'Zania Weddings <onboarding@resend.dev>';
  if (!RESEND_API_KEY) {
    return jsonResponse(500, { error: 'RESEND_API_KEY not configured' });
  }

  try {
    const { inviteId } = await req.json();
    if (!inviteId || typeof inviteId !== 'string') {
      return jsonResponse(400, { error: 'inviteId is required.' });
    }

    const { data: inviteRow, error: inviteError } = await authClient
      .from('workspace_vendor_invites')
      .select(`
        id,
        wedding_id,
        vendor_id,
        invite_contact_email,
        invite_contact_phone,
        invite_message,
        invite_token,
        invite_status,
        invite_expires_at,
        weddings ( name, wedding_date ),
        vendors ( name, category )
      `)
      .eq('id', inviteId)
      .maybeSingle();

    if (inviteError || !inviteRow) {
      return jsonResponse(404, { error: 'Workspace vendor invite not found.' });
    }

    const invite = inviteRow as any;
    const recipientEmail = invite.invite_contact_email?.trim();
    if (!recipientEmail) {
      return jsonResponse(400, { error: 'This invite draft does not have an email address yet.' });
    }

    const { data: requesterProfile } = await serviceClient
      .from('profiles')
      .select('full_name')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    const requesterName = requesterProfile?.full_name?.trim() || authData.user.email || 'A couple on Zania';
    const vendorName = invite.vendors?.name?.trim() || 'your business';
    const vendorCategory = invite.vendors?.category?.trim() || 'vendor';
    const weddingName = invite.weddings?.name?.trim() || 'a wedding workspace';
    const weddingDate = invite.weddings?.wedding_date
      ? new Date(`${invite.weddings.wedding_date}T00:00:00`).toLocaleDateString('en-KE', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null;

    const claimUrl = `${APP_BASE_URL.replace(/\/$/, '')}/vendor-claim?token=${invite.invite_token}&email=${encodeURIComponent(recipientEmail)}&claim_type=workspace_invite`;

    const safeRequester = htmlEscape(requesterName);
    const safeVendor = htmlEscape(vendorName);
    const safeCategory = htmlEscape(vendorCategory);
    const safeWedding = htmlEscape(weddingName);
    const safeMessage = invite.invite_message ? htmlEscape(invite.invite_message) : null;

    const htmlBody = `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e8e0d8;">
        <div style="background: linear-gradient(135deg, #8B7355 0%, #A0926B 100%); padding: 32px 30px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 22px; margin: 0; letter-spacing: 1px;">You were invited into a Zania wedding workspace</h1>
        </div>
        <div style="padding: 32px 30px; color: #4a4a4a; line-height: 1.7;">
          <p style="font-size: 16px;">Hi,</p>
          <p><strong>${safeRequester}</strong> added <strong>${safeVendor}</strong> (${safeCategory}) privately inside <strong>${safeWedding}</strong> on Zania and wants to invite you into the workspace.</p>
          ${weddingDate ? `<p>The wedding date currently tracked is <strong>${htmlEscape(weddingDate)}</strong>.</p>` : ''}
          ${safeMessage ? `
            <div style="margin: 20px 0; padding: 15px; background: #f9f6f2; border-left: 3px solid #8B7355;">
              <p style="margin: 0; font-style: italic; color: #666;">"${safeMessage}"</p>
            </div>
          ` : ''}
          <div style="margin: 28px 0; text-align: center;">
            <a href="${claimUrl}" style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #8B7355 0%, #A0926B 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
              View invite
            </a>
          </div>
          <p style="margin-top: 24px; color: #999; font-size: 14px;">Open the link above to join this wedding workspace with your vendor account or create one first. Your public profile can be set up later.</p>
        </div>
        <div style="background: #f9f6f2; padding: 16px 30px; text-align: center; font-size: 12px; color: #999;">
          Sent via Zania Weddings
        </div>
      </div>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [recipientEmail],
        subject: `${requesterName} invited ${vendorName} into a Zania wedding workspace`,
        html: htmlBody,
      }),
    });

    if (!resendResponse.ok) {
      const errorPayload = await resendResponse.text();
      console.error('send-workspace-vendor-invite resend error:', errorPayload);
      return jsonResponse(502, { error: 'Could not send invite email right now.' });
    }

    await serviceClient
      .from('workspace_vendor_invites')
      .update({
        invite_status: 'sent',
        invite_sent_at: new Date().toISOString(),
      })
      .eq('id', inviteId);

    return jsonResponse(200, { success: true });
  } catch (error) {
    if (isAuthSessionError(error)) {
      return jsonResponse(error.status, { error: error.message });
    }

    console.error('send-workspace-vendor-invite error:', error);
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Unexpected error' });
  }
});
