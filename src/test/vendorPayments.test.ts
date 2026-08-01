import { describe, expect, it } from 'vitest';
import { totalRecordedVendorPayments } from '@/lib/vendorPayments';

describe('totalRecordedVendorPayments', () => {
  it('adds recorded payment amounts', () => {
    expect(totalRecordedVendorPayments([{ amount: 15_000 }, { amount: 10_000 }])).toBe(25_000);
  });

  it('normalizes database values and ignores missing amounts', () => {
    expect(totalRecordedVendorPayments([
      { amount: '5000' },
      { amount: null },
      { amount: undefined },
    ])).toBe(5_000);
  });
});
