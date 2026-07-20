import { describe, expect, it } from 'vitest';
import { buildConciergeNudges } from '@/lib/conciergeNudges';

describe('buildConciergeNudges', () => {
  it('orders urgent deadlines before advisory signals', () => {
    const nudges = buildConciergeNudges({
      overdueTasks: 2,
      stalledRsvps: 8,
      overspentCategories: 1,
      nearLimitCategories: 3,
      paymentsDueSoon: 1,
      openVendorFollowUps: 4,
    });

    expect(nudges.map((nudge) => nudge.id)).toEqual([
      'overdue_tasks',
      'vendor_payments_due',
      'budget_overrun',
      'stalled_rsvps',
      'vendor_follow_ups',
      'budget_near_limit',
    ]);
  });

  it('returns no invented alerts when the workspace is healthy', () => {
    expect(buildConciergeNudges({
      overdueTasks: 0,
      stalledRsvps: 0,
      overspentCategories: 0,
      nearLimitCategories: 0,
      paymentsDueSoon: 0,
      openVendorFollowUps: 0,
    })).toEqual([]);
  });
});
