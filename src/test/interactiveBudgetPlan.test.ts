import { describe, expect, it } from 'vitest';
import {
  buildInteractiveBudgetPlan,
  getBudgetUtilizationPercentage,
  getBudgetUtilizationStatus,
  getGuestExperienceCost,
  resetAllInteractiveBudgetAllocations,
  resetInteractiveBudgetAllocation,
  removeInteractiveBudgetCategory,
  updateInteractiveBudgetAllocation,
  updateInteractiveBudgetPercentage,
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

  it('does not rebalance other categories after an edit', () => {
    const original = buildInteractiveBudgetPlan(1_500_000, 120);
    const décorBefore = original.allocations.find((item) => item.name === 'Décor')?.amount;
    const updated = updateInteractiveBudgetAllocation(original, 'Catering', 600_000);

    expect(updated.allocations.find((item) => item.name === 'Catering')?.amount).toBe(600_000);
    expect(updated.allocations.find((item) => item.name === 'Décor')?.amount).toBe(décorBefore);
    expect(updated.allocations.reduce((sum, item) => sum + item.amount, 0)).toBeGreaterThan(1_500_000);
  });

  it('supports independent category edits and semantic utilization states', () => {
    const original = buildInteractiveBudgetPlan(1_500_000, 120);
    const overBudget = updateInteractiveBudgetAllocation(original, 'Catering', 700_000);
    const utilization = getBudgetUtilizationPercentage(overBudget);

    expect(overBudget.allocations.find((item) => item.name === 'Catering')?.amount).toBe(700_000);
    expect(utilization).toBeGreaterThan(100);
    expect(getBudgetUtilizationStatus(utilization)).toBe('over');
    expect(getBudgetUtilizationStatus(100)).toBe('complete');
    expect(getBudgetUtilizationStatus(70)).toBe('under');
  });

  it('keeps amount and percentage linked without changing other categories', () => {
    const original = buildInteractiveBudgetPlan(1_500_000, 120);
    const cateringBefore = original.allocations.find((item) => item.name === 'Catering')!;
    const accommodationBefore = original.allocations.find((item) => item.name === 'Accommodation')!;
    const updated = updateInteractiveBudgetPercentage(original, 'Accommodation', 5);
    const accommodation = updated.allocations.find((item) => item.name === 'Accommodation')!;

    expect(accommodation.amount).toBe(75_000);
    expect(accommodation.percentage).toBe(5);
    expect(accommodation.isManuallyEdited).toBe(true);
    expect(accommodation.lastEditedField).toBe('percentage');
    expect(updated.allocations.find((item) => item.name === 'Catering')?.amount).toBe(cateringBefore.amount);
    expect(accommodationBefore.amount).not.toBe(accommodation.amount);
  });

  it('resets one or every edited allocation to the suggestion', () => {
    const original = buildInteractiveBudgetPlan(1_500_000, 120);
    const editedOnce = updateInteractiveBudgetAllocation(original, 'Accommodation', 90_000);
    const editedTwice = updateInteractiveBudgetPercentage(editedOnce, 'Catering', 30);
    const oneReset = resetInteractiveBudgetAllocation(editedTwice, 'Accommodation');
    const allReset = resetAllInteractiveBudgetAllocations(editedTwice);

    expect(oneReset.allocations.find((item) => item.name === 'Accommodation')?.amount)
      .toBe(original.allocations.find((item) => item.name === 'Accommodation')?.amount);
    expect(oneReset.allocations.find((item) => item.name === 'Catering')?.isManuallyEdited).toBe(true);
    expect(allReset.allocations.every((item) => item.isManuallyEdited === false)).toBe(true);
  });

  it('changes the total using either the same split or the same amounts', () => {
    const original = updateInteractiveBudgetPercentage(buildInteractiveBudgetPlan(1_500_000, 120), 'Accommodation', 5);
    const scaled = updateInteractiveBudgetSettings(original, 2_000_000, 120, 'scale_percentages');
    const fixed = updateInteractiveBudgetSettings(original, 2_000_000, 120, 'keep_amounts');

    expect(scaled.allocations.find((item) => item.name === 'Accommodation')?.amount).toBe(100_000);
    expect(fixed.allocations.find((item) => item.name === 'Accommodation')?.amount).toBe(75_000);
    expect(fixed.allocations.find((item) => item.name === 'Accommodation')?.percentage).toBe(3.75);
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

  it('supports zero, decimal percentages, large budgets, and guest changes after a manual edit', () => {
    const original = buildInteractiveBudgetPlan(250_000_000, 500);
    const zeroed = updateInteractiveBudgetAllocation(original, 'Cake', 0);
    const decimal = updateInteractiveBudgetPercentage(zeroed, 'Accommodation', 2.5);
    const withNewGuestCount = updateInteractiveBudgetSettings(decimal, decimal.totalBudget, 650, 'keep_amounts');

    expect(zeroed.allocations.find((item) => item.name === 'Cake')?.percentage).toBe(0);
    expect(decimal.allocations.find((item) => item.name === 'Accommodation')?.amount).toBe(6_250_000);
    expect(withNewGuestCount.allocations.find((item) => item.name === 'Accommodation')?.amount).toBe(6_250_000);
    expect(withNewGuestCount.allocations.find((item) => item.name === 'Accommodation')?.isManuallyEdited).toBe(true);
  });
});
