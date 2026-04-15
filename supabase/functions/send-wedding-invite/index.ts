import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type InviteRow = {
  id: string;
  wedding_id: string;
  email: string;
  invite_type: 'partner' | 'committee' | 'planner' | 'viewer';
  proposed_role: string;
  status: string;
  expires_at: string | null;
  created_by_user_id: string | null;
};

type WeddingRow = {
  id: string;
  name: string | null;
  wedding_code: string;
  wedding_date: string | null;
  location_county: string | null;
  location_town: string | null;
};

const friendlyRole = (role: string) => {
  switch (role) {
    case 'bride':
      return 'Bride';
    case 'groom':
      return 'Groom';
    case 'committee_chair':
      return 'Committee Chair';
    case 'committee_member':
      return 'Committee Member';
    default:
      return role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }
};

const formatWeddingDate = (dateValue: string | null) => {
  if (!dateValue) return 'To be confirmed';
  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime())
    ? dateValue
    : parsed.toLocaleDateString('en-KE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
};

serve(async (req) => {
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
    const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'Zania <onboarding@resend.dev>';
    const PUBLIC_APP_URL = Deno.env.get('PUBLIC_APP_URL') || req.headers.get('origin') || 'https://kenya-wedding-hub.vercel.app';

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Supabase environment is not fully configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { inviteId } = await req.json();
    if (!inviteId || typeof inviteId !== 'string') {
      return new Response(JSON.stringify({ error: 'inviteId is required.' }), {
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

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'You must be signed in to send wedding invites.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: inviteData, error: inviteError } = await authClient
      .from('wedding_invites')
      .select('id, wedding_id, email, invite_type, proposed_role, status, expires_at, created_by_user_id')
      .eq('id', inviteId)
      .maybeSingle();

    const invite = inviteData as InviteRow | null;

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ error: 'Invite not found or you do not have access to it.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (invite.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'Only pending invites can be emailed.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: weddingData, error: weddingError } = await authClient
      .from('weddings')
      .select('id, name, wedding_code, wedding_date, location_county, location_town')
      .eq('id', invite.wedding_id)
      .maybeSingle();

    const wedding = weddingData as WeddingRow | null;

    if (weddingError || !wedding) {
      return new Response(JSON.stringify({ error: 'Wedding not found for this invite.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const inviterId = invite.created_by_user_id ?? user.id;
    const [{ data: inviterProfile }, { data: inviterUser }] = await Promise.all([
      serviceClient.from('profiles').select('full_name').eq('user_id', inviterId).maybeSingle(),
      serviceClient.auth.admin.getUserById(inviterId),
    ]);

    const inviterName =
      inviterProfile?.full_name ||
      inviterUser?.user?.user_metadata?.full_name ||
      inviterUser?.user?.email ||
      user.email ||
      'A Zania wedding owner';

    const weddingLabel = wedding.name?.trim() || 'Your wedding';
    const roleLabel = friendlyRole(invite.proposed_role);
    const joinUrl = `${PUBLIC_APP_URL.replace(/\/$/, '')}/auth?flow=join_wedding&code=${encodeURIComponent(
      wedding.wedding_code,
    )}&email=${encodeURIComponent(invite.email)}`;
    const locationLabel = [wedding.location_town, wedding.location_county].filter(Boolean).join(', ');

    const subject =
      invite.invite_type === 'partner'
        ? `Join ${weddingLabel} on Zania as ${roleLabel}`
        : `You’ve been invited to ${weddingLabel} on Zania`;

    const intro =
      invite.invite_type === 'partner'
        ? `${inviterName} invited you to co-own ${weddingLabel} on Zania as the ${roleLabel}.`
        : `${inviterName} invited you to join ${weddingLabel} on Zania as ${roleLabel}.`;

    const roleCopy =
      invite.invite_type === 'partner'
        ? 'As a wedding owner, you will share control over budgets, tasks, vendors, and wedding decisions.'
        : invite.proposed_role === 'committee_chair'
          ? 'As committee chair, you will be able to coordinate committee work and help manage wedding execution.'
          : 'As a committee member, you will be able to collaborate on assigned tasks and delegated wedding work.';

    const html = `
      <div style="font-family: Georgia, serif; max-width: 640px; margin: 0 auto; background: #fffdf9; border: 1px solid #eadfd4; border-radius: 18px; overflow: hidden;">
        <div style="padding: 32px 32px 20px; background: linear-gradient(135deg, #fff8f2 0%, #f7ede4 100%);">
          <div style="font-size: 13px; letter-spacing: 0.2em; text-transform: uppercase; color: #cc6b3d; margin-bottom: 12px;">Zania Wedding Invite</div>
          <h1 style="margin: 0; color: #2f221d; font-size: 30px; line-height: 1.15;">${weddingLabel}</h1>
          <p style="margin: 14px 0 0; color: #5c4a40; font-size: 16px; line-height: 1.7;">${intro}</p>
        </div>
        <div style="padding: 28px 32px 32px;">
          <div style="padding: 18px 20px; border: 1px solid #eedfce; border-radius: 14px; background: #fffaf5; margin-bottom: 22px;">
            <p style="margin: 0 0 8px; color: #8c6f5c; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase;">Your access</p>
            <p style="margin: 0; color: #2f221d; font-size: 20px; font-weight: bold;">${roleLabel}</p>
            <p style="margin: 10px 0 0; color: #5c4a40; font-size: 15px; line-height: 1.7;">${roleCopy}</p>
          </div>

          <div style="display: grid; gap: 12px; margin-bottom: 24px;">
            <div style="padding: 14px 16px; border: 1px solid #f0e5da; border-radius: 12px;">
              <p style="margin: 0 0 4px; color: #8c6f5c; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase;">Wedding code</p>
              <p style="margin: 0; color: #2f221d; font-size: 22px; letter-spacing: 0.18em;">${wedding.wedding_code}</p>
            </div>
            <div style="padding: 14px 16px; border: 1px solid #f0e5da; border-radius: 12px;">
              <p style="margin: 0 0 4px; color: #8c6f5c; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase;">Wedding date</p>
              <p style="margin: 0; color: #2f221d; font-size: 16px;">${formatWeddingDate(wedding.wedding_date)}</p>
            </div>
            ${
              locationLabel
                ? `<div style="padding: 14px 16px; border: 1px solid #f0e5da; border-radius: 12px;">
                    <p style="margin: 0 0 4px; color: #8c6f5c; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase;">Location</p>
                    <p style="margin: 0; color: #2f221d; font-size: 16px;">${locationLabel}</p>
                  </div>`
                : ''
            }
          </div>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${joinUrl}" style="display: inline-block; padding: 14px 26px; border-radius: 999px; background: #dc6834; color: white; text-decoration: none; font-size: 15px; font-weight: bold;">
              Join this wedding in Zania
            </a>
          </div>

          <p style="margin: 0; color: #6b594d; font-size: 14px; line-height: 1.7;">
            If the button does not open directly, go to Zania, choose <strong>Join a wedding</strong>, and enter the code
            <strong> ${wedding.wedding_code}</strong> using <strong>${invite.email}</strong>.
          </p>
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
        to: [invite.email],
        subject,
        html,
      }),
    });

    const resendPayload = await resendResponse.json();
    if (!resendResponse.ok) {
      console.error('send-wedding-invite resend error:', resendPayload);
      return new Response(JSON.stringify({ error: resendPayload.message || 'Failed to send email.' }), {
        status: resendResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await serviceClient
      .from('wedding_invites')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', invite.id);

    return new Response(
      JSON.stringify({
        success: true,
        inviteId: invite.id,
        emailId: resendPayload.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('send-wedding-invite error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
