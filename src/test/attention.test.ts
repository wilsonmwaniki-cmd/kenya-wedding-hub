import { beforeEach, describe, expect, it, vi } from 'vitest';

const attentionQuery = vi.hoisted(() => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.in = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.limit = vi.fn(async () => ({ data: [], error: null }));
  return query;
});
const fromAttention = vi.hoisted(() => vi.fn(() => attentionQuery));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: fromAttention, rpc: vi.fn() },
}));

import {
  buildAttentionBrief,
  listAttentionItems,
  priorityForDueDate,
  type AttentionItem,
} from '@/lib/attention';

describe('priorityForDueDate', () => {
  const now = new Date('2026-08-04T09:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('promotes overdue reminders to urgent', () => {
    expect(priorityForDueDate('info', '2026-08-03T06:00:00Z', now)).toBe('urgent');
  });

  it('promotes reminders due within fourteen days to action', () => {
    expect(priorityForDueDate('info', '2026-08-15T06:00:00Z', now)).toBe('action');
  });

  it('leaves later reminders quiet until they approach', () => {
    expect(priorityForDueDate('info', '2026-09-04T06:00:00Z', now)).toBe('info');
  });

  it('includes the verified destination action in an assistant briefing', () => {
    const item: AttentionItem = {
      id: 'attention-1',
      createdAt: '2026-09-07T08:00:00Z',
      updatedAt: '2026-09-07T08:00:00Z',
      recipientRole: 'vendor',
      weddingId: null,
      sourceType: 'commercial_document',
      sourceId: 'invoice-1',
      kind: 'action',
      priority: 'urgent',
      status: 'unread',
      title: 'Invoice payment needs review',
      summary: 'Confirm the payment before releasing the booking.',
      actionLabel: 'Review payment',
      actionPath: '/vendor-documents/invoices',
      dueAt: '2026-09-07T10:00:00Z',
      metadata: { wedding_name: 'A & B' },
    };

    expect(buildAttentionBrief([item])).toContain(
      'available action: Review payment (/vendor-documents/invoices)',
    );
  });

  it('scopes assistant attention reads to the selected wedding', async () => {
    await listAttentionItems(100, 'wedding-1');

    expect(fromAttention).toHaveBeenCalledWith('attention_items');
    expect(attentionQuery.eq).toHaveBeenCalledWith('wedding_id', 'wedding-1');
    expect(attentionQuery.limit).toHaveBeenCalledWith(100);
  });
});
