import { describe, expect, it } from 'vitest';
import {
  buildInteractiveBudgetPlan,
  getBudgetUtilizationPercentage,
  getBudgetUtilizationStatus,
  getCoreGuestCost,
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
    expect(plan.allocations).toHaveLength(22);
    expect(plan.allocations.reduce((sum, item) => sum + item.amount, 0)).toBe(2_000_000);
  });

  it('moves more of the same budget into guest-sensitive categories for a larger wedding', () => {
    const intimatePlan = buildInteractiveBudgetPlan(2_000_000, 60);
    const largePlan = buildInteractiveBudgetPlan(2_000_000, 240);

    expect(getCoreGuestCost(largePlan)).toBeGreaterThan(getCoreGuestCost(intimatePlan));
  });

  it('calculates core cost per guest from catering, décor, and cake only', () => {
    const plan = buildInteractiveBudgetPlan(1_500_000, 120);
    const expectedCoreGuestCost = plan.allocations
      .filter((item) => ['Caterer', 'Décor, Tents, Chairs, Tables', 'Cake Artist & Baker'].includes(item.name))
      .reduce((sum, item) => sum + item.amount, 0);

    expect(getCoreGuestCost(plan)).toBe(expectedCoreGuestCost);

    const venueEdited = updateInteractiveBudgetAllocation(plan, 'Wedding Venue', 900_000);
    expect(getCoreGuestCost(venueEdited)).toBe(expectedCoreGuestCost);

    const cateringEdited = updateInteractiveBudgetAllocation(plan, 'Caterer', 600_000);
    expect(getCoreGuestCost(cateringEdited)).toBe(
      expectedCoreGuestCost
        - (plan.allocations.find((item) => item.name === 'Caterer')?.amount ?? 0)
        + 600_000,
    );
  });

  it('does not rebalance other categories after an edit', () => {
    const original = buildInteractiveBudgetPlan(1_500_000, 120);
    const décorBefore = original.allocations.find((item) => item.name === 'Décor, Tents, Chairs, Tables')?.amount;
    const updated = updateInteractiveBudgetAllocation(original, 'Caterer', 600_000);

    expect(updated.allocations.find((item) => item.name === 'Caterer')?.amount).toBe(600_000);
    expect(updated.allocations.find((item) => item.name === 'Décor, Tents, Chairs, Tables')?.amount).toBe(décorBefore);
    expect(updated.allocations.reduce((sum, item) => sum + item.amount, 0)).toBeGreaterThan(1_500_000);
  });

  it('supports independent category edits and semantic utilization states', () => {
    const original = buildInteractiveBudgetPlan(1_500_000, 120);
    const overBudget = updateInteractiveBudgetAllocation(original, 'Caterer', 700_000);
    const utilization = getBudgetUtilizationPercentage(overBudget);

    expect(overBudget.allocations.find((item) => item.name === 'Caterer')?.amount).toBe(700_000);
    expect(utilization).toBeGreaterThan(100);
    expect(getBudgetUtilizationStatus(utilization)).toBe('over');
    expect(getBudgetUtilizationStatus(100)).toBe('complete');
    expect(getBudgetUtilizationStatus(70)).toBe('under');
  });

  it('keeps amount and percentage linked without changing other categories', () => {
    const original = buildInteractiveBudgetPlan(1_500_000, 120);
    const cateringBefore = original.allocations.find((item) => item.name === 'Caterer')!;
    const honeymoonBefore = original.allocations.find((item) => item.name === 'Honeymoon')!;
    const updated = updateInteractiveBudgetPercentage(original, 'Honeymoon', 5);
    const honeymoon = updated.allocations.find((item) => item.name === 'Honeymoon')!;

    expect(honeymoon.amount).toBe(75_000);
    expect(honeymoon.percentage).toBe(5);
    expect(honeymoon.isManuallyEdited).toBe(true);
    expect(honeymoon.lastEditedField).toBe('percentage');
    expect(updated.allocations.find((item) => item.name === 'Caterer')?.amount).toBe(cateringBefore.amount);
    expect(honeymoonBefore.amount).not.toBe(honeymoon.amount);
  });

  it('resets one or every edited allocation to the suggestion', () => {
    const original = buildInteractiveBudgetPlan(1_500_000, 120);
    const editedOnce = updateInteractiveBudgetAllocation(original, 'Honeymoon', 90_000);
    const editedTwice = updateInteractiveBudgetPercentage(editedOnce, 'Caterer', 30);
    const oneReset = resetInteractiveBudgetAllocation(editedTwice, 'Honeymoon');
    const allReset = resetAllInteractiveBudgetAllocations(editedTwice);

    expect(oneReset.allocations.find((item) => item.name === 'Honeymoon')?.amount)
      .toBe(original.allocations.find((item) => item.name === 'Honeymoon')?.amount);
    expect(oneReset.allocations.find((item) => item.name === 'Caterer')?.isManuallyEdited).toBe(true);
    expect(allReset.allocations.every((item) => item.isManuallyEdited === false)).toBe(true);
  });

  it('changes the total using either the same split or the same amounts', () => {
    const original = updateInteractiveBudgetPercentage(buildInteractiveBudgetPlan(1_500_000, 120), 'Honeymoon', 5);
    const scaled = updateInteractiveBudgetSettings(original, 2_000_000, 120, 'scale_percentages');
    const fixed = updateInteractiveBudgetSettings(original, 2_000_000, 120, 'keep_amounts');

    expect(scaled.allocations.find((item) => item.name === 'Honeymoon')?.amount).toBe(100_000);
    expect(fixed.allocations.find((item) => item.name === 'Honeymoon')?.amount).toBe(75_000);
    expect(fixed.allocations.find((item) => item.name === 'Honeymoon')?.percentage).toBe(3.75);
  });

  it('removes unwanted categories and preserves remaining amounts when settings change', () => {
    const original = buildInteractiveBudgetPlan(1_500_000, 120);
    const withoutCake = removeInteractiveBudgetCategory(original, 'Cake Artist & Baker');
    const adjusted = updateInteractiveBudgetSettings(withoutCake, 2_000_000, 180);

    expect(withoutCake.allocations).toHaveLength(21);
    expect(withoutCake.allocations.some((item) => item.name === 'Cake Artist & Baker')).toBe(false);
    expect(adjusted.totalBudget).toBe(2_000_000);
    expect(adjusted.guestCount).toBe(180);
    expect(adjusted.allocations.find((item) => item.name === 'Caterer')?.amount)
      .toBe(original.allocations.find((item) => item.name === 'Caterer')?.amount);
  });

  it('supports zero, decimal percentages, large budgets, and guest changes after a manual edit', () => {
    const original = buildInteractiveBudgetPlan(250_000_000, 500);
    const zeroed = updateInteractiveBudgetAllocation(original, 'Cake Artist & Baker', 0);
    const decimal = updateInteractiveBudgetPercentage(zeroed, 'Honeymoon', 2.5);
    const withNewGuestCount = updateInteractiveBudgetSettings(decimal, decimal.totalBudget, 650, 'keep_amounts');

    expect(zeroed.allocations.find((item) => item.name === 'Cake Artist & Baker')?.percentage).toBe(0);
    expect(decimal.allocations.find((item) => item.name === 'Honeymoon')?.amount).toBe(6_250_000);
    expect(withNewGuestCount.allocations.find((item) => item.name === 'Honeymoon')?.amount).toBe(6_250_000);
    expect(withNewGuestCount.allocations.find((item) => item.name === 'Honeymoon')?.isManuallyEdited).toBe(true);
  });
});
