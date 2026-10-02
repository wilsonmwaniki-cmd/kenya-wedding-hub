import { describe, expect, it } from 'vitest';
import {
  hideChangesAlreadyNeedingAttention,
  resolveRecentWorkspaceChangeActionPath,
  type RecentWorkspaceChange,
} from '@/lib/recentWorkspaceChanges';

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

  it('preserves an exact returned-document destination', () => {
    expect(resolveRecentWorkspaceChangeActionPath(
      'document_request.responded',
      '/documents/share/returned-quote-token',
      'request-id',
    )).toBe('/documents/share/returned-quote-token');
  });

  it('opens the exact vendor payment plan', () => {
    expect(resolveRecentWorkspaceChangeActionPath(
      'vendor.payment_due_scheduled',
      '/vendors',
      'vendor-id',
    )).toBe('/vendors?vendor=vendor-id&tab=payments&focus=payment-plan#vendor-payment-plan-vendor-id');
  });
});

describe('recent workspace change attention overlap', () => {
  const contractChange: RecentWorkspaceChange = {
    id: 'event-1',
    occurredAt: '2026-08-31T08:00:00Z',
    eventType: 'professional_contract.countersigned',
    subjectType: 'professional_contract',
    subjectId: 'contract-1',
    title: 'Contract countersigned',
    summary: 'Wedding photography agreement',
    actionLabel: null,
    actionPath: '/vendor-documents/contracts',
    metadata: {},
  };

  it('does not repeat a change while the same document needs attention', () => {
    expect(hideChangesAlreadyNeedingAttention(
      [contractChange],
      [{ sourceType: 'professional_contract', sourceId: 'contract-1' }],
    )).toEqual([]);
  });

  it('keeps the change in history after the attention item is cleared', () => {
    expect(hideChangesAlreadyNeedingAttention([contractChange], [])).toEqual([contractChange]);
  });
});
