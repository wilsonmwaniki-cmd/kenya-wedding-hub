import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createConnectionResponseToken } from "../_shared/connectionTokens.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ??
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
  '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(
      JSON.stringify({ error: 'Supabase auth configuration is missing' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { recipientEmail, recipientName, requesterName, message, type, requestId } = await req.json();

    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: 'Recipient email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isPlanner = type === 'planner';
    const subject = `New connection request from ${requesterName || 'a couple'}`;

    // Generate signed action links
    let actionButtons = '';
    if (requestId) {
      const baseUrl = Deno.env.get('SUPABASE_URL')!;
      const requestType = isPlanner ? 'planner' : 'vendor';
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

      const acceptUrl = `${baseUrl}/functions/v1/handle-connection-response?id=${requestId}&action=accept&token=${acceptToken}&type=${requestType}&exp=${exp}`;
      const declineUrl = `${baseUrl}/functions/v1/handle-connection-response?id=${requestId}&action=decline&token=${declineToken}&type=${requestType}&exp=${exp}`;

      actionButtons = `
        <div style="margin: 28px 0; text-align: center;">
          <a href="${acceptUrl}" style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #8B7355 0%, #A0926B 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; margin-right: 12px;">
            ✓ Accept
          </a>
          <a href="${declineUrl}" style="display: inline-block; padding: 12px 28px; background: #ffffff; color: #8B7355; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; border: 2px solid #e8e0d8;">
            ✗ Decline
          </a>
        </div>
        <p style="margin: 12px 0 0; color: #999; font-size: 12px; text-align: center;">
          These response links expire in 7 days.
        </p>
      `;
    }

    const htmlBody = `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e8e0d8;">
        <div style="background: linear-gradient(135deg, #8B7355 0%, #A0926B 100%); padding: 32px 30px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 22px; margin: 0; letter-spacing: 1px;">✨ New Connection Request</h1>
        </div>
        <div style="padding: 32px 30px; color: #4a4a4a; line-height: 1.7;">
          <p style="font-size: 16px;">Hi <strong>${recipientName || (isPlanner ? 'Planner' : 'Vendor')}</strong>,</p>
          <p><strong>${requesterName || 'Someone'}</strong> is interested in working with you and has sent a connection request.</p>
          ${message ? `
            <div style="margin: 20px 0; padding: 15px; background: #f9f6f2; border-left: 3px solid #8B7355;">
              <p style="margin: 0; font-style: italic; color: #666;">"${message}"</p>
            </div>
          ` : ''}
          ${actionButtons || '<p>Log in to your dashboard to review and respond to this request.</p>'}
          <p style="margin-top: 24px; color: #999; font-size: 14px;">Don't keep them waiting — great connections start with a quick reply! 💍</p>
        </div>
        <div style="background: #f9f6f2; padding: 16px 30px; text-align: center; font-size: 12px; color: #999;">
          Sent via Kenya Bliss Planner
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
        from: 'Kenya Bliss Planner <onboarding@resend.dev>',
        to: [recipientEmail],
        subject,
        html: htmlBody,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend error:', data);
      return new Response(JSON.stringify({ error: data.message || 'Failed to send' }), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
