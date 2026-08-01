import { vendorCategoryCatalog } from '@/lib/vendorCategories';

export interface WeddingBudgetTemplate {
  name: string;
  visibility: 'public';
}

export const weddingBudgetTemplates: WeddingBudgetTemplate[] = vendorCategoryCatalog
  .filter((category) => category.scope === 'wedding')
  .map((category) => ({ name: category.name, visibility: 'public' }));
