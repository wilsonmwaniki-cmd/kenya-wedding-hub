import { hasRecordedVendor, type VendorAttachmentCandidate } from '@/lib/vendorSelection';

type RelatedVendor = VendorAttachmentCandidate & {
  id: string;
  category?: string | null;
  selection_status?: string | null;
  status?: string | null;
};

type RelatedTask = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  completed: boolean;
  source_vendor_id?: string | null;
};

const categoryConcepts = [
  ['venue', 'wedding venue', 'reception venue', 'ceremony venue', 'photo shoot venue'],
  ['cake', 'cake artist', 'baker', 'bakery'],
  ['catering', 'caterer', 'food', 'menu'],
  ['decor', 'decorator', 'tent', 'chair', 'table', 'setup', 'rental'],
  ['flower', 'flowers', 'florist', 'floral'],
  ['photography', 'photographer'],
  ['videography', 'videographer', 'cinematography', 'cinematographer', 'video'],
  ['music', 'dj', 'band', 'sound'],
  ['mc', 'emcee', 'master of ceremonies'],
  ['officiant', 'officiating minister', 'church'],
  ['marriage license', 'wedding license', 'legal fee', 'permit'],
  ['stationery', 'invitation', 'invitation card'],
  ['transport', 'vehicle', 'transfer'],
  ['security', 'security team'],
  ['bridal party', 'bridesmaid', 'groomsman'],
  ['guest experience', 'usher', 'guest service'],
] as const;

const ignoredWords = new Set([
  'and',
  'for',
  'fees',
  'other',
  'shortlist',
  'vendor',
  'wedding',
]);

function normalizeRelationText(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function relationTokens(value: string) {
  return value
    .split(' ')
    .filter((word) => word.length >= 3 && !ignoredWords.has(word))
    .map((word) => word.replace(/(ing|ers|er|or|ist|ies|s)$/u, ''))
    .filter((word) => word.length >= 3);
}

function conceptIndexes(value: string) {
  const indexes = new Set<number>();

  categoryConcepts.forEach((terms, index) => {
    if (terms.some((term) => value.includes(normalizeRelationText(term)))) indexes.add(index);
  });

  return indexes;
}

export function planningCategoryRelationScore(categoryName: string, candidate?: string | null) {
  const category = normalizeRelationText(categoryName);
  const value = normalizeRelationText(candidate);
  if (!category || !value) return 0;
  if (category === value) return 100;

  const categoryConceptIndexes = conceptIndexes(category);
  const valueConceptIndexes = conceptIndexes(value);
  if ([...categoryConceptIndexes].some((index) => valueConceptIndexes.has(index))) return 85;

  if (
    (category.length >= 4 && value.includes(category))
    || (value.length >= 4 && category.includes(value))
  ) return 70;

  const categoryTokens = new Set(relationTokens(category));
  const sharedTokens = relationTokens(value).filter((token) => categoryTokens.has(token));
  return sharedTokens.length > 0 ? 45 + Math.min(sharedTokens.length * 5, 15) : 0;
}

export function getRecordedVendorsForBudgetCategory<T extends RelatedVendor>(categoryName: string, vendors: T[]) {
  return vendors.filter(
    (vendor) => hasRecordedVendor(vendor) && planningCategoryRelationScore(categoryName, vendor.category) > 0,
  );
}

export function getRelatedTasksForBudgetCategory<T extends RelatedTask>(
  categoryName: string,
  tasks: T[],
  vendors: RelatedVendor[],
) {
  const relatedVendorIds = new Set(
    getRecordedVendorsForBudgetCategory(categoryName, vendors).map((vendor) => vendor.id),
  );

  return tasks
    .map((task) => {
      const directVendorMatch = Boolean(task.source_vendor_id && relatedVendorIds.has(task.source_vendor_id));
      const categoryScore = planningCategoryRelationScore(categoryName, task.category);
      const titleScore = planningCategoryRelationScore(categoryName, task.title);
      const descriptionScore = planningCategoryRelationScore(categoryName, task.description);
      const score = directVendorMatch
        ? 400
        : Math.max(categoryScore * 3, titleScore * 2, descriptionScore);

      return { task, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) =>
      Number(left.task.completed) - Number(right.task.completed)
      || right.score - left.score
      || left.task.title.localeCompare(right.task.title),
    )
    .map(({ task }) => task);
}

export function getRelatedTasksForVendor<T extends RelatedTask>(vendor: RelatedVendor, tasks: T[]) {
  return tasks
    .map((task) => {
      if (task.source_vendor_id && task.source_vendor_id !== vendor.id) return { task, score: 0 };
      if (task.source_vendor_id === vendor.id) return { task, score: 400 };

      const score = Math.max(
        planningCategoryRelationScore(vendor.category ?? '', task.category) * 3,
        planningCategoryRelationScore(vendor.category ?? '', task.title) * 2,
        planningCategoryRelationScore(vendor.category ?? '', task.description),
      );
      return { task, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) =>
      Number(left.task.completed) - Number(right.task.completed)
      || right.score - left.score
      || left.task.title.localeCompare(right.task.title),
    )
    .map(({ task }) => task);
}

export function getConfirmedVendorForTask<T extends RelatedVendor>(task: RelatedTask, vendors: T[]) {
  if (task.source_vendor_id) {
    return vendors.find((vendor) => vendor.id === task.source_vendor_id) ?? null;
  }

  const matches = vendors
    .filter((vendor) => hasRecordedVendor(vendor) && vendor.selection_status === 'final')
    .map((vendor) => ({
      vendor,
      score: Math.max(
        planningCategoryRelationScore(vendor.category ?? '', task.category) * 3,
        planningCategoryRelationScore(vendor.category ?? '', task.title) * 2,
        planningCategoryRelationScore(vendor.category ?? '', task.description),
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.vendor.id.localeCompare(right.vendor.id));

  return matches[0]?.vendor ?? null;
}

export function getRelatedBudgetCategoryForTask<T extends { name: string }>(task: RelatedTask, categories: T[]) {
  const matches = categories
    .map((category) => ({
      category,
      score: Math.max(
        planningCategoryRelationScore(category.name, task.category) * 3,
        planningCategoryRelationScore(category.name, task.title) * 2,
        planningCategoryRelationScore(category.name, task.description),
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.category.name.localeCompare(right.category.name));

  return matches[0]?.category ?? null;
}
