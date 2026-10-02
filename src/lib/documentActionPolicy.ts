import type { CommercialDocumentDetail, CommercialDocumentStatus, ProfessionalContractRecord } from '@/lib/commercialDocuments';

export function commercialDocumentActionPolicy(document: CommercialDocumentDetail) {
  const isQuote = document.documentType === 'quote';
  const terminal = isQuote
    ? ['expired', 'accepted', 'rejected'].includes(document.status)
    : ['paid', 'void'].includes(document.status);
  return {
    canDuplicate: document.documentType !== 'receipt',
    canDelete: document.status === 'draft',
    canChangeLifecycle: !terminal,
    lifecycleLabel: isQuote ? 'Mark expired' : `Void ${document.documentType}`,
    lifecycleStatus: (isQuote ? 'expired' : 'void') as CommercialDocumentStatus,
  };
}

export function contractActionPolicy(contract: ProfessionalContractRecord) {
  return {
    canEdit: !contract.lockedAt,
    canDelete: !contract.lockedAt,
    canCancel: contract.status !== 'completed' && contract.status !== 'cancelled',
    canShare: contract.status !== 'cancelled',
  };
}
