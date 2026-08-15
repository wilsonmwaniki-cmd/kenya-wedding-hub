import { describe, expect, it } from 'vitest';
import { resolveRecentWorkspaceChangeActionPath } from '@/lib/recentWorkspaceChanges';

describe('recent workspace change destinations', () => {
  it('routes pending planner changes to the approval section', () => {
    expect(resolveRecentWorkspaceChangeActionPath(
      'planner_change_request.pending',
      '/dashboard',
    )).toBe('/dashboard#planner-change-requests');
  });

  it('preserves destinations for other workspace activity', () => {
    expect(resolveRecentWorkspaceChangeActionPath(
      'commercial_document.responded',
      '/documents',
    )).toBe('/documents');
  });
});
