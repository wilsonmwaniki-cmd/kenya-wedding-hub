/** Read-only wedding capability. Always pass the caller's JWT-scoped client, never a service client. */
// Structural read interface keeps this capability usable in Deno and the web test runner.
type Row = Record<string, unknown>;
type ReadResult = { data: Row[] | null; error: unknown; count: number | null };
interface ReadQuery extends PromiseLike<ReadResult> {
  eq(field: string, value: unknown): ReadQuery;
  is(field: string, value: null): ReadQuery;
  in(field: string, values: string[]): ReadQuery;
  order(field: string): ReadQuery;
  range(from: number, to: number): ReadQuery;
  limit(count: number): ReadQuery;
  maybeSingle(): PromiseLike<{ data: Row | null; error: unknown }>;
}
export interface BriefingDatabase {
  from(table: string): { select(columns: string, options?: { count: "exact" }): ReadQuery };
}

export type BriefingIntent = "summary" | "week";
export function getBriefingIntent(prompt: string): BriefingIntent | null {
  const normalized = prompt.trim().toLowerCase().replace(/[?.!]+$/, "");
  if (normalized === "how is my wedding doing" || normalized === "how is our wedding doing") return "summary";
  if (normalized === "what should i focus on this week" || normalized === "what should we focus on this week") return "week";
  return null;
}

export class WeddingBriefingError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

type Source<T> = { status: "ready" | "unavailable"; rows: T[] };
type Task = { id: string; title: string; completed: boolean; due_date: string | null };
type Category = { id: string; allocated: number; spent: number };
type Payment = { id: string; amount: number };
type Guest = { id: string; rsvp_status: string };
type Vendor = {
  id: string; name: string; selection_status: string; status: string | null;
  price: number | null; amount_paid: number; payment_due_date: string | null;
};
type Wedding = { id: string; name: string; wedding_date: string | null };
export type BriefingSources = {
  tasks: Source<Task>; budget: Source<Category>; payments: Source<Payment>;
  guests: Source<Guest>; vendors: Source<Vendor>;
};
type Priority = { source: "tasks" | "vendors"; id: string; title: string; reason: string; date: string; path: string };
type UpcomingPayment = { vendorId: string; vendorName: string; date: string; recordedBalance: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BRIEFING_ROLES = ["bride", "groom", "planner"];
const PAGE_SIZE = 500;
const MAX_ROWS = 10000;

/** Exact count + stable pagination: never represent a capped/failed read as an empty or complete list. */
export async function readBriefingRows<T>(
  db: BriefingDatabase, table: string, columns: string, weddingId: string, weddingBudgetOnly = false,
): Promise<Source<T>> {
  try {
    const rows: T[] = [];
    let expectedCount: number | null = null;
    while (rows.length <= MAX_ROWS) {
      let query = db.from(table).select(columns, { count: "exact" }).eq("wedding_id", weddingId);
      if (weddingBudgetOnly) query = query.eq("budget_scope", "wedding");
      const { data, error, count } = await query.order("id").range(rows.length, rows.length + PAGE_SIZE - 1);
      if (error || !data || count === null || count > MAX_ROWS) return { status: "unavailable", rows: [] };
      if (expectedCount !== null && expectedCount !== count) return { status: "unavailable", rows: [] };
      expectedCount = count;
      rows.push(...data as unknown as T[]);
      if (rows.length === count) return { status: "ready", rows };
      if (!data.length || rows.length > count) return { status: "unavailable", rows: [] };
    }
  } catch { /* A failed source must stay visibly unknown. */ }
  return { status: "unavailable", rows: [] };
}

export async function resolveBriefingWedding(
  db: BriefingDatabase, actor: { userId: string; role: string; plannerType: string | null }, selectedClientId?: unknown,
): Promise<Wedding> {
  if (actor.role !== "couple" && !(actor.role === "planner" && actor.plannerType !== "committee")) {
    throw new WeddingBriefingError("Wedding summaries are available in a couple or assigned planner workspace. Use your current workspace for booking information.", 403);
  }
  let weddingId: string | null = null;
  if (actor.role === "planner") {
    if (!selectedClientId) throw new WeddingBriefingError("Choose a wedding in My Weddings, then ask again.", 400);
    if (typeof selectedClientId !== "string" || !UUID.test(selectedClientId)) {
      throw new WeddingBriefingError("Choose a valid wedding in My Weddings, then ask again.", 400);
    }
    const { data, error } = await db.from("planner_clients").select("wedding_id")
      .eq("id", selectedClientId).eq("planner_user_id", actor.userId).eq("is_archived", false).maybeSingle();
    if (error) throw new WeddingBriefingError("Could not check wedding access. Please try again.", 503);
    if (typeof data?.wedding_id !== "string") throw new WeddingBriefingError("This client has no accessible wedding workspace. Open My Weddings to check the connection.", 403);
    weddingId = data.wedding_id;
  }
  let membershipsQuery = db.from("wedding_memberships").select("wedding_id")
    .eq("user_id", actor.userId).eq("membership_status", "active").is("revoked_at", null)
    .in("role", BRIEFING_ROLES);
  if (weddingId) membershipsQuery = membershipsQuery.eq("wedding_id", weddingId);
  const { data: memberships, error: membershipError } = await membershipsQuery.limit(2);
  if (membershipError) throw new WeddingBriefingError("Could not check wedding access. Please try again.", 503);
  if (!memberships?.length) throw new WeddingBriefingError("You do not have an active couple or planner membership for this wedding.", 403);
  if (memberships.length !== 1) throw new WeddingBriefingError("More than one wedding is linked to this account. A single wedding must be selected before a summary can be prepared.", 409);
  const { data: wedding, error } = await db.from("weddings").select("id, name, wedding_date")
    .eq("id", memberships[0].wedding_id).eq("status", "active").is("deleted_at", null).maybeSingle();
  if (error) throw new WeddingBriefingError("Could not load the wedding. Please try again.", 503);
  if (!wedding) throw new WeddingBriefingError("This wedding is not available to your account.", 403);
  return wedding as unknown as Wedding;
}

const cents = (value: number) => Math.round(Number(value) * 100);
const total = (values: number[]) => values.reduce((sum, value) => sum + cents(value), 0) / 100;
const money = (value: number) => `KES ${value.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
// Names/titles are untrusted content, including when rendered without an LLM.
const plain = (value: string) => value.replace(/[\r\n\t]/g, " ").replace(/[\\`*_{}[\]()<>#!|~]/g, "\\$&");
const dayInKenya = (date: Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit",
}).format(date);

export function buildWeddingBriefing(wedding: Wedding, sources: BriefingSources, now = new Date()) {
  const today = dayInKenya(now);
  const through = new Date(`${today}T12:00:00Z`);
  through.setUTCDate(through.getUTCDate() + 6);
  const weekEnd = through.toISOString().slice(0, 10);
  const missing: string[] = [];
  const priorities: Priority[] = [];
  const { tasks, budget, payments, guests, vendors } = sources;
  if (!wedding.wedding_date) missing.push("The wedding date is not set.");
  for (const [label, source] of Object.entries(sources)) {
    if (source.status === "unavailable") missing.push(`Could not load complete ${label} records. Try again before relying on this part of the plan.`);
  }
  const openTasks = tasks.rows.filter((task) => !task.completed);
  const taskSummary = tasks.status === "ready" ? {
    total: tasks.rows.length, completed: tasks.rows.length - openTasks.length,
    overdue: openTasks.filter((task) => task.due_date && task.due_date < today).length,
    upcoming: openTasks.filter((task) => task.due_date && task.due_date >= today && task.due_date <= weekEnd).length,
    undated: openTasks.filter((task) => !task.due_date).length,
  } : null;
  if (taskSummary?.undated) missing.push(`${taskSummary.undated} open tasks have no due date.`);
  for (const task of openTasks) {
    if (task.due_date && task.due_date <= weekEnd) priorities.push({
      source: "tasks", id: task.id, title: task.title, date: task.due_date, path: "/tasks",
      reason: `${task.due_date < today ? "Overdue since" : "Due"} ${task.due_date}; still marked incomplete.`,
    });
  }
  const finalVendors = vendors.rows.filter((vendor) => vendor.selection_status === "final");
  const vendorsWithoutPrice = finalVendors.filter((vendor) => vendor.price === null);
  if (vendorsWithoutPrice.length) missing.push(`${vendorsWithoutPrice.length} selected vendors have no recorded quote.`);
  const unpaidVendors = finalVendors.filter((vendor) => vendor.price !== null && cents(vendor.price) > cents(vendor.amount_paid));
  const upcomingPayments: UpcomingPayment[] = unpaidVendors
    .filter((vendor) => Boolean(vendor.payment_due_date))
    .map((vendor) => ({
      vendorId: vendor.id,
      vendorName: vendor.name,
      date: vendor.payment_due_date!,
      recordedBalance: (cents(vendor.price!) - cents(vendor.amount_paid)) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.vendorId.localeCompare(b.vendorId));
  const undatedBalances = unpaidVendors.filter((vendor) => !vendor.payment_due_date);
  if (undatedBalances.length) missing.push(`${undatedBalances.length} selected vendors have a recorded balance but no payment due date.`);
  for (const vendor of unpaidVendors) {
    if (vendor.payment_due_date && vendor.payment_due_date <= weekEnd) priorities.push({
      source: "vendors", id: vendor.id, title: `Review ${vendor.name}'s payment`, date: vendor.payment_due_date, path: "/vendors",
      reason: `${vendor.payment_due_date < today ? "Payment date passed" : "Payment date"}: ${vendor.payment_due_date}. Recorded quote balance ${money((cents(vendor.price!) - cents(vendor.amount_paid)) / 100)}; check the agreed instalment before paying.`,
    });
  }
  priorities.sort((a, b) => a.date.localeCompare(b.date) || a.source.localeCompare(b.source) || a.id.localeCompare(b.id));
  return {
    version: 1, wedding, generatedAt: now.toISOString(), today, weekEnd, timezone: "Africa/Nairobi",
    scope: "Based on wedding records you can access. Personal budgets excluded.",
    sources: Object.fromEntries(Object.entries(sources).map(([key, source]) => [key, source.status])),
    tasks: taskSummary,
    taskItems: tasks.status === "ready" ? tasks.rows.map((task) => ({
      id: task.id,
      title: task.title,
      completed: task.completed,
      dueDate: task.due_date,
    })) : null,
    budget: budget.status === "ready" ? { categories: budget.rows.length, allocated: total(budget.rows.map((row) => row.allocated)), recordedSpent: total(budget.rows.map((row) => row.spent)) } : null,
    payments: payments.status === "ready" ? { count: payments.rows.length, recorded: total(payments.rows.map((row) => row.amount)) } : null,
    guests: guests.status === "ready" ? { total: guests.rows.length, confirmed: guests.rows.filter((row) => row.rsvp_status === "confirmed").length, pending: guests.rows.filter((row) => row.rsvp_status === "pending").length } : null,
    vendors: vendors.status === "ready" ? { total: vendors.rows.length, selected: finalVendors.length, unconfirmed: finalVendors.filter((row) => row.status !== "confirmed").length } : null,
    upcomingPayments,
    priorities: priorities.slice(0, 3), missing,
    limitations: ["Payment logs include only entries your account can see; other wedding members may have additional entries. These logs are not proof of provider settlement. Invoice totals and contractual commitments are not included.", "Priorities use recorded task and vendor payment dates. Missing confirmations and RSVPs do not imply a deadline."],
    links: { tasks: "/tasks", budget: "/budget", guests: "/guests", vendors: "/vendors" },
  };
}

export function renderWeddingBriefing(brief: ReturnType<typeof buildWeddingBriefing>, intent: BriefingIntent) {
  const lines = [`**${plain(brief.wedding.name)}**${brief.wedding.wedding_date ? ` · ${brief.wedding.wedding_date}` : " · Wedding date not set"}`, `Checked ${brief.today} (Kenya time). ${brief.scope}`];
  if (intent === "summary") {
    if (brief.tasks) lines.push(`- [Tasks](/tasks): ${brief.tasks.completed} of ${brief.tasks.total} complete; ${brief.tasks.overdue} overdue; ${brief.tasks.upcoming} due in the next seven days.`);
    if (brief.budget) lines.push(`- [Budget](/budget): ${money(brief.budget.allocated)} allocated across ${brief.budget.categories} ${brief.budget.categories === 1 ? "category" : "categories"}; ${money(brief.budget.recordedSpent)} recorded spending.`);
    if (brief.payments) lines.push(`- [Payment entries visible to you](/budget): ${money(brief.payments.recorded)} across ${brief.payments.count} ${brief.payments.count === 1 ? "entry" : "entries"}.`);
    if (brief.guests) lines.push(`- [Guests](/guests): ${brief.guests.total} guest records; ${brief.guests.confirmed} confirmed; ${brief.guests.pending} awaiting RSVP. Counts are guest records, not total attendees including plus-ones.`);
    if (brief.vendors) lines.push(`- [Vendors](/vendors): ${brief.vendors.total} tracked; ${brief.vendors.selected} selected; ${brief.vendors.unconfirmed} selected vendors not marked confirmed.`);
  }
  lines.push(`\n**Focus for ${brief.today} to ${brief.weekEnd}**`);
  if (brief.priorities.length) {
    lines.push(...brief.priorities.map((priority) => `- [${plain(priority.title)}](${priority.path}): ${priority.reason}`));
  } else {
    lines.push("No dated task or vendor payment priorities were found in the records I could load. This does not confirm that all wedding work is complete.");
    if (brief.tasks?.total === 0) lines.push("[Add your first planning task](/tasks).");
    else if (brief.tasks?.undated) lines.push("[Add dates to open tasks](/tasks) so they can appear in your weekly focus.");
  }
  if (brief.missing.length) lines.push("\n**Missing or unavailable information**", ...brief.missing.map((item) => `- ${item}`));
  lines.push(`\n${intent === "summary" ? brief.limitations[0] : "Priorities use recorded task and vendor payment dates. Quote balances are not invoice amounts due."}`);
  return lines.join("\n\n");
}

export async function getWeddingBriefing(
  db: BriefingDatabase, actor: { userId: string; role: string; plannerType: string | null }, selectedClientId?: unknown, now = new Date(),
) {
  const wedding = await resolveBriefingWedding(db, actor, selectedClientId);
  const [tasks, budget, payments, guests, vendors] = await Promise.all([
    readBriefingRows<Task>(db, "tasks", "id,title,completed,due_date", wedding.id),
    readBriefingRows<Category>(db, "budget_categories", "id,allocated,spent", wedding.id, true),
    readBriefingRows<Payment>(db, "budget_payments", "id,amount", wedding.id, true),
    readBriefingRows<Guest>(db, "guests", "id,rsvp_status", wedding.id),
    readBriefingRows<Vendor>(db, "vendors", "id,name,selection_status,status,price,amount_paid,payment_due_date", wedding.id),
  ]);
  return buildWeddingBriefing(wedding, { tasks, budget, payments, guests, vendors }, now);
}
