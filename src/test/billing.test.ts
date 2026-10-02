import { describe, expect, it } from 'vitest';
import {
  getCheckoutProviderFromSearchParams,
  getCheckoutReferenceFromSearchParams,
} from '@/lib/billing';

describe('billing callback routing', () => {
  it('defaults every new or unlabelled checkout callback to Paystack', () => {
    expect(getCheckoutProviderFromSearchParams(new URLSearchParams())).toBe('paystack');
    expect(getCheckoutProviderFromSearchParams(new URLSearchParams('payment_provider=unknown'))).toBe('paystack');
  });

  it('uses the Paystack reference and explicit provider from the callback', () => {
    const params = new URLSearchParams(
      'payment_provider=paystack&trxref=pzania-123&reference=pzania-123',
    );

    expect(getCheckoutReferenceFromSearchParams(params)).toBe('pzania-123');
    expect(getCheckoutProviderFromSearchParams(params)).toBe('paystack');
  });

  it('preserves explicit Pesapal callback compatibility for historical payments', () => {
    const params = new URLSearchParams(
      'payment_provider=pesapal&OrderTrackingId=pesapal-order-123',
    );

    expect(getCheckoutReferenceFromSearchParams(params)).toBe('pesapal-order-123');
    expect(getCheckoutProviderFromSearchParams(params)).toBe('pesapal');
  });
});
