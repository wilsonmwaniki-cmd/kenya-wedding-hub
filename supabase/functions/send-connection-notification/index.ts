import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { recipientEmail, recipientName, requesterName, message, type } = await req.json();

    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: 'Recipient email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isPlanner = type === 'planner';
    const roleLabel = isPlanner ? 'planner' : 'vendor';
    const subject = `New connection request from ${requesterName || 'a couple'}`;

    const htmlBody = `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e8e0d8;">
        <div style="background: linear-gradient(135deg, #8B7355 0%, #A0926B 100%); padding: 32px 30px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 22px; margin: 0; letter-spacing: 1px;">✨ New Connection Request</h1>
        </div>
        <div style="padding: 32px 30px; color: #4a4a4a; line-height: 1.7;">
          <p style="font-size: 16px;">Hi <strong>${recipientName || roleLabel}</strong>,</p>
          <p><strong>${requesterName || 'Someone'}</strong> is interested in working with you and has sent a connection request.</p>
          ${message ? `
            <div style="margin: 20px 0; padding: 15px; background: #f9f6f2; border-left: 3px solid #8B7355;">
              <p style="margin: 0; font-style: italic; color: #666;">"${message}"</p>
            </div>
          ` : ''}
          <p>Log in to your dashboard to review and respond to this request.</p>
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
