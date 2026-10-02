import { describe, expect, it } from 'vitest';
import { deduplicateVendorDirectory } from '@/lib/vendorDirectory';

describe('deduplicateVendorDirectory', () => {
  it('shows one business and prefers the listing connected to a professional account', () => {
    const results = deduplicateVendorDirectory([
      {
        id: 'legacy-one',
        business_name: 'Mwaniki Weddings',
        user_id: null,
        is_verified: false,
        profile_kind: 'claimed',
        updated_at: '2026-05-01',
      },
      {
        id: 'connected',
        business_name: 'Mwaniki Weddings',
        user_id: 'vendor-user',
        is_verified: false,
        profile_kind: 'claimed',
        updated_at: '2026-04-01',
      },
      {
        id: 'legacy-two',
        business_name: '  MWANIKI-WEDDINGS ',
        user_id: null,
        is_verified: false,
        profile_kind: 'claimed',
        updated_at: '2026-06-01',
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('connected');
  });

  it('keeps genuinely different businesses', () => {
    const results = deduplicateVendorDirectory([
      { id: 'one', business_name: 'Mwaniki Weddings', user_id: 'user-one' },
      { id: 'two', business_name: 'Mwaniki Events', user_id: 'user-two' },
    ]);

    expect(results.map((entry) => entry.id)).toEqual(['one', 'two']);
  });
});
