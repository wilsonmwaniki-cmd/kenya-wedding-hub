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
      description: "Create a new wedding planning task in the active workspace",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title" },
          due_date: { type: "string", description: "Due date in YYYY-MM-DD format (optional)" },
          assigned_to: { type: "string", description: "Who should handle this task (optional)" },
          description: { type: "string", description: "Task description (optional)" },
          category: { type: "string", description: "Task category such as Photographer, Catering, Decor, Legal, Records, Transport (optional)" },
          priority_level: { type: "integer", description: "Priority from 1 (highest) to 5 (lowest) (optional)" },
          visibility: { type: "string", enum: ["public", "private"], description: "Whether the task is public or private (optional)" },
          source_vendor_name: { type: "string", description: "Vendor name to link the task to, if relevant (optional)" },
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
      description: "Mark a task as completed by its title",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title or partial task title" },
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
      description: "Delete a task by its title",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title or partial task title" },
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
      description: "Add a budget category with an allocation",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Budget category name" },
          allocated: { type: "number", description: "Allocated amount in KES" },
          budget_scope: { type: "string", enum: ["wedding", "personal"], description: "Whether this is a wedding or personal budget category" },
          visibility: { type: "string", enum: ["public", "private"], description: "Whether the category is public or private" },
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
          name: { type: "string", description: "Budget category name or partial name" },
          spent: { type: "number", description: "New spent amount in KES" },
        },
        required: ["name", "spent"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_budget_payment",
      description: "Record a payment against a budget category and optionally a linked vendor",
      parameters: {
        type: "object",
        properties: {
          category_name: { type: "string", description: "Budget category name" },
          amount: { type: "number", description: "Payment amount in KES" },
          payee_name: { type: "string", description: "Who was paid if no vendor was linked (optional)" },
          vendor_name: { type: "string", description: "Vendor name to match in the active workspace (optional)" },
          payment_date: { type: "string", description: "Payment date in YYYY-MM-DD format (optional)" },
          reference: { type: "string", description: "Payment reference such as M-PESA code (optional)" },
          notes: { type: "string", description: "Extra payment notes (optional)" },
        },
        required: ["category_name", "amount"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_guest",
      description: "Add a guest to the guest list",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Guest name" },
          email: { type: "string", description: "Guest email (optional)" },
          phone: { type: "string", description: "Guest phone number (optional)" },
          rsvp_status: { type: "string", enum: ["pending", "confirmed", "declined"], description: "RSVP state" },
          plus_one: { type: "boolean", description: "Whether the guest has a plus one" },
          meal_preference: { type: "string", description: "Meal preference (optional)" },
          table_number: { type: "integer", description: "Assigned table number (optional)" },
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
      description: "Update a guest RSVP by name",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Guest name or partial guest name" },
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
          name: { type: "string", description: "Guest name or partial guest name" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_vendor",
      description: "Add a vendor to the wedding vendor tracker",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Vendor or business name" },
          category: { type: "string", description: "Vendor category" },
          email: { type: "string", description: "Vendor email (optional)" },
          phone: { type: "string", description: "Vendor phone number (optional)" },
          price: { type: "number", description: "Quoted contract amount in KES (optional)" },
          notes: { type: "string", description: "Internal notes (optional)" },
          status: { type: "string", enum: ["contacted", "confirmed", "declined", "pending"], description: "Vendor status" },
        },
        required: ["name", "category"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_vendor_status",
      description: "Update a vendor's status by name",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Vendor name or partial vendor name" },
          status: { type: "string", enum: ["contacted", "confirmed", "declined", "pending"], description: "New vendor status" },
        },
        required: ["name", "status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_vendor_price",
      description: "Update a vendor's quoted price by name",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Vendor name or partial vendor name" },
          price: { type: "number", description: "Quoted price in KES" },
        },
        required: ["name", "price"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_vendor",
      description: "Remove a vendor from the wedding vendor tracker by name",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Vendor name or partial vendor name" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_timeline_event",
      description: "Add an event to the active wedding timeline",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Timeline event title" },
          event_time: { type: "string", description: "Time in HH:MM or HH:MM:SS format" },
          description: { type: "string", description: "Event details (optional)" },
          category: { type: "string", description: "Timeline category such as prep, ceremony, reception, transport, photo, food, entertainment, other (optional)" },
          assigned_people: {
            type: "array",
            items: { type: "string" },
            description: "People or roles assigned to this event (optional)",
          },
          timeline_title: { type: "string", description: "Specific timeline title to use or create (optional)" },
        },
        required: ["title", "event_time"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_vendor_internal_notes",
      description: "Save or replace private internal notes for a vendor booking matched by the couple's name",
      parameters: {
        type: "object",
        properties: {
          couple_name: { type: "string", description: "Couple name for the booking" },
          notes: { type: "string", description: "Private internal notes to save for this booking" },
        },
        required: ["couple_name", "notes"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_vendor_follow_up_reminder",
      description: "Create a private follow-up reminder for a vendor booking matched by the couple's name",
      parameters: {
        type: "object",
        properties: {
          couple_name: { type: "string", description: "Couple name for the booking" },
          title: { type: "string", description: "Reminder title" },
          due_date: { type: "string", description: "Reminder due date in YYYY-MM-DD format (optional)" },
          notes: { type: "string", description: "Reminder notes (optional)" },
        },
        required: ["couple_name", "title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_vendor_follow_up_reminder_status",
      description: "Mark a vendor follow-up reminder as open or completed for a booking matched by the couple's name",
      parameters: {
        type: "object",
        properties: {
          couple_name: { type: "string", description: "Couple name for the booking" },
          title: { type: "string", description: "Reminder title or partial title" },
          status: { type: "string", enum: ["open", "completed"], description: "Reminder status" },
        },
        required: ["couple_name", "title", "status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_vendor_booking_status",
      description: "Update a vendor booking status matched by the couple's name",
      parameters: {
        type: "object",
        properties: {
          couple_name: { type: "string", description: "Couple name for the booking" },
          status: {
            type: "string",
            enum: ["contacted", "quoted", "booked", "completed", "rejected"],
            description: "New booking status",
          },
        },
        required: ["couple_name", "status"],
        additionalProperties: false,
      },
    },
  },
];

function fuzzyFind<T extends Record<string, any>>(items: T[], field: string, query: string): T | undefined {
  const q = query.toLowerCase().trim();
  return items.find((item) => String(item[field] ?? "").toLowerCase() === q) ||
    items.find((item) => String(item[field] ?? "").toLowerCase().includes(q));
}

function isActiveStatus(status?: string | null, expiresAt?: string | null) {
  if (status !== "active") return false;
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

function normalizeTime(value: string) {
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  return trimmed;
}

function formatCurrency(value: number) {
  return `KES ${Number(value || 0).toLocaleString()}`;
}

function scopedSelect(supabase: any, table: string, select: string, workspaceOrFilter: string | null) {
  const query = supabase.from(table).select(select);
  return workspaceOrFilter ? query.or(workspaceOrFilter) : query.limit(0);
}

function getPlanningWriteBlock(role: string, plannerType: string | null, writeClientId: string | null) {
  if (role === "vendor") {
    return "Planning workspace write tools are not available in the vendor assistant.";
  }
  if (role === "admin") {
    return "The admin assistant is currently read-only. Use a real role workspace to make planning changes.";
  }
  if (role === "planner" && plannerType !== "committee" && !writeClientId) {
    return "Select a client in My Weddings first so I know which wedding workspace to update.";
  }
  return null;
}

function getVendorWriteBlock(role: string, vendorListingId: string | null) {
  if (role !== "vendor") {
    return "Vendor booking tools are only available in the vendor assistant.";
  }
  if (!vendorListingId) {
    return "Create your vendor listing first so I can attach reminders, notes, and booking updates to real bookings.";
  }
  return null;
}

function getVendorPaymentStatus(nextPaid: number, contractAmount: number | null, currentStatus?: string | null) {
  if (contractAmount && nextPaid >= contractAmount) return "paid_full";
  if (nextPaid > 0) return "part_paid";
  return currentStatus || "unpaid";
}

async function findVendorBookingByCoupleName(
  supabase: any,
  vendorListingId: string,
  coupleName: string,
) {
  const { data: bookings, error: bookingsError } = await supabase
    .from("vendors")
    .select("id, user_id, category, status, vendor_internal_notes")
    .eq("vendor_listing_id", vendorListingId)
    .limit(200);

  if (bookingsError) {
    throw new Error(bookingsError.message);
  }

  if (!bookings?.length) return null;

  const bookingRows = bookings as Record<string, any>[];
  const userIds = [...new Set(bookingRows.map((booking) => booking.user_id).filter(Boolean))];
  const { data: profiles, error: profilesError } = userIds.length
    ? await supabase.from("profiles").select("user_id, full_name, wedding_date, wedding_location").in("user_id", userIds)
    : { data: [], error: null };

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const profileMap = new Map(
    ((profiles || []) as Record<string, any>[]).map((profile) => [profile.user_id, profile]),
  );

  const decorated = bookingRows.map((booking) => {
    const profile = profileMap.get(booking.user_id);
    return {
      ...booking,
      couple_name: profile?.full_name || "Unknown couple",
      wedding_date: profile?.wedding_date || null,
      wedding_location: profile?.wedding_location || null,
    };
  });

  return fuzzyFind(decorated, "couple_name", coupleName) || null;
}

type ToolContext = {
  supabase: any;
  userId: string;
  role: string;
  plannerType: string | null;
  vendorListingId: string | null;
  workspaceOrFilter: string | null;
  writeClientId: string | null;
  today: string;
  profile: Record<string, any> | null;
};

type PendingWriteAction = {
  toolName: string;
  args: Record<string, any>;
  summary: string;
  destructive: boolean;
};

const WRITE_TOOL_NAMES = new Set([
  "create_task",
  "complete_task",
  "delete_task",
  "add_budget_category",
  "update_budget_spent",
  "record_budget_payment",
  "add_guest",
  "update_guest_rsvp",
  "remove_guest",
  "add_vendor",
  "update_vendor_status",
  "update_vendor_price",
  "remove_vendor",
  "create_timeline_event",
  "update_vendor_internal_notes",
  "create_vendor_follow_up_reminder",
  "update_vendor_follow_up_reminder_status",
  "update_vendor_booking_status",
]);

function isWriteTool(name: string) {
  return WRITE_TOOL_NAMES.has(name);
}

function summarizePendingAction(name: string, args: Record<string, any>) {
  switch (name) {
    case "create_task":
      return `Create task "${args.title}"${args.due_date ? ` due ${args.due_date}` : ""}${args.category ? ` in ${args.category}` : ""}`;
    case "complete_task":
      return `Mark task "${args.title}" as completed`;
    case "delete_task":
      return `Delete task "${args.title}"`;
    case "add_budget_category":
      return `Add budget category "${args.name}" with ${formatCurrency(args.allocated)}`;
    case "update_budget_spent":
      return `Update budget spent for "${args.name}" to ${formatCurrency(args.spent)}`;
    case "record_budget_payment":
      return `Record ${formatCurrency(args.amount)} against "${args.category_name}"${args.vendor_name ? ` for ${args.vendor_name}` : ""}`;
    case "add_guest":
      return `Add guest "${args.name}"`;
    case "update_guest_rsvp":
      return `Update RSVP for "${args.name}" to ${args.rsvp_status}`;
    case "remove_guest":
      return `Remove guest "${args.name}"`;
    case "add_vendor":
      return `Add vendor "${args.name}" in ${args.category}`;
    case "update_vendor_status":
      return `Update vendor "${args.name}" to ${args.status}`;
    case "update_vendor_price":
      return `Update vendor "${args.name}" quote to ${formatCurrency(args.price)}`;
    case "remove_vendor":
      return `Remove vendor "${args.name}"`;
    case "create_timeline_event":
      return `Add timeline event "${args.title}" at ${args.event_time}`;
    case "update_vendor_internal_notes":
      return `Save private internal notes for ${args.couple_name}`;
    case "create_vendor_follow_up_reminder":
      return `Create follow-up reminder "${args.title}" for ${args.couple_name}${args.due_date ? ` due ${args.due_date}` : ""}`;
    case "update_vendor_follow_up_reminder_status":
      return `Mark follow-up reminder "${args.title}" as ${args.status} for ${args.couple_name}`;
    case "update_vendor_booking_status":
      return `Update booking status for ${args.couple_name} to ${args.status}`;
    default:
      return `Run ${name}`;
  }
}

async function executeTool(name: string, args: Record<string, any>, context: ToolContext): Promise<string> {
  const { supabase, userId, role, plannerType, vendorListingId, workspaceOrFilter, writeClientId, today, profile } = context;
  const planningWriteBlock = getPlanningWriteBlock(role, plannerType, writeClientId);
  const vendorWriteBlock = getVendorWriteBlock(role, vendorListingId);

  try {
    switch (name) {
      case "create_task": {
        if (planningWriteBlock) return planningWriteBlock;

        let sourceVendorId: string | null = null;
        if (args.source_vendor_name && workspaceOrFilter) {
          const { data: vendors } = await scopedSelect(
            supabase,
            "vendors",
            "id, name",
            workspaceOrFilter,
          ).order("name");
          sourceVendorId = fuzzyFind(vendors || [], "name", args.source_vendor_name)?.id ?? null;
        }

        const insert: Record<string, any> = {
          user_id: userId,
          title: args.title,
          client_id: writeClientId,
        };

        if (args.due_date) insert.due_date = args.due_date;
        if (args.assigned_to) insert.assigned_to = args.assigned_to;
        if (args.description) insert.description = args.description;
        if (args.category) insert.category = args.category;
        if (typeof args.priority_level === "number") insert.priority_level = args.priority_level;
        if (args.visibility) insert.visibility = args.visibility;
        if (sourceVendorId) insert.source_vendor_id = sourceVendorId;

        const { error } = await supabase.from("tasks").insert(insert);
        if (error) return `Error creating task: ${error.message}`;

        return `✅ Created task "${args.title}"${args.due_date ? ` due ${args.due_date}` : ""}${args.category ? ` in ${args.category}` : ""}.`;
      }

      case "complete_task": {
        if (planningWriteBlock) return planningWriteBlock;

        const { data: tasks } = await scopedSelect(
          supabase,
          "tasks",
          "id, title, completed",
          workspaceOrFilter,
        ).eq("completed", false);
        const task = fuzzyFind(tasks || [], "title", args.title);
        if (!task) return `Could not find a pending task matching "${args.title}".`;
        const { error } = await supabase.from("tasks").update({ completed: true }).eq("id", task.id);
        if (error) return `Error completing task: ${error.message}`;
        return `✅ Marked "${task.title}" as completed.`;
      }

      case "delete_task": {
        if (planningWriteBlock) return planningWriteBlock;

        const { data: tasks } = await scopedSelect(
          supabase,
          "tasks",
          "id, title",
          workspaceOrFilter,
        );
        const task = fuzzyFind(tasks || [], "title", args.title);
        if (!task) return `Could not find a task matching "${args.title}".`;
        const { error } = await supabase.from("tasks").delete().eq("id", task.id);
        if (error) return `Error deleting task: ${error.message}`;
        return `🗑️ Deleted task "${task.title}".`;
      }

      case "add_budget_category": {
        if (planningWriteBlock) return planningWriteBlock;

        const insert: Record<string, any> = {
          user_id: userId,
          client_id: writeClientId,
          name: args.name,
          allocated: args.allocated,
          budget_scope: args.budget_scope || "wedding",
        };
        if (args.visibility) insert.visibility = args.visibility;

        const { error } = await supabase.from("budget_categories").insert(insert);
        if (error) return `Error adding budget category: ${error.message}`;
        return `✅ Added ${args.name} with ${formatCurrency(args.allocated)} allocated.`;
      }

      case "update_budget_spent": {
        if (planningWriteBlock) return planningWriteBlock;

        const { data: categories } = await scopedSelect(
          supabase,
          "budget_categories",
          "id, name",
          workspaceOrFilter,
        );
        const category = fuzzyFind(categories || [], "name", args.name);
        if (!category) return `Could not find a budget category matching "${args.name}".`;
        const { error } = await supabase.from("budget_categories").update({ spent: args.spent }).eq("id", category.id);
        if (error) return `Error updating budget: ${error.message}`;
        return `✅ Updated ${category.name} spent to ${formatCurrency(args.spent)}.`;
      }

      case "record_budget_payment": {
        if (planningWriteBlock) return planningWriteBlock;

        const { data: categories } = await scopedSelect(
          supabase,
          "budget_categories",
          "id, name, spent, budget_scope",
          workspaceOrFilter,
        ).order("name");
        const category = fuzzyFind(categories || [], "name", args.category_name);
        if (!category) return `Could not find a budget category matching "${args.category_name}".`;

        let vendor: Record<string, any> | null = null;
        if (args.vendor_name) {
          const { data: vendors } = await scopedSelect(
            supabase,
            "vendors",
            "id, name, price, amount_paid, payment_status, payment_due_date",
            workspaceOrFilter,
          ).order("name");
          vendor = fuzzyFind(vendors || [], "name", args.vendor_name) ?? null;
          if (!vendor) return `Could not find a vendor matching "${args.vendor_name}".`;
        }

        const amount = Number(args.amount || 0);
        const paymentDate = args.payment_date || today;
        const payeeName = vendor?.name || args.payee_name || category.name;

        const { error: insertError } = await supabase.from("budget_payments").insert({
          user_id: userId,
          client_id: writeClientId,
          budget_category_id: category.id,
          vendor_id: vendor?.id ?? null,
          budget_scope: category.budget_scope || "wedding",
          category_name: category.name,
          payee_name: payeeName,
          amount,
          payment_date: paymentDate,
          reference: args.reference || null,
          notes: args.notes || null,
        });
        if (insertError) return `Error recording payment: ${insertError.message}`;

        const nextSpent = Number(category.spent || 0) + amount;
        const { error: categoryError } = await supabase
          .from("budget_categories")
          .update({ spent: nextSpent })
          .eq("id", category.id);
        if (categoryError) return `Payment was recorded, but budget update failed: ${categoryError.message}`;

        if (vendor) {
          const nextPaid = Number(vendor.amount_paid || 0) + amount;
          const nextStatus = getVendorPaymentStatus(nextPaid, vendor.price != null ? Number(vendor.price) : null, vendor.payment_status);
          const { error: vendorError } = await supabase
            .from("vendors")
            .update({
              amount_paid: nextPaid,
              payment_status: nextStatus,
              last_payment_at: paymentDate,
            })
            .eq("id", vendor.id);
          if (vendorError) return `Payment recorded for the budget, but vendor payment state failed: ${vendorError.message}`;
        }

        return `✅ Recorded ${formatCurrency(amount)} for ${category.name}${vendor ? ` and updated ${vendor.name}'s payment history` : ""}.`;
      }

      case "add_guest": {
        if (planningWriteBlock) return planningWriteBlock;

        const insert: Record<string, any> = { user_id: userId, name: args.name, client_id: writeClientId };
        if (args.email) insert.email = args.email;
        if (args.phone) insert.phone = args.phone;
        if (args.rsvp_status) insert.rsvp_status = args.rsvp_status;
        if (typeof args.plus_one === "boolean") insert.plus_one = args.plus_one;
        if (args.meal_preference) insert.meal_preference = args.meal_preference;
        if (typeof args.table_number === "number") insert.table_number = args.table_number;

        const { error } = await supabase.from("guests").insert(insert);
        if (error) return `Error adding guest: ${error.message}`;
        return `✅ Added "${args.name}" to the guest list.`;
      }

      case "update_guest_rsvp": {
        if (planningWriteBlock) return planningWriteBlock;

        const { data: guests } = await scopedSelect(
          supabase,
          "guests",
          "id, name",
          workspaceOrFilter,
        );
        const guest = fuzzyFind(guests || [], "name", args.name);
        if (!guest) return `Could not find a guest matching "${args.name}".`;
        const { error } = await supabase.from("guests").update({ rsvp_status: args.rsvp_status }).eq("id", guest.id);
        if (error) return `Error updating guest RSVP: ${error.message}`;
        return `✅ Updated ${guest.name}'s RSVP to ${args.rsvp_status}.`;
      }

      case "remove_guest": {
        if (planningWriteBlock) return planningWriteBlock;

        const { data: guests } = await scopedSelect(
          supabase,
          "guests",
          "id, name",
          workspaceOrFilter,
        );
        const guest = fuzzyFind(guests || [], "name", args.name);
        if (!guest) return `Could not find a guest matching "${args.name}".`;
        const { error } = await supabase.from("guests").delete().eq("id", guest.id);
        if (error) return `Error removing guest: ${error.message}`;
        return `🗑️ Removed ${guest.name} from the guest list.`;
      }

      case "add_vendor": {
        if (planningWriteBlock) return planningWriteBlock;

        const insert: Record<string, any> = {
          user_id: userId,
          client_id: writeClientId,
          name: args.name,
          category: args.category,
        };
        if (args.email) insert.email = args.email;
        if (args.phone) insert.phone = args.phone;
        if (typeof args.price === "number") insert.price = args.price;
        if (args.notes) insert.notes = args.notes;
        if (args.status) insert.status = args.status;

        const { error } = await supabase.from("vendors").insert(insert);
        if (error) return `Error adding vendor: ${error.message}`;
        return `✅ Added vendor "${args.name}" in ${args.category}.`;
      }

      case "update_vendor_status": {
        if (planningWriteBlock) return planningWriteBlock;

        const { data: vendors } = await scopedSelect(
          supabase,
          "vendors",
          "id, name",
          workspaceOrFilter,
        );
        const vendor = fuzzyFind(vendors || [], "name", args.name);
        if (!vendor) return `Could not find a vendor matching "${args.name}".`;
        const { error } = await supabase.from("vendors").update({ status: args.status }).eq("id", vendor.id);
        if (error) return `Error updating vendor status: ${error.message}`;
        return `✅ Updated ${vendor.name} to ${args.status}.`;
      }

      case "update_vendor_price": {
        if (planningWriteBlock) return planningWriteBlock;

        const { data: vendors } = await scopedSelect(
          supabase,
          "vendors",
          "id, name",
          workspaceOrFilter,
        );
        const vendor = fuzzyFind(vendors || [], "name", args.name);
        if (!vendor) return `Could not find a vendor matching "${args.name}".`;
        const { error } = await supabase.from("vendors").update({ price: args.price }).eq("id", vendor.id);
        if (error) return `Error updating vendor price: ${error.message}`;
        return `✅ Updated ${vendor.name}'s price to ${formatCurrency(args.price)}.`;
      }

      case "remove_vendor": {
        if (planningWriteBlock) return planningWriteBlock;

        const { data: vendors } = await scopedSelect(
          supabase,
          "vendors",
          "id, name",
          workspaceOrFilter,
        );
        const vendor = fuzzyFind(vendors || [], "name", args.name);
        if (!vendor) return `Could not find a vendor matching "${args.name}".`;
        const { error } = await supabase.from("vendors").delete().eq("id", vendor.id);
        if (error) return `Error removing vendor: ${error.message}`;
        return `🗑️ Removed ${vendor.name} from the vendor tracker.`;
      }

      case "create_timeline_event": {
        if (planningWriteBlock) return planningWriteBlock;

        let { data: timelines } = await scopedSelect(
          supabase,
          "timelines",
          "id, title, timeline_date, is_template",
          workspaceOrFilter,
        )
          .eq("is_template", false)
          .order("timeline_date", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false });

        let timeline = args.timeline_title
          ? fuzzyFind(timelines || [], "title", args.timeline_title)
          : (timelines || [])[0];

        if (!timeline) {
          const { data: createdTimeline, error: timelineError } = await supabase
            .from("timelines")
            .insert({
              user_id: userId,
              client_id: writeClientId,
              title: args.timeline_title || `${profile?.full_name || "Wedding"} Timeline`,
              timeline_date: profile?.wedding_date || null,
              is_template: false,
            })
            .select("id, title, timeline_date, is_template")
            .single();

          if (timelineError || !createdTimeline) {
            return `Error creating a timeline: ${timelineError?.message || "Unknown error"}`;
          }
          timeline = createdTimeline;
          timelines = [createdTimeline];
        }

        const { data: existingEvents } = await supabase
          .from("timeline_events")
          .select("id")
          .eq("timeline_id", timeline.id)
          .order("sort_order", { ascending: true });

        const nextSortOrder = existingEvents?.length || 0;
        const { error } = await supabase.from("timeline_events").insert({
          timeline_id: timeline.id,
          event_time: normalizeTime(args.event_time),
          title: args.title,
          description: args.description || null,
          assigned_people: Array.isArray(args.assigned_people) ? args.assigned_people : [],
          sort_order: nextSortOrder,
          category: args.category || null,
        });

        if (error) return `Error creating timeline event: ${error.message}`;
        return `✅ Added "${args.title}" to ${timeline.title} at ${normalizeTime(args.event_time)}.`;
      }

      case "update_vendor_internal_notes": {
        if (vendorWriteBlock) return vendorWriteBlock;

        const booking = await findVendorBookingByCoupleName(supabase, vendorListingId!, args.couple_name);
        if (!booking) return `Could not find a booking for a couple matching "${args.couple_name}".`;

        const { data, error } = await (supabase.rpc as any)("update_vendor_booking_internal_notes", {
          target_vendor_id: booking.id,
          internal_notes_input: args.notes,
        });
        if (error) return `Error saving internal notes: ${error.message}`;

        return `✅ Saved private internal notes for ${booking.couple_name}.`;
      }

      case "create_vendor_follow_up_reminder": {
        if (vendorWriteBlock) return vendorWriteBlock;

        const booking = await findVendorBookingByCoupleName(supabase, vendorListingId!, args.couple_name);
        if (!booking) return `Could not find a booking for a couple matching "${args.couple_name}".`;

        const { data, error } = await (supabase.rpc as any)("create_vendor_follow_up_reminder", {
          target_vendor_id: booking.id,
          title_input: args.title,
          notes_input: args.notes || null,
          due_date_input: args.due_date || null,
        });
        if (error) return `Error creating a follow-up reminder: ${error.message}`;

        return `✅ Created a follow-up reminder for ${booking.couple_name}${args.due_date ? ` due ${args.due_date}` : ""}.`;
      }

      case "update_vendor_follow_up_reminder_status": {
        if (vendorWriteBlock) return vendorWriteBlock;

        const booking = await findVendorBookingByCoupleName(supabase, vendorListingId!, args.couple_name);
        if (!booking) return `Could not find a booking for a couple matching "${args.couple_name}".`;

        const { data: reminders, error: remindersError } = await supabase
          .from("vendor_follow_up_reminders")
          .select("id, title, status")
          .eq("vendor_id", booking.id)
          .order("created_at", { ascending: false });

        if (remindersError) return `Error loading reminders: ${remindersError.message}`;

        const reminder = fuzzyFind((reminders || []) as Record<string, any>[], "title", args.title);
        if (!reminder) return `Could not find a reminder matching "${args.title}" for ${booking.couple_name}.`;

        const { error } = await (supabase.rpc as any)("update_vendor_follow_up_reminder_status", {
          target_reminder_id: reminder.id,
          status_input: args.status,
        });
        if (error) return `Error updating the reminder: ${error.message}`;

        return `✅ Marked "${reminder.title}" as ${args.status} for ${booking.couple_name}.`;
      }

      case "update_vendor_booking_status": {
        if (vendorWriteBlock) return vendorWriteBlock;

        const booking = await findVendorBookingByCoupleName(supabase, vendorListingId!, args.couple_name);
        if (!booking) return `Could not find a booking for a couple matching "${args.couple_name}".`;

        const { error } = await (supabase.rpc as any)("update_vendor_booking_status", {
          target_vendor_id: booking.id,
          status_input: args.status,
        });
        if (error) return `Error updating booking status: ${error.message}`;

        return `✅ Updated ${booking.couple_name}'s booking status to ${args.status}.`;
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (error) {
    return `Error executing ${name}: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini";
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? new URL(req.url).origin;
    const userScopedKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !userScopedKey) {
      throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY must be configured");
    }

    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY must be configured");
    }

    const authClient = createClient(supabaseUrl, serviceRoleKey);
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(accessToken);

    if (authError || !user?.id) {
      console.error("auth.getUser failed:", authError);
      return new Response(JSON.stringify({ error: authError?.message || "Invalid JWT" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, userScopedKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { messages, selectedClientId, allowWriteActions = false, confirmedActions = [] } = await req.json();
    const today = new Date().toISOString().slice(0, 10);

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const role = profile?.role || "couple";
    const plannerType = profile?.planner_type || null;

    const { data: plannerClients } = role === "planner"
      ? await supabase
        .from("planner_clients")
        .select("*")
        .eq("planner_user_id", user.id)
        .order("created_at", { ascending: false })
      : { data: [] as any[] };

    const { data: linkedPlannerClient } = role === "couple"
      ? await supabase
        .from("planner_clients")
        .select("id, planner_user_id, client_name, partner_name, wedding_date, wedding_location, linked_user_id")
        .eq("linked_user_id", user.id)
        .limit(1)
        .maybeSingle()
      : { data: null as any };

    let vendorListing: Record<string, any> | null = null;
    if (role === "vendor") {
      const { data } = await supabase
        .from("vendor_listings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      vendorListing = data;
    }

    const hasPremiumAccess =
      role === "admin"
        ? true
        : role === "vendor"
          ? isActiveStatus(vendorListing?.subscription_status, vendorListing?.subscription_expires_at)
          : role === "planner"
            ? isActiveStatus(profile?.planner_subscription_status, profile?.planner_subscription_expires_at)
            : isActiveStatus(profile?.planning_pass_status, profile?.planning_pass_expires_at);

    if (!hasPremiumAccess) {
      return new Response(JSON.stringify({
        error: "AI assistant access is part of your paid plan. Upgrade your account to continue.",
      }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: usageStatusResult, error: usageStatusError } = await (supabase.rpc as any)("get_ai_usage_status");
    const usageStatus = Array.isArray(usageStatusResult) ? usageStatusResult[0] : usageStatusResult;

    if (usageStatusError) {
      console.error("Failed to load AI usage status:", usageStatusError);
      return new Response(JSON.stringify({ error: "Could not load AI usage status." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (usageStatus?.ai_enabled === false) {
      return new Response(JSON.stringify({
        error: "AI assistant is currently disabled for this plan.",
        usage: usageStatus,
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((usageStatus?.remaining_messages ?? 0) <= 0) {
      return new Response(JSON.stringify({
        error: "You have reached this month's AI message limit for your plan.",
        usage: usageStatus,
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let workspaceOrFilter: string | null = null;
    let writeClientId: string | null = null;
    let workspaceLabel = "";
    let workspaceNotice = "";

    if (role === "planner" && plannerType !== "committee") {
      if (selectedClientId) {
        const activeClient = (plannerClients || []).find((client: any) => client.id === selectedClientId) || null;
        if (!activeClient) {
          return new Response(JSON.stringify({ error: "Selected client not found for this planner." }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        writeClientId = activeClient.id;
        workspaceLabel = `${activeClient.client_name}${activeClient.partner_name ? ` & ${activeClient.partner_name}` : ""}`;
        workspaceOrFilter = activeClient.linked_user_id
          ? `client_id.eq.${activeClient.id},user_id.eq.${activeClient.linked_user_id}`
          : `client_id.eq.${activeClient.id}`;
      } else {
        workspaceNotice = "No active client is selected, so the assistant should stay advisory and ask the planner to choose a client before making changes.";
      }
    } else if (role === "couple") {
      workspaceLabel = profile?.full_name || "Couple workspace";
      workspaceOrFilter = linkedPlannerClient
        ? `user_id.eq.${user.id},client_id.eq.${linkedPlannerClient.id}`
        : `user_id.eq.${user.id}`;
    } else if (role === "planner" && plannerType === "committee") {
      workspaceLabel = profile?.committee_name || profile?.full_name || "Committee workspace";
      workspaceOrFilter = `user_id.eq.${user.id}`;
    } else if (role === "admin") {
      workspaceNotice = "Admin mode is advisory only.";
    }

    let tasksList: any[] = [];
    let budgetCategories: any[] = [];
    let budgetPayments: any[] = [];
    let guests: any[] = [];
    let vendors: any[] = [];
    let timelines: any[] = [];
    let timelineEvents: any[] = [];
    let timelineShares: any[] = [];
    let vendorBookings: any[] = [];
    let vendorBookingProfilesByUserId: Record<string, any> = {};
    let vendorBookingPayments: any[] = [];
    let vendorRequests: any[] = [];
    let vendorFollowUps: any[] = [];

    if (role === "vendor" && vendorListing?.id) {
      const [
        vendorBookingsRes,
        vendorRequestsRes,
        vendorFollowUpsRes,
      ] = await Promise.all([
        supabase
          .from("vendors")
          .select("*")
          .eq("vendor_listing_id", vendorListing.id)
          .order("selection_updated_at", { ascending: false })
          .limit(100),
        supabase
          .from("vendor_connection_requests")
          .select("*")
          .eq("vendor_listing_id", vendorListing.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("vendor_follow_up_reminders")
          .select("*")
          .eq("vendor_listing_id", vendorListing.id)
          .order("status", { ascending: true })
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(100),
      ]);

      vendorBookings = vendorBookingsRes.data || [];
      vendorRequests = vendorRequestsRes.data || [];
      vendorFollowUps = vendorFollowUpsRes.error ? [] : (vendorFollowUpsRes.data || []);

      const vendorIds = vendorBookings.map((booking: any) => booking.id);
      const vendorUserIds = [...new Set(vendorBookings.map((booking: any) => booking.user_id).filter(Boolean))];

      if (vendorUserIds.length > 0) {
        const { data: vendorBookingProfiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, wedding_date, wedding_location")
          .in("user_id", vendorUserIds);

        vendorBookingProfilesByUserId = Object.fromEntries(
          ((vendorBookingProfiles || []) as any[]).map((profileRow) => [profileRow.user_id, profileRow]),
        );
      }

      if (vendorIds.length > 0) {
        const { data } = await supabase
          .from("budget_payments")
          .select("*")
          .in("vendor_id", vendorIds)
          .order("payment_date", { ascending: false })
          .limit(100);
        vendorBookingPayments = data || [];
      }
    } else if (workspaceOrFilter) {
      const [
        tasksRes,
        budgetRes,
        paymentsRes,
        guestsRes,
        vendorsRes,
        timelinesRes,
      ] = await Promise.all([
        scopedSelect(supabase, "tasks", "*", workspaceOrFilter)
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(100),
        scopedSelect(supabase, "budget_categories", "*", workspaceOrFilter)
          .order("name"),
        scopedSelect(supabase, "budget_payments", "*", workspaceOrFilter)
          .order("payment_date", { ascending: false })
          .limit(100),
        scopedSelect(supabase, "guests", "*", workspaceOrFilter)
          .limit(200),
        scopedSelect(supabase, "vendors", "*", workspaceOrFilter)
          .order("name")
          .limit(100),
        scopedSelect(supabase, "timelines", "*", workspaceOrFilter)
          .order("timeline_date", { ascending: true, nullsFirst: false })
          .limit(10),
      ]);

      tasksList = tasksRes.data || [];
      budgetCategories = budgetRes.data || [];
      budgetPayments = paymentsRes.data || [];
      guests = guestsRes.data || [];
      vendors = vendorsRes.data || [];
      timelines = timelinesRes.data || [];

      const timelineIds = timelines.map((timeline: any) => timeline.id);
      if (timelineIds.length > 0) {
        const [eventsRes, sharesRes] = await Promise.all([
          supabase
            .from("timeline_events")
            .select("*")
            .in("timeline_id", timelineIds)
            .order("event_time", { ascending: true }),
          supabase
            .from("timeline_share_links")
            .select("*")
            .in("timeline_id", timelineIds),
        ]);
        timelineEvents = eventsRes.data || [];
        timelineShares = sharesRes.data || [];
      }
    }

    const pendingTasks = tasksList.filter((task: any) => !task.completed);
    const completedTasks = tasksList.filter((task: any) => task.completed);
    const overdueTasks = pendingTasks.filter((task: any) => task.due_date && task.due_date < today);
    const totalAllocated = budgetCategories.reduce((sum: number, category: any) => sum + Number(category.allocated || 0), 0);
    const totalSpent = budgetCategories.reduce((sum: number, category: any) => sum + Number(category.spent || 0), 0);
    const totalPayments = budgetPayments.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
    const confirmedGuests = guests.filter((guest: any) => guest.rsvp_status === "confirmed").length;
    const pendingGuests = guests.filter((guest: any) => guest.rsvp_status === "pending").length;
    const finalVendors = vendors.filter((vendor: any) => vendor.selection_status === "final");
    const timelineEventCount = timelineEvents.length;
    const upcomingTimelineEvents = timelineEvents
      .slice()
      .sort((left: any, right: any) => String(left.event_time).localeCompare(String(right.event_time)))
      .slice(0, 8);

    const vendorTotalQuoted = vendorBookings.reduce((sum: number, booking: any) => sum + Number(booking.price || 0), 0);
    const vendorTotalPaid = vendorBookings.reduce((sum: number, booking: any) => sum + Number(booking.amount_paid || 0), 0);
    const openVendorFollowUps = vendorFollowUps.filter((reminder: any) => reminder.status !== "completed").length;
    const vendorBookingSummaries = vendorBookings.map((booking: any) => {
      const bookingProfile = vendorBookingProfilesByUserId[booking.user_id];
      return {
        ...booking,
        couple_name: bookingProfile?.full_name || "Unknown couple",
        wedding_date: bookingProfile?.wedding_date || null,
        wedding_location: bookingProfile?.wedding_location || null,
      };
    });

    let weddingCountdown = "";
    if (profile?.wedding_date) {
      const diff = Math.ceil((new Date(profile.wedding_date).getTime() - Date.now()) / 86400000);
      weddingCountdown = diff > 0
        ? `${diff} days until the wedding (${profile.wedding_date})`
        : `Wedding date is ${profile.wedding_date}`;
    }

    const plannerClientSummary = (plannerClients || []).length > 0
      ? (plannerClients || []).map((client: any) =>
        `- ${client.client_name}${client.partner_name ? ` & ${client.partner_name}` : ""}: ${client.wedding_date || "Date TBD"} in ${client.wedding_location || "Location TBD"}`
      ).join("\n")
      : "No planner clients yet.";

    const workspaceSummary = role === "vendor"
      ? `Vendor listing: ${vendorListing?.business_name || "Not configured"}
Category: ${vendorListing?.category || "Unknown"}
Location: ${vendorListing?.location || vendorListing?.location_county || "Not set"}
Subscription: ${vendorListing?.subscription_status || "inactive"}
Bookings: ${vendorBookings.length}
Direct requests: ${vendorRequests.length}
Open reminders: ${openVendorFollowUps}
Quoted total: ${formatCurrency(vendorTotalQuoted)}
Paid total: ${formatCurrency(vendorTotalPaid)}`
      : `Workspace: ${workspaceLabel || (role === "planner" ? "Planner advisory mode" : "Wedding workspace")}
Tasks: ${pendingTasks.length} pending, ${completedTasks.length} completed${overdueTasks.length ? `, ${overdueTasks.length} overdue` : ""}
Budget allocated: ${formatCurrency(totalAllocated)}
Budget spent: ${formatCurrency(totalSpent)}
Payments recorded: ${formatCurrency(totalPayments)}
Guests: ${guests.length} total, ${confirmedGuests} confirmed, ${pendingGuests} pending
Vendors: ${vendors.length} tracked, ${finalVendors.length} final
Timelines: ${timelines.length}, events: ${timelineEventCount}`;

    const assistantRoleLabel =
      role === "vendor"
        ? "vendor sales/booking assistant"
        : role === "planner" && plannerType === "committee"
          ? "committee delegation assistant"
          : role === "planner"
            ? "planner operations copilot"
            : "couple planning coach";

    const assistantRoleInstructions =
      role === "vendor"
        ? `Help the vendor stay responsive, organized, and commercially sharp. Prioritize bookings, follow-up reminders, internal notes, payment context, next-call preparation, and clear client communication. Use vendor tools when the user explicitly wants a booking status update, a follow-up reminder, or private internal notes saved.`
        : role === "planner" && plannerType === "committee"
          ? `Operate like a committee delegation assistant. Focus on who should own the next action, which roles should be delegated, what is overdue, what is public versus private, and how committee coordination should move forward.`
          : role === "planner"
            ? `Operate like a planner operations copilot. Focus on client execution, blockers, next-week actions, vendor/payment risk, and keeping the planner in control of the active wedding workspace.`
            : `Operate like a couple planning coach. Prioritize practical advice, calm step-by-step next actions, budget clarity, vendor decision support, and keeping the couple moving forward confidently.`;

    const assistantWritePolicy =
      role === "vendor"
        ? `Vendor write tools can save internal notes, create private follow-up reminders, mark reminders complete, and update booking status for real bookings matched by the couple's name. Never claim to edit public listing fields, pricing plans, or external calendars unless a real tool exists.`
        : `Use write tools when the user clearly asks for a concrete action. If a planner has not selected a client, stay advisory until they do.`;

    const systemPrompt = `You are Zania AI acting as the user's ${assistantRoleLabel} inside the Zania app.

${assistantRoleInstructions}

You understand how the product works across:
- budget categories and payment logs
- vendor shortlist/final selection/payment tracking
- tasks, priorities, delegatability, and vendor-linked tasks
- guest management and RSVP tracking
- timelines and timeline event execution
- planner-client collaboration
- committee-led planning workflows
- vendor-side listing and booking visibility

Today: ${today}
Role: ${role}
Planner type: ${plannerType || "n/a"}
Monthly AI allowance remaining: ${usageStatus?.remaining_messages ?? "unknown"} of ${usageStatus?.monthly_message_cap ?? "unknown"}
${profile?.full_name ? `User: ${profile.full_name}` : ""}
${profile?.partner_name ? `Partner: ${profile.partner_name}` : ""}
${profile?.wedding_location ? `Wedding location: ${profile.wedding_location}` : ""}
${profile?.wedding_county ? `Wedding county: ${profile.wedding_county}` : ""}
${profile?.wedding_town ? `Wedding town: ${profile.wedding_town}` : ""}
${weddingCountdown}

${workspaceSummary}
${workspaceNotice ? `\nImportant workspace note: ${workspaceNotice}` : ""}

${role === "planner" ? `\nPlanner clients:\n${plannerClientSummary}` : ""}

${role === "vendor" ? `\nBookings:
${vendorBookingSummaries.map((booking: any) => `- ${booking.couple_name} — ${booking.category}, status ${booking.status || "unknown"}, quoted ${formatCurrency(booking.price || 0)}, paid ${formatCurrency(booking.amount_paid || 0)}, payment ${booking.payment_status}${booking.wedding_date ? `, wedding ${booking.wedding_date}` : ""}${booking.wedding_location ? ` in ${booking.wedding_location}` : ""}`).join("\n") || "No bookings yet."}

Connection requests:
${vendorRequests.map((request: any) => `- ${request.status} request from ${request.requester_user_id} on ${request.created_at.slice(0, 10)}`).join("\n") || "No direct requests yet."}

Booking payments:
${vendorBookingPayments.map((payment: any) => `- ${payment.payee_name}: ${formatCurrency(payment.amount)} on ${payment.payment_date}${payment.reference ? ` (${payment.reference})` : ""}`).join("\n") || "No booking payments logged yet."}

Follow-up reminders:
${vendorFollowUps.map((reminder: any) => `- ${reminder.status} · ${reminder.title}${reminder.due_date ? ` due ${reminder.due_date}` : ""}${reminder.notes ? ` — ${reminder.notes}` : ""}`).join("\n") || "No follow-up reminders yet."}` : `\nTasks:
${pendingTasks.slice(0, 20).map((task: any) => `- ${task.title}${task.due_date ? ` (due ${task.due_date})` : ""}${task.category ? ` [${task.category}]` : ""}${task.assigned_to ? ` -> ${task.assigned_to}` : ""}`).join("\n") || "No pending tasks."}

Budget:
${budgetCategories.map((category: any) => `- ${category.name}: allocated ${formatCurrency(category.allocated)}, spent ${formatCurrency(category.spent)}, scope ${category.budget_scope}`).join("\n") || "No budget categories yet."}

Payments:
${budgetPayments.slice(0, 20).map((payment: any) => `- ${payment.category_name}: ${formatCurrency(payment.amount)} to ${payment.payee_name} on ${payment.payment_date}${payment.reference ? ` (${payment.reference})` : ""}`).join("\n") || "No payments recorded yet."}

Guests:
${guests.slice(0, 20).map((guest: any) => `- ${guest.name} (${guest.rsvp_status})`).join("\n") || "No guests yet."}

Vendors:
${vendors.slice(0, 20).map((vendor: any) => `- ${vendor.name} (${vendor.category}) — ${vendor.selection_status}, quoted ${formatCurrency(vendor.price || 0)}, paid ${formatCurrency(vendor.amount_paid || 0)}, payment ${vendor.payment_status}`).join("\n") || "No vendors yet."}

Timeline events:
${upcomingTimelineEvents.map((event: any) => `- ${event.event_time}: ${event.title}${event.category ? ` [${event.category}]` : ""}`).join("\n") || "No timeline events yet."}

Timeline shares:
${timelineShares.slice(0, 12).map((share: any) => `- ${share.assignee_name}${share.vendor_role ? ` (${share.vendor_role})` : ""}`).join("\n") || "No share links yet."}`}

Operating rules:
- Give advice that reflects the actual workspace data above.
- If the user asks you to perform an action and a matching tool exists, use the tool instead of only describing what to do.
- ${assistantWritePolicy}
- If the user is a planner without an active client selected, stay advisory and ask them to select a client before writing workspace data.
- When a requested action is not supported by tools, explain the exact Zania section they should use next.
- Be warm, concise, practical, and Kenyan-wedding aware.
- Use markdown when it improves clarity.
- Format answers for fast scanning: use short headings, short paragraphs, and bullet points for action lists.
- When advising on priorities, prefer this structure: "What stands out", "What to do next", and "What I can do for you".
- Always use KES for money.`;

    const aiMessages: any[] = [{ role: "system", content: systemPrompt }, ...messages];
    const toolContext: ToolContext = {
      supabase,
      userId: user.id,
      role,
      plannerType,
      vendorListingId: vendorListing?.id ?? null,
      workspaceOrFilter,
      writeClientId,
      today,
      profile,
    };

    const MAX_TOOL_ROUNDS = 5;
    let finalContent = "";
    let pendingActions: PendingWriteAction[] = [];

    if (Array.isArray(confirmedActions) && confirmedActions.length > 0) {
      const results: string[] = [];
      for (const action of confirmedActions) {
        const toolName = String(action?.toolName || "");
        const toolArgs = action && typeof action.args === "object" && action.args ? action.args : {};
        if (!toolName || !isWriteTool(toolName)) continue;
        const result = await executeTool(toolName, toolArgs, toolContext);
        results.push(`- ${result}`);
      }

      finalContent = results.length
        ? `## Action completed\n\n${results.join("\n")}\n\nAnything else you want me to update?`
        : "I couldn't find any confirmed actions to run.";
    }

    for (let round = 0; round < MAX_TOOL_ROUNDS && !finalContent; round++) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: aiMessages,
          tools,
          tool_choice: "auto",
          stream: false,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        const details = text.trim().slice(0, 500);
        let parsedError: Record<string, any> | null = null;
        try {
          parsedError = JSON.parse(text);
        } catch {
          parsedError = null;
        }

        if (response.status === 429) {
          const quotaMessage =
            parsedError?.error?.type === "insufficient_quota" ||
            /insufficient_quota|quota/i.test(details);
          if (quotaMessage) {
            return new Response(JSON.stringify({ error: "OpenAI credits exhausted. Please top up later.", details, usage: usageStatus }), {
              status: 402,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment.", usage: usageStatus }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.error("OpenAI API error:", response.status, details);
        return new Response(JSON.stringify({
          error: "AI service unavailable",
          details: `OpenAI returned ${response.status}${details ? `: ${details}` : ""}`,
          usage: usageStatus,
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      if (!choice) break;

      const message = choice.message;
      aiMessages.push(message);

      if (message.tool_calls?.length) {
        const toolCalls = message.tool_calls.map((toolCall: any) => {
          let functionArgs: Record<string, any> = {};
          try {
            functionArgs = JSON.parse(toolCall.function.arguments);
          } catch {
            functionArgs = {};
          }
          return {
            tool_call_id: toolCall.id,
            functionName: toolCall.function.name,
            functionArgs,
          };
        });

        const writeActions = toolCalls
          .filter((toolCall: any) => isWriteTool(toolCall.functionName))
          .map((toolCall: any) => ({
            toolName: toolCall.functionName,
            args: toolCall.functionArgs,
            summary: summarizePendingAction(toolCall.functionName, toolCall.functionArgs),
            destructive: ["delete_task", "remove_guest", "remove_vendor"].includes(toolCall.functionName),
          }));

        if (writeActions.length > 0 && !allowWriteActions) {
          pendingActions = writeActions;
          finalContent = `## Ready to run ${writeActions.length === 1 ? "this action" : "these actions"}\n\n${writeActions.map((action) => `- ${action.summary}`).join("\n")}\n\nUse **Run this action** to apply the change${writeActions.length > 1 ? "s" : ""}.`;
          break;
        }

        for (const toolCall of message.tool_calls) {
          const functionName = toolCall.function.name;
          let functionArgs: Record<string, any> = {};
          try {
            functionArgs = JSON.parse(toolCall.function.arguments);
          } catch {
            functionArgs = {};
          }

          const result = await executeTool(functionName, functionArgs, toolContext);
          aiMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }
        continue;
      }

      finalContent = message.content || "";
      break;
    }

    let finalUsage = usageStatus;
    if (finalContent.trim()) {
      const { data: loggedUsageResult, error: loggedUsageError } = await (supabase.rpc as any)("log_ai_assistant_message", {
        feature_input: "ai_assistant",
      });

      if (loggedUsageError) {
        console.error("Failed to log AI assistant usage:", loggedUsageError);
      } else {
        finalUsage = Array.isArray(loggedUsageResult) ? loggedUsageResult[0] : loggedUsageResult;
      }
    }

    return new Response(JSON.stringify({ content: finalContent, usage: finalUsage, assistantRole: assistantRoleLabel, pendingActions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
