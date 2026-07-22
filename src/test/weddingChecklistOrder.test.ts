import { describe, expect, it } from 'vitest';
import {
  compareTasksByWeddingChecklistOrder,
  getNextWeddingChecklistTask,
  getWeddingChecklistStep,
} from '@/lib/weddingTaskTemplates';

describe('wedding checklist guidance order', () => {
  it('preserves the spreadsheet row order inside the same timeline', () => {
    const tasks = [
      { title: 'Decide on a wedding date', due_date: '2026-02-02' },
      { title: 'Research wedding rings', due_date: '2026-02-02' },
      { title: 'Lock in selected marriage preparation therapy / classes with deposit | Plan to attend', due_date: '2026-02-02' },
    ];

    expect(tasks.sort(compareTasksByWeddingChecklistOrder).map((task) => task.title)).toEqual([
      'Lock in selected marriage preparation therapy / classes with deposit | Plan to attend',
      'Research wedding rings',
      'Decide on a wedding date',
    ]);
  });

  it('exposes timeline and progress metadata for Wedding Home', () => {
    const step = getWeddingChecklistStep({ title: 'Research marriage preparation therapy / classes.' });

    expect(step).toMatchObject({
      timelineLabel: '18 Months',
      step: 1,
    });
    expect(step?.totalSteps).toBeGreaterThan(100);
  });

  it('places custom tasks after guided checklist tasks', () => {
    const tasks = [
      { title: 'Call Mum', due_date: '2025-01-01' },
      { title: 'Research wedding venues', due_date: '2026-03-02' },
    ];

    expect(tasks.sort(compareTasksByWeddingChecklistOrder)[0]?.title).toBe('Research wedding venues');
  });

  it('advances to the next spreadsheet row when a step is completed', () => {
    const recommendation = getNextWeddingChecklistTask([
      { title: 'Research marriage preparation therapy / classes.', completed: true },
      { title: 'Lock in selected marriage preparation therapy / classes with deposit | Plan to attend', completed: false },
      { title: 'Call Mum', completed: false },
    ]);

    expect(recommendation?.task.title).toBe('Lock in selected marriage preparation therapy / classes with deposit | Plan to attend');
    expect(recommendation?.step.step).toBe(2);
  });
});
