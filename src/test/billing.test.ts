import { describe, expect, it } from 'vitest';
import {
  getCheckoutProviderFromSearchParams,
  getCheckoutReferenceFromSearchParams,
} from '@/lib/billing';

describe('billing callback routing', () => {
  it('uses the Paystack reference and explicit provider from the callback', () => {
    const params = new URLSearchParams(
      'payment_provider=paystack&trxref=pzania-123&reference=pzania-123',
    );

    expect(getCheckoutReferenceFromSearchParams(params)).toBe('pzania-123');
    expect(getCheckoutProviderFromSearchParams(params)).toBe('paystack');
  });

  it('preserves Pesapal callback compatibility', () => {
    const params = new URLSearchParams(
      'payment_provider=pesapal&OrderTrackingId=pesapal-order-123',
    );

    expect(getCheckoutReferenceFromSearchParams(params)).toBe('pesapal-order-123');
    expect(getCheckoutProviderFromSearchParams(params)).toBe('pesapal');
  });
});
