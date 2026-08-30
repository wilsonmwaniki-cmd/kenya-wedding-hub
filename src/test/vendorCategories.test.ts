import { describe, expect, it } from 'vitest';

import {
  canonicalizeVendorCategory,
  getVendorCategoryOptions,
  getVendorCategoryScope,
  isVendorCategory,
  vendorCategoriesMatch,
  vendorCategoryCatalog,
} from '@/lib/vendorCategories';
import { weddingBudgetTemplates } from '@/lib/weddingBudgetTemplates';
import { personalBudgetTemplates } from '@/lib/personalBudgetTemplates';
import { buildInteractiveBudgetPlan } from '@/lib/interactiveBudgetPlan';

describe('vendor category catalog', () => {
  it('contains the spreadsheet vendor categories without the task-only row', () => {
    expect(vendorCategoryCatalog).toHaveLength(21);
    expect(vendorCategoryCatalog.some((category) => category.name === "Couple's Tasks")).toBe(false);
  });

  it('is the shared source for the estimator and both budget workspaces', () => {
    const canonicalNames = vendorCategoryCatalog.map((category) => category.name);
    const budgetTemplateNames = [
      ...weddingBudgetTemplates.map((category) => category.name),
      ...personalBudgetTemplates.map((category) => category.name),
    ];
    const estimatorNames = buildInteractiveBudgetPlan(1_500_000, 120)
      .allocations
      .map((category) => category.name);

    expect(new Set(budgetTemplateNames)).toEqual(new Set(canonicalNames));
    expect(estimatorNames).toEqual(canonicalNames);
    expect(vendorCategoryCatalog.reduce((sum, category) => sum + category.suggestedPercentage, 0)).toBe(100);
  });

  it('retains each Wedding or Personal designation', () => {
    expect(getVendorCategoryScope('Wedding Venue')).toBe('wedding');
    expect(getVendorCategoryScope('Marriage Preparation')).toBe('personal');
    expect(getVendorCategoryScope('Rings')).toBe('personal');
    expect(getVendorCategoryScope("Bride's Make-up Artist")).toBe('personal');
    expect(getVendorCategoryScope('Photographer')).toBe('wedding');
  });

  it('maps existing short labels to canonical names', () => {
    expect(canonicalizeVendorCategory('Cake')).toBe('Cake Artist & Baker');
    expect(canonicalizeVendorCategory('Catering')).toBe('Caterer');
    expect(canonicalizeVendorCategory('MC')).toBe('Master of Ceremonies');
    expect(canonicalizeVendorCategory('Photography')).toBe('Photographer');
    expect(canonicalizeVendorCategory('Videography')).toBe('Cinematographer');
    expect(canonicalizeVendorCategory('Flowers')).toBe('Décor, Tents, Chairs, Tables');
    expect(canonicalizeVendorCategory('Accommodation')).toBe('Wedding Venue');
  });

  it('folds removed aliases into the catalog and keeps only unknown legacy records available', () => {
    expect(getVendorCategoryOptions().some((category) => category.name === 'Flowers')).toBe(false);
    expect(getVendorCategoryOptions('Flowers')).toEqual(vendorCategoryCatalog);
    expect(getVendorCategoryOptions('Other').at(-1)).toEqual({
      name: 'Other',
      scope: 'wedding',
      suggestedPercentage: 0,
    });
    expect(isVendorCategory('Flowers')).toBe(true);
    expect(isVendorCategory('Other')).toBe(false);
  });

  it('matches canonical categories to existing budget and vendor labels', () => {
    expect(vendorCategoriesMatch('Cake', 'Cake Artist & Baker')).toBe(true);
    expect(vendorCategoriesMatch('Wedding Bands', 'Rings')).toBe(true);
    expect(vendorCategoriesMatch('Bride Attire & Body Prep', 'Bridal Gown, Accessories, Preparation')).toBe(true);
    expect(vendorCategoriesMatch('Flowers', 'Décor, Tents, Chairs, Tables')).toBe(true);
  });
});
