import {
  resolveBriefingWedding,
  WeddingBriefingError,
  type BriefingDatabase,
} from "./weddingBriefing.ts";
import type { VendorEnquiryDelivery } from "./vendorEnquiryDelivery.ts";

export type GatewayWriteActor = {
  userId: string;
  role: string;
  plannerType: string | null;
};

export type CreateTaskArguments = {
  title: string;
  dueDate: string | null;
  description: string | null;
  category: string | null;
  assignedTo: string | null;
  priorityLevel: number | null;
  visibility: "public" | "private";
};

export type CreateTaskPreview = {
  ok: true;
  capability: "create_task";
  confirmationRequired: true;
  confirmationId: string;
  idempotencyKey: string;
  expiresAt: string;
  wedding: { id: string; name: string; weddingDate: string | null };
  interpretedTask: CreateTaskArguments;
  userSummary: string;
};

export type CreateTaskReceipt = {
  ok: true;
  capability: "create_task";
  confirmationStatus: "confirmed";
  task: {
    id: string;
    title: string;
    dueDate: string | null;
    description: string | null;
    category: string | null;
    assignedTo: string | null;
    priorityLevel: number | null;
    visibility: "public" | "private";
    weddingId: string;
  };
  receipt: {
    idempotencyKey: string;
    createdVia: "intelligence_gateway";
    path: "/tasks";
  };
  userSummary: string;
};

export type RevokeCreateTaskReceipt = {
  ok: true;
  capability: "create_task" | "update_task" | "add_guest" | "record_expense" | "create_vendor_follow_up_reminder" | "record_payment" | "save_vendor_candidate" | "assign_vendor_candidate" | "promote_vendor_candidate" | "send_vendor_enquiry" | "apply_vendor_response" | "request_formal_vendor_quote" | "request_formal_quote_changes" | "save_negotiation_plan";
  confirmationStatus: "revoked" | "expired";
  confirmationId: string;
  idempotencyKey: string;
  userSummary: string;
};

export type RequestFormalVendorQuoteArguments = {
  vendorId: string;
  vendorName: string;
  vendorListingId: string;
  weddingId: string;
  weddingName: string;
  clientId: string | null;
  enquiryId: string | null;
  message: string;
};

export type RequestFormalVendorQuotePreview = {
  ok: true;
  capability: "request_formal_vendor_quote";
  confirmationRequired: true;
  confirmationId: string;
  idempotencyKey: string;
  expiresAt: string;
  wedding: { id: string; name: string; weddingDate: string | null };
  interpretedRequest: RequestFormalVendorQuoteArguments;
  outcome: "request_after_confirmation" | "approval_requested";
  userSummary: string;
};

export type RequestFormalVendorQuoteReceipt = {
  ok: true;
  capability: "request_formal_vendor_quote";
  confirmationStatus: "confirmed";
  outcome: "requested" | "approval_requested";
  quoteRequest: RequestFormalVendorQuoteArguments & {
    id: string;
    status: "new" | "pending_approval";
  };
  approvalRequestId: string | null;
  receipt: { idempotencyKey: string; createdVia: "intelligence_gateway"; path: "/received-documents" };
  userSummary: string;
};

export type RequestFormalQuoteChangesArguments = {
  quoteRequestId: string;
  quoteDocumentId: string;
  documentNumber: string;
  vendorName: string;
  message: string;
};

export type RequestFormalQuoteChangesPreview = {
  ok: true;
  capability: "request_formal_quote_changes";
  confirmationRequired: true;
  confirmationId: string;
  idempotencyKey: string;
  expiresAt: string;
  wedding: { id: string; name: string; weddingDate: string | null };
  interpretedRequest: RequestFormalQuoteChangesArguments;
  outcome: "request_after_confirmation" | "approval_requested";
  userSummary: string;
};

export type RequestFormalQuoteChangesReceipt = {
  ok: true;
  capability: "request_formal_quote_changes";
  confirmationStatus: "confirmed";
  outcome: "changes_requested" | "approval_requested";
  quoteResponse: RequestFormalQuoteChangesArguments & { id: string; status: "changes_requested" | "pending_approval" };
  approvalRequestId: string | null;
  receipt: { idempotencyKey: string; createdVia: "intelligence_gateway"; path: "/received-documents" };
  userSummary: string;
};

export type SaveNegotiationPlanArguments = {
  quoteRequestId: string;
  quoteDocumentId: string;
  documentNumber: string;
  vendorName: string;
  quotedTotalKes: number;
  targetBudgetKes: number;
  absoluteCeilingKes: number | null;
  mustHave: string[];
  willingToTrade: string[];
  tone: "gentle" | "commercial" | "planner";
  draftMessage: string;
  proposedTotalKes: number | null;
};

export type SaveNegotiationPlanPreview = {
  ok: true;
  capability: "save_negotiation_plan";
  confirmationRequired: true;
  confirmationId: string;
  idempotencyKey: string;
  expiresAt: string;
  wedding: { id: string; name: string; weddingDate: string | null };
  interpretedPlan: SaveNegotiationPlanArguments;
  userSummary: string;
};

export type SaveNegotiationPlanReceipt = {
  ok: true;
  capability: "save_negotiation_plan";
  confirmationStatus: "confirmed";
  profileId: string;
  proposal: { id: string; roundNumber: number; status: "draft"; contactStatus: "not_contacted" };
  receipt: { idempotencyKey: string; createdVia: "intelligence_gateway"; path: "/received-documents" };
  userSummary: string;
};

export type ApplyVendorResponseAction = "record_indicative_price" | "mark_unavailable";

export type ApplyVendorResponsePreview = {
  ok: true;
  capability: "apply_vendor_response";
  confirmationRequired: true;
  confirmationId: string;
  idempotencyKey: string;
  expiresAt: string;
  wedding: { id: string; name: string; weddingDate: string | null };
  outcome: "updated" | "approval_requested";
  response: {
    enquiryId: string;
    responseId: string;
    vendorId: string;
    vendorName: string;
    action: ApplyVendorResponseAction;
    indicativeAmount: number | null;
    currentPrice: number | null;
    currentStatus: string | null;
    currentSelectionStatus: string | null;
  };
  userSummary: string;
};

export type ApplyVendorResponseReceipt = {
  ok: true;
  capability: "apply_vendor_response";
  confirmationStatus: "confirmed";
  outcome: "updated" | "approval_requested";
  vendor: {
    id: string;
    name: string;
    price: number | null;
    status: string | null;
    selectionStatus: string | null;
  };
  approvalRequestId: string | null;
  receipt: { idempotencyKey: string; createdVia: "intelligence_gateway"; path: "/vendors" };
  userSummary: string;
};

export type SaveVendorCandidateArguments = {
  businessName: string;
  category: string;
  location: string | null;
  website: string | null;
  vendorListingId: string | null;
  sourceKind: "zania_listing" | "official_website" | "search_result" | "directory" | "social";
  sourceRecordId: string;
  sourceUrl: string | null;
  profileStatus: "discovered" | "unclaimed" | "claimed" | "verified";
  snapshot: {
    summary: string;
    matchReasons: string[];
    unknowns: string[];
    sources: Array<{ url: string; title: string | null }>;
  };
};

export type SaveVendorCandidatePreview = {
  ok: true;
  capability: "save_vendor_candidate";
  confirmationRequired: true;
  confirmationId: string;
  idempotencyKey: string;
  expiresAt: string;
  wedding: { id: string; name: string; weddingDate: string | null } | null;
  plannerClientId: string | null;
  interpretedCandidate: SaveVendorCandidateArguments;
  userSummary: string;
};

export type SaveVendorCandidateReceipt = {
  ok: true;
  capability: "save_vendor_candidate";
  confirmationStatus: "confirmed";
  candidate: SaveVendorCandidateArguments & {
    id: string;
    weddingId: string | null;
    plannerClientId: string | null;
    candidateStatus: "saved";
  };
  receipt: {
    idempotencyKey: string;
    createdVia: "intelligence_gateway";
    path: "/vendor-candidates";
  };
  userSummary: string;
};

export type AssignVendorCandidateArguments = {
  candidateId: string;
  candidateName: string;
  clientId: string;
  clientName: string;
};

export type AssignVendorCandidatePreview = {
  ok: true;
  capability: "assign_vendor_candidate";
  confirmationRequired: true;
  confirmationId: string;
  idempotencyKey: string;
  expiresAt: string;
  wedding: null;
  interpretedAssignment: AssignVendorCandidateArguments;
  userSummary: string;
};

export type AssignVendorCandidateReceipt = {
  ok: true;
  capability: "assign_vendor_candidate";
  confirmationStatus: "confirmed";
  assignment: AssignVendorCandidateArguments;
  receipt: {
    idempotencyKey: string;
    createdVia: "intelligence_gateway";
    path: "/vendor-candidates";
  };
  userSummary: string;
};

export type PromoteVendorCandidateArguments = {
  candidateId: string;
  candidateName: string;
  category: string;
  quoteAmount: number | null;
  selectionStatus: "shortlisted" | "backup";
  clientId: string | null;
  weddingId: string;
  weddingName: string;
  vendorListingId: string | null;
};

export type PromoteVendorCandidatePreview = {
  ok: true;
  capability: "promote_vendor_candidate";
  confirmationRequired: true;
  confirmationId: string;
  idempotencyKey: string;
  expiresAt: string;
  wedding: { id: string; name: string; weddingDate: string | null };
  interpretedPromotion: PromoteVendorCandidateArguments;
  outcome: "created" | "approval_requested";
  userSummary: string;
};

export type PromoteVendorCandidateReceipt = {
  ok: true;
  capability: "promote_vendor_candidate";
  confirmationStatus: "confirmed";
  outcome: "created" | "approval_requested";
  vendor: PromoteVendorCandidateArguments & { id: string; status: "tracker_added" | "approval_pending" };
  receipt: {
    idempotencyKey: string;
    createdVia: "intelligence_gateway";
    path: "/vendors";
  };
  userSummary: string;
};

export type SendVendorEnquiryArguments = {
  vendorId: string;
  vendorName: string;
  vendorListingId: string | null;
  weddingId: string;
  weddingName: string;
  clientId: string | null;
  recipientName: string;
  recipientEmail: string;
  recipientSource: "tracker" | "zania_listing" | "explicit";
  senderName: string;
  subject: string;
  message: string;
};

export type SendVendorEnquiryPreview = {
  ok: true;
  capability: "send_vendor_enquiry";
  confirmationRequired: true;
  confirmationId: string;
  idempotencyKey: string;
  expiresAt: string;
  wedding: { id: string; name: string; weddingDate: string | null };
  interpretedEnquiry: SendVendorEnquiryArguments;
  outcome: "send_after_confirmation" | "approval_requested";
  userSummary: string;
};

export type SendVendorEnquiryReceipt = {
  ok: true;
  capability: "send_vendor_enquiry";
  confirmationStatus: "confirmed";
  outcome: "sent" | "failed" | "approval_requested";
  deliveryStatus: "sent" | "failed" | "pending_approval";
  enquiry: SendVendorEnquiryArguments & {
    id: string;
    provider: "resend" | null;
    providerMessageId: string | null;
    sentAt: string | null;
  };
  receipt: {
    idempotencyKey: string;
    createdVia: "intelligence_gateway";
    path: "/vendors";
  };
  userSummary: string;
};

export type UpdateTaskChanges = Partial<CreateTaskArguments> & {
  completed?: boolean;
};

export type UpdateTaskPreview = {
  ok: true;
  capability: "update_task";
  confirmationRequired: true;
  confirmationId: string;
  idempotencyKey: string;
  expiresAt: string;
  wedding: { id: string; name: string; weddingDate: string | null };
  task: { id: string; title: string };
  changes: UpdateTaskChanges;
  userSummary: string;
};

export type UpdateTaskReceipt = {
  ok: true;
  capability: "update_task";
  confirmationStatus: "confirmed";
  task: CreateTaskReceipt["task"] & { completed: boolean };
  receipt: CreateTaskReceipt["receipt"];
  userSummary: string;
};

export type AddGuestArguments = {
  name: string;
  email: string | null;
  phone: string | null;
  rsvpStatus: "pending" | "confirmed" | "declined";
  mealPreference: string | null;
  plusOne: boolean;
  tableNumber: number | null;
  groupName: string | null;
  category: "general" | "vip" | "family" | "friends" | "kids" | "vendor";
};

export type AddGuestPreview = {
  ok: true;
  capability: "add_guest";
  confirmationRequired: true;
  confirmationId: string;
  idempotencyKey: string;
  expiresAt: string;
  wedding: { id: string; name: string; weddingDate: string | null };
  interpretedGuest: AddGuestArguments;
  outcome: "created" | "approval_requested";
  userSummary: string;
};

export type AddGuestReceipt = {
  ok: true;
  capability: "add_guest";
  confirmationStatus: "confirmed";
  outcome: "created" | "approval_requested";
  guest: AddGuestArguments & { id: string | null; weddingId: string };
  approvalRequestId: string | null;
  receipt: {
    idempotencyKey: string;
    createdVia: "intelligence_gateway";
    path: "/guests";
  };
  userSummary: string;
};

export type RecordExpenseArguments = {
  categoryName: string;
  payeeName: string;
  amount: number;
  expenseDate: string;
  notes: string | null;
};

export type RecordExpensePreview = {
  ok: true;
  capability: "record_expense";
  confirmationRequired: true;
  confirmationId: string;
  idempotencyKey: string;
  expiresAt: string;
  wedding: { id: string; name: string; weddingDate: string | null };
  category: { id: string; name: string; currentSpent: number };
  interpretedExpense: RecordExpenseArguments;
  outcome: "recorded" | "approval_requested";
  userSummary: string;
};

export type RecordExpenseReceipt = {
  ok: true;
  capability: "record_expense";
  confirmationStatus: "confirmed";
  outcome: "recorded" | "approval_requested";
  expense: RecordExpenseArguments & { id: string | null; categoryId: string; weddingId: string };
  approvalRequestId: string | null;
  receipt: {
    idempotencyKey: string;
    createdVia: "intelligence_gateway";
    path: "/budget";
  };
  userSummary: string;
};

export type RecordPaymentArguments = {
  categoryName: string;
  amount: number;
  payeeName: string;
  vendorName: string | null;
  paymentDate: string;
  reference: string | null;
  notes: string | null;
};

export type RecordPaymentPreview = {
  ok: true;
  capability: "record_payment";
  confirmationRequired: true;
  confirmationId: string;
  idempotencyKey: string;
  expiresAt: string;
  wedding: { id: string; name: string; weddingDate: string | null };
  category: { id: string; name: string; currentSpent: number; nextSpent: number };
  vendor: null | {
    id: string;
    name: string;
    currentPaid: number;
    nextPaid: number;
    nextStatus: string;
  };
  interpretedPayment: RecordPaymentArguments;
  outcome: "recorded" | "approval_requested";
  userSummary: string;
};

export type RecordPaymentReceipt = {
  ok: true;
  capability: "record_payment";
  confirmationStatus: "confirmed";
  outcome: "recorded" | "approval_requested";
  payment: RecordPaymentArguments & {
    id: string | null;
    weddingId: string;
    categoryId: string;
    vendorId: string | null;
  };
  approvalRequestId: string | null;
  vendor: null | { id: string; name: string; totalPaid: number; paymentStatus: string };
  receipt: {
    idempotencyKey: string;
    createdVia: "intelligence_gateway";
    path: "/budget";
  };
  userSummary: string;
};

export type CreateVendorFollowUpArguments = {
  coupleName: string;
  title: string;
  dueDate: string | null;
  notes: string | null;
};

export type CreateVendorFollowUpPreview = {
  ok: true;
  capability: "create_vendor_follow_up_reminder";
  confirmationRequired: true;
  confirmationId: string;
  idempotencyKey: string;
  expiresAt: string;
  wedding: { id: string; name: string; weddingDate: string | null };
  vendorListing: { id: string; businessName: string };
  booking: { id: string; coupleName: string; category: string | null };
  interpretedReminder: CreateVendorFollowUpArguments;
  userSummary: string;
};

export type CreateVendorFollowUpReceipt = {
  ok: true;
  capability: "create_vendor_follow_up_reminder";
  confirmationStatus: "confirmed";
  reminder: CreateVendorFollowUpArguments & {
    id: string;
    vendorId: string;
    vendorListingId: string;
    status: "open";
  };
  receipt: {
    idempotencyKey: string;
    createdVia: "intelligence_gateway";
    path: "/vendor-dashboard";
  };
  userSummary: string;
};

type MutationResult = { data: Record<string, unknown> | null; error: { message?: string; code?: string } | null };
type WriteQuery = {
  select(columns?: string): WriteQuery;
  eq(field: string, value: unknown): WriteQuery;
  maybeSingle(): PromiseLike<MutationResult>;
  single(): PromiseLike<MutationResult>;
};

export interface GatewayWriteDatabase extends BriefingDatabase {
  from(table: string): ReturnType<BriefingDatabase["from"]> & {
    insert(values: Record<string, unknown>): WriteQuery;
    upsert(values: Record<string, unknown>, options: { onConflict: string }): WriteQuery;
    update(values: Record<string, unknown>): WriteQuery;
  };
  rpc(
    functionName: string,
    arguments_: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GUEST_CATEGORIES = new Set(["general", "vip", "family", "friends", "kids", "vendor"]);

function cleanOptional(value: unknown, max: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new WeddingBriefingError("Task details must be text.", 400);
  const cleaned = value.trim().replace(/[\r\n\t]+/g, " ");
  if (!cleaned) return null;
  if (cleaned.length > max) throw new WeddingBriefingError(`Task details must be ${max} characters or fewer.`, 400);
  return cleaned;
}

export function normalizeCreateTaskArguments(input: Record<string, unknown>): CreateTaskArguments {
  const title = cleanOptional(input.title, 160);
  if (!title) throw new WeddingBriefingError("Add a task title before continuing.", 400);

  const dueDate = cleanOptional(input.dueDate ?? input.due_date, 10);
  if (dueDate) {
    const parsed = new Date(`${dueDate}T00:00:00Z`);
    if (!DATE.test(dueDate) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dueDate) {
      throw new WeddingBriefingError("Use a valid due date in YYYY-MM-DD format.", 400);
    }
  }

  const priorityValue = input.priorityLevel ?? input.priority_level;
  const priorityLevel = priorityValue === undefined || priorityValue === null
    ? null
    : Number(priorityValue);
  if (priorityLevel !== null && (!Number.isInteger(priorityLevel) || priorityLevel < 1 || priorityLevel > 5)) {
    throw new WeddingBriefingError("Task priority must be a whole number from 1 to 5.", 400);
  }

  const visibility = input.visibility ?? "public";
  if (visibility !== "public" && visibility !== "private") {
    throw new WeddingBriefingError("Task visibility must be public or private.", 400);
  }

  return {
    title,
    dueDate,
    description: cleanOptional(input.description, 2000),
    category: cleanOptional(input.category, 80),
    assignedTo: cleanOptional(input.assignedTo ?? input.assigned_to, 120),
    priorityLevel,
    visibility,
  };
}

function cleanGuestText(value: unknown, label: string, max: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new WeddingBriefingError(`${label} must be text.`, 400);
  const cleaned = value.trim().replace(/[\r\n\t]+/g, " ");
  if (!cleaned) return null;
  if (cleaned.length > max) throw new WeddingBriefingError(`${label} must be ${max} characters or fewer.`, 400);
  return cleaned;
}

export function normalizeAddGuestArguments(input: Record<string, unknown>): AddGuestArguments {
  const name = cleanGuestText(input.name, "Guest name", 160);
  if (!name) throw new WeddingBriefingError("Add the guest's name before continuing.", 400);
  const email = cleanGuestText(input.email, "Guest email", 254)?.toLowerCase() ?? null;
  if (email && !EMAIL.test(email)) throw new WeddingBriefingError("Use a valid guest email address.", 400);
  const phone = cleanGuestText(input.phone, "Guest phone", 40);
  if (phone && phone.length < 7) throw new WeddingBriefingError("Use a valid guest phone number.", 400);
  const rsvpStatus = input.rsvpStatus ?? input.rsvp_status ?? "pending";
  if (rsvpStatus !== "pending" && rsvpStatus !== "confirmed" && rsvpStatus !== "declined") {
    throw new WeddingBriefingError("Guest RSVP status must be pending, confirmed or declined.", 400);
  }
  const plusOne = input.plusOne ?? input.plus_one ?? false;
  if (typeof plusOne !== "boolean") throw new WeddingBriefingError("Guest plus-one access must be true or false.", 400);
  const tableValue = input.tableNumber ?? input.table_number;
  const tableNumber = tableValue === undefined || tableValue === null || tableValue === "" ? null : Number(tableValue);
  if (tableNumber !== null && (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 10000)) {
    throw new WeddingBriefingError("Guest table number must be a whole number from 1 to 10000.", 400);
  }
  const category = String(input.category ?? "general").trim().toLowerCase();
  if (!GUEST_CATEGORIES.has(category)) {
    throw new WeddingBriefingError("Guest category must be general, vip, family, friends, kids or vendor.", 400);
  }
  return {
    name,
    email,
    phone,
    rsvpStatus,
    mealPreference: cleanGuestText(input.mealPreference ?? input.meal_preference, "Meal preference", 200),
    plusOne,
    tableNumber,
    groupName: cleanGuestText(input.groupName ?? input.group_name, "Guest group", 120),
    category: category as AddGuestArguments["category"],
  };
}

function kenyaDate(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function normalizeRecordExpenseArguments(
  input: Record<string, unknown>,
  now = new Date(),
): RecordExpenseArguments {
  const categoryName = cleanGuestText(input.categoryName ?? input.category_name, "Budget category", 120);
  if (!categoryName) throw new WeddingBriefingError("Choose a wedding budget category before continuing.", 400);
  const payeeName = cleanGuestText(input.payeeName ?? input.payee_name, "Expense payee", 160);
  if (!payeeName) throw new WeddingBriefingError("Add the vendor or payee for this expense.", 400);
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    throw new WeddingBriefingError("Expense amount must be greater than zero and no more than KES 1,000,000,000.", 400);
  }
  const roundedAmount = Math.round((amount + 1e-9) * 100) / 100;
  const expenseDate = cleanGuestText(input.expenseDate ?? input.expense_date, "Expense date", 10) ?? kenyaDate(now);
  const parsed = new Date(`${expenseDate}T00:00:00Z`);
  if (!DATE.test(expenseDate) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== expenseDate) {
    throw new WeddingBriefingError("Use a valid expense date in YYYY-MM-DD format.", 400);
  }
  return {
    categoryName,
    payeeName,
    amount: roundedAmount,
    expenseDate,
    notes: cleanGuestText(input.notes, "Expense notes", 1000),
  };
}

function normalizeUpdateTaskChanges(input: Record<string, unknown>): UpdateTaskChanges {
  const changes: UpdateTaskChanges = {};
  if ("title" in input || "newTitle" in input || "new_title" in input) {
    const title = cleanOptional(input.newTitle ?? input.new_title ?? input.title, 160);
    if (!title) throw new WeddingBriefingError("The updated task title cannot be empty.", 400);
    changes.title = title;
  }
  if ("dueDate" in input || "due_date" in input) {
    const dueDate = cleanOptional(input.dueDate ?? input.due_date, 10);
    if (dueDate) {
      const parsed = new Date(`${dueDate}T00:00:00Z`);
      if (!DATE.test(dueDate) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dueDate) {
        throw new WeddingBriefingError("Use a valid due date in YYYY-MM-DD format.", 400);
      }
    }
    changes.dueDate = dueDate;
  }
  if ("description" in input) changes.description = cleanOptional(input.description, 2000);
  if ("category" in input) changes.category = cleanOptional(input.category, 80);
  if ("assignedTo" in input || "assigned_to" in input) {
    changes.assignedTo = cleanOptional(input.assignedTo ?? input.assigned_to, 120);
  }
  if ("priorityLevel" in input || "priority_level" in input) {
    const value = input.priorityLevel ?? input.priority_level;
    if (value === null || value === "") changes.priorityLevel = null;
    else {
      const priority = Number(value);
      if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
        throw new WeddingBriefingError("Task priority must be a whole number from 1 to 5.", 400);
      }
      changes.priorityLevel = priority;
    }
  }
  if ("visibility" in input) {
    if (input.visibility !== "public" && input.visibility !== "private") {
      throw new WeddingBriefingError("Task visibility must be public or private.", 400);
    }
    changes.visibility = input.visibility;
  }
  if ("completed" in input) {
    if (typeof input.completed !== "boolean") {
      throw new WeddingBriefingError("Task completion must be true or false.", 400);
    }
    changes.completed = input.completed;
  }
  if (!Object.keys(changes).length) {
    throw new WeddingBriefingError("Add at least one task change before continuing.", 400);
  }
  return changes;
}

function updateSummary(title: string, changes: UpdateTaskChanges) {
  const parts: string[] = [];
  if ("title" in changes) parts.push(`rename to “${changes.title}”`);
  if ("dueDate" in changes) parts.push(changes.dueDate ? `due ${changes.dueDate}` : "remove the due date");
  if ("description" in changes) parts.push(changes.description ? "change the description" : "clear the description");
  if ("category" in changes) parts.push(changes.category ? `category ${changes.category}` : "clear the category");
  if ("assignedTo" in changes) parts.push(changes.assignedTo ? `assign to ${changes.assignedTo}` : "clear the assignee");
  if ("priorityLevel" in changes) parts.push(changes.priorityLevel ? `priority ${changes.priorityLevel}` : "clear the priority");
  if ("visibility" in changes) parts.push(`${changes.visibility} visibility`);
  if ("completed" in changes) parts.push(changes.completed ? "mark completed" : "mark open");
  return `Update task “${title}”: ${parts.join(", ")}.`;
}

function toUpdatedReceipt(row: Record<string, unknown>, idempotencyKey: string): UpdateTaskReceipt {
  const base = toReceipt(row, idempotencyKey).task;
  return {
    ok: true,
    capability: "update_task",
    confirmationStatus: "confirmed",
    task: { ...base, completed: row.completed === true },
    receipt: { idempotencyKey, createdVia: "intelligence_gateway", path: "/tasks" },
    userSummary: `Updated task “${base.title}”${base.dueDate ? ` due ${base.dueDate}` : ""}.`,
  };
}

export async function previewUpdateTask(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  selectedClientId: string | null,
  input: Record<string, unknown>,
  now = new Date(),
): Promise<UpdateTaskPreview> {
  const taskId = typeof input.taskId === "string" ? input.taskId : typeof input.task_id === "string" ? input.task_id : "";
  const currentTitle = cleanOptional(input.currentTitle ?? input.current_title, 160);
  if (!UUID.test(taskId) && !currentTitle) {
    throw new WeddingBriefingError("Choose the task to update by ID or exact current title.", 400);
  }
  const wedding = await resolveBriefingWedding(db, actor, selectedClientId);
  let query = db.from("tasks").select("id,title,wedding_id").eq("wedding_id", wedding.id);
  query = UUID.test(taskId) ? query.eq("id", taskId) : query.eq("title", currentTitle);
  const { data: task, error: taskError } = await query.maybeSingle();
  if (taskError || !task) throw new WeddingBriefingError("That task was not found in this wedding workspace.", 404);

  const changesInput = input.changes && typeof input.changes === "object"
    ? input.changes as Record<string, unknown>
    : input;
  const changes = normalizeUpdateTaskChanges(changesInput);
  const confirmationId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const storedArguments = { taskId: String(task.id), originalTitle: String(task.title), changes };
  const { error } = await db.from("intelligence_gateway_confirmations").insert({
    id: confirmationId,
    user_id: actor.userId,
    wedding_id: wedding.id,
    selected_client_id: selectedClientId,
    capability: "update_task",
    arguments: storedArguments,
    idempotency_key: idempotencyKey,
    status: "pending",
    expires_at: expiresAt,
  }).select("id").single();
  if (error) throw new WeddingBriefingError("Could not prepare the task update for confirmation. Please try again.", 503);

  return {
    ok: true,
    capability: "update_task",
    confirmationRequired: true,
    confirmationId,
    idempotencyKey,
    expiresAt,
    wedding: { id: wedding.id, name: wedding.name, weddingDate: wedding.wedding_date },
    task: { id: String(task.id), title: String(task.title) },
    changes,
    userSummary: `${updateSummary(String(task.title), changes)} Confirm this exact update before Zania applies it.`,
  };
}

function taskSummary(task: CreateTaskArguments) {
  return `Create task “${task.title}”${task.dueDate ? ` due ${task.dueDate}` : ""}${task.category ? ` in ${task.category}` : ""}.`;
}

export async function previewCreateTask(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  selectedClientId: string | null,
  input: Record<string, unknown>,
  now = new Date(),
): Promise<CreateTaskPreview> {
  const task = normalizeCreateTaskArguments(input);
  const wedding = await resolveBriefingWedding(db, actor, selectedClientId);
  const confirmationId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const { error } = await db.from("intelligence_gateway_confirmations").insert({
    id: confirmationId,
    user_id: actor.userId,
    wedding_id: wedding.id,
    selected_client_id: selectedClientId,
    capability: "create_task",
    arguments: task,
    idempotency_key: idempotencyKey,
    status: "pending",
    expires_at: expiresAt,
  }).select("id").single();
  if (error) throw new WeddingBriefingError("Could not prepare the task for confirmation. Please try again.", 503);

  return {
    ok: true,
    capability: "create_task",
    confirmationRequired: true,
    confirmationId,
    idempotencyKey,
    expiresAt,
    wedding: { id: wedding.id, name: wedding.name, weddingDate: wedding.wedding_date },
    interpretedTask: task,
    userSummary: `${taskSummary(task)} Confirm this exact task before Zania creates it.`,
  };
}

function toReceipt(row: Record<string, unknown>, idempotencyKey: string): CreateTaskReceipt {
  const task = {
    id: String(row.id),
    title: String(row.title),
    dueDate: typeof row.due_date === "string" ? row.due_date : null,
    description: typeof row.description === "string" ? row.description : null,
    category: typeof row.category === "string" ? row.category : null,
    assignedTo: typeof row.assigned_to === "string" ? row.assigned_to : null,
    priorityLevel: typeof row.priority_level === "number" ? row.priority_level : null,
    visibility: row.visibility === "private" ? "private" as const : "public" as const,
    weddingId: String(row.wedding_id),
  };
  return {
    ok: true,
    capability: "create_task",
    confirmationStatus: "confirmed",
    task,
    receipt: { idempotencyKey, createdVia: "intelligence_gateway", path: "/tasks" },
    userSummary: `Created task “${task.title}”${task.dueDate ? ` due ${task.dueDate}` : ""}.`,
  };
}

export async function executeConfirmedCreateTask(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<CreateTaskReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) {
    throw new WeddingBriefingError("The task confirmation is invalid. Preview the task again.", 400);
  }

  const { data: confirmation, error: confirmationError } = await db.from("intelligence_gateway_confirmations")
    .select("id,wedding_id,selected_client_id,arguments,idempotency_key,status,expires_at,result_entity_id")
    .eq("id", confirmationId).eq("user_id", actor.userId).eq("capability", "create_task").maybeSingle();
  if (confirmationError || !confirmation) {
    throw new WeddingBriefingError("This task confirmation was not found. Preview the task again.", 404);
  }
  if (String(confirmation.idempotency_key) !== idempotencyKey) {
    throw new WeddingBriefingError("The task confirmation does not match this request.", 409);
  }

  if (confirmation.status === "executed" && confirmation.result_entity_id) {
    const { data: existing, error } = await db.from("tasks").select("id,title,due_date,description,category,assigned_to,priority_level,visibility,wedding_id")
      .eq("id", confirmation.result_entity_id).eq("gateway_idempotency_key", idempotencyKey).maybeSingle();
    if (error || !existing) throw new WeddingBriefingError("The task receipt could not be restored.", 503);
    return toReceipt(existing, idempotencyKey);
  }
  if (confirmation.status !== "pending") {
    throw new WeddingBriefingError("This task confirmation is no longer available. Preview the task again.", 409);
  }
  if (typeof confirmation.expires_at !== "string" || new Date(confirmation.expires_at).getTime() <= now.getTime()) {
    await db.from("intelligence_gateway_confirmations").update({ status: "expired" })
      .eq("id", confirmationId).eq("user_id", actor.userId).select("id").maybeSingle();
    throw new WeddingBriefingError("This task confirmation expired. Preview the task again.", 409);
  }

  const selectedClientId = typeof confirmation.selected_client_id === "string" ? confirmation.selected_client_id : null;
  const wedding = await resolveBriefingWedding(db, actor, selectedClientId);
  if (wedding.id !== confirmation.wedding_id) {
    throw new WeddingBriefingError("Wedding access changed after this task was previewed. Preview it again.", 409);
  }
  const task = normalizeCreateTaskArguments(confirmation.arguments as Record<string, unknown>);
  const values: Record<string, unknown> = {
    user_id: actor.userId,
    wedding_id: wedding.id,
    client_id: selectedClientId,
    title: task.title,
    due_date: task.dueDate,
    description: task.description,
    category: task.category,
    assigned_to: task.assignedTo,
    priority_level: task.priorityLevel,
    visibility: task.visibility,
    completed: false,
    gateway_idempotency_key: idempotencyKey,
    created_via: "intelligence_gateway",
  };
  const { data: created, error: createError } = await db.from("tasks")
    .upsert(values, { onConflict: "gateway_idempotency_key" })
    .select("id,title,due_date,description,category,assigned_to,priority_level,visibility,wedding_id")
    .single();
  if (createError || !created) throw new WeddingBriefingError("Could not create the task. No change was made.", 503);

  const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
    status: "executed",
    executed_at: now.toISOString(),
    result_entity_id: created.id,
  }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
  if (receiptError) throw new WeddingBriefingError("The task was created, but its receipt could not be finalized. Retry with the same confirmation.", 503);

  return toReceipt(created, idempotencyKey);
}

export async function executeConfirmedUpdateTask(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<UpdateTaskReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) {
    throw new WeddingBriefingError("The task update confirmation is invalid. Preview the update again.", 400);
  }
  const { data: confirmation, error: confirmationError } = await db.from("intelligence_gateway_confirmations")
    .select("id,wedding_id,selected_client_id,arguments,idempotency_key,status,expires_at,result_entity_id")
    .eq("id", confirmationId).eq("user_id", actor.userId).eq("capability", "update_task").maybeSingle();
  if (confirmationError || !confirmation) {
    throw new WeddingBriefingError("This task update confirmation was not found. Preview the update again.", 404);
  }
  if (String(confirmation.idempotency_key) !== idempotencyKey) {
    throw new WeddingBriefingError("The task update confirmation does not match this request.", 409);
  }
  if (confirmation.status === "executed" && confirmation.result_entity_id) {
    const { data: existing, error } = await db.from("tasks")
      .select("id,title,due_date,description,category,assigned_to,priority_level,visibility,wedding_id,completed")
      .eq("id", confirmation.result_entity_id).maybeSingle();
    if (error || !existing) throw new WeddingBriefingError("The task update receipt could not be restored.", 503);
    return toUpdatedReceipt(existing, idempotencyKey);
  }
  if (confirmation.status !== "pending") {
    throw new WeddingBriefingError("This task update confirmation is no longer available. Preview the update again.", 409);
  }
  if (typeof confirmation.expires_at !== "string" || new Date(confirmation.expires_at).getTime() <= now.getTime()) {
    await db.from("intelligence_gateway_confirmations").update({ status: "expired" })
      .eq("id", confirmationId).eq("user_id", actor.userId).select("id").maybeSingle();
    throw new WeddingBriefingError("This task update confirmation expired. Preview the update again.", 409);
  }

  const selectedClientId = typeof confirmation.selected_client_id === "string" ? confirmation.selected_client_id : null;
  const wedding = await resolveBriefingWedding(db, actor, selectedClientId);
  if (wedding.id !== confirmation.wedding_id) {
    throw new WeddingBriefingError("Wedding access changed after this update was previewed. Preview it again.", 409);
  }
  const stored = confirmation.arguments as Record<string, unknown>;
  const storedTaskId = typeof stored.taskId === "string" ? stored.taskId : "";
  if (!UUID.test(storedTaskId)) throw new WeddingBriefingError("The stored task update is invalid.", 409);
  const changes = normalizeUpdateTaskChanges(
    stored.changes && typeof stored.changes === "object" ? stored.changes as Record<string, unknown> : {},
  );
  const values: Record<string, unknown> = {};
  if ("title" in changes) values.title = changes.title;
  if ("dueDate" in changes) values.due_date = changes.dueDate;
  if ("description" in changes) values.description = changes.description;
  if ("category" in changes) values.category = changes.category;
  if ("assignedTo" in changes) values.assigned_to = changes.assignedTo;
  if ("priorityLevel" in changes) values.priority_level = changes.priorityLevel;
  if ("visibility" in changes) values.visibility = changes.visibility;
  if ("completed" in changes) values.completed = changes.completed;
  const { data: updated, error: updateError } = await db.from("tasks").update(values)
    .eq("id", storedTaskId).eq("wedding_id", wedding.id)
    .select("id,title,due_date,description,category,assigned_to,priority_level,visibility,wedding_id,completed")
    .single();
  if (updateError || !updated) throw new WeddingBriefingError("Could not update the task. No change was made.", 503);

  const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
    status: "executed",
    executed_at: now.toISOString(),
    result_entity_id: updated.id,
  }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
  if (receiptError) throw new WeddingBriefingError("The task was updated, but its receipt could not be finalized. Retry with the same confirmation.", 503);
  return toUpdatedReceipt(updated, idempotencyKey);
}

async function resolvePlannerApprovalDelivery(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  selectedClientId: string | null,
  weddingId: string,
) {
  if (actor.role !== "planner") return { outcome: "created" as const, coupleUserId: null };
  if (!selectedClientId) throw new WeddingBriefingError("Choose a wedding in My Weddings, then ask again.", 400);
  const { data: client, error } = await db.from("planner_clients")
    .select("id,wedding_id,linked_user_id")
    .eq("id", selectedClientId).eq("planner_user_id", actor.userId).eq("is_archived", false).maybeSingle();
  if (error) throw new WeddingBriefingError("Could not check the planner guest workflow. Please try again.", 503);
  if (!client || client.wedding_id !== weddingId) {
    throw new WeddingBriefingError("This client is no longer linked to the selected wedding.", 409);
  }
  return typeof client.linked_user_id === "string"
    ? { outcome: "approval_requested" as const, coupleUserId: client.linked_user_id }
    : { outcome: "created" as const, coupleUserId: null };
}

function guestSummary(guest: AddGuestArguments, outcome: AddGuestPreview["outcome"]) {
  const details = [
    guest.email ? `email ${guest.email}` : null,
    guest.phone ? `phone ${guest.phone}` : null,
    `RSVP ${guest.rsvpStatus}`,
    guest.plusOne ? "plus one allowed" : null,
    guest.groupName ? `group ${guest.groupName}` : null,
    guest.tableNumber ? `table ${guest.tableNumber}` : null,
  ].filter(Boolean).join(", ");
  return outcome === "approval_requested"
    ? `Send a request to add guest “${guest.name}”${details ? ` (${details})` : ""} for the couple's approval.`
    : `Add guest “${guest.name}”${details ? ` (${details})` : ""}.`;
}

function guestValues(guest: AddGuestArguments) {
  return {
    name: guest.name,
    email: guest.email,
    phone: guest.phone,
    rsvp_status: guest.rsvpStatus,
    meal_preference: guest.mealPreference,
    plus_one: guest.plusOne,
    table_number: guest.tableNumber,
    group_name: guest.groupName,
    category: guest.category,
  };
}

function toGuestReceipt(
  row: Record<string, unknown>,
  idempotencyKey: string,
  weddingId: string,
): AddGuestReceipt {
  const guest = normalizeAddGuestArguments(row);
  return {
    ok: true,
    capability: "add_guest",
    confirmationStatus: "confirmed",
    outcome: "created",
    guest: { ...guest, id: String(row.id), weddingId },
    approvalRequestId: null,
    receipt: { idempotencyKey, createdVia: "intelligence_gateway", path: "/guests" },
    userSummary: `Added guest “${guest.name}” with RSVP ${guest.rsvpStatus}.`,
  };
}

function toGuestApprovalReceipt(
  request: Record<string, unknown>,
  guest: AddGuestArguments,
  idempotencyKey: string,
  weddingId: string,
): AddGuestReceipt {
  return {
    ok: true,
    capability: "add_guest",
    confirmationStatus: "confirmed",
    outcome: "approval_requested",
    guest: { ...guest, id: null, weddingId },
    approvalRequestId: String(request.id),
    receipt: { idempotencyKey, createdVia: "intelligence_gateway", path: "/guests" },
    userSummary: `Sent the request to add guest “${guest.name}” to the couple for approval.`,
  };
}

export async function previewAddGuest(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  selectedClientId: string | null,
  input: Record<string, unknown>,
  now = new Date(),
): Promise<AddGuestPreview> {
  const guest = normalizeAddGuestArguments(input);
  const wedding = await resolveBriefingWedding(db, actor, selectedClientId);
  const delivery = await resolvePlannerApprovalDelivery(db, actor, selectedClientId, wedding.id);
  const confirmationId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const { error } = await db.from("intelligence_gateway_confirmations").insert({
    id: confirmationId,
    user_id: actor.userId,
    wedding_id: wedding.id,
    selected_client_id: selectedClientId,
    capability: "add_guest",
    arguments: { guest, outcome: delivery.outcome, coupleUserId: delivery.coupleUserId },
    idempotency_key: idempotencyKey,
    status: "pending",
    expires_at: expiresAt,
  }).select("id").single();
  if (error) throw new WeddingBriefingError("Could not prepare the guest addition for confirmation. Please try again.", 503);
  return {
    ok: true,
    capability: "add_guest",
    confirmationRequired: true,
    confirmationId,
    idempotencyKey,
    expiresAt,
    wedding: { id: wedding.id, name: wedding.name, weddingDate: wedding.wedding_date },
    interpretedGuest: guest,
    outcome: delivery.outcome,
    userSummary: `${guestSummary(guest, delivery.outcome)} Confirm this exact action before Zania continues.`,
  };
}

export async function executeConfirmedAddGuest(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<AddGuestReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) {
    throw new WeddingBriefingError("The guest confirmation is invalid. Preview the guest again.", 400);
  }
  const { data: confirmation, error: confirmationError } = await db.from("intelligence_gateway_confirmations")
    .select("id,wedding_id,selected_client_id,arguments,idempotency_key,status,expires_at,result_guest_id,result_change_request_id")
    .eq("id", confirmationId).eq("user_id", actor.userId).eq("capability", "add_guest").maybeSingle();
  if (confirmationError || !confirmation) {
    throw new WeddingBriefingError("This guest confirmation was not found. Preview the guest again.", 404);
  }
  if (String(confirmation.idempotency_key) !== idempotencyKey) {
    throw new WeddingBriefingError("The guest confirmation does not match this request.", 409);
  }
  const stored = confirmation.arguments as Record<string, unknown>;
  const guest = normalizeAddGuestArguments(
    stored.guest && typeof stored.guest === "object" ? stored.guest as Record<string, unknown> : {},
  );
  if (confirmation.status === "executed") {
    if (typeof confirmation.result_guest_id === "string") {
      const { data: existing, error } = await db.from("guests")
        .select("id,name,email,phone,rsvp_status,meal_preference,plus_one,table_number,group_name,category,wedding_id")
        .eq("id", confirmation.result_guest_id).eq("gateway_idempotency_key", idempotencyKey).maybeSingle();
      if (error || !existing) throw new WeddingBriefingError("The guest receipt could not be restored.", 503);
      return toGuestReceipt(existing, idempotencyKey, String(existing.wedding_id));
    }
    if (typeof confirmation.result_change_request_id === "string") {
      const { data: request, error } = await db.from("planner_change_requests")
        .select("id,status").eq("id", confirmation.result_change_request_id)
        .eq("gateway_idempotency_key", idempotencyKey).maybeSingle();
      if (error || !request) throw new WeddingBriefingError("The guest approval receipt could not be restored.", 503);
      return toGuestApprovalReceipt(request, guest, idempotencyKey, String(confirmation.wedding_id));
    }
    throw new WeddingBriefingError("The guest receipt could not be restored.", 503);
  }
  if (confirmation.status !== "pending") {
    throw new WeddingBriefingError("This guest confirmation is no longer available. Preview the guest again.", 409);
  }
  if (typeof confirmation.expires_at !== "string" || new Date(confirmation.expires_at).getTime() <= now.getTime()) {
    await db.from("intelligence_gateway_confirmations").update({ status: "expired" })
      .eq("id", confirmationId).eq("user_id", actor.userId).select("id").maybeSingle();
    throw new WeddingBriefingError("This guest confirmation expired. Preview the guest again.", 409);
  }
  const selectedClientId = typeof confirmation.selected_client_id === "string" ? confirmation.selected_client_id : null;
  const wedding = await resolveBriefingWedding(db, actor, selectedClientId);
  if (wedding.id !== confirmation.wedding_id) {
    throw new WeddingBriefingError("Wedding access changed after this guest was previewed. Preview it again.", 409);
  }
  const delivery = await resolvePlannerApprovalDelivery(db, actor, selectedClientId, wedding.id);
  if (delivery.outcome !== stored.outcome || delivery.coupleUserId !== (stored.coupleUserId ?? null)) {
    throw new WeddingBriefingError("The guest approval workflow changed after preview. Preview the guest again.", 409);
  }

  if (delivery.outcome === "approval_requested") {
    const { data: request, error: requestError } = await db.from("planner_change_requests").upsert({
      client_id: selectedClientId,
      couple_user_id: delivery.coupleUserId,
      planner_user_id: actor.userId,
      target_table: "guests",
      change_type: "create",
      target_id: null,
      current_payload: null,
      proposed_payload: { ...guestValues(guest), wedding_id: wedding.id, gateway_idempotency_key: idempotencyKey, created_via: "intelligence_gateway" },
      note: "Prepared and confirmed through Zania's conversational planner.",
      gateway_idempotency_key: idempotencyKey,
    }, { onConflict: "gateway_idempotency_key" }).select("id,status").single();
    if (requestError || !request) throw new WeddingBriefingError("Could not send the guest request. No change was made.", 503);
    const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
      status: "executed", executed_at: now.toISOString(), result_change_request_id: request.id,
    }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
    if (receiptError) throw new WeddingBriefingError("The guest request was sent, but its receipt could not be finalized. Retry with the same confirmation.", 503);
    return toGuestApprovalReceipt(request, guest, idempotencyKey, wedding.id);
  }

  const values = {
    user_id: actor.userId,
    wedding_id: wedding.id,
    client_id: selectedClientId,
    ...guestValues(guest),
    gateway_idempotency_key: idempotencyKey,
    created_via: "intelligence_gateway",
  };
  const { data: created, error: createError } = await db.from("guests")
    .upsert(values, { onConflict: "gateway_idempotency_key" })
    .select("id,name,email,phone,rsvp_status,meal_preference,plus_one,table_number,group_name,category,wedding_id")
    .single();
  if (createError || !created) throw new WeddingBriefingError("Could not add the guest. No change was made.", 503);
  const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
    status: "executed", executed_at: now.toISOString(), result_guest_id: created.id,
  }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
  if (receiptError) throw new WeddingBriefingError("The guest was added, but its receipt could not be finalized. Retry with the same confirmation.", 503);
  return toGuestReceipt(created, idempotencyKey, wedding.id);
}

export async function revokeAddGuestPreview(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<RevokeCreateTaskReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) {
    throw new WeddingBriefingError("The guest confirmation is invalid.", 400);
  }
  const { data: confirmation, error } = await db.from("intelligence_gateway_confirmations")
    .select("id,idempotency_key,status,expires_at")
    .eq("id", confirmationId).eq("user_id", actor.userId).eq("capability", "add_guest").maybeSingle();
  if (error || !confirmation) throw new WeddingBriefingError("This guest confirmation was not found.", 404);
  if (String(confirmation.idempotency_key) !== idempotencyKey) {
    throw new WeddingBriefingError("The guest confirmation does not match this request.", 409);
  }
  if (confirmation.status === "executed") {
    throw new WeddingBriefingError("This guest action was already completed and can no longer be cancelled.", 409);
  }
  const expired = confirmation.status === "expired"
    || (typeof confirmation.expires_at === "string" && new Date(confirmation.expires_at).getTime() <= now.getTime());
  const nextStatus = expired ? "expired" as const : "revoked" as const;
  if (confirmation.status !== nextStatus) {
    const { error: updateError } = await db.from("intelligence_gateway_confirmations")
      .update({ status: nextStatus }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
    if (updateError) throw new WeddingBriefingError("Could not cancel this guest confirmation. Please try again.", 503);
  }
  return {
    ok: true,
    capability: "add_guest",
    confirmationStatus: nextStatus,
    confirmationId,
    idempotencyKey,
    userSummary: nextStatus === "expired"
      ? "No guest was added. This guest confirmation had already expired."
      : "No guest was added. The guest confirmation was cancelled.",
  };
}

async function resolveExpenseCategory(
  db: GatewayWriteDatabase,
  weddingId: string,
  categoryName: string,
) {
  const { data, error } = await db.from("budget_categories")
    .select("id,name,spent,budget_scope,wedding_id")
    .eq("wedding_id", weddingId).eq("budget_scope", "wedding");
  if (error || !data) throw new WeddingBriefingError("Could not load the wedding budget categories. Please try again.", 503);
  const normalizeName = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
  const distance = (left: string, right: string) => {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let row = 1; row <= left.length; row += 1) {
      const current = [row];
      for (let column = 1; column <= right.length; column += 1) {
        current[column] = Math.min(
          current[column - 1] + 1,
          previous[column] + 1,
          previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
        );
      }
      previous.splice(0, previous.length, ...current);
    }
    return previous[right.length];
  };
  const requested = normalizeName(categoryName);
  const exactMatches = data.filter((row) => normalizeName(String(row.name)) === requested);
  let matches = exactMatches;
  if (!matches.length && requested.length >= 4) {
    const ranked = data.map((row) => {
      const candidate = normalizeName(String(row.name));
      const similarity = 1 - (distance(requested, candidate) / Math.max(requested.length, candidate.length, 1));
      return { row, similarity };
    }).sort((left, right) => right.similarity - left.similarity);
    if (ranked[0]?.similarity >= 0.72 && (!ranked[1] || ranked[0].similarity - ranked[1].similarity >= 0.08)) {
      matches = [ranked[0].row];
    }
  }
  if (matches.length !== 1) {
    const suggestions = data.map((row) => ({
      name: String(row.name),
      similarity: 1 - (distance(requested, normalizeName(String(row.name))) / Math.max(requested.length, normalizeName(String(row.name)).length, 1)),
    })).sort((left, right) => right.similarity - left.similarity).slice(0, 3).map((item) => `“${item.name}”`);
    throw new WeddingBriefingError(
      matches.length ? `More than one wedding budget category is named “${categoryName}”. Choose it in Budget first.`
        : `Could not safely match “${categoryName}” to one wedding budget category.${suggestions.length ? ` Try ${suggestions.join(", ")}.` : ""}`,
      matches.length ? 409 : 404,
    );
  }
  return {
    id: String(matches[0].id),
    name: String(matches[0].name),
    spent: Number(matches[0].spent ?? 0),
  };
}

function expenseSummary(expense: RecordExpenseArguments, outcome: RecordExpensePreview["outcome"]) {
  const base = `Record KES ${expense.amount.toLocaleString("en-KE", { maximumFractionDigits: 2 })} of spending in “${expense.categoryName}” for ${expense.payeeName} on ${expense.expenseDate}`;
  return outcome === "approval_requested" ? `${base} and send it to the couple for approval.` : `${base}.`;
}

function toExpenseReceipt(
  row: Record<string, unknown>,
  idempotencyKey: string,
): RecordExpenseReceipt {
  const expense = normalizeRecordExpenseArguments(row);
  return {
    ok: true,
    capability: "record_expense",
    confirmationStatus: "confirmed",
    outcome: "recorded",
    expense: {
      ...expense,
      id: String(row.id),
      categoryId: String(row.budget_category_id),
      weddingId: String(row.wedding_id),
    },
    approvalRequestId: null,
    receipt: { idempotencyKey, createdVia: "intelligence_gateway", path: "/budget" },
    userSummary: `Recorded KES ${expense.amount.toLocaleString("en-KE", { maximumFractionDigits: 2 })} of spending in “${expense.categoryName}” for ${expense.payeeName}. No payment or vendor balance was recorded.`,
  };
}

function toExpenseApprovalReceipt(
  request: Record<string, unknown>,
  expense: RecordExpenseArguments,
  categoryId: string,
  weddingId: string,
  idempotencyKey: string,
): RecordExpenseReceipt {
  return {
    ok: true,
    capability: "record_expense",
    confirmationStatus: "confirmed",
    outcome: "approval_requested",
    expense: { ...expense, id: null, categoryId, weddingId },
    approvalRequestId: String(request.id),
    receipt: { idempotencyKey, createdVia: "intelligence_gateway", path: "/budget" },
    userSummary: `Sent the KES ${expense.amount.toLocaleString("en-KE", { maximumFractionDigits: 2 })} “${expense.categoryName}” spend update to the couple for approval. No payment or vendor balance was recorded.`,
  };
}

export async function previewRecordExpense(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  selectedClientId: string | null,
  input: Record<string, unknown>,
  now = new Date(),
): Promise<RecordExpensePreview> {
  const requested = normalizeRecordExpenseArguments(input, now);
  const wedding = await resolveBriefingWedding(db, actor, selectedClientId);
  const category = await resolveExpenseCategory(db, wedding.id, requested.categoryName);
  const expense = { ...requested, categoryName: category.name };
  const delivery = await resolvePlannerApprovalDelivery(db, actor, selectedClientId, wedding.id);
  const confirmationId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const { error } = await db.from("intelligence_gateway_confirmations").insert({
    id: confirmationId,
    user_id: actor.userId,
    wedding_id: wedding.id,
    selected_client_id: selectedClientId,
    capability: "record_expense",
    arguments: {
      expense,
      categoryId: category.id,
      outcome: delivery.outcome === "approval_requested" ? "approval_requested" : "recorded",
      coupleUserId: delivery.coupleUserId,
    },
    idempotency_key: idempotencyKey,
    status: "pending",
    expires_at: expiresAt,
  }).select("id").single();
  if (error) throw new WeddingBriefingError("Could not prepare the expense for confirmation. Please try again.", 503);
  const outcome = delivery.outcome === "approval_requested" ? "approval_requested" as const : "recorded" as const;
  return {
    ok: true,
    capability: "record_expense",
    confirmationRequired: true,
    confirmationId,
    idempotencyKey,
    expiresAt,
    wedding: { id: wedding.id, name: wedding.name, weddingDate: wedding.wedding_date },
    category: { id: category.id, name: category.name, currentSpent: category.spent },
    interpretedExpense: expense,
    outcome,
    userSummary: `${expenseSummary(expense, outcome)} This changes recorded category spending only; it will not create a payment entry or change a vendor balance. Confirm this exact action before Zania continues.`,
  };
}

export async function executeConfirmedRecordExpense(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<RecordExpenseReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) {
    throw new WeddingBriefingError("The expense confirmation is invalid. Preview the expense again.", 400);
  }
  const { data: confirmation, error: confirmationError } = await db.from("intelligence_gateway_confirmations")
    .select("id,wedding_id,selected_client_id,arguments,idempotency_key,status,expires_at,result_expense_id,result_change_request_id")
    .eq("id", confirmationId).eq("user_id", actor.userId).eq("capability", "record_expense").maybeSingle();
  if (confirmationError || !confirmation) {
    throw new WeddingBriefingError("This expense confirmation was not found. Preview the expense again.", 404);
  }
  if (String(confirmation.idempotency_key) !== idempotencyKey) {
    throw new WeddingBriefingError("The expense confirmation does not match this request.", 409);
  }
  const stored = confirmation.arguments as Record<string, unknown>;
  const expense = normalizeRecordExpenseArguments(
    stored.expense && typeof stored.expense === "object" ? stored.expense as Record<string, unknown> : {},
    now,
  );
  const categoryId = typeof stored.categoryId === "string" ? stored.categoryId : "";
  if (!UUID.test(categoryId)) throw new WeddingBriefingError("The stored expense category is invalid.", 409);
  if (confirmation.status === "executed") {
    if (typeof confirmation.result_expense_id === "string") {
      const { data: existing, error } = await db.from("budget_expense_adjustments")
        .select("id,wedding_id,budget_category_id,category_name,payee_name,amount,expense_date,notes")
        .eq("id", confirmation.result_expense_id).eq("idempotency_key", idempotencyKey).maybeSingle();
      if (error || !existing) throw new WeddingBriefingError("The expense receipt could not be restored.", 503);
      return toExpenseReceipt(existing, idempotencyKey);
    }
    if (typeof confirmation.result_change_request_id === "string") {
      const { data: request, error } = await db.from("planner_change_requests")
        .select("id,status").eq("id", confirmation.result_change_request_id)
        .eq("gateway_idempotency_key", idempotencyKey).maybeSingle();
      if (error || !request) throw new WeddingBriefingError("The expense approval receipt could not be restored.", 503);
      return toExpenseApprovalReceipt(request, expense, categoryId, String(confirmation.wedding_id), idempotencyKey);
    }
    throw new WeddingBriefingError("The expense receipt could not be restored.", 503);
  }
  if (confirmation.status !== "pending") {
    throw new WeddingBriefingError("This expense confirmation is no longer available. Preview the expense again.", 409);
  }
  if (typeof confirmation.expires_at !== "string" || new Date(confirmation.expires_at).getTime() <= now.getTime()) {
    await db.from("intelligence_gateway_confirmations").update({ status: "expired" })
      .eq("id", confirmationId).eq("user_id", actor.userId).select("id").maybeSingle();
    throw new WeddingBriefingError("This expense confirmation expired. Preview the expense again.", 409);
  }
  const selectedClientId = typeof confirmation.selected_client_id === "string" ? confirmation.selected_client_id : null;
  const wedding = await resolveBriefingWedding(db, actor, selectedClientId);
  if (wedding.id !== confirmation.wedding_id) {
    throw new WeddingBriefingError("Wedding access changed after this expense was previewed. Preview it again.", 409);
  }
  const category = await resolveExpenseCategory(db, wedding.id, expense.categoryName);
  if (category.id !== categoryId) throw new WeddingBriefingError("The budget category changed after preview. Preview the expense again.", 409);
  const delivery = await resolvePlannerApprovalDelivery(db, actor, selectedClientId, wedding.id);
  const storedOutcome = stored.outcome === "approval_requested" ? "approval_requested" : "recorded";
  const currentOutcome = delivery.outcome === "approval_requested" ? "approval_requested" : "recorded";
  if (storedOutcome !== currentOutcome || delivery.coupleUserId !== (stored.coupleUserId ?? null)) {
    throw new WeddingBriefingError("The expense approval workflow changed after preview. Preview the expense again.", 409);
  }

  if (currentOutcome === "approval_requested") {
    const { data: request, error: requestError } = await db.from("planner_change_requests").upsert({
      client_id: selectedClientId,
      couple_user_id: delivery.coupleUserId,
      planner_user_id: actor.userId,
      target_table: "budget_categories",
      change_type: "update",
      target_id: category.id,
      current_payload: { spent: category.spent },
      proposed_payload: { spent: Math.round((category.spent + expense.amount) * 100) / 100 },
      note: `${expense.payeeName} • ${expense.expenseDate}${expense.notes ? ` • ${expense.notes}` : ""}`,
      gateway_idempotency_key: idempotencyKey,
    }, { onConflict: "gateway_idempotency_key" }).select("id,status").single();
    if (requestError || !request) throw new WeddingBriefingError("Could not send the expense request. No change was made.", 503);
    const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
      status: "executed", executed_at: now.toISOString(), result_change_request_id: request.id,
    }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
    if (receiptError) throw new WeddingBriefingError("The expense request was sent, but its receipt could not be finalized. Retry with the same confirmation.", 503);
    return toExpenseApprovalReceipt(request, expense, category.id, wedding.id, idempotencyKey);
  }

  const expenseColumns = "id,wedding_id,budget_category_id,category_name,payee_name,amount,expense_date,notes";
  let { data: recorded, error: existingError } = await db.from("budget_expense_adjustments")
    .select(expenseColumns).eq("idempotency_key", idempotencyKey).maybeSingle();
  if (existingError) throw new WeddingBriefingError("Could not check the expense receipt. No change was made.", 503);
  if (!recorded) {
    const inserted = await db.from("budget_expense_adjustments").insert({
      user_id: actor.userId,
      wedding_id: wedding.id,
      client_id: selectedClientId,
      budget_category_id: category.id,
      category_name: category.name,
      payee_name: expense.payeeName,
      amount: expense.amount,
      expense_date: expense.expenseDate,
      notes: expense.notes,
      idempotency_key: idempotencyKey,
      created_via: "intelligence_gateway",
    }).select(expenseColumns).single();
    recorded = inserted.data;
    if (inserted.error?.code === "23505") {
      const replay = await db.from("budget_expense_adjustments")
        .select(expenseColumns).eq("idempotency_key", idempotencyKey).maybeSingle();
      recorded = replay.data;
      existingError = replay.error;
    } else {
      existingError = inserted.error;
    }
  }
  if (existingError || !recorded) throw new WeddingBriefingError("Could not record the expense. No change was made.", 503);
  const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
    status: "executed", executed_at: now.toISOString(), result_expense_id: recorded.id,
  }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
  if (receiptError) throw new WeddingBriefingError("The expense was recorded, but its receipt could not be finalized. Retry with the same confirmation.", 503);
  return toExpenseReceipt(recorded, idempotencyKey);
}

export async function revokeRecordExpensePreview(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<RevokeCreateTaskReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) {
    throw new WeddingBriefingError("The expense confirmation is invalid.", 400);
  }
  const { data: confirmation, error } = await db.from("intelligence_gateway_confirmations")
    .select("id,idempotency_key,status,expires_at")
    .eq("id", confirmationId).eq("user_id", actor.userId).eq("capability", "record_expense").maybeSingle();
  if (error || !confirmation) throw new WeddingBriefingError("This expense confirmation was not found.", 404);
  if (String(confirmation.idempotency_key) !== idempotencyKey) {
    throw new WeddingBriefingError("The expense confirmation does not match this request.", 409);
  }
  if (confirmation.status === "executed") {
    throw new WeddingBriefingError("This expense was already recorded and can no longer be cancelled.", 409);
  }
  const expired = confirmation.status === "expired"
    || (typeof confirmation.expires_at === "string" && new Date(confirmation.expires_at).getTime() <= now.getTime());
  const nextStatus = expired ? "expired" as const : "revoked" as const;
  if (confirmation.status !== nextStatus) {
    const { error: updateError } = await db.from("intelligence_gateway_confirmations")
      .update({ status: nextStatus }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
    if (updateError) throw new WeddingBriefingError("Could not cancel this expense confirmation. Please try again.", 503);
  }
  return {
    ok: true,
    capability: "record_expense",
    confirmationStatus: nextStatus,
    confirmationId,
    idempotencyKey,
    userSummary: nextStatus === "expired"
      ? "No expense was recorded. This confirmation had already expired."
      : "No expense was recorded. The expense confirmation was cancelled.",
  };
}

function cleanVendorFollowUpText(value: unknown, label: string, max: number, required = false) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new WeddingBriefingError(`${label} is required.`, 400);
    return null;
  }
  if (typeof value !== "string") throw new WeddingBriefingError(`${label} must be text.`, 400);
  const cleaned = value.trim().replace(/[\r\n\t]+/g, " ");
  if (!cleaned) {
    if (required) throw new WeddingBriefingError(`${label} is required.`, 400);
    return null;
  }
  if (cleaned.length > max) throw new WeddingBriefingError(`${label} must be ${max} characters or fewer.`, 400);
  return cleaned;
}

export function normalizeCreateVendorFollowUpArguments(input: Record<string, unknown>): CreateVendorFollowUpArguments {
  const coupleName = cleanVendorFollowUpText(input.coupleName ?? input.couple_name, "Couple name", 160, true)!;
  const title = cleanVendorFollowUpText(input.title, "Reminder title", 160, true)!;
  const dueDate = cleanVendorFollowUpText(input.dueDate ?? input.due_date, "Reminder due date", 10);
  if (dueDate) {
    const parsed = new Date(`${dueDate}T00:00:00Z`);
    if (!DATE.test(dueDate) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dueDate) {
      throw new WeddingBriefingError("Use a valid reminder due date in YYYY-MM-DD format.", 400);
    }
  }
  return {
    coupleName,
    title,
    dueDate,
    notes: cleanVendorFollowUpText(input.notes, "Reminder notes", 1000),
  };
}

function normalizePersonName(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

async function resolveVendorFollowUpBooking(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  requestedCoupleName: string,
) {
  if (actor.role !== "vendor") {
    throw new WeddingBriefingError("Private booking follow-ups are available only in a vendor workspace.", 403);
  }
  const { data: listings, error: listingError } = await db.from("vendor_listings")
    .select("id,business_name,user_id").eq("user_id", actor.userId).limit(2);
  if (listingError) throw new WeddingBriefingError("Could not check the vendor workspace. Please try again.", 503);
  if (!listings?.length) throw new WeddingBriefingError("No vendor listing is connected to this account.", 403);
  if (listings.length !== 1) throw new WeddingBriefingError("Choose one vendor listing before creating a private follow-up.", 409);
  const listing = listings[0];
  const { data: bookings, error: bookingError } = await db.from("vendors")
    .select("id,user_id,wedding_id,category,vendor_listing_id")
    .eq("vendor_listing_id", listing.id).limit(100);
  if (bookingError) throw new WeddingBriefingError("Could not load vendor bookings. Please try again.", 503);
  const candidateBookings = (bookings ?? []).filter((booking) => (
    typeof booking.id === "string" && typeof booking.user_id === "string" && typeof booking.wedding_id === "string"
  ));
  if (!candidateBookings.length) throw new WeddingBriefingError("No connected client booking is available for a private follow-up.", 404);
  const userIds = [...new Set(candidateBookings.map((booking) => String(booking.user_id)))];
  const { data: profiles, error: profileError } = await db.from("profiles")
    .select("user_id,full_name,wedding_date").in("user_id", userIds).limit(100);
  if (profileError) throw new WeddingBriefingError("Could not identify the booked couple. Please try again.", 503);
  const profilesByUserId = new Map((profiles ?? []).map((profile) => [String(profile.user_id), profile]));
  const named = candidateBookings.flatMap((booking) => {
    const profile = profilesByUserId.get(String(booking.user_id));
    const coupleName = typeof profile?.full_name === "string" ? profile.full_name.trim() : "";
    return coupleName ? [{ booking, profile, coupleName }] : [];
  });
  const requested = normalizePersonName(requestedCoupleName);
  let matches = named.filter((candidate) => normalizePersonName(candidate.coupleName) === requested);
  if (!matches.length && requested.length >= 4) {
    const ranked = named.map((candidate) => {
      const normalized = normalizePersonName(candidate.coupleName);
      const similarity = 1 - (editDistance(requested, normalized) / Math.max(requested.length, normalized.length, 1));
      return { candidate, similarity };
    }).sort((left, right) => right.similarity - left.similarity);
    if (ranked[0]?.similarity >= 0.82 && (!ranked[1] || ranked[0].similarity - ranked[1].similarity >= 0.1)) {
      matches = [ranked[0].candidate];
    }
  }
  if (matches.length !== 1) {
    const suggestions = named.map((candidate) => candidate.coupleName).slice(0, 3).map((name) => `“${name}”`);
    throw new WeddingBriefingError(
      matches.length
        ? `More than one booking matches “${requestedCoupleName}”. Open Today and choose the booking first.`
        : `Could not safely match “${requestedCoupleName}” to one connected booking.${suggestions.length ? ` Try ${suggestions.join(", ")}.` : ""}`,
      matches.length ? 409 : 404,
    );
  }
  const match = matches[0];
  return {
    listing: { id: String(listing.id), businessName: String(listing.business_name ?? "Vendor workspace") },
    booking: {
      id: String(match.booking.id),
      userId: String(match.booking.user_id),
      weddingId: String(match.booking.wedding_id),
      category: typeof match.booking.category === "string" ? match.booking.category : null,
      coupleName: match.coupleName,
      weddingDate: typeof match.profile.wedding_date === "string" ? match.profile.wedding_date : null,
    },
  };
}

function vendorFollowUpSummary(reminder: CreateVendorFollowUpArguments) {
  return `Create private follow-up “${reminder.title}” for ${reminder.coupleName}${reminder.dueDate ? `, due ${reminder.dueDate}` : ""}.`;
}

function toVendorFollowUpReceipt(
  row: Record<string, unknown>,
  reminder: CreateVendorFollowUpArguments,
  idempotencyKey: string,
): CreateVendorFollowUpReceipt {
  return {
    ok: true,
    capability: "create_vendor_follow_up_reminder",
    confirmationStatus: "confirmed",
    reminder: {
      ...reminder,
      id: String(row.id),
      vendorId: String(row.vendor_id),
      vendorListingId: String(row.vendor_listing_id),
      status: "open",
    },
    receipt: { idempotencyKey, createdVia: "intelligence_gateway", path: "/vendor-dashboard" },
    userSummary: `Created private follow-up “${reminder.title}” for ${reminder.coupleName}${reminder.dueDate ? `, due ${reminder.dueDate}` : ""}.`,
  };
}

export async function previewCreateVendorFollowUp(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  input: Record<string, unknown>,
  now = new Date(),
): Promise<CreateVendorFollowUpPreview> {
  const requested = normalizeCreateVendorFollowUpArguments(input);
  const resolved = await resolveVendorFollowUpBooking(db, actor, requested.coupleName);
  const reminder = { ...requested, coupleName: resolved.booking.coupleName };
  const confirmationId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const { error } = await db.from("intelligence_gateway_confirmations").insert({
    id: confirmationId,
    user_id: actor.userId,
    wedding_id: resolved.booking.weddingId,
    selected_client_id: null,
    capability: "create_vendor_follow_up_reminder",
    arguments: {
      reminder,
      vendorListingId: resolved.listing.id,
      bookingId: resolved.booking.id,
      coupleUserId: resolved.booking.userId,
    },
    idempotency_key: idempotencyKey,
    status: "pending",
    expires_at: expiresAt,
  }).select("id").single();
  if (error) throw new WeddingBriefingError("Could not prepare the private follow-up for confirmation. Please try again.", 503);
  return {
    ok: true,
    capability: "create_vendor_follow_up_reminder",
    confirmationRequired: true,
    confirmationId,
    idempotencyKey,
    expiresAt,
    wedding: {
      id: resolved.booking.weddingId,
      name: `${resolved.booking.coupleName} wedding`,
      weddingDate: resolved.booking.weddingDate,
    },
    vendorListing: resolved.listing,
    booking: { id: resolved.booking.id, coupleName: resolved.booking.coupleName, category: resolved.booking.category },
    interpretedReminder: reminder,
    userSummary: `${vendorFollowUpSummary(reminder)} This reminder is private to your vendor workspace. Confirm this exact action before Zania continues.`,
  };
}

export async function executeConfirmedCreateVendorFollowUp(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<CreateVendorFollowUpReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) {
    throw new WeddingBriefingError("The private follow-up confirmation is invalid. Preview it again.", 400);
  }
  const { data: confirmation, error: confirmationError } = await db.from("intelligence_gateway_confirmations")
    .select("id,wedding_id,arguments,idempotency_key,status,expires_at,result_vendor_follow_up_id")
    .eq("id", confirmationId).eq("user_id", actor.userId)
    .eq("capability", "create_vendor_follow_up_reminder").maybeSingle();
  if (confirmationError || !confirmation) {
    throw new WeddingBriefingError("This private follow-up confirmation was not found. Preview it again.", 404);
  }
  if (String(confirmation.idempotency_key) !== idempotencyKey) {
    throw new WeddingBriefingError("The private follow-up confirmation does not match this request.", 409);
  }
  const stored = confirmation.arguments as Record<string, unknown>;
  const reminder = normalizeCreateVendorFollowUpArguments(
    stored.reminder && typeof stored.reminder === "object" ? stored.reminder as Record<string, unknown> : {},
  );
  const bookingId = typeof stored.bookingId === "string" ? stored.bookingId : "";
  const vendorListingId = typeof stored.vendorListingId === "string" ? stored.vendorListingId : "";
  const coupleUserId = typeof stored.coupleUserId === "string" ? stored.coupleUserId : "";
  if (!UUID.test(bookingId) || !UUID.test(vendorListingId) || !UUID.test(coupleUserId)) {
    throw new WeddingBriefingError("The stored booking reference is invalid. Preview the follow-up again.", 409);
  }
  const reminderColumns = "id,vendor_id,vendor_listing_id,title,notes,due_date,status,gateway_idempotency_key";
  if (confirmation.status === "executed") {
    if (typeof confirmation.result_vendor_follow_up_id !== "string") {
      throw new WeddingBriefingError("The private follow-up receipt could not be restored.", 503);
    }
    const { data: existing, error } = await db.from("vendor_follow_up_reminders")
      .select(reminderColumns).eq("id", confirmation.result_vendor_follow_up_id)
      .eq("gateway_idempotency_key", idempotencyKey).maybeSingle();
    if (error || !existing) throw new WeddingBriefingError("The private follow-up receipt could not be restored.", 503);
    return toVendorFollowUpReceipt(existing, reminder, idempotencyKey);
  }
  if (confirmation.status !== "pending") {
    throw new WeddingBriefingError("This private follow-up confirmation is no longer available. Preview it again.", 409);
  }
  if (typeof confirmation.expires_at !== "string" || new Date(confirmation.expires_at).getTime() <= now.getTime()) {
    await db.from("intelligence_gateway_confirmations").update({ status: "expired" })
      .eq("id", confirmationId).eq("user_id", actor.userId).select("id").maybeSingle();
    throw new WeddingBriefingError("This private follow-up confirmation expired. Preview it again.", 409);
  }
  const resolved = await resolveVendorFollowUpBooking(db, actor, reminder.coupleName);
  if (resolved.listing.id !== vendorListingId || resolved.booking.id !== bookingId
    || resolved.booking.userId !== coupleUserId || resolved.booking.weddingId !== confirmation.wedding_id) {
    throw new WeddingBriefingError("Booking access changed after this follow-up was previewed. Preview it again.", 409);
  }
  const rpcResult = await db.rpc("create_vendor_follow_up_reminder_gateway", {
    target_vendor_id: bookingId,
    title_input: reminder.title,
    notes_input: reminder.notes,
    due_date_input: reminder.dueDate,
    gateway_idempotency_key_input: idempotencyKey,
  });
  if (rpcResult.error || typeof rpcResult.data !== "string" || !UUID.test(rpcResult.data)) {
    throw new WeddingBriefingError("Could not create the private follow-up. No duplicate reminder was created.", 503);
  }
  const { data: recorded, error: recordedError } = await db.from("vendor_follow_up_reminders")
    .select(reminderColumns).eq("id", rpcResult.data).eq("gateway_idempotency_key", idempotencyKey).maybeSingle();
  if (recordedError || !recorded) throw new WeddingBriefingError("The follow-up was created, but its receipt could not be loaded. Retry with the same confirmation.", 503);
  const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
    status: "executed", executed_at: now.toISOString(), result_vendor_follow_up_id: recorded.id,
  }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
  if (receiptError) throw new WeddingBriefingError("The follow-up was created, but its receipt could not be finalized. Retry with the same confirmation.", 503);
  return toVendorFollowUpReceipt(recorded, reminder, idempotencyKey);
}

export async function revokeCreateVendorFollowUpPreview(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<RevokeCreateTaskReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) {
    throw new WeddingBriefingError("The private follow-up confirmation is invalid.", 400);
  }
  const { data: confirmation, error } = await db.from("intelligence_gateway_confirmations")
    .select("id,idempotency_key,status,expires_at")
    .eq("id", confirmationId).eq("user_id", actor.userId)
    .eq("capability", "create_vendor_follow_up_reminder").maybeSingle();
  if (error || !confirmation) throw new WeddingBriefingError("This private follow-up confirmation was not found.", 404);
  if (String(confirmation.idempotency_key) !== idempotencyKey) {
    throw new WeddingBriefingError("The private follow-up confirmation does not match this request.", 409);
  }
  if (confirmation.status === "executed") {
    throw new WeddingBriefingError("This private follow-up was already created and can no longer be cancelled.", 409);
  }
  const expired = confirmation.status === "expired"
    || (typeof confirmation.expires_at === "string" && new Date(confirmation.expires_at).getTime() <= now.getTime());
  const nextStatus = expired ? "expired" as const : "revoked" as const;
  if (confirmation.status !== nextStatus) {
    const { error: updateError } = await db.from("intelligence_gateway_confirmations")
      .update({ status: nextStatus }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
    if (updateError) throw new WeddingBriefingError("Could not cancel this private follow-up confirmation. Please try again.", 503);
  }
  return {
    ok: true,
    capability: "create_vendor_follow_up_reminder",
    confirmationStatus: nextStatus,
    confirmationId,
    idempotencyKey,
    userSummary: nextStatus === "expired"
      ? "No private follow-up was created. This confirmation had already expired."
      : "No private follow-up was created. The confirmation was cancelled.",
  };
}

export function normalizeRecordPaymentArguments(
  input: Record<string, unknown>,
  now = new Date(),
): RecordPaymentArguments {
  const categoryName = cleanGuestText(input.categoryName ?? input.category_name, "Budget category", 120);
  if (!categoryName) throw new WeddingBriefingError("Choose a wedding budget category before continuing.", 400);
  const vendorName = cleanGuestText(input.vendorName ?? input.vendor_name, "Vendor name", 160);
  const suppliedPayee = cleanGuestText(input.payeeName ?? input.payee_name, "Payment payee", 160);
  if (!vendorName && !suppliedPayee) {
    throw new WeddingBriefingError("Add the vendor or payee who received this payment.", 400);
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    throw new WeddingBriefingError("Payment amount must be greater than zero and no more than KES 1,000,000,000.", 400);
  }
  const roundedAmount = Math.round((amount + 1e-9) * 100) / 100;
  const paymentDate = cleanGuestText(input.paymentDate ?? input.payment_date, "Payment date", 10) ?? kenyaDate(now);
  const parsed = new Date(`${paymentDate}T00:00:00Z`);
  if (!DATE.test(paymentDate) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== paymentDate) {
    throw new WeddingBriefingError("Use a valid payment date in YYYY-MM-DD format.", 400);
  }
  return {
    categoryName,
    amount: roundedAmount,
    payeeName: suppliedPayee ?? vendorName!,
    vendorName,
    paymentDate,
    reference: cleanGuestText(input.reference, "Payment reference", 160),
    notes: cleanGuestText(input.notes, "Payment notes", 1000),
  };
}

function derivePaymentStatus(totalPaid: number, totalCost: number | null, depositRequired: number) {
  if (totalCost !== null && totalCost > 0 && totalPaid >= totalCost) return "paid_full";
  if (totalPaid <= 0) return depositRequired > 0 ? "deposit_due" : "unpaid";
  if (depositRequired > 0 && totalPaid === depositRequired) return "deposit_paid";
  return "part_paid";
}

async function resolvePaymentVendor(
  db: GatewayWriteDatabase,
  weddingId: string,
  vendorName: string | null,
) {
  if (!vendorName) return null;
  const { data, error } = await db.from("vendors")
    .select("id,name,price,deposit_amount,amount_paid,payment_status,wedding_id")
    .eq("wedding_id", weddingId).limit(100);
  if (error || !data) throw new WeddingBriefingError("Could not load wedding vendors. Please try again.", 503);
  const requested = normalizePersonName(vendorName);
  let matches = data.filter((vendor) => normalizePersonName(String(vendor.name ?? "")) === requested);
  if (!matches.length && requested.length >= 4) {
    const ranked = data.map((vendor) => {
      const normalized = normalizePersonName(String(vendor.name ?? ""));
      const similarity = 1 - (editDistance(requested, normalized) / Math.max(requested.length, normalized.length, 1));
      return { vendor, similarity };
    }).sort((left, right) => right.similarity - left.similarity);
    if (ranked[0]?.similarity >= 0.8 && (!ranked[1] || ranked[0].similarity - ranked[1].similarity >= 0.1)) {
      matches = [ranked[0].vendor];
    }
  }
  if (matches.length !== 1) {
    const suggestions = data.map((vendor) => String(vendor.name ?? "")).filter(Boolean)
      .slice(0, 3).map((name) => `“${name}”`);
    throw new WeddingBriefingError(
      matches.length
        ? `More than one wedding vendor matches “${vendorName}”. Choose the vendor in Vendors first.`
        : `Could not safely match “${vendorName}” to one wedding vendor.${suggestions.length ? ` Try ${suggestions.join(", ")}.` : ""}`,
      matches.length ? 409 : 404,
    );
  }
  const row = matches[0];
  const { data: payments, error: paymentsError } = await db.from("budget_payments")
    .select("id,amount,vendor_id,wedding_id").eq("vendor_id", row.id).eq("wedding_id", weddingId).limit(10000);
  if (paymentsError || !payments) throw new WeddingBriefingError("Could not verify the vendor payment ledger. Please try again.", 503);
  const currentPaid = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  return {
    id: String(row.id),
    name: String(row.name),
    totalCost: row.price === null || row.price === undefined ? null : Number(row.price),
    depositRequired: Number(row.deposit_amount ?? 0),
    currentPaid: Math.round(currentPaid * 100) / 100,
  };
}

function paymentSummary(
  payment: RecordPaymentArguments,
  outcome: RecordPaymentPreview["outcome"],
  vendor: RecordPaymentPreview["vendor"],
) {
  const base = `Record KES ${payment.amount.toLocaleString("en-KE", { maximumFractionDigits: 2 })} paid to ${payment.payeeName} in “${payment.categoryName}” on ${payment.paymentDate}`;
  const effect = vendor
    ? ` The vendor's recorded paid total will become KES ${vendor.nextPaid.toLocaleString("en-KE", { maximumFractionDigits: 2 })}.`
    : " No vendor balance will change.";
  return outcome === "approval_requested"
    ? `Send a request to the couple to ${base.toLowerCase()}. The couple will review the current ledger and vendor balance before anything changes.`
    : `${base}.${effect}`;
}

function toPaymentReceipt(
  row: Record<string, unknown>,
  payment: RecordPaymentArguments,
  idempotencyKey: string,
  vendor: RecordPaymentReceipt["vendor"],
): RecordPaymentReceipt {
  return {
    ok: true,
    capability: "record_payment",
    confirmationStatus: "confirmed",
    outcome: "recorded",
    payment: {
      ...payment,
      id: String(row.id),
      weddingId: String(row.wedding_id),
      categoryId: String(row.budget_category_id),
      vendorId: typeof row.vendor_id === "string" ? row.vendor_id : null,
    },
    approvalRequestId: null,
    vendor,
    receipt: { idempotencyKey, createdVia: "intelligence_gateway", path: "/budget" },
    userSummary: `Recorded KES ${payment.amount.toLocaleString("en-KE", { maximumFractionDigits: 2 })} paid to ${payment.payeeName} in “${payment.categoryName}”.${vendor ? ` ${vendor.name}'s recorded paid total is now KES ${vendor.totalPaid.toLocaleString("en-KE", { maximumFractionDigits: 2 })}.` : ""} This recorded an existing payment; Zania did not move money or initiate Zania Pay.`,
  };
}

function toPaymentApprovalReceipt(
  request: Record<string, unknown>,
  payment: RecordPaymentArguments,
  weddingId: string,
  categoryId: string,
  vendorId: string | null,
  idempotencyKey: string,
): RecordPaymentReceipt {
  return {
    ok: true,
    capability: "record_payment",
    confirmationStatus: "confirmed",
    outcome: "approval_requested",
    payment: { ...payment, id: null, weddingId, categoryId, vendorId },
    approvalRequestId: String(request.id),
    vendor: null,
    receipt: { idempotencyKey, createdVia: "intelligence_gateway", path: "/budget" },
    userSummary: `Sent the KES ${payment.amount.toLocaleString("en-KE", { maximumFractionDigits: 2 })} payment entry to the couple for approval. No ledger, category total or vendor balance changed yet.`,
  };
}

export async function previewRecordPayment(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  selectedClientId: string | null,
  input: Record<string, unknown>,
  now = new Date(),
): Promise<RecordPaymentPreview> {
  const requested = normalizeRecordPaymentArguments(input, now);
  const wedding = await resolveBriefingWedding(db, actor, selectedClientId);
  const category = await resolveExpenseCategory(db, wedding.id, requested.categoryName);
  const resolvedVendor = await resolvePaymentVendor(db, wedding.id, requested.vendorName);
  const payment = {
    ...requested,
    categoryName: category.name,
    vendorName: resolvedVendor?.name ?? null,
    payeeName: resolvedVendor?.name ?? requested.payeeName,
  };
  const delivery = await resolvePlannerApprovalDelivery(db, actor, selectedClientId, wedding.id);
  const vendor = resolvedVendor ? {
    id: resolvedVendor.id,
    name: resolvedVendor.name,
    currentPaid: resolvedVendor.currentPaid,
    nextPaid: Math.round((resolvedVendor.currentPaid + payment.amount) * 100) / 100,
    nextStatus: derivePaymentStatus(
      Math.round((resolvedVendor.currentPaid + payment.amount) * 100) / 100,
      resolvedVendor.totalCost,
      resolvedVendor.depositRequired,
    ),
  } : null;
  const outcome = delivery.outcome === "approval_requested" ? "approval_requested" as const : "recorded" as const;
  const confirmationId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const { error } = await db.from("intelligence_gateway_confirmations").insert({
    id: confirmationId,
    user_id: actor.userId,
    wedding_id: wedding.id,
    selected_client_id: selectedClientId,
    capability: "record_payment",
    arguments: {
      payment,
      categoryId: category.id,
      vendorId: vendor?.id ?? null,
      outcome,
      coupleUserId: delivery.coupleUserId,
    },
    idempotency_key: idempotencyKey,
    status: "pending",
    expires_at: expiresAt,
  }).select("id").single();
  if (error) throw new WeddingBriefingError("Could not prepare the payment for confirmation. Please try again.", 503);
  return {
    ok: true,
    capability: "record_payment",
    confirmationRequired: true,
    confirmationId,
    idempotencyKey,
    expiresAt,
    wedding: { id: wedding.id, name: wedding.name, weddingDate: wedding.wedding_date },
    category: {
      id: category.id,
      name: category.name,
      currentSpent: category.spent,
      nextSpent: Math.round((category.spent + payment.amount) * 100) / 100,
    },
    vendor,
    interpretedPayment: payment,
    outcome,
    userSummary: `${paymentSummary(payment, outcome, vendor)} This records money already paid and increases the category's recorded spending. It does not move money, initiate Zania Pay or create an invoice receipt. Confirm this exact action before Zania continues.`,
  };
}

export async function executeConfirmedRecordPayment(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<RecordPaymentReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) {
    throw new WeddingBriefingError("The payment confirmation is invalid. Preview the payment again.", 400);
  }
  const { data: confirmation, error: confirmationError } = await db.from("intelligence_gateway_confirmations")
    .select("id,wedding_id,selected_client_id,arguments,idempotency_key,status,expires_at,result_payment_id,result_change_request_id")
    .eq("id", confirmationId).eq("user_id", actor.userId).eq("capability", "record_payment").maybeSingle();
  if (confirmationError || !confirmation) {
    throw new WeddingBriefingError("This payment confirmation was not found. Preview the payment again.", 404);
  }
  if (String(confirmation.idempotency_key) !== idempotencyKey) {
    throw new WeddingBriefingError("The payment confirmation does not match this request.", 409);
  }
  const stored = confirmation.arguments as Record<string, unknown>;
  const payment = normalizeRecordPaymentArguments(
    stored.payment && typeof stored.payment === "object" ? stored.payment as Record<string, unknown> : {},
    now,
  );
  const categoryId = typeof stored.categoryId === "string" ? stored.categoryId : "";
  const vendorId = typeof stored.vendorId === "string" ? stored.vendorId : null;
  if (!UUID.test(categoryId) || (vendorId !== null && !UUID.test(vendorId))) {
    throw new WeddingBriefingError("The stored payment target is invalid. Preview the payment again.", 409);
  }
  if (confirmation.status === "executed") {
    if (typeof confirmation.result_payment_id === "string") {
      const { data: existing, error } = await db.from("budget_payments")
        .select("id,wedding_id,budget_category_id,vendor_id,category_name,payee_name,amount,payment_date,reference,notes")
        .eq("id", confirmation.result_payment_id).eq("gateway_idempotency_key", idempotencyKey).maybeSingle();
      if (error || !existing) throw new WeddingBriefingError("The payment receipt could not be restored.", 503);
      let vendorReceipt: RecordPaymentReceipt["vendor"] = null;
      if (vendorId) {
        const { data: vendorRow, error: vendorError } = await db.from("vendors")
          .select("id,name,amount_paid,payment_status").eq("id", vendorId).eq("wedding_id", confirmation.wedding_id).maybeSingle();
        if (vendorError || !vendorRow) throw new WeddingBriefingError("The vendor payment receipt could not be restored.", 503);
        vendorReceipt = {
          id: String(vendorRow.id), name: String(vendorRow.name),
          totalPaid: Number(vendorRow.amount_paid ?? 0), paymentStatus: String(vendorRow.payment_status ?? "unpaid"),
        };
      }
      return toPaymentReceipt(existing, payment, idempotencyKey, vendorReceipt);
    }
    if (typeof confirmation.result_change_request_id === "string") {
      const { data: request, error } = await db.from("planner_change_requests")
        .select("id,status").eq("id", confirmation.result_change_request_id)
        .eq("gateway_idempotency_key", idempotencyKey).maybeSingle();
      if (error || !request) throw new WeddingBriefingError("The payment approval receipt could not be restored.", 503);
      return toPaymentApprovalReceipt(request, payment, String(confirmation.wedding_id), categoryId, vendorId, idempotencyKey);
    }
    throw new WeddingBriefingError("The payment receipt could not be restored.", 503);
  }
  if (confirmation.status !== "pending") {
    throw new WeddingBriefingError("This payment confirmation is no longer available. Preview the payment again.", 409);
  }
  if (typeof confirmation.expires_at !== "string" || new Date(confirmation.expires_at).getTime() <= now.getTime()) {
    await db.from("intelligence_gateway_confirmations").update({ status: "expired" })
      .eq("id", confirmationId).eq("user_id", actor.userId).select("id").maybeSingle();
    throw new WeddingBriefingError("This payment confirmation expired. Preview the payment again.", 409);
  }
  const selectedClientId = typeof confirmation.selected_client_id === "string" ? confirmation.selected_client_id : null;
  const wedding = await resolveBriefingWedding(db, actor, selectedClientId);
  if (wedding.id !== confirmation.wedding_id) {
    throw new WeddingBriefingError("Wedding access changed after this payment was previewed. Preview it again.", 409);
  }
  const category = await resolveExpenseCategory(db, wedding.id, payment.categoryName);
  if (category.id !== categoryId) throw new WeddingBriefingError("The budget category changed after preview. Preview the payment again.", 409);
  const resolvedVendor = await resolvePaymentVendor(db, wedding.id, payment.vendorName);
  if ((resolvedVendor?.id ?? null) !== vendorId) {
    throw new WeddingBriefingError("The vendor changed after preview. Preview the payment again.", 409);
  }
  const delivery = await resolvePlannerApprovalDelivery(db, actor, selectedClientId, wedding.id);
  const currentOutcome = delivery.outcome === "approval_requested" ? "approval_requested" : "recorded";
  if (currentOutcome !== stored.outcome || delivery.coupleUserId !== (stored.coupleUserId ?? null)) {
    throw new WeddingBriefingError("The payment approval workflow changed after preview. Preview the payment again.", 409);
  }

  if (currentOutcome === "approval_requested") {
    const { data: request, error: requestError } = await db.from("planner_change_requests").upsert({
      client_id: selectedClientId,
      couple_user_id: delivery.coupleUserId,
      planner_user_id: actor.userId,
      target_table: "budget_payments",
      change_type: "create",
      target_id: null,
      current_payload: { category_spent: category.spent },
      proposed_payload: {
        wedding_id: wedding.id,
        budget_category_id: category.id,
        vendor_id: vendorId,
        budget_scope: "wedding",
        category_name: category.name,
        payee_name: payment.payeeName,
        amount: payment.amount,
        payment_date: payment.paymentDate,
        reference: payment.reference,
        notes: payment.notes,
        gateway_idempotency_key: idempotencyKey,
        created_via: "intelligence_gateway",
      },
      note: "Prepared and confirmed through Zania's conversational planner. This records an existing payment and does not move money.",
      gateway_idempotency_key: idempotencyKey,
    }, { onConflict: "gateway_idempotency_key" }).select("id,status").single();
    if (requestError || !request) throw new WeddingBriefingError("Could not send the payment request. No change was made.", 503);
    const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
      status: "executed", executed_at: now.toISOString(), result_change_request_id: request.id,
    }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
    if (receiptError) throw new WeddingBriefingError("The payment request was sent, but its receipt could not be finalized. Retry with the same confirmation.", 503);
    return toPaymentApprovalReceipt(request, payment, wedding.id, category.id, vendorId, idempotencyKey);
  }

  const rpcResult = await db.rpc("record_budget_payment_gateway", {
    target_wedding_id: wedding.id,
    target_client_id: selectedClientId,
    target_budget_category_id: category.id,
    target_vendor_id: vendorId,
    payee_name_input: payment.payeeName,
    amount_input: payment.amount,
    payment_date_input: payment.paymentDate,
    reference_input: payment.reference,
    notes_input: payment.notes,
    gateway_idempotency_key_input: idempotencyKey,
  });
  if (rpcResult.error || typeof rpcResult.data !== "string" || !UUID.test(rpcResult.data)) {
    throw new WeddingBriefingError("Could not record the payment. No duplicate payment was created.", 503);
  }
  const { data: recorded, error: recordedError } = await db.from("budget_payments")
    .select("id,wedding_id,budget_category_id,vendor_id,category_name,payee_name,amount,payment_date,reference,notes")
    .eq("id", rpcResult.data).eq("gateway_idempotency_key", idempotencyKey).maybeSingle();
  if (recordedError || !recorded) throw new WeddingBriefingError("The payment was recorded, but its receipt could not be loaded. Retry with the same confirmation.", 503);
  let vendorReceipt: RecordPaymentReceipt["vendor"] = null;
  if (vendorId) {
    const { data: vendorRow, error: vendorError } = await db.from("vendors")
      .select("id,name,amount_paid,payment_status").eq("id", vendorId).eq("wedding_id", wedding.id).maybeSingle();
    if (vendorError || !vendorRow) throw new WeddingBriefingError("The payment was recorded, but the vendor balance could not be loaded. Retry with the same confirmation.", 503);
    vendorReceipt = {
      id: String(vendorRow.id), name: String(vendorRow.name),
      totalPaid: Number(vendorRow.amount_paid ?? 0), paymentStatus: String(vendorRow.payment_status ?? "unpaid"),
    };
  }
  const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
    status: "executed", executed_at: now.toISOString(), result_payment_id: recorded.id,
  }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
  if (receiptError) throw new WeddingBriefingError("The payment was recorded, but its receipt could not be finalized. Retry with the same confirmation.", 503);
  return toPaymentReceipt(recorded, payment, idempotencyKey, vendorReceipt);
}

export async function revokeRecordPaymentPreview(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<RevokeCreateTaskReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) {
    throw new WeddingBriefingError("The payment confirmation is invalid.", 400);
  }
  const { data: confirmation, error } = await db.from("intelligence_gateway_confirmations")
    .select("id,idempotency_key,status,expires_at")
    .eq("id", confirmationId).eq("user_id", actor.userId).eq("capability", "record_payment").maybeSingle();
  if (error || !confirmation) throw new WeddingBriefingError("This payment confirmation was not found.", 404);
  if (String(confirmation.idempotency_key) !== idempotencyKey) {
    throw new WeddingBriefingError("The payment confirmation does not match this request.", 409);
  }
  if (confirmation.status === "executed") {
    throw new WeddingBriefingError("This payment was already recorded and can no longer be cancelled.", 409);
  }
  const expired = confirmation.status === "expired"
    || (typeof confirmation.expires_at === "string" && new Date(confirmation.expires_at).getTime() <= now.getTime());
  const nextStatus = expired ? "expired" as const : "revoked" as const;
  if (confirmation.status !== nextStatus) {
    const { error: updateError } = await db.from("intelligence_gateway_confirmations")
      .update({ status: nextStatus }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
    if (updateError) throw new WeddingBriefingError("Could not cancel this payment confirmation. Please try again.", 503);
  }
  return {
    ok: true,
    capability: "record_payment",
    confirmationStatus: nextStatus,
    confirmationId,
    idempotencyKey,
    userSummary: nextStatus === "expired"
      ? "No payment was recorded. This confirmation had already expired."
      : "No payment was recorded. The payment confirmation was cancelled.",
  };
}

export async function revokeCreateTaskPreview(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<RevokeCreateTaskReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) {
    throw new WeddingBriefingError("The task confirmation is invalid.", 400);
  }

  const { data: confirmation, error } = await db.from("intelligence_gateway_confirmations")
    .select("id,idempotency_key,status,expires_at")
    .eq("id", confirmationId).eq("user_id", actor.userId).eq("capability", "create_task").maybeSingle();
  if (error || !confirmation) {
    throw new WeddingBriefingError("This task confirmation was not found.", 404);
  }
  if (String(confirmation.idempotency_key) !== idempotencyKey) {
    throw new WeddingBriefingError("The task confirmation does not match this request.", 409);
  }
  if (confirmation.status === "executed") {
    throw new WeddingBriefingError("This task was already created and can no longer be cancelled.", 409);
  }

  const expired = confirmation.status === "expired"
    || (typeof confirmation.expires_at === "string" && new Date(confirmation.expires_at).getTime() <= now.getTime());
  const nextStatus = expired ? "expired" as const : "revoked" as const;

  if (confirmation.status !== nextStatus) {
    const { error: updateError } = await db.from("intelligence_gateway_confirmations")
      .update({ status: nextStatus })
      .eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
    if (updateError) throw new WeddingBriefingError("Could not cancel this task confirmation. Please try again.", 503);
  }

  return {
    ok: true,
    capability: "create_task",
    confirmationStatus: nextStatus,
    confirmationId,
    idempotencyKey,
    userSummary: nextStatus === "expired"
      ? "No task was created. This task confirmation had already expired."
      : "No task was created. The task confirmation was cancelled.",
  };
}

export async function revokeUpdateTaskPreview(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<RevokeCreateTaskReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) {
    throw new WeddingBriefingError("The task update confirmation is invalid.", 400);
  }
  const { data: confirmation, error } = await db.from("intelligence_gateway_confirmations")
    .select("id,idempotency_key,status,expires_at")
    .eq("id", confirmationId).eq("user_id", actor.userId).eq("capability", "update_task").maybeSingle();
  if (error || !confirmation) throw new WeddingBriefingError("This task update confirmation was not found.", 404);
  if (String(confirmation.idempotency_key) !== idempotencyKey) {
    throw new WeddingBriefingError("The task update confirmation does not match this request.", 409);
  }
  if (confirmation.status === "executed") {
    throw new WeddingBriefingError("This task update was already applied and can no longer be cancelled.", 409);
  }
  const expired = confirmation.status === "expired"
    || (typeof confirmation.expires_at === "string" && new Date(confirmation.expires_at).getTime() <= now.getTime());
  const nextStatus = expired ? "expired" as const : "revoked" as const;
  if (confirmation.status !== nextStatus) {
    const { error: updateError } = await db.from("intelligence_gateway_confirmations")
      .update({ status: nextStatus }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
    if (updateError) throw new WeddingBriefingError("Could not cancel this task update. Please try again.", 503);
  }
  return {
    ok: true,
    capability: "update_task",
    confirmationStatus: nextStatus,
    confirmationId,
    idempotencyKey,
    userSummary: nextStatus === "expired"
      ? "No task was changed. This update confirmation had already expired."
      : "No task was changed. The task update confirmation was cancelled.",
  };
}

function normalizeCandidateUrl(value: unknown, label: string) {
  const cleaned = cleanGuestText(value, label, 2048);
  if (!cleaned) return null;
  try {
    const url = new URL(cleaned);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("unsupported protocol");
    url.hash = "";
    return url.toString();
  } catch {
    throw new WeddingBriefingError(`${label} must be a valid public web URL.`, 400);
  }
}

function cleanCandidateList(value: unknown, maxItems: number, maxLength: number) {
  return Array.isArray(value)
    ? value.map((item) => cleanGuestText(item, "Vendor detail", maxLength)).filter((item): item is string => Boolean(item)).slice(0, maxItems)
    : [];
}

export async function normalizeSaveVendorCandidateArguments(
  db: GatewayWriteDatabase,
  input: Record<string, unknown>,
): Promise<SaveVendorCandidateArguments> {
  const vendorListingId = typeof (input.vendorListingId ?? input.vendor_listing_id) === "string"
    ? String(input.vendorListingId ?? input.vendor_listing_id)
    : null;
  const rawSnapshot = input.snapshot && typeof input.snapshot === "object"
    ? input.snapshot as Record<string, unknown>
    : input;
  const rawSources = Array.isArray(rawSnapshot.sources) ? rawSnapshot.sources : [];
  const sources = rawSources.flatMap((source): Array<{ url: string; title: string | null }> => {
    if (!source || typeof source !== "object") return [];
    const row = source as Record<string, unknown>;
    const url = normalizeCandidateUrl(row.url, "Vendor source URL");
    return url ? [{ url, title: cleanGuestText(row.title, "Vendor source title", 300) }] : [];
  }).slice(0, 5);

  if (vendorListingId) {
    if (!UUID.test(vendorListingId)) throw new WeddingBriefingError("The Zania vendor listing reference is invalid.", 400);
    const { data: listing, error } = await db.from("vendor_listings")
      .select("id,user_id,business_name,category,location,website,is_verified,updated_at")
      .eq("id", vendorListingId).eq("is_approved", true).eq("directory_opt_out", false).maybeSingle();
    if (error || !listing) throw new WeddingBriefingError("That approved Zania vendor listing is no longer available.", 404);
    const website = normalizeCandidateUrl(listing.website, "Vendor website");
    return {
      businessName: String(listing.business_name).trim().slice(0, 200),
      category: String(listing.category).trim().slice(0, 120),
      location: cleanGuestText(listing.location, "Vendor location", 200),
      website,
      vendorListingId,
      sourceKind: "zania_listing",
      sourceRecordId: vendorListingId,
      sourceUrl: website,
      profileStatus: listing.is_verified === true ? "verified" : listing.user_id ? "claimed" : "unclaimed",
      snapshot: {
        summary: cleanGuestText(rawSnapshot.summary, "Vendor summary", 800) ?? "",
        matchReasons: cleanCandidateList(rawSnapshot.matchReasons ?? rawSnapshot.match_reasons, 6, 240),
        unknowns: cleanCandidateList(rawSnapshot.unknowns, 8, 240),
        sources,
      },
    };
  }

  const businessName = cleanGuestText(input.businessName ?? input.business_name, "Vendor business name", 200);
  const category = cleanGuestText(input.category, "Vendor category", 120);
  if (!businessName || !category) throw new WeddingBriefingError("Choose one discovered vendor with a business name and category.", 400);
  const sourceUrl = normalizeCandidateUrl(input.sourceUrl ?? input.source_url ?? sources[0]?.url, "Vendor source URL");
  if (!sourceUrl) throw new WeddingBriefingError("A cited source URL is required to save an externally discovered vendor.", 400);
  if (sources.length && !sources.some((source) => source.url === sourceUrl)) {
    throw new WeddingBriefingError("The saved vendor source must match one of the discovery result's cited URLs.", 400);
  }
  const requestedKind = String(input.sourceKind ?? input.source_kind ?? "search_result");
  const sourceKind = requestedKind === "official_website" || requestedKind === "directory" || requestedKind === "social"
    ? requestedKind
    : "search_result";
  return {
    businessName,
    category,
    location: cleanGuestText(input.location, "Vendor location", 200),
    website: normalizeCandidateUrl(input.website, "Vendor website"),
    vendorListingId: null,
    sourceKind,
    sourceRecordId: cleanGuestText(input.sourceRecordId ?? input.source_record_id, "Vendor source record", 500) ?? sourceUrl,
    sourceUrl,
    profileStatus: "discovered",
    snapshot: {
      summary: cleanGuestText(rawSnapshot.summary, "Vendor summary", 800) ?? "",
      matchReasons: cleanCandidateList(rawSnapshot.matchReasons ?? rawSnapshot.match_reasons, 6, 240),
      unknowns: cleanCandidateList(rawSnapshot.unknowns, 8, 240),
      sources: sources.length ? sources : [{ url: sourceUrl, title: null }],
    },
  };
}

async function resolveCandidateScope(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  selectedClientId: string | null,
) {
  if (actor.role !== "couple" && actor.role !== "planner") {
    throw new WeddingBriefingError("Private vendor candidates are available to couples and planners.", 403);
  }
  if (actor.role === "planner" && actor.plannerType !== "committee") {
    if (!selectedClientId) return { wedding: null, plannerClientId: null };
    const wedding = await resolveBriefingWedding(db, actor, selectedClientId);
    return { wedding, plannerClientId: selectedClientId };
  }
  const wedding = await resolveBriefingWedding(db, actor, selectedClientId);
  return { wedding, plannerClientId: null };
}

export async function previewSaveVendorCandidate(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  selectedClientId: string | null,
  input: Record<string, unknown>,
  now = new Date(),
): Promise<SaveVendorCandidatePreview> {
  const candidate = await normalizeSaveVendorCandidateArguments(db, input);
  const scope = await resolveCandidateScope(db, actor, selectedClientId);
  const confirmationId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const { error } = await db.from("intelligence_gateway_confirmations").insert({
    id: confirmationId,
    user_id: actor.userId,
    wedding_id: scope.wedding?.id ?? null,
    selected_client_id: scope.plannerClientId,
    capability: "save_vendor_candidate",
    arguments: candidate,
    idempotency_key: idempotencyKey,
    status: "pending",
    expires_at: expiresAt,
  }).select("id").single();
  if (error) throw new WeddingBriefingError("Could not prepare this vendor candidate for confirmation. Please try again.", 503);
  return {
    ok: true,
    capability: "save_vendor_candidate",
    confirmationRequired: true,
    confirmationId,
    idempotencyKey,
    expiresAt,
    wedding: scope.wedding ? { id: scope.wedding.id, name: scope.wedding.name, weddingDate: scope.wedding.wedding_date } : null,
    plannerClientId: scope.plannerClientId,
    interpretedCandidate: candidate,
    userSummary: `Save “${candidate.businessName}” as a private vendor candidate${scope.wedding ? ` for ${scope.wedding.name}` : " in your planner workspace"}. This does not contact the vendor or publish a profile. Confirm this exact action before Zania continues.`,
  };
}

function toVendorCandidateReceipt(
  row: Record<string, unknown>,
  candidate: SaveVendorCandidateArguments,
  idempotencyKey: string,
): SaveVendorCandidateReceipt {
  return {
    ok: true,
    capability: "save_vendor_candidate",
    confirmationStatus: "confirmed",
    candidate: {
      ...candidate,
      id: String(row.id),
      weddingId: typeof row.wedding_id === "string" ? row.wedding_id : null,
      plannerClientId: typeof row.planner_client_id === "string" ? row.planner_client_id : null,
      candidateStatus: "saved",
    },
    receipt: { idempotencyKey, createdVia: "intelligence_gateway", path: "/vendor-candidates" },
    userSummary: `Saved “${candidate.businessName}” as a private vendor candidate. No vendor was contacted and no public profile was created.`,
  };
}

export async function executeConfirmedSaveVendorCandidate(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<SaveVendorCandidateReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) {
    throw new WeddingBriefingError("The vendor candidate confirmation is invalid. Preview it again.", 400);
  }
  const { data: confirmation, error } = await db.from("intelligence_gateway_confirmations")
    .select("id,wedding_id,selected_client_id,arguments,idempotency_key,status,expires_at,result_vendor_candidate_id")
    .eq("id", confirmationId).eq("user_id", actor.userId).eq("capability", "save_vendor_candidate").maybeSingle();
  if (error || !confirmation) throw new WeddingBriefingError("This vendor candidate confirmation was not found. Preview it again.", 404);
  if (String(confirmation.idempotency_key) !== idempotencyKey) {
    throw new WeddingBriefingError("The vendor candidate confirmation does not match this request.", 409);
  }
  const candidate = await normalizeSaveVendorCandidateArguments(db, confirmation.arguments as Record<string, unknown>);
  const columns = "id,wedding_id,planner_client_id,business_name,category,location,website,source_kind,source_record_id,source_url,vendor_listing_id,profile_status,candidate_status,snapshot,gateway_idempotency_key";
  if (confirmation.status === "executed" && confirmation.result_vendor_candidate_id) {
    const { data: existing, error: existingError } = await db.from("vendor_candidates").select(columns)
      .eq("id", confirmation.result_vendor_candidate_id).eq("owner_user_id", actor.userId).maybeSingle();
    if (existingError || !existing) throw new WeddingBriefingError("The vendor candidate receipt could not be restored.", 503);
    return toVendorCandidateReceipt(existing, candidate, idempotencyKey);
  }
  if (confirmation.status !== "pending") throw new WeddingBriefingError("This vendor candidate confirmation is no longer available. Preview it again.", 409);
  if (typeof confirmation.expires_at !== "string" || new Date(confirmation.expires_at).getTime() <= now.getTime()) {
    await db.from("intelligence_gateway_confirmations").update({ status: "expired" })
      .eq("id", confirmationId).eq("user_id", actor.userId).select("id").maybeSingle();
    throw new WeddingBriefingError("This vendor candidate confirmation expired. Preview it again.", 409);
  }
  const selectedClientId = typeof confirmation.selected_client_id === "string" ? confirmation.selected_client_id : null;
  const scope = await resolveCandidateScope(db, actor, selectedClientId);
  if ((scope.wedding?.id ?? null) !== (confirmation.wedding_id ?? null) || scope.plannerClientId !== selectedClientId) {
    throw new WeddingBriefingError("Workspace access changed after this vendor was previewed. Preview it again.", 409);
  }
  const values = {
    owner_user_id: actor.userId,
    wedding_id: scope.plannerClientId ? null : scope.wedding?.id ?? null,
    planner_client_id: scope.plannerClientId,
    vendor_listing_id: candidate.vendorListingId,
    source_kind: candidate.sourceKind,
    source_record_id: candidate.sourceRecordId,
    source_url: candidate.sourceUrl,
    business_name: candidate.businessName,
    category: candidate.category,
    location: candidate.location,
    website: candidate.website,
    profile_status: candidate.profileStatus,
    candidate_status: "saved",
    snapshot: candidate.snapshot,
    gateway_idempotency_key: idempotencyKey,
    created_via: "intelligence_gateway",
  };
  const { data: recorded, error: recordError } = await db.from("vendor_candidates")
    .upsert(values, { onConflict: "gateway_idempotency_key" }).select(columns).single();
  if (recordError || !recorded) throw new WeddingBriefingError("Could not save the vendor candidate. No public profile or enquiry was created.", 503);
  const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
    status: "executed", executed_at: now.toISOString(), result_vendor_candidate_id: recorded.id,
  }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
  if (receiptError) throw new WeddingBriefingError("The vendor was saved, but its receipt could not be finalized. Retry with the same confirmation.", 503);
  return toVendorCandidateReceipt(recorded, candidate, idempotencyKey);
}

export async function revokeSaveVendorCandidatePreview(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<RevokeCreateTaskReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) throw new WeddingBriefingError("The vendor candidate confirmation is invalid.", 400);
  const { data: confirmation, error } = await db.from("intelligence_gateway_confirmations")
    .select("id,idempotency_key,status,expires_at").eq("id", confirmationId).eq("user_id", actor.userId)
    .eq("capability", "save_vendor_candidate").maybeSingle();
  if (error || !confirmation) throw new WeddingBriefingError("This vendor candidate confirmation was not found.", 404);
  if (String(confirmation.idempotency_key) !== idempotencyKey) throw new WeddingBriefingError("The vendor candidate confirmation does not match this request.", 409);
  if (confirmation.status === "executed") throw new WeddingBriefingError("This vendor candidate was already saved and can no longer be cancelled.", 409);
  const expired = confirmation.status === "expired"
    || (typeof confirmation.expires_at === "string" && new Date(confirmation.expires_at).getTime() <= now.getTime());
  const nextStatus = expired ? "expired" as const : "revoked" as const;
  if (confirmation.status !== nextStatus) {
    const { error: updateError } = await db.from("intelligence_gateway_confirmations").update({ status: nextStatus })
      .eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
    if (updateError) throw new WeddingBriefingError("Could not cancel this vendor candidate confirmation. Please try again.", 503);
  }
  return {
    ok: true,
    capability: "save_vendor_candidate",
    confirmationStatus: nextStatus,
    confirmationId,
    idempotencyKey,
    userSummary: nextStatus === "expired"
      ? "No vendor candidate was saved. This confirmation had already expired."
      : "No vendor candidate was saved. The confirmation was cancelled.",
  };
}

function normalizeLookupName(value: unknown, label: string) {
  const cleaned = cleanGuestText(value, label, 200);
  return cleaned ? cleaned.toLocaleLowerCase().replace(/\s+/g, " ") : null;
}

async function resolveUnassignedVendorCandidate(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  input: Record<string, unknown>,
) {
  if (actor.role !== "planner" || actor.plannerType === "committee") {
    throw new WeddingBriefingError("Assigning private vendor candidates to clients is available to professional planners.", 403);
  }
  const candidateId = cleanGuestText(input.candidateId ?? input.candidate_id, "Vendor candidate ID", 36);
  if (candidateId && !UUID.test(candidateId)) throw new WeddingBriefingError("The vendor candidate reference is invalid.", 400);
  const candidateName = normalizeLookupName(input.candidateName ?? input.candidate_name ?? input.businessName ?? input.business_name, "Vendor candidate name");
  if (!candidateId && !candidateName) throw new WeddingBriefingError("Choose a saved vendor candidate to assign.", 400);
  const { data, error } = await db.from("vendor_candidates")
    .select("id,business_name,wedding_id,planner_client_id,candidate_status")
    .eq("owner_user_id", actor.userId);
  if (error) throw new WeddingBriefingError("Could not load your private vendor candidates. Please try again.", 503);
  const matches = (Array.isArray(data) ? data : []).filter((row) => (
    row.candidate_status !== "dismissed"
    && (candidateId ? row.id === candidateId : normalizeLookupName(row.business_name, "Vendor candidate name") === candidateName)
  ));
  if (matches.length === 0) throw new WeddingBriefingError("That private vendor candidate was not found in your planner workspace.", 404);
  if (matches.length > 1) throw new WeddingBriefingError("More than one saved vendor matches that name. Choose the exact candidate before continuing.", 409);
  const candidate = matches[0];
  if (candidate.wedding_id || candidate.planner_client_id) {
    throw new WeddingBriefingError("That vendor candidate is already assigned. Reassignment requires a separate reviewed action.", 409);
  }
  return candidate;
}

async function resolvePlannerClientForCandidate(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  input: Record<string, unknown>,
) {
  const clientId = cleanGuestText(input.clientId ?? input.client_id, "Planner client ID", 36);
  if (clientId && !UUID.test(clientId)) throw new WeddingBriefingError("The planner client reference is invalid.", 400);
  const requestedName = normalizeLookupName(input.clientName ?? input.client_name, "Planner client name");
  if (!clientId && !requestedName) throw new WeddingBriefingError("Choose the planner client who should receive this candidate.", 400);
  const { data, error } = await db.from("planner_clients")
    .select("id,planner_user_id,client_name,partner_name,wedding_id,is_archived")
    .eq("planner_user_id", actor.userId)
    .eq("is_archived", false);
  if (error) throw new WeddingBriefingError("Could not load your planner clients. Please try again.", 503);
  const matches = (Array.isArray(data) ? data : []).filter((row) => {
    if (clientId) return row.id === clientId;
    const names = [row.client_name, row.partner_name]
      .map((value) => normalizeLookupName(value, "Planner client name"))
      .filter(Boolean);
    const joined = normalizeLookupName(`${String(row.client_name ?? "")} ${String(row.partner_name ?? "")}`, "Planner client name");
    return names.includes(requestedName) || joined === requestedName;
  });
  if (matches.length === 0) throw new WeddingBriefingError("That active client was not found in your planner workspace.", 404);
  if (matches.length > 1) throw new WeddingBriefingError("More than one active client matches that name. Choose the exact client before continuing.", 409);
  return matches[0];
}

export async function previewAssignVendorCandidate(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  input: Record<string, unknown>,
  now = new Date(),
): Promise<AssignVendorCandidatePreview> {
  const candidate = await resolveUnassignedVendorCandidate(db, actor, input);
  const client = await resolvePlannerClientForCandidate(db, actor, input);
  const interpretedAssignment: AssignVendorCandidateArguments = {
    candidateId: String(candidate.id),
    candidateName: String(candidate.business_name),
    clientId: String(client.id),
    clientName: [client.client_name, client.partner_name].filter(Boolean).join(" & "),
  };
  const confirmationId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const { error } = await db.from("intelligence_gateway_confirmations").insert({
    id: confirmationId,
    user_id: actor.userId,
    wedding_id: null,
    selected_client_id: interpretedAssignment.clientId,
    capability: "assign_vendor_candidate",
    arguments: interpretedAssignment,
    idempotency_key: idempotencyKey,
    status: "pending",
    expires_at: expiresAt,
  }).select("id").single();
  if (error) throw new WeddingBriefingError("Could not prepare this candidate assignment for confirmation. Please try again.", 503);
  return {
    ok: true,
    capability: "assign_vendor_candidate",
    confirmationRequired: true,
    confirmationId,
    idempotencyKey,
    expiresAt,
    wedding: null,
    interpretedAssignment,
    userSummary: `Assign “${interpretedAssignment.candidateName}” to ${interpretedAssignment.clientName} as a private candidate. This does not add it to the vendor tracker, contact the vendor, or create a booking. Confirm this exact action before Zania continues.`,
  };
}

function toAssignVendorCandidateReceipt(assignment: AssignVendorCandidateArguments, idempotencyKey: string): AssignVendorCandidateReceipt {
  return {
    ok: true,
    capability: "assign_vendor_candidate",
    confirmationStatus: "confirmed",
    assignment,
    receipt: { idempotencyKey, createdVia: "intelligence_gateway", path: "/vendor-candidates" },
    userSummary: `Assigned “${assignment.candidateName}” to ${assignment.clientName} as a private candidate. The vendor tracker, booking state, and vendor contact were not changed.`,
  };
}

export async function executeConfirmedAssignVendorCandidate(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<AssignVendorCandidateReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) throw new WeddingBriefingError("The candidate assignment confirmation is invalid. Preview it again.", 400);
  if (actor.role !== "planner" || actor.plannerType === "committee") throw new WeddingBriefingError("Assigning private vendor candidates to clients is available to professional planners.", 403);
  const { data: confirmation, error } = await db.from("intelligence_gateway_confirmations")
    .select("id,selected_client_id,arguments,idempotency_key,status,expires_at,result_vendor_candidate_id")
    .eq("id", confirmationId).eq("user_id", actor.userId).eq("capability", "assign_vendor_candidate").maybeSingle();
  if (error || !confirmation) throw new WeddingBriefingError("This candidate assignment confirmation was not found. Preview it again.", 404);
  if (String(confirmation.idempotency_key) !== idempotencyKey) throw new WeddingBriefingError("The candidate assignment confirmation does not match this request.", 409);
  const assignment = confirmation.arguments as AssignVendorCandidateArguments;
  if (!assignment || !UUID.test(assignment.candidateId) || !UUID.test(assignment.clientId)) throw new WeddingBriefingError("The saved candidate assignment is invalid. Preview it again.", 409);
  if (confirmation.status === "executed") return toAssignVendorCandidateReceipt(assignment, idempotencyKey);
  if (confirmation.status !== "pending") throw new WeddingBriefingError("This candidate assignment confirmation is no longer available. Preview it again.", 409);
  if (typeof confirmation.expires_at !== "string" || new Date(confirmation.expires_at).getTime() <= now.getTime()) {
    await db.from("intelligence_gateway_confirmations").update({ status: "expired" }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").maybeSingle();
    throw new WeddingBriefingError("This candidate assignment confirmation expired. Preview it again.", 409);
  }
  const { data: client, error: clientError } = await db.from("planner_clients")
    .select("id,planner_user_id,is_archived").eq("id", assignment.clientId).eq("planner_user_id", actor.userId).eq("is_archived", false).maybeSingle();
  if (clientError || !client) throw new WeddingBriefingError("Access to that planner client changed after preview. Preview it again.", 409);
  const { data: candidate, error: candidateError } = await db.from("vendor_candidates")
    .select("id,owner_user_id,wedding_id,planner_client_id,candidate_status").eq("id", assignment.candidateId).eq("owner_user_id", actor.userId).maybeSingle();
  if (candidateError || !candidate || candidate.candidate_status === "dismissed") throw new WeddingBriefingError("Access to that private vendor candidate changed after preview. Preview it again.", 409);
  const alreadyAssigned = candidate.planner_client_id === assignment.clientId && !candidate.wedding_id;
  if (!alreadyAssigned && (candidate.planner_client_id || candidate.wedding_id)) throw new WeddingBriefingError("That vendor candidate was assigned elsewhere after preview. No change was made.", 409);
  if (!alreadyAssigned) {
    const { data: updated, error: updateError } = await db.from("vendor_candidates")
      .update({ planner_client_id: assignment.clientId, wedding_id: null })
      .eq("id", assignment.candidateId).eq("owner_user_id", actor.userId).select("id").single();
    if (updateError || !updated) throw new WeddingBriefingError("Could not assign this private vendor candidate. No booking or vendor contact was created.", 503);
  }
  const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
    status: "executed", executed_at: now.toISOString(), result_vendor_candidate_id: assignment.candidateId,
  }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
  if (receiptError) throw new WeddingBriefingError("The candidate was assigned, but its receipt could not be finalized. Retry with the same confirmation.", 503);
  return toAssignVendorCandidateReceipt(assignment, idempotencyKey);
}

export async function revokeAssignVendorCandidatePreview(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<RevokeCreateTaskReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) throw new WeddingBriefingError("The candidate assignment confirmation is invalid.", 400);
  const { data: confirmation, error } = await db.from("intelligence_gateway_confirmations")
    .select("id,idempotency_key,status,expires_at").eq("id", confirmationId).eq("user_id", actor.userId)
    .eq("capability", "assign_vendor_candidate").maybeSingle();
  if (error || !confirmation) throw new WeddingBriefingError("This candidate assignment confirmation was not found.", 404);
  if (String(confirmation.idempotency_key) !== idempotencyKey) throw new WeddingBriefingError("The candidate assignment confirmation does not match this request.", 409);
  if (confirmation.status === "executed") throw new WeddingBriefingError("This vendor candidate was already assigned and can no longer be cancelled.", 409);
  const expired = confirmation.status === "expired" || (typeof confirmation.expires_at === "string" && new Date(confirmation.expires_at).getTime() <= now.getTime());
  const nextStatus = expired ? "expired" as const : "revoked" as const;
  if (confirmation.status !== nextStatus) {
    const { error: updateError } = await db.from("intelligence_gateway_confirmations").update({ status: nextStatus })
      .eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
    if (updateError) throw new WeddingBriefingError("Could not cancel this candidate assignment. Please try again.", 503);
  }
  return {
    ok: true,
    capability: "assign_vendor_candidate",
    confirmationStatus: nextStatus,
    confirmationId,
    idempotencyKey,
    userSummary: nextStatus === "expired"
      ? "No vendor candidate was assigned. This confirmation had already expired."
      : "No vendor candidate was assigned. The confirmation was cancelled.",
  };
}

function normalizePromoteVendorCandidateInput(input: Record<string, unknown>) {
  const candidateId = cleanGuestText(input.candidateId ?? input.candidate_id, "Vendor candidate ID", 36);
  if (candidateId && !UUID.test(candidateId)) throw new WeddingBriefingError("The vendor candidate reference is invalid.", 400);
  const candidateName = normalizeLookupName(input.candidateName ?? input.candidate_name ?? input.businessName ?? input.business_name, "Vendor candidate name");
  if (!candidateId && !candidateName) throw new WeddingBriefingError("Choose a saved vendor candidate to add to the tracker.", 400);
  const rawQuote = input.quoteAmount ?? input.quote_amount ?? input.price;
  const quoteAmount = rawQuote === undefined || rawQuote === null || rawQuote === "" ? null : Number(rawQuote);
  if (quoteAmount !== null && (!Number.isFinite(quoteAmount) || quoteAmount < 0 || quoteAmount > 1_000_000_000)) {
    throw new WeddingBriefingError("The quoted amount must be between KES 0 and KES 1,000,000,000.", 400);
  }
  const requestedStatus = String(input.selectionStatus ?? input.selection_status ?? "shortlisted");
  if (requestedStatus !== "shortlisted" && requestedStatus !== "backup") {
    throw new WeddingBriefingError("A newly promoted candidate can be shortlisted or marked as a backup. Confirming a final vendor is a separate action.", 400);
  }
  return { candidateId, candidateName, quoteAmount, selectionStatus: requestedStatus as "shortlisted" | "backup" };
}

async function resolveCandidatePromotionScope(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  input: Record<string, unknown>,
) {
  if (actor.role !== "couple" && (actor.role !== "planner" || actor.plannerType === "committee")) {
    throw new WeddingBriefingError("Adding private vendor candidates to a tracker is available to couples and professional planners.", 403);
  }
  const normalized = normalizePromoteVendorCandidateInput(input);
  const { data, error } = await db.from("vendor_candidates")
    .select("id,business_name,category,vendor_listing_id,wedding_id,planner_client_id,candidate_status")
    .eq("owner_user_id", actor.userId);
  if (error) throw new WeddingBriefingError("Could not load your private vendor candidates. Please try again.", 503);
  const matches = (Array.isArray(data) ? data : []).filter((row) => (
    row.candidate_status !== "dismissed"
    && (normalized.candidateId
      ? row.id === normalized.candidateId
      : normalizeLookupName(row.business_name, "Vendor candidate name") === normalized.candidateName)
  ));
  if (matches.length === 0) throw new WeddingBriefingError("That private vendor candidate was not found in your workspace.", 404);
  if (matches.length > 1) throw new WeddingBriefingError("More than one saved vendor matches that name. Choose the exact candidate before continuing.", 409);
  const candidate = matches[0];
  const selectedClientId = typeof candidate.planner_client_id === "string" ? candidate.planner_client_id : null;
  if (actor.role === "planner" && !selectedClientId) {
    throw new WeddingBriefingError("Assign this private candidate to a planner client before adding it to the vendor tracker.", 409);
  }
  if (actor.role === "couple" && selectedClientId) {
    throw new WeddingBriefingError("This candidate belongs to a planner client and cannot be promoted from a couple workspace.", 403);
  }
  const wedding = await resolveBriefingWedding(db, actor, selectedClientId);
  if (actor.role === "couple" && candidate.wedding_id !== wedding.id) {
    throw new WeddingBriefingError("This candidate is no longer attached to your active wedding.", 409);
  }
  if (typeof candidate.wedding_id === "string" && candidate.wedding_id !== wedding.id) {
    throw new WeddingBriefingError("This candidate is no longer attached to the active wedding.", 409);
  }
  const { data: existing, error: existingError } = await db.from("vendors")
    .select("id").eq("source_vendor_candidate_id", candidate.id).maybeSingle();
  if (existingError) throw new WeddingBriefingError("Could not check the vendor tracker. Please try again.", 503);
  if (existing) throw new WeddingBriefingError("This private candidate is already in the vendor tracker.", 409);
  const delivery = await resolvePlannerApprovalDelivery(db, actor, selectedClientId, wedding.id);
  const promotion: PromoteVendorCandidateArguments = {
    candidateId: String(candidate.id),
    candidateName: String(candidate.business_name),
    category: String(candidate.category),
    quoteAmount: normalized.quoteAmount,
    selectionStatus: normalized.selectionStatus,
    clientId: selectedClientId,
    weddingId: wedding.id,
    weddingName: wedding.name,
    vendorListingId: typeof candidate.vendor_listing_id === "string" ? candidate.vendor_listing_id : null,
  };
  return { candidate, wedding, delivery, promotion };
}

function promotionSummary(promotion: PromoteVendorCandidateArguments, outcome: PromoteVendorCandidatePreview["outcome"]) {
  const quote = promotion.quoteAmount === null
    ? "with no quote recorded"
    : `with a KES ${promotion.quoteAmount.toLocaleString("en-KE")} quote`;
  const state = promotion.selectionStatus === "backup" ? "backup" : "shortlist";
  return outcome === "approval_requested"
    ? `Send a request to add “${promotion.candidateName}” to ${promotion.weddingName}'s ${state} in ${promotion.category}, ${quote}. This does not contact the vendor or confirm a booking.`
    : `Add “${promotion.candidateName}” to ${promotion.weddingName}'s vendor tracker as ${state} in ${promotion.category}, ${quote}. This does not contact the vendor or confirm a booking.`;
}

export async function previewPromoteVendorCandidate(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  input: Record<string, unknown>,
  now = new Date(),
): Promise<PromoteVendorCandidatePreview> {
  const resolved = await resolveCandidatePromotionScope(db, actor, input);
  const confirmationId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const storedArguments = {
    promotion: resolved.promotion,
    outcome: resolved.delivery.outcome,
    coupleUserId: resolved.delivery.coupleUserId,
  };
  const { error } = await db.from("intelligence_gateway_confirmations").insert({
    id: confirmationId,
    user_id: actor.userId,
    wedding_id: resolved.wedding.id,
    selected_client_id: resolved.promotion.clientId,
    capability: "promote_vendor_candidate",
    arguments: storedArguments,
    idempotency_key: idempotencyKey,
    status: "pending",
    expires_at: expiresAt,
  }).select("id").single();
  if (error) throw new WeddingBriefingError("Could not prepare this vendor tracker action for confirmation. Please try again.", 503);
  return {
    ok: true,
    capability: "promote_vendor_candidate",
    confirmationRequired: true,
    confirmationId,
    idempotencyKey,
    expiresAt,
    wedding: { id: resolved.wedding.id, name: resolved.wedding.name, weddingDate: resolved.wedding.wedding_date },
    interpretedPromotion: resolved.promotion,
    outcome: resolved.delivery.outcome,
    userSummary: `${promotionSummary(resolved.promotion, resolved.delivery.outcome)} Confirm this exact action before Zania continues.`,
  };
}

function toPromoteVendorCandidateReceipt(
  id: string,
  promotion: PromoteVendorCandidateArguments,
  outcome: PromoteVendorCandidateReceipt["outcome"],
  idempotencyKey: string,
): PromoteVendorCandidateReceipt {
  return {
    ok: true,
    capability: "promote_vendor_candidate",
    confirmationStatus: "confirmed",
    outcome,
    vendor: { ...promotion, id, status: outcome === "created" ? "tracker_added" : "approval_pending" },
    receipt: { idempotencyKey, createdVia: "intelligence_gateway", path: "/vendors" },
    userSummary: outcome === "created"
      ? `Added “${promotion.candidateName}” to the vendor tracker as ${promotion.selectionStatus}. No vendor was contacted and no booking was confirmed.`
      : `Sent “${promotion.candidateName}” to the couple for approval before it is added to the vendor tracker. No vendor was contacted and no booking was confirmed.`,
  };
}

function vendorPromotionValues(promotion: PromoteVendorCandidateArguments, idempotencyKey: string) {
  return {
    wedding_id: promotion.weddingId,
    client_id: promotion.clientId,
    name: promotion.candidateName,
    category: promotion.category,
    price: promotion.quoteAmount,
    status: null,
    selection_status: promotion.selectionStatus,
    vendor_listing_id: promotion.vendorListingId,
    source_vendor_candidate_id: promotion.candidateId,
    gateway_idempotency_key: idempotencyKey,
    created_via: "intelligence_gateway",
  };
}

export async function executeConfirmedPromoteVendorCandidate(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<PromoteVendorCandidateReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) throw new WeddingBriefingError("The vendor tracker confirmation is invalid. Preview it again.", 400);
  const { data: confirmation, error } = await db.from("intelligence_gateway_confirmations")
    .select("id,wedding_id,selected_client_id,arguments,idempotency_key,status,expires_at,result_vendor_id,result_change_request_id")
    .eq("id", confirmationId).eq("user_id", actor.userId).eq("capability", "promote_vendor_candidate").maybeSingle();
  if (error || !confirmation) throw new WeddingBriefingError("This vendor tracker confirmation was not found. Preview it again.", 404);
  if (String(confirmation.idempotency_key) !== idempotencyKey) throw new WeddingBriefingError("The vendor tracker confirmation does not match this request.", 409);
  const stored = confirmation.arguments as Record<string, unknown>;
  const promotion = stored.promotion as PromoteVendorCandidateArguments;
  const outcome = stored.outcome === "approval_requested" ? "approval_requested" as const : "created" as const;
  if (!promotion || !UUID.test(promotion.candidateId) || !UUID.test(promotion.weddingId)) throw new WeddingBriefingError("The saved vendor tracker action is invalid. Preview it again.", 409);
  if (confirmation.status === "executed") {
    const resultId = typeof confirmation.result_vendor_id === "string"
      ? confirmation.result_vendor_id
      : typeof confirmation.result_change_request_id === "string" ? confirmation.result_change_request_id : null;
    if (!resultId) throw new WeddingBriefingError("The vendor tracker receipt could not be restored.", 503);
    return toPromoteVendorCandidateReceipt(resultId, promotion, outcome, idempotencyKey);
  }
  if (confirmation.status !== "pending") throw new WeddingBriefingError("This vendor tracker confirmation is no longer available. Preview it again.", 409);
  if (typeof confirmation.expires_at !== "string" || new Date(confirmation.expires_at).getTime() <= now.getTime()) {
    await db.from("intelligence_gateway_confirmations").update({ status: "expired" }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").maybeSingle();
    throw new WeddingBriefingError("This vendor tracker confirmation expired. Preview it again.", 409);
  }
  if (outcome === "created") {
    const { data: existingVendor, error: existingVendorError } = await db.from("vendors")
      .select("id").eq("gateway_idempotency_key", idempotencyKey).maybeSingle();
    if (existingVendorError) throw new WeddingBriefingError("Could not restore the vendor tracker action. Please try again.", 503);
    if (existingVendor) {
      const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
        status: "executed", executed_at: now.toISOString(), result_vendor_id: existingVendor.id,
      }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
      if (receiptError) throw new WeddingBriefingError("The vendor is in the tracker, but its receipt could not be finalized. Retry with the same confirmation.", 503);
      return toPromoteVendorCandidateReceipt(String(existingVendor.id), promotion, outcome, idempotencyKey);
    }
  }
  const resolved = await resolveCandidatePromotionScope(db, actor, {
    candidateId: promotion.candidateId,
    quoteAmount: promotion.quoteAmount,
    selectionStatus: promotion.selectionStatus,
  });
  if (resolved.promotion.weddingId !== promotion.weddingId
    || resolved.promotion.clientId !== promotion.clientId
    || resolved.promotion.candidateName !== promotion.candidateName
    || resolved.promotion.category !== promotion.category
    || resolved.delivery.outcome !== outcome
    || resolved.delivery.coupleUserId !== (stored.coupleUserId ?? null)) {
    throw new WeddingBriefingError("Candidate or workspace access changed after preview. Preview the action again.", 409);
  }
  const values = vendorPromotionValues(promotion, idempotencyKey);
  if (outcome === "approval_requested") {
    const { data: request, error: requestError } = await db.from("planner_change_requests").upsert({
      client_id: promotion.clientId,
      couple_user_id: stored.coupleUserId,
      planner_user_id: actor.userId,
      target_table: "vendors",
      change_type: "create",
      target_id: null,
      current_payload: null,
      proposed_payload: values,
      note: "Prepared and confirmed through Zania's conversational planner from a private vendor candidate.",
      gateway_idempotency_key: idempotencyKey,
    }, { onConflict: "gateway_idempotency_key" }).select("id,status").single();
    if (requestError || !request) throw new WeddingBriefingError("Could not send the vendor tracker request. No tracker row or vendor contact was created.", 503);
    const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
      status: "executed", executed_at: now.toISOString(), result_change_request_id: request.id,
    }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
    if (receiptError) throw new WeddingBriefingError("The request was sent, but its receipt could not be finalized. Retry with the same confirmation.", 503);
    return toPromoteVendorCandidateReceipt(String(request.id), promotion, outcome, idempotencyKey);
  }
  const { data: vendor, error: vendorError } = await db.from("vendors")
    .upsert({ user_id: actor.userId, ...values }, { onConflict: "gateway_idempotency_key" })
    .select("id").single();
  if (vendorError || !vendor) throw new WeddingBriefingError("Could not add this candidate to the vendor tracker. No vendor was contacted and no booking was created.", 503);
  await db.from("vendor_candidates").update({ candidate_status: "shortlisted" })
    .eq("id", promotion.candidateId).eq("owner_user_id", actor.userId).select("id").maybeSingle();
  const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
    status: "executed", executed_at: now.toISOString(), result_vendor_id: vendor.id,
  }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
  if (receiptError) throw new WeddingBriefingError("The vendor was added to the tracker, but its receipt could not be finalized. Retry with the same confirmation.", 503);
  return toPromoteVendorCandidateReceipt(String(vendor.id), promotion, outcome, idempotencyKey);
}

export async function revokePromoteVendorCandidatePreview(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<RevokeCreateTaskReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) throw new WeddingBriefingError("The vendor tracker confirmation is invalid.", 400);
  const { data: confirmation, error } = await db.from("intelligence_gateway_confirmations")
    .select("id,idempotency_key,status,expires_at").eq("id", confirmationId).eq("user_id", actor.userId)
    .eq("capability", "promote_vendor_candidate").maybeSingle();
  if (error || !confirmation) throw new WeddingBriefingError("This vendor tracker confirmation was not found.", 404);
  if (String(confirmation.idempotency_key) !== idempotencyKey) throw new WeddingBriefingError("The vendor tracker confirmation does not match this request.", 409);
  if (confirmation.status === "executed") throw new WeddingBriefingError("This vendor tracker action was already completed and can no longer be cancelled.", 409);
  const expired = confirmation.status === "expired" || (typeof confirmation.expires_at === "string" && new Date(confirmation.expires_at).getTime() <= now.getTime());
  const nextStatus = expired ? "expired" as const : "revoked" as const;
  if (confirmation.status !== nextStatus) {
    const { error: updateError } = await db.from("intelligence_gateway_confirmations").update({ status: nextStatus })
      .eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
    if (updateError) throw new WeddingBriefingError("Could not cancel this vendor tracker action. Please try again.", 503);
  }
  return {
    ok: true,
    capability: "promote_vendor_candidate",
    confirmationStatus: nextStatus,
    confirmationId,
    idempotencyKey,
    userSummary: nextStatus === "expired"
      ? "No vendor was added to the tracker. This confirmation had already expired."
      : "No vendor was added to the tracker. The confirmation was cancelled.",
  };
}

function normalizeVendorEnquiryInput(input: Record<string, unknown>) {
  const vendorId = cleanGuestText(input.vendorId ?? input.vendor_id, "Vendor ID", 36);
  if (vendorId && !UUID.test(vendorId)) throw new WeddingBriefingError("The vendor reference is invalid.", 400);
  const vendorName = normalizeLookupName(input.vendorName ?? input.vendor_name ?? input.businessName ?? input.business_name, "Vendor name");
  if (!vendorId && !vendorName) throw new WeddingBriefingError("Choose a vendor from the wedding tracker.", 400);
  const recipientEmail = cleanGuestText(input.recipientEmail ?? input.recipient_email, "Recipient email", 254)?.toLowerCase() ?? null;
  if (recipientEmail && !EMAIL.test(recipientEmail)) throw new WeddingBriefingError("Use a valid vendor recipient email address.", 400);
  const recipientName = cleanGuestText(input.recipientName ?? input.recipient_name, "Recipient name", 160);
  const subject = cleanGuestText(input.subject, "Enquiry subject", 160);
  const rawMessage = input.message;
  if (typeof rawMessage !== "string" || !rawMessage.trim()) throw new WeddingBriefingError("Add the exact enquiry message before continuing.", 400);
  const message = rawMessage.trim().replace(/\r\n?/g, "\n");
  if (message.length > 3000) throw new WeddingBriefingError("The enquiry message must be 3000 characters or fewer.", 400);
  return { vendorId, vendorName, recipientEmail, recipientName, subject, message };
}

async function resolveVendorEnquiryScope(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  selectedClientId: string | null,
  input: Record<string, unknown>,
) {
  if (actor.role !== "couple" && (actor.role !== "planner" || actor.plannerType === "committee")) {
    throw new WeddingBriefingError("Vendor enquiries are available to couples and professional planners.", 403);
  }
  const normalized = normalizeVendorEnquiryInput(input);
  const wedding = await resolveBriefingWedding(db, actor, selectedClientId);
  const plannerDelivery = await resolvePlannerApprovalDelivery(db, actor, selectedClientId, wedding.id);

  const { data, error } = await db.from("vendors")
    .select("id,name,email,vendor_listing_id,wedding_id,client_id").eq("wedding_id", wedding.id);
  if (error) throw new WeddingBriefingError("Could not load the wedding vendor tracker. Please try again.", 503);
  const matches = (Array.isArray(data) ? data : []).filter((row) => (
    (!selectedClientId || row.client_id === selectedClientId)
    && (normalized.vendorId
      ? row.id === normalized.vendorId
      : normalizeLookupName(row.name, "Vendor name") === normalized.vendorName)
  ));
  if (matches.length === 0) throw new WeddingBriefingError("That vendor was not found in the active wedding tracker. Add the candidate to the tracker first.", 404);
  if (matches.length > 1) throw new WeddingBriefingError("More than one tracker vendor matches that name. Choose the exact vendor before continuing.", 409);
  const vendor = matches[0];

  let recipientEmail = normalized.recipientEmail;
  let recipientSource: SendVendorEnquiryArguments["recipientSource"] = "explicit";
  if (!recipientEmail && typeof vendor.email === "string" && vendor.email.trim()) {
    recipientEmail = vendor.email.trim().toLowerCase();
    recipientSource = "tracker";
  }
  if (!recipientEmail && typeof vendor.vendor_listing_id === "string") {
    const { data: listing, error: listingError } = await db.from("vendor_listings")
      .select("id,business_name,email,is_approved,directory_opt_out")
      .eq("id", vendor.vendor_listing_id).maybeSingle();
    if (listingError) throw new WeddingBriefingError("Could not verify the vendor's Zania contact. Please try again.", 503);
    if (listing && listing.is_approved === true && listing.directory_opt_out !== true && typeof listing.email === "string" && listing.email.trim()) {
      recipientEmail = listing.email.trim().toLowerCase();
      recipientSource = "zania_listing";
    }
  }
  if (!recipientEmail || !EMAIL.test(recipientEmail)) {
    throw new WeddingBriefingError("This tracker vendor does not have a verified email address. Add the exact recipient email before preparing an enquiry; Zania will not infer it from research results or a website.", 400);
  }

  const { data: profile, error: profileError } = await db.from("profiles")
    .select("full_name,company_name").eq("user_id", actor.userId).maybeSingle();
  if (profileError) throw new WeddingBriefingError("Could not verify the enquiry sender. Please try again.", 503);
  const senderName = actor.role === "planner"
    ? cleanGuestText(profile?.company_name, "Sender name", 160) ?? cleanGuestText(profile?.full_name, "Sender name", 160)
    : cleanGuestText(profile?.full_name, "Sender name", 160);
  if (!senderName) throw new WeddingBriefingError("Add your name to your Zania profile before sending a vendor enquiry.", 400);

  const recipientName = normalized.recipientName ?? String(vendor.name);
  const subject = normalized.subject ?? `Enquiry from ${senderName} via Zania`;
  const enquiry: SendVendorEnquiryArguments = {
    vendorId: String(vendor.id),
    vendorName: String(vendor.name),
    vendorListingId: typeof vendor.vendor_listing_id === "string" ? vendor.vendor_listing_id : null,
    weddingId: wedding.id,
    weddingName: wedding.name,
    clientId: selectedClientId,
    recipientName,
    recipientEmail,
    recipientSource,
    senderName,
    subject,
    message: normalized.message,
  };
  return { wedding, enquiry, delivery: plannerDelivery };
}

export async function previewSendVendorEnquiry(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  selectedClientId: string | null,
  input: Record<string, unknown>,
  now = new Date(),
): Promise<SendVendorEnquiryPreview> {
  const resolved = await resolveVendorEnquiryScope(db, actor, selectedClientId, input);
  const confirmationId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const { error } = await db.from("intelligence_gateway_confirmations").insert({
    id: confirmationId,
    user_id: actor.userId,
    wedding_id: resolved.wedding.id,
    selected_client_id: selectedClientId,
    capability: "send_vendor_enquiry",
    arguments: {
      enquiry: resolved.enquiry,
      outcome: resolved.delivery.outcome === "approval_requested" ? "approval_requested" : "send_after_confirmation",
      coupleUserId: resolved.delivery.coupleUserId,
    },
    idempotency_key: idempotencyKey,
    status: "pending",
    expires_at: expiresAt,
  }).select("id").single();
  if (error) throw new WeddingBriefingError("Could not prepare this vendor enquiry for confirmation. No email was sent.", 503);
  return {
    ok: true,
    capability: "send_vendor_enquiry",
    confirmationRequired: true,
    confirmationId,
    idempotencyKey,
    expiresAt,
    wedding: { id: resolved.wedding.id, name: resolved.wedding.name, weddingDate: resolved.wedding.wedding_date },
    interpretedEnquiry: resolved.enquiry,
    outcome: resolved.delivery.outcome === "approval_requested" ? "approval_requested" : "send_after_confirmation",
    userSummary: resolved.delivery.outcome === "approval_requested"
      ? `Ask the couple to approve an email enquiry to ${resolved.enquiry.recipientName} at ${resolved.enquiry.recipientEmail}. Subject: “${resolved.enquiry.subject}”. Message: “${resolved.enquiry.message}”. No email will be sent until the couple approves this exact recipient and message. This does not create a booking, accept a quote, or invite the vendor into the workspace. Confirm that you want to submit this approval request.`
      : `Send an email enquiry to ${resolved.enquiry.recipientName} at ${resolved.enquiry.recipientEmail}. Subject: “${resolved.enquiry.subject}”. Message: “${resolved.enquiry.message}”. This sends an external email, but does not create a booking, accept a quote, or invite the vendor into the workspace. Confirm this exact recipient and message before Zania sends it.`,
  };
}

function toVendorEnquiryReceipt(
  row: Record<string, unknown>,
  enquiry: SendVendorEnquiryArguments,
  idempotencyKey: string,
): SendVendorEnquiryReceipt {
  const sent = row.delivery_status === "sent";
  return {
    ok: true,
    capability: "send_vendor_enquiry",
    confirmationStatus: "confirmed",
    outcome: sent ? "sent" : "failed",
    deliveryStatus: sent ? "sent" : "failed",
    enquiry: {
      ...enquiry,
      id: String(row.id),
      provider: "resend",
      providerMessageId: typeof row.provider_message_id === "string" ? row.provider_message_id : null,
      sentAt: typeof row.sent_at === "string" ? row.sent_at : null,
    },
    receipt: { idempotencyKey, createdVia: "intelligence_gateway", path: "/vendors" },
    userSummary: sent
      ? `Sent the reviewed enquiry to ${enquiry.vendorName} at ${enquiry.recipientEmail}. This is still an enquiry; no booking or quote was confirmed.`
      : `The reviewed enquiry to ${enquiry.vendorName} was not accepted by the email provider. It was recorded as failed and will not retry automatically. No booking or quote was created.`,
  };
}

function toVendorEnquiryApprovalReceipt(
  requestId: string,
  enquiry: SendVendorEnquiryArguments,
  idempotencyKey: string,
): SendVendorEnquiryReceipt {
  return {
    ok: true,
    capability: "send_vendor_enquiry",
    confirmationStatus: "confirmed",
    outcome: "approval_requested",
    deliveryStatus: "pending_approval",
    enquiry: { ...enquiry, id: requestId, provider: null, providerMessageId: null, sentAt: null },
    receipt: { idempotencyKey, createdVia: "intelligence_gateway", path: "/vendors" },
    userSummary: `Sent the exact ${enquiry.vendorName} enquiry to the couple for approval. No email has been sent to the vendor yet, and no booking or quote was created.`,
  };
}

export async function executeConfirmedSendVendorEnquiry(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  deliver: VendorEnquiryDelivery,
  now = new Date(),
): Promise<SendVendorEnquiryReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) throw new WeddingBriefingError("The vendor enquiry confirmation is invalid. Preview it again.", 400);
  const { data: confirmation, error } = await db.from("intelligence_gateway_confirmations")
    .select("id,wedding_id,selected_client_id,arguments,idempotency_key,status,expires_at,result_vendor_enquiry_id,result_change_request_id")
    .eq("id", confirmationId).eq("user_id", actor.userId).eq("capability", "send_vendor_enquiry").maybeSingle();
  if (error || !confirmation) throw new WeddingBriefingError("This vendor enquiry confirmation was not found. Preview it again.", 404);
  if (String(confirmation.idempotency_key) !== idempotencyKey) throw new WeddingBriefingError("The vendor enquiry confirmation does not match this request.", 409);
  const stored = confirmation.arguments as Record<string, unknown>;
  const enquiry = stored.enquiry as SendVendorEnquiryArguments;
  const outcome = stored.outcome === "approval_requested" ? "approval_requested" as const : "send_after_confirmation" as const;
  if (!enquiry || !UUID.test(enquiry.vendorId) || !UUID.test(enquiry.weddingId)) throw new WeddingBriefingError("The saved vendor enquiry is invalid. Preview it again.", 409);
  if (confirmation.status === "executed") {
    if (outcome === "approval_requested" && typeof confirmation.result_change_request_id === "string") {
      return toVendorEnquiryApprovalReceipt(confirmation.result_change_request_id, enquiry, idempotencyKey);
    }
    const { data: existing, error: existingError } = await db.from("vendor_enquiries")
    .select("id,delivery_status,provider_message_id,sent_at,response_token").eq("gateway_idempotency_key", idempotencyKey).maybeSingle();
    if (existingError || !existing) throw new WeddingBriefingError("The vendor enquiry receipt could not be restored.", 503);
    return toVendorEnquiryReceipt(existing, enquiry, idempotencyKey);
  }
  if (confirmation.status !== "pending") throw new WeddingBriefingError("This vendor enquiry confirmation is no longer available. Preview it again.", 409);
  if (typeof confirmation.expires_at !== "string" || new Date(confirmation.expires_at).getTime() <= now.getTime()) {
    await db.from("intelligence_gateway_confirmations").update({ status: "expired" }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").maybeSingle();
    throw new WeddingBriefingError("This vendor enquiry confirmation expired. Preview it again.", 409);
  }

  const selectedClientId = typeof confirmation.selected_client_id === "string" ? confirmation.selected_client_id : null;
  const resolved = await resolveVendorEnquiryScope(db, actor, selectedClientId, {
    vendorId: enquiry.vendorId,
    recipientEmail: enquiry.recipientSource === "explicit" ? enquiry.recipientEmail : undefined,
    recipientName: enquiry.recipientName,
    subject: enquiry.subject,
    message: enquiry.message,
  });
  const resolvedOutcome = resolved.delivery.outcome === "approval_requested" ? "approval_requested" : "send_after_confirmation";
  if (JSON.stringify(resolved.enquiry) !== JSON.stringify(enquiry)
    || resolvedOutcome !== outcome
    || resolved.delivery.coupleUserId !== (stored.coupleUserId ?? null)) {
    throw new WeddingBriefingError("Vendor, recipient, or workspace access changed after preview. No email was sent; preview the enquiry again.", 409);
  }

  if (outcome === "approval_requested") {
    const { data: request, error: requestError } = await db.from("planner_change_requests").upsert({
      client_id: enquiry.clientId,
      couple_user_id: stored.coupleUserId,
      planner_user_id: actor.userId,
      target_table: "vendor_enquiries",
      change_type: "create",
      target_id: null,
      current_payload: null,
      proposed_payload: {
        owner_user_id: actor.userId,
        wedding_id: enquiry.weddingId,
        planner_client_id: enquiry.clientId,
        vendor_id: enquiry.vendorId,
        vendor_listing_id: enquiry.vendorListingId,
        recipient_name: enquiry.recipientName,
        recipient_email: enquiry.recipientEmail,
        recipient_source: enquiry.recipientSource,
        sender_name: enquiry.senderName,
        subject: enquiry.subject,
        message: enquiry.message,
        gateway_idempotency_key: idempotencyKey,
        created_via: "intelligence_gateway",
      },
      note: "Approve the exact recipient and message before this external vendor enquiry is sent.",
      gateway_idempotency_key: idempotencyKey,
    }, { onConflict: "gateway_idempotency_key" }).select("id,status").single();
    if (requestError || !request) throw new WeddingBriefingError("Could not send this enquiry to the couple for approval. No email was sent.", 503);
    const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
      status: "executed", executed_at: now.toISOString(), result_change_request_id: request.id,
    }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
    if (receiptError) throw new WeddingBriefingError("The approval request was created, but its receipt could not be finalized. Retry with the same confirmation.", 503);
    return toVendorEnquiryApprovalReceipt(String(request.id), enquiry, idempotencyKey);
  }

  const { data: pending, error: insertError } = await db.from("vendor_enquiries").upsert({
    owner_user_id: actor.userId,
    wedding_id: enquiry.weddingId,
    planner_client_id: enquiry.clientId,
    vendor_id: enquiry.vendorId,
    vendor_listing_id: enquiry.vendorListingId,
    recipient_name: enquiry.recipientName,
    recipient_email: enquiry.recipientEmail,
    recipient_source: enquiry.recipientSource,
    sender_name: enquiry.senderName,
    subject: enquiry.subject,
    message: enquiry.message,
    channel: "email",
    delivery_provider: "resend",
    delivery_status: "sending",
    gateway_idempotency_key: idempotencyKey,
    created_via: "intelligence_gateway",
  }, { onConflict: "gateway_idempotency_key" }).select("id,delivery_status,provider_message_id,sent_at,response_token").single();
  if (insertError || !pending) throw new WeddingBriefingError("Could not record this vendor enquiry before delivery. No email was sent.", 503);
  if (pending.delivery_status === "sent" || pending.delivery_status === "failed") {
    return toVendorEnquiryReceipt(pending, enquiry, idempotencyKey);
  }

  let delivery;
  try {
    delivery = await deliver({
      enquiryId: String(pending.id), idempotencyKey,
      responseToken: String(pending.response_token),
      recipientName: enquiry.recipientName, recipientEmail: enquiry.recipientEmail,
      senderName: enquiry.senderName, subject: enquiry.subject, message: enquiry.message,
    });
  } catch {
    delivery = { ok: false, provider: "resend" as const, providerMessageId: null, error: "The email provider could not be reached." };
  }
  const deliveryStatus = delivery.ok ? "sent" : "failed";
  const { data: completed, error: updateError } = await db.from("vendor_enquiries").update({
    delivery_status: deliveryStatus,
    provider_message_id: delivery.providerMessageId,
    sent_at: delivery.ok ? now.toISOString() : null,
    failed_at: delivery.ok ? null : now.toISOString(),
    failure_message: delivery.ok ? null : delivery.error,
  }).eq("id", pending.id).eq("owner_user_id", actor.userId)
    .select("id,delivery_status,provider_message_id,sent_at").single();
  if (updateError || !completed) throw new WeddingBriefingError("The provider handled the enquiry, but Zania could not save its delivery receipt. Do not resend yet; contact support with the confirmation ID.", 503);
  const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
    status: "executed", executed_at: now.toISOString(), result_vendor_enquiry_id: completed.id,
  }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
  if (receiptError) throw new WeddingBriefingError("The enquiry attempt was recorded, but its confirmation receipt could not be finalized. Retry with the same confirmation to restore the result.", 503);
  return toVendorEnquiryReceipt(completed, enquiry, idempotencyKey);
}

export async function revokeSendVendorEnquiryPreview(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<RevokeCreateTaskReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) throw new WeddingBriefingError("The vendor enquiry confirmation is invalid.", 400);
  const { data: confirmation, error } = await db.from("intelligence_gateway_confirmations")
    .select("id,idempotency_key,status,expires_at").eq("id", confirmationId).eq("user_id", actor.userId)
    .eq("capability", "send_vendor_enquiry").maybeSingle();
  if (error || !confirmation) throw new WeddingBriefingError("This vendor enquiry confirmation was not found.", 404);
  if (String(confirmation.idempotency_key) !== idempotencyKey) throw new WeddingBriefingError("The vendor enquiry confirmation does not match this request.", 409);
  if (confirmation.status === "executed") throw new WeddingBriefingError("This vendor enquiry was already attempted and can no longer be cancelled.", 409);
  const expired = confirmation.status === "expired" || (typeof confirmation.expires_at === "string" && new Date(confirmation.expires_at).getTime() <= now.getTime());
  const nextStatus = expired ? "expired" as const : "revoked" as const;
  if (confirmation.status !== nextStatus) {
    const { error: updateError } = await db.from("intelligence_gateway_confirmations").update({ status: nextStatus })
      .eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
    if (updateError) throw new WeddingBriefingError("Could not cancel this vendor enquiry. Please try again.", 503);
  }
  return {
    ok: true, capability: "send_vendor_enquiry", confirmationStatus: nextStatus,
    confirmationId, idempotencyKey,
    userSummary: nextStatus === "expired"
      ? "No vendor enquiry was sent. This confirmation had already expired."
      : "No vendor enquiry was sent. The confirmation was cancelled.",
  };
}

async function resolveVendorResponseAction(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  selectedClientId: string | null,
  input: Record<string, unknown>,
) {
  let enquiryId = typeof input.enquiryId === "string" ? input.enquiryId
    : typeof input.enquiry_id === "string" ? input.enquiry_id : "";
  const vendorName = cleanOptional(input.vendorName ?? input.vendor_name, 160);
  const action = (input.action === "record_indicative_price" || input.action === "mark_unavailable")
    ? input.action as ApplyVendorResponseAction : null;
  if ((!UUID.test(enquiryId) && !vendorName) || !action) {
    throw new WeddingBriefingError("Choose one recorded vendor response and whether to record its amount or mark the vendor unavailable.", 400);
  }
  const wedding = await resolveBriefingWedding(db, actor, selectedClientId);
  let resolvedVendor: Record<string, unknown> | null = null;
  if (!UUID.test(enquiryId)) {
    const { data: vendors, error: vendorsError } = await db.from("vendors")
      .select("id,name,price,status,selection_status,wedding_id,client_id").eq("wedding_id", wedding.id);
    if (vendorsError || !vendors) throw new WeddingBriefingError("Could not load the wedding vendor tracker.", 503);
    const normalized = vendorName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const matches = vendors.filter((row) => String(row.name).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === normalized);
    if (matches.length !== 1) throw new WeddingBriefingError(`Could not safely match “${vendorName}” to one tracked vendor.`, matches.length ? 409 : 404);
    resolvedVendor = matches[0];
    const { data: enquiries, error: enquiriesError } = await db.from("vendor_enquiries")
      .select("id,wedding_id,planner_client_id,vendor_id,response_status,responded_at")
      .eq("wedding_id", wedding.id).eq("vendor_id", resolvedVendor.id);
    if (enquiriesError || !enquiries) throw new WeddingBriefingError("Could not load that vendor's enquiry responses.", 503);
    const latest = enquiries.filter((row) => row.responded_at && row.response_status !== "awaiting_response")
      .sort((left, right) => String(right.responded_at).localeCompare(String(left.responded_at)))[0];
    if (!latest) throw new WeddingBriefingError(`No recorded enquiry response was found for ${vendorName}.`, 404);
    enquiryId = String(latest.id);
  }
  const { data: enquiry, error: enquiryError } = await db.from("vendor_enquiries")
    .select("id,wedding_id,planner_client_id,vendor_id,response_status,responded_at")
    .eq("id", enquiryId).eq("wedding_id", wedding.id).maybeSingle();
  if (enquiryError || !enquiry) throw new WeddingBriefingError("That vendor enquiry response was not found in this wedding.", 404);
  if (actor.role === "planner" && enquiry.planner_client_id !== selectedClientId) {
    throw new WeddingBriefingError("That response does not belong to the selected planner client.", 403);
  }
  const [{ data: response, error: responseError }, vendorResult] = await Promise.all([
    db.from("vendor_enquiry_responses")
      .select("id,enquiry_id,response,message,quote_amount,quote_currency,quote_valid_until,created_at")
      .eq("enquiry_id", enquiryId).maybeSingle(),
    resolvedVendor
      ? Promise.resolve({ data: resolvedVendor, error: null })
      : db.from("vendors").select("id,name,price,status,selection_status,wedding_id,client_id")
        .eq("id", enquiry.vendor_id).eq("wedding_id", wedding.id).maybeSingle(),
  ]);
  const vendor = vendorResult.data;
  const vendorError = vendorResult.error;
  if (responseError || !response || vendorError || !vendor) {
    throw new WeddingBriefingError("The vendor response or tracker record is no longer available.", 409);
  }
  const amount = response.quote_amount == null ? null : Number(response.quote_amount);
  if (action === "record_indicative_price" && (response.response !== "available" || amount == null || !Number.isFinite(amount) || amount < 0)) {
    throw new WeddingBriefingError("This response does not contain a valid indicative amount to record.", 409);
  }
  if (action === "mark_unavailable" && response.response !== "unavailable") {
    throw new WeddingBriefingError("Only an unavailable vendor response can be used to mark the vendor unavailable.", 409);
  }
  const delivery = await resolvePlannerApprovalDelivery(db, actor, selectedClientId, wedding.id);
  return {
    wedding,
    delivery,
    enquiryId,
    action,
    response: {
      id: String(response.id), response: String(response.response), createdAt: String(response.created_at),
      amount, currency: typeof response.quote_currency === "string" ? response.quote_currency : null,
      validUntil: typeof response.quote_valid_until === "string" ? response.quote_valid_until : null,
    },
    vendor: {
      id: String(vendor.id), name: String(vendor.name),
      price: vendor.price == null ? null : Number(vendor.price),
      status: typeof vendor.status === "string" ? vendor.status : null,
      selectionStatus: typeof vendor.selection_status === "string" ? vendor.selection_status : null,
    },
  };
}

function vendorResponseActionSummary(resolved: Awaited<ReturnType<typeof resolveVendorResponseAction>>) {
  const base = resolved.action === "record_indicative_price"
    ? `Record ${resolved.response.currency ?? "KES"} ${Number(resolved.response.amount).toLocaleString("en-KE")} as ${resolved.vendor.name}'s indicative tracker amount. This does not create or accept a formal quote.`
    : `Mark ${resolved.vendor.name} rejected and declined because the vendor replied unavailable.`;
  return resolved.delivery.outcome === "approval_requested" ? `${base} Send this change to the couple for approval.` : base;
}

export async function previewApplyVendorResponse(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  selectedClientId: string | null,
  input: Record<string, unknown>,
  now = new Date(),
): Promise<ApplyVendorResponsePreview> {
  const resolved = await resolveVendorResponseAction(db, actor, selectedClientId, input);
  const confirmationId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const { error } = await db.from("intelligence_gateway_confirmations").insert({
    id: confirmationId, user_id: actor.userId, wedding_id: resolved.wedding.id,
    selected_client_id: selectedClientId, capability: "apply_vendor_response",
    arguments: {
      enquiryId: resolved.enquiryId, action: resolved.action, response: resolved.response,
      vendor: resolved.vendor, outcome: resolved.delivery.outcome, coupleUserId: resolved.delivery.coupleUserId,
    },
    idempotency_key: idempotencyKey, status: "pending", expires_at: expiresAt,
  }).select("id").single();
  if (error) throw new WeddingBriefingError("Could not prepare this vendor response action for confirmation.", 503);
  return {
    ok: true, capability: "apply_vendor_response", confirmationRequired: true,
    confirmationId, idempotencyKey, expiresAt,
    wedding: { id: resolved.wedding.id, name: resolved.wedding.name, weddingDate: resolved.wedding.wedding_date },
    outcome: resolved.delivery.outcome === "approval_requested" ? "approval_requested" : "updated",
    response: {
      enquiryId: resolved.enquiryId, responseId: resolved.response.id,
      vendorId: resolved.vendor.id, vendorName: resolved.vendor.name, action: resolved.action,
      indicativeAmount: resolved.response.amount, currentPrice: resolved.vendor.price,
      currentStatus: resolved.vendor.status, currentSelectionStatus: resolved.vendor.selectionStatus,
    },
    userSummary: `${vendorResponseActionSummary(resolved)} Confirm this exact action before Zania continues.`,
  };
}

function vendorResponseReceipt(
  resolved: Awaited<ReturnType<typeof resolveVendorResponseAction>>,
  outcome: "updated" | "approval_requested",
  idempotencyKey: string,
  approvalRequestId: string | null,
): ApplyVendorResponseReceipt {
  const vendor = {
    ...resolved.vendor,
    price: resolved.action === "record_indicative_price" ? resolved.response.amount : resolved.vendor.price,
    status: resolved.action === "mark_unavailable" ? "rejected" : resolved.vendor.status,
    selectionStatus: resolved.action === "mark_unavailable" ? "declined" : resolved.vendor.selectionStatus,
  };
  return {
    ok: true, capability: "apply_vendor_response", confirmationStatus: "confirmed", outcome,
    vendor, approvalRequestId,
    receipt: { idempotencyKey, createdVia: "intelligence_gateway", path: "/vendors" },
    userSummary: outcome === "approval_requested"
      ? `Sent the ${resolved.vendor.name} tracker update to the couple for approval. The vendor response itself remains unchanged.`
      : resolved.action === "record_indicative_price"
      ? `Recorded ${resolved.response.currency ?? "KES"} ${Number(resolved.response.amount).toLocaleString("en-KE")} as ${resolved.vendor.name}'s indicative tracker amount. No formal quote or booking was created.`
      : `Marked ${resolved.vendor.name} rejected and declined from the recorded unavailable response. No booking was created.`,
  };
}

export async function executeConfirmedApplyVendorResponse(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<ApplyVendorResponseReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) throw new WeddingBriefingError("The vendor response confirmation is invalid.", 400);
  const { data: confirmation, error } = await db.from("intelligence_gateway_confirmations")
    .select("id,wedding_id,selected_client_id,arguments,idempotency_key,status,expires_at,result_entity_id,result_change_request_id")
    .eq("id", confirmationId).eq("user_id", actor.userId).eq("capability", "apply_vendor_response").maybeSingle();
  if (error || !confirmation) throw new WeddingBriefingError("This vendor response confirmation was not found.", 404);
  if (String(confirmation.idempotency_key) !== idempotencyKey) throw new WeddingBriefingError("The vendor response confirmation does not match this request.", 409);
  const stored = confirmation.arguments as Record<string, unknown>;
  const selectedClientId = typeof confirmation.selected_client_id === "string" ? confirmation.selected_client_id : null;
  const resolved = await resolveVendorResponseAction(db, actor, selectedClientId, {
    enquiryId: stored.enquiryId, action: stored.action,
  });
  if (JSON.stringify(resolved.response) !== JSON.stringify(stored.response)
    || resolved.vendor.id !== (stored.vendor as Record<string, unknown> | undefined)?.id
    || resolved.delivery.outcome !== stored.outcome
    || resolved.delivery.coupleUserId !== (stored.coupleUserId ?? null)) {
    throw new WeddingBriefingError("The vendor response or approval path changed after preview. Preview the action again.", 409);
  }
  if (confirmation.status === "executed") {
    return vendorResponseReceipt(resolved, confirmation.result_change_request_id ? "approval_requested" : "updated", idempotencyKey,
      typeof confirmation.result_change_request_id === "string" ? confirmation.result_change_request_id : null);
  }
  if (confirmation.status !== "pending") throw new WeddingBriefingError("This vendor response confirmation is no longer available.", 409);
  if (typeof confirmation.expires_at !== "string" || new Date(confirmation.expires_at).getTime() <= now.getTime()) {
    await db.from("intelligence_gateway_confirmations").update({ status: "expired" }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").maybeSingle();
    throw new WeddingBriefingError("This vendor response confirmation expired. Preview it again.", 409);
  }
  const proposed = resolved.action === "record_indicative_price"
    ? { price: resolved.response.amount }
    : { status: "rejected", selection_status: "declined" };
  const current = resolved.action === "record_indicative_price"
    ? { price: resolved.vendor.price }
    : { status: resolved.vendor.status, selection_status: resolved.vendor.selectionStatus };
  if (resolved.delivery.outcome === "approval_requested") {
    const { data: request, error: requestError } = await db.from("planner_change_requests").upsert({
      client_id: selectedClientId, couple_user_id: resolved.delivery.coupleUserId,
      planner_user_id: actor.userId, target_table: "vendors", change_type: "update",
      target_id: resolved.vendor.id, current_payload: current, proposed_payload: proposed,
      note: `Prepared from vendor enquiry response ${resolved.response.id}. The response does not itself authorize this tracker change.`,
      gateway_idempotency_key: idempotencyKey,
    }, { onConflict: "gateway_idempotency_key" }).select("id,status").single();
    if (requestError || !request) throw new WeddingBriefingError("Could not send this vendor tracker update to the couple.", 503);
    const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
      status: "executed", executed_at: now.toISOString(), result_change_request_id: request.id,
    }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
    if (receiptError) throw new WeddingBriefingError("The approval request was created, but its receipt could not be finalized.", 503);
    return vendorResponseReceipt(resolved, "approval_requested", idempotencyKey, String(request.id));
  }
  const { data: updated, error: updateError } = await db.from("vendors").update(proposed)
    .eq("id", resolved.vendor.id).eq("wedding_id", resolved.wedding.id)
    .select("id,name,price,status,selection_status").single();
  if (updateError || !updated) throw new WeddingBriefingError("Could not update the vendor tracker. No change was made.", 503);
  const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
    status: "executed", executed_at: now.toISOString(), result_entity_id: updated.id,
  }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
  if (receiptError) throw new WeddingBriefingError("The vendor tracker was updated, but its receipt could not be finalized.", 503);
  return vendorResponseReceipt(resolved, "updated", idempotencyKey, null);
}

export async function revokeApplyVendorResponsePreview(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<RevokeCreateTaskReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) throw new WeddingBriefingError("The vendor response confirmation is invalid.", 400);
  const { data: confirmation, error } = await db.from("intelligence_gateway_confirmations")
    .select("id,idempotency_key,status,expires_at").eq("id", confirmationId).eq("user_id", actor.userId)
    .eq("capability", "apply_vendor_response").maybeSingle();
  if (error || !confirmation) throw new WeddingBriefingError("This vendor response confirmation was not found.", 404);
  if (String(confirmation.idempotency_key) !== idempotencyKey) throw new WeddingBriefingError("The vendor response confirmation does not match this request.", 409);
  if (confirmation.status === "executed") throw new WeddingBriefingError("This vendor response action was already completed.", 409);
  const expired = confirmation.status === "expired" || (typeof confirmation.expires_at === "string" && new Date(confirmation.expires_at).getTime() <= now.getTime());
  const nextStatus = expired ? "expired" as const : "revoked" as const;
  if (confirmation.status !== nextStatus) {
    const { error: updateError } = await db.from("intelligence_gateway_confirmations").update({ status: nextStatus })
      .eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
    if (updateError) throw new WeddingBriefingError("Could not cancel this vendor response action.", 503);
  }
  return {
    ok: true, capability: "apply_vendor_response", confirmationStatus: nextStatus,
    confirmationId, idempotencyKey,
    userSummary: "No vendor tracker change was made.",
  };
}

function normalizeFormalQuoteInput(input: Record<string, unknown>) {
  const vendorId = cleanGuestText(input.vendorId ?? input.vendor_id, "Vendor ID", 36);
  if (vendorId && !UUID.test(vendorId)) throw new WeddingBriefingError("The vendor reference is invalid.", 400);
  const vendorName = normalizeLookupName(input.vendorName ?? input.vendor_name, "Vendor name");
  if (!vendorId && !vendorName) throw new WeddingBriefingError("Choose a vendor from the wedding tracker.", 400);
  const enquiryId = cleanGuestText(input.enquiryId ?? input.enquiry_id, "Enquiry ID", 36);
  if (enquiryId && !UUID.test(enquiryId)) throw new WeddingBriefingError("The vendor enquiry reference is invalid.", 400);
  const rawMessage = input.message;
  const message = typeof rawMessage === "string" ? rawMessage.trim().replace(/\r\n?/g, "\n") : null;
  if (message && message.length > 2000) throw new WeddingBriefingError("The formal quote request must be 2000 characters or fewer.", 400);
  return { vendorId, vendorName, enquiryId, message };
}

async function resolveFormalVendorQuote(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  selectedClientId: string | null,
  input: Record<string, unknown>,
) {
  if (actor.role !== "couple" && (actor.role !== "planner" || actor.plannerType === "committee")) {
    throw new WeddingBriefingError("Formal vendor quote requests are available to couples and professional planners.", 403);
  }
  const normalized = normalizeFormalQuoteInput(input);
  const wedding = await resolveBriefingWedding(db, actor, selectedClientId);
  const delivery = await resolvePlannerApprovalDelivery(db, actor, selectedClientId, wedding.id);
  const { data: vendors, error: vendorsError } = await db.from("vendors")
    .select("id,name,category,vendor_listing_id,wedding_id,client_id").eq("wedding_id", wedding.id);
  if (vendorsError) throw new WeddingBriefingError("Could not load the wedding vendor tracker. Please try again.", 503);
  const matches = (Array.isArray(vendors) ? vendors : []).filter((row) => (
    (!selectedClientId || row.client_id === selectedClientId)
    && (normalized.vendorId
      ? row.id === normalized.vendorId
      : normalizeLookupName(row.name, "Vendor name") === normalized.vendorName)
  ));
  if (matches.length === 0) throw new WeddingBriefingError("That vendor was not found in the active wedding tracker.", 404);
  if (matches.length > 1) throw new WeddingBriefingError("More than one tracker vendor matches that name. Choose the exact vendor.", 409);
  const vendor = matches[0];
  if (typeof vendor.vendor_listing_id !== "string" || !UUID.test(vendor.vendor_listing_id)) {
    throw new WeddingBriefingError(`Formal in-app quotes are not available because ${String(vendor.name)} has not connected a Zania vendor account. Use send_vendor_enquiry to prepare an exact, reviewed email request instead.`, 409);
  }
  const { data: listing, error: listingError } = await db.from("vendor_listings")
    .select("id,user_id,business_name,is_approved").eq("id", vendor.vendor_listing_id).maybeSingle();
  if (listingError) throw new WeddingBriefingError("Could not verify the vendor's connected Zania account.", 503);
  if (!listing || typeof listing.user_id !== "string" || listing.is_approved === false) {
    throw new WeddingBriefingError(`Formal in-app quotes are not available because ${String(vendor.name)} has not connected a receiving Zania account. Use send_vendor_enquiry to prepare an exact, reviewed email request instead.`, 409);
  }
  if (listing.user_id === actor.userId) throw new WeddingBriefingError("You cannot request a quote from your own account.", 409);

  if (normalized.enquiryId) {
    const { data: enquiry, error: enquiryError } = await db.from("vendor_enquiries")
      .select("id,wedding_id,planner_client_id,vendor_id,response_status").eq("id", normalized.enquiryId)
      .eq("wedding_id", wedding.id).maybeSingle();
    if (enquiryError || !enquiry || enquiry.vendor_id !== vendor.id) {
      throw new WeddingBriefingError("That enquiry does not belong to this tracker vendor.", 409);
    }
    if (actor.role === "planner" && enquiry.planner_client_id !== selectedClientId) {
      throw new WeddingBriefingError("That enquiry does not belong to the selected planner client.", 403);
    }
    const { data: response, error: responseError } = await db.from("vendor_enquiry_responses")
      .select("id,response").eq("enquiry_id", normalized.enquiryId).maybeSingle();
    if (responseError || !response || response.response !== "available") {
      throw new WeddingBriefingError("A formal quote can only be requested from this enquiry after an available response is recorded.", 409);
    }
  }

  const vendorName = String(vendor.name);
  const message = normalized.message
    ?? `Please send a formal quote for ${wedding.name}${wedding.wedding_date ? ` on ${wedding.wedding_date}` : ""}. Include the services covered, itemized price, payment schedule, validity period, and any terms or exclusions.`;
  return {
    wedding,
    delivery,
    request: {
      vendorId: String(vendor.id), vendorName, vendorListingId: String(listing.id),
      weddingId: wedding.id, weddingName: wedding.name,
      clientId: selectedClientId, enquiryId: normalized.enquiryId, message,
    } satisfies RequestFormalVendorQuoteArguments,
  };
}

function formalQuoteSummary(resolved: Awaited<ReturnType<typeof resolveFormalVendorQuote>>) {
  const base = `Request a formal in-app quote from ${resolved.request.vendorName}. Message: “${resolved.request.message}” No indicative response amount will be copied into the quote.`;
  return resolved.delivery.outcome === "approval_requested"
    ? `${base} Send this request to the couple for approval before the vendor receives it.`
    : base;
}

export async function previewRequestFormalVendorQuote(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  selectedClientId: string | null,
  input: Record<string, unknown>,
  now = new Date(),
): Promise<RequestFormalVendorQuotePreview> {
  const resolved = await resolveFormalVendorQuote(db, actor, selectedClientId, input);
  const confirmationId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const { error } = await db.from("intelligence_gateway_confirmations").insert({
    id: confirmationId, user_id: actor.userId, wedding_id: resolved.wedding.id,
    selected_client_id: selectedClientId, capability: "request_formal_vendor_quote",
    arguments: { request: resolved.request, outcome: resolved.delivery.outcome, coupleUserId: resolved.delivery.coupleUserId },
    idempotency_key: idempotencyKey, status: "pending", expires_at: expiresAt,
  }).select("id").single();
  if (error) throw new WeddingBriefingError("Could not prepare this formal quote request for confirmation.", 503);
  return {
    ok: true, capability: "request_formal_vendor_quote", confirmationRequired: true,
    confirmationId, idempotencyKey, expiresAt,
    wedding: { id: resolved.wedding.id, name: resolved.wedding.name, weddingDate: resolved.wedding.wedding_date },
    interpretedRequest: resolved.request,
    outcome: resolved.delivery.outcome === "approval_requested" ? "approval_requested" : "request_after_confirmation",
    userSummary: `${formalQuoteSummary(resolved)} Confirm this exact request before Zania continues.`,
  };
}

function formalQuoteReceipt(
  request: RequestFormalVendorQuoteArguments,
  id: string,
  outcome: "requested" | "approval_requested",
  idempotencyKey: string,
  approvalRequestId: string | null,
): RequestFormalVendorQuoteReceipt {
  return {
    ok: true, capability: "request_formal_vendor_quote", confirmationStatus: "confirmed", outcome,
    quoteRequest: { ...request, id, status: outcome === "requested" ? "new" : "pending_approval" },
    approvalRequestId,
    receipt: { idempotencyKey, createdVia: "intelligence_gateway", path: "/received-documents" },
    userSummary: outcome === "approval_requested"
      ? `Sent the formal quote request for ${request.vendorName} to the couple for approval. The vendor has not received it yet.`
      : `Requested a formal quote from ${request.vendorName}. The request is now tracked in Zania; no indicative amount was recorded as a formal quote.`,
  };
}

export async function executeConfirmedRequestFormalVendorQuote(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<RequestFormalVendorQuoteReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) throw new WeddingBriefingError("The formal quote confirmation is invalid.", 400);
  const { data: confirmation, error } = await db.from("intelligence_gateway_confirmations")
    .select("id,wedding_id,selected_client_id,arguments,idempotency_key,status,expires_at,result_entity_id,result_change_request_id")
    .eq("id", confirmationId).eq("user_id", actor.userId).eq("capability", "request_formal_vendor_quote").maybeSingle();
  if (error || !confirmation) throw new WeddingBriefingError("This formal quote confirmation was not found.", 404);
  if (String(confirmation.idempotency_key) !== idempotencyKey) throw new WeddingBriefingError("The formal quote confirmation does not match this request.", 409);
  const stored = confirmation.arguments as Record<string, unknown>;
  const storedRequest = stored.request as Record<string, unknown> | undefined;
  const selectedClientId = typeof confirmation.selected_client_id === "string" ? confirmation.selected_client_id : null;
  const resolved = await resolveFormalVendorQuote(db, actor, selectedClientId, {
    vendorId: storedRequest?.vendorId, enquiryId: storedRequest?.enquiryId, message: storedRequest?.message,
  });
  if (JSON.stringify(resolved.request) !== JSON.stringify(storedRequest)
    || resolved.delivery.outcome !== stored.outcome
    || resolved.delivery.coupleUserId !== (stored.coupleUserId ?? null)) {
    throw new WeddingBriefingError("The vendor, message, or approval path changed after preview. Preview the formal quote request again.", 409);
  }
  if (confirmation.status === "executed") {
    const approvalId = typeof confirmation.result_change_request_id === "string" ? confirmation.result_change_request_id : null;
    const resultId = approvalId ?? String(confirmation.result_entity_id);
    return formalQuoteReceipt(resolved.request, resultId, approvalId ? "approval_requested" : "requested", idempotencyKey, approvalId);
  }
  if (confirmation.status !== "pending") throw new WeddingBriefingError("This formal quote confirmation is no longer available.", 409);
  if (typeof confirmation.expires_at !== "string" || new Date(confirmation.expires_at).getTime() <= now.getTime()) {
    await db.from("intelligence_gateway_confirmations").update({ status: "expired" }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").maybeSingle();
    throw new WeddingBriefingError("This formal quote confirmation expired. Preview it again.", 409);
  }
  if (resolved.delivery.outcome === "approval_requested") {
    const { data: request, error: requestError } = await db.from("planner_change_requests").upsert({
      client_id: selectedClientId, couple_user_id: resolved.delivery.coupleUserId,
      planner_user_id: actor.userId, target_table: "document_requests", change_type: "create", target_id: null,
      current_payload: null,
      proposed_payload: {
        target_vendor_id: resolved.request.vendorId,
        vendor_name: resolved.request.vendorName,
        request_message: resolved.request.message,
        request_budget_amount: null,
        source_enquiry_id: resolved.request.enquiryId,
      },
      note: "Formal quote request. Any earlier vendor response amount remains indicative and is not copied into this request.",
      gateway_idempotency_key: idempotencyKey,
    }, { onConflict: "gateway_idempotency_key" }).select("id,status").single();
    if (requestError || !request) throw new WeddingBriefingError("Could not send this formal quote request to the couple for approval.", 503);
    const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
      status: "executed", executed_at: now.toISOString(), result_change_request_id: request.id,
    }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
    if (receiptError) throw new WeddingBriefingError("The approval request was created, but its receipt could not be finalized.", 503);
    return formalQuoteReceipt(resolved.request, String(request.id), "approval_requested", idempotencyKey, String(request.id));
  }
  const { data: created, error: requestError } = await db.rpc("request_vendor_quote", {
    target_vendor_id: resolved.request.vendorId,
    request_message: resolved.request.message,
    request_budget_amount: null,
  });
  const row = created && typeof created === "object" ? created as Record<string, unknown> : null;
  if (requestError || !row || typeof row.id !== "string") throw new WeddingBriefingError("Could not create the formal quote request. No request was sent.", 503);
  const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
    status: "executed", executed_at: now.toISOString(), result_entity_id: row.id,
  }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
  if (receiptError) throw new WeddingBriefingError("The formal quote was requested, but its receipt could not be finalized. Retry with the same confirmation.", 503);
  return formalQuoteReceipt(resolved.request, String(row.id), "requested", idempotencyKey, null);
}

export async function revokeRequestFormalVendorQuotePreview(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<RevokeCreateTaskReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) throw new WeddingBriefingError("The formal quote confirmation is invalid.", 400);
  const { data: confirmation, error } = await db.from("intelligence_gateway_confirmations")
    .select("id,idempotency_key,status,expires_at").eq("id", confirmationId).eq("user_id", actor.userId)
    .eq("capability", "request_formal_vendor_quote").maybeSingle();
  if (error || !confirmation) throw new WeddingBriefingError("This formal quote confirmation was not found.", 404);
  if (String(confirmation.idempotency_key) !== idempotencyKey) throw new WeddingBriefingError("The formal quote confirmation does not match this request.", 409);
  if (confirmation.status === "executed") throw new WeddingBriefingError("This formal quote request was already completed.", 409);
  const expired = confirmation.status === "expired" || (typeof confirmation.expires_at === "string" && new Date(confirmation.expires_at).getTime() <= now.getTime());
  const nextStatus = expired ? "expired" as const : "revoked" as const;
  if (confirmation.status !== nextStatus) {
    const { error: updateError } = await db.from("intelligence_gateway_confirmations").update({ status: nextStatus })
      .eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
    if (updateError) throw new WeddingBriefingError("Could not cancel this formal quote request.", 503);
  }
  return {
    ok: true, capability: "request_formal_vendor_quote", confirmationStatus: nextStatus,
    confirmationId, idempotencyKey,
    userSummary: "No formal quote request was sent.",
  };
}

function normalizeFormalQuoteChangesInput(input: Record<string, unknown>) {
  const quoteRequestId = cleanGuestText(input.quoteRequestId ?? input.quote_request_id, "Quote request ID", 36);
  const quoteDocumentId = cleanGuestText(input.quoteDocumentId ?? input.quote_document_id, "Quote document ID", 36);
  if (quoteRequestId && !UUID.test(quoteRequestId)) throw new WeddingBriefingError("The quote request reference is invalid.", 400);
  if (quoteDocumentId && !UUID.test(quoteDocumentId)) throw new WeddingBriefingError("The quote document reference is invalid.", 400);
  const vendorName = normalizeLookupName(input.vendorName ?? input.vendor_name, "Vendor name");
  if (!quoteRequestId && !quoteDocumentId && !vendorName) {
    throw new WeddingBriefingError("Choose one returned formal quote by request, document, or exact vendor name.", 400);
  }
  const message = typeof input.message === "string" ? input.message.trim().replace(/\r\n?/g, "\n") : "";
  if (message.length < 3 || message.length > 2000) {
    throw new WeddingBriefingError("Explain the exact quote changes in 3 to 2000 characters.", 400);
  }
  return { quoteRequestId, quoteDocumentId, vendorName, message };
}

async function resolveFormalQuoteChanges(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  selectedClientId: string | null,
  input: Record<string, unknown>,
) {
  if (actor.role !== "couple" && (actor.role !== "planner" || actor.plannerType === "committee")) {
    throw new WeddingBriefingError("Formal quote change requests are available to couples and professional planners.", 403);
  }
  const normalized = normalizeFormalQuoteChangesInput(input);
  const wedding = await resolveBriefingWedding(db, actor, selectedClientId);
  const delivery = await resolvePlannerApprovalDelivery(db, actor, selectedClientId, wedding.id);
  const { data, error } = await db.rpc("get_formal_quote_briefing", { _wedding_id: wedding.id });
  if (error || !data || typeof data !== "object") {
    throw new WeddingBriefingError("Could not load the returned formal quotes. Please try again.", 503);
  }
  const requests = Array.isArray((data as Record<string, unknown>).requests)
    ? (data as Record<string, unknown>).requests as Record<string, unknown>[] : [];
  const matches = requests.filter((row) => {
    const document = row.formalQuote && typeof row.formalQuote === "object"
      ? row.formalQuote as Record<string, unknown> : null;
    if (!document) return false;
    if (normalized.quoteRequestId) return row.id === normalized.quoteRequestId;
    if (normalized.quoteDocumentId) return document.id === normalized.quoteDocumentId;
    return normalizeLookupName(row.vendorName, "Vendor name") === normalized.vendorName;
  });
  if (matches.length === 0) throw new WeddingBriefingError("That returned formal quote was not found in the active wedding.", 404);
  if (matches.length > 1) throw new WeddingBriefingError("More than one returned formal quote matches that vendor. Choose the exact quote.", 409);
  const row = matches[0];
  const document = row.formalQuote as Record<string, unknown>;
  if (row.status !== "responded" || document.status !== "sent") {
    throw new WeddingBriefingError("This formal quote is no longer awaiting changes. Refresh the quote summary before continuing.", 409);
  }
  const request = {
    quoteRequestId: String(row.id),
    quoteDocumentId: String(document.id),
    documentNumber: String(document.documentNumber ?? "Formal quote"),
    vendorName: String(row.vendorName ?? "Vendor"),
    message: normalized.message,
  } satisfies RequestFormalQuoteChangesArguments;
  if (!UUID.test(request.quoteRequestId) || !UUID.test(request.quoteDocumentId)) {
    throw new WeddingBriefingError("The returned quote references are invalid.", 409);
  }
  return { wedding, delivery, request };
}

function formalQuoteChangesSummary(resolved: Awaited<ReturnType<typeof resolveFormalQuoteChanges>>) {
  const base = `Request changes to ${resolved.request.documentNumber} from ${resolved.request.vendorName}: “${resolved.request.message}”`;
  return resolved.delivery.outcome === "approval_requested"
    ? `${base}. Send this exact request to the couple for approval before the vendor sees it.`
    : `${base}.`;
}

export async function previewRequestFormalQuoteChanges(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  selectedClientId: string | null,
  input: Record<string, unknown>,
  now = new Date(),
): Promise<RequestFormalQuoteChangesPreview> {
  const resolved = await resolveFormalQuoteChanges(db, actor, selectedClientId, input);
  const confirmationId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const { error } = await db.from("intelligence_gateway_confirmations").insert({
    id: confirmationId, user_id: actor.userId, wedding_id: resolved.wedding.id,
    selected_client_id: selectedClientId, capability: "request_formal_quote_changes",
    arguments: { request: resolved.request, outcome: resolved.delivery.outcome, coupleUserId: resolved.delivery.coupleUserId },
    idempotency_key: idempotencyKey, status: "pending", expires_at: expiresAt,
  }).select("id").single();
  if (error) throw new WeddingBriefingError("Could not prepare this quote change request for confirmation.", 503);
  return {
    ok: true, capability: "request_formal_quote_changes", confirmationRequired: true,
    confirmationId, idempotencyKey, expiresAt,
    wedding: { id: resolved.wedding.id, name: resolved.wedding.name, weddingDate: resolved.wedding.wedding_date },
    interpretedRequest: resolved.request,
    outcome: resolved.delivery.outcome === "approval_requested" ? "approval_requested" : "request_after_confirmation",
    userSummary: `${formalQuoteChangesSummary(resolved)} Confirm this exact change request before Zania continues.`,
  };
}

function formalQuoteChangesReceipt(
  request: RequestFormalQuoteChangesArguments,
  id: string,
  outcome: "changes_requested" | "approval_requested",
  idempotencyKey: string,
  approvalRequestId: string | null,
): RequestFormalQuoteChangesReceipt {
  return {
    ok: true, capability: "request_formal_quote_changes", confirmationStatus: "confirmed", outcome,
    quoteResponse: { ...request, id, status: outcome === "changes_requested" ? "changes_requested" : "pending_approval" },
    approvalRequestId,
    receipt: { idempotencyKey, createdVia: "intelligence_gateway", path: "/received-documents" },
    userSummary: outcome === "approval_requested"
      ? `Sent the requested changes for ${request.documentNumber} to the couple for approval. The vendor has not seen them yet.`
      : `Requested changes to ${request.documentNumber} from ${request.vendorName}. The formal quote is now marked changes requested.`,
  };
}

export async function executeConfirmedRequestFormalQuoteChanges(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<RequestFormalQuoteChangesReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) throw new WeddingBriefingError("The quote change confirmation is invalid.", 400);
  const { data: confirmation, error } = await db.from("intelligence_gateway_confirmations")
    .select("id,wedding_id,selected_client_id,arguments,idempotency_key,status,expires_at,result_entity_id,result_change_request_id")
    .eq("id", confirmationId).eq("user_id", actor.userId).eq("capability", "request_formal_quote_changes").maybeSingle();
  if (error || !confirmation) throw new WeddingBriefingError("This quote change confirmation was not found.", 404);
  if (String(confirmation.idempotency_key) !== idempotencyKey) throw new WeddingBriefingError("The quote change confirmation does not match this request.", 409);
  const stored = confirmation.arguments as Record<string, unknown>;
  const storedRequest = stored.request as Record<string, unknown> | undefined;
  if (confirmation.status === "executed") {
    const approvalId = typeof confirmation.result_change_request_id === "string" ? confirmation.result_change_request_id : null;
    const resultId = approvalId ?? String(confirmation.result_entity_id);
    return formalQuoteChangesReceipt(storedRequest as RequestFormalQuoteChangesArguments, resultId, approvalId ? "approval_requested" : "changes_requested", idempotencyKey, approvalId);
  }
  if (confirmation.status !== "pending") throw new WeddingBriefingError("This quote change confirmation is no longer available.", 409);
  if (typeof confirmation.expires_at !== "string" || new Date(confirmation.expires_at).getTime() <= now.getTime()) {
    await db.from("intelligence_gateway_confirmations").update({ status: "expired" }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").maybeSingle();
    throw new WeddingBriefingError("This quote change confirmation expired. Preview it again.", 409);
  }
  const selectedClientId = typeof confirmation.selected_client_id === "string" ? confirmation.selected_client_id : null;
  const resolved = await resolveFormalQuoteChanges(db, actor, selectedClientId, {
    quoteRequestId: storedRequest?.quoteRequestId, message: storedRequest?.message,
  });
  if (JSON.stringify(resolved.request) !== JSON.stringify(storedRequest)
    || resolved.delivery.outcome !== stored.outcome
    || resolved.delivery.coupleUserId !== (stored.coupleUserId ?? null)) {
    throw new WeddingBriefingError("The quote or approval path changed after preview. Preview the change request again.", 409);
  }
  if (resolved.delivery.outcome === "approval_requested") {
    const { data: approval, error: approvalError } = await db.from("planner_change_requests").upsert({
      client_id: selectedClientId, couple_user_id: resolved.delivery.coupleUserId,
      planner_user_id: actor.userId, target_table: "commercial_quote_responses", change_type: "create", target_id: null,
      current_payload: { quote_request_id: resolved.request.quoteRequestId, quote_document_id: resolved.request.quoteDocumentId },
      proposed_payload: {
        quote_request_id: resolved.request.quoteRequestId, quote_document_id: resolved.request.quoteDocumentId,
        document_number: resolved.request.documentNumber, vendor_name: resolved.request.vendorName,
        response: "changes_requested", message: resolved.request.message,
      },
      note: "Request exact changes to a returned formal quote. The vendor sees them only after couple approval.",
      gateway_idempotency_key: idempotencyKey,
    }, { onConflict: "gateway_idempotency_key" }).select("id,status").single();
    if (approvalError || !approval) throw new WeddingBriefingError("Could not send this quote change request to the couple for approval.", 503);
    const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
      status: "executed", executed_at: now.toISOString(), result_change_request_id: approval.id,
    }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
    if (receiptError) throw new WeddingBriefingError("The approval request was created, but its receipt could not be finalized.", 503);
    return formalQuoteChangesReceipt(resolved.request, String(approval.id), "approval_requested", idempotencyKey, String(approval.id));
  }
  const { data: created, error: responseError } = await db.rpc("request_formal_quote_changes", {
    target_document_id: resolved.request.quoteDocumentId,
    change_message: resolved.request.message,
    gateway_idempotency_key_input: idempotencyKey,
  });
  const row = created && typeof created === "object" ? created as Record<string, unknown> : null;
  if (responseError || !row || typeof row.id !== "string") throw new WeddingBriefingError("Could not request these quote changes. No change was made.", 503);
  const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
    status: "executed", executed_at: now.toISOString(), result_entity_id: row.id,
  }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
  if (receiptError) throw new WeddingBriefingError("The quote changes were requested, but the receipt could not be finalized. Retry with the same confirmation.", 503);
  return formalQuoteChangesReceipt(resolved.request, String(row.id), "changes_requested", idempotencyKey, null);
}

export async function revokeRequestFormalQuoteChangesPreview(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<RevokeCreateTaskReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) throw new WeddingBriefingError("The quote change confirmation is invalid.", 400);
  const { data: confirmation, error } = await db.from("intelligence_gateway_confirmations")
    .select("id,idempotency_key,status,expires_at").eq("id", confirmationId).eq("user_id", actor.userId)
    .eq("capability", "request_formal_quote_changes").maybeSingle();
  if (error || !confirmation) throw new WeddingBriefingError("This quote change confirmation was not found.", 404);
  if (String(confirmation.idempotency_key) !== idempotencyKey) throw new WeddingBriefingError("The quote change confirmation does not match this request.", 409);
  if (confirmation.status === "executed") throw new WeddingBriefingError("This quote change request was already completed.", 409);
  const expired = confirmation.status === "expired" || (typeof confirmation.expires_at === "string" && new Date(confirmation.expires_at).getTime() <= now.getTime());
  const nextStatus = expired ? "expired" as const : "revoked" as const;
  if (confirmation.status !== nextStatus) {
    const { error: updateError } = await db.from("intelligence_gateway_confirmations").update({ status: nextStatus })
      .eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
    if (updateError) throw new WeddingBriefingError("Could not cancel this quote change request.", 503);
  }
  return {
    ok: true, capability: "request_formal_quote_changes", confirmationStatus: nextStatus,
    confirmationId, idempotencyKey, userSummary: "No formal quote changes were requested.",
  };
}

function negotiationAmount(value: unknown, label: string, required = false) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new WeddingBriefingError(`${label} is required.`, 400);
    return null;
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    throw new WeddingBriefingError(`${label} must be greater than zero and no more than KES 1,000,000,000.`, 400);
  }
  return Math.round((amount + 1e-9) * 100) / 100;
}

function normalizeSaveNegotiationPlanInput(input: Record<string, unknown>) {
  const quoteRequestId = cleanGuestText(input.quoteRequestId ?? input.quote_request_id, "Quote request ID", 80);
  const quoteDocumentId = cleanGuestText(input.quoteDocumentId ?? input.quote_document_id, "Quote document ID", 80);
  const vendorName = input.vendorName ?? input.vendor_name;
  if (quoteRequestId && !UUID.test(quoteRequestId)) throw new WeddingBriefingError("Choose a valid quote request.", 400);
  if (quoteDocumentId && !UUID.test(quoteDocumentId)) throw new WeddingBriefingError("Choose a valid quote document.", 400);
  if (!quoteRequestId && !quoteDocumentId && !vendorName) {
    throw new WeddingBriefingError("Choose the formal quote for this negotiation plan.", 400);
  }
  const targetBudgetKes = negotiationAmount(input.targetBudgetKes ?? input.target_budget_kes, "Target budget", true)!;
  const absoluteCeilingKes = negotiationAmount(input.absoluteCeilingKes ?? input.absolute_ceiling_kes, "Absolute ceiling");
  if (absoluteCeilingKes != null && absoluteCeilingKes < targetBudgetKes) {
    throw new WeddingBriefingError("The absolute ceiling cannot be below the target budget.", 400);
  }
  const tone = String(input.tone ?? "gentle").trim().toLowerCase();
  if (tone !== "gentle" && tone !== "commercial" && tone !== "planner") {
    throw new WeddingBriefingError("Negotiation tone must be gentle, commercial or planner.", 400);
  }
  const draftMessage = cleanGuestText(input.draftMessage ?? input.draft_message, "Negotiation draft", 2000);
  if (!draftMessage || draftMessage.length < 3) throw new WeddingBriefingError("Add a negotiation draft of at least 3 characters.", 400);
  return {
    quoteRequestId,
    quoteDocumentId,
    vendorName: vendorName == null ? null : normalizeLookupName(vendorName, "Vendor name"),
    targetBudgetKes,
    absoluteCeilingKes,
    mustHave: cleanCandidateList(input.mustHave ?? input.must_have, 10, 160),
    willingToTrade: cleanCandidateList(input.willingToTrade ?? input.willing_to_trade, 10, 160),
    tone: tone as SaveNegotiationPlanArguments["tone"],
    draftMessage: draftMessage.replace(/\r\n?/g, "\n"),
    proposedTotalKes: negotiationAmount(input.proposedTotalKes ?? input.proposed_total_kes, "Proposed total"),
  };
}

async function resolveNegotiationPlan(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  selectedClientId: string | null,
  input: Record<string, unknown>,
) {
  if (actor.role !== "couple" && (actor.role !== "planner" || actor.plannerType === "committee")) {
    throw new WeddingBriefingError("Negotiation plans are available to couples and professional planners.", 403);
  }
  const normalized = normalizeSaveNegotiationPlanInput(input);
  const wedding = await resolveBriefingWedding(db, actor, selectedClientId);
  const { data, error } = await db.rpc("get_formal_quote_briefing", { _wedding_id: wedding.id });
  if (error || !data || typeof data !== "object") {
    throw new WeddingBriefingError("Could not load the returned formal quotes. Please try again.", 503);
  }
  const requests = Array.isArray((data as Record<string, unknown>).requests)
    ? (data as Record<string, unknown>).requests as Record<string, unknown>[] : [];
  const matches = requests.filter((row) => {
    const document = row.formalQuote && typeof row.formalQuote === "object"
      ? row.formalQuote as Record<string, unknown> : null;
    if (!document) return false;
    if (normalized.quoteRequestId) return row.id === normalized.quoteRequestId;
    if (normalized.quoteDocumentId) return document.id === normalized.quoteDocumentId;
    return normalizeLookupName(row.vendorName, "Vendor name") === normalized.vendorName;
  });
  if (!matches.length) throw new WeddingBriefingError("That returned formal quote was not found in the active wedding.", 404);
  if (matches.length > 1) throw new WeddingBriefingError("More than one returned formal quote matches that vendor. Choose the exact quote.", 409);
  const row = matches[0];
  const document = row.formalQuote as Record<string, unknown>;
  if (row.status !== "responded" || document.status !== "sent") {
    throw new WeddingBriefingError("This formal quote is no longer open for negotiation planning.", 409);
  }
  if (String(document.currency ?? "").toUpperCase() !== "KES") {
    throw new WeddingBriefingError("Persisted negotiation targets currently require a KES formal quote.", 409);
  }
  const quotedTotalKes = Number(document.totalAmount);
  if (!Number.isFinite(quotedTotalKes) || quotedTotalKes < 0) {
    throw new WeddingBriefingError("The formal quote total is invalid. Ask the vendor to correct the quote first.", 409);
  }
  const plan: SaveNegotiationPlanArguments = {
    quoteRequestId: String(row.id),
    quoteDocumentId: String(document.id),
    documentNumber: String(document.documentNumber ?? "Formal quote"),
    vendorName: String(row.vendorName ?? "Vendor"),
    quotedTotalKes,
    targetBudgetKes: normalized.targetBudgetKes,
    absoluteCeilingKes: normalized.absoluteCeilingKes,
    mustHave: normalized.mustHave,
    willingToTrade: normalized.willingToTrade,
    tone: normalized.tone,
    draftMessage: normalized.draftMessage,
    proposedTotalKes: normalized.proposedTotalKes,
  };
  if (!UUID.test(plan.quoteRequestId) || !UUID.test(plan.quoteDocumentId)) {
    throw new WeddingBriefingError("The returned quote references are invalid.", 409);
  }
  return { wedding, plan };
}

function negotiationPlanSummary(plan: SaveNegotiationPlanArguments) {
  const ceiling = plan.absoluteCeilingKes == null ? "no absolute ceiling recorded" : `ceiling KES ${plan.absoluteCeilingKes.toLocaleString("en-KE")}`;
  return `Save a negotiation plan for ${plan.vendorName}'s ${plan.documentNumber}: target KES ${plan.targetBudgetKes.toLocaleString("en-KE")}, ${ceiling}, ${plan.tone} tone, and one unsent draft proposal: “${plan.draftMessage}”`;
}

function sameNegotiationPlan(left: SaveNegotiationPlanArguments, right: SaveNegotiationPlanArguments) {
  return left.quoteRequestId === right.quoteRequestId
    && left.quoteDocumentId === right.quoteDocumentId
    && left.documentNumber === right.documentNumber
    && left.vendorName === right.vendorName
    && left.quotedTotalKes === right.quotedTotalKes
    && left.targetBudgetKes === right.targetBudgetKes
    && left.absoluteCeilingKes === right.absoluteCeilingKes
    && left.tone === right.tone
    && left.draftMessage === right.draftMessage
    && left.proposedTotalKes === right.proposedTotalKes
    && JSON.stringify(left.mustHave) === JSON.stringify(right.mustHave)
    && JSON.stringify(left.willingToTrade) === JSON.stringify(right.willingToTrade);
}

export async function previewSaveNegotiationPlan(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  selectedClientId: string | null,
  input: Record<string, unknown>,
  now = new Date(),
): Promise<SaveNegotiationPlanPreview> {
  const resolved = await resolveNegotiationPlan(db, actor, selectedClientId, input);
  const confirmationId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const { error } = await db.from("intelligence_gateway_confirmations").insert({
    id: confirmationId, user_id: actor.userId, wedding_id: resolved.wedding.id,
    selected_client_id: selectedClientId, capability: "save_negotiation_plan",
    arguments: { plan: resolved.plan }, idempotency_key: idempotencyKey,
    status: "pending", expires_at: expiresAt,
  }).select("id").single();
  if (error) throw new WeddingBriefingError("Could not prepare this negotiation plan for confirmation.", 503);
  return {
    ok: true, capability: "save_negotiation_plan", confirmationRequired: true,
    confirmationId, idempotencyKey, expiresAt,
    wedding: { id: resolved.wedding.id, name: resolved.wedding.name, weddingDate: resolved.wedding.wedding_date },
    interpretedPlan: resolved.plan,
    userSummary: `${negotiationPlanSummary(resolved.plan)}. Confirm to save it. No vendor will be contacted.`,
  };
}

function negotiationPlanReceipt(
  plan: SaveNegotiationPlanArguments,
  result: { profileId: string; proposalId: string; roundNumber: number },
  idempotencyKey: string,
): SaveNegotiationPlanReceipt {
  return {
    ok: true, capability: "save_negotiation_plan", confirmationStatus: "confirmed",
    profileId: result.profileId,
    proposal: { id: result.proposalId, roundNumber: result.roundNumber, status: "draft", contactStatus: "not_contacted" },
    receipt: { idempotencyKey, createdVia: "intelligence_gateway", path: "/received-documents" },
    userSummary: `Saved the negotiation profile and draft round ${result.roundNumber} for ${plan.vendorName}. The vendor was not contacted and no agreement was recorded.`,
  };
}

async function persistNegotiationPlan(
  db: GatewayWriteDatabase,
  weddingId: string,
  plan: SaveNegotiationPlanArguments,
  idempotencyKey: string,
) {
  const { data, error } = await db.rpc("save_negotiation_plan", {
    wedding_id_input: weddingId,
    quote_request_id_input: plan.quoteRequestId,
    quote_document_id_input: plan.quoteDocumentId,
    target_budget_kes_input: plan.targetBudgetKes,
    absolute_ceiling_kes_input: plan.absoluteCeilingKes,
    must_have_input: plan.mustHave,
    willing_to_trade_input: plan.willingToTrade,
    tone_input: plan.tone,
    draft_message_input: plan.draftMessage,
    proposed_total_kes_input: plan.proposedTotalKes,
    gateway_idempotency_key_input: idempotencyKey,
  });
  const row = data && typeof data === "object" ? data as Record<string, unknown> : null;
  if (error || !row || typeof row.profileId !== "string" || typeof row.proposalId !== "string" || !Number.isInteger(Number(row.roundNumber))) {
    throw new WeddingBriefingError("Could not save this negotiation plan. No vendor was contacted.", 503);
  }
  return { profileId: row.profileId, proposalId: row.proposalId, roundNumber: Number(row.roundNumber) };
}

export async function executeConfirmedSaveNegotiationPlan(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<SaveNegotiationPlanReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) throw new WeddingBriefingError("The negotiation-plan confirmation is invalid.", 400);
  const { data: confirmation, error } = await db.from("intelligence_gateway_confirmations")
    .select("id,wedding_id,selected_client_id,arguments,idempotency_key,status,expires_at,result_entity_id")
    .eq("id", confirmationId).eq("user_id", actor.userId).eq("capability", "save_negotiation_plan").maybeSingle();
  if (error || !confirmation) throw new WeddingBriefingError("This negotiation-plan confirmation was not found.", 404);
  if (String(confirmation.idempotency_key) !== idempotencyKey) throw new WeddingBriefingError("The negotiation-plan confirmation does not match this request.", 409);
  const stored = confirmation.arguments as Record<string, unknown>;
  const storedPlan = stored.plan as SaveNegotiationPlanArguments | undefined;
  if (!storedPlan) throw new WeddingBriefingError("The stored negotiation plan is incomplete. Preview it again.", 409);
  if (confirmation.status === "executed") {
    const result = await persistNegotiationPlan(db, String(confirmation.wedding_id), storedPlan, idempotencyKey);
    return negotiationPlanReceipt(storedPlan, result, idempotencyKey);
  }
  if (confirmation.status !== "pending") throw new WeddingBriefingError("This negotiation-plan confirmation is no longer available.", 409);
  if (typeof confirmation.expires_at !== "string" || new Date(confirmation.expires_at).getTime() <= now.getTime()) {
    await db.from("intelligence_gateway_confirmations").update({ status: "expired" }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").maybeSingle();
    throw new WeddingBriefingError("This negotiation-plan confirmation expired. Preview it again.", 409);
  }
  const selectedClientId = typeof confirmation.selected_client_id === "string" ? confirmation.selected_client_id : null;
  const resolved = await resolveNegotiationPlan(db, actor, selectedClientId, storedPlan as unknown as Record<string, unknown>);
  if (!sameNegotiationPlan(resolved.plan, storedPlan) || resolved.wedding.id !== confirmation.wedding_id) {
    throw new WeddingBriefingError("The quote or negotiation plan changed after preview. Preview it again.", 409);
  }
  const result = await persistNegotiationPlan(db, resolved.wedding.id, resolved.plan, idempotencyKey);
  const { error: receiptError } = await db.from("intelligence_gateway_confirmations").update({
    status: "executed", executed_at: now.toISOString(), result_entity_id: result.proposalId,
  }).eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
  if (receiptError) throw new WeddingBriefingError("The negotiation plan was saved, but its receipt could not be finalized. Retry with the same confirmation.", 503);
  return negotiationPlanReceipt(resolved.plan, result, idempotencyKey);
}

export async function revokeSaveNegotiationPlanPreview(
  db: GatewayWriteDatabase,
  actor: GatewayWriteActor,
  confirmationId: string,
  idempotencyKey: string,
  now = new Date(),
): Promise<RevokeCreateTaskReceipt> {
  if (!UUID.test(confirmationId) || !UUID.test(idempotencyKey)) throw new WeddingBriefingError("The negotiation-plan confirmation is invalid.", 400);
  const { data: confirmation, error } = await db.from("intelligence_gateway_confirmations")
    .select("id,idempotency_key,status,expires_at").eq("id", confirmationId).eq("user_id", actor.userId)
    .eq("capability", "save_negotiation_plan").maybeSingle();
  if (error || !confirmation) throw new WeddingBriefingError("This negotiation-plan confirmation was not found.", 404);
  if (String(confirmation.idempotency_key) !== idempotencyKey) throw new WeddingBriefingError("The negotiation-plan confirmation does not match this request.", 409);
  if (confirmation.status === "executed") throw new WeddingBriefingError("This negotiation plan was already saved.", 409);
  const expired = confirmation.status === "expired" || (typeof confirmation.expires_at === "string" && new Date(confirmation.expires_at).getTime() <= now.getTime());
  const nextStatus = expired ? "expired" as const : "revoked" as const;
  if (confirmation.status !== nextStatus) {
    const { error: updateError } = await db.from("intelligence_gateway_confirmations").update({ status: nextStatus })
      .eq("id", confirmationId).eq("user_id", actor.userId).select("id").single();
    if (updateError) throw new WeddingBriefingError("Could not cancel this negotiation plan.", 503);
  }
  return {
    ok: true, capability: "save_negotiation_plan", confirmationStatus: nextStatus,
    confirmationId, idempotencyKey, userSummary: "No negotiation profile or draft proposal was saved.",
  };
}
