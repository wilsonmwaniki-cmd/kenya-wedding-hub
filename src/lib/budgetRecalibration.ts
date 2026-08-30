export interface BudgetAllocationInput {
  id: string;
  allocated: number;
  spent: number;
}

export interface RecalibratedBudgetAllocation extends BudgetAllocationInput {
  nextAllocated: number;
}

export interface BudgetRecalibrationResult {
  allocations: RecalibratedBudgetAllocation[];
  protectedSpend: number;
  fitsTarget: boolean;
}

export function recalibrateBudgetAllocations(
  categories: BudgetAllocationInput[],
  targetBudgetInput: number,
): BudgetRecalibrationResult {
  const targetBudget = Math.max(0, Math.round(targetBudgetInput));
  const normalized = categories.map((category) => ({
    ...category,
    allocated: Math.max(0, Math.round(category.allocated)),
    spent: Math.max(0, Math.round(category.spent)),
  }));
  const protectedSpend = normalized.reduce((sum, category) => sum + category.spent, 0);
  const totalAllocated = normalized.reduce((sum, category) => sum + category.allocated, 0);

  if (totalAllocated === targetBudget) {
    return {
      allocations: normalized.map((category) => ({ ...category, nextAllocated: category.allocated })),
      protectedSpend,
      fitsTarget: true,
    };
  }

  if (protectedSpend >= targetBudget) {
    return {
      allocations: normalized.map((category) => ({ ...category, nextAllocated: category.spent })),
      protectedSpend,
      fitsTarget: protectedSpend === targetBudget,
    };
  }

  const flexibleTotal = normalized.reduce(
    (sum, category) => sum + Math.max(category.allocated - category.spent, 0),
    0,
  );
  const flexibleTarget = targetBudget - protectedSpend;

  if (flexibleTotal <= 0) {
    return {
      allocations: normalized.map((category) => ({ ...category, nextAllocated: category.spent })),
      protectedSpend,
      fitsTarget: protectedSpend === targetBudget,
    };
  }

  const provisional = normalized.map((category) => {
    const flexibleAmount = Math.max(category.allocated - category.spent, 0);
    const exactAllocated = category.spent + (flexibleAmount / flexibleTotal) * flexibleTarget;
    const nextAllocated = Math.floor(exactAllocated);
    return {
      ...category,
      nextAllocated,
      fractionalRemainder: exactAllocated - nextAllocated,
    };
  });
  let remainder = targetBudget - provisional.reduce((sum, category) => sum + category.nextAllocated, 0);
  const remainderOrder = [...provisional].sort(
    (left, right) => right.fractionalRemainder - left.fractionalRemainder,
  );

  for (let index = 0; index < remainderOrder.length && remainder > 0; index += 1) {
    remainderOrder[index].nextAllocated += 1;
    remainder -= 1;
  }

  return {
    allocations: provisional.map((category) => ({
      id: category.id,
      allocated: category.allocated,
      spent: category.spent,
      nextAllocated: category.nextAllocated,
    })),
    protectedSpend,
    fitsTarget: remainder === 0,
  };
}
