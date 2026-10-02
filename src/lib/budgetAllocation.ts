export type BudgetAllocationLine = {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  budget_scope: 'wedding' | 'personal';
};

export function summarizeWeddingBudget(
  categories: BudgetAllocationLine[],
  weddingBudgetGoal: number,
) {
  const weddingCategories = categories.filter((category) => category.budget_scope === 'wedding');
  const allocated = weddingCategories.reduce((total, category) => total + category.allocated, 0);
  const spent = weddingCategories.reduce((total, category) => total + category.spent, 0);
  const remaining = weddingBudgetGoal - allocated;
  const overage = Math.max(0, -remaining);

  return {
    weddingCategories,
    allocated,
    spent,
    remaining,
    overage,
    reductionCandidates: weddingCategories
      .map((category) => ({
        ...category,
        reducibleAmount: Math.max(0, category.allocated - category.spent),
      }))
      .filter((category) => category.reducibleAmount > 0)
      .sort((left, right) => right.reducibleAmount - left.reducibleAmount),
    overspentCategories: weddingCategories
      .filter((category) => category.allocated > 0 && category.spent > category.allocated)
      .map((category) => ({ ...category, reducibleAmount: Math.max(0, category.allocated - category.spent) }))
      .sort((left, right) => (right.spent - right.allocated) - (left.spent - left.allocated)),
  };
}
