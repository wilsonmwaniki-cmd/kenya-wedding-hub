import { describe, expect, it } from 'vitest';
import { assertLivePaystackKey } from '../../supabase/functions/_shared/zaniaPayPilot';
import { paystackEventReference } from '../../supabase/functions/_shared/paystackEventReference';

describe('Paystack event routing', () => {
  it('routes refund events by original payment, even when a refund reference is present', () => {
    expect(paystackEventReference({ reference: 'refund-123', transaction: { reference: 'zania-pay-original' } })).toBe('zania-pay-original');
    expect(paystackEventReference({ transaction_reference: 'zania-pay-original' })).toBe('zania-pay-original');
    expect(paystackEventReference({ transaction: 'zania-pay-original' })).toBe('zania-pay-original');
  });
  it('preserves subscription payment routing and ignores missing references', () => {
    expect(paystackEventReference({ reference: 'subscription-123' })).toBe('subscription-123');
    expect(paystackEventReference(undefined)).toBe('');
  });
});

describe('live payment safeguards', () => {
  it('rejects test and absent keys in live mode', () => {
    expect(() => assertLivePaystackKey('sk_test_example')).toThrow();
    expect(() => assertLivePaystackKey('')).toThrow();
    expect(() => assertLivePaystackKey('sk_live_example')).not.toThrow();
  });
});
