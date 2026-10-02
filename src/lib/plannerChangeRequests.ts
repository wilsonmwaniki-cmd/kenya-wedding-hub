import { supabase } from '@/integrations/supabase/client';
import { deriveVendorPaymentStatus } from '@/lib/vendorPayments';

export type PlannerChangeTargetTable =
  | 'guests'
  | 'wedding_contributions'
  | 'contribution_rounds'
  | 'budget_categories'
  | 'budget_payments'
  | 'tasks'
  | 'vendors'
  | 'timelines'
  | 'timeline_events'
  | 'vendor_enquiries'
  | 'document_requests'
  | 'commercial_quote_responses';
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
  gateway_idempotency_key?: string | null;
  target_label?: string | null;
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
  const rows = ((data ?? []) as any[]).map(asRow);
  const labelFields: Partial<Record<PlannerChangeTargetTable, string>> = {
    guests: 'name',
    wedding_contributions: 'contributor_name',
    contribution_rounds: 'title',
    budget_categories: 'name',
    tasks: 'title',
    vendors: 'name',
    timelines: 'title',
    timeline_events: 'title',
  };
  const labels = new Map<string, string>();

  await Promise.all(Object.entries(labelFields).map(async ([table, labelField]) => {
    const ids = [...new Set(rows
      .filter((row) => row.target_table === table && row.target_id)
      .map((row) => row.target_id as string))];
    if (ids.length === 0) return;

    const { data: targetRows, error: targetError } = await db
      .from(table)
      .select(`id,${labelField}`)
      .in('id', ids);
    if (targetError) throw targetError;

    for (const targetRow of targetRows ?? []) {
      const label = targetRow[labelField];
      if (typeof label === 'string' && label.trim()) {
        labels.set(`${table}:${targetRow.id}`, label.trim());
      }
    }
  }));

  return rows.map((row) => ({
    ...row,
    target_label: row.target_id
      ? labels.get(`${row.target_table}:${row.target_id}`) ?? null
      : null,
  }));
}

function getApprovalInsertPayload(request: PlannerChangeRequestRow) {
  return {
    user_id: request.couple_user_id,
    client_id: request.client_id,
    ...request.proposed_payload,
  };
}

async function applyPlannerChangeRequest(request: PlannerChangeRequestRow) {
  if (request.target_table === 'commercial_quote_responses') {
    if (request.change_type !== 'create') throw new Error('Formal quote response moderation supports create requests only.');
    const proposed = request.proposed_payload ?? {};
    const { error } = await (supabase as any).rpc('request_formal_quote_changes', {
      target_document_id: proposed.quote_document_id,
      change_message: proposed.message,
      gateway_idempotency_key_input: request.gateway_idempotency_key,
    });
    if (error) throw error;
    return;
  }

  if (request.target_table === 'document_requests') {
    if (request.change_type !== 'create') throw new Error('Formal quote moderation supports create requests only.');
    const proposed = request.proposed_payload ?? {};
    const { error } = await (supabase as any).rpc('request_vendor_quote', {
      target_vendor_id: proposed.target_vendor_id,
      request_message: proposed.request_message ?? null,
      request_budget_amount: null,
    });
    if (error) throw error;
    return;
  }

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
    const {
      vendor_amount_paid: _legacyVendorAmountPaid,
      vendor_payment_status: _legacyVendorPaymentStatus,
      ...paymentPayload
    } = payload;
    const { error } = await supabase.from('budget_payments').insert(paymentPayload as never);
    if (error) throw error;

    if (payload.budget_category_id && typeof payload.amount === 'number') {
      const { data: category, error: categoryReadError } = await supabase
        .from('budget_categories')
        .select('spent')
        .eq('id', payload.budget_category_id)
        .single();
      if (categoryReadError) throw categoryReadError;
      const currentSpent = Number(category?.spent ?? 0);
      const { error: updateCategoryError } = await supabase
        .from('budget_categories')
        .update({ spent: currentSpent + payload.amount } as never)
        .eq('id', payload.budget_category_id);
      if (updateCategoryError) throw updateCategoryError;
    }

    if (payload.vendor_id) {
      const [{ data: payments, error: paymentsError }, { data: vendor, error: vendorReadError }] = await Promise.all([
        supabase.from('budget_payments').select('amount,payment_date').eq('vendor_id', payload.vendor_id),
        supabase.from('vendors').select('price,deposit_amount').eq('id', payload.vendor_id).single(),
      ]);
      if (paymentsError) throw paymentsError;
      if (vendorReadError) throw vendorReadError;
      const amountPaid = (payments ?? []).reduce((total, payment) => total + Number(payment.amount ?? 0), 0);
      const vendorUpdate: Record<string, unknown> = {
        amount_paid: amountPaid,
        payment_status: deriveVendorPaymentStatus({
          totalCost: vendor?.price,
          depositRequired: vendor?.deposit_amount,
          totalPaid: amountPaid,
        }),
      };
      const lastPaymentAt = (payments ?? [])
        .map((payment) => payment.payment_date)
        .filter((paymentDate): paymentDate is string => typeof paymentDate === 'string' && paymentDate.length > 0)
        .sort()
        .at(-1);
      if (lastPaymentAt) vendorUpdate.last_payment_at = lastPaymentAt;
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
  if (request.target_table === 'vendor_enquiries') {
    const { data, error } = await supabase.functions.invoke('review-planner-vendor-enquiry', {
      body: { requestId: request.id },
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'The approved enquiry could not be delivered.');
    return {
      deliveryStatus: data?.enquiry?.delivery_status as 'sent' | 'failed' | undefined,
      message: typeof data?.message === 'string' ? data.message : null,
    };
  }
  await applyPlannerChangeRequest(request);
  await markPlannerChangeRequestStatus(request.id, 'approved', reviewedBy);
  return null;
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
      ?? request.target_label
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
              : request.target_table === 'vendor_enquiries'
                ? 'vendor enquiry'
              : request.target_table === 'document_requests'
                ? 'formal quote request'
              : request.target_table === 'commercial_quote_responses'
                ? 'formal quote change request'
              : request.target_table === 'timelines'
                ? 'timeline'
                : request.target_table === 'timeline_events'
                  ? 'timeline event'
      : request.target_table === 'wedding_contributions'
        ? 'contribution'
        : 'fundraising round';

  const verb = request.change_type === 'create'
    ? 'Add'
    : request.change_type === 'update'
      ? 'Update'
      : 'Remove';

  return `${verb} ${targetLabel}: ${name}`;
}

export function describePlannerChangeDetails(request: PlannerChangeRequestRow) {
  const current = request.current_payload ?? {};
  const proposed = request.proposed_payload ?? {};

  if (request.target_table === 'vendor_enquiries') {
    return `To ${String(proposed.recipient_name ?? 'vendor')} at ${String(proposed.recipient_email ?? 'unknown email')}. Subject: “${String(proposed.subject ?? '')}”. Message: “${String(proposed.message ?? '')}”`;
  }


  if (request.target_table === 'document_requests') {
    return `From ${String(proposed.vendor_name ?? 'vendor')}. Message: “${String(proposed.request_message ?? '')}” The vendor receives this only after approval.`;
  }

  if (request.target_table === 'commercial_quote_responses') {
    return `For ${String(proposed.document_number ?? 'formal quote')} from ${String(proposed.vendor_name ?? 'vendor')}: “${String(proposed.message ?? '')}” The vendor sees these requested changes only after approval.`;
  }

  if (request.target_table === 'tasks' && typeof proposed.completed === 'boolean') {
    return proposed.completed ? 'Mark this task as done.' : 'Mark this task as not done.';
  }

  if (typeof proposed.due_date === 'string' && proposed.due_date !== current.due_date) {
    return `Change the due date to ${new Date(`${proposed.due_date}T12:00:00`).toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}.`;
  }

  if (request.note?.trim()) return request.note.trim();

  return request.change_type === 'create'
    ? 'Add this to your wedding plan.'
    : request.change_type === 'delete'
      ? 'Remove this from your wedding plan.'
      : 'Apply the planner’s update.';
}
