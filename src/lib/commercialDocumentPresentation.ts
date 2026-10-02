import type { CommercialDocumentType } from '@/lib/commercialDocuments';

export function formatCommercialDocumentDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function commercialDocumentDateFields(document: {
  documentType: CommercialDocumentType;
  issueDate: string;
  dueDate: string | null;
  paidDate: string | null;
}) {
  if (document.documentType === 'receipt') {
    return [
      { label: 'Payment date', value: formatCommercialDocumentDate(document.paidDate || document.issueDate) },
      { label: 'Issue date', value: formatCommercialDocumentDate(document.issueDate) },
    ];
  }

  return [
    { label: 'Issue date', value: formatCommercialDocumentDate(document.issueDate) },
    {
      label: document.documentType === 'quote' ? 'Valid until' : 'Due date',
      value: formatCommercialDocumentDate(document.dueDate),
    },
  ];
}
