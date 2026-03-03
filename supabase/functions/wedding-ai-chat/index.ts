import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create authenticated supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();

    // Fetch user's wedding data in parallel for context
    const [profileRes, tasksRes, budgetRes, guestsRes, vendorsRes, roleRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
      supabase.from("tasks").select("*").eq("user_id", user.id).order("due_date", { ascending: true, nullsFirst: false }).limit(50),
      supabase.from("budget_categories").select("*").eq("user_id", user.id),
      supabase.from("guests").select("*").eq("user_id", user.id).limit(100),
      supabase.from("vendors").select("*").eq("user_id", user.id),
      supabase.from("user_roles").select("role").eq("user_id", user.id).single(),
    ]);

    const profile = profileRes.data;
    const tasks = tasksRes.data || [];
    const budget = budgetRes.data || [];
    const guests = guestsRes.data || [];
    const vendors = vendorsRes.data || [];
    const role = roleRes.data?.role || "couple";

    // Build context summary
    const today = new Date().toISOString().slice(0, 10);
    const pendingTasks = tasks.filter((t: any) => !t.completed);
    const completedTasks = tasks.filter((t: any) => t.completed);
    const overdueTasks = pendingTasks.filter((t: any) => t.due_date && t.due_date < today);
    const totalAllocated = budget.reduce((s: number, b: any) => s + Number(b.allocated), 0);
    const totalSpent = budget.reduce((s: number, b: any) => s + Number(b.spent), 0);
    const confirmedGuests = guests.filter((g: any) => g.rsvp_status === "confirmed").length;
    const pendingGuests = guests.filter((g: any) => g.rsvp_status === "pending").length;

    let weddingCountdown = "";
    if (profile?.wedding_date) {
      const diff = Math.ceil((new Date(profile.wedding_date).getTime() - Date.now()) / 86400000);
      weddingCountdown = diff > 0 ? `${diff} days until the wedding (${profile.wedding_date})` : `Wedding date was ${profile.wedding_date}`;
    }

    // Also fetch planner-specific data if role is planner
    let plannerContext = "";
    if (role === "planner") {
      const { data: clients } = await supabase
        .from("planner_clients")
        .select("*")
        .eq("planner_user_id", user.id);
      if (clients && clients.length > 0) {
        plannerContext = `\n\n## Your Clients (${clients.length}):\n` +
          clients.map((c: any) =>
            `- ${c.client_name}${c.partner_name ? ` & ${c.partner_name}` : ""}: Wedding ${c.wedding_date || "TBD"} at ${c.wedding_location || "TBD"}${c.linked_user_id ? " (linked)" : ""}`
          ).join("\n");
      }
    }

    const systemPrompt = `You are a smart, friendly Kenyan wedding planning assistant for the PenziPlanner app. You have access to the user's real wedding data. Use it to give specific, actionable advice.

Today's date: ${today}
User role: ${role}
${profile?.full_name ? `Name: ${profile.full_name}` : ""}
${profile?.partner_name ? `Partner: ${profile.partner_name}` : ""}
${weddingCountdown}
${profile?.wedding_location ? `Location: ${profile.wedding_location}` : ""}

## Tasks (${pendingTasks.length} pending, ${completedTasks.length} done${overdueTasks.length > 0 ? `, ${overdueTasks.length} OVERDUE` : ""}):
${pendingTasks.slice(0, 20).map((t: any) => `- ${t.completed ? "✅" : "⬜"} ${t.title}${t.due_date ? ` (due: ${t.due_date})` : ""}${t.assigned_to ? ` [assigned: ${t.assigned_to}]` : ""}`).join("\n") || "No tasks yet."}

## Budget (Allocated: KES ${totalAllocated.toLocaleString()}, Spent: KES ${totalSpent.toLocaleString()}, Remaining: KES ${(totalAllocated - totalSpent).toLocaleString()}):
${budget.map((b: any) => `- ${b.name}: allocated KES ${Number(b.allocated).toLocaleString()}, spent KES ${Number(b.spent).toLocaleString()}`).join("\n") || "No budget categories."}

## Guest List (${guests.length} total, ${confirmedGuests} confirmed, ${pendingGuests} pending RSVP):
${guests.length > 0 ? `Names include: ${guests.slice(0, 15).map((g: any) => `${g.name} (${g.rsvp_status})`).join(", ")}${guests.length > 15 ? "..." : ""}` : "No guests added yet."}

## Vendors (${vendors.length}):
${vendors.map((v: any) => `- ${v.name} (${v.category}) — ${v.status}${v.price ? `, KES ${Number(v.price).toLocaleString()}` : ""}`).join("\n") || "No vendors yet."}
${plannerContext}

Guidelines:
- Reference the user's actual data when answering questions.
- If asked about dates or deadlines, check their task due dates and wedding date.
- Suggest task assignments when appropriate.
- Give budget advice based on their actual spending.
- Be warm, encouraging, and culturally aware of Kenyan wedding traditions.
- Use KES for currency.
- Keep answers concise but helpful. Use markdown formatting.
- You CANNOT modify data directly — suggest what the user should do in the app.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up in Settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
