import { describe, expect, it } from 'vitest';
import {
  coupleVendorContractMessage,
  coupleVendorContractShareUrl,
  type CoupleVendorContract,
} from '@/lib/coupleVendorContracts';

function contract(overrides: Partial<CoupleVendorContract> = {}): CoupleVendorContract {
  return {
    contractId: 'contract-1',
    title: 'Wedding cake services',
    status: 'draft',
    sentAt: null,
    signedAt: null,
    updatedAt: '2026-07-27T10:00:00.000Z',
    shareToken: null,
    shareExpiresAt: null,
    ...overrides,
  };
}

describe('couple vendor contracts', () => {
  it('keeps draft contracts private while explaining the vendor-owned next step', () => {
    const draft = contract();

    expect(coupleVendorContractMessage(draft)).toContain('vendor is preparing');
    expect(coupleVendorContractShareUrl(draft, 'https://planwithzania.com')).toBeNull();
  });

  it('builds the vendor-specific link only when an active share token is present', () => {
    const shared = contract({
      status: 'awaiting_signature',
      shareToken: 'share-token',
    });

    expect(coupleVendorContractMessage(shared)).toContain('review and signature');
    expect(coupleVendorContractShareUrl(shared, 'https://planwithzania.com')).toBe(
      'https://www.planwithzania.com/contracts/share/share-token',
    );
  });

  it('explains completed contracts without pretending a revoked link is available', () => {
    const completed = contract({ status: 'completed' });

    expect(coupleVendorContractMessage(completed)).toContain('Ask the vendor');
    expect(coupleVendorContractShareUrl(completed, 'https://planwithzania.com')).toBeNull();
  });
});
