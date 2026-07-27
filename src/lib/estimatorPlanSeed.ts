import { supabase } from '@/integrations/supabase/client';
import { getPublicBudgetEstimate, type PublicBudgetEstimateRow } from '@/lib/publicBudgetEstimator';
import { personalBudgetTemplates } from '@/lib/personalBudgetTemplates';
import type { PlannerType } from '@/lib/roles';
import { buildSeededTasksFromTemplates } from '@/lib/weddingTaskTemplates';

export type EstimatorWeddingStyle = 'intimate' | 'classic' | 'luxury' | 'garden';
export type EstimatorVenueTier = 'budget' | 'mid_tier' | 'luxury';

export interface EstimatorPlanDraft {
  guestCount: number;
  county: string;
  weddingStyle: EstimatorWeddingStyle;
  venueTier: EstimatorVenueTier;
  totalBudget?: number;
  allocations?: Array<{
    name: string;
    amount: number;
    percentage: number;
    suggestedAmount?: number;
    suggestedPercentage?: number;
    isManuallyEdited?: boolean;
    lastEditedField?: 'amount' | 'percentage' | null;
  }>;
}

const estimatorWeddingStyles = new Set<EstimatorWeddingStyle>(['intimate', 'classic', 'luxury', 'garden']);
const estimatorVenueTiers = new Set<EstimatorVenueTier>(['budget', 'mid_tier', 'luxury']);
const ESTIMATOR_PLAN_METADATA_KEY = 'estimator_plan_draft';

interface SeedWeddingPlanInput {
  userId: string;
  clientId?: string | null;
  role?: string | null;
  plannerType?: PlannerType | null;
  draft: EstimatorPlanDraft;
}

interface SeedWeddingPlanResult {
  budgetCategoriesCreated: number;
  personalBudgetCategoriesCreated: number;
  vendorTemplatesCreated: number;
  tasksCreated: number;
}

const ESTIMATOR_PLAN_DRAFT_KEY = 'centerpiece-estimator-plan-draft';

const alwaysVendorCategories = ['Venue', 'Catering', 'Photography', 'Flowers', 'Décor', 'Transport'] as const;

const expandedVendorCategories = ['Videography', 'Music/DJ', 'MC', 'Cake'] as const;

function scopedQuery<T extends {
  is(column: string, value: null): T;
  eq(column: string, value: string): T;
}>(query: T, clientId?: string | null): T {
  if (!clientId) {
    return query.is('client_id', null);
  }
  return query.eq('client_id', clientId);
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

export function parseEstimatorPlanDraft(value: unknown): EstimatorPlanDraft | null {
  if (!value || typeof value !== 'object') return null;

  const parsed = value as Partial<EstimatorPlanDraft>;
  if (
    typeof parsed.guestCount !== 'number'
    || !Number.isFinite(parsed.guestCount)
    || parsed.guestCount <= 0
    || parsed.guestCount > 100_000
    || typeof parsed.county !== 'string'
    || parsed.county.length > 120
    || !estimatorWeddingStyles.has(parsed.weddingStyle as EstimatorWeddingStyle)
    || !estimatorVenueTiers.has(parsed.venueTier as EstimatorVenueTier)
    || (
      parsed.totalBudget !== undefined
      && (
        typeof parsed.totalBudget !== 'number'
        || !Number.isFinite(parsed.totalBudget)
        || parsed.totalBudget <= 0
        || parsed.totalBudget > 1_000_000_000_000
      )
    )
  ) {
    return null;
  }

  if (parsed.allocations !== undefined && (!Array.isArray(parsed.allocations) || parsed.allocations.length > 50)) {
    return null;
  }

  const allocations = Array.isArray(parsed.allocations)
    ? parsed.allocations.filter((allocation) => (
        typeof allocation?.name === 'string'
        && allocation.name.trim().length > 0
        && allocation.name.length <= 120
        && typeof allocation.amount === 'number'
        && Number.isFinite(allocation.amount)
        && allocation.amount >= 0
        && allocation.amount <= 1_000_000_000_000
        && typeof allocation.percentage === 'number'
        && Number.isFinite(allocation.percentage)
        && allocation.percentage >= 0
        && allocation.percentage <= 10_000
        && (allocation.suggestedAmount === undefined || (
          typeof allocation.suggestedAmount === 'number'
          && Number.isFinite(allocation.suggestedAmount)
          && allocation.suggestedAmount >= 0
          && allocation.suggestedAmount <= 1_000_000_000_000
        ))
        && (allocation.suggestedPercentage === undefined || (
          typeof allocation.suggestedPercentage === 'number'
          && Number.isFinite(allocation.suggestedPercentage)
          && allocation.suggestedPercentage >= 0
          && allocation.suggestedPercentage <= 10_000
        ))
        && (allocation.isManuallyEdited === undefined || typeof allocation.isManuallyEdited === 'boolean')
        && (
          allocation.lastEditedField === undefined
          || allocation.lastEditedField === null
          || allocation.lastEditedField === 'amount'
          || allocation.lastEditedField === 'percentage'
        )
      ))
    : undefined;

  if (allocations?.length !== parsed.allocations?.length) return null;

  return {
    guestCount: parsed.guestCount,
    county: parsed.county,
    weddingStyle: parsed.weddingStyle as EstimatorWeddingStyle,
    venueTier: parsed.venueTier as EstimatorVenueTier,
    totalBudget: parsed.totalBudget,
    allocations,
  };
}

export function getEstimatorPlanDraft(): EstimatorPlanDraft | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(ESTIMATOR_PLAN_DRAFT_KEY);
  if (!raw) return null;

  try {
    return parseEstimatorPlanDraft(JSON.parse(raw));
  } catch {
    // Ignore malformed local state.
  }

  return null;
}

export function getEstimatorPlanDraftFromUserMetadata(
  userMetadata: Record<string, unknown> | null | undefined,
) {
  return parseEstimatorPlanDraft(userMetadata?.[ESTIMATOR_PLAN_METADATA_KEY]);
}

export function getPendingEstimatorPlanDraft(
  userMetadata?: Record<string, unknown> | null,
) {
  return getEstimatorPlanDraft() ?? getEstimatorPlanDraftFromUserMetadata(userMetadata);
}

export function hasPendingEstimatorPlanDraft(userMetadata?: Record<string, unknown> | null) {
  return Boolean(getPendingEstimatorPlanDraft(userMetadata));
}

export function clearEstimatorPlanDraft() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ESTIMATOR_PLAN_DRAFT_KEY);
}

export function canSeedEstimatorPlan(role: string | null | undefined, plannerType?: PlannerType | null) {
  if (role === 'couple') return true;
  return role === 'planner' && plannerType === 'committee';
}

export function buildEstimatorRowsFromDraft(draft: EstimatorPlanDraft): PublicBudgetEstimateRow[] | null {
  if (!draft.allocations?.length) return null;

  return draft.allocations.map((allocation) => ({
    category: allocation.name,
    source: 'couple_plan',
    sample_size: 0,
    benchmark_visible: false,
    suggested_amount: allocation.amount,
    low_amount: allocation.amount,
    high_amount: allocation.amount,
  }));
}

export async function seedWeddingPlanFromEstimator({
  userId,
  clientId = null,
  role = null,
  plannerType = null,
  draft,
}: SeedWeddingPlanInput): Promise<SeedWeddingPlanResult> {
  const estimateRows: PublicBudgetEstimateRow[] = buildEstimatorRowsFromDraft(draft)
    ?? await getPublicBudgetEstimate({
        guestCount: draft.guestCount,
        county: draft.county.trim() || null,
        weddingStyle: draft.weddingStyle,
        venueTier: draft.venueTier,
        minSampleSize: 5,
      });

  const vendorCategories = buildVendorCategories(draft, estimateRows);
  const [existingBudgetRes, existingVendorRes, existingTaskRes, profileRes, clientRes, weddingRes] = await Promise.all([
    scopedQuery(
      supabase.from('budget_categories').select('name, budget_scope').eq('user_id', userId),
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
    supabase.from('profiles').select('wedding_location, wedding_date, created_at').eq('user_id', userId).maybeSingle(),
    clientId
      ? supabase.from('planner_clients').select('wedding_date, created_at, wedding_id').eq('id', clientId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    clientId
      ? Promise.resolve({ data: null, error: null })
      : supabase
          .from('weddings')
          .select('id, wedding_date, created_at')
          .eq('created_by_user_id', userId)
          .eq('status', 'active')
          .is('deleted_at', null)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
  ]);

  if (existingBudgetRes.error) throw existingBudgetRes.error;
  if (existingVendorRes.error) throw existingVendorRes.error;
  if (existingTaskRes.error) throw existingTaskRes.error;
  if (profileRes.error) throw profileRes.error;
  if (clientRes.error) throw clientRes.error;
  if (weddingRes.error) throw weddingRes.error;

  const existingWeddingBudgetNames = new Set(
    (existingBudgetRes.data ?? [])
      .filter((item) => (item.budget_scope ?? 'wedding') === 'wedding')
      .map((item) => item.name),
  );
  const existingPersonalBudgetNames = new Set(
    (existingBudgetRes.data ?? [])
      .filter((item) => item.budget_scope === 'personal')
      .map((item) => item.name),
  );
  const existingVendorKeys = new Set((existingVendorRes.data ?? []).map((item) => `${item.category}::${item.name}`));
  const existingTaskTitles = new Set((existingTaskRes.data ?? []).map((item) => item.title));
  const seededWeddingDate = clientRes.data?.wedding_date
    ?? weddingRes.data?.wedding_date
    ?? profileRes.data?.wedding_date
    ?? null;
  const scheduleAnchorDate = (
    clientRes.data?.created_at
    ?? weddingRes.data?.created_at
    ?? profileRes.data?.created_at
    ?? new Date().toISOString()
  ).slice(0, 10);
  const weddingId = clientRes.data?.wedding_id ?? weddingRes.data?.id ?? null;
  const starterTasks = buildSeededTasksFromTemplates({
    vendorCategories,
    role,
    plannerType,
    weddingDate: seededWeddingDate,
    planningStartDate: scheduleAnchorDate,
  });

  const budgetInserts = estimateRows
    .filter((row) => !existingWeddingBudgetNames.has(row.category))
    .map((row) => ({
      user_id: userId,
      client_id: clientId,
      name: row.category,
      allocated: row.suggested_amount,
      suggested_allocated:
        draft.allocations?.find((allocation) => allocation.name === row.category)?.suggestedAmount
        ?? row.suggested_amount,
      suggested_percentage:
        draft.allocations?.find((allocation) => allocation.name === row.category)?.suggestedPercentage
        ?? (draft.totalBudget ? (row.suggested_amount / draft.totalBudget) * 100 : 0),
      allocation_manually_edited:
        draft.allocations?.find((allocation) => allocation.name === row.category)?.isManuallyEdited
        ?? false,
      allocation_last_edited_field:
        draft.allocations?.find((allocation) => allocation.name === row.category)?.lastEditedField
        ?? null,
      spent: 0,
      budget_scope: 'wedding',
      visibility: 'public',
    }));

  const shouldSeedPersonalBudget = role === 'couple' || plannerType === 'committee';
  const personalBudgetInserts = shouldSeedPersonalBudget
    ? personalBudgetTemplates
        .filter((template) => !existingPersonalBudgetNames.has(template.name))
        .map((template) => ({
          user_id: userId,
          client_id: null,
          name: template.name,
          allocated: 0,
          spent: 0,
          budget_scope: 'personal',
          visibility: template.visibility,
        }))
    : [];

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
      wedding_id: weddingId,
    }));

  if (budgetInserts.length) {
    const { error } = await supabase.from('budget_categories').insert(budgetInserts);
    if (error) throw error;
  }

  if (personalBudgetInserts.length) {
    const { error } = await supabase.from('budget_categories').insert(personalBudgetInserts);
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

  if (draft.totalBudget != null) {
    if (clientId) {
      const { error } = await supabase
        .from('planner_clients')
        .update({ wedding_budget_goal: draft.totalBudget })
        .eq('id', clientId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('profiles')
        .update({ wedding_budget_goal: draft.totalBudget })
        .eq('user_id', userId);
      if (error) throw error;
    }
  }

  return {
    budgetCategoriesCreated: budgetInserts.length,
    personalBudgetCategoriesCreated: personalBudgetInserts.length,
    vendorTemplatesCreated: vendorInserts.length,
    tasksCreated: taskInserts.length,
  };
}

export async function seedPendingEstimatorPlanForUser({
  userId,
  plannerType = null,
  role,
  userMetadata = null,
}: {
  userId: string;
  role: string | null | undefined;
  plannerType?: PlannerType | null;
  userMetadata?: Record<string, unknown> | null;
}) {
  const draft = getPendingEstimatorPlanDraft(userMetadata);
  if (!draft) return null;
  if (!canSeedEstimatorPlan(role, plannerType)) return null;

  const result = await seedWeddingPlanFromEstimator({
    userId,
    role,
    plannerType,
    draft,
  });

  clearEstimatorPlanDraft();
  if (userMetadata?.[ESTIMATOR_PLAN_METADATA_KEY]) {
    const { error } = await supabase.auth.updateUser({
      data: { [ESTIMATOR_PLAN_METADATA_KEY]: null },
    });
    if (error) {
      console.warn('Estimator plan was seeded, but its account handoff metadata could not be cleared.', error);
    }
  }
  return result;
}
