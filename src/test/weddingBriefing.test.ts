import { describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { buildWeddingBriefing, getBriefingIntent, getWeddingBriefing, readBriefingRows, renderWeddingBriefing, resolveBriefingWedding, type BriefingSources } from '../../supabase/functions/_shared/weddingBriefing';

const weddingId = '11111111-1111-4111-8111-111111111111';
const clientId = '22222222-2222-4222-8222-222222222222';
const wedding = { id: weddingId, name: 'Sarah & Brian', wedding_date: '2026-12-12' };
const now = new Date('2026-09-28T09:00:00Z');
const couple = { userId: 'couple-user', role: 'couple', plannerType: null };
const planner = { userId: 'planner-user', role: 'planner', plannerType: 'professional' };
function sources(): BriefingSources {
  return Object.fromEntries(['tasks', 'budget', 'payments', 'guests', 'vendors'].map((key) => [key, { status: 'ready', rows: [] }])) as BriefingSources;
}

// Query fake enforces the same filters against fixtures. This tests capability boundaries,
// not deployed Postgres policies; live role verification remains a release gate.
function database(tables: Record<string, Record<string, unknown>[]>, failedTables: string[] = []) {
  const calls: { table: string; filters: [string, unknown][] }[] = [];
  const from = vi.fn((table: string) => {
    let rows = [...(tables[table] ?? [])];
    let offset = 0;
    let end = Infinity;
    const call = { table, filters: [] as [string, unknown][] };
    calls.push(call);
    const response = () => ({ data: failedTables.includes(table) ? null : rows.slice(offset, end + 1), error: failedTables.includes(table) ? { message: 'failed' } : null, count: rows.length });
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((field: string, value: unknown) => { call.filters.push([field, value]); rows = rows.filter((row) => row[field] === value); return query; }),
      is: vi.fn((field: string, value: unknown) => { call.filters.push([field, value]); rows = rows.filter((row) => row[field] === value); return query; }),
      in: vi.fn((field: string, values: unknown[]) => { rows = rows.filter((row) => values.includes(row[field])); return query; }),
      order: vi.fn(() => query),
      range: vi.fn((start: number, stop: number) => { offset = start; end = stop; return query; }),
      limit: vi.fn((limit: number) => { end = limit - 1; return query; }),
      maybeSingle: vi.fn(async () => ({ ...response(), data: response().data?.[0] ?? null })),
      then: (resolve: (value: ReturnType<typeof response>) => unknown) => Promise.resolve(response()).then(resolve),
    };
    return query;
  });
  return { db: { from } as unknown as Parameters<typeof resolveBriefingWedding>[0], calls, from };
}
function accessTables(userId = couple.userId, role = 'bride') {
  return {
    wedding_memberships: [{ user_id: userId, wedding_id: weddingId, role, membership_status: 'active', revoked_at: null }],
    weddings: [{ ...wedding, status: 'active', deleted_at: null }],
    planner_clients: [{ id: clientId, planner_user_id: planner.userId, wedding_id: weddingId, is_archived: false }],
  };
}

describe('authorized wedding briefing', () => {
  it('works through the real Supabase query client while preserving caller authorization', async () => {
    const requests: URL[] = [];
    const tables: Record<string, Record<string, unknown>[]> = {
      ...accessTables(), guests: Array.from({ length: 520 }, (_, index) => ({ id: String(index), wedding_id: weddingId, rsvp_status: 'confirmed' })),
    };
    const client = createClient('https://briefing-test.supabase.co', 'test-publishable-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: { Authorization: 'Bearer caller-test-token' },
        fetch: async (input, init) => {
          const url = new URL(String(input));
          requests.push(url);
          expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer caller-test-token');
          const rows = tables[url.pathname.split('/').pop()!] ?? [];
          const offset = Number(url.searchParams.get('offset') ?? 0);
          const limit = Number(url.searchParams.get('limit') ?? rows.length);
          return new Response(JSON.stringify(rows.slice(offset, offset + limit)), {
            headers: { 'Content-Type': 'application/json', 'Content-Range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` },
          });
        },
      },
    });
    const result = await getWeddingBriefing(client as unknown as Parameters<typeof getWeddingBriefing>[0], couple, null, now);
    expect(result.guests?.total).toBe(520);
    expect(requests.filter((url) => url.pathname.endsWith('/guests'))).toHaveLength(2);
    expect(requests.find((url) => url.pathname.endsWith('/tasks'))?.searchParams.get('wedding_id')).toBe(`eq.${weddingId}`);
  });

  it('allows an active couple membership and reads only that wedding', async () => {
    const { db, calls } = database({ ...accessTables(), guests: [{ id: '1', wedding_id: weddingId, rsvp_status: 'confirmed' }, { id: '2', wedding_id: 'other', rsvp_status: 'confirmed' }] });
    const result = await getWeddingBriefing(db, couple, null, now);
    expect(result.guests?.total).toBe(1);
    for (const call of calls.filter((call) => ['tasks', 'budget_categories', 'budget_payments', 'guests', 'vendors'].includes(call.table))) {
      expect(call.filters).toContainEqual(['wedding_id', weddingId]);
    }
  });
  it('allows only a planner-owned client with active wedding membership', async () => {
    const { db } = database(accessTables(planner.userId, 'planner'));
    expect(await resolveBriefingWedding(db, planner, clientId)).toEqual(expect.objectContaining(wedding));
  });
  it('rejects another planner guessing a client ID', async () => {
    const { db, calls } = database(accessTables(planner.userId, 'planner'));
    await expect(resolveBriefingWedding(db, { ...planner, userId: 'unrelated' }, clientId)).rejects.toMatchObject({ status: 403 });
    expect(calls.map((call) => call.table)).toEqual(['planner_clients']);
  });
  it('does not allow a client record to replace wedding membership', async () => {
    const { db } = database(accessTables());
    await expect(resolveBriefingWedding(db, planner, clientId)).rejects.toMatchObject({ status: 403 });
  });
  it.each(['vendor', 'admin'])('rejects broad wedding reads in %s context before querying data', async (role) => {
    const { db, from } = database(accessTables());
    await expect(resolveBriefingWedding(db, { ...couple, role })).rejects.toMatchObject({ status: 403 });
    expect(from).not.toHaveBeenCalled();
  });
  it.each(['invited', 'revoked'])('rejects %s membership', async (membership_status) => {
    const tables = accessTables();
    tables.wedding_memberships[0].membership_status = membership_status;
    const { db } = database(tables);
    await expect(resolveBriefingWedding(db, couple)).rejects.toMatchObject({ status: 403 });
  });
  it('requires a planner to select a client and rejects malformed IDs', async () => {
    const { db, from } = database({});
    await expect(resolveBriefingWedding(db, planner)).rejects.toMatchObject({ status: 400 });
    await expect(resolveBriefingWedding(db, planner, 'id,or=anything')).rejects.toMatchObject({ status: 400 });
    expect(from).not.toHaveBeenCalled();
  });
  it('fails closed when checking membership fails', async () => {
    const { db } = database(accessTables(), ['wedding_memberships']);
    await expect(resolveBriefingWedding(db, couple)).rejects.toMatchObject({ status: 503 });
  });
  it('does not silently choose between multiple wedding memberships', async () => {
    const tables = accessTables();
    tables.wedding_memberships.push({ ...tables.wedding_memberships[0], wedding_id: 'other' });
    const { db } = database(tables);
    await expect(resolveBriefingWedding(db, couple)).rejects.toMatchObject({ status: 409 });
  });
  it('paginates beyond both the old 200-guest limit and a 1000-row API page', async () => {
    const { db } = database({ guests: Array.from({ length: 1251 }, (_, i) => ({ id: String(i), wedding_id: weddingId })) });
    const result = await readBriefingRows(db, 'guests', 'id', weddingId);
    expect(result.status).toBe('ready');
    expect(result.rows).toHaveLength(1251);
  });
  it('does not total personal budget records', async () => {
    const { db } = database({ ...accessTables(), budget_categories: [
      { id: '1', wedding_id: weddingId, budget_scope: 'wedding', allocated: 100, spent: 20 },
      { id: '2', wedding_id: weddingId, budget_scope: 'personal', allocated: 900, spent: 40 },
    ] });
    expect((await getWeddingBriefing(db, couple, null, now)).budget).toMatchObject({ allocated: 100, recordedSpent: 20 });
  });
  it('returns a partial briefing when a source fails instead of claiming zero', async () => {
    const { db } = database(accessTables(), ['budget_payments']);
    const result = await getWeddingBriefing(db, couple, null, now);
    expect(result.payments).toBeNull();
    expect(result.sources.payments).toBe('unavailable');
    expect(renderWeddingBriefing(result, 'summary')).toContain('Could not load complete payments records');
    expect(renderWeddingBriefing(result, 'summary')).not.toContain('KES 0 across');
  });
});

describe('grounded numbers and priorities', () => {
  it('counts complete, overdue, upcoming and undated tasks without inventing dates', () => {
    const data = sources();
    data.tasks.rows = [
      { id: '1', title: 'Old', completed: false, due_date: '2026-09-27' },
      { id: '2', title: 'Today', completed: false, due_date: '2026-09-28' },
      { id: '3', title: 'End of week', completed: false, due_date: '2026-10-04' },
      { id: '4', title: 'Later', completed: false, due_date: '2026-10-05' },
      { id: '5', title: 'Done', completed: true, due_date: '2026-09-26' },
      { id: '6', title: 'Undated', completed: false, due_date: null },
    ];
    const result = buildWeddingBriefing(wedding, data, now);
    expect(result.tasks).toEqual({ total: 6, completed: 1, overdue: 1, upcoming: 2, undated: 1 });
    expect(result.priorities.map((item) => item.id)).toEqual(['1', '2', '3']);
  });
  it('uses the Kenyan date around UTC midnight', () => {
    expect(buildWeddingBriefing(wedding, sources(), new Date('2026-09-27T22:30:00Z')).today).toBe('2026-09-28');
  });
  it('keeps recorded spending and logged payments distinct and sums decimal amounts', () => {
    const data = sources();
    data.budget.rows = [{ id: '1', allocated: 1000, spent: 200 }];
    data.payments.rows = [{ id: '1', amount: 0.1 }, { id: '2', amount: 0.2 }];
    const result = buildWeddingBriefing(wedding, data, now);
    expect(result.budget?.recordedSpent).toBe(200);
    expect(result.payments?.recorded).toBe(0.3);
    expect(renderWeddingBriefing(result, 'summary')).toContain('not proof of provider settlement');
  });
  it('excludes paid and shortlisted vendors from payment priorities', () => {
    const data = sources();
    const base = { id: '1', name: 'Florist', selection_status: 'final', status: null, price: 1000, amount_paid: 200, payment_due_date: '2026-09-29' };
    data.vendors.rows = [base, { ...base, id: '2', selection_status: 'shortlist' }, { ...base, id: '3', amount_paid: 1000 }, { ...base, id: '4', price: null }, { ...base, id: '5', payment_due_date: null }];
    const result = buildWeddingBriefing(wedding, data, now);
    expect(result.priorities).toHaveLength(1);
    expect(result.priorities[0].reason).toContain('KES 800');
    expect(result.priorities[0].reason).toContain('check the agreed instalment');
    expect(result.missing.join(' ')).toContain('no recorded quote');
    expect(result.missing.join(' ')).toContain('no payment due date');
  });
  it('offers a next action for empty workspaces without claiming they are on track', () => {
    const content = renderWeddingBriefing(buildWeddingBriefing({ ...wedding, wedding_date: null }, sources(), now), 'week');
    expect(content).toContain('Add your first planning task');
    expect(content).toContain('The wedding date is not set');
    expect(content).toContain('does not confirm');
  });
  it('renders stored markdown as text, not an injected link or instruction', () => {
    const content = renderWeddingBriefing(buildWeddingBriefing({ ...wedding, name: '[Click](https://evil.test)' }, sources(), now), 'summary');
    expect(content).toContain('\\[Click\\]\\(https://evil.test\\)');
  });
  it('recognizes the two milestone questions without treating write requests as reads', () => {
    expect(getBriefingIntent(' How is our wedding doing? ')).toBe('summary');
    expect(getBriefingIntent('What should I focus on this week?')).toBe('week');
    expect(getBriefingIntent('How is my wedding doing? Also delete all tasks.')).toBeNull();
  });
});
