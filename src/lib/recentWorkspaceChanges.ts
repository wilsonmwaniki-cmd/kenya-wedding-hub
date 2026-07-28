/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/integrations/supabase/client';

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

function nullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export async function listRecentWorkspaceChanges(limit = 5): Promise<RecentWorkspaceChange[]> {
  const { data, error } = await (supabase.rpc as any)('list_my_recent_workspace_events', {
    limit_input: limit,
  });

  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    occurredAt: String(row.occurred_at),
    eventType: String(row.event_type),
    subjectType: String(row.subject_type),
    subjectId: nullableString(row.subject_id),
    title: String(row.title),
    summary: nullableString(row.summary),
    actionLabel: nullableString(row.action_label),
    actionPath: nullableString(row.action_path),
    metadata: row.metadata && typeof row.metadata === 'object'
      ? row.metadata as Record<string, unknown>
      : {},
  }));
}
