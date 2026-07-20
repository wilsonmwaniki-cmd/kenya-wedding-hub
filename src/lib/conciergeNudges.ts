export type ConciergeNudgeTone = 'danger' | 'warning' | 'info';

export interface ConciergeNudge {
  id: string;
  priority: number;
  tone: ConciergeNudgeTone;
  title: string;
  body: string;
  prompt: string;
  href: string;
}

export interface ConciergeNudgeSignals {
  overdueTasks: number;
  stalledRsvps: number;
  overspentCategories: number;
  nearLimitCategories: number;
  paymentsDueSoon: number;
  openVendorFollowUps: number;
}

export function buildConciergeNudges(signals: ConciergeNudgeSignals): ConciergeNudge[] {
  const nudges: ConciergeNudge[] = [];

  if (signals.overdueTasks > 0) {
    nudges.push({
      id: 'overdue_tasks',
      priority: 100,
      tone: 'danger',
      title: `${signals.overdueTasks} overdue task${signals.overdueTasks === 1 ? '' : 's'} need a decision`,
      body: 'Clear, reschedule, or delegate the overdue work before it blocks the next milestone.',
      prompt: 'Review the overdue tasks and prepare the smallest realistic catch-up plan. Offer to update the tasks after I review it.',
      href: '/tasks',
    });
  }

  if (signals.paymentsDueSoon > 0) {
    nudges.push({
      id: 'vendor_payments_due',
      priority: 90,
      tone: 'warning',
      title: `${signals.paymentsDueSoon} vendor payment${signals.paymentsDueSoon === 1 ? '' : 's'} due soon`,
      body: 'Review the due dates and outstanding balances before a booking is put at risk.',
      prompt: 'Review upcoming vendor payments, rank them by urgency, and offer to record a payment only after I confirm the details.',
      href: '/vendors',
    });
  }

  if (signals.overspentCategories > 0) {
    nudges.push({
      id: 'budget_overrun',
      priority: 85,
      tone: 'danger',
      title: `${signals.overspentCategories} budget categor${signals.overspentCategories === 1 ? 'y is' : 'ies are'} over plan`,
      body: 'Rebalance deliberately before approving another expense.',
      prompt: 'Explain the budget overruns, suggest the least disruptive rebalance, and wait for confirmation before changing anything.',
      href: '/budget',
    });
  }

  if (signals.stalledRsvps > 0) {
    nudges.push({
      id: 'stalled_rsvps',
      priority: 75,
      tone: 'info',
      title: `${signals.stalledRsvps} RSVP${signals.stalledRsvps === 1 ? '' : 's'} have been pending for two weeks`,
      body: 'A calm follow-up now will make seating and catering decisions more reliable.',
      prompt: 'Help me plan a polite RSVP follow-up for guests who have been pending for at least two weeks.',
      href: '/guests',
    });
  }

  if (signals.openVendorFollowUps > 0) {
    nudges.push({
      id: 'vendor_follow_ups',
      priority: 70,
      tone: 'warning',
      title: `${signals.openVendorFollowUps} vendor follow-up${signals.openVendorFollowUps === 1 ? '' : 's'} still open`,
      body: 'Close the highest-impact follow-up before starting another vendor conversation.',
      prompt: 'Prioritize the open vendor follow-ups and offer to create or update the most urgent reminder after I confirm it.',
      href: '/vendors',
    });
  }

  if (signals.nearLimitCategories > 0) {
    nudges.push({
      id: 'budget_near_limit',
      priority: 60,
      tone: 'warning',
      title: `${signals.nearLimitCategories} budget categor${signals.nearLimitCategories === 1 ? 'y is' : 'ies are'} near the limit`,
      body: 'Check the remaining room before committing to another cost.',
      prompt: 'Show me which budget categories are near their limits and what spending decision should come next.',
      href: '/budget',
    });
  }

  return nudges.sort((left, right) => right.priority - left.priority);
}
