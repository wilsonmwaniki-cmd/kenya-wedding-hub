import { describe, expect, it } from 'vitest';
import { recalibrateBudgetAllocations } from '@/lib/budgetRecalibration';

describe('budget allocation recalibration', () => {
  it('proportionally reduces planned amounts to the new budget', () => {
    const result = recalibrateBudgetAllocations([
      { id: 'catering', allocated: 600_000, spent: 0 },
      { id: 'venue', allocated: 400_000, spent: 0 },
    ], 500_000);

    expect(result.allocations.map((category) => category.nextAllocated)).toEqual([300_000, 200_000]);
    expect(result.allocations.reduce((sum, category) => sum + category.nextAllocated, 0)).toBe(500_000);
    expect(result.fitsTarget).toBe(true);
  });

  it('protects recorded payments before resizing the remaining plan', () => {
    const result = recalibrateBudgetAllocations([
      { id: 'cake', allocated: 100_000, spent: 80_000 },
      { id: 'decor', allocated: 300_000, spent: 20_000 },
    ], 200_000);

    expect(result.allocations.find((category) => category.id === 'cake')?.nextAllocated).toBeGreaterThanOrEqual(80_000);
    expect(result.allocations.find((category) => category.id === 'decor')?.nextAllocated).toBeGreaterThanOrEqual(20_000);
    expect(result.allocations.reduce((sum, category) => sum + category.nextAllocated, 0)).toBe(200_000);
  });

  it('proportionally expands planned amounts to fill a larger budget', () => {
    const result = recalibrateBudgetAllocations([
      { id: 'catering', allocated: 300_000, spent: 50_000 },
    ], 500_000);

    expect(result.allocations[0].nextAllocated).toBe(500_000);
    expect(result.fitsTarget).toBe(true);
  });

  it('reports when recorded payments alone exceed the new budget', () => {
    const result = recalibrateBudgetAllocations([
      { id: 'venue', allocated: 500_000, spent: 450_000 },
      { id: 'cake', allocated: 100_000, spent: 75_000 },
    ], 400_000);

    expect(result.protectedSpend).toBe(525_000);
    expect(result.allocations.reduce((sum, category) => sum + category.nextAllocated, 0)).toBe(525_000);
    expect(result.fitsTarget).toBe(false);
  });
});
