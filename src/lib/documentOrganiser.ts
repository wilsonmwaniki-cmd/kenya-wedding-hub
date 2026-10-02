import { supabase } from '@/integrations/supabase/client';
import { receivedDocumentPath, type ReceivedDocument } from '@/lib/receivedDocuments';
import type { RecentWorkspaceChange } from '@/lib/recentWorkspaceChanges';

export type OrganisedDocument = ReceivedDocument & {
  professional_id: string;
  professional_name: string;
  professional_role: string;
  source_id: string | null;
  due_date: string | null;
  amount_paid: number | null;
  balance_due: number | null;
  items: Array<{ description: string; quantity: number; unit_price: number; line_total: number }>;
};
export type DocumentActivity = {
  id: string; document_id: string; document_type: ReceivedDocument['document_type'];
  title: string; document_number: string | null; status: string; previous_status: string | null;
  occurred_at: string; share_token: string;
};
export type DocumentOrganiserData = { enabled: boolean; documents: OrganisedDocument[]; events: DocumentActivity[] };
export async function getDocumentOrganiser(weddingId: string): Promise<DocumentOrganiserData> {
  const { data, error } = await (supabase as any).rpc('get_document_organiser', { _wedding_id: weddingId });
  if (error) throw error;
  return data;
}

export function groupVendorDocuments(documents: OrganisedDocument[]) {
  const groups = new Map<string, { id: string; name: string; documents: OrganisedDocument[] }>();
  for (const document of documents) {
    const id = `${document.professional_role}:${document.professional_id}`;
    const group = groups.get(id) ?? { id, name: document.professional_name, documents: [] };
    group.documents.push(document); groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function invoiceBalances(documents: OrganisedDocument[]) {
  const currencies = new Map<string, { paid: number; due: number }>();
  for (const d of documents) {
    if (d.document_type !== 'invoice' || d.status === 'void' || !d.currency) continue;
    const totals = currencies.get(d.currency) ?? { paid: 0, due: 0 };
    totals.paid += Number(d.amount_paid ?? 0); totals.due += Number(d.balance_due ?? 0);
    currencies.set(d.currency, totals);
  }
  return [...currencies].map(([currency, totals]) => ({ currency, ...totals }));
}

export function dueInvoices(documents: OrganisedDocument[]) {
  return documents.filter((d) => d.document_type === 'invoice' && ['sent', 'part_paid'].includes(d.status)
    && Number(d.balance_due) > 0).sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));
}

export function documentAlerts(documents: OrganisedDocument[]) {
  const alerts: Array<{ document: OrganisedDocument; message: string }> = [];
  for (const invoice of documents.filter((d) => d.document_type === 'invoice' && d.status !== 'void')) {
    const receipts = documents.filter((d) => d.document_type === 'receipt' && d.status !== 'void'
      && d.source_id === invoice.id && d.professional_id === invoice.professional_id && d.currency === invoice.currency);
    const receipted = receipts.reduce((sum, d) => sum + Number(d.total_amount ?? 0), 0);
    if (Number(invoice.amount_paid) > receipted + 0.01) alerts.push({ document: invoice, message: 'A payment is recorded, but matching shared receipts do not cover it yet.' });
    if (Number(invoice.balance_due) > 0 && !invoice.due_date) alerts.push({ document: invoice, message: 'No due date is recorded for this outstanding invoice.' });
  }
  for (const quote of documents.filter((d) => d.document_type === 'quote' && d.status === 'accepted')) {
    const invoices = documents.filter((d) => d.document_type === 'invoice' && d.status !== 'void'
      && d.source_id === quote.id && d.professional_id === quote.professional_id && d.currency === quote.currency);
    if (invoices.reduce((sum, d) => sum + Number(d.total_amount ?? 0), 0) > Number(quote.total_amount) + 0.01)
      alerts.push({ document: quote, message: 'Linked invoice totals exceed this accepted quote. Check for agreed changes or duplicates.' });
    if (!documents.some((d) => d.document_type === 'contract' && d.professional_id === quote.professional_id && d.status !== 'cancelled'))
      alerts.push({ document: quote, message: 'No contract from this professional is in your shared documents. Check whether one is needed.' });
  }
  return alerts;
}

export function documentActivityChange(event: DocumentActivity): RecentWorkspaceChange {
  return {
    id: `document-${event.id}`, occurredAt: event.occurred_at, eventType: 'document.updated',
    subjectType: 'received_document', subjectId: event.document_id,
    title: `${event.document_type.charAt(0).toUpperCase() + event.document_type.slice(1)} ${event.previous_status !== event.status ? event.status.replace(/_/g, ' ') : 'updated'}`,
    summary: [event.document_number, event.title].filter(Boolean).join(' · '),
    actionLabel: 'Open document', actionPath: receivedDocumentPath({ ...event, id: event.document_id } as ReceivedDocument), metadata: {},
  };
}

export function mergeDocumentActivity(existing: RecentWorkspaceChange[], events: DocumentActivity[], maxItems: number) {
  return [...existing, ...events.map(documentActivityChange)]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, maxItems);
}
