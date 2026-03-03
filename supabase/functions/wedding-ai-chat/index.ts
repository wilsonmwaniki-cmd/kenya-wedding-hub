import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const tools = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a new wedding planning task for the user",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title" },
          due_date: { type: "string", description: "Due date in YYYY-MM-DD format (optional)" },
          assigned_to: { type: "string", description: "Who to assign the task to (optional)" },
          description: { type: "string", description: "Task description (optional)" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_task",
      description: "Mark a task as completed by its title (fuzzy match)",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The title (or partial title) of the task to complete" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description: "Delete a task by its title (fuzzy match)",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The title (or partial title) of the task to delete" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_budget_category",
      description: "Add a new budget category with an allocated amount",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Budget category name (e.g. Catering, Photography)" },
          allocated: { type: "number", description: "Amount allocated in KES" },
        },
        required: ["name", "allocated"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_budget_spent",
      description: "Update the spent amount for a budget category",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Budget category name (fuzzy match)" },
          spent: { type: "number", description: "New total spent amount in KES" },
        },
        required: ["name", "spent"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_guest",
      description: "Add a new guest to the guest list",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Guest name" },
          email: { type: "string", description: "Guest email (optional)" },
          phone: { type: "string", description: "Guest phone (optional)" },
          rsvp_status: { type: "string", enum: ["pending", "confirmed", "declined"], description: "RSVP status (default: pending)" },
          plus_one: { type: "boolean", description: "Whether guest has a plus one" },
          meal_preference: { type: "string", description: "Meal preference (optional)" },
          table_number: { type: "integer", description: "Table number (optional)" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_guest_rsvp",
      description: "Update a guest's RSVP status by name",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Guest name (fuzzy match)" },
          rsvp_status: { type: "string", enum: ["pending", "confirmed", "declined"], description: "New RSVP status" },
        },
        required: ["name", "rsvp_status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_guest",
      description: "Remove a guest from the guest list by name",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Guest name (fuzzy match)" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
];

// Fuzzy match: case-insensitive contains
function fuzzyFind<T extends Record<string, any>>(items: T[], field: string, query: string): T | undefined {
  const q = query.toLowerCase();
  return items.find((item) => (item[field] as string)?.toLowerCase().includes(q)) ||
    items.find((item) => (item[field] as string)?.toLowerCase() === q);
}

async function executeTool(
  name: string,
  args: Record<string, any>,
  supabase: any,
  userId: string,
  clientId: string | null,
): Promise<string> {
  try {
    switch (name) {
      case "create_task": {
        const insert: any = { user_id: userId, title: args.title };
        if (args.due_date) insert.due_date = args.due_date;
        if (args.assigned_to) insert.assigned_to = args.assigned_to;
        if (args.description) insert.description = args.description;
        if (clientId) insert.client_id = clientId;
        const { error } = await supabase.from("tasks").insert(insert);
        if (error) return `Error creating task: ${error.message}`;
        return `✅ Task "${args.title}" created${args.due_date ? ` (due: ${args.due_date})` : ""}${args.assigned_to ? ` [assigned to ${args.assigned_to}]` : ""}`;
      }
      case "complete_task": {
        const { data: tasks } = await supabase.from("tasks").select("id, title").eq("user_id", userId).eq("completed", false);
        const task = fuzzyFind(tasks || [], "title", args.title);
        if (!task) return `Could not find a pending task matching "${args.title}"`;
        await supabase.from("tasks").update({ completed: true }).eq("id", task.id);
        return `✅ Task "${task.title}" marked as completed`;
      }
      case "delete_task": {
        const { data: tasks } = await supabase.from("tasks").select("id, title").eq("user_id", userId);
        const task = fuzzyFind(tasks || [], "title", args.title);
        if (!task) return `Could not find a task matching "${args.title}"`;
        await supabase.from("tasks").delete().eq("id", task.id);
        return `🗑️ Task "${task.title}" deleted`;
      }
      case "add_budget_category": {
        const insert: any = { user_id: userId, name: args.name, allocated: args.allocated };
        if (clientId) insert.client_id = clientId;
        const { error } = await supabase.from("budget_categories").insert(insert);
        if (error) return `Error adding budget category: ${error.message}`;
        return `✅ Budget category "${args.name}" added with KES ${Number(args.allocated).toLocaleString()} allocated`;
      }
      case "update_budget_spent": {
        const { data: cats } = await supabase.from("budget_categories").select("id, name").eq("user_id", userId);
        const cat = fuzzyFind(cats || [], "name", args.name);
        if (!cat) return `Could not find a budget category matching "${args.name}"`;
        await supabase.from("budget_categories").update({ spent: args.spent }).eq("id", cat.id);
        return `✅ "${cat.name}" spent updated to KES ${Number(args.spent).toLocaleString()}`;
      }
      case "add_guest": {
        const insert: any = { user_id: userId, name: args.name };
        if (args.email) insert.email = args.email;
        if (args.phone) insert.phone = args.phone;
        if (args.rsvp_status) insert.rsvp_status = args.rsvp_status;
        if (args.plus_one !== undefined) insert.plus_one = args.plus_one;
        if (args.meal_preference) insert.meal_preference = args.meal_preference;
        if (args.table_number !== undefined) insert.table_number = args.table_number;
        if (clientId) insert.client_id = clientId;
        const { error } = await supabase.from("guests").insert(insert);
        if (error) return `Error adding guest: ${error.message}`;
        return `✅ Guest "${args.name}" added to the guest list`;
      }
      case "update_guest_rsvp": {
        const { data: guests } = await supabase.from("guests").select("id, name").eq("user_id", userId);
        const guest = fuzzyFind(guests || [], "name", args.name);
        if (!guest) return `Could not find a guest matching "${args.name}"`;
        await supabase.from("guests").update({ rsvp_status: args.rsvp_status }).eq("id", guest.id);
        return `✅ ${guest.name}'s RSVP updated to "${args.rsvp_status}"`;
      }
      case "remove_guest": {
        const { data: guests } = await supabase.from("guests").select("id, name").eq("user_id", userId);
        const guest = fuzzyFind(guests || [], "name", args.name);
        if (!guest) return `Could not find a guest matching "${args.name}"`;
        await supabase.from("guests").delete().eq("id", guest.id);
        return `🗑️ Guest "${guest.name}" removed from the guest list`;
      }
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (e) {
    return `Error executing ${name}: ${e instanceof Error ? e.message : "Unknown error"}`;
  }
}

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
    const tasksList = tasksRes.data || [];
    const budget = budgetRes.data || [];
    const guests = guestsRes.data || [];
    const vendors = vendorsRes.data || [];
    const role = roleRes.data?.role || "couple";

    const today = new Date().toISOString().slice(0, 10);
    const pendingTasks = tasksList.filter((t: any) => !t.completed);
    const completedTasks = tasksList.filter((t: any) => t.completed);
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

    // Planner context
    let plannerContext = "";
    let clientId: string | null = null;
    if (role === "planner") {
      const { data: clients } = await supabase.from("planner_clients").select("*").eq("planner_user_id", user.id);
      if (clients && clients.length > 0) {
        plannerContext = `\n\n## Your Clients (${clients.length}):\n` +
          clients.map((c: any) =>
            `- ${c.client_name}${c.partner_name ? ` & ${c.partner_name}` : ""}: Wedding ${c.wedding_date || "TBD"} at ${c.wedding_location || "TBD"}${c.linked_user_id ? " (linked)" : ""}`
          ).join("\n");
      }
    }

    const systemPrompt = `You are a smart, friendly Kenyan wedding planning assistant for the PenziPlanner app. You have access to the user's real wedding data AND you can take actions using tools.

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
- You CAN now take actions! Use your tools to create tasks, manage budget, and manage guests when the user asks.
- When asked to do something (add a task, update budget, add a guest, etc.), USE the appropriate tool immediately — don't just suggest.
- Confirm each action you take with a brief summary.
- If asked about dates or deadlines, check their task due dates and wedding date.
- Suggest task assignments when appropriate.
- Give budget advice based on their actual spending.
- Be warm, encouraging, and culturally aware of Kenyan wedding traditions.
- Use KES for currency.
- Keep answers concise but helpful. Use markdown formatting.`;

    // Non-streaming tool-calling loop
    let aiMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const MAX_TOOL_ROUNDS = 5;
    let finalContent = "";

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: aiMessages,
          tools,
          stream: false,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up in Settings." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        return new Response(JSON.stringify({ error: "AI service unavailable" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      if (!choice) break;

      const msg = choice.message;
      aiMessages.push(msg);

      // Check for tool calls
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          const fnName = tc.function.name;
          let fnArgs: Record<string, any> = {};
          try {
            fnArgs = JSON.parse(tc.function.arguments);
          } catch { /* empty */ }

          const result = await executeTool(fnName, fnArgs, supabase, user.id, clientId);
          aiMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result,
          });
        }
        // Continue the loop so the model can respond after seeing tool results
        continue;
      }

      // No tool calls — we have the final response
      finalContent = msg.content || "";
      break;
    }

    return new Response(JSON.stringify({ content: finalContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
