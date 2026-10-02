import { supabase } from '@/integrations/supabase/client';

export type ExternalInvoicePaymentStatus = 'pending' | 'confirmed' | 'disputed';
export type ExternalInvoicePaymentMethod = 'mpesa' | 'bank' | 'cash' | 'card' | 'other';
export type ExternalInvoicePaymentReport = {
  id: string;
  documentId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: ExternalInvoicePaymentMethod;
  reference: string | null;
  notes: string | null;
  status: ExternalInvoicePaymentStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  commercialPaymentId: string | null;
};

const PAYMENT_METHOD_LABELS: Record<ExternalInvoicePaymentMethod, string> = {
  mpesa: 'M-Pesa',
  bank: 'Bank',
  cash: 'Cash',
  card: 'Card',
  other: 'Other',
};

export function externalInvoicePaymentMethodLabel(method: ExternalInvoicePaymentMethod) {
  return PAYMENT_METHOD_LABELS[method];
}

type ExternalInvoicePaymentRpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

const paymentRpc = supabase as unknown as ExternalInvoicePaymentRpcClient;

function report(value: unknown): ExternalInvoicePaymentReport {
  const row = value as Record<string, unknown>;
  return {
    id: String(row.id), documentId: String(row.documentId), amount: Number(row.amount),
    paymentDate: String(row.paymentDate), paymentMethod: String(row.paymentMethod) as ExternalInvoicePaymentReport['paymentMethod'],
    reference: typeof row.reference === 'string' ? row.reference : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
    status: String(row.status) as ExternalInvoicePaymentStatus,
    reviewNote: typeof row.reviewNote === 'string' ? row.reviewNote : null,
    reviewedAt: typeof row.reviewedAt === 'string' ? row.reviewedAt : null,
    createdAt: String(row.createdAt),
    commercialPaymentId: typeof row.commercialPaymentId === 'string' ? row.commercialPaymentId : null,
  };
}

export async function submitExternalInvoicePayment(input: {
  shareToken: string; requestId: string; amount: number; paymentDate: string;
  paymentMethod: ExternalInvoicePaymentReport['paymentMethod']; reference?: string | null; notes?: string | null;
}) {
  const { data, error } = await paymentRpc.rpc('submit_external_invoice_payment', {
    _share_token: input.shareToken, _client_request_id: input.requestId, _amount: input.amount,
    _payment_date: input.paymentDate, _payment_method: input.paymentMethod,
    _reference: input.reference ?? null, _notes: input.notes ?? null,
  });
  if (error) throw error;
  return report(data);
}

export async function listRecipientExternalInvoicePayments(shareToken: string) {
  const { data, error } = await paymentRpc.rpc('list_external_invoice_payments_for_recipient', { _share_token: shareToken });
  if (error) throw error;
  return Array.isArray(data) ? data.map(report) : [];
}

export async function listOwnerExternalInvoicePayments(documentId: string) {
  const { data, error } = await paymentRpc.rpc('list_external_invoice_payments_for_owner', { _document_id: documentId });
  if (error) throw error;
  return Array.isArray(data) ? data.map(report) : [];
}

export async function reviewExternalInvoicePayment(reportId: string, decision: 'confirmed' | 'disputed', note?: string | null) {
  const { data, error } = await paymentRpc.rpc('review_external_invoice_payment', { _report_id: reportId, _decision: decision, _review_note: note ?? null });
  if (error) throw error;
  return report(data);
}
