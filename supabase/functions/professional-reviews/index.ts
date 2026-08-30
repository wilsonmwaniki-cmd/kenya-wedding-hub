import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { createCorsHeaders } from '../_shared/cors.ts';
import { AbuseProtectionError, assertRecentFunctionEventLimit } from '../_shared/abuseProtection.ts';
import { logFunctionEvent } from '../_shared/runtimeLogger.ts';
import { assertActiveAuthSession, isAuthSessionError } from '../_shared/sessionGuard.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_BASE_URL =
  Deno.env.get('PUBLIC_APP_URL') ?? Deno.env.get('SITE_URL') ?? 'https://www.planwithzania.com';
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Zania <hello@planwithzania.com>';
const FUNCTION_NAME = 'professional-reviews';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function htmlEscape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function createToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  const jsonResponse = (payload: Record<string, unknown>, status = 200, extraHeaders: HeadersInit = {}) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
    });

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Supabase configuration is missing' }, 500);
  }

  const requestId = crypto.randomUUID();
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const action = typeof body?.action === 'string' ? body.action : '';

    if (action === 'get-invite') {
      const token = typeof body.token === 'string' ? body.token.trim() : '';
      if (token.length < 32 || token.length > 128) {
        return jsonResponse({ error: 'This review invitation is invalid or has expired.' }, 404);
      }

      const tokenHash = await sha256(token);
      const { data: invite } = await adminClient
        .from('professional_review_invites')
        .select('professional_name, professional_type, couple_name, status, expires_at')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (!invite || invite.status !== 'sent' || new Date(invite.expires_at).getTime() <= Date.now()) {
        return jsonResponse({ error: 'This review invitation is invalid or has expired.' }, 404);
      }

      return jsonResponse({
        invite: {
          professionalName: invite.professional_name,
          professionalType: invite.professional_type,
          coupleName: invite.couple_name,
          expiresAt: invite.expires_at,
        },
      });
    }

    if (action === 'submit-review') {
      const token = typeof body.token === 'string' ? body.token.trim() : '';
      const reviewerName = typeof body.reviewerName === 'string' ? body.reviewerName.trim() : '';
      const reviewText = typeof body.reviewText === 'string' ? body.reviewText.trim() : '';
      const rating = Number(body.rating);

      if (token.length < 32 || token.length > 128) {
        return jsonResponse({ error: 'This review invitation is invalid or has expired.' }, 400);
      }
      if (!reviewerName || reviewerName.length > 120) {
        return jsonResponse({ error: 'Please enter your name.' }, 400);
      }
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return jsonResponse({ error: 'Please choose a rating from 1 to 5.' }, 400);
      }
      if (reviewText.length > 2000) {
        return jsonResponse({ error: 'Your review must be 2,000 characters or fewer.' }, 400);
      }

      const tokenHash = await sha256(token);
      const { data: reviewId, error } = await adminClient.rpc('consume_professional_review_invite', {
        token_hash_input: tokenHash,
        reviewer_name_input: reviewerName,
        rating_input: rating,
        review_text_input: reviewText || null,
      });

      if (error || !reviewId) {
        console.warn('Guest review submission rejected:', error?.message);
        return jsonResponse({ error: 'This review invitation is invalid, expired, or already used.' }, 409);
      }

      await logFunctionEvent({
        functionName: FUNCTION_NAME,
        severity: 'info',
        status: 'success',
        eventType: 'guest_review_submitted',
        message: 'A verified guest review was submitted.',
        entityId: String(reviewId),
        requestId,
      });

      return jsonResponse({ success: true, reviewId });
    }

    if (action !== 'create-invite' && action !== 'revoke-invite') {
      return jsonResponse({ error: 'A valid action is required.' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) return jsonResponse({ error: 'Unauthorized' }, 401);

    await assertActiveAuthSession(adminClient, authHeader, authData.user.id);

    if (action === 'revoke-invite') {
      const inviteId = typeof body.inviteId === 'string' ? body.inviteId : '';
      if (!inviteId) return jsonResponse({ error: 'inviteId is required.' }, 400);

      const { data, error } = await adminClient
        .from('professional_review_invites')
        .update({ status: 'revoked' })
        .eq('id', inviteId)
        .eq('professional_user_id', authData.user.id)
        .eq('status', 'sent')
        .select('id')
        .maybeSingle();

      if (error || !data) return jsonResponse({ error: 'Active invitation not found.' }, 404);
      return jsonResponse({ success: true });
    }

    await assertRecentFunctionEventLimit(adminClient, {
      functionName: FUNCTION_NAME,
      userId: authData.user.id,
      eventType: 'review_invite_sent',
      lookbackMs: 24 * 60 * 60 * 1000,
      maxAttempts: 20,
      retryAfterStrategy: 'window',
      message: 'You can send up to 20 review invitations per day. Please try again later.',
    });

    const coupleName = typeof body.coupleName === 'string' ? body.coupleName.trim() : '';
    const coupleEmail = typeof body.coupleEmail === 'string' ? body.coupleEmail.trim().toLowerCase() : '';
    if (!coupleName || coupleName.length > 120) {
      return jsonResponse({ error: 'Please enter the couple’s name.' }, 400);
    }
    if (!emailPattern.test(coupleEmail) || coupleEmail.length > 320) {
      return jsonResponse({ error: 'Please enter a valid email address.' }, 400);
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, user_id, role, full_name, company_name, planner_verified')
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (profileError || !profile || (profile.role !== 'vendor' && profile.role !== 'planner')) {
      return jsonResponse({ error: 'Only vendors and planners can request reviews.' }, 403);
    }

    let professionalType: 'vendor' | 'planner';
    let professionalName: string;
    let vendorListingId: string | null = null;
    let plannerProfileId: string | null = null;

    if (profile.role === 'vendor') {
      const { data: listing } = await adminClient
        .from('vendor_listings')
        .select('id, business_name, is_approved')
        .eq('user_id', authData.user.id)
        .maybeSingle();
      if (!listing?.is_approved) {
        return jsonResponse({ error: 'Your vendor listing must be approved before requesting reviews.' }, 403);
      }
      professionalType = 'vendor';
      professionalName = listing.business_name;
      vendorListingId = listing.id;
    } else {
      if (!profile.planner_verified) {
        return jsonResponse({ error: 'Your planner profile must be verified before requesting reviews.' }, 403);
      }
      professionalType = 'planner';
      professionalName = profile.company_name?.trim() || profile.full_name?.trim() || 'Wedding planner';
      plannerProfileId = profile.id;
    }

    const token = createToken();
    const tokenHash = await sha256(token);
    const { data: invite, error: inviteError } = await adminClient
      .from('professional_review_invites')
      .insert({
        professional_user_id: authData.user.id,
        professional_type: professionalType,
        vendor_listing_id: vendorListingId,
        planner_profile_id: plannerProfileId,
        professional_name: professionalName,
        couple_name: coupleName,
        couple_email: coupleEmail,
        token_hash: tokenHash,
      })
      .select('id, expires_at')
      .single();
    if (inviteError?.code === '23505') {
      return jsonResponse({ error: 'This email already has an active or completed review invitation for your listing.' }, 409);
    }
    if (inviteError || !invite) throw new Error('Could not create review invitation.');

    const reviewUrl = `${APP_BASE_URL.replace(/\/$/, '')}/review/${encodeURIComponent(token)}`;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      await adminClient.from('professional_review_invites').delete().eq('id', invite.id);
      return jsonResponse({ error: 'Review email delivery is not configured.' }, 500);
    }

    const safeCouple = htmlEscape(coupleName);
    const safeProfessional = htmlEscape(professionalName);
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [coupleEmail],
        subject: `${professionalName} invited you to leave a Zania review`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#3f342d">
            <div style="background:#8b7355;padding:28px;text-align:center;color:#fff">
              <h1 style="margin:0;font-size:22px">Share your experience on Zania</h1>
            </div>
            <div style="padding:30px;border:1px solid #e8e0d8;border-top:0">
              <p>Hi ${safeCouple},</p>
              <p><strong>${safeProfessional}</strong> invited you to leave a verified rating and review on their Zania listing.</p>
              <p>You do not need a Zania account. This private link can be used once and expires in 30 days.</p>
              <p style="margin:28px 0;text-align:center">
                <a href="${reviewUrl}" style="display:inline-block;background:#8b7355;color:#fff;text-decoration:none;padding:13px 24px;border-radius:6px;font-weight:700">Leave a review</a>
              </p>
              <p style="font-size:13px;color:#756b65">Only submit a review based on your genuine experience. Zania may hide content that violates its policies.</p>
            </div>
          </div>`,
      }),
    });

    if (!emailResponse.ok) {
      console.error('Review invitation email failed:', await emailResponse.text());
      await adminClient.from('professional_review_invites').delete().eq('id', invite.id);
      return jsonResponse({ error: 'We could not send the review invitation. Please try again.' }, 502);
    }

    await logFunctionEvent({
      functionName: FUNCTION_NAME,
      severity: 'info',
      status: 'success',
      eventType: 'review_invite_sent',
      message: 'A professional review invitation was sent.',
      userId: authData.user.id,
      audience: professionalType,
      entityId: invite.id,
      requestId,
    });

    return jsonResponse({ success: true, inviteId: invite.id, expiresAt: invite.expires_at });
  } catch (error) {
    if (isAuthSessionError(error)) return jsonResponse({ error: error.message }, error.status);
    if (error instanceof AbuseProtectionError) {
      const headers = error.retryAfterSeconds ? { 'Retry-After': String(error.retryAfterSeconds) } : {};
      return jsonResponse({ error: error.message }, error.status, headers);
    }
    console.error('professional-reviews error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
