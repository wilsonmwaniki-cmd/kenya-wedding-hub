import { describe, expect, it } from 'vitest';
import { getNextWeddingChecklistStep, getWeddingTaskTemplates } from '@/lib/weddingTaskTemplates';

const role = 'couple';

describe('wedding checklist guidance', () => {
  it('preserves the spreadsheet row order within each timeline stage', () => {
    const templates = getWeddingTaskTemplates({ vendorCategories: [], role });

    expect(templates.slice(0, 3).map((template) => template.title)).toEqual([
      'Research marriage preparation therapy / classes.',
      'Lock in selected marriage preparation therapy / classes with deposit | Plan to attend',
      'Research wedding rings',
    ]);
    expect(templates.slice(0, 3).map((template) => template.timelineLabel)).toEqual([
      '18 Months',
      '14 Months',
      '14 Months',
    ]);
  });

  it('starts a new couple at the first checklist step', () => {
    const nextStep = getNextWeddingChecklistStep({ tasks: [], role });

    expect(nextStep?.template.title).toBe('Research marriage preparation therapy / classes.');
    expect(nextStep?.stepNumber).toBe(1);
    expect(nextStep?.completedSteps).toBe(0);
    expect(nextStep?.task).toBeNull();
  });

  it('advances only after the current chronological step is completed', () => {
    const templates = getWeddingTaskTemplates({ vendorCategories: [], role });
    const firstTask = {
      id: 'task-1',
      title: templates[0].title,
      category: templates[0].category,
      completed: false,
    };

    expect(getNextWeddingChecklistStep({ tasks: [firstTask], role })?.task?.id).toBe('task-1');

    const nextStep = getNextWeddingChecklistStep({
      tasks: [{ ...firstTask, completed: true }],
      role,
    });

    expect(nextStep?.template.title).toBe(templates[1].title);
    expect(nextStep?.stepNumber).toBe(2);
    expect(nextStep?.completedSteps).toBe(1);
  });

  it('returns no next step once the guided checklist is complete', () => {
    const templates = getWeddingTaskTemplates({ vendorCategories: [], role });
    const completedTasks = templates.map((template, index) => ({
      id: `task-${index}`,
      title: template.title,
      category: template.category,
      completed: true,
    }));

    expect(getNextWeddingChecklistStep({ tasks: completedTasks, role })).toBeNull();
  });
});
