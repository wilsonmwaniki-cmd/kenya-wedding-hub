import { describe, expect, it } from 'vitest';
import { buildNextActions, buildPlanningRecommendations, type PlanningInput } from '@/lib/planningExperiment';

const baseInput: PlanningInput = {
  weddingDate: '2027-08-14',
  estimatedBudget: 1_500_000,
  estimatedGuestCount: 150,
  weddingType: 'church',
  priorities: ['Food', 'Photos', 'Family'],
  bookedCategories: [],
};

describe('planning experiment recommendations', () => {
  it('builds an exact ten-category starting budget that matches the estimate', () => {
    const result = buildPlanningRecommendations(baseInput);

    expect(result.budgetRows).toHaveLength(10);
    expect(result.budgetRows.reduce((total, row) => total + row.allocated, 0)).toBe(1_500_000);
    expect(result.budgetRows.every((row) => row.allocated >= 0)).toBe(true);
  });

  it('creates no more than ten tasks and removes tasks for booked categories', () => {
    const result = buildPlanningRecommendations({
      ...baseInput,
      bookedCategories: ['Venue', 'Catering', 'Photography'],
    });

    expect(result.tasks.length).toBeLessThanOrEqual(10);
    expect(result.tasks.some((task) => ['Venue', 'Catering', 'Photography'].includes(task.category))).toBe(false);
    expect(result.tasks.every((task) => task.priorityLevel >= 1 && task.priorityLevel <= 4)).toBe(true);
  });

  it('moves the next action forward when the primary task is completed', () => {
    const result = buildPlanningRecommendations(baseInput);
    const first = result.tasks[0];
    const next = buildNextActions(
      result.tasks.map((task) => task.key === first.key ? { ...task, completed: true } : task),
      [],
    );

    expect(next.primaryNextAction.taskKey).not.toBe(first.key);
    expect(next.secondaryActions.length).toBeLessThanOrEqual(3);
  });

  it('changes allocations when guest count and priorities change', () => {
    const smaller = buildPlanningRecommendations(baseInput);
    const larger = buildPlanningRecommendations({
      ...baseInput,
      estimatedGuestCount: 300,
      priorities: ['Style', 'Music', 'Photos'],
    });
    const catering = (rows: typeof smaller.budgetRows) => rows.find((row) => row.name === 'Catering')?.allocated;

    expect(catering(larger.budgetRows)).not.toBe(catering(smaller.budgetRows));
  });
});
