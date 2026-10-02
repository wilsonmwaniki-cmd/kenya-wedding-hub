import { describe, expect, it } from 'vitest';
import { commercialDocumentActionPolicy, contractActionPolicy } from '@/lib/documentActionPolicy';
import type { CommercialDocumentDetail, ProfessionalContractRecord } from '@/lib/commercialDocuments';

const commercial = (documentType: CommercialDocumentDetail['documentType'], status: CommercialDocumentDetail['status']) => ({ documentType, status } as CommercialDocumentDetail);
const contract = (status: ProfessionalContractRecord['status'], lockedAt: string | null) => ({ status, lockedAt } as ProfessionalContractRecord);

describe('document action policy', () => {
  it('keeps receipt records unique and prevents deleting issued receipts', () => {
    expect(commercialDocumentActionPolicy(commercial('receipt', 'issued'))).toMatchObject({ canDuplicate: false, canDelete: false, lifecycleLabel: 'Void receipt' });
  });

  it('allows draft quotes to be duplicated, deleted, or expired', () => {
    expect(commercialDocumentActionPolicy(commercial('quote', 'draft'))).toMatchObject({ canDuplicate: true, canDelete: true, canChangeLifecycle: true, lifecycleStatus: 'expired' });
  });

  it('does not offer lifecycle changes for paid invoices', () => {
    expect(commercialDocumentActionPolicy(commercial('invoice', 'paid')).canChangeLifecycle).toBe(false);
  });

  it('preserves sent contracts while allowing cancellation', () => {
    expect(contractActionPolicy(contract('sent', '2026-08-31T07:00:00Z'))).toMatchObject({ canEdit: false, canDelete: false, canCancel: true, canShare: true });
  });

  it('removes sharing and cancellation from cancelled contracts', () => {
    expect(contractActionPolicy(contract('cancelled', '2026-08-31T07:00:00Z'))).toMatchObject({ canCancel: false, canShare: false });
  });
});
