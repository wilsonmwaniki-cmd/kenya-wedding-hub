/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/integrations/supabase/client';

export type DocumentRequestRole = 'planner' | 'vendor';
export type DocumentRequestType = 'quote' | 'contract';
export type DocumentRequestStatus =
  | 'new'
  | 'viewed'
  | 'responded'
  | 'changes_requested'
  | 'declined'
  | 'cancelled';

export type DocumentRequestRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  requesterUserId: string;
  recipientUserId: string;
  requesterRole: 'couple' | 'planner' | 'vendor';
  recipientRole: DocumentRequestRole;
  requestType: DocumentRequestType;
  status: DocumentRequestStatus;
  weddingId: string | null;
  clientId: string | null;
  vendorId: string | null;
  vendorListingId: string | null;
  responseDocumentId: string | null;
  responseContractId: string | null;
  title: string;
  serviceCategory: string | null;
  message: string | null;
  requesterName: string;
  requesterEmail: string | null;
  requesterPhone: string | null;
  recipientName: string;
  weddingName: string | null;
  eventDate: string | null;
  budgetAmount: number | null;
  dueAt: string | null;
  viewedAt: string | null;
  respondedAt: string | null;
  metadata: Record<string, unknown>;
};

function nullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function mapDocumentRequest(row: Record<string, unknown>): DocumentRequestRecord {
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    requesterUserId: String(row.requester_user_id),
    recipientUserId: String(row.recipient_user_id),
    requesterRole: String(row.requester_role) as DocumentRequestRecord['requesterRole'],
    recipientRole: String(row.recipient_role) as DocumentRequestRole,
    requestType: String(row.request_type) as DocumentRequestType,
    status: String(row.status) as DocumentRequestStatus,
    weddingId: nullableString(row.wedding_id),
    clientId: nullableString(row.client_id),
    vendorId: nullableString(row.vendor_id),
    vendorListingId: nullableString(row.vendor_listing_id),
    responseDocumentId: nullableString(row.response_document_id),
    responseContractId: nullableString(row.response_contract_id),
    title: String(row.title ?? 'Document request'),
    serviceCategory: nullableString(row.service_category),
    message: nullableString(row.message),
    requesterName: String(row.requester_name ?? 'Zania client'),
    requesterEmail: nullableString(row.requester_email),
    requesterPhone: nullableString(row.requester_phone),
    recipientName: String(row.recipient_name ?? 'Professional'),
    weddingName: nullableString(row.wedding_name),
    eventDate: nullableString(row.event_date),
    budgetAmount: row.budget_amount == null ? null : Number(row.budget_amount),
    dueAt: nullableString(row.due_at),
    viewedAt: nullableString(row.viewed_at),
    respondedAt: nullableString(row.responded_at),
    metadata: row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : {},
  };
}

export async function listIncomingDocumentRequests(role: DocumentRequestRole) {
  const { data, error } = await (supabase as any)
    .from('document_requests')
    .select('*')
    .eq('recipient_role', role)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(mapDocumentRequest);
}

export async function markDocumentRequestViewed(requestId: string) {
  const { data, error } = await (supabase as any).rpc('mark_document_request_viewed', {
    request_id_input: requestId,
  });

  if (error) throw error;
  return mapDocumentRequest(data as Record<string, unknown>);
}

export async function respondToDocumentRequest(
  requestId: string,
  input: { documentId?: string | null; contractId?: string | null },
) {
  const { data, error } = await (supabase as any).rpc('respond_to_document_request', {
    request_id_input: requestId,
    response_document_id_input: input.documentId ?? null,
    response_contract_id_input: input.contractId ?? null,
  });

  if (error) throw error;
  return mapDocumentRequest(data as Record<string, unknown>);
}

export async function requestVendorQuote(
  vendorId: string,
  input?: { message?: string | null; budgetAmount?: number | null },
) {
  const { data, error } = await (supabase as any).rpc('request_vendor_quote', {
    target_vendor_id: vendorId,
    request_message: input?.message?.trim() || null,
    request_budget_amount: input?.budgetAmount ?? null,
  });

  if (error) throw error;
  return mapDocumentRequest(data as Record<string, unknown>);
}

export async function requestPlannerQuote(
  plannerUserId: string,
  input?: { message?: string | null; budgetAmount?: number | null },
) {
  const { data, error } = await (supabase as any).rpc('request_planner_quote', {
    target_planner_user_id: plannerUserId,
    request_message: input?.message?.trim() || null,
    request_budget_amount: input?.budgetAmount ?? null,
  });

  if (error) throw error;
  return mapDocumentRequest(data as Record<string, unknown>);
}
