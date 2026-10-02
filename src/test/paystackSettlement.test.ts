import { describe, expect, it } from 'vitest';
import {
  mapPaystackSettlementStatus,
  parsePaystackSettlements,
  paystackTransactionsIncludeReference,
} from '../../supabase/functions/_shared/paystackSettlement';

describe('Paystack settlement reconciliation', () => {
  it('maps provider payout states to Zania settlement states', () => {
    expect(mapPaystackSettlementStatus('success')).toBe('paid');
    expect(mapPaystackSettlementStatus('processing')).toBe('scheduled');
    expect(mapPaystackSettlementStatus('pending')).toBe('pending');
    expect(mapPaystackSettlementStatus('failed')).toBe('failed');
    expect(mapPaystackSettlementStatus('unknown')).toBe('pending');
  });

  it('normalizes settlement records without trusting malformed rows', () => {
    expect(parsePaystackSettlements([
      { id: 123, status: 'success', settlement_date: '2026-09-14T00:00:00.000Z', updatedAt: '2026-09-14T08:00:00.000Z' },
      { status: 'pending' },
    ])).toEqual([{
      id: '123',
      status: 'paid',
      settlementDate: '2026-09-14T00:00:00.000Z',
      paidAt: '2026-09-14T08:00:00.000Z',
    }]);
  });

  it('matches a transaction only by its exact Paystack reference', () => {
    const rows = [{ reference: 'zania-pay-abc' }, { reference: 'zania-pay-other' }];
    expect(paystackTransactionsIncludeReference(rows, 'zania-pay-abc')).toBe(true);
    expect(paystackTransactionsIncludeReference(rows, 'zania-pay')).toBe(false);
  });
});
