import { describe, expect, it } from 'vitest';
import { summarizeWeddingBudget } from '@/lib/budgetAllocation';

describe('summarizeWeddingBudget', () => {
  it('keeps private personal costs out of the wedding budget total', () => {
    const summary = summarizeWeddingBudget([
      { id: 'venue', name: 'Venue', allocated: 900_000, spent: 150_000, budget_scope: 'wedding' },
      { id: 'rings', name: 'Rings', allocated: 400_000, spent: 0, budget_scope: 'personal' },
    ], 1_000_000);

    expect(summary.allocated).toBe(900_000);
    expect(summary.remaining).toBe(100_000);
    expect(summary.overage).toBe(0);
  });

  it('identifies the largest safe allocations to review when the plan is over budget', () => {
    const summary = summarizeWeddingBudget([
      { id: 'venue', name: 'Venue', allocated: 700_000, spent: 300_000, budget_scope: 'wedding' },
      { id: 'decor', name: 'Décor', allocated: 550_000, spent: 0, budget_scope: 'wedding' },
    ], 1_000_000);

    expect(summary.overage).toBe(250_000);
    expect(summary.reductionCandidates.map((category) => category.name)).toEqual(['Décor', 'Venue']);
  });
});
