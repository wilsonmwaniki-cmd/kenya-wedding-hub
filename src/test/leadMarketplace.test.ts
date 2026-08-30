import { describe, expect, it } from 'vitest';
import { formatLeadBudgetRange } from '@/lib/leadMarketplace';
import { canonicalizeVendorCategory } from '@/lib/vendorCategories';
import { resolveLeadMarketplaceEnabled } from '@/lib/featureFlags';

describe('lead marketplace formatting', () => {
  it('uses canonical vendor categories for matching', () => {
    expect(canonicalizeVendorCategory('Photography')).toBe('Photographer');
    expect(canonicalizeVendorCategory('MC')).toBe('Master of Ceremonies');
  });

  it('shows a range instead of an exact budget', () => {
    expect(formatLeadBudgetRange({ budget_min_kes: 150000, budget_max_kes: 200000 }))
      .toBe('KES 150,000–200,000');
  });

  it('does not invent a budget when one is unavailable', () => {
    expect(formatLeadBudgetRange({ budget_min_kes: null, budget_max_kes: null }))
      .toBe('Budget not set');
  });

  it('stays off unless the staging flag is explicitly enabled', () => {
    expect(resolveLeadMarketplaceEnabled()).toBe(false);
    expect(resolveLeadMarketplaceEnabled('false')).toBe(false);
    expect(resolveLeadMarketplaceEnabled('true')).toBe(true);
  });
});
