import { describe, expect, it } from 'vitest';
import { resolveRecentWorkspaceChangeActionPath } from '@/lib/recentWorkspaceChanges';

describe('recent workspace change destinations', () => {
  it('routes pending planner changes to the exact review', () => {
    expect(resolveRecentWorkspaceChangeActionPath(
      'planner_change_request.pending',
      '/dashboard',
      '664317fe-7b3a-4fa4-8b27-fff27b7e0216',
    )).toBe('/dashboard#planner-change-664317fe-7b3a-4fa4-8b27-fff27b7e0216');
  });

  it('falls back to the review section when an event has no subject', () => {
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
