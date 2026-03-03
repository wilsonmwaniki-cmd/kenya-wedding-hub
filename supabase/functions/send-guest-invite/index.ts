import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const { guestName, guestEmail, coupleName, weddingDate, weddingLocation, message } = await req.json();

    if (!guestEmail || !guestName) {
      return new Response(JSON.stringify({ error: 'Guest name and email are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dateStr = weddingDate
      ? new Date(weddingDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'TBD';

    const htmlBody = `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e8e0d8;">
        <div style="background: linear-gradient(135deg, #8B7355 0%, #A0926B 100%); padding: 40px 30px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 28px; margin: 0; letter-spacing: 2px;">You're Invited!</h1>
        </div>
        <div style="padding: 40px 30px; color: #4a4a4a; line-height: 1.8;">
          <p style="font-size: 18px;">Dear <strong>${guestName}</strong>,</p>
          <p>We are delighted to invite you to celebrate our wedding${coupleName ? ` — <strong>${coupleName}</strong>` : ''}.</p>
          ${weddingDate ? `<p>📅 <strong>Date:</strong> ${dateStr}</p>` : ''}
          ${weddingLocation ? `<p>📍 <strong>Venue:</strong> ${weddingLocation}</p>` : ''}
          ${message ? `<p style="margin-top: 20px; padding: 15px; background: #f9f6f2; border-left: 3px solid #8B7355; font-style: italic;">${message}</p>` : ''}
          <p style="margin-top: 30px;">We would be honoured to have you join us on our special day. Please let us know if you can attend.</p>
          <p style="margin-top: 30px;">With love and warm regards ❤️</p>
        </div>
        <div style="background: #f9f6f2; padding: 20px 30px; text-align: center; font-size: 12px; color: #999;">
          Sent with love via Kenya Bliss Planner
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
        from: 'Wedding Invite <onboarding@resend.dev>',
        to: [guestEmail],
        subject: `You're Invited${coupleName ? ` — ${coupleName}'s Wedding` : ' to Our Wedding'}!`,
        html: htmlBody,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend error:', data);
      return new Response(JSON.stringify({ error: data.message || 'Failed to send email' }), {
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
