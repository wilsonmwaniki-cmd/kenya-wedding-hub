import { describe, expect, it } from 'vitest';
import {
  getConfirmedVendorForTask,
  getRecordedVendorsForBudgetCategory,
  getRelatedTasksForVendor,
  getRelatedTasksForBudgetCategory,
  planningCategoryRelationScore,
} from '@/lib/budgetRelations';

const placeholderVendor = {
  id: 'placeholder',
  name: 'Photography shortlist',
  category: 'Photography',
  phone: null,
  email: null,
  price: null,
  vendor_listing_id: null,
  notes: 'Seeded from the estimator.',
};

describe('budget relationships', () => {
  it('does not show estimator placeholders as vendors', () => {
    expect(getRecordedVendorsForBudgetCategory('Photography', [placeholderVendor])).toEqual([]);
  });

  it('keeps real vendors in the matching budget category', () => {
    const realVendor = { ...placeholderVendor, id: 'real', name: 'Lens House Kenya' };
    expect(getRecordedVendorsForBudgetCategory('Photography', [realVendor])).toEqual([realVendor]);
  });

  it('does not attach vendors that only share a generic role word', () => {
    const cakeVendor = {
      ...placeholderVendor,
      id: 'keki-tamu',
      name: 'Keki Tamu',
      category: 'Cake Artist & Baker',
      selection_status: 'final',
    };

    expect(getRecordedVendorsForBudgetCategory("Bride's Make-up Artist", [cakeVendor])).toEqual([]);
    expect(getRecordedVendorsForBudgetCategory('Cake Artist & Baker', [cakeVendor])).toEqual([cakeVendor]);
  });

  it('matches common planning category vocabulary', () => {
    expect(planningCategoryRelationScore('Photography', 'Photographer')).toBeGreaterThan(0);
    expect(planningCategoryRelationScore('Videography', 'Cinematographer')).toBeGreaterThan(0);
    expect(planningCategoryRelationScore('MC', 'Master of Ceremonies')).toBeGreaterThan(0);
    expect(planningCategoryRelationScore('Marriage License / Legal Fees', 'Wedding Licenses')).toBeGreaterThan(0);
  });

  it('ranks direct vendor tasks first and also infers category-related tasks', () => {
    const vendor = { ...placeholderVendor, id: 'vendor-1', name: 'Lens House Kenya' };
    const tasks = [
      {
        id: 'category-task',
        title: 'Research photographers',
        description: null,
        category: 'Photographer',
        completed: false,
        source_vendor_id: null,
      },
      {
        id: 'vendor-task',
        title: 'Review the latest quote',
        description: null,
        category: null,
        completed: false,
        source_vendor_id: 'vendor-1',
      },
      {
        id: 'unrelated-task',
        title: 'Confirm the cake flavour',
        description: null,
        category: 'Cake Artist & Baker',
        completed: false,
        source_vendor_id: null,
      },
    ];

    expect(getRelatedTasksForBudgetCategory('Photography', tasks, [vendor]).map((task) => task.id)).toEqual([
      'vendor-task',
      'category-task',
    ]);
  });

  it('resolves an unlinked cake task to the confirmed cake vendor', () => {
    const vendor = {
      ...placeholderVendor,
      id: 'keki-tamu',
      name: 'Keki Tamu',
      category: 'Cake',
      selection_status: 'final',
    };
    const task = {
      id: 'book-cake',
      title: 'Lock in cake artist / baker with a deposit',
      description: null,
      category: 'Cake Artist & Baker',
      completed: false,
      source_vendor_id: null,
    };

    expect(getConfirmedVendorForTask(task, [vendor])).toEqual(vendor);
    expect(getRelatedTasksForVendor(vendor, [task])).toEqual([task]);
  });

  it('never replaces an explicit task vendor with a category match', () => {
    const confirmedVendor = {
      ...placeholderVendor,
      id: 'confirmed',
      name: 'Keki Tamu',
      category: 'Cake',
      selection_status: 'final',
    };
    const explicitVendor = { ...confirmedVendor, id: 'explicit', name: 'Another Baker' };
    const task = {
      id: 'book-cake',
      title: 'Lock in cake artist / baker',
      description: null,
      category: 'Cake Artist & Baker',
      completed: false,
      source_vendor_id: 'explicit',
    };

    expect(getConfirmedVendorForTask(task, [confirmedVendor, explicitVendor])).toEqual(explicitVendor);
    expect(getRelatedTasksForVendor(confirmedVendor, [task])).toEqual([]);
  });
});
