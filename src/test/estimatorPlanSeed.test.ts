import { describe, expect, it } from 'vitest';
import {
  buildEstimatorRowsFromDraft,
  buildCompactEstimatorAllocations,
  canSeedEstimatorPlan,
  getEstimatorPlanDraftFromUserMetadata,
  parseEstimatorPlanDraft,
} from '@/lib/estimatorPlanSeed';
import { buildInteractiveBudgetPlan, updateInteractiveBudgetAllocation } from '@/lib/interactiveBudgetPlan';
import { isEstimatorCoupleSignupEntry } from '@/lib/authEntryFlows';

describe('estimator plan handoff', () => {
  it('locks estimator handoffs to the couple signup path', () => {
    expect(isEstimatorCoupleSignupEntry({
      mode: 'signup',
      flow: 'estimator',
      audience: 'couple',
      role: 'couple',
    })).toBe(true);
    expect(isEstimatorCoupleSignupEntry({
      mode: 'signup',
      flow: 'estimator',
      audience: 'professional',
      role: 'vendor',
    })).toBe(false);
  });

  it('preserves the exact edited 21-category plan for budget seeding', () => {
    const initialPlan = buildInteractiveBudgetPlan(1_500_000, 120);
    const editedPlan = updateInteractiveBudgetAllocation(initialPlan, 'Caterer', 600_000);

    const rows = buildEstimatorRowsFromDraft({
      guestCount: editedPlan.guestCount,
      county: 'Nairobi',
      weddingStyle: 'classic',
      venueTier: 'mid_tier',
      totalBudget: editedPlan.totalBudget,
      allocations: editedPlan.allocations,
    });

    expect(rows).toHaveLength(21);
    expect(rows?.find((row) => row.category === 'Caterer')?.suggested_amount).toBe(600_000);
    expect(rows?.reduce((sum, row) => sum + row.suggested_amount, 0)).toBeGreaterThan(1_500_000);
    expect(rows?.every((row) => row.source === 'couple_plan')).toBe(true);
    expect(editedPlan.allocations.find((row) => row.name === 'Caterer')?.isManuallyEdited).toBe(true);
    expect(editedPlan.allocations.find((row) => row.name === 'Caterer')?.lastEditedField).toBe('amount');
  });

  it('consolidates the estimator into the ten simple planning categories', () => {
    const plan = buildInteractiveBudgetPlan(1_500_000, 120);
    const compact = buildCompactEstimatorAllocations({
      guestCount: plan.guestCount,
      county: 'Nairobi',
      weddingStyle: 'classic',
      venueTier: 'mid_tier',
      totalBudget: plan.totalBudget,
      allocations: plan.allocations,
    });

    expect(compact).toHaveLength(10);
    expect(compact.reduce((total, row) => total + row.amount, 0)).toBe(1_500_000);
    expect(compact.find((row) => row.name === 'Catering')?.amount).toBe(
      plan.allocations
        .filter((row) => ['Caterer', 'Cake Artist & Baker'].includes(row.name))
        .reduce((total, row) => total + row.amount, 0),
    );
  });

  it('only seeds couples and committee planners', () => {
    expect(canSeedEstimatorPlan('couple')).toBe(true);
    expect(canSeedEstimatorPlan('planner', 'committee')).toBe(true);
    expect(canSeedEstimatorPlan('planner', 'professional')).toBe(false);
    expect(canSeedEstimatorPlan('vendor')).toBe(false);
  });

  it('recovers a valid estimator draft from signup metadata after email confirmation', () => {
    const draft = {
      guestCount: 120,
      county: 'Nairobi',
      weddingStyle: 'classic' as const,
      venueTier: 'mid_tier' as const,
      totalBudget: 1_500_000,
      allocations: buildInteractiveBudgetPlan(1_500_000, 120).allocations,
    };

    expect(parseEstimatorPlanDraft(draft)).toEqual(draft);
    expect(getEstimatorPlanDraftFromUserMetadata({ estimator_plan_draft: draft })).toEqual(draft);
  });

  it('rejects oversized or malformed account metadata drafts', () => {
    expect(parseEstimatorPlanDraft({
      guestCount: 120,
      county: 'Nairobi',
      weddingStyle: 'classic',
      venueTier: 'mid_tier',
      allocations: Array.from({ length: 51 }, (_, index) => ({
        name: `Item ${index}`,
        amount: 1,
        percentage: 1,
      })),
    })).toBeNull();
  });
});
