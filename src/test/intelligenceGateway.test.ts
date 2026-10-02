import { describe, expect, it } from 'vitest';
import {
  createFirstPartyGatewayRequest,
  createGatewayRequest,
  executeGatewayRead,
  getGatewayCapability,
  getGatewayReadIntent,
  INTELLIGENCE_GATEWAY_CAPABILITIES,
  parseNegotiationBriefPrompt,
  type GatewayReadCapability,
} from '../../supabase/functions/_shared/intelligenceGateway';

const weddingId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';

function database(role = 'bride') {
  const tables: Record<string, Record<string, unknown>[]> = {
    wedding_memberships: [{
      user_id: 'couple-user', wedding_id: weddingId, role,
      membership_status: 'active', revoked_at: null,
    }],
    weddings: [{ id: weddingId, name: 'Gateway Wedding', wedding_date: '2027-05-14', status: 'active', deleted_at: null }],
    tasks: [{ id: 'task-1', wedding_id: weddingId, title: 'Confirm venue', completed: false, due_date: '2026-10-01' }],
    budget_categories: [], budget_payments: [], guests: [], vendors: [],
  };

  return databaseFromTables(tables);
}

function databaseFromTables(tables: Record<string, Record<string, unknown>[]>) {
  return {
    async rpc(functionName: string) {
      if (functionName === 'get_formal_quote_briefing') {
        return { data: tables.__formal_quote_briefing?.[0] ?? { requests: [] }, error: null };
      }
      if (functionName === 'get_negotiation_state') {
        return { data: tables.__negotiation_state?.[0] ?? { profiles: [] }, error: null };
      }
      if (functionName === 'get_agreement_review') {
        return { data: tables.__agreement_review?.[0] ?? { agreements: [] }, error: null };
      }
      return { data: null, error: { message: 'Unknown RPC' } };
    },
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      let start = 0;
      let stop = Number.POSITIVE_INFINITY;
      const response = () => ({ data: rows.slice(start, stop + 1), error: null, count: rows.length });
      const query = {
        select: () => query,
        eq: (field: string, value: unknown) => { rows = rows.filter((row) => row[field] === value); return query; },
        is: (field: string, value: unknown) => { rows = rows.filter((row) => row[field] === value); return query; },
        in: (field: string, values: unknown[]) => { rows = rows.filter((row) => values.includes(row[field])); return query; },
        order: () => query,
        range: (from: number, to: number) => { start = from; stop = to; return query; },
        limit: (count: number) => { stop = count - 1; return query; },
        maybeSingle: async () => ({ data: response().data[0] ?? null, error: null }),
        then: (resolve: (value: ReturnType<typeof response>) => unknown) => Promise.resolve(response()).then(resolve),
      };
      return query;
    },
  };
}

function request(capability: GatewayReadCapability = 'get_wedding_summary') {
  return createFirstPartyGatewayRequest({
    actor: { userId: 'couple-user', tenantId: null, role: 'couple', plannerType: null },
    capability,
    requestId,
    correlationId: requestId,
    sessionId: 'conversation-1',
  });
}

describe('Intelligence Gateway read foundation', () => {
  it('publishes a small versioned registry of domain capabilities', () => {
    expect(INTELLIGENCE_GATEWAY_CAPABILITIES.map((item) => item.name)).toEqual([
      'get_my_weddings',
      'get_wedding_summary',
      'get_weekly_focus',
      'get_budget_summary',
      'get_upcoming_payments',
      'get_tasks',
      'get_guest_summary',
      'get_vendor_summary',
      'get_formal_quote_summary',
      'get_negotiation_brief',
      'get_negotiation_state',
      'get_agreement_review',
      'get_vendor_candidates',
      'get_timeline_summary',
      'discover_vendors',
      'search_zania_vendors',
      'get_planner_portfolio_briefing',
      'get_vendor_business_briefing',
    ]);
    expect(getGatewayCapability('get_wedding_summary')).toMatchObject({ version: 1, mode: 'read', riskClass: 'A' });
    expect(getGatewayCapability('open_budget_page')).toBeNull();
  });

  it('normalizes a first-party call into the canonical request envelope', () => {
    expect(request()).toMatchObject({
      version: 1,
      actor: { userId: 'couple-user', role: 'couple' },
      client: { type: 'zania_web', appId: 'zania-first-party' },
      capability: 'get_wedding_summary',
      confirmation: { status: 'not_required' },
      trace: { requestId, correlationId: requestId },
    });
  });

  it('keeps provider identity in the canonical envelope for thin adapters', () => {
    expect(createGatewayRequest({
      actor: { userId: 'couple-user', tenantId: null, role: 'couple', plannerType: null },
      client: { type: 'chatgpt', appId: 'zania-mcp', sessionId: null },
      capability: 'get_tasks',
      requestId,
      correlationId: 'mcp-request',
    })).toMatchObject({
      client: { type: 'chatgpt', appId: 'zania-mcp' },
      capability: 'get_tasks',
      trace: { requestId, correlationId: 'mcp-request' },
    });
  });

  it('routes supported read intents without swallowing write requests', () => {
    expect(getGatewayReadIntent('How is my wedding doing?')).toBe('get_wedding_summary');
    expect(getGatewayReadIntent('Review our budget')).toBe('get_budget_summary');
    expect(getGatewayReadIntent('Which payments are coming up?')).toBe('get_upcoming_payments');
    expect(getGatewayReadIntent('How many guests are confirmed?')).toBe('get_guest_summary');
    expect(getGatewayReadIntent('Show our timeline')).toBe('get_timeline_summary');
    expect(getGatewayReadIntent('Which client wedding needs my attention first today, and why?')).toBe('get_planner_portfolio_briefing');
    expect(getGatewayReadIntent('Show me my planner portfolio briefing.')).toBe('get_planner_portfolio_briefing');
    expect(getGatewayReadIntent('Look at my vendor workspace and tell me the one thing I should do next.')).toBe('get_vendor_business_briefing');
    expect(getGatewayReadIntent('Find me a photographer in Nairobi under KES 150,000.')).toBe('discover_vendors');
    expect(getGatewayReadIntent('Show my saved vendor candidates.')).toBe('get_vendor_candidates');
    expect(getGatewayReadIntent('Compare my saved vendors.')).toBe('get_vendor_candidates');
    expect(getGatewayReadIntent('Which vendors have replied to our enquiries?')).toBe('get_vendor_summary');
    expect(getGatewayReadIntent('Compare our formal quotes.')).toBe('get_formal_quote_summary');
    expect(getGatewayReadIntent('Which quote requests are overdue?')).toBe('get_formal_quote_summary');
    expect(getGatewayReadIntent('Can you help us negotiate this quote around KES 220k?')).toBe('get_negotiation_brief');
    expect(getGatewayReadIntent('Show the negotiation status and counteroffer history.')).toBe('get_negotiation_state');
    expect(getGatewayReadIntent('Review the contract against what we agreed.')).toBe('get_agreement_review');
    expect(getGatewayReadIntent('What changed in the contract?')).toBe('get_agreement_review');
    expect(getGatewayReadIntent('Review our budget and change it')).toBeNull();
  });

  it('extracts a bounded negotiation target, ceiling and tone from ordinary language', () => {
    expect(parseNegotiationBriefPrompt('Help us negotiate around KES 220k, with an absolute ceiling of 240k, in planner mode.')).toEqual({
      targetBudgetKes: 220000,
      absoluteCeilingKes: 240000,
      tone: 'planner',
    });
  });

  it('returns structured data first and a rendered summary second', async () => {
    const result = await executeGatewayRead(database() as never, request('get_weekly_focus'), new Date('2026-09-29T09:00:00Z'));
    expect(result).toMatchObject({
      ok: true,
      version: 1,
      capability: 'get_weekly_focus',
      auditId: requestId,
      data: { intent: 'week', weddingState: { wedding: { id: weddingId } } },
    });
    expect(result.userSummary).toContain('Confirm venue');
    expect(result.nextActions).toContainEqual({ label: 'tasks', path: '/tasks' });
  });

  it('lists only active wedding memberships for the authenticated actor', async () => {
    const result = await executeGatewayRead(database() as never, request('get_my_weddings'));
    expect(result.data.weddings).toEqual([{ id: weddingId, name: 'Gateway Wedding', weddingDate: '2027-05-14' }]);
  });

  it.each([
    ['get_tasks', 'tasks'],
    ['get_budget_summary', 'budget'],
    ['get_upcoming_payments', 'upcomingPayments'],
    ['get_guest_summary', 'guests'],
    ['get_vendor_summary', 'vendors'],
    ['get_timeline_summary', 'timelines'],
  ] as const)('returns a scoped structured result for %s', async (capability, field) => {
    const result = await executeGatewayRead(database() as never, request(capability));
    expect(result.ok).toBe(true);
    expect(result.capability).toBe(capability);
    expect(result.data.wedding?.id).toBe(weddingId);
    expect(result.data).toHaveProperty(field);
    expect(result.auditId).toBe(requestId);
  });

  it('returns vendor replies as evidence without changing quote or booking state', async () => {
    const enquiryId = '33333333-3333-4333-8333-333333333333';
    const vendorId = '44444444-4444-4444-8444-444444444444';
    const db = databaseFromTables({
      wedding_memberships: [{ user_id: 'couple-user', wedding_id: weddingId, role: 'bride', membership_status: 'active', revoked_at: null }],
      weddings: [{ id: weddingId, name: 'Gateway Wedding', wedding_date: '2027-05-14', status: 'active', deleted_at: null }],
      tasks: [], budget_categories: [], budget_payments: [], guests: [],
      vendors: [{ id: vendorId, wedding_id: weddingId, name: 'Nairobi Light Studio', selection_status: 'shortlisted', status: null }],
      vendor_enquiries: [{
        id: enquiryId, wedding_id: weddingId, vendor_id: vendorId, subject: 'Availability', delivery_status: 'sent',
        response_status: 'available', responded_at: '2026-10-02T10:00:00.000Z',
      }],
      vendor_enquiry_responses: [{
        id: '55555555-5555-4555-8555-555555555555', enquiry_id: enquiryId, response: 'available',
        message: 'We are available.', quote_amount: 150000, quote_currency: 'KES', quote_valid_until: '2026-10-31',
        created_at: '2026-10-02T10:00:00.000Z',
      }],
    });
    const result = await executeGatewayRead(db as never, request('get_vendor_summary'));
    expect(result.data.vendorResponses).toMatchObject({
      awaiting: 0,
      responded: 1,
      responses: [{ vendorName: 'Nairobi Light Studio', response: 'available', quoteAmount: 150000 }],
    });
    expect(result.userSummary).toContain('indicative KES 150,000');
  });

  it('tracks and compares formal quote responses while excluding indicative replies', async () => {
    const db = databaseFromTables({
      wedding_memberships: [{ user_id: 'couple-user', wedding_id: weddingId, role: 'bride', membership_status: 'active', revoked_at: null }],
      weddings: [{ id: weddingId, name: 'Gateway Wedding', wedding_date: '2027-05-14', status: 'active', deleted_at: null }],
      __formal_quote_briefing: [{
        requests: [
          {
            id: 'request-1', vendorId: 'vendor-1', vendorName: 'Nairobi Light Studio', serviceCategory: 'Photography',
            status: 'responded', message: 'Send a formal quote', createdAt: '2026-10-01T09:00:00Z',
            dueAt: '2026-10-04T09:00:00Z', viewedAt: '2026-10-01T10:00:00Z', respondedAt: '2026-10-02T08:00:00Z', isOverdue: false,
            formalQuote: {
              id: 'quote-1', documentNumber: 'QUO-001', title: 'Photography package', status: 'sent', currency: 'KES',
              subtotal: 150000, discountAmount: 0, taxAmount: 0, totalAmount: 150000, issueDate: '2026-10-02',
              validUntil: '2026-10-31', notes: null, terms: '50% deposit',
              items: [{ description: 'Full-day photography', quantity: 1, unitPrice: 150000, lineTotal: 150000 }],
            },
          },
          {
            id: 'request-2', vendorId: 'vendor-2', vendorName: 'Coast Film Studio', serviceCategory: 'Videography',
            status: 'viewed', message: null, createdAt: '2026-09-28T09:00:00Z', dueAt: '2026-10-01T09:00:00Z',
            viewedAt: '2026-09-29T09:00:00Z', respondedAt: null, isOverdue: true, formalQuote: null,
          },
        ],
      }],
    });
    const result = await executeGatewayRead(db as never, request('get_formal_quote_summary'));
    expect(result.data.formalQuotes).toMatchObject({ total: 2, awaiting: 1, overdue: 1, responded: 1 });
    expect(result.userSummary).toContain('formal quote QUO-001');
    expect(result.userSummary).toContain('Indicative enquiry amounts are excluded');
    expect(result.userSummary).not.toContain('quote_amount');
  });

  it('prepares a truthful negotiation brief from formal quote evidence without changing records', async () => {
    const db = databaseFromTables({
      wedding_memberships: [{ user_id: 'couple-user', wedding_id: weddingId, role: 'bride', membership_status: 'active', revoked_at: null }],
      weddings: [{ id: weddingId, name: 'Gateway Wedding', wedding_date: '2027-05-14', status: 'active', deleted_at: null }],
      __formal_quote_briefing: [{
        requests: [
          {
            id: '11111111-2222-4333-8444-555555555555', vendorId: 'vendor-1', vendorName: 'Nairobi Light Studio', serviceCategory: 'Photography',
            status: 'responded', message: 'Send a formal quote', createdAt: '2026-10-01T09:00:00Z',
            dueAt: null, viewedAt: '2026-10-01T10:00:00Z', respondedAt: '2026-10-02T08:00:00Z', isOverdue: false,
            formalQuote: {
              id: '22222222-3333-4444-8555-666666666666', documentNumber: 'QUO-101', title: 'Photography package', status: 'sent', currency: 'KES',
              subtotal: 280000, discountAmount: 0, taxAmount: 0, totalAmount: 280000, issueDate: '2026-10-02',
              validUntil: '2026-10-31', notes: null, terms: 'KES 100,000 deposit, balance before the wedding',
              items: [
                { description: 'Full wedding day photography', quantity: 1, unitPrice: 220000, lineTotal: 220000 },
                { description: 'Engagement session', quantity: 1, unitPrice: 30000, lineTotal: 30000 },
                { description: 'Wedding album', quantity: 1, unitPrice: 30000, lineTotal: 30000 },
              ],
            },
          },
          {
            id: '33333333-4444-4555-8666-777777777777', vendorId: 'vendor-2', vendorName: 'Documentary Frames', serviceCategory: 'Photography',
            status: 'responded', message: null, createdAt: '2026-10-01T09:00:00Z', dueAt: null, viewedAt: null,
            respondedAt: '2026-10-02T09:00:00Z', isOverdue: false,
            formalQuote: {
              id: '44444444-5555-4666-8777-888888888888', documentNumber: 'QUO-102', title: 'Photo coverage', status: 'sent', currency: 'KES',
              subtotal: 230000, discountAmount: 0, taxAmount: 0, totalAmount: 230000, issueDate: '2026-10-02',
              validUntil: null, notes: null, terms: null,
              items: [{ description: 'Full-day documentary photography', quantity: 1, unitPrice: 230000, lineTotal: 230000 }],
            },
          },
        ],
      }],
    });
    const negotiationRequest = createFirstPartyGatewayRequest({
      actor: { userId: 'couple-user', tenantId: null, role: 'couple', plannerType: null },
      capability: 'get_negotiation_brief', requestId, correlationId: requestId,
      arguments: {
        vendorName: 'Nairobi Light Studio', targetBudgetKes: 220000, absoluteCeilingKes: 240000,
        mustHave: ['full wedding day'], willingToTrade: ['album', 'engagement session'], tone: 'planner',
      },
    });
    const result = await executeGatewayRead(db as never, negotiationRequest);
    expect(result.data.negotiation).toMatchObject({
      contactStatus: 'not_contacted',
      profile: { targetBudget: 220000, absoluteCeiling: 240000, tone: 'planner' },
      quotes: [{
        vendorName: 'Nairobi Light Studio', quotedTotal: 280000, gapToTarget: 60000,
        possibleTradeItems: [{ description: 'Engagement session' }, { description: 'Wedding album' }],
        formalAlternatives: [{ vendorName: 'Documentary Frames', totalAmount: 230000 }],
      }],
    });
    expect(result.userSummary).toContain('KES 60,000 above the target');
    expect(result.userSummary).toContain('Draft only — not sent');
    expect(result.userSummary).toContain('No vendor was contacted');
    expect(result.warnings).toContain('Never invent competing offers, urgency, budgets or vendor commitments.');
  });

  it('returns evidence-backed negotiation rounds and derived Deal State', async () => {
    const db = databaseFromTables({
      wedding_memberships: [{ user_id: 'couple-user', wedding_id: weddingId, role: 'bride', membership_status: 'active', revoked_at: null }],
      weddings: [{ id: weddingId, name: 'Gateway Wedding', wedding_date: '2027-05-14', status: 'active', deleted_at: null }],
      __negotiation_state: [{ profiles: [{
        id: 'profile-1', vendorName: 'Nairobi Light Studio', documentNumber: 'QUO-101', quotedTotalKes: 280000,
        targetBudgetKes: 220000, absoluteCeilingKes: 240000, mustHave: ['Full wedding day'], willingToTrade: ['Album'],
        tone: 'planner', dealState: 'negotiating', agreedTotalKes: null, agreedAt: null,
        rounds: [
          { id: 'round-1', roundNumber: 1, direction: 'outbound', status: 'sent', contactStatus: 'contacted', message: 'Could we remove the album?', proposedTotalKes: 220000, source: 'intelligence_gateway', createdAt: '2026-10-02T10:00:00Z' },
          { id: 'round-2', roundNumber: 2, direction: 'inbound', status: 'countered', contactStatus: 'contacted', message: 'Vendor returned revised formal quote QUO-101.', proposedTotalKes: 235000, source: 'vendor_response', createdAt: '2026-10-02T11:00:00Z' },
        ],
      }] }],
    });
    const result = await executeGatewayRead(db as never, request('get_negotiation_state'));
    expect(result.data.negotiationState?.profiles[0]).toMatchObject({
      vendorName: 'Nairobi Light Studio', dealState: 'negotiating',
      rounds: [
        { roundNumber: 1, direction: 'outbound', status: 'sent' },
        { roundNumber: 2, direction: 'inbound', status: 'countered', proposedTotalKes: 235000 },
      ],
    });
    expect(result.userSummary).toContain('Latest round 2: inbound countered at KES 235,000');
    expect(result.warnings[0]).toContain('conversation alone is not an agreement');
  });

  it('returns factual agreement discrepancies and preserves unknowns', async () => {
    const db = databaseFromTables({
      wedding_memberships: [{ user_id: 'couple-user', wedding_id: weddingId, role: 'bride', membership_status: 'active', revoked_at: null }],
      weddings: [{ id: weddingId, name: 'Gateway Wedding', wedding_date: '2027-05-14', status: 'active', deleted_at: null }],
      __agreement_review: [{ agreements: [{
        id: 'agreement-1', vendorName: 'Nairobi Light Studio', state: 'reviewed', reviewStatus: 'needs_review',
        acceptedQuote: { documentNumber: 'QUO-101', currency: 'KES', totalAmount: 235000 },
        contractId: 'contract-1', contractTitle: 'Wedding photography agreement', contractStatus: 'awaiting_signature',
        contractFinancials: { currency: 'KES', totalAmount: 235000, depositAmount: 100000, paymentSchedule: [{ title: 'Deposit', amount: 100000, dueDate: '2026-12-01' }] },
        proposedObligations: [{ kind: 'payment', title: 'Deposit', amount: 100000, currency: 'KES', dueDate: '2026-12-01', source: 'contract_payment_schedule' }],
        discrepancyCount: 1, unknownCount: 1, comparedAt: '2026-10-02T12:00:00Z',
        comparison: [
          { code: 'contract_event_date_changed', field: 'event_date', severity: 'high', message: 'The contract event date differs from the wedding or request date.', agreedValue: '2027-05-14', contractValue: '2027-05-15' },
          { code: 'contract_amount_unrecorded', field: 'amount', severity: 'unknown', message: 'The contract does not store a structured total, so Zania cannot verify its price against the accepted quote.', agreedValue: 235000, contractValue: null },
        ],
      }] }],
    });
    const result = await executeGatewayRead(db as never, request('get_agreement_review'));
    expect(result.data.agreementReview?.agreements[0]).toMatchObject({
      vendorName: 'Nairobi Light Studio', reviewStatus: 'needs_review', discrepancyCount: 1, unknownCount: 1,
      comparison: [{ field: 'event_date', severity: 'high' }, { field: 'amount', severity: 'unknown' }],
      proposedObligations: [{ title: 'Deposit', amount: 100000, dueDate: '2026-12-01' }],
    });
    expect(result.userSummary).toContain('Compared with QUO-101 at KES 235,000');
    expect(result.userSummary).toContain('does not store a structured total');
    expect(result.userSummary).toContain('Deposit: KES 100,000 due 2026-12-01');
    expect(result.userSummary).toContain('confirm the exact task');
    expect(result.warnings[0]).toContain('not legal advice');
  });

  it('surfaces a standalone external contract as unconfirmed until the user reviews it', async () => {
    const db = databaseFromTables({
      wedding_memberships: [{ user_id: 'couple-user', wedding_id: weddingId, role: 'bride', membership_status: 'active', revoked_at: null }],
      weddings: [{ id: weddingId, name: 'Gateway Wedding', wedding_date: '2027-05-14', status: 'active', deleted_at: null }],
      __agreement_review: [{ agreements: [], externalContracts: [{
        id: 'upload-1', filename: 'coast-film-contract.pdf', status: 'extracted', agreementId: null,
        facts: { vendorName: 'Coast Film Studio', currency: 'KES', totalAmount: '250000', unknowns: ['Cancellation terms were not found'] },
        fileDeletedAt: '2026-10-02T14:00:00Z', createdAt: '2026-10-02T13:59:00Z',
      }] }],
    });
    const result = await executeGatewayRead(db as never, request('get_agreement_review'));
    expect(result.data.agreementReview?.externalContracts[0]).toMatchObject({ filename: 'coast-film-contract.pdf', status: 'extracted' });
    expect(result.userSummary).toContain('unconfirmed AI extraction');
    expect(result.userSummary).toContain('Cancellation terms were not found');
  });

  it('fails closed before reading wedding records for an unauthorized role', async () => {
    const vendorRequest = {
      ...request(),
      actor: { userId: 'vendor-user', tenantId: null, role: 'vendor', plannerType: null },
    };
    await expect(executeGatewayRead(database() as never, vendorRequest)).rejects.toMatchObject({ status: 403 });
  });

  it('returns a bounded cross-wedding priority briefing for the authenticated planner', async () => {
    const db = databaseFromTables({
      planner_clients: [
        { id: 'client-1', planner_user_id: 'planner-user', client_name: 'Amina', partner_name: 'Kamau', wedding_date: '2027-02-10', linked_user_id: null, is_archived: false },
        { id: 'client-2', planner_user_id: 'planner-user', client_name: 'Njeri', partner_name: null, wedding_date: '2027-06-05', linked_user_id: 'linked-user', is_archived: false },
        { id: 'other-client', planner_user_id: 'other-planner', client_name: 'Hidden', partner_name: null, wedding_date: null, linked_user_id: null, is_archived: false },
      ],
      tasks: [
        { id: 'task-a', title: 'Confirm venue', completed: false, due_date: '2026-09-28', client_id: 'client-1', user_id: 'planner-user' },
        { id: 'task-b', title: 'Review quote', completed: false, due_date: '2026-10-02', client_id: null, user_id: 'linked-user' },
        { id: 'task-hidden', title: 'Hidden task', completed: false, due_date: '2026-09-20', client_id: 'other-client', user_id: 'other-planner' },
      ],
    });
    const plannerRequest = createGatewayRequest({
      actor: { userId: 'planner-user', tenantId: null, role: 'planner', plannerType: 'professional' },
      client: { type: 'zania_web', appId: 'zania-first-party', sessionId: 'planner-session' },
      capability: 'get_planner_portfolio_briefing', requestId, correlationId: requestId,
    });
    const result = await executeGatewayRead(db as never, plannerRequest, new Date('2026-09-30T09:00:00Z'));
    expect(result.data.plannerPortfolio).toMatchObject({ clients: 2, openTasks: 2, overdueTasks: 1, dueSoonTasks: 1 });
    expect(result.data.plannerPortfolio?.priorities[0]).toMatchObject({ clientName: 'Amina & Kamau', overdueTasks: 1 });
    expect(result.userSummary).toContain('Start with Amina & Kamau');
    expect(result.userSummary).not.toContain('Hidden');
  });

  it('returns lead, booking and invoice priorities only for the authenticated vendor', async () => {
    const db = databaseFromTables({
      vendor_listings: [
        { id: 'listing-1', user_id: 'vendor-user', business_name: 'Photo Studio' },
        { id: 'listing-hidden', user_id: 'other-vendor', business_name: 'Hidden Studio' },
      ],
      vendor_connection_requests: [
        { id: 'lead-1', vendor_listing_id: 'listing-1', status: 'pending', created_at: '2026-09-29T10:00:00Z' },
        { id: 'lead-hidden', vendor_listing_id: 'listing-hidden', status: 'pending', created_at: '2026-09-20T10:00:00Z' },
      ],
      vendors: [
        { id: 'booking-1', vendor_listing_id: 'listing-1', status: 'booked', price: 100000, amount_paid: 25000, payment_due_date: '2026-10-05', created_at: '2026-09-01T10:00:00Z' },
      ],
      commercial_documents: [
        { id: 'invoice-1', user_id: 'vendor-user', role: 'vendor', document_type: 'invoice', status: 'sent', recipient_name: 'Amina', total_amount: 50000, balance_due: 50000, due_date: '2026-09-25', issue_date: '2026-09-01' },
        { id: 'invoice-hidden', user_id: 'other-vendor', role: 'vendor', document_type: 'invoice', status: 'sent', recipient_name: 'Hidden', total_amount: 90000, balance_due: 90000, due_date: '2026-09-20', issue_date: '2026-09-01' },
      ],
    });
    const vendorRequest = createGatewayRequest({
      actor: { userId: 'vendor-user', tenantId: null, role: 'vendor', plannerType: null },
      client: { type: 'zania_web', appId: 'zania-first-party', sessionId: 'vendor-session' },
      capability: 'get_vendor_business_briefing', requestId, correlationId: requestId,
    });
    const result = await executeGatewayRead(db as never, vendorRequest, new Date('2026-09-30T09:00:00Z'));
    expect(result.data.vendorBusiness).toMatchObject({
      listings: 1, newEnquiries: 1, activeBookings: 1,
      invoicesAwaitingPayment: 1, overdueInvoices: 1, recordedOutstanding: 50000,
    });
    expect(result.data.vendorBusiness?.priorities.map((item) => item.kind)).toEqual(['invoice', 'lead', 'booking_payment']);
    expect(result.userSummary).not.toContain('Hidden');
  });

  it('denies professional briefings to the wrong account role', async () => {
    const couple = request();
    await expect(executeGatewayRead(database() as never, { ...couple, capability: 'get_vendor_business_briefing' })).rejects.toMatchObject({ status: 403 });
    await expect(executeGatewayRead(database() as never, { ...couple, capability: 'get_planner_portfolio_briefing' })).rejects.toMatchObject({ status: 403 });
  });

  it('returns evidence-backed internal vendor discovery results for couples', async () => {
    const db = databaseFromTables({
      vendor_listings: [
        {
          id: 'listing-1', user_id: 'vendor-user', business_name: 'Nairobi Light Studio',
          category: 'Photography', description: 'Wedding photography', website: 'https://example.com',
          location: 'Nairobi', location_town: 'Nairobi', location_county: 'Nairobi',
          services: ['Full-day photography'], service_areas: ['Nairobi', 'Kiambu'], travel_scope: 'nationwide',
          minimum_budget_kes: 80000, maximum_budget_kes: 180000, is_verified: true,
          profile_kind: 'claimed', updated_at: '2026-09-30T08:00:00Z', is_approved: true, directory_opt_out: false,
        },
        {
          id: 'listing-hidden', user_id: null, business_name: 'Opted Out Studio',
          category: 'Photography', description: null, website: null, location: 'Nairobi',
          location_town: 'Nairobi', location_county: 'Nairobi', services: [], service_areas: [],
          travel_scope: 'local', minimum_budget_kes: null, maximum_budget_kes: null, is_verified: false,
          profile_kind: 'unclaimed', updated_at: '2026-09-30T08:00:00Z', is_approved: true, directory_opt_out: true,
        },
      ],
    });
    const vendorSearchRequest = createFirstPartyGatewayRequest({
      actor: { userId: 'couple-user', tenantId: null, role: 'couple', plannerType: null },
      capability: 'search_zania_vendors', requestId, correlationId: requestId,
      arguments: { category: 'photographer', location: 'Nairobi', budgetMaxKes: 150000 },
    });

    const result = await executeGatewayRead(db as never, vendorSearchRequest);

    expect(result.data.vendorSearch).toMatchObject({
      searchedSource: 'zania_directory', sourceCoverage: 'internal_only',
      matches: [{
        businessName: 'Nairobi Light Studio', profileStatus: 'claimed', isVerified: true,
        evidence: { sourceKind: 'zania_listing', sourceRecordId: 'listing-1' },
      }],
    });
    expect(result.userSummary).toContain('Nairobi Light Studio');
    expect(result.warnings[0]).toContain('Zania listings only');
  });

  it('denies vendor discovery to vendor accounts', async () => {
    const vendorSearchRequest = createFirstPartyGatewayRequest({
      actor: { userId: 'vendor-user', tenantId: null, role: 'vendor', plannerType: null },
      capability: 'search_zania_vendors', requestId, correlationId: requestId,
      arguments: { category: 'photographer' },
    });
    await expect(executeGatewayRead(databaseFromTables({}) as never, vendorSearchRequest))
      .rejects.toMatchObject({ status: 403 });
  });

  it('lists only the authenticated actor\'s private saved vendor candidates', async () => {
    const db = databaseFromTables({
      vendor_candidates: [
        {
          id: 'candidate-1', owner_user_id: 'planner-user', business_name: 'Coast Films',
          category: 'Wedding videography', location: 'Mombasa', website: 'https://coast.example/',
          source_url: 'https://coast.example/', source_kind: 'official_website', profile_status: 'discovered',
          candidate_status: 'saved', wedding_id: null, planner_client_id: null,
          snapshot: { summary: 'Mombasa wedding filmmaker.', matchReasons: ['Within budget'], unknowns: ['Availability'] },
          created_at: '2026-10-01T12:00:00Z',
        },
        {
          id: 'candidate-hidden', owner_user_id: 'other-planner', business_name: 'Hidden Films',
          category: 'Videography', location: 'Nairobi', website: null, source_url: null,
          source_kind: 'search_result', profile_status: 'discovered', candidate_status: 'saved',
          wedding_id: null, planner_client_id: null, snapshot: {}, created_at: '2026-10-01T13:00:00Z',
        },
        {
          id: 'candidate-dismissed', owner_user_id: 'planner-user', business_name: 'Dismissed Films',
          category: 'Videography', location: null, website: null, source_url: null,
          source_kind: 'search_result', profile_status: 'discovered', candidate_status: 'dismissed',
          wedding_id: null, planner_client_id: null, snapshot: {}, created_at: '2026-10-01T11:00:00Z',
        },
      ],
    });
    const plannerRequest = createFirstPartyGatewayRequest({
      actor: { userId: 'planner-user', tenantId: null, role: 'planner', plannerType: 'professional' },
      capability: 'get_vendor_candidates', requestId, correlationId: requestId,
    });

    const result = await executeGatewayRead(db as never, plannerRequest);

    expect(result.data.vendorCandidates).toMatchObject({
      total: 1,
      candidates: [{ businessName: 'Coast Films', assignment: 'unassigned', matchReasons: ['Within budget'] }],
    });
    expect(result.userSummary).toContain('Coast Films');
    expect(result.userSummary).not.toContain('Hidden Films');
    expect(result.userSummary).not.toContain('Dismissed Films');
    expect(result.nextActions).toContainEqual({ label: 'Open saved candidates', path: '/vendor-candidates' });
  });

  it('denies saved candidate reads to vendor accounts', async () => {
    const vendorRequest = createFirstPartyGatewayRequest({
      actor: { userId: 'vendor-user', tenantId: null, role: 'vendor', plannerType: null },
      capability: 'get_vendor_candidates', requestId, correlationId: requestId,
    });
    await expect(executeGatewayRead(databaseFromTables({ vendor_candidates: [] }) as never, vendorRequest))
      .rejects.toMatchObject({ status: 403 });
  });

  it('falls back to source-backed external discovery when internal results are insufficient', async () => {
    const discoveryRequest = createFirstPartyGatewayRequest({
      actor: { userId: 'couple-user', tenantId: null, role: 'couple', plannerType: null },
      capability: 'discover_vendors', requestId, correlationId: requestId,
      arguments: { category: 'photographer', location: 'Nairobi', limit: 3 },
    });
    const externalVendorSearch = async () => ({
      matches: [{
        businessName: 'Public Light Studio', category: 'Photographer', location: 'Nairobi',
        website: 'https://public-light.example/', summary: 'Wedding photography studio.',
        matchReasons: ['Works in Nairobi'], unknowns: ['Current price and availability are unknown'],
        sources: [{
          url: 'https://public-light.example/', title: 'Public Light Studio',
          sourceKind: 'official_website' as const, observedAt: '2026-10-01T12:00:00.000Z',
        }],
      }],
      sourceCoverage: 'external_web' as const,
      searchedAt: '2026-10-01T12:00:00.000Z',
      searchQueries: ['Nairobi wedding photographer'],
    });

    const result = await executeGatewayRead(
      databaseFromTables({ vendor_listings: [] }) as never,
      discoveryRequest,
      new Date('2026-10-01T12:00:00Z'),
      { externalVendorSearch },
    );

    expect(result.data.vendorDiscovery).toMatchObject({
      sourceCoverage: 'internal_plus_external',
      internal: { matches: [] },
      external: { matches: [{ businessName: 'Public Light Studio' }] },
    });
    expect(result.userSummary).toContain('[Public Light Studio](https://public-light.example/)');
    expect(result.userSummary).toContain('not availability, price, verification or quote confirmations');
  });
});
