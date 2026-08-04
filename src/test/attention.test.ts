import { describe, expect, it } from 'vitest';
import { priorityForDueDate } from '@/lib/attention';

describe('priorityForDueDate', () => {
  const now = new Date('2026-08-04T09:00:00Z');

  it('promotes overdue reminders to urgent', () => {
    expect(priorityForDueDate('info', '2026-08-03T06:00:00Z', now)).toBe('urgent');
  });

  it('promotes reminders due within fourteen days to action', () => {
    expect(priorityForDueDate('info', '2026-08-15T06:00:00Z', now)).toBe('action');
  });

  it('leaves later reminders quiet until they approach', () => {
    expect(priorityForDueDate('info', '2026-09-04T06:00:00Z', now)).toBe('info');
  });
});
