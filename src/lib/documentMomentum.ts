import type {
  CommercialDocumentStatus,
  CommercialDocumentType,
  DocumentTemplateItem,
  ProfessionalDocumentTemplateRecord,
} from '@/lib/commercialDocuments';

export type DocumentReadinessCheck = {
  key: string;
  label: string;
  complete: boolean;
};

export type DocumentMomentumSummary = {
  readinessScore: number;
  readinessLabel: string;
  checks: DocumentReadinessCheck[];
  milestones: Array<{ key: string; label: string; active: boolean }>;
};

type DocumentMomentumInput = {
  documentType: CommercialDocumentType;
  status?: CommercialDocumentStatus | string | null;
  title?: string | null;
  recipientName?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  terms?: string | null;
  items?: DocumentTemplateItem[];
  totalAmount?: number;
  amountPaid?: number;
  shareActive?: boolean;
};

function hasText(value?: string | null) {
  return Boolean(value?.trim());
}

function hasPricedItems(items: DocumentTemplateItem[] | undefined) {
  return (items ?? []).some((item) => {
    const description = item.description?.trim() ?? '';
    return description.length > 0 && Number(item.unitPrice ?? 0) > 0;
  });
}

function readinessLabel(score: number) {
  if (score >= 90) return 'Send-ready';
  if (score >= 70) return 'Nearly ready';
  if (score >= 40) return 'Taking shape';
  return 'Just started';
}

export function buildDocumentMomentumSummary(input: DocumentMomentumInput): DocumentMomentumSummary {
  const items = input.items ?? [];
  const checks: DocumentReadinessCheck[] = [
    { key: 'title', label: 'Clear title', complete: hasText(input.title) },
    { key: 'recipient', label: 'Recipient filled', complete: hasText(input.recipientName) },
    { key: 'issueDate', label: 'Issue date set', complete: hasText(input.issueDate) },
    {
      key: 'dueDate',
      label: input.documentType === 'receipt' ? 'Receipt date set' : 'Due date set',
      complete: input.documentType === 'receipt' ? hasText(input.issueDate) : hasText(input.dueDate),
    },
    { key: 'items', label: 'Line items added', complete: items.some((item) => hasText(item.description)) },
    {
      key: 'value',
      label: input.documentType === 'receipt' ? 'Payment amount reflected' : 'Commercial value included',
      complete:
        input.documentType === 'receipt'
          ? Number(input.amountPaid ?? input.totalAmount ?? 0) > 0 || hasPricedItems(items)
          : Number(input.totalAmount ?? 0) > 0 || hasPricedItems(items),
    },
    { key: 'terms', label: 'Terms included', complete: hasText(input.terms) },
    { key: 'notes', label: 'Notes included', complete: hasText(input.notes) },
  ];

  const completed = checks.filter((check) => check.complete).length;
  const readinessScore = Math.round((completed / checks.length) * 100);
  const status = input.status ?? 'draft';

  const milestones = [
    { key: 'drafted', label: 'Drafted', active: hasText(input.title) && hasText(input.recipientName) },
    {
      key: 'priced',
      label: input.documentType === 'receipt' ? 'Logged' : 'Priced',
      active: Number(input.totalAmount ?? 0) > 0 || hasPricedItems(items),
    },
    {
      key: 'reviewed',
      label: 'Reviewed',
      active: hasText(input.terms) && hasText(input.notes),
    },
    {
      key: 'shared',
      label: 'Shared',
      active:
        Boolean(input.shareActive) ||
        ['sent', 'accepted', 'part_paid', 'paid', 'issued'].includes(String(status)),
    },
    {
      key: 'paid',
      label: input.documentType === 'quote' ? 'Booked' : 'Paid',
      active:
        input.documentType === 'quote'
          ? ['accepted'].includes(String(status))
          : Number(input.amountPaid ?? 0) > 0 || ['paid', 'issued'].includes(String(status)),
    },
  ];

  return {
    readinessScore,
    readinessLabel: readinessLabel(readinessScore),
    checks,
    milestones,
  };
}

export function getTemplateUseCount(template: ProfessionalDocumentTemplateRecord) {
  const raw = template.metadata?.useCount;
  const count = Number(raw ?? 0);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}
