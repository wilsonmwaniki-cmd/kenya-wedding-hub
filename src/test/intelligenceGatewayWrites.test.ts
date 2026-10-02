import { describe, expect, it } from "vitest";

import {
  executeConfirmedAssignVendorCandidate,
  executeConfirmedApplyVendorResponse,
  executeConfirmedPromoteVendorCandidate,
  executeConfirmedRequestFormalVendorQuote,
  executeConfirmedRequestFormalQuoteChanges,
  executeConfirmedSaveNegotiationPlan,
  executeConfirmedSendVendorEnquiry,
  executeConfirmedAddGuest,
  executeConfirmedCreateTask,
  executeConfirmedCreateVendorFollowUp,
  executeConfirmedRecordExpense,
  executeConfirmedRecordPayment,
  executeConfirmedSaveVendorCandidate,
  executeConfirmedUpdateTask,
  normalizeAddGuestArguments,
  normalizeCreateTaskArguments,
  normalizeCreateVendorFollowUpArguments,
  normalizeRecordExpenseArguments,
  normalizeRecordPaymentArguments,
  previewAddGuest,
  previewAssignVendorCandidate,
  previewApplyVendorResponse,
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
} from "../../supabase/functions/_shared/intelligenceGatewayWrites";

const USER_ID = "d6639086-069f-4b44-8394-f092e5a89a17";
const WEDDING_ID = "35aae314-d77e-47e5-bd13-d89d8605b8f8";
const VENDOR_LISTING_ID = "6fdd176d-287e-4fd3-bcfa-d7962cf485a5";
const VENDOR_BOOKING_ID = "ff54fbde-d42a-4f73-99d1-079358f004f3";
const COUPLE_USER_ID = "af4ac9da-126d-4c2e-b0db-b5335f6a39bb";

type Row = Record<string, unknown>;

class FakeQuery implements PromiseLike<{ data: Row[] | null; error: null; count: number }> {
  private filters: Array<[string, unknown]> = [];
  private inFilters: Array<[string, unknown[]]> = [];
  private operation: "select" | "insert" | "upsert" | "update" = "select";
  private values: Row | null = null;

  constructor(private db: FakeDb, private table: string) {}
  select() { return this; }
  eq(field: string, value: unknown) { this.filters.push([field, value]); return this; }
  is(field: string, value: null) { this.filters.push([field, value]); return this; }
  in(field: string, values: unknown[]) { this.inFilters.push([field, values]); return this; }
  order() { return this; }
  range() { return this; }
  limit() { return this; }
  insert(values: Row) { this.operation = "insert"; this.values = values; return this; }
  upsert(values: Row) { this.operation = "upsert"; this.values = values; return this; }
  update(values: Row) { this.operation = "update"; this.values = values; return this; }

  private matches(row: Row) {
    return this.filters.every(([field, value]) => row[field] === value)
      && this.inFilters.every(([field, values]) => values.includes(row[field]));
  }

  private readRows() {
    if (this.table === "wedding_memberships") return [{ wedding_id: WEDDING_ID }];
    if (this.table === "weddings") return [this.db.wedding];
    if (this.table === "planner_clients") return this.db.plannerClients.filter((row) => this.matches(row));
    if (this.table === "intelligence_gateway_confirmations") return this.db.confirmations.filter((row) => this.matches(row));
    if (this.table === "tasks") return this.db.tasks.filter((row) => this.matches(row));
    if (this.table === "guests") return this.db.guests.filter((row) => this.matches(row));
    if (this.table === "planner_change_requests") return this.db.changeRequests.filter((row) => this.matches(row));
    if (this.table === "budget_categories") return this.db.budgetCategories.filter((row) => this.matches(row));
    if (this.table === "budget_expense_adjustments") return this.db.expenses.filter((row) => this.matches(row));
    if (this.table === "budget_payments") return this.db.budgetPayments.filter((row) => this.matches(row));
    if (this.table === "vendor_listings") return this.db.vendorListings.filter((row) => this.matches(row));
    if (this.table === "vendors") return this.db.vendors.filter((row) => this.matches(row));
    if (this.table === "profiles") return this.db.profiles.filter((row) => this.matches(row));
    if (this.table === "vendor_follow_up_reminders") return this.db.vendorFollowUps.filter((row) => this.matches(row));
    if (this.table === "vendor_candidates") return this.db.vendorCandidates.filter((row) => this.matches(row));
    if (this.table === "vendor_enquiries") return this.db.vendorEnquiries.filter((row) => this.matches(row));
    if (this.table === "vendor_enquiry_responses") return this.db.vendorEnquiryResponses.filter((row) => this.matches(row));
    if (this.table === "document_requests") return this.db.documentRequests.filter((row) => this.matches(row));
    return [];
  }

  private mutate() {
    if (!this.values) return null;
    const rows = this.table === "tasks" ? this.db.tasks
      : this.table === "guests" ? this.db.guests
      : this.table === "planner_change_requests" ? this.db.changeRequests
      : this.table === "budget_expense_adjustments" ? this.db.expenses
      : this.table === "budget_payments" ? this.db.budgetPayments
      : this.table === "vendor_follow_up_reminders" ? this.db.vendorFollowUps
      : this.table === "vendor_candidates" ? this.db.vendorCandidates
      : this.table === "vendors" ? this.db.vendors
      : this.table === "vendor_enquiries" ? this.db.vendorEnquiries
      : this.db.confirmations;
    if (this.operation === "insert") {
      const created = {
        id: crypto.randomUUID(),
        ...(this.table === "vendor_enquiries" ? { response_token: crypto.randomUUID() } : {}),
        ...this.values,
      };
      rows.push(created);
      if (this.table === "budget_expense_adjustments") {
        const category = this.db.budgetCategories.find((row) => row.id === created.budget_category_id);
        if (category) category.spent = Number(category.spent ?? 0) + Number(created.amount ?? 0);
      }
      return rows.at(-1)!;
    }
    if (this.operation === "upsert") {
      const existing = rows.find((row) => row.gateway_idempotency_key === this.values!.gateway_idempotency_key);
      if (existing) return Object.assign(existing, this.values);
      const created = {
        id: crypto.randomUUID(),
        ...(this.table === "vendor_enquiries" ? { response_token: crypto.randomUUID() } : {}),
        ...this.values,
      };
      rows.push(created);
      return created;
    }
    const existing = rows.find((row) => this.matches(row));
    return existing ? Object.assign(existing, this.values) : null;
  }

  async maybeSingle() {
    if (this.operation !== "select") return { data: this.mutate(), error: null };
    return { data: this.readRows()[0] ?? null, error: null };
  }

  async single() {
    if (this.operation !== "select") return { data: this.mutate(), error: null };
    return { data: this.readRows()[0] ?? null, error: null };
  }

  then<TResult1 = { data: Row[] | null; error: null; count: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[] | null; error: null; count: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.readRows(), error: null, count: this.readRows().length }).then(onfulfilled, onrejected);
  }
}

class FakeDb {
  wedding = { id: WEDDING_ID, name: "Test Wedding", wedding_date: "2027-01-10", status: "active", deleted_at: null };
  confirmations: Row[] = [];
  tasks: Row[] = [];
  guests: Row[] = [];
  changeRequests: Row[] = [];
  plannerClients: Row[] = [];
  budgetCategories: Row[] = [{
    id: "70d4c5d7-1356-47c1-9449-c726f69a77ef",
    user_id: USER_ID,
    wedding_id: WEDDING_ID,
    name: "Photographer",
    spent: 1000,
    budget_scope: "wedding",
  }];
  expenses: Row[] = [];
  budgetPayments: Row[] = [];
  vendorListings: Row[] = [{ id: VENDOR_LISTING_ID, user_id: USER_ID, business_name: "Mwaniki Photo" }];
  vendors: Row[] = [{
    id: VENDOR_BOOKING_ID,
    user_id: COUPLE_USER_ID,
    wedding_id: WEDDING_ID,
    vendor_listing_id: VENDOR_LISTING_ID,
    client_id: null,
    email: "hello@mwanikiphoto.test",
    category: "Photography",
    name: "Mwaniki Photo",
    price: 5000,
    deposit_amount: 500,
    amount_paid: 0,
    payment_status: "deposit_due",
  }];
  profiles: Row[] = [
    { user_id: USER_ID, full_name: "Amina & Kamau", wedding_date: "2027-01-10" },
    { user_id: COUPLE_USER_ID, full_name: "Amina & Kamau", wedding_date: "2027-01-10" },
  ];
  vendorFollowUps: Row[] = [];
  vendorCandidates: Row[] = [];
  vendorEnquiries: Row[] = [];
  vendorEnquiryResponses: Row[] = [];
  documentRequests: Row[] = [];
  formalQuoteBriefingRequests: Row[] = [];
  commercialQuoteResponses: Row[] = [];
  negotiationProfiles: Row[] = [];
  negotiationProposals: Row[] = [];
  from(table: string) { return new FakeQuery(this, table); }
  async rpc(functionName: string, args: Record<string, unknown>) {
    if (functionName === "get_formal_quote_briefing") {
      return { data: { requests: this.formalQuoteBriefingRequests }, error: null };
    }
    if (functionName === "request_formal_quote_changes") {
      const existing = this.commercialQuoteResponses.find((row) => row.gateway_idempotency_key === args.gateway_idempotency_key_input);
      if (existing) return { data: existing, error: null };
      const request = this.formalQuoteBriefingRequests.find((row) => (
        (row.formalQuote as Row | undefined)?.id === args.target_document_id
      ));
      if (!request || request.status !== "responded" || (request.formalQuote as Row).status !== "sent") {
        return { data: null, error: { message: "This formal quote is no longer awaiting changes" } };
      }
      const created = {
        id: crypto.randomUUID(), document_id: args.target_document_id,
        response: "changes_requested", message: args.change_message,
        gateway_idempotency_key: args.gateway_idempotency_key_input,
      };
      this.commercialQuoteResponses.push(created);
      request.status = "changes_requested";
      (request.formalQuote as Row).status = "changes_requested";
      return { data: created, error: null };
    }
    if (functionName === "save_negotiation_plan") {
      const existingProposal = this.negotiationProposals.find((row) => (
        row.gateway_idempotency_key === args.gateway_idempotency_key_input
      ));
      if (existingProposal) {
        return { data: {
          profileId: existingProposal.negotiation_profile_id,
          proposalId: existingProposal.id,
          roundNumber: existingProposal.round_number,
        }, error: null };
      }
      const request = this.formalQuoteBriefingRequests.find((row) => (
        row.id === args.quote_request_id_input
        && (row.formalQuote as Row | undefined)?.id === args.quote_document_id_input
      ));
      if (!request || request.status !== "responded" || (request.formalQuote as Row).status !== "sent") {
        return { data: null, error: { message: "This formal quote is no longer open for negotiation" } };
      }
      const existingProfile = this.negotiationProfiles.find((row) => (
        row.wedding_id === args.wedding_id_input && row.quote_document_id === args.quote_document_id_input
      ));
      const profile = existingProfile ?? {
        id: crypto.randomUUID(), wedding_id: args.wedding_id_input,
        quote_request_id: args.quote_request_id_input, quote_document_id: args.quote_document_id_input,
      };
      Object.assign(profile, {
        target_budget_kes: args.target_budget_kes_input,
        absolute_ceiling_kes: args.absolute_ceiling_kes_input,
        must_have: args.must_have_input, willing_to_trade: args.willing_to_trade_input,
        tone: args.tone_input,
      });
      if (!existingProfile) this.negotiationProfiles.push(profile);
      const proposal = {
        id: crypto.randomUUID(), negotiation_profile_id: profile.id,
        round_number: this.negotiationProposals.filter((row) => row.negotiation_profile_id === profile.id).length + 1,
        direction: "outbound", status: "draft", contact_status: "not_contacted",
        message: args.draft_message_input, proposed_total_kes: args.proposed_total_kes_input,
        gateway_idempotency_key: args.gateway_idempotency_key_input,
      };
      this.negotiationProposals.push(proposal);
      return { data: { profileId: profile.id, proposalId: proposal.id, roundNumber: proposal.round_number }, error: null };
    }
    if (functionName === "request_vendor_quote") {
      const vendor = this.vendors.find((row) => row.id === args.target_vendor_id);
      const listing = this.vendorListings.find((row) => row.id === vendor?.vendor_listing_id);
      if (!vendor || !listing?.user_id) return { data: null, error: { message: "Vendor is not connected" } };
      const existing = this.documentRequests.find((row) => (
        row.requester_user_id === USER_ID && row.vendor_id === vendor.id
        && row.request_type === "quote" && ["new", "viewed", "changes_requested"].includes(String(row.status))
      ));
      if (existing) return { data: existing, error: null };
      const created = {
        id: crypto.randomUUID(), requester_user_id: USER_ID, recipient_user_id: listing.user_id,
        request_type: "quote", status: "new", wedding_id: WEDDING_ID,
        client_id: vendor.client_id ?? null, vendor_id: vendor.id, vendor_listing_id: listing.id,
        message: args.request_message, budget_amount: args.request_budget_amount,
      };
      this.documentRequests.push(created);
      return { data: created, error: null };
    }
    if (functionName === "record_budget_payment_gateway") {
      const existing = this.budgetPayments.find((row) => (
        row.gateway_idempotency_key === args.gateway_idempotency_key_input
      ));
      if (existing) return { data: existing.id, error: null };
      const created = {
        id: crypto.randomUUID(),
        user_id: USER_ID,
        client_id: args.target_client_id,
        wedding_id: args.target_wedding_id,
        budget_category_id: args.target_budget_category_id,
        vendor_id: args.target_vendor_id,
        budget_scope: "wedding",
        category_name: "Photographer",
        payee_name: args.payee_name_input,
        amount: args.amount_input,
        payment_date: args.payment_date_input,
        reference: args.reference_input,
        notes: args.notes_input,
        gateway_idempotency_key: args.gateway_idempotency_key_input,
      };
      this.budgetPayments.push(created);
      const category = this.budgetCategories.find((row) => row.id === args.target_budget_category_id);
      if (category) category.spent = Number(category.spent ?? 0) + Number(args.amount_input ?? 0);
      if (args.target_vendor_id) {
        const vendor = this.vendors.find((row) => row.id === args.target_vendor_id);
        if (vendor) {
          const totalPaid = this.budgetPayments.filter((row) => row.vendor_id === vendor.id)
            .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
          vendor.amount_paid = totalPaid;
          vendor.payment_status = totalPaid >= Number(vendor.price ?? 0) ? "paid_full"
            : totalPaid === Number(vendor.deposit_amount ?? 0) ? "deposit_paid" : "part_paid";
        }
      }
      return { data: created.id, error: null };
    }
    if (functionName !== "create_vendor_follow_up_reminder_gateway") return { data: null, error: { message: "Unknown RPC" } };
    const existing = this.vendorFollowUps.find((row) => (
      row.gateway_idempotency_key === args.gateway_idempotency_key_input
    ));
    if (existing) return { data: existing.id, error: null };
    const created = {
      id: crypto.randomUUID(),
      vendor_id: args.target_vendor_id,
      vendor_listing_id: VENDOR_LISTING_ID,
      created_by_user_id: USER_ID,
      title: args.title_input,
      notes: args.notes_input,
      due_date: args.due_date_input,
      status: "open",
      gateway_idempotency_key: args.gateway_idempotency_key_input,
    };
    this.vendorFollowUps.push(created);
    return { data: created.id, error: null };
  }
}

const actor = { userId: USER_ID, role: "couple", plannerType: null };

describe("Intelligence Gateway task writes", () => {
  it("normalizes bounded task input and rejects invalid dates", () => {
    expect(normalizeCreateTaskArguments({
      title: "  Confirm caterer\nmenu  ",
      due_date: "2026-10-05",
      priority_level: 2,
    })).toMatchObject({
      title: "Confirm caterer menu",
      dueDate: "2026-10-05",
      priorityLevel: 2,
      visibility: "public",
    });
    expect(() => normalizeCreateTaskArguments({ title: "Book venue", dueDate: "2026-02-30" }))
      .toThrow("Use a valid due date");
  });

  it("previews, confirms and restores one idempotent task receipt", async () => {
    const db = new FakeDb() as unknown as GatewayWriteDatabase;
    const now = new Date("2026-09-29T12:00:00.000Z");
    const preview = await previewCreateTask(db, actor, null, {
      title: "Confirm caterer menu",
      dueDate: "2026-10-05",
      category: "Catering",
    }, now);

    expect(preview.confirmationRequired).toBe(true);
    expect(preview.interpretedTask.title).toBe("Confirm caterer menu");

    const first = await executeConfirmedCreateTask(
      db,
      actor,
      preview.confirmationId,
      preview.idempotencyKey,
      new Date("2026-09-29T12:01:00.000Z"),
    );
    const retried = await executeConfirmedCreateTask(
      db,
      actor,
      preview.confirmationId,
      preview.idempotencyKey,
      new Date("2026-09-29T12:02:00.000Z"),
    );

    expect(first.task.title).toBe("Confirm caterer menu");
    expect(first.receipt.path).toBe("/tasks");
    expect(retried.task.id).toBe(first.task.id);
    expect((db as unknown as FakeDb).tasks).toHaveLength(1);
  });

  it("refuses a mismatched idempotency key", async () => {
    const db = new FakeDb() as unknown as GatewayWriteDatabase;
    const preview = await previewCreateTask(db, actor, null, { title: "Choose flowers" });

    await expect(executeConfirmedCreateTask(
      db,
      actor,
      preview.confirmationId,
      crypto.randomUUID(),
    )).rejects.toThrow("does not match");
    expect((db as unknown as FakeDb).tasks).toHaveLength(0);
  });

  it("revokes a pending preview and makes cancellation idempotent", async () => {
    const db = new FakeDb() as unknown as GatewayWriteDatabase;
    const preview = await previewCreateTask(db, actor, null, { title: "Choose flowers" });

    const first = await revokeCreateTaskPreview(db, actor, preview.confirmationId, preview.idempotencyKey);
    const retried = await revokeCreateTaskPreview(db, actor, preview.confirmationId, preview.idempotencyKey);

    expect(first.confirmationStatus).toBe("revoked");
    expect(retried.confirmationStatus).toBe("revoked");
    await expect(executeConfirmedCreateTask(db, actor, preview.confirmationId, preview.idempotencyKey))
      .rejects.toThrow("no longer available");
    expect((db as unknown as FakeDb).tasks).toHaveLength(0);
  });

  it("previews, confirms and replays one idempotent task update", async () => {
    const fake = new FakeDb();
    const taskId = crypto.randomUUID();
    fake.tasks.push({
      id: taskId,
      user_id: USER_ID,
      wedding_id: WEDDING_ID,
      title: "Visit venue",
      due_date: "2026-10-10",
      description: null,
      category: "Venue",
      assigned_to: null,
      priority_level: 3,
      visibility: "public",
      completed: false,
    });
    const db = fake as unknown as GatewayWriteDatabase;
    const preview = await previewUpdateTask(db, actor, null, {
      taskId,
      changes: { dueDate: "2026-10-22", priorityLevel: 1 },
    });

    expect(preview.task.title).toBe("Visit venue");
    expect(preview.changes).toMatchObject({ dueDate: "2026-10-22", priorityLevel: 1 });

    const first = await executeConfirmedUpdateTask(db, actor, preview.confirmationId, preview.idempotencyKey);
    const retried = await executeConfirmedUpdateTask(db, actor, preview.confirmationId, preview.idempotencyKey);

    expect(first.task.id).toBe(taskId);
    expect(first.task.dueDate).toBe("2026-10-22");
    expect(retried.task.id).toBe(taskId);
    expect(fake.tasks).toHaveLength(1);
    expect(fake.tasks[0].priority_level).toBe(1);
  });

  it("revokes a pending task update", async () => {
    const fake = new FakeDb();
    const taskId = crypto.randomUUID();
    fake.tasks.push({ id: taskId, user_id: USER_ID, wedding_id: WEDDING_ID, title: "Visit venue", due_date: null });
    const db = fake as unknown as GatewayWriteDatabase;
    const preview = await previewUpdateTask(db, actor, null, { taskId, changes: { completed: true } });

    const revoked = await revokeUpdateTaskPreview(db, actor, preview.confirmationId, preview.idempotencyKey);

    expect(revoked.capability).toBe("update_task");
    expect(revoked.confirmationStatus).toBe("revoked");
    await expect(executeConfirmedUpdateTask(db, actor, preview.confirmationId, preview.idempotencyKey))
      .rejects.toThrow("no longer available");
    expect(fake.tasks[0].completed).toBeUndefined();
  });

  it("normalizes, confirms and replays one idempotent guest addition", async () => {
    const fake = new FakeDb();
    const db = fake as unknown as GatewayWriteDatabase;
    expect(normalizeAddGuestArguments({ name: "  Jane Doe ", email: "JANE@EXAMPLE.COM", plus_one: true }))
      .toMatchObject({ name: "Jane Doe", email: "jane@example.com", rsvpStatus: "pending", plusOne: true });

    const preview = await previewAddGuest(db, actor, null, {
      name: "Jane Doe",
      email: "jane@example.com",
      group_name: "Bride's Guests",
      category: "family",
    });
    expect(preview.outcome).toBe("created");

    const first = await executeConfirmedAddGuest(db, actor, preview.confirmationId, preview.idempotencyKey);
    const retried = await executeConfirmedAddGuest(db, actor, preview.confirmationId, preview.idempotencyKey);

    expect(first.outcome).toBe("created");
    expect(first.guest.name).toBe("Jane Doe");
    expect(retried.guest.id).toBe(first.guest.id);
    expect(fake.guests).toHaveLength(1);
  });

  it("preserves linked-planner couple approval and guest cancellation", async () => {
    const fake = new FakeDb();
    const clientId = crypto.randomUUID();
    const coupleUserId = crypto.randomUUID();
    fake.plannerClients.push({
      id: clientId,
      planner_user_id: USER_ID,
      wedding_id: WEDDING_ID,
      linked_user_id: coupleUserId,
      is_archived: false,
    });
    const planner = { userId: USER_ID, role: "planner", plannerType: "full_service" };
    const db = fake as unknown as GatewayWriteDatabase;
    const preview = await previewAddGuest(db, planner, clientId, { name: "Approval Guest" });

    expect(preview.outcome).toBe("approval_requested");
    const receipt = await executeConfirmedAddGuest(db, planner, preview.confirmationId, preview.idempotencyKey);
    expect(receipt.outcome).toBe("approval_requested");
    expect(fake.guests).toHaveLength(0);
    expect(fake.changeRequests).toHaveLength(1);
    expect(fake.changeRequests[0].couple_user_id).toBe(coupleUserId);

    const cancelled = await previewAddGuest(db, planner, clientId, { name: "Cancelled Guest" });
    const revoked = await revokeAddGuestPreview(db, planner, cancelled.confirmationId, cancelled.idempotencyKey);
    expect(revoked.capability).toBe("add_guest");
    await expect(executeConfirmedAddGuest(db, planner, cancelled.confirmationId, cancelled.idempotencyKey))
      .rejects.toThrow("no longer available");
  });

  it("records one idempotent category expense without creating a payment", async () => {
    const fake = new FakeDb();
    const db = fake as unknown as GatewayWriteDatabase;
    expect(normalizeRecordExpenseArguments({
      category_name: "Photography",
      payee_name: "Studio deposit",
      amount: 2500.555,
      expense_date: "2026-09-30",
    })).toMatchObject({ amount: 2500.56, expenseDate: "2026-09-30" });

    const preview = await previewRecordExpense(db, actor, null, {
      categoryName: "photography",
      payeeName: "Studio deposit",
      amount: 2500,
      expenseDate: "2026-09-30",
    });
    expect(preview.interpretedExpense.categoryName).toBe("Photographer");
    expect(preview.userSummary).toContain("will not create a payment entry");

    const first = await executeConfirmedRecordExpense(db, actor, preview.confirmationId, preview.idempotencyKey);
    const retried = await executeConfirmedRecordExpense(db, actor, preview.confirmationId, preview.idempotencyKey);
    expect(first.outcome).toBe("recorded");
    expect(retried.expense.id).toBe(first.expense.id);
    expect(fake.expenses).toHaveLength(1);
    expect(fake.budgetCategories[0].spent).toBe(3500);
  });

  it("routes a linked planner expense to couple approval and supports cancellation", async () => {
    const fake = new FakeDb();
    const clientId = crypto.randomUUID();
    const coupleUserId = crypto.randomUUID();
    fake.plannerClients.push({
      id: clientId, planner_user_id: USER_ID, wedding_id: WEDDING_ID,
      linked_user_id: coupleUserId, is_archived: false,
    });
    const planner = { userId: USER_ID, role: "planner", plannerType: "full_service" };
    const db = fake as unknown as GatewayWriteDatabase;
    const preview = await previewRecordExpense(db, planner, clientId, {
      categoryName: "Photography", payeeName: "Studio", amount: 500, expenseDate: "2026-09-30",
    });
    const receipt = await executeConfirmedRecordExpense(db, planner, preview.confirmationId, preview.idempotencyKey);
    expect(receipt.outcome).toBe("approval_requested");
    expect(fake.expenses).toHaveLength(0);
    expect(fake.changeRequests[0].proposed_payload).toEqual({ spent: 1500 });

    const cancelled = await previewRecordExpense(db, planner, clientId, {
      categoryName: "Photography", payeeName: "Cancelled", amount: 100, expenseDate: "2026-09-30",
    });
    const revoked = await revokeRecordExpensePreview(db, planner, cancelled.confirmationId, cancelled.idempotencyKey);
    expect(revoked.capability).toBe("record_expense");
    await expect(executeConfirmedRecordExpense(db, planner, cancelled.confirmationId, cancelled.idempotencyKey))
      .rejects.toThrow("no longer available");
  });

  it("creates and replays one confirmed private vendor follow-up", async () => {
    const fake = new FakeDb();
    const db = fake as unknown as GatewayWriteDatabase;
    const vendor = { userId: USER_ID, role: "vendor", plannerType: null };
    expect(normalizeCreateVendorFollowUpArguments({
      couple_name: " Amina and Kamau ",
      title: " Confirm final shot list ",
      due_date: "2026-10-05",
    })).toMatchObject({ title: "Confirm final shot list", dueDate: "2026-10-05" });

    const preview = await previewCreateVendorFollowUp(db, vendor, {
      coupleName: "Amina and Kamau",
      title: "Confirm final shot list",
      dueDate: "2026-10-05",
    });
    expect(preview.booking.coupleName).toBe("Amina & Kamau");
    expect(preview.userSummary).toContain("private to your vendor workspace");

    const first = await executeConfirmedCreateVendorFollowUp(
      db, vendor, preview.confirmationId, preview.idempotencyKey,
    );
    const replay = await executeConfirmedCreateVendorFollowUp(
      db, vendor, preview.confirmationId, preview.idempotencyKey,
    );
    expect(first.receipt.path).toBe("/vendor-dashboard");
    expect(replay.reminder.id).toBe(first.reminder.id);
    expect(fake.vendorFollowUps).toHaveLength(1);
  });

  it("limits private follow-ups to vendors and supports cancellation", async () => {
    const fake = new FakeDb();
    const db = fake as unknown as GatewayWriteDatabase;
    await expect(previewCreateVendorFollowUp(db, actor, {
      coupleName: "Amina & Kamau", title: "Confirm details",
    })).rejects.toThrow("only in a vendor workspace");

    const vendor = { userId: USER_ID, role: "vendor", plannerType: null };
    const preview = await previewCreateVendorFollowUp(db, vendor, {
      coupleName: "Amina & Kamau", title: "Confirm details",
    });
    const revoked = await revokeCreateVendorFollowUpPreview(
      db, vendor, preview.confirmationId, preview.idempotencyKey,
    );
    expect(revoked.capability).toBe("create_vendor_follow_up_reminder");
    await expect(executeConfirmedCreateVendorFollowUp(
      db, vendor, preview.confirmationId, preview.idempotencyKey,
    )).rejects.toThrow("no longer available");
    expect(fake.vendorFollowUps).toHaveLength(0);
  });

  it("records and replays one confirmed payment with atomic category and vendor effects", async () => {
    const fake = new FakeDb();
    const db = fake as unknown as GatewayWriteDatabase;
    expect(normalizeRecordPaymentArguments({
      category_name: "Photography",
      vendor_name: "Mwaniki Photo",
      amount: 500.555,
      payment_date: "2026-09-30",
    })).toMatchObject({ amount: 500.56, paymentDate: "2026-09-30" });

    const preview = await previewRecordPayment(db, actor, null, {
      categoryName: "Photography",
      vendorName: "Mwaniki Photo",
      amount: 500,
      paymentDate: "2026-09-30",
      reference: "QWE123",
    });
    expect(preview.interpretedPayment.categoryName).toBe("Photographer");
    expect(preview.vendor).toMatchObject({ currentPaid: 0, nextPaid: 500, nextStatus: "deposit_paid" });
    expect(preview.userSummary).toContain("does not move money");

    const first = await executeConfirmedRecordPayment(db, actor, preview.confirmationId, preview.idempotencyKey);
    const replay = await executeConfirmedRecordPayment(db, actor, preview.confirmationId, preview.idempotencyKey);
    expect(first.outcome).toBe("recorded");
    expect(replay.payment.id).toBe(first.payment.id);
    expect(fake.budgetPayments).toHaveLength(1);
    expect(fake.budgetCategories[0].spent).toBe(1500);
    expect(fake.vendors[0]).toMatchObject({ amount_paid: 500, payment_status: "deposit_paid" });
  });

  it("routes a linked-planner payment to approval and revokes a later preview", async () => {
    const fake = new FakeDb();
    const clientId = crypto.randomUUID();
    const coupleUserId = crypto.randomUUID();
    fake.plannerClients.push({
      id: clientId, planner_user_id: USER_ID, wedding_id: WEDDING_ID,
      linked_user_id: coupleUserId, is_archived: false,
    });
    const planner = { userId: USER_ID, role: "planner", plannerType: "full_service" };
    const db = fake as unknown as GatewayWriteDatabase;
    const preview = await previewRecordPayment(db, planner, clientId, {
      categoryName: "Photography", payeeName: "Studio", amount: 250, paymentDate: "2026-09-30",
    });
    const receipt = await executeConfirmedRecordPayment(db, planner, preview.confirmationId, preview.idempotencyKey);
    expect(receipt.outcome).toBe("approval_requested");
    expect(fake.budgetPayments).toHaveLength(0);
    expect(fake.changeRequests[0].proposed_payload).toMatchObject({
      category_name: "Photographer", payee_name: "Studio", amount: 250,
    });

    const cancelled = await previewRecordPayment(db, planner, clientId, {
      categoryName: "Photography", payeeName: "Studio", amount: 100,
    });
    const revoked = await revokeRecordPaymentPreview(db, planner, cancelled.confirmationId, cancelled.idempotencyKey);
    expect(revoked.capability).toBe("record_payment");
    await expect(executeConfirmedRecordPayment(db, planner, cancelled.confirmationId, cancelled.idempotencyKey))
      .rejects.toThrow("no longer available");
  });

  it("saves and replays one source-backed private vendor candidate", async () => {
    const fake = new FakeDb();
    const db = fake as unknown as GatewayWriteDatabase;
    const sourceUrl = "https://studio.example/weddings";
    const preview = await previewSaveVendorCandidate(db, actor, null, {
      businessName: "Coast Film Studio",
      category: "Videographer",
      location: "Mombasa",
      website: sourceUrl,
      sourceKind: "official_website",
      sourceUrl,
      snapshot: {
        summary: "Wedding films in Mombasa.",
        matchReasons: ["Serves Mombasa"],
        unknowns: ["Confirm availability"],
        sources: [{ url: sourceUrl, title: "Coast Film Studio" }],
      },
    });
    expect(preview.userSummary).toContain("does not contact the vendor");

    const first = await executeConfirmedSaveVendorCandidate(db, actor, preview.confirmationId, preview.idempotencyKey);
    const replay = await executeConfirmedSaveVendorCandidate(db, actor, preview.confirmationId, preview.idempotencyKey);
    expect(first.candidate).toMatchObject({ businessName: "Coast Film Studio", weddingId: WEDDING_ID });
    expect(replay.candidate.id).toBe(first.candidate.id);
    expect(fake.vendorCandidates).toHaveLength(1);
  });

  it("limits candidate saving to couples and planners and supports cancellation", async () => {
    const fake = new FakeDb();
    const db = fake as unknown as GatewayWriteDatabase;
    const sourceUrl = "https://studio.example/weddings";
    const candidate = {
      businessName: "Coast Film Studio", category: "Videographer", sourceUrl,
      snapshot: { sources: [{ url: sourceUrl }] },
    };
    await expect(previewSaveVendorCandidate(
      db, { userId: USER_ID, role: "vendor", plannerType: null }, null, candidate,
    )).rejects.toThrow("available to couples and planners");

    const preview = await previewSaveVendorCandidate(db, actor, null, candidate);
    const revoked = await revokeSaveVendorCandidatePreview(db, actor, preview.confirmationId, preview.idempotencyKey);
    expect(revoked.capability).toBe("save_vendor_candidate");
    await expect(executeConfirmedSaveVendorCandidate(
      db, actor, preview.confirmationId, preview.idempotencyKey,
    )).rejects.toThrow("no longer available");
    expect(fake.vendorCandidates).toHaveLength(0);
  });

  it("assigns one private candidate to an owned active planner client and replays safely", async () => {
    const fake = new FakeDb();
    const clientId = crypto.randomUUID();
    const candidateId = crypto.randomUUID();
    fake.plannerClients.push({
      id: clientId,
      planner_user_id: USER_ID,
      client_name: "Amina",
      partner_name: "Kamau",
      wedding_id: WEDDING_ID,
      is_archived: false,
    });
    fake.vendorCandidates.push({
      id: candidateId,
      owner_user_id: USER_ID,
      business_name: "Coast Film Studio",
      candidate_status: "saved",
      wedding_id: null,
      planner_client_id: null,
    });
    const planner = { userId: USER_ID, role: "planner", plannerType: "full_service" };
    const db = fake as unknown as GatewayWriteDatabase;
    const preview = await previewAssignVendorCandidate(db, planner, {
      businessName: "Coast Film Studio",
      clientName: "Amina Kamau",
    });
    expect(preview.interpretedAssignment).toMatchObject({ candidateId, clientId });
    expect(preview.userSummary).toContain("does not add it to the vendor tracker");

    const first = await executeConfirmedAssignVendorCandidate(db, planner, preview.confirmationId, preview.idempotencyKey);
    const replay = await executeConfirmedAssignVendorCandidate(db, planner, preview.confirmationId, preview.idempotencyKey);
    expect(first.assignment).toEqual(replay.assignment);
    expect(fake.vendorCandidates[0]).toMatchObject({ planner_client_id: clientId, wedding_id: null });
    expect(fake.vendors).toHaveLength(1);
  });

  it("limits candidate assignment to professional planners and supports cancellation", async () => {
    const fake = new FakeDb();
    const clientId = crypto.randomUUID();
    fake.plannerClients.push({
      id: clientId, planner_user_id: USER_ID, client_name: "Amina", partner_name: "Kamau",
      wedding_id: WEDDING_ID, is_archived: false,
    });
    fake.vendorCandidates.push({
      id: crypto.randomUUID(), owner_user_id: USER_ID, business_name: "Coast Film Studio",
      candidate_status: "saved", wedding_id: null, planner_client_id: null,
    });
    const db = fake as unknown as GatewayWriteDatabase;
    await expect(previewAssignVendorCandidate(db, actor, {
      businessName: "Coast Film Studio", clientId,
    })).rejects.toThrow("available to professional planners");

    const planner = { userId: USER_ID, role: "planner", plannerType: "full_service" };
    const preview = await previewAssignVendorCandidate(db, planner, {
      businessName: "Coast Film Studio", clientId,
    });
    const revoked = await revokeAssignVendorCandidatePreview(db, planner, preview.confirmationId, preview.idempotencyKey);
    expect(revoked.capability).toBe("assign_vendor_candidate");
    await expect(executeConfirmedAssignVendorCandidate(
      db, planner, preview.confirmationId, preview.idempotencyKey,
    )).rejects.toThrow("no longer available");
    expect(fake.vendorCandidates[0].planner_client_id).toBeNull();
  });

  it("promotes one couple candidate into the vendor tracker and replays without duplication", async () => {
    const fake = new FakeDb();
    const candidateId = crypto.randomUUID();
    fake.vendorCandidates.push({
      id: candidateId,
      owner_user_id: USER_ID,
      business_name: "Coast Film Studio",
      category: "Videographer",
      vendor_listing_id: null,
      candidate_status: "saved",
      wedding_id: WEDDING_ID,
      planner_client_id: null,
    });
    const db = fake as unknown as GatewayWriteDatabase;
    const preview = await previewPromoteVendorCandidate(db, actor, {
      businessName: "Coast Film Studio",
      quoteAmount: 120000,
      selectionStatus: "shortlisted",
    });
    expect(preview.interpretedPromotion).toMatchObject({
      candidateId, category: "Videographer", quoteAmount: 120000, selectionStatus: "shortlisted",
    });
    expect(preview.userSummary).toContain("does not contact the vendor or confirm a booking");

    const first = await executeConfirmedPromoteVendorCandidate(db, actor, preview.confirmationId, preview.idempotencyKey);
    const replay = await executeConfirmedPromoteVendorCandidate(db, actor, preview.confirmationId, preview.idempotencyKey);
    expect(first.vendor.id).toBe(replay.vendor.id);
    expect(fake.vendors).toHaveLength(2);
    expect(fake.vendors[1]).toMatchObject({
      user_id: USER_ID,
      wedding_id: WEDDING_ID,
      source_vendor_candidate_id: candidateId,
      name: "Coast Film Studio",
      price: 120000,
      status: null,
      selection_status: "shortlisted",
    });
    expect(fake.vendorCandidates[0].candidate_status).toBe("shortlisted");
  });

  it("routes linked-planner candidate promotion to couple approval and supports cancellation", async () => {
    const fake = new FakeDb();
    const clientId = crypto.randomUUID();
    const candidateId = crypto.randomUUID();
    const coupleUserId = crypto.randomUUID();
    fake.plannerClients.push({
      id: clientId, planner_user_id: USER_ID, client_name: "Amina", partner_name: "Kamau",
      wedding_id: WEDDING_ID, linked_user_id: coupleUserId, is_archived: false,
    });
    fake.vendorCandidates.push({
      id: candidateId, owner_user_id: USER_ID, business_name: "Coast Film Studio",
      category: "Videographer", vendor_listing_id: null, candidate_status: "saved",
      wedding_id: null, planner_client_id: clientId,
    });
    const planner = { userId: USER_ID, role: "planner", plannerType: "full_service" };
    const db = fake as unknown as GatewayWriteDatabase;
    const preview = await previewPromoteVendorCandidate(db, planner, {
      candidateId, selectionStatus: "backup",
    });
    expect(preview.outcome).toBe("approval_requested");
    const receipt = await executeConfirmedPromoteVendorCandidate(db, planner, preview.confirmationId, preview.idempotencyKey);
    expect(receipt.outcome).toBe("approval_requested");
    expect(fake.vendors).toHaveLength(1);
    expect(fake.changeRequests[0]).toMatchObject({
      target_table: "vendors", change_type: "create", couple_user_id: coupleUserId,
    });
    expect(fake.changeRequests[0].proposed_payload).toMatchObject({
      source_vendor_candidate_id: candidateId, selection_status: "backup", status: null,
    });

    const secondCandidateId = crypto.randomUUID();
    fake.vendorCandidates.push({
      id: secondCandidateId, owner_user_id: USER_ID, business_name: "Second Studio",
      category: "Photographer", vendor_listing_id: null, candidate_status: "saved",
      wedding_id: null, planner_client_id: clientId,
    });
    const cancelled = await previewPromoteVendorCandidate(db, planner, { candidateId: secondCandidateId });
    const revoked = await revokePromoteVendorCandidatePreview(db, planner, cancelled.confirmationId, cancelled.idempotencyKey);
    expect(revoked.capability).toBe("promote_vendor_candidate");
    await expect(executeConfirmedPromoteVendorCandidate(
      db, planner, cancelled.confirmationId, cancelled.idempotencyKey,
    )).rejects.toThrow("no longer available");
  });

  it("sends one confirmed vendor enquiry and restores its receipt without redelivery", async () => {
    const fake = new FakeDb();
    const db = fake as unknown as GatewayWriteDatabase;
    const preview = await previewSendVendorEnquiry(db, actor, null, {
      vendorName: "Mwaniki Photo",
      subject: "Photography availability",
      message: "Are you available on 10 January 2027? Please share your current package options.",
    }, new Date("2026-10-02T09:50:00.000Z"));
    expect(preview.interpretedEnquiry).toMatchObject({
      vendorId: VENDOR_BOOKING_ID,
      recipientEmail: "hello@mwanikiphoto.test",
      recipientSource: "tracker",
      senderName: "Amina & Kamau",
    });
    expect(preview.userSummary).toContain("Confirm this exact recipient and message");

    let deliveries = 0;
    let responseToken = "";
    const deliver = async (email: { responseToken: string }) => {
      deliveries += 1;
      responseToken = email.responseToken;
      return { ok: true, provider: "resend" as const, providerMessageId: "email_123", error: null };
    };
    const first = await executeConfirmedSendVendorEnquiry(
      db, actor, preview.confirmationId, preview.idempotencyKey, deliver,
      new Date("2026-10-02T10:00:00.000Z"),
    );
    const replay = await executeConfirmedSendVendorEnquiry(
      db, actor, preview.confirmationId, preview.idempotencyKey, deliver,
      new Date("2026-10-02T10:01:00.000Z"),
    );
    expect(deliveries).toBe(1);
    expect(responseToken).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.deliveryStatus).toBe("sent");
    expect(replay.enquiry.id).toBe(first.enquiry.id);
    expect(fake.vendorEnquiries).toHaveLength(1);
    expect(fake.vendorEnquiries[0]).toMatchObject({
      vendor_id: VENDOR_BOOKING_ID,
      delivery_status: "sent",
      provider_message_id: "email_123",
    });
  });

  it("cancels a vendor enquiry without delivery and records provider failure without retry", async () => {
    const fake = new FakeDb();
    const db = fake as unknown as GatewayWriteDatabase;
    const cancelled = await previewSendVendorEnquiry(db, actor, null, {
      vendorId: VENDOR_BOOKING_ID,
      message: "Please confirm your availability.",
    });
    const revoked = await revokeSendVendorEnquiryPreview(
      db, actor, cancelled.confirmationId, cancelled.idempotencyKey,
    );
    expect(revoked.userSummary).toContain("No vendor enquiry was sent");
    expect(fake.vendorEnquiries).toHaveLength(0);

    const failed = await previewSendVendorEnquiry(db, actor, null, {
      vendorId: VENDOR_BOOKING_ID,
      recipientEmail: "bookings@example.test",
      message: "Please confirm your availability.",
    });
    let attempts = 0;
    const deliver = async () => {
      attempts += 1;
      return { ok: false, provider: "resend" as const, providerMessageId: null, error: "Rejected" };
    };
    const receipt = await executeConfirmedSendVendorEnquiry(
      db, actor, failed.confirmationId, failed.idempotencyKey, deliver,
    );
    const replay = await executeConfirmedSendVendorEnquiry(
      db, actor, failed.confirmationId, failed.idempotencyKey, deliver,
    );
    expect(receipt.deliveryStatus).toBe("failed");
    expect(replay.deliveryStatus).toBe("failed");
    expect(attempts).toBe(1);
  });

  it("routes a linked planner vendor enquiry to exact couple approval without delivery", async () => {
    const fake = new FakeDb();
    const clientId = crypto.randomUUID();
    const vendorId = crypto.randomUUID();
    fake.plannerClients.push({
      id: clientId, planner_user_id: USER_ID, client_name: "Amina", partner_name: "Kamau",
      wedding_id: WEDDING_ID, linked_user_id: COUPLE_USER_ID, is_archived: false,
    });
    fake.vendors.push({
      id: vendorId, user_id: USER_ID, wedding_id: WEDDING_ID, client_id: clientId,
      vendor_listing_id: null, category: "Videography", name: "Coast Film Studio",
      email: "bookings@coastfilm.test", selection_status: "shortlisted", status: null,
    });
    fake.profiles[0].company_name = "Mwaniki Weddings";
    const planner = { userId: USER_ID, role: "planner", plannerType: "full_service" };
    const db = fake as unknown as GatewayWriteDatabase;
    const preview = await previewSendVendorEnquiry(db, planner, clientId, {
      vendorId,
      subject: "Wedding availability",
      message: "Please confirm whether you are available on 10 January 2027.",
    });
    expect(preview.outcome).toBe("approval_requested");
    expect(preview.userSummary).toContain("No email will be sent until the couple approves");

    let deliveries = 0;
    const receipt = await executeConfirmedSendVendorEnquiry(
      db, planner, preview.confirmationId, preview.idempotencyKey,
      async () => {
        deliveries += 1;
        return { ok: true, provider: "resend", providerMessageId: "should-not-send", error: null };
      },
    );
    expect(receipt.deliveryStatus).toBe("pending_approval");
    expect(deliveries).toBe(0);
    expect(fake.vendorEnquiries).toHaveLength(0);
    expect(fake.changeRequests[0]).toMatchObject({
      client_id: clientId,
      couple_user_id: COUPLE_USER_ID,
      planner_user_id: USER_ID,
      target_table: "vendor_enquiries",
      change_type: "create",
      gateway_idempotency_key: preview.idempotencyKey,
    });
    expect(fake.changeRequests[0].proposed_payload).toMatchObject({
      vendor_id: vendorId,
      recipient_email: "bookings@coastfilm.test",
      subject: "Wedding availability",
    });
  });

  it("records an indicative response amount only after confirmation and replays safely", async () => {
    const fake = new FakeDb();
    const enquiryId = crypto.randomUUID();
    const responseId = crypto.randomUUID();
    fake.vendorEnquiries.push({
      id: enquiryId, wedding_id: WEDDING_ID, planner_client_id: null,
      vendor_id: VENDOR_BOOKING_ID, response_status: "available", responded_at: "2026-10-02T12:00:00.000Z",
    });
    fake.vendorEnquiryResponses.push({
      id: responseId, enquiry_id: enquiryId, response: "available", message: "We are available.",
      quote_amount: 150000, quote_currency: "KES", quote_valid_until: "2026-10-31",
      created_at: "2026-10-02T12:00:00.000Z",
    });
    const db = fake as unknown as GatewayWriteDatabase;
    const preview = await previewApplyVendorResponse(db, actor, null, {
      vendorName: "Mwaniki Photo", action: "record_indicative_price",
    });
    expect(preview.response).toMatchObject({ vendorId: VENDOR_BOOKING_ID, indicativeAmount: 150000, currentPrice: 5000 });
    expect(preview.userSummary).toContain("does not create or accept a formal quote");
    const first = await executeConfirmedApplyVendorResponse(db, actor, preview.confirmationId, preview.idempotencyKey);
    const replay = await executeConfirmedApplyVendorResponse(db, actor, preview.confirmationId, preview.idempotencyKey);
    expect(first.outcome).toBe("updated");
    expect(replay.vendor.price).toBe(150000);
    expect(fake.vendors[0].price).toBe(150000);
  });

  it("routes a linked planner unavailable response through couple approval", async () => {
    const fake = new FakeDb();
    const clientId = crypto.randomUUID();
    const vendorId = crypto.randomUUID();
    const enquiryId = crypto.randomUUID();
    fake.plannerClients.push({
      id: clientId, planner_user_id: USER_ID, client_name: "Amina", partner_name: "Kamau",
      wedding_id: WEDDING_ID, linked_user_id: COUPLE_USER_ID, is_archived: false,
    });
    fake.vendors.push({
      id: vendorId, user_id: USER_ID, wedding_id: WEDDING_ID, client_id: clientId,
      name: "Coast Film Studio", price: null, status: "contacted", selection_status: "shortlisted",
    });
    fake.vendorEnquiries.push({
      id: enquiryId, wedding_id: WEDDING_ID, planner_client_id: clientId,
      vendor_id: vendorId, response_status: "unavailable", responded_at: "2026-10-02T13:00:00.000Z",
    });
    fake.vendorEnquiryResponses.push({
      id: crypto.randomUUID(), enquiry_id: enquiryId, response: "unavailable", message: "Already booked.",
      quote_amount: null, quote_currency: null, quote_valid_until: null, created_at: "2026-10-02T13:00:00.000Z",
    });
    const planner = { userId: USER_ID, role: "planner", plannerType: "full_service" };
    const db = fake as unknown as GatewayWriteDatabase;
    const preview = await previewApplyVendorResponse(db, planner, clientId, {
      enquiryId, action: "mark_unavailable",
    });
    expect(preview.outcome).toBe("approval_requested");
    const receipt = await executeConfirmedApplyVendorResponse(db, planner, preview.confirmationId, preview.idempotencyKey);
    expect(receipt.outcome).toBe("approval_requested");
    expect(fake.vendors.find((row) => row.id === vendorId)).toMatchObject({ status: "contacted", selection_status: "shortlisted" });
    expect(fake.changeRequests[0]).toMatchObject({
      target_table: "vendors", change_type: "update", target_id: vendorId,
      proposed_payload: { status: "rejected", selection_status: "declined" },
    });
  });

  it("requests one tracked formal quote from a connected vendor without copying the indicative amount", async () => {
    const fake = new FakeDb();
    const vendorId = crypto.randomUUID();
    const listingId = crypto.randomUUID();
    const enquiryId = crypto.randomUUID();
    fake.vendorListings.push({ id: listingId, user_id: crypto.randomUUID(), business_name: "Coast Film Studio", is_approved: true });
    fake.vendors.push({
      id: vendorId, user_id: USER_ID, wedding_id: WEDDING_ID, client_id: null,
      vendor_listing_id: listingId, category: "Videography", name: "Coast Film Studio",
      price: 120000, status: "contacted", selection_status: "shortlisted",
    });
    fake.vendorEnquiries.push({
      id: enquiryId, wedding_id: WEDDING_ID, planner_client_id: null,
      vendor_id: vendorId, response_status: "available", responded_at: "2026-10-02T14:00:00.000Z",
    });
    fake.vendorEnquiryResponses.push({
      id: crypto.randomUUID(), enquiry_id: enquiryId, response: "available",
      quote_amount: 135000, created_at: "2026-10-02T14:00:00.000Z",
    });
    const db = fake as unknown as GatewayWriteDatabase;
    const preview = await previewRequestFormalVendorQuote(db, actor, null, {
      vendorId, enquiryId,
      message: "Please send an itemized formal quote with payment terms and validity.",
    });
    expect(preview.interpretedRequest).toMatchObject({ vendorId, enquiryId });
    expect(preview.userSummary).toContain("No indicative response amount will be copied");
    const first = await executeConfirmedRequestFormalVendorQuote(db, actor, preview.confirmationId, preview.idempotencyKey);
    const replay = await executeConfirmedRequestFormalVendorQuote(db, actor, preview.confirmationId, preview.idempotencyKey);
    expect(first.outcome).toBe("requested");
    expect(replay.quoteRequest.id).toBe(first.quoteRequest.id);
    expect(fake.documentRequests).toHaveLength(1);
    expect(fake.documentRequests[0]).toMatchObject({
      vendor_id: vendorId, request_type: "quote", status: "new", budget_amount: null,
    });
    expect(fake.vendors.find((row) => row.id === vendorId)).toMatchObject({ price: 120000, status: "contacted" });
  });

  it("routes a linked planner formal quote request to couple approval", async () => {
    const fake = new FakeDb();
    const clientId = crypto.randomUUID();
    const vendorId = crypto.randomUUID();
    const listingId = crypto.randomUUID();
    fake.plannerClients.push({
      id: clientId, planner_user_id: USER_ID, client_name: "Amina", partner_name: "Kamau",
      wedding_id: WEDDING_ID, linked_user_id: COUPLE_USER_ID, is_archived: false,
    });
    fake.vendorListings.push({ id: listingId, user_id: crypto.randomUUID(), business_name: "Coast Film Studio", is_approved: true });
    fake.vendors.push({
      id: vendorId, user_id: USER_ID, wedding_id: WEDDING_ID, client_id: clientId,
      vendor_listing_id: listingId, category: "Videography", name: "Coast Film Studio",
    });
    const planner = { userId: USER_ID, role: "planner", plannerType: "full_service" };
    const db = fake as unknown as GatewayWriteDatabase;
    const preview = await previewRequestFormalVendorQuote(db, planner, clientId, { vendorId });
    expect(preview.outcome).toBe("approval_requested");
    const receipt = await executeConfirmedRequestFormalVendorQuote(db, planner, preview.confirmationId, preview.idempotencyKey);
    expect(receipt.outcome).toBe("approval_requested");
    expect(fake.documentRequests).toHaveLength(0);
    expect(fake.changeRequests[0]).toMatchObject({
      target_table: "document_requests", change_type: "create", couple_user_id: COUPLE_USER_ID,
      proposed_payload: { target_vendor_id: vendorId, request_budget_amount: null },
    });
  });

  it("refuses an in-app formal quote for an unconnected vendor and supports cancellation", async () => {
    const fake = new FakeDb();
    const db = fake as unknown as GatewayWriteDatabase;
    fake.vendors[0].vendor_listing_id = null;
    await expect(previewRequestFormalVendorQuote(db, actor, null, {
      vendorId: VENDOR_BOOKING_ID,
    })).rejects.toThrow("Use send_vendor_enquiry");

    fake.vendors[0].vendor_listing_id = VENDOR_LISTING_ID;
    fake.vendorListings[0].user_id = crypto.randomUUID();
    fake.vendorListings[0].is_approved = true;
    const preview = await previewRequestFormalVendorQuote(db, actor, null, { vendorId: VENDOR_BOOKING_ID });
    const revoked = await revokeRequestFormalVendorQuotePreview(db, actor, preview.confirmationId, preview.idempotencyKey);
    expect(revoked.userSummary).toContain("No formal quote request was sent");
    expect(fake.documentRequests).toHaveLength(0);
  });

  it("requests exact changes to one returned formal quote and safely replays the receipt", async () => {
    const fake = new FakeDb();
    const quoteRequestId = crypto.randomUUID();
    const quoteDocumentId = crypto.randomUUID();
    fake.formalQuoteBriefingRequests.push({
      id: quoteRequestId, vendorName: "Coast Film Studio", status: "responded",
      formalQuote: { id: quoteDocumentId, documentNumber: "QUO-2026-0042", status: "sent", totalAmount: 135000 },
    });
    const db = fake as unknown as GatewayWriteDatabase;
    const preview = await previewRequestFormalQuoteChanges(db, actor, null, {
      quoteRequestId,
      message: "Please separate drone coverage and extend the quote validity to 30 days.",
    });
    expect(preview.userSummary).toContain("QUO-2026-0042");
    const first = await executeConfirmedRequestFormalQuoteChanges(db, actor, preview.confirmationId, preview.idempotencyKey);
    const replay = await executeConfirmedRequestFormalQuoteChanges(db, actor, preview.confirmationId, preview.idempotencyKey);
    expect(first.outcome).toBe("changes_requested");
    expect(replay.quoteResponse.id).toBe(first.quoteResponse.id);
    expect(fake.commercialQuoteResponses).toHaveLength(1);
    expect(fake.commercialQuoteResponses[0]).toMatchObject({
      document_id: quoteDocumentId,
      response: "changes_requested",
      message: "Please separate drone coverage and extend the quote validity to 30 days.",
    });
  });

  it("routes linked-planner formal quote changes to couple approval", async () => {
    const fake = new FakeDb();
    const clientId = crypto.randomUUID();
    const quoteRequestId = crypto.randomUUID();
    const quoteDocumentId = crypto.randomUUID();
    fake.plannerClients.push({
      id: clientId, planner_user_id: USER_ID, client_name: "Amina", partner_name: "Kamau",
      wedding_id: WEDDING_ID, linked_user_id: COUPLE_USER_ID, is_archived: false,
    });
    fake.formalQuoteBriefingRequests.push({
      id: quoteRequestId, vendorName: "Coast Film Studio", status: "responded",
      formalQuote: { id: quoteDocumentId, documentNumber: "QUO-2026-0042", status: "sent" },
    });
    const planner = { userId: USER_ID, role: "planner", plannerType: "full_service" };
    const db = fake as unknown as GatewayWriteDatabase;
    const preview = await previewRequestFormalQuoteChanges(db, planner, clientId, {
      quoteDocumentId, message: "Please remove the second shooter and revise the total.",
    });
    expect(preview.outcome).toBe("approval_requested");
    const receipt = await executeConfirmedRequestFormalQuoteChanges(db, planner, preview.confirmationId, preview.idempotencyKey);
    expect(receipt.outcome).toBe("approval_requested");
    expect(fake.commercialQuoteResponses).toHaveLength(0);
    expect(fake.changeRequests[0]).toMatchObject({
      target_table: "commercial_quote_responses", change_type: "create", couple_user_id: COUPLE_USER_ID,
      proposed_payload: { quote_document_id: quoteDocumentId, response: "changes_requested" },
    });
  });

  it("refuses stale formal quotes and supports cancelling a change preview", async () => {
    const fake = new FakeDb();
    const quoteRequestId = crypto.randomUUID();
    fake.formalQuoteBriefingRequests.push({
      id: quoteRequestId, vendorName: "Coast Film Studio", status: "responded",
      formalQuote: { id: crypto.randomUUID(), documentNumber: "QUO-2026-0042", status: "accepted" },
    });
    const db = fake as unknown as GatewayWriteDatabase;
    await expect(previewRequestFormalQuoteChanges(db, actor, null, {
      quoteRequestId, message: "Please revise the package.",
    })).rejects.toThrow("no longer awaiting changes");

    (fake.formalQuoteBriefingRequests[0].formalQuote as Row).status = "sent";
    const preview = await previewRequestFormalQuoteChanges(db, actor, null, {
      quoteRequestId, message: "Please revise the package.",
    });
    const revoked = await revokeRequestFormalQuoteChangesPreview(db, actor, preview.confirmationId, preview.idempotencyKey);
    expect(revoked.userSummary).toContain("No formal quote changes were requested");
    expect(fake.commercialQuoteResponses).toHaveLength(0);
  });

  it("saves a confirmed negotiation profile with one auditable unsent draft", async () => {
    const fake = new FakeDb();
    const quoteRequestId = crypto.randomUUID();
    const quoteDocumentId = crypto.randomUUID();
    fake.formalQuoteBriefingRequests.push({
      id: quoteRequestId, vendorName: "Coast Film Studio", status: "responded",
      formalQuote: {
        id: quoteDocumentId, documentNumber: "QUO-2026-0042", status: "sent",
        currency: "KES", totalAmount: 135000,
      },
    });
    const db = fake as unknown as GatewayWriteDatabase;
    const preview = await previewSaveNegotiationPlan(db, actor, null, {
      quoteDocumentId,
      targetBudgetKes: 120000,
      absoluteCeilingKes: 127500,
      mustHave: ["Full-day coverage", "Edited gallery"],
      willingToTrade: ["Remove drone coverage"],
      tone: "gentle",
      proposedTotalKes: 120000,
      draftMessage: "Could we keep full-day coverage and the edited gallery at KES 120,000 without drone coverage?",
    });
    expect(preview.userSummary).toContain("No vendor will be contacted");
    expect(fake.negotiationProfiles).toHaveLength(0);

    const first = await executeConfirmedSaveNegotiationPlan(db, actor, preview.confirmationId, preview.idempotencyKey);
    const replay = await executeConfirmedSaveNegotiationPlan(db, actor, preview.confirmationId, preview.idempotencyKey);
    expect(first.proposal).toMatchObject({ status: "draft", contactStatus: "not_contacted", roundNumber: 1 });
    expect(replay.proposal.id).toBe(first.proposal.id);
    expect(fake.negotiationProfiles).toHaveLength(1);
    expect(fake.negotiationProfiles[0]).toMatchObject({
      target_budget_kes: 120000,
      absolute_ceiling_kes: 127500,
      must_have: ["Full-day coverage", "Edited gallery"],
      willing_to_trade: ["Remove drone coverage"],
      tone: "gentle",
    });
    expect(fake.negotiationProposals).toHaveLength(1);
    expect(fake.negotiationProposals[0]).toMatchObject({
      direction: "outbound", status: "draft", contact_status: "not_contacted",
      proposed_total_kes: 120000,
    });
  });

  it("cancels a negotiation preview without saving and refuses a changed quote", async () => {
    const fake = new FakeDb();
    const quoteRequestId = crypto.randomUUID();
    const quoteDocumentId = crypto.randomUUID();
    fake.formalQuoteBriefingRequests.push({
      id: quoteRequestId, vendorName: "Coast Film Studio", status: "responded",
      formalQuote: {
        id: quoteDocumentId, documentNumber: "QUO-2026-0042", status: "sent",
        currency: "KES", totalAmount: 135000,
      },
    });
    const db = fake as unknown as GatewayWriteDatabase;
    const input = {
      quoteRequestId, targetBudgetKes: 120000,
      draftMessage: "Could you revise this package to KES 120,000?",
    };
    const cancelledPreview = await previewSaveNegotiationPlan(db, actor, null, input);
    const revoked = await revokeSaveNegotiationPlanPreview(
      db, actor, cancelledPreview.confirmationId, cancelledPreview.idempotencyKey,
    );
    expect(revoked.userSummary).toContain("No negotiation profile or draft proposal was saved");
    expect(fake.negotiationProfiles).toHaveLength(0);

    const stalePreview = await previewSaveNegotiationPlan(db, actor, null, input);
    (fake.formalQuoteBriefingRequests[0].formalQuote as Row).totalAmount = 140000;
    await expect(executeConfirmedSaveNegotiationPlan(
      db, actor, stalePreview.confirmationId, stalePreview.idempotencyKey,
    )).rejects.toThrow("changed after preview");
    expect(fake.negotiationProfiles).toHaveLength(0);
  });
});
