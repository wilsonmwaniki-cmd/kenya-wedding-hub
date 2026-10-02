import { describe, expect, it } from 'vitest';
import {
  describePlannerChangeDetails,
  describePlannerChangeRequest,
  type PlannerChangeRequestRow,
} from '@/lib/plannerChangeRequests';

function taskRequest(overrides: Partial<PlannerChangeRequestRow> = {}): PlannerChangeRequestRow {
  return {
    id: 'request-1',
    client_id: 'client-1',
    couple_user_id: 'couple-1',
    planner_user_id: 'planner-1',
    target_table: 'tasks',
    change_type: 'update',
    target_id: 'task-1',
    target_label: 'Apply for your wedding permit',
    current_payload: { completed: false },
    proposed_payload: { completed: true },
    note: null,
    status: 'pending',
    reviewed_at: null,
    reviewed_by: null,
    created_at: '2026-08-05T10:53:44.569Z',
    updated_at: '2026-08-05T10:53:44.569Z',
    ...overrides,
  };
}

describe('planner change descriptions', () => {
  it('uses the real task name instead of its database id', () => {
    expect(describePlannerChangeRequest(taskRequest())).toBe(
      'Update task: Apply for your wedding permit',
    );
  });

  it('explains a completion request in plain language', () => {
    expect(describePlannerChangeDetails(taskRequest())).toBe('Mark this task as done.');
  });
});
