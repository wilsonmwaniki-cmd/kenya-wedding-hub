import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@2.2.0";
import { pipeline } from "npm:@supabase/middleware@0.5.0";
import { withOAuthProtectedResource, withSupabase } from "npm:@supabase/server@1.6.0";
import { z } from "npm:zod@4.3.6";

import { isTemporaryDemoUser } from "../_shared/demoGuard.ts";
import {
  createGatewayRequest,
  executeGatewayRead,
  getGatewayCapability,
  type GatewayReadCapability,
} from "../_shared/intelligenceGateway.ts";
import { searchExternalVendorsWithOpenAi } from "../_shared/externalVendorDiscovery.ts";
import {
  executeConfirmedAddGuest,
  executeConfirmedApplyVendorResponse,
  executeConfirmedAssignVendorCandidate,
  executeConfirmedPromoteVendorCandidate,
  executeConfirmedRequestFormalVendorQuote,
  executeConfirmedRequestFormalQuoteChanges,
  executeConfirmedSaveNegotiationPlan,
  executeConfirmedSendVendorEnquiry,
  executeConfirmedCreateTask,
  executeConfirmedCreateVendorFollowUp,
  executeConfirmedRecordExpense,
  executeConfirmedRecordPayment,
  executeConfirmedSaveVendorCandidate,
  executeConfirmedUpdateTask,
  previewAddGuest,
  previewApplyVendorResponse,
  previewAssignVendorCandidate,
  previewPromoteVendorCandidate,
  previewRequestFormalVendorQuote,
  previewRequestFormalQuoteChanges,
  previewSaveNegotiationPlan,
  previewSendVendorEnquiry,
  previewCreateTask,
  previewCreateVendorFollowUp,
  previewRecordExpense,
  previewRecordPayment,
  previewSaveVendorCandidate,
  previewUpdateTask,
  revokeAddGuestPreview,
  revokeApplyVendorResponsePreview,
  revokeAssignVendorCandidatePreview,
  revokePromoteVendorCandidatePreview,
  revokeRequestFormalVendorQuotePreview,
  revokeRequestFormalQuoteChangesPreview,
  revokeSaveNegotiationPlanPreview,
  revokeSendVendorEnquiryPreview,
  revokeCreateTaskPreview,
  revokeCreateVendorFollowUpPreview,
  revokeRecordExpensePreview,
  revokeRecordPaymentPreview,
  revokeSaveVendorCandidatePreview,
  revokeUpdateTaskPreview,
  type GatewayWriteDatabase,
} from "../_shared/intelligenceGatewayWrites.ts";
import { deliverVendorEnquiryWithResend } from "../_shared/vendorEnquiryDelivery.ts";
import { logFunctionEvent } from "../_shared/runtimeLogger.ts";
import { assertOAuthClientAccessToken } from "../_shared/sessionGuard.ts";
import type { BriefingDatabase } from "../_shared/weddingBriefing.ts";

const FUNCTION_NAME = "intelligence-gateway-mcp";
const READ_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

type Profile = Record<string, unknown> & {
  role?: string | null;
  planner_type?: string | null;
  full_name?: string | null;
  planning_pass_status?: string | null;
  planning_pass_expires_at?: string | null;
  planner_subscription_status?: string | null;
  planner_subscription_expires_at?: string | null;
  beta_trial_status?: string | null;
  beta_trial_expires_at?: string | null;
};

function isActiveStatus(status?: string | null, expiresAt?: string | null) {
  if (status !== "active") return false;
  return !expiresAt || new Date(expiresAt).getTime() > Date.now();
}

function hasActiveBetaTrial(profile: Profile | null) {
  return isActiveStatus(profile?.beta_trial_status, profile?.beta_trial_expires_at);
}

async function hasPremiumAssistantAccess(
  supabase: any,
  userId: string,
  profile: Profile,
) {
  const role = profile.role || "couple";
  if (role === "admin") return true;
  if (role === "vendor") {
    const { data, error } = await supabase.from("vendor_listings")
      .select("subscription_status,subscription_expires_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return isActiveStatus(data?.subscription_status, data?.subscription_expires_at) || hasActiveBetaTrial(profile);
  }
  if (role === "planner") {
    return isActiveStatus(profile.planner_subscription_status, profile.planner_subscription_expires_at)
      || hasActiveBetaTrial(profile);
  }

  const { data: memberships, error: membershipsError } = await supabase.from("wedding_memberships")
    .select("wedding_id")
    .eq("user_id", userId)
    .eq("membership_status", "active")
    .is("revoked_at", null);
  if (membershipsError) throw membershipsError;
  const weddingIds = (memberships ?? []).map((membership: { wedding_id: string }) => membership.wedding_id);
  let hasWeddingEntitlement = false;
  if (weddingIds.length) {
    const { data, error } = await supabase.from("wedding_entitlements")
      .select("effective_from,effective_to")
      .in("wedding_id", weddingIds)
      .eq("feature_key", "ai_wedding_assistant")
      .eq("status", "active");
    if (error) throw error;
    const now = Date.now();
    hasWeddingEntitlement = (data ?? []).some((row: { effective_from: string; effective_to: string | null }) => (
      new Date(row.effective_from).getTime() <= now
      && (!row.effective_to || new Date(row.effective_to).getTime() > now)
    ));
  }
  return hasWeddingEntitlement
    || isActiveStatus(profile.planning_pass_status, profile.planning_pass_expires_at)
    || hasActiveBetaTrial(profile);
}

const capabilityInput = z.object({
  selectedClientId: z.string().uuid().optional().describe(
    "Planner client workspace ID. Omit it for a couple's own wedding or when listing accessible weddings.",
  ),
});

const vendorSearchInput = capabilityInput.extend({
  category: z.string().min(1).max(120).describe("Vendor service category, such as photographer, caterer or venue."),
  location: z.string().min(2).max(120).optional().describe("Preferred town, county or service area."),
  budgetMinKes: z.number().nonnegative().max(1_000_000_000).optional(),
  budgetMaxKes: z.number().positive().max(1_000_000_000).optional(),
  services: z.array(z.string().min(1).max(120)).max(10).optional(),
  limit: z.number().int().min(1).max(10).optional(),
});

const negotiationBriefInput = capabilityInput.extend({
  quoteRequestId: z.string().uuid().optional().describe("Exact tracked quote request ID when known."),
  quoteDocumentId: z.string().uuid().optional().describe("Exact returned formal quote document ID when known."),
  vendorName: z.string().min(1).max(160).optional().describe("Exact vendor name when it identifies one returned formal quote."),
  targetBudgetKes: z.number().positive().max(1_000_000_000).optional(),
  absoluteCeilingKes: z.number().positive().max(1_000_000_000).optional(),
  mustHave: z.array(z.string().min(1).max(160)).max(10).optional(),
  willingToTrade: z.array(z.string().min(1).max(160)).max(10).optional(),
  tone: z.enum(["gentle", "commercial", "planner"]).optional(),
}).refine((value) => (
  value.targetBudgetKes == null || value.absoluteCeilingKes == null || value.targetBudgetKes <= value.absoluteCeilingKes
), { message: "targetBudgetKes cannot exceed absoluteCeilingKes." });

const saveVendorCandidatePreviewInput = z.object({
  businessName: z.string().min(1).max(200),
  category: z.string().min(1).max(120),
  location: z.string().max(200).optional(),
  website: z.string().url().max(2048).optional(),
  vendorListingId: z.string().uuid().optional(),
  sourceKind: z.enum(["zania_listing", "official_website", "search_result", "directory", "social"]).optional(),
  sourceRecordId: z.string().max(500).optional(),
  sourceUrl: z.string().url().max(2048).optional(),
  summary: z.string().max(800).optional(),
  matchReasons: z.array(z.string().max(240)).max(6).optional(),
  unknowns: z.array(z.string().max(240)).max(8).optional(),
  sources: z.array(z.object({
    url: z.string().url().max(2048),
    title: z.string().max(300).optional(),
  })).max(5).optional(),
  selectedClientId: z.string().uuid().optional(),
});

const assignVendorCandidatePreviewInput = z.object({
  candidateId: z.string().uuid().optional(),
  businessName: z.string().min(1).max(200).optional(),
  clientId: z.string().uuid().optional(),
  clientName: z.string().min(1).max(200).optional(),
}).refine((value) => Boolean(value.candidateId || value.businessName), {
  message: "Provide candidateId or businessName.",
}).refine((value) => Boolean(value.clientId || value.clientName), {
  message: "Provide clientId or clientName.",
});

const promoteVendorCandidatePreviewInput = z.object({
  candidateId: z.string().uuid().optional(),
  businessName: z.string().min(1).max(200).optional(),
  quoteAmount: z.number().nonnegative().max(1_000_000_000).optional(),
  selectionStatus: z.enum(["shortlisted", "backup"]).optional(),
}).refine((value) => Boolean(value.candidateId || value.businessName), {
  message: "Provide candidateId or businessName.",
});

const sendVendorEnquiryPreviewInput = capabilityInput.extend({
  vendorId: z.string().uuid().optional(),
  vendorName: z.string().min(1).max(200).optional(),
  recipientName: z.string().min(1).max(160).optional(),
  recipientEmail: z.string().email().max(254).optional(),
  subject: z.string().min(1).max(160).optional(),
  message: z.string().min(1).max(3000),
}).refine((value) => Boolean(value.vendorId || value.vendorName), {
  message: "Provide vendorId or vendorName.",
});

const applyVendorResponsePreviewInput = capabilityInput.extend({
  enquiryId: z.string().uuid().optional(),
  vendorName: z.string().min(1).max(160).optional(),
  action: z.enum(["record_indicative_price", "mark_unavailable"]),
}).refine((value) => Boolean(value.enquiryId || value.vendorName), {
  message: "Provide enquiryId or vendorName.",
});

const requestFormalVendorQuotePreviewInput = capabilityInput.extend({
  vendorId: z.string().uuid().optional(),
  vendorName: z.string().min(1).max(160).optional(),
  enquiryId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000).optional(),
}).refine((value) => Boolean(value.vendorId || value.vendorName), {
  message: "Provide vendorId or vendorName.",
});

const requestFormalQuoteChangesPreviewInput = capabilityInput.extend({
  quoteRequestId: z.string().uuid().optional(),
  quoteDocumentId: z.string().uuid().optional(),
  vendorName: z.string().min(1).max(160).optional(),
  message: z.string().min(3).max(2000),
}).refine((value) => Boolean(value.quoteRequestId || value.quoteDocumentId || value.vendorName), {
  message: "Provide quoteRequestId, quoteDocumentId, or vendorName.",
});

const saveNegotiationPlanPreviewInput = capabilityInput.extend({
  quoteRequestId: z.string().uuid().optional(),
  quoteDocumentId: z.string().uuid().optional(),
  vendorName: z.string().min(1).max(160).optional(),
  targetBudgetKes: z.number().positive().max(1_000_000_000),
  absoluteCeilingKes: z.number().positive().max(1_000_000_000).optional(),
  mustHave: z.array(z.string().min(1).max(160)).max(10).optional(),
  willingToTrade: z.array(z.string().min(1).max(160)).max(10).optional(),
  tone: z.enum(["gentle", "commercial", "planner"]).optional(),
  draftMessage: z.string().min(3).max(2000),
  proposedTotalKes: z.number().positive().max(1_000_000_000).optional(),
}).refine((value) => Boolean(value.quoteRequestId || value.quoteDocumentId || value.vendorName), {
  message: "Provide quoteRequestId, quoteDocumentId, or vendorName.",
}).refine((value) => value.absoluteCeilingKes == null || value.absoluteCeilingKes >= value.targetBudgetKes, {
  message: "absoluteCeilingKes cannot be below targetBudgetKes.",
});

const createTaskPreviewInput = z.object({
  title: z.string().min(1).max(160),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().max(80).optional(),
  assignedTo: z.string().max(120).optional(),
  priorityLevel: z.number().int().min(1).max(5).optional(),
  visibility: z.enum(["public", "private"]).optional(),
  selectedClientId: z.string().uuid().optional(),
});

const createTaskConfirmationInput = z.object({
  confirmationId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});

const updateTaskPreviewInput = z.object({
  taskId: z.string().uuid().optional(),
  currentTitle: z.string().min(1).max(160).optional(),
  newTitle: z.string().min(1).max(160).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  assignedTo: z.string().max(120).nullable().optional(),
  priorityLevel: z.number().int().min(1).max(5).nullable().optional(),
  visibility: z.enum(["public", "private"]).optional(),
  completed: z.boolean().optional(),
  selectedClientId: z.string().uuid().optional(),
}).refine((value) => Boolean(value.taskId || value.currentTitle), {
  message: "Provide taskId or currentTitle.",
});

const addGuestPreviewInput = z.object({
  name: z.string().min(1).max(160),
  email: z.string().email().max(254).optional(),
  phone: z.string().min(7).max(40).optional(),
  rsvpStatus: z.enum(["pending", "confirmed", "declined"]).optional(),
  mealPreference: z.string().max(200).optional(),
  plusOne: z.boolean().optional(),
  tableNumber: z.number().int().min(1).max(10000).optional(),
  groupName: z.string().max(120).optional(),
  category: z.enum(["general", "vip", "family", "friends", "kids", "vendor"]).optional(),
  selectedClientId: z.string().uuid().optional(),
});

const recordExpensePreviewInput = z.object({
  categoryName: z.string().min(1).max(120),
  payeeName: z.string().min(1).max(160),
  amount: z.number().positive().max(1_000_000_000),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(1000).optional(),
  selectedClientId: z.string().uuid().optional(),
});

const recordPaymentPreviewInput = z.object({
  categoryName: z.string().min(1).max(120),
  amount: z.number().positive().max(1_000_000_000),
  payeeName: z.string().min(1).max(160).optional(),
  vendorName: z.string().min(1).max(160).optional(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reference: z.string().max(160).optional(),
  notes: z.string().max(1000).optional(),
  selectedClientId: z.string().uuid().optional(),
}).refine((value) => Boolean(value.payeeName || value.vendorName), {
  message: "Provide payeeName or vendorName.",
});

const vendorFollowUpPreviewInput = z.object({
  coupleName: z.string().min(1).max(160),
  title: z.string().min(1).max(160),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(1000).optional(),
});

function registerGatewayTool(
  server: McpServer,
  capability: GatewayReadCapability,
  context: {
    supabase: any;
    userId: string;
    profile: Profile;
    requestId: string;
  },
) {
  const definition = getGatewayCapability(capability);
  if (!definition) throw new Error(`Unknown Gateway capability: ${capability}`);

  server.registerTool(
    capability,
    {
      title: capability.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" "),
      description: definition.description,
      inputSchema: capability === "search_zania_vendors" || capability === "discover_vendors"
        ? vendorSearchInput
        : capability === "get_negotiation_brief"
        ? negotiationBriefInput
        : capabilityInput,
      annotations: { ...READ_ANNOTATIONS, openWorldHint: definition.openWorld },
      securitySchemes: [{ type: "oauth2", scopes: [] }],
    },
    async (rawInput) => {
      const { selectedClientId, ...argumentsInput } = rawInput as {
        selectedClientId?: string;
        category?: string;
        location?: string;
        budgetMinKes?: number;
        budgetMaxKes?: number;
        services?: string[];
        limit?: number;
        quoteRequestId?: string;
        quoteDocumentId?: string;
        vendorName?: string;
        targetBudgetKes?: number;
        absoluteCeilingKes?: number;
        mustHave?: string[];
        willingToTrade?: string[];
        tone?: "gentle" | "commercial" | "planner";
      };
      const auditId = crypto.randomUUID();
      try {
        const result = await executeGatewayRead(
          context.supabase as BriefingDatabase,
          createGatewayRequest({
            actor: {
              userId: context.userId,
              tenantId: null,
              role: String(context.profile.role || "couple"),
              plannerType: typeof context.profile.planner_type === "string" ? context.profile.planner_type : null,
            },
            client: { type: "chatgpt", appId: "zania-mcp", sessionId: null },
            capability,
            selectedClientId: selectedClientId ?? null,
            arguments: capability === "search_zania_vendors" || capability === "discover_vendors" || capability === "get_negotiation_brief"
              ? argumentsInput
              : {},
            requestId: auditId,
            correlationId: context.requestId,
          }),
          new Date(),
          {
            externalVendorSearch: capability === "discover_vendors"
              && Deno.env.get("EXTERNAL_VENDOR_DISCOVERY_ENABLED") === "true"
              && Deno.env.get("OPENAI_API_KEY")
              ? async (intent) => {
                const { data: usageRows, error: usageError } = await context.supabase.rpc("get_ai_usage_status");
                if (usageError) throw new Error("Could not load the external discovery allowance.");
                const usageStatus = Array.isArray(usageRows) ? usageRows[0] : usageRows;
                if (usageStatus?.ai_enabled === false) throw new Error("AI assistant is disabled for this plan.");
                if ((usageStatus?.remaining_messages ?? 0) <= 0) throw new Error("The monthly AI message limit has been reached.");
                if (usageStatus?.monthly_cost_cap_usd != null && Number(usageStatus.remaining_cost_usd ?? 0) <= 0) {
                  throw new Error("The monthly assistant fair-use allowance has been reached.");
                }
                const externalResult = await searchExternalVendorsWithOpenAi({
                  apiKey: Deno.env.get("OPENAI_API_KEY")!,
                  model: Deno.env.get("OPENAI_VENDOR_DISCOVERY_MODEL") ?? "gpt-5.5",
                  intent,
                });
                const { usage } = externalResult;
                const { error: logError } = await context.supabase.rpc("log_ai_assistant_message", {
                  feature_input: "vendor_discovery_mcp",
                  model_input: usage.model,
                  provider_request_count_input: usage.providerRequestCount,
                  input_tokens_input: usage.inputTokens,
                  cached_input_tokens_input: usage.cachedInputTokens,
                  output_tokens_input: usage.outputTokens,
                  estimated_cost_usd_input: usage.estimatedCostUsd,
                });
                if (logError) throw new Error("Could not record external vendor discovery usage.");
                return externalResult;
              }
              : undefined,
          },
        );
        await logFunctionEvent({
          functionName: FUNCTION_NAME,
          severity: "info",
          status: "success",
          eventType: "intelligence_gateway_capability_succeeded",
          message: "Executed an authorized MCP Intelligence Gateway capability.",
          userId: context.userId,
          requestId: context.requestId,
          entityId: result.data.wedding?.id ?? null,
          details: {
            gatewayVersion: result.version,
            capability,
            capabilityVersion: definition.version,
            riskClass: definition.riskClass,
            clientType: "chatgpt",
            clientAppId: "zania-mcp",
            authorizationDecision: "allowed",
            confirmationStatus: "not_required",
            auditId: result.auditId,
          },
        });
        return {
          content: [{ type: "text" as const, text: result.userSummary }],
          structuredContent: { ...result },
        };
      } catch (error) {
        await logFunctionEvent({
          functionName: FUNCTION_NAME,
          severity: "warn",
          status: "failure",
          eventType: "intelligence_gateway_capability_failed",
          message: error instanceof Error ? error.message : "Gateway capability failed.",
          userId: context.userId,
          requestId: context.requestId,
          details: { capability, auditId, authorizationDecision: "denied_or_failed" },
        });
        throw error;
      }
    },
  );
}

Deno.serve(
  pipeline(
    [withOAuthProtectedResource(), withSupabase({ auth: "user" })],
    async (req, { supabase }) => {
      const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
      const authHeader = req.headers.get("Authorization");
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const user = authData?.user;
      if (authError || !user?.id || !authHeader) {
        return new Response("Unauthorized", { status: 401 });
      }

      let stage = "oauth_claims";
      try {
        assertOAuthClientAccessToken(authHeader);
        if (isTemporaryDemoUser(user)) return new Response("Demo accounts cannot connect external assistants.", { status: 403 });

        stage = "profile";
        const { data: profile, error: profileError } = await supabase.from("profiles")
          .select("role,planner_type,full_name,planning_pass_status,planning_pass_expires_at,planner_subscription_status,planner_subscription_expires_at,beta_trial_status,beta_trial_expires_at")
          .eq("user_id", user.id)
          .single();
        if (profileError || !profile) throw profileError || new Error("Zania profile was not found.");

        stage = "premium_access";
        if (!await hasPremiumAssistantAccess(supabase, user.id, profile as Profile)) {
          return new Response("Zania conversational planner access requires an active paid plan.", { status: 403 });
        }

        stage = "mcp_transport";
        const handler = createMcpHandler(() => {
        const server = new McpServer(
          { name: "zania-intelligence-gateway", version: "0.2.0" },
          {
            instructions: "Use the read tools for the signed-in user's authorized Zania records. Couples can read their wedding workspace, couples and planners can search approved Zania listings and source-backed public-web discovery results, professional planners can request a cross-wedding portfolio briefing, and vendors can request a lead, booking, payment and document briefing. Preserve vendor evidence and unknowns; never present results as current quotes or confirmed availability. A couple or planner may save one discovery result as a private candidate through preview, explicit confirmation and execution. Saving never contacts the vendor or creates a public profile. Task creation, task editing, guest addition, expense recording, payment recording and private vendor booking follow-ups use the same preview and confirmation rule. If the user declines, call the matching revoke tool. A linked planner's guest, budget, vendor-response tracker change, formal quote request, or formal quote change request becomes the application's normal couple-approval request. Recording an expense changes category spending only; it does not create a payment or change a vendor balance. Recording a payment records money that already changed hands, increases category spending and changes a linked vendor's recorded paid total; it never moves money, initiates Zania Pay or creates an invoice receipt. Treat vendor enquiry replies and amounts as evidence only. Use preview_apply_vendor_response and explicit confirmation before recording an indicative amount or marking an unavailable vendor rejected; neither action creates a formal quote or booking. Use get_formal_quote_summary for tracked request status and returned formal-document comparisons. Use get_negotiation_brief to prepare truthful, evidence-backed tradeoffs and a draft before any vendor contact; never invent a competing offer, urgency, price effect or vendor commitment. If the user explicitly asks to save the strategy and draft, use preview_save_negotiation_plan and explicit confirmation. It stores a private profile plus an unsent proposal draft; it never contacts the vendor or records an agreement. Use get_negotiation_state for saved targets, contacted proposal rounds, real revised-quote counteroffers and evidence-derived Deal State. Use get_agreement_review to compare an internal or externally uploaded contract with accepted formal-quote evidence. Distinguish unconfirmed AI extraction from user-confirmed facts, report factual differences and unknowns, and never present the result as legal advice. File selection stays in Zania's Received documents UI. Treat structured payment dates as proposed obligations only; create a task for each one only through preview and explicit confirmation. Drafts and conversation text alone never change Deal State. Keep formal totals separate from indicative enquiry amounts and never imply that comparison accepts a quote. Use preview_request_formal_vendor_quote for a connected tracker vendor; it creates a tracked in-app quote request without copying an indicative amount. Use preview_request_formal_quote_changes only for one returned quote that is still awaiting a response, and show the exact requested changes before confirmation. If the vendor is not connected, use the reviewed send_vendor_enquiry email flow. Vendor follow-ups are private to the signed-in vendor's own workspace and must resolve to one connected booking. Never infer permission or confirmation from conversation text. Use selectedClientId only for a planner's single-client wedding tools.",
          },
        );

        server.registerTool(
          "get_profile",
          {
            title: "Get Zania Profile",
            description: "Return the Zania profile represented by the authenticated credentials.",
            inputSchema: z.object({}),
            outputSchema: z.object({
              id: z.string().min(1),
              name: z.string().optional(),
              email: z.string().email().optional(),
              nickname: z.string().optional(),
            }),
            annotations: READ_ANNOTATIONS,
            securitySchemes: [{ type: "oauth2", scopes: [] }],
            _meta: { "openai/profile": true },
          },
          async () => {
            const result = {
              id: user.id,
              ...(typeof profile.full_name === "string" && profile.full_name ? { name: profile.full_name } : {}),
              ...(user.email ? { email: user.email } : {}),
              nickname: `${profile.full_name || user.email || "Zania user"} — ${profile.role || "couple"}`,
            };
            return {
              content: [{ type: "text" as const, text: JSON.stringify(result) }],
              structuredContent: result,
            };
          },
        );

        const actor = {
          userId: user.id,
          role: String(profile.role || "couple"),
          plannerType: typeof profile.planner_type === "string" ? profile.planner_type : null,
        };

        server.registerTool(
          "preview_create_task",
          {
            title: "Preview Create Task",
            description: "Interpret and preview one wedding task. This does not create the task. Show the exact preview to the user and ask for explicit confirmation before calling create_task.",
            inputSchema: createTaskPreviewInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ selectedClientId, ...taskInput }) => {
            const result = await previewCreateTask(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              selectedClientId ?? null,
              taskInput,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME,
              severity: "info",
              status: "success",
              eventType: "intelligence_gateway_write_previewed",
              message: "Prepared a create_task action for explicit confirmation.",
              userId: user.id,
              requestId,
              entityId: result.wedding.id,
              details: {
                capability: "create_task",
                riskClass: "B",
                clientType: "chatgpt",
                confirmationStatus: "pending",
                confirmationId: result.confirmationId,
                idempotencyKey: result.idempotencyKey,
              },
            });
            return {
              content: [{ type: "text" as const, text: result.userSummary }],
              structuredContent: result,
            };
          },
        );

        server.registerTool(
          "revoke_create_task_preview",
          {
            title: "Cancel Task Preview",
            description: "Revoke an unexecuted task preview when the user declines it. The confirmation cannot be used after revocation.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await revokeCreateTaskPreview(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              confirmationId,
              idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME,
              severity: "info",
              status: "success",
              eventType: "intelligence_gateway_write_revoked",
              message: "Revoked a pending create_task confirmation.",
              userId: user.id,
              requestId,
              details: {
                capability: "create_task",
                riskClass: "B",
                clientType: "chatgpt",
                authorizationDecision: "allowed",
                confirmationStatus: result.confirmationStatus,
                confirmationId,
                idempotencyKey,
              },
            });
            return {
              content: [{ type: "text" as const, text: result.userSummary }],
              structuredContent: result,
            };
          },
        );

        server.registerTool(
          "create_task",
          {
            title: "Create Confirmed Task",
            description: "Create the exact task from preview_create_task only after the user explicitly confirms that preview. Requires its confirmation ID and idempotency key.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await executeConfirmedCreateTask(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              confirmationId,
              idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME,
              severity: "info",
              status: "success",
              eventType: "intelligence_gateway_write_succeeded",
              message: "Created a task through a confirmed Intelligence Gateway action.",
              userId: user.id,
              requestId,
              entityId: result.task.id,
              details: {
                capability: "create_task",
                riskClass: "B",
                clientType: "chatgpt",
                authorizationDecision: "allowed",
                confirmationStatus: "confirmed",
                confirmationId,
                idempotencyKey,
              },
            });
            return {
              content: [{ type: "text" as const, text: result.userSummary }],
              structuredContent: result,
            };
          },
        );

        server.registerTool(
          "preview_update_task",
          {
            title: "Preview Task Update",
            description: "Preview exact changes to one wedding task. This does not change the task. Show the preview and ask for explicit confirmation before calling update_task.",
            inputSchema: updateTaskPreviewInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ selectedClientId, ...updateInput }) => {
            const result = await previewUpdateTask(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              selectedClientId ?? null,
              updateInput,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_previewed",
              message: "Prepared an update_task action for explicit confirmation.",
              userId: user.id, requestId, entityId: result.task.id,
              details: {
                capability: "update_task", riskClass: "B", clientType: "chatgpt",
                confirmationStatus: "pending", confirmationId: result.confirmationId,
                idempotencyKey: result.idempotencyKey,
              },
            });
            return {
              content: [{ type: "text" as const, text: result.userSummary }],
              structuredContent: result,
            };
          },
        );

        server.registerTool(
          "revoke_update_task_preview",
          {
            title: "Cancel Task Update Preview",
            description: "Revoke an unexecuted task update preview when the user declines it.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await revokeUpdateTaskPreview(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              confirmationId,
              idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_revoked",
              message: "Revoked a pending update_task confirmation.",
              userId: user.id, requestId,
              details: {
                capability: "update_task", riskClass: "B", clientType: "chatgpt",
                authorizationDecision: "allowed", confirmationStatus: result.confirmationStatus,
                confirmationId, idempotencyKey,
              },
            });
            return {
              content: [{ type: "text" as const, text: result.userSummary }],
              structuredContent: result,
            };
          },
        );

        server.registerTool(
          "update_task",
          {
            title: "Apply Confirmed Task Update",
            description: "Apply the exact update from preview_update_task only after explicit user confirmation.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await executeConfirmedUpdateTask(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              confirmationId,
              idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_succeeded",
              message: "Updated a task through a confirmed Intelligence Gateway action.",
              userId: user.id, requestId, entityId: result.task.id,
              details: {
                capability: "update_task", riskClass: "B", clientType: "chatgpt",
                authorizationDecision: "allowed", confirmationStatus: "confirmed",
                confirmationId, idempotencyKey,
              },
            });
            return {
              content: [{ type: "text" as const, text: result.userSummary }],
              structuredContent: result,
            };
          },
        );

        server.registerTool(
          "preview_add_guest",
          {
            title: "Preview Guest Addition",
            description: "Preview one guest addition. This does not add the guest. For a planner's linked couple, the confirmed action sends the existing couple-approval request instead of bypassing it.",
            inputSchema: addGuestPreviewInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ selectedClientId, ...guestInput }) => {
            const result = await previewAddGuest(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              selectedClientId ?? null,
              guestInput,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_previewed",
              message: "Prepared an add_guest action for explicit confirmation.",
              userId: user.id, requestId, entityId: result.wedding.id,
              details: {
                capability: "add_guest", riskClass: "B", clientType: "chatgpt",
                confirmationStatus: "pending", confirmationId: result.confirmationId,
                idempotencyKey: result.idempotencyKey, outcome: result.outcome,
              },
            });
            return {
              content: [{ type: "text" as const, text: result.userSummary }],
              structuredContent: result,
            };
          },
        );

        server.registerTool(
          "revoke_add_guest_preview",
          {
            title: "Cancel Guest Addition Preview",
            description: "Revoke an unexecuted guest addition preview when the user declines it.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await revokeAddGuestPreview(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              confirmationId,
              idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_revoked",
              message: "Revoked a pending add_guest confirmation.",
              userId: user.id, requestId,
              details: {
                capability: "add_guest", riskClass: "B", clientType: "chatgpt",
                authorizationDecision: "allowed", confirmationStatus: result.confirmationStatus,
                confirmationId, idempotencyKey,
              },
            });
            return {
              content: [{ type: "text" as const, text: result.userSummary }],
              structuredContent: result,
            };
          },
        );

        server.registerTool(
          "add_guest",
          {
            title: "Apply Confirmed Guest Addition",
            description: "Apply the exact guest addition from preview_add_guest only after explicit user confirmation.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await executeConfirmedAddGuest(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              confirmationId,
              idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_succeeded",
              message: result.outcome === "approval_requested"
                ? "Submitted a guest addition for couple approval through a confirmed Gateway action."
                : "Added a guest through a confirmed Gateway action.",
              userId: user.id, requestId,
              entityId: result.guest.id ?? result.approvalRequestId,
              details: {
                capability: "add_guest", riskClass: "B", clientType: "chatgpt",
                authorizationDecision: "allowed", confirmationStatus: "confirmed",
                confirmationId, idempotencyKey, outcome: result.outcome,
              },
            });
            return {
              content: [{ type: "text" as const, text: result.userSummary }],
              structuredContent: result,
            };
          },
        );

        server.registerTool(
          "preview_record_expense",
          {
            title: "Preview Expense",
            description: "Preview one expense against one safely resolved wedding budget category. Common wording may resolve to a single close category; ambiguous wording is rejected. This changes recorded category spending only and does not create a payment or change a vendor balance.",
            inputSchema: recordExpensePreviewInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ selectedClientId, ...expenseInput }) => {
            const result = await previewRecordExpense(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              selectedClientId ?? null,
              expenseInput,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_previewed",
              message: "Prepared a record_expense action for explicit confirmation.",
              userId: user.id, requestId, entityId: result.wedding.id,
              details: {
                capability: "record_expense", riskClass: "B", clientType: "chatgpt",
                confirmationStatus: "pending", confirmationId: result.confirmationId,
                idempotencyKey: result.idempotencyKey, outcome: result.outcome,
              },
            });
            return {
              content: [{ type: "text" as const, text: result.userSummary }],
              structuredContent: result,
            };
          },
        );

        server.registerTool(
          "revoke_record_expense_preview",
          {
            title: "Cancel Expense Preview",
            description: "Revoke an unexecuted expense preview when the user declines it.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await revokeRecordExpensePreview(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              confirmationId,
              idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_revoked",
              message: "Revoked a pending record_expense confirmation.",
              userId: user.id, requestId,
              details: {
                capability: "record_expense", riskClass: "B", clientType: "chatgpt",
                authorizationDecision: "allowed", confirmationStatus: result.confirmationStatus,
                confirmationId, idempotencyKey,
              },
            });
            return {
              content: [{ type: "text" as const, text: result.userSummary }],
              structuredContent: result,
            };
          },
        );

        server.registerTool(
          "record_expense",
          {
            title: "Record Confirmed Expense",
            description: "Record the exact expense from preview_record_expense only after explicit user confirmation. This does not create a payment or change a vendor balance.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await executeConfirmedRecordExpense(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              confirmationId,
              idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_succeeded",
              message: result.outcome === "approval_requested"
                ? "Submitted an expense update for couple approval through a confirmed Gateway action."
                : "Recorded an expense through a confirmed Gateway action.",
              userId: user.id, requestId,
              entityId: result.expense.id ?? result.approvalRequestId,
              details: {
                capability: "record_expense", riskClass: "B", clientType: "chatgpt",
                authorizationDecision: "allowed", confirmationStatus: "confirmed",
                confirmationId, idempotencyKey, outcome: result.outcome,
              },
            });
            return {
              content: [{ type: "text" as const, text: result.userSummary }],
              structuredContent: result,
            };
          },
        );

        server.registerTool(
          "preview_record_payment",
          {
            title: "Preview Payment Entry",
            description: "Preview money already paid against one wedding budget category and optionally one linked vendor. This does not change the ledger, move money, initiate Zania Pay or create an invoice receipt.",
            inputSchema: recordPaymentPreviewInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ selectedClientId, ...paymentInput }) => {
            const result = await previewRecordPayment(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              selectedClientId ?? null,
              paymentInput,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_previewed",
              message: "Prepared a record_payment action for explicit confirmation.",
              userId: user.id, requestId, entityId: result.wedding.id,
              details: {
                capability: "record_payment", riskClass: "B", clientType: "chatgpt",
                confirmationStatus: "pending", confirmationId: result.confirmationId,
                idempotencyKey: result.idempotencyKey, outcome: result.outcome,
              },
            });
            return {
              content: [{ type: "text" as const, text: result.userSummary }],
              structuredContent: result,
            };
          },
        );

        server.registerTool(
          "revoke_record_payment_preview",
          {
            title: "Cancel Payment Preview",
            description: "Revoke an unexecuted payment-entry preview when the user declines it.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await revokeRecordPaymentPreview(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              confirmationId,
              idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_revoked",
              message: "Revoked a pending record_payment confirmation.",
              userId: user.id, requestId,
              details: {
                capability: "record_payment", riskClass: "B", clientType: "chatgpt",
                authorizationDecision: "allowed", confirmationStatus: result.confirmationStatus,
                confirmationId, idempotencyKey,
              },
            });
            return {
              content: [{ type: "text" as const, text: result.userSummary }],
              structuredContent: result,
            };
          },
        );

        server.registerTool(
          "record_payment",
          {
            title: "Record Confirmed Payment",
            description: "Record the exact existing payment from preview_record_payment only after explicit confirmation. This changes the payment ledger and category spending and may update one vendor's recorded paid total; it never moves money or initiates Zania Pay.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await executeConfirmedRecordPayment(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              confirmationId,
              idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_succeeded",
              message: result.outcome === "approval_requested"
                ? "Submitted a payment entry for couple approval through a confirmed Gateway action."
                : "Recorded a payment through a confirmed Gateway action.",
              userId: user.id, requestId,
              entityId: result.payment.id ?? result.approvalRequestId,
              details: {
                capability: "record_payment", riskClass: "B", clientType: "chatgpt",
                authorizationDecision: "allowed", confirmationStatus: "confirmed",
                confirmationId, idempotencyKey, outcome: result.outcome,
              },
            });
            return {
              content: [{ type: "text" as const, text: result.userSummary }],
              structuredContent: result,
            };
          },
        );

        server.registerTool(
          "preview_create_vendor_follow_up_reminder",
          {
            title: "Preview Private Vendor Follow-up",
            description: "Preview one private reminder for a connected vendor booking. This does not create the reminder. It is available only to the signed-in vendor and safely resolves one booked couple by name.",
            inputSchema: vendorFollowUpPreviewInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async (followUpInput) => {
            const result = await previewCreateVendorFollowUp(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              followUpInput,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_previewed",
              message: "Prepared a private vendor follow-up for explicit confirmation.",
              userId: user.id, requestId, entityId: result.booking.id,
              details: {
                capability: "create_vendor_follow_up_reminder", riskClass: "B", clientType: "chatgpt",
                confirmationStatus: "pending", confirmationId: result.confirmationId,
                idempotencyKey: result.idempotencyKey,
              },
            });
            return {
              content: [{ type: "text" as const, text: result.userSummary }],
              structuredContent: result,
            };
          },
        );

        server.registerTool(
          "revoke_create_vendor_follow_up_reminder_preview",
          {
            title: "Cancel Private Vendor Follow-up Preview",
            description: "Revoke an unexecuted private vendor follow-up preview when the user declines it.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await revokeCreateVendorFollowUpPreview(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              confirmationId,
              idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_revoked",
              message: "Revoked a pending private vendor follow-up confirmation.",
              userId: user.id, requestId,
              details: {
                capability: "create_vendor_follow_up_reminder", riskClass: "B", clientType: "chatgpt",
                authorizationDecision: "allowed", confirmationStatus: result.confirmationStatus,
                confirmationId, idempotencyKey,
              },
            });
            return {
              content: [{ type: "text" as const, text: result.userSummary }],
              structuredContent: result,
            };
          },
        );

        server.registerTool(
          "create_vendor_follow_up_reminder",
          {
            title: "Create Confirmed Private Vendor Follow-up",
            description: "Create the exact private vendor follow-up from its preview only after explicit user confirmation.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await executeConfirmedCreateVendorFollowUp(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              confirmationId,
              idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_succeeded",
              message: "Created a private vendor follow-up through a confirmed Gateway action.",
              userId: user.id, requestId, entityId: result.reminder.id,
              details: {
                capability: "create_vendor_follow_up_reminder", riskClass: "B", clientType: "chatgpt",
                authorizationDecision: "allowed", confirmationStatus: "confirmed",
                confirmationId, idempotencyKey,
              },
            });
            return {
              content: [{ type: "text" as const, text: result.userSummary }],
              structuredContent: result,
            };
          },
        );

        server.registerTool(
          "preview_save_vendor_candidate",
          {
            title: "Preview Private Vendor Candidate",
            description: "Preview saving one source-backed discovery result as a private candidate. This does not contact the vendor or publish a profile. Show the preview and ask for explicit confirmation before saving.",
            inputSchema: saveVendorCandidatePreviewInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ selectedClientId, ...candidateInput }) => {
            const result = await previewSaveVendorCandidate(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              selectedClientId ?? null,
              candidateInput,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_previewed",
              message: "Prepared a private vendor candidate for explicit confirmation.",
              userId: user.id, requestId, entityId: result.wedding?.id ?? null,
              details: {
                capability: "save_vendor_candidate", riskClass: "B", clientType: "chatgpt",
                confirmationStatus: "pending", confirmationId: result.confirmationId,
                idempotencyKey: result.idempotencyKey,
              },
            });
            return {
              content: [{ type: "text" as const, text: result.userSummary }],
              structuredContent: result,
            };
          },
        );

        server.registerTool(
          "revoke_save_vendor_candidate_preview",
          {
            title: "Cancel Private Vendor Candidate Preview",
            description: "Revoke an unexecuted private vendor candidate preview when the user declines it.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await revokeSaveVendorCandidatePreview(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              confirmationId,
              idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_revoked",
              message: "Revoked a pending private vendor candidate confirmation.",
              userId: user.id, requestId,
              details: {
                capability: "save_vendor_candidate", riskClass: "B", clientType: "chatgpt",
                authorizationDecision: "allowed", confirmationStatus: result.confirmationStatus,
                confirmationId, idempotencyKey,
              },
            });
            return {
              content: [{ type: "text" as const, text: result.userSummary }],
              structuredContent: result,
            };
          },
        );

        server.registerTool(
          "save_vendor_candidate",
          {
            title: "Save Confirmed Private Vendor Candidate",
            description: "Save the exact private vendor candidate from its preview only after explicit user confirmation. This never contacts the vendor or publishes a profile.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await executeConfirmedSaveVendorCandidate(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              confirmationId,
              idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_succeeded",
              message: "Saved a private vendor candidate through a confirmed Gateway action.",
              userId: user.id, requestId, entityId: result.candidate.id,
              details: {
                capability: "save_vendor_candidate", riskClass: "B", clientType: "chatgpt",
                authorizationDecision: "allowed", confirmationStatus: "confirmed",
                confirmationId, idempotencyKey,
              },
            });
            return {
              content: [{ type: "text" as const, text: result.userSummary }],
              structuredContent: result,
            };
          },
        );

        server.registerTool(
          "preview_assign_vendor_candidate",
          {
            title: "Preview Private Vendor Candidate Assignment",
            description: "Preview assigning one unassigned private vendor candidate to one active planner client. This does not add it to the vendor tracker, contact the vendor, or create a booking. Show the preview and ask for explicit confirmation.",
            inputSchema: assignVendorCandidatePreviewInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async (input) => {
            const result = await previewAssignVendorCandidate(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              input,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_previewed",
              message: "Prepared a private vendor candidate assignment for explicit confirmation.",
              userId: user.id, requestId, entityId: result.interpretedAssignment.candidateId,
              details: {
                capability: "assign_vendor_candidate", riskClass: "B", clientType: "chatgpt",
                confirmationStatus: "pending", confirmationId: result.confirmationId,
                idempotencyKey: result.idempotencyKey, plannerClientId: result.interpretedAssignment.clientId,
              },
            });
            return { content: [{ type: "text" as const, text: result.userSummary }], structuredContent: result };
          },
        );

        server.registerTool(
          "revoke_assign_vendor_candidate_preview",
          {
            title: "Cancel Private Vendor Candidate Assignment",
            description: "Revoke an unexecuted private candidate assignment when the user declines it.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await revokeAssignVendorCandidatePreview(
              supabase as unknown as GatewayWriteDatabase, actor, confirmationId, idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_revoked",
              message: "Revoked a pending private vendor candidate assignment.",
              userId: user.id, requestId,
              details: {
                capability: "assign_vendor_candidate", riskClass: "B", clientType: "chatgpt",
                authorizationDecision: "allowed", confirmationStatus: result.confirmationStatus,
                confirmationId, idempotencyKey,
              },
            });
            return { content: [{ type: "text" as const, text: result.userSummary }], structuredContent: result };
          },
        );

        server.registerTool(
          "assign_vendor_candidate",
          {
            title: "Assign Confirmed Private Vendor Candidate",
            description: "Execute the exact private candidate assignment after explicit user confirmation. This does not change the vendor tracker, contact the vendor, or create a booking.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await executeConfirmedAssignVendorCandidate(
              supabase as unknown as GatewayWriteDatabase, actor, confirmationId, idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_succeeded",
              message: "Assigned a private vendor candidate through a confirmed Gateway action.",
              userId: user.id, requestId, entityId: result.assignment.candidateId,
              details: {
                capability: "assign_vendor_candidate", riskClass: "B", clientType: "chatgpt",
                authorizationDecision: "allowed", confirmationStatus: "confirmed",
                confirmationId, idempotencyKey, plannerClientId: result.assignment.clientId,
              },
            });
            return { content: [{ type: "text" as const, text: result.userSummary }], structuredContent: result };
          },
        );

        server.registerTool(
          "preview_promote_vendor_candidate",
          {
            title: "Preview Vendor Candidate Promotion",
            description: "Preview adding one scoped private candidate to the wedding vendor tracker as a shortlist or backup option. This does not contact the vendor or confirm a booking. Show the exact category, quote and selection state, then ask for explicit confirmation.",
            inputSchema: promoteVendorCandidatePreviewInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async (input) => {
            const result = await previewPromoteVendorCandidate(
              supabase as unknown as GatewayWriteDatabase, actor, input,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_previewed",
              message: "Prepared a private candidate promotion for explicit confirmation.",
              userId: user.id, requestId, entityId: result.interpretedPromotion.candidateId,
              details: {
                capability: "promote_vendor_candidate", riskClass: "B", clientType: "chatgpt",
                confirmationStatus: "pending", confirmationId: result.confirmationId,
                idempotencyKey: result.idempotencyKey, outcome: result.outcome,
              },
            });
            return { content: [{ type: "text" as const, text: result.userSummary }], structuredContent: result };
          },
        );

        server.registerTool(
          "revoke_promote_vendor_candidate_preview",
          {
            title: "Cancel Vendor Candidate Promotion",
            description: "Revoke an unexecuted vendor tracker promotion when the user declines it.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await revokePromoteVendorCandidatePreview(
              supabase as unknown as GatewayWriteDatabase, actor, confirmationId, idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_revoked",
              message: "Revoked a pending vendor candidate promotion.",
              userId: user.id, requestId,
              details: {
                capability: "promote_vendor_candidate", riskClass: "B", clientType: "chatgpt",
                authorizationDecision: "allowed", confirmationStatus: result.confirmationStatus,
                confirmationId, idempotencyKey,
              },
            });
            return { content: [{ type: "text" as const, text: result.userSummary }], structuredContent: result };
          },
        );

        server.registerTool(
          "promote_vendor_candidate",
          {
            title: "Add Confirmed Candidate to Vendor Tracker",
            description: "Execute the exact vendor tracker promotion after explicit confirmation. Linked planner clients use the couple approval workflow. This never contacts the vendor or confirms a booking.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await executeConfirmedPromoteVendorCandidate(
              supabase as unknown as GatewayWriteDatabase, actor, confirmationId, idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_succeeded",
              message: result.outcome === "approval_requested"
                ? "Submitted a private candidate promotion for couple approval through a confirmed Gateway action."
                : "Added a private candidate to the vendor tracker through a confirmed Gateway action.",
              userId: user.id, requestId, entityId: result.vendor.id,
              details: {
                capability: "promote_vendor_candidate", riskClass: "B", clientType: "chatgpt",
                authorizationDecision: "allowed", confirmationStatus: "confirmed",
                confirmationId, idempotencyKey, outcome: result.outcome,
                candidateId: result.vendor.candidateId,
              },
            });
            return { content: [{ type: "text" as const, text: result.userSummary }], structuredContent: result };
          },
        );

        server.registerTool(
          "preview_send_vendor_enquiry",
          {
            title: "Preview Vendor Enquiry Email",
            description: "Prepare an email enquiry to one vendor already in the active wedding tracker. Show the exact recipient, subject and message and ask for explicit confirmation. This does not create a booking, accept a quote or invite the vendor into the workspace.",
            inputSchema: sendVendorEnquiryPreviewInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async (input) => {
            const result = await previewSendVendorEnquiry(
              supabase as unknown as GatewayWriteDatabase,
              actor,
              input.selectedClientId ?? null,
              input,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_previewed",
              message: "Prepared a vendor enquiry email for explicit confirmation.",
              userId: user.id, requestId, entityId: result.interpretedEnquiry.vendorId,
              details: {
                capability: "send_vendor_enquiry", riskClass: "C", clientType: "chatgpt",
                confirmationStatus: "pending", confirmationId: result.confirmationId,
                idempotencyKey: result.idempotencyKey,
              },
            });
            return { content: [{ type: "text" as const, text: result.userSummary }], structuredContent: result };
          },
        );

        server.registerTool(
          "revoke_send_vendor_enquiry_preview",
          {
            title: "Cancel Vendor Enquiry Email",
            description: "Cancel a pending vendor enquiry preview. No email is sent.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await revokeSendVendorEnquiryPreview(
              supabase as unknown as GatewayWriteDatabase, actor, confirmationId, idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_revoked",
              message: "Cancelled a pending vendor enquiry email.", userId: user.id, requestId,
              details: {
                capability: "send_vendor_enquiry", riskClass: "C", clientType: "chatgpt",
                confirmationStatus: result.confirmationStatus, confirmationId, idempotencyKey,
              },
            });
            return { content: [{ type: "text" as const, text: result.userSummary }], structuredContent: result };
          },
        );

        server.registerTool(
          "send_vendor_enquiry",
          {
            title: "Send Confirmed Vendor Enquiry Email",
            description: "Send the exact vendor enquiry email after explicit confirmation and store the provider receipt. This remains an enquiry and does not create a booking or accept a quote.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await executeConfirmedSendVendorEnquiry(
              supabase as unknown as GatewayWriteDatabase, actor, confirmationId, idempotencyKey,
              deliverVendorEnquiryWithResend,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME,
              severity: result.deliveryStatus === "failed" ? "warning" : "info",
              status: result.deliveryStatus === "failed" ? "failure" : "success",
              eventType: result.deliveryStatus === "failed" ? "intelligence_gateway_delivery_failed" : "intelligence_gateway_write_succeeded",
              message: result.deliveryStatus === "sent"
                ? "Sent a confirmed vendor enquiry email."
                : result.deliveryStatus === "pending_approval"
                ? "Submitted a confirmed vendor enquiry for couple approval."
                : "A confirmed vendor enquiry email failed delivery.",
              userId: user.id, requestId, entityId: result.enquiry.id,
              details: {
                capability: "send_vendor_enquiry", riskClass: "C", clientType: "chatgpt",
                authorizationDecision: "allowed", confirmationStatus: "confirmed",
                confirmationId, idempotencyKey, deliveryStatus: result.deliveryStatus,
              },
            });
            return { content: [{ type: "text" as const, text: result.userSummary }], structuredContent: result };
          },
        );

        server.registerTool(
          "preview_apply_vendor_response",
          {
            title: "Preview Vendor Response Tracker Action",
            description: "Prepare a tracker change from one recorded vendor enquiry response. This rechecks the exact reply and always requires explicit confirmation. It never creates a formal quote or booking.",
            inputSchema: applyVendorResponsePreviewInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async (input) => {
            const result = await previewApplyVendorResponse(
              supabase as unknown as GatewayWriteDatabase, actor, input.selectedClientId ?? null, input,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_previewed",
              message: "Prepared a vendor response tracker action for explicit confirmation.",
              userId: user.id, requestId, entityId: result.response.vendorId,
              details: {
                capability: "apply_vendor_response", riskClass: "B", clientType: "chatgpt",
                confirmationStatus: "pending", confirmationId: result.confirmationId,
                idempotencyKey: result.idempotencyKey, outcome: result.outcome,
              },
            });
            return { content: [{ type: "text" as const, text: result.userSummary }], structuredContent: result };
          },
        );

        server.registerTool(
          "revoke_apply_vendor_response_preview",
          {
            title: "Cancel Vendor Response Tracker Action",
            description: "Cancel a pending vendor response tracker action. No tracker state changes.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await revokeApplyVendorResponsePreview(
              supabase as unknown as GatewayWriteDatabase, actor, confirmationId, idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_revoked", message: "Cancelled a pending vendor response tracker action.",
              userId: user.id, requestId,
              details: {
                capability: "apply_vendor_response", riskClass: "B", clientType: "chatgpt",
                confirmationStatus: result.confirmationStatus, confirmationId, idempotencyKey,
              },
            });
            return { content: [{ type: "text" as const, text: result.userSummary }], structuredContent: result };
          },
        );

        server.registerTool(
          "apply_vendor_response",
          {
            title: "Apply Confirmed Vendor Response Action",
            description: "Apply a previously previewed and explicitly confirmed vendor response tracker action. Linked planners create a couple approval request.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await executeConfirmedApplyVendorResponse(
              supabase as unknown as GatewayWriteDatabase, actor, confirmationId, idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_succeeded",
              message: result.outcome === "approval_requested"
                ? "Submitted a vendor response tracker action for couple approval."
                : "Applied a confirmed vendor response action to the tracker.",
              userId: user.id, requestId, entityId: result.vendor.id,
              details: {
                capability: "apply_vendor_response", riskClass: "B", clientType: "chatgpt",
                authorizationDecision: "allowed", confirmationStatus: "confirmed",
                confirmationId, idempotencyKey, outcome: result.outcome,
              },
            });
            return { content: [{ type: "text" as const, text: result.userSummary }], structuredContent: result };
          },
        );

        server.registerTool(
          "preview_request_formal_vendor_quote",
          {
            title: "Preview Formal Vendor Quote Request",
            description: "Prepare a tracked in-app formal quote request for one connected tracker vendor. Show the exact message and ask for explicit confirmation. Any earlier response amount remains indicative and is not copied into the formal request.",
            inputSchema: requestFormalVendorQuotePreviewInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async (input) => {
            const result = await previewRequestFormalVendorQuote(
              supabase as unknown as GatewayWriteDatabase, actor, input.selectedClientId ?? null, input,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_previewed",
              message: "Prepared a formal vendor quote request for explicit confirmation.",
              userId: user.id, requestId, entityId: result.interpretedRequest.vendorId,
              details: {
                capability: "request_formal_vendor_quote", riskClass: "C", clientType: "chatgpt",
                confirmationStatus: "pending", confirmationId: result.confirmationId,
                idempotencyKey: result.idempotencyKey, outcome: result.outcome,
              },
            });
            return { content: [{ type: "text" as const, text: result.userSummary }], structuredContent: result };
          },
        );

        server.registerTool(
          "revoke_request_formal_vendor_quote_preview",
          {
            title: "Cancel Formal Vendor Quote Request",
            description: "Cancel a pending formal quote request preview. No request is sent.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await revokeRequestFormalVendorQuotePreview(
              supabase as unknown as GatewayWriteDatabase, actor, confirmationId, idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_revoked", message: "Cancelled a pending formal vendor quote request.",
              userId: user.id, requestId,
              details: {
                capability: "request_formal_vendor_quote", riskClass: "C", clientType: "chatgpt",
                confirmationStatus: result.confirmationStatus, confirmationId, idempotencyKey,
              },
            });
            return { content: [{ type: "text" as const, text: result.userSummary }], structuredContent: result };
          },
        );

        server.registerTool(
          "request_formal_vendor_quote",
          {
            title: "Send Confirmed Formal Vendor Quote Request",
            description: "Create the exact tracked formal quote request after explicit confirmation. Linked planners create a couple approval request first.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await executeConfirmedRequestFormalVendorQuote(
              supabase as unknown as GatewayWriteDatabase, actor, confirmationId, idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_succeeded",
              message: result.outcome === "approval_requested"
                ? "Submitted a formal vendor quote request for couple approval."
                : "Created a confirmed formal vendor quote request.",
              userId: user.id, requestId, entityId: result.quoteRequest.id,
              details: {
                capability: "request_formal_vendor_quote", riskClass: "C", clientType: "chatgpt",
                authorizationDecision: "allowed", confirmationStatus: "confirmed",
                confirmationId, idempotencyKey, outcome: result.outcome,
              },
            });
            return { content: [{ type: "text" as const, text: result.userSummary }], structuredContent: result };
          },
        );

        server.registerTool(
          "preview_request_formal_quote_changes",
          {
            title: "Preview Formal Quote Changes",
            description: "Prepare exact requested changes for one returned formal quote. Recheck the quote state, show the exact message, and require explicit confirmation. Linked planners send the request to the couple for approval first.",
            inputSchema: requestFormalQuoteChangesPreviewInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async (input) => {
            const result = await previewRequestFormalQuoteChanges(
              supabase as unknown as GatewayWriteDatabase, actor, input.selectedClientId ?? null, input,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_previewed",
              message: "Prepared formal quote changes for explicit confirmation.",
              userId: user.id, requestId, entityId: result.interpretedRequest.quoteDocumentId,
              details: {
                capability: "request_formal_quote_changes", riskClass: "C", clientType: "chatgpt",
                confirmationStatus: "pending", confirmationId: result.confirmationId,
                idempotencyKey: result.idempotencyKey, outcome: result.outcome,
              },
            });
            return { content: [{ type: "text" as const, text: result.userSummary }], structuredContent: result };
          },
        );

        server.registerTool(
          "revoke_request_formal_quote_changes_preview",
          {
            title: "Cancel Formal Quote Changes",
            description: "Cancel a pending formal quote change preview. The vendor sees no request.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await revokeRequestFormalQuoteChangesPreview(
              supabase as unknown as GatewayWriteDatabase, actor, confirmationId, idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_revoked", message: "Cancelled pending formal quote changes.",
              userId: user.id, requestId,
              details: {
                capability: "request_formal_quote_changes", riskClass: "C", clientType: "chatgpt",
                confirmationStatus: result.confirmationStatus, confirmationId, idempotencyKey,
              },
            });
            return { content: [{ type: "text" as const, text: result.userSummary }], structuredContent: result };
          },
        );

        server.registerTool(
          "request_formal_quote_changes",
          {
            title: "Send Confirmed Formal Quote Changes",
            description: "Send the exact requested changes after explicit confirmation. Linked planners create a couple approval request first.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await executeConfirmedRequestFormalQuoteChanges(
              supabase as unknown as GatewayWriteDatabase, actor, confirmationId, idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_succeeded",
              message: result.outcome === "approval_requested"
                ? "Submitted formal quote changes for couple approval."
                : "Sent confirmed formal quote changes.",
              userId: user.id, requestId, entityId: result.quoteResponse.id,
              details: {
                capability: "request_formal_quote_changes", riskClass: "C", clientType: "chatgpt",
                authorizationDecision: "allowed", confirmationStatus: "confirmed",
                confirmationId, idempotencyKey, outcome: result.outcome,
              },
            });
            return { content: [{ type: "text" as const, text: result.userSummary }], structuredContent: result };
          },
        );

        server.registerTool(
          "preview_save_negotiation_plan",
          {
            title: "Preview Negotiation Plan",
            description: "Prepare a private negotiation profile and one unsent proposal draft for a returned KES formal quote. Show the exact targets and draft, then ask for explicit confirmation. This does not contact the vendor or record an agreement.",
            inputSchema: saveNegotiationPlanPreviewInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async (input) => {
            const result = await previewSaveNegotiationPlan(
              supabase as unknown as GatewayWriteDatabase, actor, input.selectedClientId ?? null, input,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_previewed",
              message: "Prepared a negotiation profile and unsent draft for explicit confirmation.",
              userId: user.id, requestId, entityId: result.interpretedPlan.quoteDocumentId,
              details: {
                capability: "save_negotiation_plan", riskClass: "B", clientType: "chatgpt",
                confirmationStatus: "pending", confirmationId: result.confirmationId,
                idempotencyKey: result.idempotencyKey,
              },
            });
            return { content: [{ type: "text" as const, text: result.userSummary }], structuredContent: result };
          },
        );

        server.registerTool(
          "revoke_save_negotiation_plan_preview",
          {
            title: "Cancel Negotiation Plan",
            description: "Cancel a pending negotiation-plan preview. No profile or proposal draft is saved.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await revokeSaveNegotiationPlanPreview(
              supabase as unknown as GatewayWriteDatabase, actor, confirmationId, idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_revoked", message: "Cancelled a pending negotiation plan.",
              userId: user.id, requestId,
              details: {
                capability: "save_negotiation_plan", riskClass: "B", clientType: "chatgpt",
                confirmationStatus: result.confirmationStatus, confirmationId, idempotencyKey,
              },
            });
            return { content: [{ type: "text" as const, text: result.userSummary }], structuredContent: result };
          },
        );

        server.registerTool(
          "save_negotiation_plan",
          {
            title: "Save Confirmed Negotiation Plan",
            description: "Save the previously previewed private negotiation profile and unsent proposal draft after explicit confirmation. No vendor is contacted and no agreement is recorded.",
            inputSchema: createTaskConfirmationInput,
            annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
            securitySchemes: [{ type: "oauth2", scopes: [] }],
          },
          async ({ confirmationId, idempotencyKey }) => {
            const result = await executeConfirmedSaveNegotiationPlan(
              supabase as unknown as GatewayWriteDatabase, actor, confirmationId, idempotencyKey,
            );
            await logFunctionEvent({
              functionName: FUNCTION_NAME, severity: "info", status: "success",
              eventType: "intelligence_gateway_write_succeeded",
              message: "Saved a confirmed negotiation profile and unsent draft proposal.",
              userId: user.id, requestId, entityId: result.proposal.id,
              details: {
                capability: "save_negotiation_plan", riskClass: "B", clientType: "chatgpt",
                authorizationDecision: "allowed", confirmationStatus: "confirmed",
                confirmationId, idempotencyKey, contactStatus: result.proposal.contactStatus,
              },
            });
            return { content: [{ type: "text" as const, text: result.userSummary }], structuredContent: result };
          },
        );

        const context = { supabase, userId: user.id, profile: profile as Profile, requestId };
        for (const capability of [
          "get_my_weddings",
          "get_wedding_summary",
          "get_weekly_focus",
          "get_budget_summary",
          "get_upcoming_payments",
          "get_tasks",
          "get_guest_summary",
          "get_vendor_summary",
          "get_formal_quote_summary",
          "get_negotiation_brief",
          "get_negotiation_state",
          "get_agreement_review",
          "get_vendor_candidates",
          "get_timeline_summary",
          "discover_vendors",
          "search_zania_vendors",
          "get_planner_portfolio_briefing",
          "get_vendor_business_briefing",
        ] as const) {
          registerGatewayTool(server, capability, context);
        }
        return server;
        });

        return await handler.fetch(req);
      } catch (error) {
        const causeCode = error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code || "UNKNOWN")
          : error instanceof Error
          ? error.name
          : "UNKNOWN";
        console.error("[intelligence-gateway-mcp] request failed", {
          requestId,
          stage,
          causeCode,
          message: error instanceof Error ? error.message : String(error),
        });
        return Response.json(
          {
            error: stage === "oauth_claims" ? "Invalid OAuth client token." : "MCP request failed.",
            code: stage === "oauth_claims" ? "INVALID_OAUTH_CLIENT_TOKEN" : "MCP_REQUEST_FAILED",
            stage,
            causeCode,
            requestId,
          },
          { status: stage === "oauth_claims" ? 401 : 500 },
        );
      }
    },
  ),
);
