import type { SaveCommercialDocumentItemInput } from '@/lib/commercialDocuments';

export type CommercialDocumentAutosaveSnapshot = {
  title: string;
  recipientName: string;
  recipientEmail: string;
  additionalRecipientEmails: string[];
  recipientPhone: string;
  weddingName: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  terms: string;
  discountAmount: number;
  taxAmount: number;
  paymentInstructions: string;
  authorisedBy: string;
  items: SaveCommercialDocumentItemInput[];
};

export function buildCommercialDocumentAutosaveSnapshot(
  header: Omit<CommercialDocumentAutosaveSnapshot, 'items'>,
  items: SaveCommercialDocumentItemInput[],
): CommercialDocumentAutosaveSnapshot {
  return {
    ...header,
    items: items.map((item, index) => ({
      description: item.description ?? '',
      quantity: Number(item.quantity ?? 1),
      unitPrice: Number(item.unitPrice ?? 0),
      sortOrder: index,
      metadata: item.metadata ?? {},
    })),
  };
}

export function calculateCommercialDocumentDraftTotals(snapshot: CommercialDocumentAutosaveSnapshot) {
  const subtotal = snapshot.items.reduce(
    (sum, item) => sum + Number(item.quantity ?? 1) * Number(item.unitPrice ?? 0),
    0,
  );
  const totalAmount = Math.max(0, subtotal - Number(snapshot.discountAmount || 0) + Number(snapshot.taxAmount || 0));
  return { subtotal, totalAmount };
}
