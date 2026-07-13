import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  AbuseProtectionError,
  assertMaxLength,
  assertRecentFunctionEventLimit,
  getRetryAfterSeconds,
} from '../_shared/abuseProtection.ts';
import { logFunctionEvent } from '../_shared/runtimeLogger.ts';
import { createCorsHeaders } from '../_shared/cors.ts';
import { assertActiveAuthSession, isAuthSessionError } from '../_shared/sessionGuard.ts';
import { escapeHtml, sanitizeBasicHtml } from '../_shared/htmlSanitizer.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ??
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
  '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const PUBLIC_APP_URL = Deno.env.get('PUBLIC_APP_URL') ?? 'https://kenya-wedding-hub.vercel.app';
const RESEND_FROM_EMAIL =
  Deno.env.get('RESEND_FROM_EMAIL') ?? 'Zania Weddings <invites@planwithzania.com>';

type GuestInviteRow = {
  id: string;
  user_id: string | null;
  wedding_id: string | null;
  name: string;
  email: string | null;
  rsvp_token: string | null;
  invite_last_sent_at: string | null;
  invite_send_count: number | null;
};

type WeddingRow = {
  name: string | null;
  wedding_date: string | null;
  location_town: string | null;
  location_county: string | null;
};

type ProfileRow = {
  full_name: string | null;
  partner_name: string | null;
  wedding_date: string | null;
  wedding_location: string | null;
};

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: 'Supabase auth configuration is missing' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const user = authData.user;

  try {
    await assertActiveAuthSession(adminClient, authHeader, user.id);
  } catch (error) {
    if (isAuthSessionError(error)) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    throw error;
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { guestId, subject: customSubject, contentText, contentHtml } = await req.json();

    if (!guestId || typeof guestId !== 'string') {
      return new Response(JSON.stringify({ error: 'guestId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    assertMaxLength(customSubject, 180, 'Subject');
    assertMaxLength(contentText, 8000, 'Invite text');
    assertMaxLength(contentHtml, 20000, 'Invite HTML');

    await assertRecentFunctionEventLimit(adminClient, {
      functionName: 'send-guest-invite',
      userId: user.id,
      eventType: 'guest_invite_requested',
      lookbackMs: 60 * 60 * 1000,
      maxAttempts: 30,
      message: 'Too many guest invite attempts in the last hour. Please wait before sending more.',
      retryAfterSeconds: 60 * 10,
    });

    const { data: guestData, error: guestError } = await authClient
      .from('guests')
      .select('id, user_id, wedding_id, name, email, rsvp_token, invite_last_sent_at, invite_send_count')
      .eq('id', guestId)
      .maybeSingle();

    const guest = guestData as GuestInviteRow | null;

    if (guestError || !guest) {
      return new Response(JSON.stringify({ error: 'Guest not found or you do not have access to this guest.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!guest.email) {
      return new Response(JSON.stringify({ error: 'This guest does not have an email address yet.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!guest.rsvp_token) {
      return new Response(JSON.stringify({ error: 'This guest does not have an RSVP token yet.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const guestCooldownSeconds = getRetryAfterSeconds(guest.invite_last_sent_at, 5 * 60 * 1000);
    if (guestCooldownSeconds > 0) {
      throw new AbuseProtectionError(
        `An invite was already sent to ${guest.name} recently. Please wait before resending.`,
        429,
        guestCooldownSeconds,
      );
    }

    await logFunctionEvent({
      functionName: 'send-guest-invite',
      severity: 'info',
      status: 'success',
      eventType: 'guest_invite_requested',
      message: 'Guest invite send requested.',
      userId: user.id,
      entityId: guest.id,
      requestId,
      details: {
        guestId: guest.id,
      },
    });

    const rsvpLink = `${PUBLIC_APP_URL.replace(/\/$/, '')}/rsvp/${guest.rsvp_token}`;
    let coupleName = '';
    let weddingDate: string | null = null;
    let weddingLocation = '';

    if (guest.wedding_id) {
      const { data: weddingData } = await authClient
        .from('weddings')
        .select('name, wedding_date, location_town, location_county')
        .eq('id', guest.wedding_id)
        .maybeSingle();

      const wedding = weddingData as WeddingRow | null;
      coupleName = wedding?.name?.trim() || '';
      weddingDate = wedding?.wedding_date ?? null;
      weddingLocation = [wedding?.location_town, wedding?.location_county].filter(Boolean).join(', ');
    } else if (guest.user_id) {
      const { data: profileData } = await authClient
        .from('profiles')
        .select('full_name, partner_name, wedding_date, wedding_location')
        .eq('user_id', guest.user_id)
        .maybeSingle();

      const profile = profileData as ProfileRow | null;
      coupleName = [profile?.full_name, profile?.partner_name].filter(Boolean).join(' & ');
      weddingDate = profile?.wedding_date ?? null;
      weddingLocation = profile?.wedding_location?.trim() || '';
    }

    const dateStr = weddingDate
      ? new Date(weddingDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'TBD';

    let htmlBody: string;

    if (contentHtml?.trim()) {
      htmlBody = sanitizeBasicHtml(contentHtml);
    } else {
      const personalMessage = contentText?.trim() || '';
      const safeGuestName = escapeHtml(guest.name);
      const safeCoupleName = escapeHtml(coupleName);
      const safeDate = escapeHtml(dateStr);
      const safeLocation = escapeHtml(weddingLocation);
      const safePersonalMessage = escapeHtml(personalMessage);
      const safeRsvpLink = escapeHtml(rsvpLink);
      htmlBody = `
        <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e8e0d8;">
          <div style="background: linear-gradient(135deg, #8B7355 0%, #A0926B 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 28px; margin: 0; letter-spacing: 2px;">You're Invited!</h1>
          </div>
          <div style="padding: 40px 30px; color: #4a4a4a; line-height: 1.8;">
            <p style="font-size: 18px;">Dear <strong>${safeGuestName}</strong>,</p>
            <p>We are delighted to invite you to celebrate our wedding${safeCoupleName ? ` — <strong>${safeCoupleName}</strong>` : ''}.</p>
            ${weddingDate ? `<p>📅 <strong>Date:</strong> ${safeDate}</p>` : ''}
            ${safeLocation ? `<p>📍 <strong>Venue:</strong> ${safeLocation}</p>` : ''}
            ${safePersonalMessage ? `<p style="margin-top: 20px; padding: 15px; background: #f9f6f2; border-left: 3px solid #8B7355; font-style: italic;">${safePersonalMessage}</p>` : ''}
            <p style="margin-top: 30px;">We would be honoured to have you join us on our special day. Please let us know if you can attend.</p>
            <p style="margin-top: 20px;"><a href="${safeRsvpLink}" style="display: inline-block; padding: 12px 18px; background: #8B7355; color: white; text-decoration: none; border-radius: 999px;">Open your RSVP link</a></p>
            <p style="margin-top: 30px;">With love and warm regards ❤️</p>
          </div>
          <div style="background: #f9f6f2; padding: 20px 30px; text-align: center; font-size: 12px; color: #999;">
            Sent with love via Kenya Bliss Planner
          </div>
        </div>
      `;
    }

    const emailSubject = customSubject?.trim()
      || `You're Invited${coupleName ? ` — ${coupleName}'s Wedding` : ' to Our Wedding'}!`;

    const emailPayload: Record<string, unknown> = {
      from: RESEND_FROM_EMAIL,
      to: [guest.email],
      subject: emailSubject,
      html: htmlBody,
    };

    if (contentText?.trim()) {
      emailPayload.text = `${contentText.trim()}\n\nRSVP: ${rsvpLink}`;
    } else {
      emailPayload.text = `You're invited${coupleName ? ` to ${coupleName}'s wedding` : ''}. RSVP here: ${rsvpLink}`;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend error:', data);
      await logFunctionEvent({
        functionName: 'send-guest-invite',
        severity: 'error',
        status: 'failure',
        eventType: 'guest_invite_failed',
        message: data?.message || 'Failed to send guest invite email.',
        userId: user.id,
        entityId: guest.id,
        requestId,
        details: {
          guestId: guest.id,
          resend: data,
        },
      });
      return new Response(JSON.stringify({ error: data.message || 'Failed to send email' }), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await adminClient
      .from('guests')
      .update({
        invite_last_sent_at: new Date().toISOString(),
        invite_last_sent_by_user_id: user.id,
        invite_send_count: (guest.invite_send_count ?? 0) + 1,
      })
      .eq('id', guest.id);

    await logFunctionEvent({
      functionName: 'send-guest-invite',
      severity: 'info',
      status: 'success',
      eventType: 'guest_invite_sent',
      message: 'Guest invite sent successfully.',
      userId: user.id,
      entityId: guest.id,
      requestId,
      details: {
        guestId: guest.id,
        emailId: data?.id ?? null,
      },
    });

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);

    if (error instanceof AbuseProtectionError) {
      await logFunctionEvent({
        functionName: 'send-guest-invite',
        severity: 'warn',
        status: 'failure',
        eventType: 'guest_invite_rate_limited',
        message: error.message,
        userId: user.id,
        requestId,
        details: {
          retryAfterSeconds: error.retryAfterSeconds,
        },
      });
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          ...(error.retryAfterSeconds ? { 'Retry-After': String(error.retryAfterSeconds) } : {}),
        },
      });
    }

    await logFunctionEvent({
      functionName: 'send-guest-invite',
      severity: 'error',
      status: 'failure',
      eventType: 'guest_invite_failed',
      message: error instanceof Error ? error.message : 'Unknown guest invite error',
      userId: user.id,
      requestId,
      details: {
        error: error instanceof Error ? error.stack ?? error.message : String(error),
      },
    });

    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
