import {
  getBriefingIntent,
  getWeddingBriefing,
  readBriefingRows,
  resolveBriefingWedding,
  renderWeddingBriefing,
  WeddingBriefingError,
  type BriefingDatabase,
  type BriefingIntent,
} from "./weddingBriefing.ts";
import {
  parseVendorSearchPrompt,
  searchZaniaVendors,
  type VendorSearchArguments,
  type VendorSearchResult,
} from "./vendorDiscovery.ts";
import type { ExternalVendorDiscoveryResult } from "./externalVendorDiscovery.ts";

export { parseVendorSearchPrompt } from "./vendorDiscovery.ts";

export type GatewayClientType =
  | "zania_web"
  | "zania_mobile"
  | "zania_ai"
  | "chatgpt"
  | "claude"
  | "gemini"
  | "whatsapp"
  | "voice";

export type GatewayReadCapability =
  | "get_my_weddings"
  | "get_wedding_summary"
  | "get_weekly_focus"
  | "get_budget_summary"
  | "get_upcoming_payments"
  | "get_tasks"
  | "get_guest_summary"
  | "get_vendor_summary"
  | "get_formal_quote_summary"
  | "get_negotiation_brief"
  | "get_negotiation_state"
  | "get_agreement_review"
  | "get_vendor_candidates"
  | "get_timeline_summary"
  | "discover_vendors"
  | "search_zania_vendors"
  | "get_planner_portfolio_briefing"
  | "get_vendor_business_briefing";
export type GatewayRiskClass = "A" | "B" | "C" | "D";

export type GatewayCapabilityDefinition = {
  name: GatewayReadCapability;
  version: 1;
  mode: "read";
  riskClass: GatewayRiskClass;
  description: string;
  openWorld: boolean;
};

export const INTELLIGENCE_GATEWAY_CAPABILITIES: readonly GatewayCapabilityDefinition[] = [
  ["get_my_weddings", "List wedding workspaces the authenticated actor can access."],
  ["get_wedding_summary", "Return the authorized normalized Wedding State."],
  ["get_weekly_focus", "Return authorized priorities for the next seven days."],
  ["get_budget_summary", "Return authorized wedding budget and recorded-payment totals."],
  ["get_upcoming_payments", "Return dated selected-vendor balances that need review."],
  ["get_tasks", "Return normalized task state for the authorized wedding."],
  ["get_guest_summary", "Return normalized guest and RSVP counts for the authorized wedding."],
  ["get_vendor_summary", "Return normalized vendor state and recent enquiry responses for the authorized wedding."],
  ["get_formal_quote_summary", "Return tracked formal quote request status and comparable response document evidence for the authorized wedding."],
  ["get_negotiation_brief", "Prepare an evidence-backed negotiation strategy from returned formal quotes without contacting a vendor or changing records."],
  ["get_negotiation_state", "Return saved negotiation targets, evidence-backed proposal rounds and derived Deal State for the authorized wedding."],
  ["get_agreement_review", "Compare accepted formal-quote evidence with a linked contract and return factual discrepancies and unknowns."],
  ["get_vendor_candidates", "List the authenticated couple or planner's private saved vendor candidates with source-backed fit reasons and unknowns."],
  ["get_timeline_summary", "Return normalized non-template timeline state for the authorized wedding."],
  ["discover_vendors", "Search approved Zania listings first, then use configured public-web discovery when more options are needed."],
  ["search_zania_vendors", "Search approved Zania vendor listings using structured service, location and budget intent."],
  ["get_planner_portfolio_briefing", "Return priorities across the authenticated professional planner's accessible client weddings."],
  ["get_vendor_business_briefing", "Return the authenticated vendor's lead, booking, payment and document priorities."],
].map(([name, description]) => ({
  name: name as GatewayReadCapability,
  version: 1 as const,
  mode: "read" as const,
  riskClass: "A" as const,
  description,
  openWorld: name === "discover_vendors",
}));

export type NegotiationBriefArguments = {
  quoteRequestId?: string;
  quoteDocumentId?: string;
  vendorName?: string;
  targetBudgetKes?: number;
  absoluteCeilingKes?: number;
  mustHave?: string[];
  willingToTrade?: string[];
  tone?: "gentle" | "commercial" | "planner";
};

export type GatewayArguments = Partial<VendorSearchArguments> & Partial<NegotiationBriefArguments>;

export type GatewayRequest = {
  version: 1;
  actor: { userId: string; tenantId: string | null; role: string; plannerType: string | null };
  client: { type: GatewayClientType; appId: string; sessionId: string | null };
  capability: GatewayReadCapability;
  resourceScope: { selectedClientId: string | null };
  arguments: GatewayArguments;
  confirmation: { status: "not_required"; confirmationId: null };
  trace: { requestId: string; correlationId: string };
};

type WeddingListItem = { id: string; name: string; weddingDate: string | null };
type TimelineItem = { id: string; title: string; timelineDate: string | null };
type PlannerClientPriority = {
  clientId: string; clientName: string; weddingDate: string | null;
  openTasks: number; overdueTasks: number; dueSoonTasks: number;
  nextTask: { id: string; title: string; dueDate: string | null } | null;
};
type PlannerPortfolioBriefing = {
  clients: number; openTasks: number; overdueTasks: number; dueSoonTasks: number;
  priorities: PlannerClientPriority[];
};
type VendorBusinessPriority = {
  kind: "lead" | "invoice" | "booking_payment" | "booking";
  id: string; title: string; reason: string; date: string | null; path: string;
};
type VendorBusinessBriefing = {
  listings: number; newEnquiries: number; activeBookings: number;
  invoicesAwaitingPayment: number; overdueInvoices: number; recordedOutstanding: number;
  priorities: VendorBusinessPriority[];
};
type SavedVendorCandidate = {
  id: string;
  businessName: string;
  category: string;
  location: string | null;
  website: string | null;
  sourceUrl: string | null;
  sourceKind: string;
  profileStatus: string;
  candidateStatus: string;
  weddingId: string | null;
  plannerClientId: string | null;
  assignment: "wedding" | "planner_client" | "unassigned";
  summary: string;
  matchReasons: string[];
  unknowns: string[];
  createdAt: string;
};
type VendorEnquiryReply = {
  enquiryId: string;
  vendorId: string;
  vendorName: string;
  subject: string;
  response: "available" | "unavailable" | "needs_details";
  message: string | null;
  quoteAmount: number | null;
  quoteCurrency: string | null;
  quoteValidUntil: string | null;
  respondedAt: string;
};
type VendorResponseBriefing = {
  awaiting: number;
  responded: number;
  responses: VendorEnquiryReply[];
};
type FormalQuoteLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};
type FormalQuoteEvidence = {
  id: string;
  documentNumber: string;
  title: string;
  status: string;
  currency: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  issueDate: string;
  validUntil: string | null;
  notes: string | null;
  terms: string | null;
  items: FormalQuoteLineItem[];
};
type FormalQuoteRequest = {
  id: string;
  vendorId: string | null;
  vendorName: string;
  serviceCategory: string | null;
  status: string;
  message: string | null;
  createdAt: string;
  dueAt: string | null;
  viewedAt: string | null;
  respondedAt: string | null;
  isOverdue: boolean;
  formalQuote: FormalQuoteEvidence | null;
};
type FormalQuoteBriefing = {
  total: number;
  awaiting: number;
  overdue: number;
  responded: number;
  changesRequested: number;
  requests: FormalQuoteRequest[];
};
type NegotiationOption = {
  kind: "package" | "payment" | "scope" | "alternative";
  title: string;
  rationale: string;
  evidence: string[];
};
type NegotiationQuoteBrief = {
  quoteRequestId: string;
  quoteDocumentId: string;
  vendorName: string;
  serviceCategory: string | null;
  documentNumber: string;
  currency: string;
  quotedTotal: number;
  targetBudget: number | null;
  absoluteCeiling: number | null;
  gapToTarget: number | null;
  mustHaveCoverage: Array<{ priority: string; state: "mentioned" | "not_found" }>;
  possibleTradeItems: FormalQuoteLineItem[];
  options: NegotiationOption[];
  formalAlternatives: Array<{ vendorName: string; documentNumber: string; totalAmount: number; currency: string }>;
  draftMessage: string;
};
type NegotiationBriefing = {
  quotes: NegotiationQuoteBrief[];
  profile: {
    targetBudget: number | null;
    absoluteCeiling: number | null;
    mustHave: string[];
    willingToTrade: string[];
    tone: "gentle" | "commercial" | "planner";
  };
  contactStatus: "not_contacted";
};
type NegotiationRound = {
  id: string;
  roundNumber: number;
  direction: "outbound" | "inbound";
  status: "draft" | "sent" | "countered" | "accepted" | "rejected" | "withdrawn";
  contactStatus: "not_contacted" | "contacted";
  message: string;
  proposedTotalKes: number | null;
  source: "intelligence_gateway" | "manual" | "vendor_response";
  createdAt: string;
};
type NegotiationState = {
  profiles: Array<{
    id: string;
    vendorName: string;
    documentNumber: string;
    quotedTotalKes: number | null;
    targetBudgetKes: number;
    absoluteCeilingKes: number | null;
    mustHave: string[];
    willingToTrade: string[];
    tone: "gentle" | "commercial" | "planner";
    dealState: "quoted" | "negotiating" | "agreed" | "contract_received" | "reviewed" | "signed" | "active";
    agreedTotalKes: number | null;
    agreedAt: string | null;
    rounds: NegotiationRound[];
  }>;
};
type AgreementComparison = {
  code: string;
  field: "amount" | "event_date" | "scope" | "terms" | string;
  severity: "high" | "review" | "unknown";
  message: string;
  agreedValue: unknown;
  contractValue: unknown;
};
type AgreementReview = {
  agreements: Array<{
    id: string;
    vendorName: string;
    state: "agreed" | "contract_received" | "reviewed" | "signed" | "active";
    reviewStatus: "pending_contract" | "aligned" | "needs_review" | "signed";
    acceptedQuote: Record<string, unknown>;
    contractId: string | null;
    contractTitle: string | null;
    contractStatus: string | null;
    contractFinancials: {
      currency: string;
      totalAmount: number | null;
      depositAmount: number | null;
      paymentSchedule: Array<{ title: string; amount: number; dueDate: string }>;
    } | null;
    proposedObligations: Array<{
      kind: "payment";
      title: string;
      amount: number;
      currency: string;
      dueDate: string;
      source: "contract_payment_schedule" | "external_contract_payment_schedule";
    }>;
    comparison: AgreementComparison[];
    discrepancyCount: number;
    unknownCount: number;
    comparedAt: string | null;
  }>;
  externalContracts: Array<{
    id: string;
    filename: string;
    status: "extracted" | "confirmed";
    agreementId: string | null;
    facts: Record<string, unknown>;
    fileDeletedAt: string | null;
    createdAt: string;
  }>;
};
export type WeddingState = Awaited<ReturnType<typeof getWeddingBriefing>>;

export type GatewayReadData = {
  intent: BriefingIntent | "list" | "domain_read";
  wedding?: WeddingState["wedding"];
  weddingState?: WeddingState;
  weddings?: WeddingListItem[];
  tasks?: WeddingState["tasks"];
  taskItems?: WeddingState["taskItems"];
  budget?: WeddingState["budget"];
  payments?: WeddingState["payments"];
  upcomingPayments?: WeddingState["upcomingPayments"];
  guests?: WeddingState["guests"];
  vendors?: WeddingState["vendors"];
  vendorResponses?: VendorResponseBriefing | null;
  formalQuotes?: FormalQuoteBriefing;
  negotiation?: NegotiationBriefing;
  negotiationState?: NegotiationState;
  agreementReview?: AgreementReview;
  timelines?: { total: number; upcoming: TimelineItem[] } | null;
  plannerPortfolio?: PlannerPortfolioBriefing;
  vendorBusiness?: VendorBusinessBriefing;
  vendorCandidates?: { total: number; candidates: SavedVendorCandidate[] };
  vendorSearch?: VendorSearchResult;
  vendorDiscovery?: {
    internal: VendorSearchResult;
    external: ExternalVendorDiscoveryResult | null;
    sourceCoverage: "internal_only" | "internal_plus_external";
  };
};

export type GatewayResult<T> = {
  ok: true;
  version: 1;
  capability: GatewayReadCapability;
  data: T;
  userSummary: string;
  warnings: string[];
  nextActions: Array<{ label: string; path: string }>;
  auditId: string;
};

type TimelineRow = { id: string; title: string; timeline_date: string | null; is_template: boolean };
const currency = (amount: number) => `KES ${amount.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;

function parseKesAmount(value: string, suffix?: string) {
  const amount = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  if (suffix?.toLowerCase() === "k") return amount * 1_000;
  if (suffix?.toLowerCase() === "m") return amount * 1_000_000;
  return amount;
}

export function parseNegotiationBriefPrompt(prompt: string): NegotiationBriefArguments {
  const target = prompt.match(/\b(?:target|budget|closer to|around|under|below)\s*(?:is|of|at|:)?\s*(?:kes|kshs?|ksh)?\s*([\d,.]+)\s*([km])?\b/i);
  const ceiling = prompt.match(/\b(?:absolute )?(?:ceiling|maximum|max)\s*(?:is|of|at|:)?\s*(?:kes|kshs?|ksh)?\s*([\d,.]+)\s*([km])?\b/i);
  const tone = /\bplanner(?: mode| tone)?\b/i.test(prompt)
    ? "planner"
    : /\bcommercial(?: tone)?\b/i.test(prompt)
    ? "commercial"
    : /\bgentle(?: tone)?\b/i.test(prompt)
    ? "gentle"
    : undefined;
  return {
    ...(target ? { targetBudgetKes: parseKesAmount(target[1], target[2]) } : {}),
    ...(ceiling ? { absoluteCeilingKes: parseKesAmount(ceiling[1], ceiling[2]) } : {}),
    ...(tone ? { tone } : {}),
  };
}

export function getGatewayCapability(name: string) {
  return INTELLIGENCE_GATEWAY_CAPABILITIES.find((capability) => capability.name === name) ?? null;
}

export function getGatewayReadIntent(prompt: string): GatewayReadCapability | null {
  const normalized = prompt.trim().toLowerCase().replace(/[?.!]+$/, "");
  if (!normalized || /\b(add|create|delete|remove|update|change|record|complete|send|invite|cancel)\b/.test(normalized)) {
    return null;
  }
  if (parseVendorSearchPrompt(prompt)) return "discover_vendors";
  const briefingIntent = getBriefingIntent(normalized);
  if (briefingIntent === "summary") return "get_wedding_summary";
  if (briefingIntent === "week") return "get_weekly_focus";
  if (/^(what|which) weddings (can|do) i (access|manage|have)$/.test(normalized)) return "get_my_weddings";
  if (/^(show|list) my weddings$/.test(normalized)) return "get_my_weddings";
  if (/^(what|which) tasks (do i have|are open|need attention)$/.test(normalized)) return "get_tasks";
  if (/^(show|summarize|review) (my|our) tasks$/.test(normalized)) return "get_tasks";
  if (/^(what is|show|summarize|review) (my|our) (wedding )?budget$/.test(normalized)) return "get_budget_summary";
  if (/^(what|which) payments (are coming up|are due|need attention)$/.test(normalized)) return "get_upcoming_payments";
  if (/^(show|summarize|review) (my|our) (upcoming )?payments$/.test(normalized)) return "get_upcoming_payments";
  if (/^(show|summarize|review) (my|our) guest list$/.test(normalized)) return "get_guest_summary";
  if (/^how many guests (have rsvp'd|have rsvped|are confirmed|are pending)$/.test(normalized)) return "get_guest_summary";
  if (/^(show|summarize|review) (my|our) vendors$/.test(normalized)) return "get_vendor_summary";
  if (/^(which|what) vendors (are confirmed|need attention|are missing)$/.test(normalized)) return "get_vendor_summary";
  if (/\b(vendor|vendors)\b.*\b(replied|responded|responses?|available|unavailable)\b/.test(normalized)) return "get_vendor_summary";
  if (/\b(who|which vendor)\b.*\b(replied|responded|available|unavailable)\b/.test(normalized)) return "get_vendor_summary";
  if (/\b(formal )?quotes?\b.*\b(compare|comparison|status|viewed|responded|returned|overdue|waiting|pending)\b/.test(normalized)) return "get_formal_quote_summary";
  if (/\b(compare|review|show|summarize|track|which|what)\b.*\b(formal )?quotes?\b/.test(normalized)) return "get_formal_quote_summary";
  if (/\bquote requests?\b/.test(normalized)) return "get_formal_quote_summary";
  if (/\b(negotiation|deal)\b.*\b(status|state|history|rounds?|progress|agreed|countered)\b/.test(normalized)) return "get_negotiation_state";
  if (/\b(counteroffers?|counter offers?)\b.*\b(show|received|history|status|state)\b/.test(normalized)) return "get_negotiation_state";
  if (/\b(contract|agreement)\b.*\b(compare|review|check|difference|discrepanc|match|changed|agreed)\w*\b/.test(normalized)) return "get_agreement_review";
  if (/\b(what|which)\b.*\b(changed|different)\b.*\b(contract|agreement)\b/.test(normalized)) return "get_agreement_review";
  if (/\b(negotiate|negotiation|counteroffer|counter offer|better deal|package flexibility)\b/.test(normalized)) return "get_negotiation_brief";
  if (/\b(saved|private) (vendor )?candidates\b/.test(normalized)) return "get_vendor_candidates";
  if (/^(show|list|compare|review|summarize) (my|our) saved vendors$/.test(normalized)) return "get_vendor_candidates";
  if (/^(show|summarize|review) (my|our) (wedding )?timeline$/.test(normalized)) return "get_timeline_summary";
  if (/which client wedding needs my attention first/.test(normalized)) return "get_planner_portfolio_briefing";
  if (/^(summarize|review) (the )?overdue work across my client weddings$/.test(normalized)) return "get_planner_portfolio_briefing";
  if (/^(give me|show me) (my |a )?(planner )?(portfolio )?briefing/.test(normalized)) return "get_planner_portfolio_briefing";
  if (/which (lead|client|booking) needs my attention first/.test(normalized)) return "get_vendor_business_briefing";
  if (/vendor workspace/.test(normalized) && /(next|attention|summarize|review)/.test(normalized)) return "get_vendor_business_briefing";
  if (/(summarize|review).*(lead|booking|payment|document)/.test(normalized)) return "get_vendor_business_briefing";
  return null;
}

export function createFirstPartyGatewayRequest(input: {
  actor: GatewayRequest["actor"];
  capability: GatewayReadCapability;
  selectedClientId?: string | null;
  requestId: string;
  correlationId: string;
  sessionId?: string | null;
  arguments?: GatewayArguments;
}): GatewayRequest {
  return createGatewayRequest({
    ...input,
    client: { type: "zania_web", appId: "zania-first-party", sessionId: input.sessionId ?? null },
  });
}

export function createGatewayRequest(input: {
  actor: GatewayRequest["actor"];
  client: GatewayRequest["client"];
  capability: GatewayReadCapability;
  selectedClientId?: string | null;
  requestId: string;
  correlationId: string;
  arguments?: GatewayArguments;
}): GatewayRequest {
  if (!getGatewayCapability(input.capability)) throw new Error(`Unsupported Gateway capability: ${input.capability}`);
  return {
    version: 1,
    actor: input.actor,
    client: input.client,
    capability: input.capability,
    resourceScope: { selectedClientId: input.selectedClientId ?? null },
    arguments: input.arguments ?? {},
    confirmation: { status: "not_required", confirmationId: null },
    trace: { requestId: input.requestId, correlationId: input.correlationId },
  };
}

async function listAuthorizedWeddings(db: BriefingDatabase, request: GatewayRequest): Promise<WeddingListItem[]> {
  if (request.actor.role !== "couple" && !(request.actor.role === "planner" && request.actor.plannerType !== "committee")) {
    throw new WeddingBriefingError("Wedding workspaces are available to couples and professional planners.", 403);
  }
  const { data: memberships, error } = await db.from("wedding_memberships")
    .select("wedding_id").eq("user_id", request.actor.userId).eq("membership_status", "active")
    .is("revoked_at", null).in("role", ["bride", "groom", "planner"]).limit(200);
  if (error) throw new WeddingBriefingError("Could not check wedding access. Please try again.", 503);
  const weddingIds = [...new Set((memberships ?? []).map((row) => row.wedding_id).filter((id): id is string => typeof id === "string"))];
  if (!weddingIds.length) return [];
  const { data: weddings, error: weddingsError } = await db.from("weddings")
    .select("id,name,wedding_date").in("id", weddingIds).eq("status", "active").is("deleted_at", null)
    .order("wedding_date").limit(200);
  if (weddingsError) throw new WeddingBriefingError("Could not load wedding workspaces. Please try again.", 503);
  return (weddings ?? []).map((wedding) => ({
    id: String(wedding.id), name: String(wedding.name),
    weddingDate: typeof wedding.wedding_date === "string" ? wedding.wedding_date : null,
  }));
}

function sourceWarnings(state: WeddingState) {
  return Object.entries(state.sources).filter(([, status]) => status === "unavailable")
    .map(([source]) => `Complete ${source} records were unavailable.`);
}

function baseResult(request: GatewayRequest) {
  return { ok: true as const, version: 1 as const, capability: request.capability, auditId: request.trace.requestId };
}

type ProfessionalSource<T> = { status: "ready" | "unavailable"; rows: T[] };

async function readProfessionalRows<T>(
  db: BriefingDatabase,
  table: string,
  columns: string,
  filter: (query: any) => any,
  maxRows = 10000,
): Promise<ProfessionalSource<T>> {
  try {
    const query = filter(db.from(table).select(columns, { count: "exact" }));
    const { data, error, count } = await query.order("id").range(0, maxRows);
    if (error || !data || count === null || count > maxRows || data.length !== count) {
      return { status: "unavailable", rows: [] };
    }
    return { status: "ready", rows: data as unknown as T[] };
  } catch {
    return { status: "unavailable", rows: [] };
  }
}

const kenyaToday = (now: Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit",
}).format(now);

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function getPlannerPortfolioBriefing(
  db: BriefingDatabase,
  request: GatewayRequest,
  now: Date,
): Promise<GatewayResult<GatewayReadData>> {
  if (request.actor.role !== "planner" || request.actor.plannerType === "committee") {
    throw new WeddingBriefingError("The portfolio briefing is available to professional planners.", 403);
  }
  const clients = await readProfessionalRows<{
    id: string; client_name: string; partner_name: string | null; wedding_date: string | null;
    linked_user_id: string | null;
  }>(db, "planner_clients", "id,client_name,partner_name,wedding_date,linked_user_id", (query) => (
    query.eq("planner_user_id", request.actor.userId).eq("is_archived", false)
  ), 500);
  if (clients.status !== "ready") {
    throw new WeddingBriefingError("Could not load your planner clients. Please try again.", 503);
  }
  const clientIds = clients.rows.map((client) => client.id);
  const linkedUserIds = clients.rows.map((client) => client.linked_user_id).filter((id): id is string => Boolean(id));
  const emptyTasks: ProfessionalSource<{ id: string; title: string; completed: boolean; due_date: string | null; client_id: string | null; user_id: string }> = { status: "ready", rows: [] };
  const [clientTasks, linkedTasks] = await Promise.all([
    clientIds.length
      ? readProfessionalRows(db, "tasks", "id,title,completed,due_date,client_id,user_id", (query) => query.in("client_id", clientIds))
      : Promise.resolve(emptyTasks),
    linkedUserIds.length
      ? readProfessionalRows(db, "tasks", "id,title,completed,due_date,client_id,user_id", (query) => query.in("user_id", linkedUserIds))
      : Promise.resolve(emptyTasks),
  ]);
  const tasksAvailable = clientTasks.status === "ready" && linkedTasks.status === "ready";
  const uniqueTasks = tasksAvailable
    ? [...new Map([...clientTasks.rows, ...linkedTasks.rows].map((task) => [task.id, task])).values()]
    : [];
  const today = kenyaToday(now);
  const dueSoonEnd = addDays(today, 6);
  const clientByLinkedUser = new Map(clients.rows.filter((client) => client.linked_user_id).map((client) => [client.linked_user_id as string, client.id]));
  const priorities = clients.rows.map((client) => {
    const tasks = uniqueTasks.filter((task) => task.client_id === client.id || clientByLinkedUser.get(task.user_id) === client.id);
    const open = tasks.filter((task) => !task.completed);
    const dated = open.filter((task) => task.due_date).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
    const overdue = dated.filter((task) => String(task.due_date) < today).length;
    const dueSoon = dated.filter((task) => String(task.due_date) >= today && String(task.due_date) <= dueSoonEnd).length;
    return {
      clientId: client.id,
      clientName: [client.client_name, client.partner_name].filter(Boolean).join(" & "),
      weddingDate: client.wedding_date,
      openTasks: open.length,
      overdueTasks: overdue,
      dueSoonTasks: dueSoon,
      nextTask: dated[0] ? { id: dated[0].id, title: dated[0].title, dueDate: dated[0].due_date } : null,
    };
  }).sort((left, right) => (
    right.overdueTasks - left.overdueTasks
    || right.dueSoonTasks - left.dueSoonTasks
    || right.openTasks - left.openTasks
    || left.clientName.localeCompare(right.clientName)
  ));
  const briefing: PlannerPortfolioBriefing = {
    clients: clients.rows.length,
    openTasks: priorities.reduce((total, item) => total + item.openTasks, 0),
    overdueTasks: priorities.reduce((total, item) => total + item.overdueTasks, 0),
    dueSoonTasks: priorities.reduce((total, item) => total + item.dueSoonTasks, 0),
    priorities: priorities.slice(0, 5),
  };
  const first = briefing.priorities[0];
  const summary = !briefing.clients
    ? "No active client weddings are in this planner workspace yet."
    : !tasksAvailable
      ? `${briefing.clients} client wedding${briefing.clients === 1 ? " is" : "s are"} connected, but complete task records are currently unavailable.`
      : first && (first.overdueTasks || first.dueSoonTasks)
        ? `Start with ${first.clientName}: ${first.overdueTasks} overdue task${first.overdueTasks === 1 ? "" : "s"} and ${first.dueSoonTasks} due in the next seven days. Across ${briefing.clients} client wedding${briefing.clients === 1 ? "" : "s"}, ${briefing.overdueTasks} tasks are overdue and ${briefing.dueSoonTasks} are due soon.`
        : `No dated urgent tasks were found across ${briefing.clients} client wedding${briefing.clients === 1 ? "" : "s"}. ${briefing.openTasks} open task${briefing.openTasks === 1 ? " remains" : "s remain"}.`;
  return {
    ...baseResult(request), data: { intent: "domain_read", plannerPortfolio: briefing },
    userSummary: summary,
    warnings: tasksAvailable ? [] : ["Complete planner task records were unavailable."],
    nextActions: [{ label: first ? `Open ${first.clientName}` : "Open weddings", path: "/clients" }],
  };
}

async function getVendorBusinessBriefing(
  db: BriefingDatabase,
  request: GatewayRequest,
  now: Date,
): Promise<GatewayResult<GatewayReadData>> {
  if (request.actor.role !== "vendor") {
    throw new WeddingBriefingError("The vendor business briefing is available to vendor accounts.", 403);
  }
  const listings = await readProfessionalRows<{ id: string; business_name: string }>(
    db, "vendor_listings", "id,business_name", (query) => query.eq("user_id", request.actor.userId), 50,
  );
  if (listings.status !== "ready") throw new WeddingBriefingError("Could not load your vendor workspace. Please try again.", 503);
  const listingIds = listings.rows.map((listing) => listing.id);
  const empty = <T,>(): ProfessionalSource<T> => ({ status: "ready", rows: [] });
  const [enquiries, bookings, documents] = await Promise.all([
    listingIds.length
      ? readProfessionalRows<{ id: string; status: string; created_at: string }>(db, "vendor_connection_requests", "id,status,created_at", (query) => query.in("vendor_listing_id", listingIds), 1000)
      : Promise.resolve(empty()),
    listingIds.length
      ? readProfessionalRows<{ id: string; status: string | null; price: number | null; amount_paid: number | null; payment_due_date: string | null; created_at: string }>(db, "vendors", "id,status,price,amount_paid,payment_due_date,created_at", (query) => query.in("vendor_listing_id", listingIds), 5000)
      : Promise.resolve(empty()),
    readProfessionalRows<{ id: string; document_type: string; status: string; recipient_name: string; total_amount: number; balance_due: number; due_date: string | null; issue_date: string }>(
      db, "commercial_documents", "id,document_type,status,recipient_name,total_amount,balance_due,due_date,issue_date",
      (query) => query.eq("user_id", request.actor.userId).eq("role", "vendor"), 5000,
    ),
  ]);
  const sourcesReady = enquiries.status === "ready" && bookings.status === "ready" && documents.status === "ready";
  const today = kenyaToday(now);
  const dueSoonEnd = addDays(today, 14);
  const newEnquiries = enquiries.rows.filter((item) => item.status === "pending");
  const activeBookings = bookings.rows.filter((item) => !["completed", "rejected"].includes(String(item.status ?? "")));
  const invoices = documents.rows.filter((item) => item.document_type === "invoice" && ["sent", "part_paid"].includes(item.status) && Number(item.balance_due ?? 0) > 0);
  const overdueInvoices = invoices.filter((item) => item.due_date && item.due_date < today);
  const bookingPayments = activeBookings.filter((item) => {
    const outstanding = Math.max(0, Number(item.price ?? 0) - Number(item.amount_paid ?? 0));
    return outstanding > 0 && item.payment_due_date && item.payment_due_date <= dueSoonEnd;
  });
  const priorities: VendorBusinessPriority[] = [
    ...newEnquiries.map((item) => ({ kind: "lead" as const, id: item.id, title: "Reply to a new enquiry", reason: "A couple is waiting for a response.", date: item.created_at?.slice(0, 10) ?? null, path: "/vendor-dashboard" })),
    ...overdueInvoices.map((item) => ({ kind: "invoice" as const, id: item.id, title: `Follow up ${item.recipient_name}'s invoice`, reason: `${currency(Number(item.balance_due))} is recorded as overdue.`, date: item.due_date, path: "/vendor-documents/invoices" })),
    ...bookingPayments.map((item) => ({ kind: "booking_payment" as const, id: item.id, title: "Review a booking payment", reason: `${currency(Math.max(0, Number(item.price ?? 0) - Number(item.amount_paid ?? 0)))} remains against the recorded quote.`, date: item.payment_due_date, path: "/vendor-dashboard" })),
  ].sort((left, right) => String(left.date ?? "9999-12-31").localeCompare(String(right.date ?? "9999-12-31"))).slice(0, 5);
  const briefing: VendorBusinessBriefing = {
    listings: listings.rows.length,
    newEnquiries: newEnquiries.length,
    activeBookings: activeBookings.length,
    invoicesAwaitingPayment: invoices.length,
    overdueInvoices: overdueInvoices.length,
    recordedOutstanding: invoices.reduce((total, item) => total + Number(item.balance_due ?? 0), 0),
    priorities,
  };
  const first = priorities[0];
  const summary = !listings.rows.length
    ? "Set up your vendor business profile before asking for a business briefing."
    : !sourcesReady
      ? "Your vendor workspace is connected, but complete lead, booking or document records are currently unavailable."
      : first
        ? `${first.title} first. ${first.reason} You have ${briefing.newEnquiries} new ${briefing.newEnquiries === 1 ? "enquiry" : "enquiries"}, ${briefing.activeBookings} active ${briefing.activeBookings === 1 ? "booking" : "bookings"}, and ${briefing.invoicesAwaitingPayment} invoice${briefing.invoicesAwaitingPayment === 1 ? "" : "s"} awaiting recorded payment.`
        : `No urgent lead, booking-payment or overdue-invoice action was found. You have ${briefing.activeBookings} active ${briefing.activeBookings === 1 ? "booking" : "bookings"} and ${briefing.invoicesAwaitingPayment} invoice${briefing.invoicesAwaitingPayment === 1 ? "" : "s"} awaiting recorded payment.`;
  return {
    ...baseResult(request), data: { intent: "domain_read", vendorBusiness: briefing }, userSummary: summary,
    warnings: sourcesReady ? [] : ["Complete vendor business records were unavailable."],
    nextActions: [{ label: first?.title ?? "Open vendor workspace", path: first?.path ?? "/vendor-dashboard" }],
  };
}

function candidateTextList(value: unknown, maxItems: number) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, maxItems)
    : [];
}

async function getSavedVendorCandidates(
  db: BriefingDatabase,
  request: GatewayRequest,
): Promise<GatewayResult<GatewayReadData>> {
  if (request.actor.role !== "couple" && request.actor.role !== "planner") {
    throw new WeddingBriefingError("Saved vendor candidates are available to couples and planners.", 403);
  }
  const source = await readProfessionalRows<{
    id: string; business_name: string; category: string; location: string | null;
    website: string | null; source_url: string | null; source_kind: string;
    profile_status: string; candidate_status: string; wedding_id: string | null;
    planner_client_id: string | null; snapshot: unknown; created_at: string;
  }>(
    db,
    "vendor_candidates",
    "id,business_name,category,location,website,source_url,source_kind,profile_status,candidate_status,wedding_id,planner_client_id,snapshot,created_at",
    (query) => query.eq("owner_user_id", request.actor.userId),
    500,
  );
  if (source.status !== "ready") {
    throw new WeddingBriefingError("Could not load your saved vendor candidates. Please try again.", 503);
  }
  const candidates = source.rows
    .filter((row) => row.candidate_status !== "dismissed")
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
    .map((row): SavedVendorCandidate => {
      const snapshot = row.snapshot && typeof row.snapshot === "object"
        ? row.snapshot as Record<string, unknown>
        : {};
      return {
        id: row.id,
        businessName: row.business_name,
        category: row.category,
        location: row.location,
        website: row.website,
        sourceUrl: row.source_url,
        sourceKind: row.source_kind,
        profileStatus: row.profile_status,
        candidateStatus: row.candidate_status,
        weddingId: row.wedding_id,
        plannerClientId: row.planner_client_id,
        assignment: row.planner_client_id ? "planner_client" : row.wedding_id ? "wedding" : "unassigned",
        summary: typeof snapshot.summary === "string" ? snapshot.summary : "",
        matchReasons: candidateTextList(snapshot.matchReasons ?? snapshot.match_reasons, 6),
        unknowns: candidateTextList(snapshot.unknowns, 8),
        createdAt: row.created_at,
      };
    });
  const summary = !candidates.length
    ? "You have no saved vendor candidates yet. Ask Zania to find a vendor, then ask to save one privately."
    : [
      `You have ${candidates.length} saved vendor candidate${candidates.length === 1 ? "" : "s"}:`,
      ...candidates.slice(0, 10).map((candidate, index) => {
        const assignment = candidate.assignment === "unassigned" ? "unassigned" : candidate.assignment === "planner_client" ? "assigned to a planner client" : "assigned to a wedding";
        const reasons = candidate.matchReasons.length ? ` Why it may fit: ${candidate.matchReasons.join("; ")}.` : candidate.summary ? ` ${candidate.summary}` : "";
        const unknowns = candidate.unknowns.length ? ` Still confirm: ${candidate.unknowns.join("; ")}.` : "";
        const sourceUrl = candidate.sourceUrl ?? candidate.website;
        const source = sourceUrl ? ` [Source](${sourceUrl}).` : "";
        return `${index + 1}. ${candidate.businessName} — ${candidate.category}${candidate.location ? ` · ${candidate.location}` : ""} · ${assignment}.${reasons}${unknowns}${source}`;
      }),
      candidates.length > 10 ? `${candidates.length - 10} more candidate${candidates.length - 10 === 1 ? " is" : "s are"} available in Saved vendor candidates.` : "",
      "These are private research records. No vendor has been contacted and no public profile was created.",
    ].filter(Boolean).join("\n\n");
  return {
    ...baseResult(request),
    data: { intent: "domain_read", vendorCandidates: { total: candidates.length, candidates } },
    userSummary: summary,
    warnings: ["Availability, current pricing and final service details still require direct confirmation."],
    nextActions: [{ label: "Open saved candidates", path: "/vendor-candidates" }],
  };
}

async function getVendorResponseBriefing(
  db: BriefingDatabase,
  weddingId: string,
): Promise<{ status: "ready" | "unavailable"; value: VendorResponseBriefing | null }> {
  const enquiries = await readProfessionalRows<{
    id: string; vendor_id: string; subject: string; delivery_status: string;
    response_status: string; responded_at: string | null;
  }>(db, "vendor_enquiries", "id,vendor_id,subject,delivery_status,response_status,responded_at", (query) => (
    query.eq("wedding_id", weddingId)
  ), 500);
  if (enquiries.status !== "ready") return { status: "unavailable", value: null };

  const responseEnquiries = enquiries.rows.filter((row) => row.response_status !== "awaiting_response" && row.responded_at);
  const responseIds = responseEnquiries.map((row) => row.id);
  const vendorIds = [...new Set(responseEnquiries.map((row) => row.vendor_id))];
  const empty = <T,>(): ProfessionalSource<T> => ({ status: "ready", rows: [] });
  const [responses, vendors] = await Promise.all([
    responseIds.length
      ? readProfessionalRows<{
          enquiry_id: string; response: VendorEnquiryReply["response"]; message: string | null;
          quote_amount: number | string | null; quote_currency: string | null;
          quote_valid_until: string | null; created_at: string;
        }>(db, "vendor_enquiry_responses", "enquiry_id,response,message,quote_amount,quote_currency,quote_valid_until,created_at", (query) => query.in("enquiry_id", responseIds), 500)
      : Promise.resolve(empty()),
    vendorIds.length
      ? readProfessionalRows<{ id: string; name: string }>(db, "vendors", "id,name", (query) => query.in("id", vendorIds), 500)
      : Promise.resolve(empty()),
  ]);
  if (responses.status !== "ready" || vendors.status !== "ready") return { status: "unavailable", value: null };

  const responseByEnquiry = new Map(responses.rows.map((row) => [row.enquiry_id, row]));
  const vendorById = new Map(vendors.rows.map((row) => [row.id, row.name]));
  const mapped = responseEnquiries.map((enquiry) => {
    const response = responseByEnquiry.get(enquiry.id);
    if (!response) return null;
    return {
      enquiryId: enquiry.id,
      vendorId: enquiry.vendor_id,
      vendorName: vendorById.get(enquiry.vendor_id) ?? "Vendor",
      subject: enquiry.subject,
      response: response.response,
      message: response.message,
      quoteAmount: response.quote_amount == null ? null : Number(response.quote_amount),
      quoteCurrency: response.quote_currency,
      quoteValidUntil: response.quote_valid_until,
      respondedAt: enquiry.responded_at as string,
    } satisfies VendorEnquiryReply;
  }).filter((row): row is VendorEnquiryReply => row !== null)
    .sort((left, right) => right.respondedAt.localeCompare(left.respondedAt));

  return {
    status: "ready",
    value: {
      awaiting: enquiries.rows.filter((row) => row.delivery_status === "sent" && row.response_status === "awaiting_response").length,
      responded: mapped.length,
      responses: mapped.slice(0, 10),
    },
  };
}

type GatewayRpcDatabase = BriefingDatabase & {
  rpc(functionName: string, arguments_: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function finiteAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function mapFormalQuoteRequest(value: unknown): FormalQuoteRequest | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.vendorName !== "string" || typeof row.status !== "string" || typeof row.createdAt !== "string") return null;
  const rawQuote = row.formalQuote && typeof row.formalQuote === "object" ? row.formalQuote as Record<string, unknown> : null;
  let formalQuote: FormalQuoteEvidence | null = null;
  if (rawQuote && typeof rawQuote.id === "string" && typeof rawQuote.documentNumber === "string"
    && typeof rawQuote.title === "string" && typeof rawQuote.status === "string"
    && typeof rawQuote.currency === "string" && typeof rawQuote.issueDate === "string") {
    formalQuote = {
      id: rawQuote.id,
      documentNumber: rawQuote.documentNumber,
      title: rawQuote.title,
      status: rawQuote.status,
      currency: rawQuote.currency,
      subtotal: finiteAmount(rawQuote.subtotal),
      discountAmount: finiteAmount(rawQuote.discountAmount),
      taxAmount: finiteAmount(rawQuote.taxAmount),
      totalAmount: finiteAmount(rawQuote.totalAmount),
      issueDate: rawQuote.issueDate,
      validUntil: optionalString(rawQuote.validUntil),
      notes: optionalString(rawQuote.notes),
      terms: optionalString(rawQuote.terms),
      items: Array.isArray(rawQuote.items) ? rawQuote.items.map((item) => {
        const line = item && typeof item === "object" ? item as Record<string, unknown> : {};
        return {
          description: typeof line.description === "string" ? line.description : "Item",
          quantity: finiteAmount(line.quantity), unitPrice: finiteAmount(line.unitPrice), lineTotal: finiteAmount(line.lineTotal),
        };
      }).slice(0, 100) : [],
    };
  }
  return {
    id: row.id,
    vendorId: optionalString(row.vendorId),
    vendorName: row.vendorName,
    serviceCategory: optionalString(row.serviceCategory),
    status: row.status,
    message: optionalString(row.message),
    createdAt: row.createdAt,
    dueAt: optionalString(row.dueAt),
    viewedAt: optionalString(row.viewedAt),
    respondedAt: optionalString(row.respondedAt),
    isOverdue: row.isOverdue === true,
    formalQuote,
  };
}

async function loadFormalQuoteEvidence(db: BriefingDatabase, request: GatewayRequest) {
  if (request.actor.role !== "couple" && (request.actor.role !== "planner" || request.actor.plannerType === "committee")) {
    throw new WeddingBriefingError("Formal quote records are available to couples and professional planners.", 403);
  }
  const wedding = await resolveBriefingWedding(
    db,
    { userId: request.actor.userId, role: request.actor.role, plannerType: request.actor.plannerType },
    request.resourceScope.selectedClientId,
  );
  const rpc = (db as GatewayRpcDatabase).rpc;
  if (typeof rpc !== "function") throw new WeddingBriefingError("Formal quote records are currently unavailable.", 503);
  const { data, error } = await rpc.call(db, "get_formal_quote_briefing", { _wedding_id: wedding.id });
  if (error || !data || typeof data !== "object") throw new WeddingBriefingError("Could not load formal quote records. Please try again.", 503);
  const raw = data as Record<string, unknown>;
  if (!Array.isArray(raw.requests)) throw new WeddingBriefingError("Formal quote records returned an invalid response.", 503);
  const requests = raw.requests.map(mapFormalQuoteRequest).filter((item): item is FormalQuoteRequest => item !== null);
  if (requests.length !== raw.requests.length) throw new WeddingBriefingError("Formal quote records returned incomplete evidence.", 503);
  const briefing: FormalQuoteBriefing = {
    total: requests.length,
    awaiting: requests.filter((item) => ["new", "viewed"].includes(item.status)).length,
    overdue: requests.filter((item) => item.isOverdue).length,
    responded: requests.filter((item) => item.status === "responded" && item.formalQuote).length,
    changesRequested: requests.filter((item) => item.status === "changes_requested").length,
    requests,
  };
  const returned = requests.filter((item): item is FormalQuoteRequest & { formalQuote: FormalQuoteEvidence } => Boolean(item.formalQuote))
    .sort((left, right) => (left.formalQuote.totalAmount - right.formalQuote.totalAmount) || left.vendorName.localeCompare(right.vendorName));
  return { wedding, briefing, returned };
}

async function getFormalQuoteBriefing(
  db: BriefingDatabase,
  request: GatewayRequest,
): Promise<GatewayResult<GatewayReadData>> {
  const { wedding, briefing, returned } = await loadFormalQuoteEvidence(db, request);
  const { requests } = briefing;
  const summary = !requests.length
    ? "No tracked formal quote requests are recorded for this wedding. Indicative vendor replies are kept separately."
    : [
      `${briefing.total} formal quote request${briefing.total === 1 ? " is" : "s are"} tracked: ${briefing.awaiting} awaiting a formal response, ${briefing.responded} with a returned formal quote, ${briefing.changesRequested} awaiting changes, and ${briefing.overdue} overdue.`,
      ...returned.slice(0, 10).map((item, index) => {
        const quote = item.formalQuote!;
        const scope = quote.items.length ? ` Scope: ${quote.items.slice(0, 3).map((line) => line.description).join("; ")}${quote.items.length > 3 ? "; and more" : ""}.` : " Scope is not itemized.";
        return `${index + 1}. ${item.vendorName} — ${quote.currency} ${quote.totalAmount.toLocaleString("en-KE")} · formal quote ${quote.documentNumber} · ${quote.status} · issued ${quote.issueDate}${quote.validUntil ? ` · valid until ${quote.validUntil}` : " · no validity date recorded"}.${scope}`;
      }),
      returned.length > 1 ? "Totals are comparable only after checking scope, quantities, exclusions, terms and validity. No quote has been accepted by this summary." : "",
      "Indicative enquiry amounts are excluded from these formal quote totals.",
    ].filter(Boolean).join("\n\n");
  return {
    ...baseResult(request),
    data: { intent: "domain_read", wedding, formalQuotes: briefing },
    userSummary: summary,
    warnings: ["A lower total does not mean equivalent scope. Review line items, terms, exclusions and validity before selecting a vendor."],
    nextActions: [{ label: "Open received documents", path: "/received-documents" }],
  };
}

function normalizeEvidence(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function negotiationList(value: unknown, label: string) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new WeddingBriefingError(`${label} must be a list.`, 400);
  const items = value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean);
  if (items.length > 10 || items.some((item) => item.length > 160)) {
    throw new WeddingBriefingError(`${label} can include up to 10 short items.`, 400);
  }
  return items;
}

function positiveNegotiationAmount(value: unknown, label: string) {
  if (value == null) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    throw new WeddingBriefingError(`${label} must be a valid positive KES amount.`, 400);
  }
  return amount;
}

function quoteMoney(currencyCode: string, amount: number) {
  return `${currencyCode} ${amount.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
}

function buildNegotiationDraft(
  quote: FormalQuoteRequest & { formalQuote: FormalQuoteEvidence },
  profile: NegotiationBriefing["profile"],
  tradeItems: FormalQuoteLineItem[],
) {
  const target = profile.targetBudget ? quoteMoney("KES", profile.targetBudget) : null;
  const priorities = profile.mustHave.length ? ` while preserving ${profile.mustHave.join(", ")}` : "";
  const trade = tradeItems.length
    ? ` Could you advise whether adjusting ${tradeItems.slice(0, 3).map((item) => item.description).join(", ")} would help${target ? ` bring the package closer to ${target}` : ""}?`
    : ` Could you advise which package elements could be adjusted${target ? ` to bring it closer to ${target}` : ""}${priorities}?`;
  if (profile.tone === "commercial") {
    return `We are reviewing formal quote ${quote.formalQuote.documentNumber} at ${quoteMoney(quote.formalQuote.currency, quote.formalQuote.totalAmount)}.${target ? ` Our target allocation is ${target}.` : ""}${trade}`;
  }
  if (profile.tone === "planner") {
    return `Our client would like to explore a workable structure for formal quote ${quote.formalQuote.documentNumber}.${target ? ` We need to close the gap toward ${target}` : " Please identify the available package flexibility"}${priorities}.${trade}`;
  }
  return `We really like your work and are reviewing formal quote ${quote.formalQuote.documentNumber}.${target ? ` Our allocated budget is around ${target}.` : ""}${trade}`;
}

async function getNegotiationBriefing(
  db: BriefingDatabase,
  request: GatewayRequest,
): Promise<GatewayResult<GatewayReadData>> {
  const { wedding, returned } = await loadFormalQuoteEvidence(db, request);
  const args = request.arguments as NegotiationBriefArguments;
  const targetBudget = positiveNegotiationAmount(args.targetBudgetKes, "The negotiation target");
  const absoluteCeiling = positiveNegotiationAmount(args.absoluteCeilingKes, "The negotiation ceiling");
  if (targetBudget != null && absoluteCeiling != null && targetBudget > absoluteCeiling) {
    throw new WeddingBriefingError("The negotiation target cannot be higher than the absolute ceiling.", 400);
  }
  const mustHave = negotiationList(args.mustHave, "Must-haves");
  const willingToTrade = negotiationList(args.willingToTrade, "Tradeable items");
  const tone = args.tone && ["gentle", "commercial", "planner"].includes(args.tone) ? args.tone : "gentle";
  const profile: NegotiationBriefing["profile"] = { targetBudget, absoluteCeiling, mustHave, willingToTrade, tone };
  const negotiable = returned.filter((item) => item.status === "responded" && item.formalQuote.status === "sent");

  const selectorCount = [args.quoteRequestId, args.quoteDocumentId, args.vendorName].filter(Boolean).length;
  let selected = negotiable;
  if (args.quoteRequestId) selected = selected.filter((item) => item.id === args.quoteRequestId);
  if (args.quoteDocumentId) selected = selected.filter((item) => item.formalQuote.id === args.quoteDocumentId);
  if (args.vendorName) {
    const wanted = normalizeEvidence(args.vendorName);
    const exact = selected.filter((item) => normalizeEvidence(item.vendorName) === wanted);
    selected = exact.length ? exact : selected.filter((item) => normalizeEvidence(item.vendorName).includes(wanted));
  }
  if (selectorCount && !selected.length) {
    throw new WeddingBriefingError("Zania could not find that returned formal quote in this wedding.", 404);
  }
  if (args.vendorName && selected.length > 1) {
    throw new WeddingBriefingError("More than one returned formal quote matches that vendor. Choose the exact quote document.", 409);
  }
  selected = selected.slice(0, 5);

  const optionalItemPattern = /\b(album|engagement|pre wedding|print|canvas|drone|teaser|trailer|extra hour|additional hour|second shooter|second photographer|same day|photo book|photobook)\b/i;
  const quotes = selected.map((item): NegotiationQuoteBrief => {
    const quote = item.formalQuote;
    const normalizedMustHave = mustHave.map(normalizeEvidence);
    const normalizedTrade = willingToTrade.map(normalizeEvidence);
    const possibleTradeItems = quote.items.filter((line) => {
      const description = normalizeEvidence(line.description);
      if (normalizedMustHave.some((priority) => priority && (description.includes(priority) || priority.includes(description)))) return false;
      if (normalizedTrade.length) return normalizedTrade.some((trade) => trade && (description.includes(trade) || trade.includes(description)));
      return optionalItemPattern.test(line.description);
    }).slice(0, 5);
    const formalAlternatives = negotiable.filter((alternative) => (
      alternative.id !== item.id
      && (!item.serviceCategory || !alternative.serviceCategory
        || normalizeEvidence(alternative.serviceCategory) === normalizeEvidence(item.serviceCategory))
    )).slice(0, 5).map((alternative) => ({
      vendorName: alternative.vendorName,
      documentNumber: alternative.formalQuote.documentNumber,
      totalAmount: alternative.formalQuote.totalAmount,
      currency: alternative.formalQuote.currency,
    }));
    const options: NegotiationOption[] = [];
    if (possibleTradeItems.length) options.push({
      kind: "package",
      title: "Restructure the package",
      rationale: "Ask the vendor whether evidenced non-priority items can be removed, shortened or substituted. Their price effect is not assumed.",
      evidence: possibleTradeItems.map((line) => `${line.description} — ${quoteMoney(quote.currency, line.lineTotal)}`),
    });
    options.push({
      kind: "scope",
      title: "Protect priorities and ask where scope is flexible",
      rationale: mustHave.length
        ? `Keep ${mustHave.join(", ")} explicit while asking which other scope changes would affect the total.`
        : "Confirm must-haves before trading scope, then ask the vendor which changes would affect the total.",
      evidence: quote.items.slice(0, 5).map((line) => line.description),
    });
    options.push({
      kind: "payment",
      title: "Discuss payment structure separately from price",
      rationale: "A payment plan can improve affordability without misrepresenting it as a discount.",
      evidence: quote.terms ? [quote.terms] : ["No payment terms were captured in the formal quote."],
    });
    if (formalAlternatives.length) options.push({
      kind: "alternative",
      title: "Keep a real alternative available",
      rationale: "Use comparable formal quotes as decision evidence, while checking that their scope and terms are genuinely comparable.",
      evidence: formalAlternatives.map((alternative) => `${alternative.vendorName} — ${quoteMoney(alternative.currency, alternative.totalAmount)} (${alternative.documentNumber})`),
    });
    return {
      quoteRequestId: item.id,
      quoteDocumentId: quote.id,
      vendorName: item.vendorName,
      serviceCategory: item.serviceCategory,
      documentNumber: quote.documentNumber,
      currency: quote.currency,
      quotedTotal: quote.totalAmount,
      targetBudget,
      absoluteCeiling,
      gapToTarget: targetBudget == null || quote.currency.toUpperCase() !== "KES" ? null : quote.totalAmount - targetBudget,
      mustHaveCoverage: mustHave.map((priority) => ({
        priority,
        state: quote.items.some((line) => normalizeEvidence(line.description).includes(normalizeEvidence(priority))) ? "mentioned" : "not_found",
      })),
      possibleTradeItems,
      options,
      formalAlternatives,
      draftMessage: buildNegotiationDraft(item, profile, possibleTradeItems),
    };
  });

  const summary = !returned.length
    ? "There is no returned formal quote to negotiate yet. Request or receive a formal quote first so Zania can work from verified scope and totals."
    : !negotiable.length
    ? "There is no active returned formal quote available for negotiation. Accepted, expired or already-amended documents are not treated as open negotiation evidence."
    : !quotes.length
    ? "No returned formal quote matched the requested negotiation target."
    : quotes.map((brief) => {
      const gap = brief.targetBudget != null && brief.currency.toUpperCase() !== "KES"
        ? `The target is KES ${brief.targetBudget.toLocaleString("en-KE")}; Zania did not compare it with this ${brief.currency} quote because no verified exchange rate is recorded.`
        : brief.gapToTarget == null
        ? "No target budget was provided."
        : brief.gapToTarget > 0
        ? `The quote is ${quoteMoney(brief.currency, brief.gapToTarget)} above the target.`
        : `The quote is within the target by ${quoteMoney(brief.currency, Math.abs(brief.gapToTarget))}.`;
      const trade = brief.possibleTradeItems.length
        ? `Possible items to ask about: ${brief.possibleTradeItems.map((item) => item.description).join("; ")}. Their removability and price effect are not confirmed.`
        : "No clearly optional line item was identified. Confirm must-haves, then ask the vendor where scope is flexible.";
      const alternatives = brief.formalAlternatives.length
        ? `Formal alternatives on record: ${brief.formalAlternatives.map((item) => `${item.vendorName} at ${quoteMoney(item.currency, item.totalAmount)}`).join("; ")}. Compare scope and terms before relying on them.`
        : "No comparable returned formal alternative is recorded yet.";
      return [
        `Negotiation brief: ${brief.vendorName} · formal quote ${brief.documentNumber} · ${quoteMoney(brief.currency, brief.quotedTotal)}.`,
        gap,
        trade,
        alternatives,
        `Draft only — not sent: “${brief.draftMessage}”`,
      ].join("\n");
    }).join("\n\n");

  return {
    ...baseResult(request),
    data: { intent: "domain_read", wedding, negotiation: { quotes, profile, contactStatus: "not_contacted" } },
    userSummary: `${summary}\n\nNo vendor was contacted and no quote, tracker, contract or booking record changed.`,
    warnings: [
      "Never invent competing offers, urgency, budgets or vendor commitments.",
      "A suggested trade is a question for the vendor, not a confirmed price reduction.",
    ],
    nextActions: [{ label: "Open received documents", path: "/received-documents" }],
  };
}

async function getNegotiationState(
  db: BriefingDatabase,
  request: GatewayRequest,
): Promise<GatewayResult<GatewayReadData>> {
  if (request.actor.role !== "couple" && (request.actor.role !== "planner" || request.actor.plannerType === "committee")) {
    throw new WeddingBriefingError("Negotiation history is available to couples and professional planners.", 403);
  }
  const wedding = await resolveBriefingWedding(
    db,
    { userId: request.actor.userId, role: request.actor.role, plannerType: request.actor.plannerType },
    request.resourceScope.selectedClientId,
  );
  const rpc = (db as GatewayRpcDatabase).rpc;
  if (typeof rpc !== "function") throw new WeddingBriefingError("Negotiation history is currently unavailable.", 503);
  const { data, error } = await rpc.call(db, "get_negotiation_state", { _wedding_id: wedding.id });
  const rawProfiles = data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).profiles)
    ? (data as Record<string, unknown>).profiles as Record<string, unknown>[] : null;
  if (error || !rawProfiles) throw new WeddingBriefingError("Could not load negotiation history. Please try again.", 503);

  const profiles = rawProfiles.map((row) => {
    const rawRounds = Array.isArray(row.rounds) ? row.rounds as Record<string, unknown>[] : [];
    return {
      id: String(row.id ?? ""),
      vendorName: String(row.vendorName ?? "Vendor"),
      documentNumber: String(row.documentNumber ?? "Formal quote"),
      quotedTotalKes: row.quotedTotalKes == null ? null : finiteAmount(row.quotedTotalKes),
      targetBudgetKes: finiteAmount(row.targetBudgetKes),
      absoluteCeilingKes: row.absoluteCeilingKes == null ? null : finiteAmount(row.absoluteCeilingKes),
      mustHave: Array.isArray(row.mustHave) ? row.mustHave.filter((item): item is string => typeof item === "string") : [],
      willingToTrade: Array.isArray(row.willingToTrade) ? row.willingToTrade.filter((item): item is string => typeof item === "string") : [],
      tone: row.tone === "commercial" || row.tone === "planner" ? row.tone : "gentle" as const,
      dealState: (["quoted", "negotiating", "agreed", "contract_received", "reviewed", "signed", "active"].includes(String(row.dealState))
        ? String(row.dealState) : "quoted") as NegotiationState["profiles"][number]["dealState"],
      agreedTotalKes: row.agreedTotalKes == null ? null : finiteAmount(row.agreedTotalKes),
      agreedAt: typeof row.agreedAt === "string" ? row.agreedAt : null,
      rounds: rawRounds.map((round) => ({
        id: String(round.id ?? ""),
        roundNumber: Math.max(1, Math.trunc(finiteAmount(round.roundNumber))),
        direction: round.direction === "inbound" ? "inbound" as const : "outbound" as const,
        status: (["draft", "sent", "countered", "accepted", "rejected", "withdrawn"].includes(String(round.status))
          ? String(round.status) : "draft") as NegotiationRound["status"],
        contactStatus: round.contactStatus === "contacted" ? "contacted" as const : "not_contacted" as const,
        message: String(round.message ?? ""),
        proposedTotalKes: round.proposedTotalKes == null ? null : finiteAmount(round.proposedTotalKes),
        source: (["manual", "vendor_response"].includes(String(round.source))
          ? String(round.source) : "intelligence_gateway") as NegotiationRound["source"],
        createdAt: String(round.createdAt ?? ""),
      })),
    };
  });

  const summary = profiles.length
    ? profiles.map((profile) => {
      const latest = profile.rounds.at(-1);
      const amount = profile.dealState === "agreed" && profile.agreedTotalKes != null
        ? ` · agreed total KES ${profile.agreedTotalKes.toLocaleString("en-KE")}` : "";
      const latestText = latest
        ? ` Latest round ${latest.roundNumber}: ${latest.direction} ${latest.status}${latest.proposedTotalKes == null ? "" : ` at KES ${latest.proposedTotalKes.toLocaleString("en-KE")}`}.`
        : " No proposal rounds are recorded.";
      return `${profile.vendorName} · ${profile.documentNumber} · ${profile.dealState}${amount}.${latestText}`;
    }).join("\n")
    : "No saved negotiation profiles are recorded for this wedding.";

  return {
    ...baseResult(request),
    data: { intent: "domain_read", wedding, negotiationState: { profiles } },
    userSummary: summary,
    warnings: ["Deal State changes only from recorded quote actions and document evidence. A draft or conversation alone is not an agreement."],
    nextActions: [{ label: "Open received documents", path: "/received-documents" }],
  };
}

async function getAgreementReview(
  db: BriefingDatabase,
  request: GatewayRequest,
): Promise<GatewayResult<GatewayReadData>> {
  if (request.actor.role !== "couple" && (request.actor.role !== "planner" || request.actor.plannerType === "committee")) {
    throw new WeddingBriefingError("Agreement review is available to couples and professional planners.", 403);
  }
  const wedding = await resolveBriefingWedding(
    db,
    { userId: request.actor.userId, role: request.actor.role, plannerType: request.actor.plannerType },
    request.resourceScope.selectedClientId,
  );
  const rpc = (db as GatewayRpcDatabase).rpc;
  if (typeof rpc !== "function") throw new WeddingBriefingError("Agreement review is currently unavailable.", 503);
  const { data, error } = await rpc.call(db, "get_agreement_review", { _wedding_id: wedding.id });
  const rawAgreements = data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).agreements)
    ? (data as Record<string, unknown>).agreements as Record<string, unknown>[] : null;
  const rawExternalContracts = data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).externalContracts)
    ? (data as Record<string, unknown>).externalContracts as Record<string, unknown>[] : [];
  if (error || !rawAgreements) throw new WeddingBriefingError("Could not load the agreement review. Please try again.", 503);

  const agreements: AgreementReview["agreements"] = rawAgreements.map((row) => {
    const rawComparison = Array.isArray(row.comparison) ? row.comparison as Record<string, unknown>[] : [];
    return {
      id: String(row.id ?? ""),
      vendorName: String(row.vendorName ?? "Vendor"),
      state: (["agreed", "contract_received", "reviewed", "signed", "active"].includes(String(row.state))
        ? String(row.state) : "agreed") as AgreementReview["agreements"][number]["state"],
      reviewStatus: (["pending_contract", "aligned", "needs_review", "signed"].includes(String(row.reviewStatus))
        ? String(row.reviewStatus) : "pending_contract") as AgreementReview["agreements"][number]["reviewStatus"],
      acceptedQuote: row.acceptedQuote && typeof row.acceptedQuote === "object"
        ? row.acceptedQuote as Record<string, unknown> : {},
      contractId: typeof row.contractId === "string" ? row.contractId : null,
      contractTitle: typeof row.contractTitle === "string" ? row.contractTitle : null,
      contractStatus: typeof row.contractStatus === "string" ? row.contractStatus : null,
      contractFinancials: row.contractFinancials && typeof row.contractFinancials === "object"
        ? (() => {
          const financials = row.contractFinancials as Record<string, unknown>;
          const schedule = Array.isArray(financials.paymentSchedule) ? financials.paymentSchedule as Record<string, unknown>[] : [];
          return {
            currency: String(financials.currency ?? "KES"),
            totalAmount: financials.totalAmount == null ? null : finiteAmount(financials.totalAmount),
            depositAmount: financials.depositAmount == null ? null : finiteAmount(financials.depositAmount),
            paymentSchedule: schedule.map((payment) => ({
              title: String(payment.title ?? "Payment"),
              amount: finiteAmount(payment.amount),
              dueDate: String(payment.dueDate ?? ""),
            })).filter((payment) => payment.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(payment.dueDate)),
          };
        })()
        : null,
      proposedObligations: (Array.isArray(row.proposedObligations) ? row.proposedObligations as Record<string, unknown>[] : [])
        .map((obligation) => ({
          kind: "payment" as const,
          title: String(obligation.title ?? "Payment"),
          amount: finiteAmount(obligation.amount),
          currency: String(obligation.currency ?? "KES"),
          dueDate: String(obligation.dueDate ?? ""),
          source: obligation.source === "external_contract_payment_schedule"
            ? "external_contract_payment_schedule" as const
            : "contract_payment_schedule" as const,
        })).filter((obligation) => obligation.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(obligation.dueDate)),
      comparison: rawComparison.map((item) => ({
        code: String(item.code ?? "review_item"),
        field: String(item.field ?? "unknown"),
        severity: (item.severity === "high" || item.severity === "review" ? item.severity : "unknown") as AgreementComparison["severity"],
        message: String(item.message ?? "This field needs review."),
        agreedValue: item.agreedValue ?? null,
        contractValue: item.contractValue ?? null,
      })),
      discrepancyCount: Math.max(0, Math.trunc(finiteAmount(row.discrepancyCount ?? 0))),
      unknownCount: Math.max(0, Math.trunc(finiteAmount(row.unknownCount ?? 0))),
      comparedAt: typeof row.comparedAt === "string" ? row.comparedAt : null,
    };
  });
  const externalContracts: AgreementReview["externalContracts"] = rawExternalContracts.map((row) => ({
    id: String(row.id ?? ""),
    filename: String(row.filename ?? "Uploaded contract"),
    status: row.status === "confirmed" ? "confirmed" : "extracted",
    agreementId: typeof row.agreementId === "string" ? row.agreementId : null,
    facts: row.facts && typeof row.facts === "object" ? row.facts as Record<string, unknown> : {},
    fileDeletedAt: typeof row.fileDeletedAt === "string" ? row.fileDeletedAt : null,
    createdAt: String(row.createdAt ?? ""),
  }));

  const summary = agreements.length
    ? agreements.map((agreement) => {
      const quoteNumber = String(agreement.acceptedQuote.documentNumber ?? "accepted quote");
      const quoteTotal = finiteAmount(agreement.acceptedQuote.totalAmount ?? 0);
      const quoteCurrency = String(agreement.acceptedQuote.currency ?? "KES");
      if (!agreement.contractId && !agreement.contractStatus) {
        return `${agreement.vendorName} · ${quoteNumber} · ${quoteMoney(quoteCurrency, quoteTotal)} accepted. No linked contract has been received yet.`;
      }
      const findings = agreement.comparison.length
        ? agreement.comparison.map((item) => `- ${item.message}`).join("\n")
        : "- Zania found no structured difference in the fields it can compare.";
      const obligations = agreement.proposedObligations.length
        ? [
          "Proposed reminders from the structured contract schedule:",
          ...agreement.proposedObligations.map((item) => `- ${item.title}: ${quoteMoney(item.currency, item.amount)} due ${item.dueDate}.`),
          "These are proposals only. Ask Zania to create each reminder, then confirm the exact task before it is added.",
        ].join("\n")
        : "No structured payment dates are available to turn into reminders.";
      return [
        `${agreement.vendorName} · ${agreement.contractTitle ?? "Contract"} · ${agreement.reviewStatus}.`,
        `Compared with ${quoteNumber} at ${quoteMoney(quoteCurrency, quoteTotal)}.`,
        findings,
        obligations,
      ].join("\n");
    }).join("\n\n")
    : "No accepted quote agreement is recorded for this wedding yet.";
  const standaloneExternal = externalContracts.filter((contract) => !contract.agreementId);
  const externalSummary = standaloneExternal.length
    ? standaloneExternal.map((contract) => {
      const facts = contract.facts;
      const vendor = String(facts.vendorName ?? "Vendor not confirmed");
      const total = finiteAmount(facts.totalAmount ?? 0);
      const currency = String(facts.currency ?? "KES");
      const unknowns = Array.isArray(facts.unknowns) ? facts.unknowns.map(String).slice(0, 5) : [];
      return [
        `${vendor} · ${contract.filename} · ${contract.status}.`,
        total > 0 ? `Recorded total: ${quoteMoney(currency, total)}.` : "No confirmed total is recorded.",
        unknowns.length ? `Needs review: ${unknowns.join("; ")}.` : "No extraction unknowns were recorded.",
        contract.status === "extracted" ? "These facts are still an unconfirmed AI extraction. Review them in Received documents before relying on them." : "These facts were reviewed and confirmed in Zania.",
      ].join("\n");
    }).join("\n\n")
    : "";
  const combinedSummary = externalSummary ? `${summary}\n\nExternal contract reviews:\n${externalSummary}` : summary;

  return {
    ...baseResult(request),
    data: { intent: "domain_read", wedding, agreementReview: { agreements, externalContracts } },
    userSummary: combinedSummary,
    warnings: [
      "This is a factual comparison of structured Zania records, not legal advice or a conclusion about enforceability.",
      "A missing amount or scope match is shown as unknown or needing review; Zania does not infer missing terms from prose.",
    ],
    nextActions: [{ label: "Open received documents", path: "/received-documents" }],
  };
}

export async function executeGatewayRead(
  db: BriefingDatabase,
  request: GatewayRequest,
  now = new Date(),
  options: {
    externalVendorSearch?: (intent: VendorSearchArguments) => Promise<ExternalVendorDiscoveryResult>;
  } = {},
): Promise<GatewayResult<GatewayReadData>> {
  const definition = getGatewayCapability(request.capability);
  if (!definition || definition.mode !== "read" || definition.riskClass !== "A") {
    throw new Error("The requested Gateway capability is not an enabled read capability.");
  }
  if (request.capability === "get_my_weddings") {
    const weddings = await listAuthorizedWeddings(db, request);
    return {
      ...baseResult(request), data: { intent: "list", weddings },
      userSummary: weddings.length ? `You can access ${weddings.length} wedding workspace${weddings.length === 1 ? "" : "s"}.` : "No active wedding workspace is linked to this account.",
      warnings: [], nextActions: weddings.map((wedding) => ({ label: wedding.name, path: "/dashboard" })),
    };
  }
  if (request.capability === "get_planner_portfolio_briefing") {
    return getPlannerPortfolioBriefing(db, request, now);
  }
  if (request.capability === "get_vendor_business_briefing") {
    return getVendorBusinessBriefing(db, request, now);
  }
  if (request.capability === "get_vendor_candidates") {
    return getSavedVendorCandidates(db, request);
  }
  if (request.capability === "get_formal_quote_summary") {
    return getFormalQuoteBriefing(db, request);
  }
  if (request.capability === "get_negotiation_brief") {
    return getNegotiationBriefing(db, request);
  }
  if (request.capability === "get_negotiation_state") {
    return getNegotiationState(db, request);
  }
  if (request.capability === "get_agreement_review") {
    return getAgreementReview(db, request);
  }
  if (request.capability === "search_zania_vendors") {
    const vendorSearch = await searchZaniaVendors(
      db,
      request.actor,
      request.arguments as VendorSearchArguments,
    );
    const summary = vendorSearch.matches.length
      ? [
        `I found ${vendorSearch.matches.length} ${vendorSearch.intent.category} option${vendorSearch.matches.length === 1 ? "" : "s"} in Zania's directory:`,
        ...vendorSearch.matches.map((match, index) => {
          const price = match.minimumBudgetKes != null && match.maximumBudgetKes != null
            ? `${currency(match.minimumBudgetKes)}–${currency(match.maximumBudgetKes)}`
            : "price not published";
          const trust = [match.isVerified ? "Zania verified" : null, match.profileStatus].filter(Boolean).join(" · ");
          const unknown = match.unknowns.length ? ` Still confirm: ${match.unknowns.join("; ")}.` : "";
          return `${index + 1}. ${match.businessName} — ${match.location ?? "location not published"} · ${price} · ${trust}. Why it fits: ${match.matchReasons.join("; ")}.${unknown}`;
        }),
        "These are directory matches, not availability or quote confirmations.",
      ].join("\n\n")
      : `I could not find an approved ${vendorSearch.intent.category} listing in Zania's directory that matches those details yet.`;
    return {
      ...baseResult(request), data: { intent: "domain_read", vendorSearch }, userSummary: summary,
      warnings: ["This search covers approved Zania listings only; availability and current quotes are not confirmed."],
      nextActions: [{ label: "Open vendors", path: "/vendors" }],
    };
  }
  if (request.capability === "discover_vendors") {
    const internal = await searchZaniaVendors(db, request.actor, request.arguments as VendorSearchArguments);
    const remaining = Math.max(0, Math.min(5, internal.intent.limit ?? 5) - internal.matches.length);
    const external = remaining > 0 && options.externalVendorSearch
      ? await options.externalVendorSearch({ ...internal.intent, limit: remaining })
      : null;
    const internalNames = new Set(internal.matches.map((match) => match.businessName.trim().toLowerCase()));
    const externalMatches = (external?.matches ?? [])
      .filter((match) => !internalNames.has(match.businessName.trim().toLowerCase()))
      .slice(0, remaining);
    const sections: string[] = [];
    if (internal.matches.length) {
      sections.push("Zania directory:\n" + internal.matches.map((match, index) => {
        const price = match.minimumBudgetKes != null && match.maximumBudgetKes != null
          ? `${currency(match.minimumBudgetKes)}–${currency(match.maximumBudgetKes)}`
          : "price not published";
        return `${index + 1}. ${match.businessName} — ${match.location ?? "location not published"} · ${price}. Why it fits: ${match.matchReasons.join("; ")}.`;
      }).join("\n"));
    }
    if (externalMatches.length) {
      sections.push("Public web:\n" + externalMatches.map((match, index) => {
        const sources = match.sources.map((source) => `[${source.title ?? new URL(source.url).hostname}](${source.url})`).join(", ");
        const unknowns = match.unknowns.length ? ` Still confirm: ${match.unknowns.join("; ")}.` : "";
        return `${index + 1}. ${match.businessName} — ${match.location ?? "location not confirmed"}. Why it may fit: ${match.matchReasons.join("; ") || match.summary}. Sources: ${sources}.${unknowns}`;
      }).join("\n"));
    }
    const total = internal.matches.length + externalMatches.length;
    const summary = total
      ? `I found ${total} option${total === 1 ? "" : "s"}.\n\n${sections.join("\n\n")}\n\nThese are discovery matches, not availability, price, verification or quote confirmations.`
      : options.externalVendorSearch
        ? `I could not find a source-backed ${internal.intent.category} option matching those details in Zania or the public web.`
        : `I could not find an approved ${internal.intent.category} listing in Zania's directory. Public-web discovery is not enabled for this request.`;
    return {
      ...baseResult(request),
      data: {
        intent: "domain_read",
        vendorDiscovery: {
          internal,
          external: external ? { ...external, matches: externalMatches } : null,
          sourceCoverage: external ? "internal_plus_external" : "internal_only",
        },
      },
      userSummary: summary,
      warnings: ["Confirm current availability, pricing and service details directly with each vendor."],
      nextActions: [{ label: "Open vendors", path: "/vendors" }],
    };
  }

  const actor = { userId: request.actor.userId, role: request.actor.role, plannerType: request.actor.plannerType };
  const selectedClientId = request.resourceScope.selectedClientId;
  const intent: BriefingIntent = request.capability === "get_weekly_focus" ? "week" : "summary";
  const state = await getWeddingBriefing(db, actor, selectedClientId, now);
  const shared = {
    ...baseResult(request), warnings: sourceWarnings(state),
    nextActions: Object.entries(state.links).map(([label, path]) => ({ label, path })),
  };

  switch (request.capability) {
    case "get_wedding_summary":
    case "get_weekly_focus":
      return { ...shared, data: { intent, wedding: state.wedding, weddingState: state }, userSummary: renderWeddingBriefing(state, intent) };
    case "get_tasks":
      return {
        ...shared, data: { intent: "domain_read", wedding: state.wedding, tasks: state.tasks, taskItems: state.taskItems },
        userSummary: state.tasks ? `${state.tasks.completed} of ${state.tasks.total} tasks are complete. ${state.tasks.overdue} are overdue, ${state.tasks.upcoming} are due in the next seven days, and ${state.tasks.undated} open tasks have no date.` : "Complete task records are currently unavailable.",
      };
    case "get_budget_summary":
      return {
        ...shared, data: { intent: "domain_read", wedding: state.wedding, budget: state.budget, payments: state.payments },
        userSummary: state.budget ? `${currency(state.budget.allocated)} is allocated and ${currency(state.budget.recordedSpent)} is recorded as spent. ${state.payments ? `${currency(state.payments.recorded)} appears in payment entries visible to you.` : "Payment entries are unavailable."}` : "Complete wedding budget records are currently unavailable.",
      };
    case "get_upcoming_payments":
      return {
        ...shared, data: { intent: "domain_read", wedding: state.wedding, upcomingPayments: state.upcomingPayments },
        userSummary: state.upcomingPayments.length ? `${state.upcomingPayments.length} dated selected-vendor balance${state.upcomingPayments.length === 1 ? " needs" : "s need"} review.` : "No dated selected-vendor balances were found in the records available to you.",
      };
    case "get_guest_summary":
      return {
        ...shared, data: { intent: "domain_read", wedding: state.wedding, guests: state.guests },
        userSummary: state.guests ? `${state.guests.total} guest records: ${state.guests.confirmed} confirmed and ${state.guests.pending} awaiting RSVP.` : "Complete guest records are currently unavailable.",
      };
    case "get_vendor_summary": {
      const responseSource = await getVendorResponseBriefing(db, state.wedding.id);
      const latest = responseSource.value?.responses[0];
      const responseSummary = latest
        ? latest.response === "available"
          ? `${latest.vendorName} replied available${latest.quoteAmount == null ? "" : ` with an indicative ${latest.quoteCurrency ?? "KES"} ${latest.quoteAmount.toLocaleString("en-KE")}`}.`
          : latest.response === "unavailable"
          ? `${latest.vendorName} replied unavailable.`
          : `${latest.vendorName} asked for more details.`
        : responseSource.value?.awaiting
        ? `${responseSource.value.awaiting} sent enquir${responseSource.value.awaiting === 1 ? "y is" : "ies are"} awaiting a response.`
        : "No delivered vendor enquiry responses are recorded yet.";
      return {
        ...shared, data: { intent: "domain_read", wedding: state.wedding, vendors: state.vendors, vendorResponses: responseSource.value },
        userSummary: state.vendors ? `${state.vendors.total} vendors are tracked; ${state.vendors.selected} are selected and ${state.vendors.unconfirmed} selected vendors are not marked confirmed. ${responseSummary}` : "Complete vendor records are currently unavailable.",
        warnings: responseSource.status === "ready" ? shared.warnings : [...shared.warnings, "Complete vendor enquiry responses were unavailable."],
      };
    }
    case "get_timeline_summary": {
      const timelineSource = await readBriefingRows<TimelineRow>(db, "timelines", "id,title,timeline_date,is_template", state.wedding.id);
      const timelines = timelineSource.status === "ready" ? timelineSource.rows.filter((timeline) => !timeline.is_template) : null;
      const upcoming = (timelines ?? []).filter((timeline) => timeline.timeline_date && timeline.timeline_date >= state.today)
        .sort((a, b) => String(a.timeline_date).localeCompare(String(b.timeline_date))).slice(0, 5)
        .map((timeline) => ({ id: timeline.id, title: timeline.title, timelineDate: timeline.timeline_date }));
      return {
        ...shared,
        data: { intent: "domain_read", wedding: state.wedding, timelines: timelines ? { total: timelines.length, upcoming } : null },
        userSummary: timelines ? `${timelines.length} wedding timeline${timelines.length === 1 ? " is" : "s are"} available; ${upcoming.length} upcoming timeline${upcoming.length === 1 ? " is" : "s are"} dated.` : "Complete timeline records are currently unavailable.",
        warnings: timelineSource.status === "ready" ? shared.warnings : [...shared.warnings, "Complete timeline records were unavailable."],
        nextActions: [{ label: "timeline", path: "/timeline" }],
      };
    }
  }
}
