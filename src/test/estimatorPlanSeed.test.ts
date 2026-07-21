import { describe, expect, it } from 'vitest';
import { buildEstimatorRowsFromDraft, canSeedEstimatorPlan } from '@/lib/estimatorPlanSeed';
import { buildInteractiveBudgetPlan, rebalanceInteractiveBudgetPlan } from '@/lib/interactiveBudgetPlan';

describe('estimator plan handoff', () => {
  it('preserves the exact edited 21-category plan for budget seeding', () => {
    const initialPlan = buildInteractiveBudgetPlan(1_500_000, 120);
    const editedPlan = rebalanceInteractiveBudgetPlan(initialPlan, 'Catering', 600_000);

    const rows = buildEstimatorRowsFromDraft({
      guestCount: editedPlan.guestCount,
      county: 'Nairobi',
      weddingStyle: 'classic',
      venueTier: 'mid_tier',
      totalBudget: editedPlan.totalBudget,
      allocations: editedPlan.allocations,
    });

    expect(rows).toHaveLength(21);
    expect(rows?.find((row) => row.category === 'Catering')?.suggested_amount).toBe(600_000);
    expect(rows?.reduce((sum, row) => sum + row.suggested_amount, 0)).toBe(1_500_000);
    expect(rows?.every((row) => row.source === 'couple_plan')).toBe(true);
  });

  it('only seeds couples and committee planners', () => {
    expect(canSeedEstimatorPlan('couple')).toBe(true);
    expect(canSeedEstimatorPlan('planner', 'committee')).toBe(true);
    expect(canSeedEstimatorPlan('planner', 'professional')).toBe(false);
    expect(canSeedEstimatorPlan('vendor')).toBe(false);
  });
});
