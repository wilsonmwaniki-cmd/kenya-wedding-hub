import { describe, expect, it } from 'vitest';
import { parseVendorSearchPrompt } from '../../supabase/functions/_shared/vendorDiscovery';

describe('vendor discovery intent', () => {
  it('extracts service, location and compact KES budget', () => {
    expect(parseVendorSearchPrompt('Find me a photographer in Nairobi under KES 150k.')).toEqual({
      category: 'photographer',
      location: 'Nairobi',
      budgetMaxKes: 150000,
    });
  });

  it('extracts a budget range', () => {
    expect(parseVendorSearchPrompt('Recommend caterers near Kiambu between KES 200,000 and 350,000')).toEqual({
      category: 'caterer',
      location: 'Kiambu',
      budgetMinKes: 200000,
      budgetMaxKes: 350000,
    });
  });

  it('does not treat existing workspace summaries as discovery', () => {
    expect(parseVendorSearchPrompt('Show our vendors')).toBeNull();
    expect(parseVendorSearchPrompt('Which vendors are confirmed?')).toBeNull();
  });
});
