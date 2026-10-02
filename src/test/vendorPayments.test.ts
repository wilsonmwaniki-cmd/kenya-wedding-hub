import { describe, expect, it } from 'vitest';
import { deriveVendorPaymentStatus, totalRecordedVendorPayments } from '@/lib/vendorPayments';

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

describe('deriveVendorPaymentStatus', () => {
  it('shows a required deposit as due before money is recorded', () => {
    expect(deriveVendorPaymentStatus({ totalCost: 50_000, depositRequired: 15_000, totalPaid: 0 })).toBe('deposit_due');
  });

  it('recognizes an exactly paid booking deposit', () => {
    expect(deriveVendorPaymentStatus({ totalCost: 50_000, depositRequired: 15_000, totalPaid: 15_000 })).toBe('deposit_paid');
  });

  it('treats further instalments as part paid', () => {
    expect(deriveVendorPaymentStatus({ totalCost: 50_000, depositRequired: 15_000, totalPaid: 30_000 })).toBe('part_paid');
  });

  it('marks the vendor as paid in full once the total cost is covered', () => {
    expect(deriveVendorPaymentStatus({ totalCost: 50_000, depositRequired: 15_000, totalPaid: 50_000 })).toBe('paid_full');
  });
});
