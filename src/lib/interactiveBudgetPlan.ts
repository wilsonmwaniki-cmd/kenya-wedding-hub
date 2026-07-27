import { weddingBudgetTemplates } from '@/lib/weddingBudgetTemplates';
import { canonicalizeVendorCategory } from '@/lib/vendorCategories';

export interface InteractiveBudgetAllocation {
  name: string;
  amount: number;
  percentage: number;
  suggestedAmount: number;
  suggestedPercentage: number;
  guestSensitive: boolean;
  isManuallyEdited: boolean;
  lastEditedField: 'amount' | 'percentage' | null;
}

export interface InteractiveBudgetPlan {
  totalBudget: number;
  guestCount: number;
  allocations: InteractiveBudgetAllocation[];
}

export type PersistedInteractiveBudgetAllocation = Pick<InteractiveBudgetAllocation, 'name' | 'amount' | 'percentage'>
  & Partial<Pick<InteractiveBudgetAllocation, 'suggestedAmount' | 'suggestedPercentage' | 'isManuallyEdited' | 'lastEditedField'>>;

export type BudgetUtilizationStatus = 'under' | 'complete' | 'over';
export type BudgetResizeStrategy = 'scale_percentages' | 'keep_amounts';

type AllocationRule = {
  name: string;
  weight: number;
  guestSensitive?: boolean;
};

const BASELINE_GUEST_COUNT = 120;
const CORE_PER_GUEST_CATEGORIES = new Set([
  'Caterer',
  'Cake Artist & Baker',
  'Décor, Tents, Chairs, Tables',
]);

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

export function calculatePercentage(amount: number, totalBudget: number) {
  if (totalBudget <= 0) return 0;
  return (amount / totalBudget) * 100;
}

export function calculatePlannedAmount(percentage: number, totalBudget: number) {
  if (totalBudget <= 0) return 0;
  return (percentage / 100) * totalBudget;
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
    allocations: allocationRules.map((rule, index) => {
      const suggestedPercentage = calculatePercentage(amounts[index], totalBudget);
      return {
        name: rule.name,
        amount: amounts[index],
        percentage: suggestedPercentage,
        suggestedAmount: amounts[index],
        suggestedPercentage,
        guestSensitive: Boolean(rule.guestSensitive),
        isManuallyEdited: false,
        lastEditedField: null,
      };
    }),
  };
}

export function restoreInteractiveBudgetPlan(
  totalBudgetInput: number,
  guestCountInput: number,
  persistedAllocations: PersistedInteractiveBudgetAllocation[],
): InteractiveBudgetPlan {
  const suggestedPlan = buildInteractiveBudgetPlan(totalBudgetInput, guestCountInput);
  const persistedByName = new Map(persistedAllocations.map((allocation) => [allocation.name, allocation]));

  return {
    ...suggestedPlan,
    allocations: suggestedPlan.allocations
      .filter((allocation) => persistedByName.has(allocation.name))
      .map((allocation) => {
        const persisted = persistedByName.get(allocation.name)!;
        const amount = normalizeMoney(persisted.amount);
        return {
          ...allocation,
          amount,
          percentage: calculatePercentage(amount, suggestedPlan.totalBudget),
          suggestedAmount: persisted.suggestedAmount ?? allocation.suggestedAmount,
          suggestedPercentage: persisted.suggestedPercentage ?? allocation.suggestedPercentage,
          isManuallyEdited: persisted.isManuallyEdited ?? amount !== allocation.suggestedAmount,
          lastEditedField: persisted.lastEditedField ?? null,
        };
      }),
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
            percentage: calculatePercentage(nextAmount, plan.totalBudget),
            isManuallyEdited: true,
            lastEditedField: 'amount',
          }
        : allocation
    )),
  };
}

export function updateInteractiveBudgetPercentage(
  plan: InteractiveBudgetPlan,
  category: string,
  nextPercentageInput: number,
): InteractiveBudgetPlan {
  const nextPercentage = Math.max(0, Number.isFinite(nextPercentageInput) ? nextPercentageInput : 0);
  const nextAmount = normalizeMoney(calculatePlannedAmount(nextPercentage, plan.totalBudget));

  return {
    ...plan,
    allocations: plan.allocations.map((allocation) => (
      allocation.name === category
        ? {
            ...allocation,
            amount: nextAmount,
            percentage: calculatePercentage(nextAmount, plan.totalBudget),
            isManuallyEdited: true,
            lastEditedField: 'percentage',
          }
        : allocation
    )),
  };
}

export function resetInteractiveBudgetAllocation(
  plan: InteractiveBudgetPlan,
  category: string,
): InteractiveBudgetPlan {
  return {
    ...plan,
    allocations: plan.allocations.map((allocation) => {
      if (allocation.name !== category) return allocation;
      const amount = normalizeMoney(calculatePlannedAmount(allocation.suggestedPercentage, plan.totalBudget));
      return {
        ...allocation,
        amount,
        percentage: calculatePercentage(amount, plan.totalBudget),
        isManuallyEdited: false,
        lastEditedField: null,
      };
    }),
  };
}

export function resetAllInteractiveBudgetAllocations(plan: InteractiveBudgetPlan): InteractiveBudgetPlan {
  return {
    ...plan,
    allocations: plan.allocations.map((allocation) => {
      const amount = normalizeMoney(calculatePlannedAmount(allocation.suggestedPercentage, plan.totalBudget));
      return {
        ...allocation,
        amount,
        percentage: calculatePercentage(amount, plan.totalBudget),
        isManuallyEdited: false,
        lastEditedField: null,
      };
    }),
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
  strategy: BudgetResizeStrategy = 'keep_amounts',
): InteractiveBudgetPlan {
  const totalBudget = Math.max(1, normalizeMoney(totalBudgetInput));
  const guestCount = Math.max(1, Math.round(guestCountInput));

  return {
    ...plan,
    totalBudget,
    guestCount,
    allocations: plan.allocations.map((allocation) => {
      const amount = strategy === 'scale_percentages'
        ? normalizeMoney(calculatePlannedAmount(allocation.percentage, totalBudget))
        : allocation.amount;
      return {
        ...allocation,
        amount,
        percentage: calculatePercentage(amount, totalBudget),
      };
    }),
  };
}

export function getBudgetUtilizationPercentage(plan: InteractiveBudgetPlan) {
  const allocated = plan.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  return plan.totalBudget > 0 ? (allocated / plan.totalBudget) * 100 : 0;
}

export function getBudgetUtilizationStatus(utilizationPercentage: number): BudgetUtilizationStatus {
  if (utilizationPercentage > 100) return 'over';
  if (Math.abs(utilizationPercentage - 100) < 0.01) return 'complete';
  return 'under';
}

export function getCoreGuestCost(plan: InteractiveBudgetPlan) {
  return plan.allocations
    .filter((allocation) => CORE_PER_GUEST_CATEGORIES.has(canonicalizeVendorCategory(allocation.name)))
    .reduce((sum, allocation) => sum + allocation.amount, 0);
}

export function validateInteractiveBudgetCategories() {
  const templateNames = weddingBudgetTemplates.map((template) => template.name);
  return templateNames.length === allocationRules.length
    && templateNames.every((name, index) => name === allocationRules[index].name);
}
