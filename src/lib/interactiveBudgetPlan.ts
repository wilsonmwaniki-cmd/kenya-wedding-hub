import { weddingBudgetTemplates } from '@/lib/weddingBudgetTemplates';

export interface InteractiveBudgetAllocation {
  name: string;
  amount: number;
  percentage: number;
  guestSensitive: boolean;
}

export interface InteractiveBudgetPlan {
  totalBudget: number;
  guestCount: number;
  allocations: InteractiveBudgetAllocation[];
}

export type BudgetUtilizationStatus = 'safe' | 'warning' | 'over';

type AllocationRule = {
  name: string;
  weight: number;
  guestSensitive?: boolean;
};

const BASELINE_GUEST_COUNT = 120;

const allocationRules: AllocationRule[] = [
  { name: 'Venue', weight: 0 },
  { name: 'Ceremony Venue', weight: 4 },
  { name: 'Reception Venue', weight: 9, guestSensitive: true },
  { name: 'Officiant / Church Fees', weight: 2 },
  { name: 'Marriage License / Legal Fees', weight: 1 },
  { name: 'Catering', weight: 24, guestSensitive: true },
  { name: 'Cake', weight: 3, guestSensitive: true },
  { name: 'Décor', weight: 10, guestSensitive: true },
  { name: 'Flowers', weight: 4, guestSensitive: true },
  { name: 'Setup & Rentals', weight: 8, guestSensitive: true },
  { name: 'Photography', weight: 6 },
  { name: 'Videography', weight: 4 },
  { name: 'MC', weight: 2 },
  { name: 'Music / DJ / Band', weight: 4 },
  { name: 'Stationery', weight: 2, guestSensitive: true },
  { name: 'Transport', weight: 3 },
  { name: 'Bridal Party', weight: 3 },
  { name: 'Guest Experience', weight: 3, guestSensitive: true },
  { name: 'Accommodation', weight: 2, guestSensitive: true },
  { name: 'Security', weight: 1, guestSensitive: true },
  { name: 'Miscellaneous', weight: 5 },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeMoney(value: number) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

function percentage(amount: number, totalBudget: number) {
  if (totalBudget <= 0) return 0;
  return Number(((amount / totalBudget) * 100).toFixed(2));
}

function distributeExactTotal(rawAmounts: number[], totalBudget: number) {
  const amounts = rawAmounts.map(normalizeMoney);
  const currentTotal = amounts.reduce((sum, amount) => sum + amount, 0);
  const adjustmentIndex = allocationRules.findIndex((rule) => rule.name === 'Miscellaneous');
  amounts[adjustmentIndex] = Math.max(0, amounts[adjustmentIndex] + (totalBudget - currentTotal));

  const correctedTotal = amounts.reduce((sum, amount) => sum + amount, 0);
  if (correctedTotal !== totalBudget) {
    const largestIndex = amounts.reduce(
      (largest, amount, index) => amount > amounts[largest] ? index : largest,
      0,
    );
    amounts[largestIndex] += totalBudget - correctedTotal;
  }

  return amounts;
}

export function buildInteractiveBudgetPlan(totalBudgetInput: number, guestCountInput: number): InteractiveBudgetPlan {
  const totalBudget = normalizeMoney(totalBudgetInput);
  const guestCount = Math.max(1, Math.round(guestCountInput));
  const guestFactor = clamp(guestCount / BASELINE_GUEST_COUNT, 0.75, 1.35);
  const adjustedWeights = allocationRules.map((rule) => rule.weight * (rule.guestSensitive ? guestFactor : 1));
  const totalWeight = adjustedWeights.reduce((sum, weight) => sum + weight, 0);
  const amounts = distributeExactTotal(
    adjustedWeights.map((weight) => totalWeight > 0 ? (weight / totalWeight) * totalBudget : 0),
    totalBudget,
  );

  return {
    totalBudget,
    guestCount,
    allocations: allocationRules.map((rule, index) => ({
      name: rule.name,
      amount: amounts[index],
      percentage: percentage(amounts[index], totalBudget),
      guestSensitive: Boolean(rule.guestSensitive),
    })),
  };
}

export function rebalanceInteractiveBudgetPlan(
  plan: InteractiveBudgetPlan,
  editedCategory: string,
  nextAmountInput: number,
): InteractiveBudgetPlan {
  const nextAmount = Math.min(normalizeMoney(nextAmountInput), plan.totalBudget);
  const editedIndex = plan.allocations.findIndex((allocation) => allocation.name === editedCategory);
  if (editedIndex < 0) return plan;

  const remainingBudget = plan.totalBudget - nextAmount;
  const otherTotal = plan.allocations.reduce(
    (sum, allocation, index) => index === editedIndex ? sum : sum + allocation.amount,
    0,
  );
  const rawAmounts = plan.allocations.map((allocation, index) => {
    if (index === editedIndex) return nextAmount;
    if (otherTotal <= 0) return 0;
    return (allocation.amount / otherTotal) * remainingBudget;
  });
  const amounts = distributeExactTotal(rawAmounts, plan.totalBudget);

  return {
    ...plan,
    allocations: plan.allocations.map((allocation, index) => ({
      ...allocation,
      amount: amounts[index],
      percentage: percentage(amounts[index], plan.totalBudget),
    })),
  };
}

export function updateInteractiveBudgetAllocation(
  plan: InteractiveBudgetPlan,
  category: string,
  nextAmountInput: number,
): InteractiveBudgetPlan {
  const nextAmount = normalizeMoney(nextAmountInput);

  return {
    ...plan,
    allocations: plan.allocations.map((allocation) => (
      allocation.name === category
        ? {
            ...allocation,
            amount: nextAmount,
            percentage: percentage(nextAmount, plan.totalBudget),
          }
        : allocation
    )),
  };
}

export function removeInteractiveBudgetCategory(
  plan: InteractiveBudgetPlan,
  category: string,
): InteractiveBudgetPlan {
  if (plan.allocations.length <= 1) return plan;

  return {
    ...plan,
    allocations: plan.allocations.filter((allocation) => allocation.name !== category),
  };
}

export function updateInteractiveBudgetSettings(
  plan: InteractiveBudgetPlan,
  totalBudgetInput: number,
  guestCountInput: number,
): InteractiveBudgetPlan {
  const totalBudget = Math.max(1, normalizeMoney(totalBudgetInput));
  const guestCount = Math.max(1, Math.round(guestCountInput));

  return {
    ...plan,
    totalBudget,
    guestCount,
    allocations: plan.allocations.map((allocation) => ({
      ...allocation,
      percentage: percentage(allocation.amount, totalBudget),
    })),
  };
}

export function getBudgetUtilizationPercentage(plan: InteractiveBudgetPlan) {
  const allocated = plan.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  return plan.totalBudget > 0 ? (allocated / plan.totalBudget) * 100 : 0;
}

export function getBudgetUtilizationStatus(utilizationPercentage: number): BudgetUtilizationStatus {
  if (utilizationPercentage > 100) return 'over';
  if (utilizationPercentage >= 85) return 'warning';
  return 'safe';
}

export function getGuestExperienceCost(plan: InteractiveBudgetPlan) {
  return plan.allocations
    .filter((allocation) => allocation.guestSensitive)
    .reduce((sum, allocation) => sum + allocation.amount, 0);
}

export function validateInteractiveBudgetCategories() {
  const templateNames = weddingBudgetTemplates.map((template) => template.name);
  return templateNames.length === allocationRules.length
    && templateNames.every((name, index) => name === allocationRules[index].name);
}
