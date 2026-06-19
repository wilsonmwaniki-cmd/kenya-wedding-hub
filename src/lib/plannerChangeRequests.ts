import { supabase } from '@/integrations/supabase/client';

export type PlannerChangeTargetTable =
  | 'guests'
  | 'wedding_contributions'
  | 'contribution_rounds'
  | 'budget_categories'
  | 'budget_payments'
  | 'tasks'
  | 'vendors'
  | 'timelines'
  | 'timeline_events';
export type PlannerChangeType = 'create' | 'update' | 'delete';
export type PlannerChangeStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type PlannerChangeRequestRow = {
  id: string;
  client_id: string;
  couple_user_id: string;
  planner_user_id: string;
  target_table: PlannerChangeTargetTable;
  change_type: PlannerChangeType;
  target_id: string | null;
  current_payload: Record<string, unknown> | null;
  proposed_payload: Record<string, unknown>;
  note: string | null;
  status: PlannerChangeStatus;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};

type SubmitPlannerChangeRequestInput = {
  clientId: string;
  coupleUserId: string;
  plannerUserId: string;
  targetTable: PlannerChangeTargetTable;
  changeType: PlannerChangeType;
  targetId?: string | null;
  currentPayload?: Record<string, unknown> | null;
  proposedPayload: Record<string, unknown>;
  note?: string | null;
};

const db = supabase as any;

function asRow(value: any): PlannerChangeRequestRow {
  return value as PlannerChangeRequestRow;
}

export async function submitPlannerChangeRequest(input: SubmitPlannerChangeRequestInput) {
  const payload = {
    client_id: input.clientId,
    couple_user_id: input.coupleUserId,
    planner_user_id: input.plannerUserId,
    target_table: input.targetTable,
    change_type: input.changeType,
    target_id: input.targetId ?? null,
    current_payload: input.currentPayload ?? null,
    proposed_payload: input.proposedPayload,
    note: input.note ?? null,
  };

  const { data, error } = await db
    .from('planner_change_requests')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return asRow(data);
}

export async function listPendingPlannerChangeRequests(coupleUserId: string) {
  const { data, error } = await db
    .from('planner_change_requests')
    .select('*')
    .eq('couple_user_id', coupleUserId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as any[]).map(asRow);
}

function getApprovalInsertPayload(request: PlannerChangeRequestRow) {
  return {
    user_id: request.couple_user_id,
    client_id: request.client_id,
    ...request.proposed_payload,
  };
}

async function applyPlannerChangeRequest(request: PlannerChangeRequestRow) {
  if (request.target_table === 'guests') {
    if (request.change_type === 'create') {
      const { error } = await supabase.from('guests').insert(getApprovalInsertPayload(request) as never);
      if (error) throw error;
      return;
    }

    if (!request.target_id) throw new Error('Missing guest target id.');

    if (request.change_type === 'update') {
      const { error } = await supabase.from('guests').update(request.proposed_payload as never).eq('id', request.target_id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from('guests').delete().eq('id', request.target_id);
    if (error) throw error;
    return;
  }

  if (request.target_table === 'budget_categories') {
    if (request.change_type === 'create') {
      const { error } = await supabase.from('budget_categories').insert(getApprovalInsertPayload(request) as never);
      if (error) throw error;
      return;
    }

    if (!request.target_id) throw new Error('Missing budget category target id.');

    if (request.change_type === 'update') {
      const { error } = await supabase.from('budget_categories').update(request.proposed_payload as never).eq('id', request.target_id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from('budget_categories').delete().eq('id', request.target_id);
    if (error) throw error;
    return;
  }

  if (request.target_table === 'budget_payments') {
    if (request.change_type !== 'create') throw new Error('Budget payment moderation currently supports create requests only.');

    const payload = getApprovalInsertPayload(request) as Record<string, any>;
    const { error } = await supabase.from('budget_payments').insert(payload as never);
    if (error) throw error;

    if (payload.budget_category_id && typeof payload.amount === 'number') {
      const currentSpent = Number((request.current_payload?.category_spent as number | undefined) ?? 0);
      const { error: updateCategoryError } = await supabase
        .from('budget_categories')
        .update({ spent: currentSpent + payload.amount } as never)
        .eq('id', payload.budget_category_id);
      if (updateCategoryError) throw updateCategoryError;
    }

    if (payload.vendor_id && typeof payload.vendor_amount_paid === 'number') {
      const vendorUpdate: Record<string, unknown> = {
        amount_paid: payload.vendor_amount_paid,
      };
      if (payload.vendor_payment_status) vendorUpdate.payment_status = payload.vendor_payment_status;
      if (payload.payment_date) vendorUpdate.last_payment_at = payload.payment_date;
      const { error: updateVendorError } = await supabase.from('vendors').update(vendorUpdate as never).eq('id', payload.vendor_id);
      if (updateVendorError) throw updateVendorError;
    }
    return;
  }

  if (request.target_table === 'tasks') {
    if (request.change_type === 'create') {
      const { error } = await supabase.from('tasks').insert(getApprovalInsertPayload(request) as never);
      if (error) throw error;
      return;
    }

    if (!request.target_id) throw new Error('Missing task target id.');

    if (request.change_type === 'update') {
      const { error } = await supabase.from('tasks').update(request.proposed_payload as never).eq('id', request.target_id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from('tasks').delete().eq('id', request.target_id);
    if (error) throw error;
    return;
  }

  if (request.target_table === 'vendors') {
    if (request.change_type === 'create') {
      const { error } = await supabase.from('vendors').insert(getApprovalInsertPayload(request) as never);
      if (error) throw error;
      return;
    }

    if (!request.target_id) throw new Error('Missing vendor target id.');

    if (request.change_type === 'update') {
      const { error } = await supabase.from('vendors').update(request.proposed_payload as never).eq('id', request.target_id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from('vendors').delete().eq('id', request.target_id);
    if (error) throw error;
    return;
  }

  if (request.target_table === 'timelines') {
    if (request.change_type === 'create') {
      const { error } = await supabase.from('timelines').insert(getApprovalInsertPayload(request) as never);
      if (error) throw error;
      return;
    }

    if (!request.target_id) throw new Error('Missing timeline target id.');

    if (request.change_type === 'update') {
      const { error } = await supabase.from('timelines').update(request.proposed_payload as never).eq('id', request.target_id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from('timelines').delete().eq('id', request.target_id);
    if (error) throw error;
    return;
  }

  if (request.target_table === 'timeline_events') {
    if (request.change_type === 'create') {
      const { error } = await supabase.from('timeline_events').insert(request.proposed_payload as never);
      if (error) throw error;
      return;
    }

    if (!request.target_id) throw new Error('Missing timeline event target id.');

    if (request.change_type === 'update') {
      const { error } = await supabase.from('timeline_events').update(request.proposed_payload as never).eq('id', request.target_id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from('timeline_events').delete().eq('id', request.target_id);
    if (error) throw error;
    return;
  }

  if (request.target_table === 'wedding_contributions') {
    if (request.change_type === 'create') {
      const { error } = await db.from('wedding_contributions').insert(getApprovalInsertPayload(request));
      if (error) throw error;
      return;
    }

    if (!request.target_id) throw new Error('Missing contribution target id.');

    if (request.change_type === 'update') {
      const { error } = await db.from('wedding_contributions').update(request.proposed_payload).eq('id', request.target_id);
      if (error) throw error;
      return;
    }

    const { error } = await db.from('wedding_contributions').delete().eq('id', request.target_id);
    if (error) throw error;
    return;
  }

  if (request.target_table === 'contribution_rounds') {
    if (request.change_type === 'create') {
      const { error } = await db.from('contribution_rounds').insert(getApprovalInsertPayload(request));
      if (error) throw error;
      return;
    }

    if (!request.target_id) throw new Error('Missing contribution round target id.');

    if (request.change_type === 'update') {
      const { error } = await db.from('contribution_rounds').update(request.proposed_payload).eq('id', request.target_id);
      if (error) throw error;
      return;
    }

    const { error } = await db.from('contribution_rounds').delete().eq('id', request.target_id);
    if (error) throw error;
  }
}

async function markPlannerChangeRequestStatus(
  requestId: string,
  status: Extract<PlannerChangeStatus, 'approved' | 'rejected' | 'cancelled'>,
  reviewedBy: string,
) {
  const { error } = await db
    .from('planner_change_requests')
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
    })
    .eq('id', requestId);

  if (error) throw error;
}

export async function approvePlannerChangeRequest(request: PlannerChangeRequestRow, reviewedBy: string) {
  await applyPlannerChangeRequest(request);
  await markPlannerChangeRequestStatus(request.id, 'approved', reviewedBy);
}

export async function rejectPlannerChangeRequest(requestId: string, reviewedBy: string) {
  await markPlannerChangeRequestStatus(requestId, 'rejected', reviewedBy);
}

export function describePlannerChangeRequest(request: PlannerChangeRequestRow) {
  const proposed = request.proposed_payload ?? {};
  const name =
    String(
      proposed.name
      ?? proposed.contributor_name
      ?? proposed.title
      ?? proposed.in_kind_item
      ?? request.target_id
      ?? 'this item',
    );

  const targetLabel =
    request.target_table === 'guests'
      ? 'guest'
      : request.target_table === 'budget_categories'
        ? 'budget category'
        : request.target_table === 'budget_payments'
          ? 'budget payment'
          : request.target_table === 'tasks'
            ? 'task'
            : request.target_table === 'vendors'
              ? 'vendor'
              : request.target_table === 'timelines'
                ? 'timeline'
                : request.target_table === 'timeline_events'
                  ? 'timeline event'
      : request.target_table === 'wedding_contributions'
        ? 'contribution'
        : 'fundraising round';

  const verb =
    request.change_type === 'create'
      ? 'proposed a new'
      : request.change_type === 'update'
        ? 'requested updates to'
        : 'requested removal of';

  return `${verb} ${targetLabel}: ${name}`;
}
