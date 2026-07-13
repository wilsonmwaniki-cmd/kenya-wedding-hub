import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { createCorsHeaders } from '../_shared/cors.ts';

function extractBearerToken(authHeader: string | null) {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  return token || null;
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return atob(padded);
}

function getSessionIdFromAccessToken(authHeader: string | null) {
  const token = extractBearerToken(authHeader);
  if (!token) return null;

  const [, payload] = token.split('.');
  if (!payload) return null;

  try {
    const decoded = JSON.parse(decodeBase64Url(payload)) as { session_id?: unknown };
    return typeof decoded.session_id === 'string' && decoded.session_id.trim()
      ? decoded.session_id
      : null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const RESEND_FROM_EMAIL =
      Deno.env.get('RESEND_FROM_EMAIL') || 'Zania Weddings <security@planwithzania.com>';

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('send-device-verification-otp configuration error: Supabase environment is incomplete');
      return new Response(JSON.stringify({ error: 'We could not send a verification code right now.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!RESEND_API_KEY) {
      console.error('send-device-verification-otp configuration error: RESEND_API_KEY is missing');
      return new Response(JSON.stringify({ error: 'We could not send a verification code right now.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { deviceId } = await req.json();
    if (!deviceId || typeof deviceId !== 'string') {
      return new Response(JSON.stringify({ error: 'deviceId is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user || !user.email) {
      return new Response(JSON.stringify({ error: 'You must be signed in with an email-based account to continue.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sessionId = getSessionIdFromAccessToken(authHeader);
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Your session is missing device verification context. Please sign in again.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await serviceClient.rpc('admin_issue_device_verification_challenge', {
      target_user_id: user.id,
      target_device_id: deviceId,
      target_email: user.email,
      target_auth_session_id: sessionId,
    });

    if (error) {
      console.error('send-device-verification-otp challenge error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return new Response(JSON.stringify({ error: 'We could not send a verification code right now.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const challenge = Array.isArray(data) ? data[0] : data;
    if (!challenge) {
      console.error('send-device-verification-otp challenge error: RPC returned no challenge');
      return new Response(JSON.stringify({ error: 'We could not send a verification code right now.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!challenge.otp_code) {
      return new Response(JSON.stringify({
        challengeId: challenge.challenge_id,
        expiresAt: challenge.expires_at,
        retryAfterSeconds: challenge.retry_after_seconds ?? 0,
        emailHint: challenge.email_hint ?? user.email,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [user.email],
        subject: 'Your Zania device verification code',
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
            <h2 style="margin-bottom:12px;">Verify your new device</h2>
            <p>We noticed a sign-in to your Zania account from a new device.</p>
            <p>Enter this code to continue:</p>
            <div style="font-size:32px;font-weight:700;letter-spacing:6px;margin:20px 0;">${challenge.otp_code}</div>
            <p>This code expires at ${new Date(challenge.expires_at).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}.</p>
            <p>If this was not you, you can ignore this email and sign out of other devices after regaining access.</p>
          </div>
        `,
      }),
    });

    const resendPayload = await resendResponse.json();
    if (!resendResponse.ok) {
      console.error('send-device-verification-otp resend error:', resendPayload);
      return new Response(JSON.stringify({ error: 'We could not send a verification code right now.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      challengeId: challenge.challenge_id,
      expiresAt: challenge.expires_at,
      retryAfterSeconds: challenge.retry_after_seconds ?? 0,
      emailHint: challenge.email_hint ?? user.email,
      emailId: resendPayload.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('send-device-verification-otp failed:', error);
    return new Response(JSON.stringify({ error: 'We could not send a verification code right now.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
