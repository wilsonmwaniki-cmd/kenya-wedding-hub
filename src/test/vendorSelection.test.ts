import { describe, expect, it } from 'vitest';
import { hasRecordedVendor, isChosenVendor } from '@/lib/vendorSelection';

const placeholder = {
  name: 'Transport shortlist',
  category: 'Transport',
  phone: null,
  email: null,
  price: null,
  vendor_listing_id: null,
  notes: 'Seeded from the cost estimator. Use this card to track quotes.',
};

describe('vendor selection guards', () => {
  it('does not treat an empty estimator placeholder as a recorded vendor', () => {
    expect(hasRecordedVendor(placeholder)).toBe(false);
    expect(isChosenVendor({ ...placeholder, selection_status: 'final' })).toBe(false);
  });

  it('accepts a linked directory vendor', () => {
    expect(hasRecordedVendor({ ...placeholder, vendor_listing_id: 'listing-1' })).toBe(true);
  });

  it('accepts a manually named vendor', () => {
    expect(hasRecordedVendor({ ...placeholder, name: 'Swift Rides Kenya' })).toBe(true);
  });

  it('accepts a placeholder after real vendor details are recorded', () => {
    expect(hasRecordedVendor({ ...placeholder, phone: '+254700000000' })).toBe(true);
  });
});
