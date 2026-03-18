import { supabase } from '@/integrations/supabase/client';
import { getPublicBudgetEstimate, type PublicBudgetEstimateRow } from '@/lib/publicBudgetEstimator';
import type { PlannerType } from '@/lib/roles';
import { buildSeededTasksFromTemplates } from '@/lib/weddingTaskTemplates';

export type EstimatorWeddingStyle = 'intimate' | 'classic' | 'luxury' | 'garden';
export type EstimatorVenueTier = 'budget' | 'mid_tier' | 'luxury';

export interface EstimatorPlanDraft {
  guestCount: number;
  county: string;
  weddingStyle: EstimatorWeddingStyle;
  venueTier: EstimatorVenueTier;
}

interface SeedWeddingPlanInput {
  userId: string;
  clientId?: string | null;
  role?: string | null;
  plannerType?: PlannerType | null;
  draft: EstimatorPlanDraft;
}

interface SeedWeddingPlanResult {
  budgetCategoriesCreated: number;
  vendorTemplatesCreated: number;
  tasksCreated: number;
}

const ESTIMATOR_PLAN_DRAFT_KEY = 'centerpiece-estimator-plan-draft';

const alwaysVendorCategories = ['Venue', 'Catering', 'Photography', 'Flowers', 'Décor', 'Transport'] as const;

const expandedVendorCategories = ['Videography', 'Music/DJ', 'MC', 'Cake'] as const;

function scopedQuery<T>(query: T, clientId?: string | null) {
  if (!clientId) {
    return (query as any).is('client_id', null);
  }
  return (query as any).eq('client_id', clientId);
}

function normalizeVendorCategory(category: string): string | null {
  const normalized = category.toLowerCase().trim();

  if (normalized.includes('venue')) return 'Venue';
  if (normalized.includes('cater')) return 'Catering';
  if (normalized.includes('photo')) return 'Photography';
  if (normalized.includes('video')) return 'Videography';
  if (normalized.includes('flower') || normalized.includes('flor')) return 'Flowers';
  if (normalized.includes('decor')) return 'Décor';
  if (normalized.includes('music') || normalized.includes('dj') || normalized.includes('entertainment')) return 'Music/DJ';
  if (normalized.includes('transport')) return 'Transport';
  if (normalized === 'mc') return 'MC';
  if (normalized.includes('cake')) return 'Cake';

  return null;
}

function buildVendorCategories(draft: EstimatorPlanDraft, rows: PublicBudgetEstimateRow[]) {
  const seeded = new Set<string>(alwaysVendorCategories);

  if (draft.guestCount >= 80 || draft.weddingStyle !== 'intimate') {
    expandedVendorCategories.forEach((category) => seeded.add(category));
  }

  if (draft.weddingStyle === 'luxury' || draft.weddingStyle === 'garden') {
    seeded.add('Videography');
    seeded.add('Flowers');
  }

  rows.forEach((row) => {
    const mapped = normalizeVendorCategory(row.category);
    if (mapped) seeded.add(mapped);
  });

  return [...seeded];
}

function buildVendorPlaceholder(category: string, county: string) {
  return {
    name: `${category} shortlist`,
    category,
    phone: null,
    email: null,
    price: null,
    status: 'contacted',
    notes: `Seeded from the cost estimator. Use this card to track quotes, shortlists, and the final ${category.toLowerCase()} choice for your ${county} wedding.`,
  };
}

export function saveEstimatorPlanDraft(draft: EstimatorPlanDraft) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ESTIMATOR_PLAN_DRAFT_KEY, JSON.stringify(draft));
}

export function getEstimatorPlanDraft(): EstimatorPlanDraft | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(ESTIMATOR_PLAN_DRAFT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<EstimatorPlanDraft>;
    if (
      typeof parsed.guestCount === 'number' &&
      typeof parsed.county === 'string' &&
      typeof parsed.weddingStyle === 'string' &&
      typeof parsed.venueTier === 'string'
    ) {
      return parsed as EstimatorPlanDraft;
    }
  } catch {
    // Ignore malformed local state.
  }

  return null;
}

export function hasPendingEstimatorPlanDraft() {
  return Boolean(getEstimatorPlanDraft());
}

export function clearEstimatorPlanDraft() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ESTIMATOR_PLAN_DRAFT_KEY);
}

export function canSeedEstimatorPlan(role: string | null | undefined, plannerType?: PlannerType | null) {
  if (role === 'couple') return true;
  return role === 'planner' && plannerType === 'committee';
}

export async function seedWeddingPlanFromEstimator({
  userId,
  clientId = null,
  role = null,
  plannerType = null,
  draft,
}: SeedWeddingPlanInput): Promise<SeedWeddingPlanResult> {
  const estimateRows = await getPublicBudgetEstimate({
    guestCount: draft.guestCount,
    county: draft.county.trim() || null,
    weddingStyle: draft.weddingStyle,
    venueTier: draft.venueTier,
    minSampleSize: 5,
  });

  const vendorCategories = buildVendorCategories(draft, estimateRows);
  const [existingBudgetRes, existingVendorRes, existingTaskRes, profileRes, clientRes] = await Promise.all([
    scopedQuery(
      supabase.from('budget_categories').select('name').eq('user_id', userId),
      clientId,
    ),
    scopedQuery(
      supabase.from('vendors').select('name, category').eq('user_id', userId),
      clientId,
    ),
    scopedQuery(
      supabase.from('tasks').select('title').eq('user_id', userId),
      clientId,
    ),
    supabase.from('profiles').select('wedding_location, wedding_date').eq('user_id', userId).maybeSingle(),
    clientId
      ? supabase.from('planner_clients').select('wedding_date').eq('id', clientId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (existingBudgetRes.error) throw existingBudgetRes.error;
  if (existingVendorRes.error) throw existingVendorRes.error;
  if (existingTaskRes.error) throw existingTaskRes.error;
  if (profileRes.error) throw profileRes.error;
  if ((clientRes as any).error) throw (clientRes as any).error;

  const existingBudgetNames = new Set((existingBudgetRes.data ?? []).map((item) => item.name));
  const existingVendorKeys = new Set((existingVendorRes.data ?? []).map((item) => `${item.category}::${item.name}`));
  const existingTaskTitles = new Set((existingTaskRes.data ?? []).map((item) => item.title));
  const seededWeddingDate = ((clientRes as any).data?.wedding_date as string | null | undefined)
    ?? profileRes.data?.wedding_date
    ?? null;
  const starterTasks = buildSeededTasksFromTemplates({
    vendorCategories,
    role,
    plannerType,
    weddingDate: seededWeddingDate,
  });

  const budgetInserts = estimateRows
    .filter((row) => !existingBudgetNames.has(row.category))
    .map((row) => ({
      user_id: userId,
      client_id: clientId,
      name: row.category,
      allocated: row.suggested_amount,
      spent: 0,
    }));

  const vendorInserts = vendorCategories
    .map((category) => buildVendorPlaceholder(category, draft.county))
    .filter((row) => !existingVendorKeys.has(`${row.category}::${row.name}`))
    .map((row) => ({
      ...row,
      user_id: userId,
      client_id: clientId,
    }));

  const taskInserts = starterTasks
    .filter((task) => !existingTaskTitles.has(task.title))
    .map((task) => ({
      ...task,
      user_id: userId,
      client_id: clientId,
    }));

  if (budgetInserts.length) {
    const { error } = await supabase.from('budget_categories').insert(budgetInserts);
    if (error) throw error;
  }

  if (vendorInserts.length) {
    const { error } = await supabase.from('vendors').insert(vendorInserts);
    if (error) throw error;
  }

  if (taskInserts.length) {
    const { error } = await supabase.from('tasks').insert(taskInserts);
    if (error) throw error;
  }

  if (!profileRes.data?.wedding_location && draft.county.trim()) {
    await supabase
      .from('profiles')
      .update({ wedding_location: draft.county.trim() })
      .eq('user_id', userId);
  }

  return {
    budgetCategoriesCreated: budgetInserts.length,
    vendorTemplatesCreated: vendorInserts.length,
    tasksCreated: taskInserts.length,
  };
}

export async function seedPendingEstimatorPlanForUser({
  userId,
  plannerType = null,
  role,
}: {
  userId: string;
  role: string | null | undefined;
  plannerType?: PlannerType | null;
}) {
  const draft = getEstimatorPlanDraft();
  if (!draft) return null;
  if (!canSeedEstimatorPlan(role, plannerType)) return null;

  const result = await seedWeddingPlanFromEstimator({
    userId,
    role,
    plannerType,
    draft,
  });

  clearEstimatorPlanDraft();
  return result;
}
