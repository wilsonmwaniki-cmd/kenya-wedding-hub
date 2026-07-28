/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/integrations/supabase/client';

export type AttentionKind = 'action' | 'waiting' | 'update';
export type AttentionPriority = 'info' | 'action' | 'urgent';
export type AttentionStatus = 'unread' | 'read' | 'completed' | 'dismissed';

export interface AttentionItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  recipientRole: 'couple' | 'planner' | 'vendor';
  weddingId: string | null;
  sourceType: string;
  sourceId: string | null;
  kind: AttentionKind;
  priority: AttentionPriority;
  status: AttentionStatus;
  title: string;
  summary: string | null;
  actionLabel: string | null;
  actionPath: string | null;
  dueAt: string | null;
  metadata: Record<string, unknown>;
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function mapAttentionItem(row: Record<string, unknown>): AttentionItem {
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    recipientRole: String(row.recipient_role) as AttentionItem['recipientRole'],
    weddingId: nullableString(row.wedding_id),
    sourceType: String(row.source_type),
    sourceId: nullableString(row.source_id),
    kind: String(row.attention_kind) as AttentionKind,
    priority: String(row.priority) as AttentionPriority,
    status: String(row.status) as AttentionStatus,
    title: String(row.title),
    summary: nullableString(row.summary),
    actionLabel: nullableString(row.action_label),
    actionPath: nullableString(row.action_path),
    dueAt: nullableString(row.due_at),
    metadata: row.metadata && typeof row.metadata === 'object'
      ? row.metadata as Record<string, unknown>
      : {},
  };
}

export async function listAttentionItems(limit = 20) {
  const { data, error } = await (supabase as any)
    .from('attention_items')
    .select(
      'id, created_at, updated_at, recipient_role, wedding_id, source_type, source_id, attention_kind, priority, status, title, summary, action_label, action_path, due_at, metadata',
    )
    .in('status', ['unread', 'read'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(mapAttentionItem);
}

export async function setAttentionItemState(
  attentionId: string,
  status: Extract<AttentionStatus, 'read' | 'completed' | 'dismissed'>,
) {
  const { data, error } = await (supabase as any).rpc('set_attention_item_state', {
    attention_id_input: attentionId,
    next_status_input: status,
  });

  if (error) throw error;
  return mapAttentionItem(data as Record<string, unknown>);
}

export function buildAttentionBrief(items: AttentionItem[]) {
  return items
    .slice(0, 8)
    .map((item) => {
      const weddingName = typeof item.metadata.wedding_name === 'string'
        ? ` · ${item.metadata.wedding_name}`
        : '';
      const due = item.dueAt ? ` · due ${item.dueAt.slice(0, 10)}` : '';
      return `- ${item.priority.toUpperCase()}: ${item.title}${weddingName}${due}${item.summary ? ` — ${item.summary}` : ''}`;
    })
    .join('\n');
}
