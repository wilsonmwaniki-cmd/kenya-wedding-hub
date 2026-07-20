import { describe, expect, it } from 'vitest';
import {
  buildInteractiveBudgetPlan,
  getBudgetUtilizationPercentage,
  getBudgetUtilizationStatus,
  getGuestExperienceCost,
  rebalanceInteractiveBudgetPlan,
  removeInteractiveBudgetCategory,
  updateInteractiveBudgetAllocation,
  updateInteractiveBudgetSettings,
  validateInteractiveBudgetCategories,
} from '@/lib/interactiveBudgetPlan';

describe('interactive budget plan', () => {
  it('uses every canonical wedding budget category and allocates the exact budget', () => {
    const plan = buildInteractiveBudgetPlan(2_000_000, 150);

    expect(validateInteractiveBudgetCategories()).toBe(true);
    expect(plan.allocations).toHaveLength(21);
    expect(plan.allocations.reduce((sum, item) => sum + item.amount, 0)).toBe(2_000_000);
  });

  it('moves more of the same budget into guest-sensitive categories for a larger wedding', () => {
    const intimatePlan = buildInteractiveBudgetPlan(2_000_000, 60);
    const largePlan = buildInteractiveBudgetPlan(2_000_000, 240);

    expect(getGuestExperienceCost(largePlan)).toBeGreaterThan(getGuestExperienceCost(intimatePlan));
  });

  it('rebalances the remaining categories after an edit without changing the total', () => {
    const original = buildInteractiveBudgetPlan(1_500_000, 120);
    const updated = rebalanceInteractiveBudgetPlan(original, 'Catering', 600_000);

    expect(updated.allocations.find((item) => item.name === 'Catering')?.amount).toBe(600_000);
    expect(updated.allocations.reduce((sum, item) => sum + item.amount, 0)).toBe(1_500_000);
  });

  it('supports independent category edits and semantic utilization states', () => {
    const original = buildInteractiveBudgetPlan(1_500_000, 120);
    const overBudget = updateInteractiveBudgetAllocation(original, 'Catering', 700_000);
    const utilization = getBudgetUtilizationPercentage(overBudget);

    expect(overBudget.allocations.find((item) => item.name === 'Catering')?.amount).toBe(700_000);
    expect(utilization).toBeGreaterThan(100);
    expect(getBudgetUtilizationStatus(utilization)).toBe('over');
    expect(getBudgetUtilizationStatus(92)).toBe('warning');
    expect(getBudgetUtilizationStatus(70)).toBe('safe');
  });

  it('removes unwanted categories and preserves remaining amounts when settings change', () => {
    const original = buildInteractiveBudgetPlan(1_500_000, 120);
    const withoutCake = removeInteractiveBudgetCategory(original, 'Cake');
    const adjusted = updateInteractiveBudgetSettings(withoutCake, 2_000_000, 180);

    expect(withoutCake.allocations).toHaveLength(20);
    expect(withoutCake.allocations.some((item) => item.name === 'Cake')).toBe(false);
    expect(adjusted.totalBudget).toBe(2_000_000);
    expect(adjusted.guestCount).toBe(180);
    expect(adjusted.allocations.find((item) => item.name === 'Catering')?.amount)
      .toBe(original.allocations.find((item) => item.name === 'Catering')?.amount);
  });
});
