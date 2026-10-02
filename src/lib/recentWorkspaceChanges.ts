/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/integrations/supabase/client';
import { retryTransientRequest } from '@/lib/requestRetry';

export interface RecentWorkspaceChange {
  id: string;
  occurredAt: string;
  eventType: string;
  subjectType: string;
  subjectId: string | null;
  title: string;
  summary: string | null;
  actionLabel: string | null;
  actionPath: string | null;
  metadata: Record<string, unknown>;
}

export function hideChangesAlreadyNeedingAttention(
  changes: RecentWorkspaceChange[],
  attentionItems: Array<{ sourceType: string; sourceId: string | null }>,
) {
  const activeSources = new Set(
    attentionItems
      .filter((item) => item.sourceId)
      .map((item) => `${item.sourceType}:${item.sourceId}`),
  );

  return changes.filter(
    (change) => !change.subjectId || !activeSources.has(`${change.subjectType}:${change.subjectId}`),
  );
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function resolveRecentWorkspaceChangeActionPath(
  eventType: string,
  actionPath: string | null,
  subjectId?: string | null,
) {
  if (eventType === 'planner_change_request.pending') {
    return subjectId
      ? `/dashboard#planner-change-${subjectId}`
      : '/dashboard#planner-change-requests';
  }

  if (eventType === 'vendor.payment_due_scheduled' && subjectId) {
    return `/vendors?vendor=${subjectId}&tab=payments&focus=payment-plan#vendor-payment-plan-${subjectId}`;
  }

  return actionPath;
}

export async function listRecentWorkspaceChanges(limit = 5): Promise<RecentWorkspaceChange[]> {
  const { data, error } = await retryTransientRequest(() => (supabase.rpc as any)('list_my_recent_workspace_events', {
    limit_input: limit,
  }));

  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const eventType = String(row.event_type);
    const subjectId = nullableString(row.subject_id);

    return {
      id: String(row.id),
      occurredAt: String(row.occurred_at),
      eventType,
      subjectType: String(row.subject_type),
      subjectId,
      title: String(row.title),
      summary: nullableString(row.summary),
      actionLabel: nullableString(row.action_label),
      actionPath: resolveRecentWorkspaceChangeActionPath(eventType, nullableString(row.action_path), subjectId),
      metadata: row.metadata && typeof row.metadata === 'object'
        ? row.metadata as Record<string, unknown>
        : {},
    };
  });
}
