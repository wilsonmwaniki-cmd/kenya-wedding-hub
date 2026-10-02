import { vendorCategoryCatalog } from '@/lib/vendorCategories';

export interface PersonalBudgetTemplate {
  name: string;
  visibility: 'private';
}

export const personalBudgetTemplates: PersonalBudgetTemplate[] = vendorCategoryCatalog
  .filter((category) => category.scope === 'personal')
  .map((category) => ({ name: category.name, visibility: 'private' }));
