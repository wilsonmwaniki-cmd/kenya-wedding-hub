import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all timelines happening today
    const today = new Date().toISOString().split("T")[0];
    const { data: timelines } = await supabase
      .from("timelines")
      .select("id, title, timeline_date")
      .eq("timeline_date", today)
      .eq("is_template", false);

    if (!timelines?.length) {
      return new Response(JSON.stringify({ message: "No timelines today" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let sentCount = 0;

    for (const timeline of timelines) {
      // Get events happening in 30 minutes
      const { data: events } = await supabase
        .from("timeline_events")
        .select("id, title, event_time, assigned_people")
        .eq("timeline_id", timeline.id);

      if (!events?.length) continue;

      for (const event of events) {
        const [h, m] = event.event_time.split(":").map(Number);
        const eventMinutes = h * 60 + m;
        const minutesUntil = eventMinutes - currentMinutes;

        // Send reminder 30 minutes before
        if (minutesUntil >= 25 && minutesUntil <= 35) {
          // Get share links for assigned people to find their emails
          for (const person of event.assigned_people) {
            const { data: shareLink } = await supabase
              .from("timeline_share_links")
              .select("email, vendor_role, assignee_name")
              .eq("timeline_id", timeline.id)
              .eq("assignee_name", person)
              .single();

            if (shareLink?.email && RESEND_API_KEY) {
              const roleLabel = shareLink.vendor_role
                ? shareLink.vendor_role.charAt(0).toUpperCase() + shareLink.vendor_role.slice(1)
                : "Team Member";

              // Send email reminder
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                  from: "WeddingPlan Kenya <onboarding@resend.dev>",
                  to: [shareLink.email],
                  subject: `⏰ Reminder: ${event.title} in 30 minutes`,
                  html: `
                    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
                      <div style="text-align: center; margin-bottom: 24px;">
                        <p style="color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">WeddingPlan Kenya</p>
                      </div>
                      <div style="background: #f9f9f9; border-radius: 12px; padding: 24px; text-align: center;">
                        <p style="font-size: 14px; color: #666; margin: 0 0 8px;">Hey ${shareLink.assignee_name} 👋</p>
                        <h1 style="font-size: 24px; color: #333; margin: 0 0 4px;">⏰ ${event.title}</h1>
                        <p style="font-size: 16px; color: #666; margin: 0 0 16px;">starts in <strong>30 minutes</strong></p>
                        <div style="background: white; border-radius: 8px; padding: 16px; display: inline-block;">
                          <p style="font-size: 28px; font-weight: bold; color: #7c3aed; margin: 0;">
                            ${event.event_time.slice(0, 5)}
                          </p>
                        </div>
                        <p style="font-size: 13px; color: #888; margin: 16px 0 0;">${timeline.title} · ${roleLabel}</p>
                      </div>
                    </div>
                  `,
                }),
              });
              sentCount++;
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ message: `Sent ${sentCount} reminders` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
