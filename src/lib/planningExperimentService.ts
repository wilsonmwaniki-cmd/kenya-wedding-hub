import { supabase } from '@/integrations/supabase/client';
import {
  buildNextActions,
  buildPlanningRecommendations,
  toSimplePlanningCategory,
  type PlanningAction,
  type PlanningInput,
  type PlanningTaskState,
} from '@/lib/planningExperiment';
import { getPendingEstimatorPlanDraft } from '@/lib/estimatorPlanSeed';

export const PLANNING_EXPERIMENT_TASK_SOURCE = 'planning_experiment_v1';

export type StoredPlanningExperiment = {
  input: PlanningInput;
  budgetRows: Array<{ id: string; name: string; allocated: number }>;
  tasks: PlanningTaskState[];
  primaryNextAction: PlanningAction;
  secondaryActions: PlanningAction[];
};

export async function loadPlanningExperimentStarter({
  weddingId,
  userId,
  userMetadata,
}: {
  weddingId: string;
  userId: string;
  userMetadata?: Record<string, unknown> | null;
}): Promise<PlanningInput> {
  // The generated database types are refreshed after the staging migration is finalized.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const pendingDraft = getPendingEstimatorPlanDraft(userMetadata);
  const [weddingResult, profileResult, budgetResult, vendorResult] = await Promise.all([
    db.from('weddings').select('wedding_date').eq('id', weddingId).maybeSingle(),
    db.from('profiles').select('wedding_date, wedding_budget_goal, expected_guest_count').eq('user_id', userId).maybeSingle(),
    db.from('budget_categories').select('allocated').eq('wedding_id', weddingId).eq('budget_scope', 'wedding'),
    db.from('vendors').select('category').eq('wedding_id', weddingId).or('selection_status.eq.final,status.eq.booked'),
  ]);

  for (const result of [weddingResult, profileResult, budgetResult, vendorResult]) {
    if (result.error) throw result.error;
  }

  const allocatedBudget = (budgetResult.data ?? []).reduce(
    (total: number, row: { allocated?: number | string | null }) => total + Number(row.allocated ?? 0),
    0,
  );
  const storedBudget = Number(profileResult.data?.wedding_budget_goal ?? 0);
  const storedGuests = Number(profileResult.data?.expected_guest_count ?? 0);
  const bookedCategories = [...new Set((vendorResult.data ?? [])
    .map((row: { category?: string | null }) => row.category)
    .filter((value: string | null | undefined): value is string => Boolean(value))
    .map(toSimplePlanningCategory))];

  return {
    weddingDate: weddingResult.data?.wedding_date ?? profileResult.data?.wedding_date ?? '',
    estimatedBudget: pendingDraft?.totalBudget ?? (storedBudget > 0 ? storedBudget : allocatedBudget),
    estimatedGuestCount: pendingDraft?.guestCount ?? (storedGuests > 0 ? storedGuests : 0),
    weddingType: pendingDraft?.weddingStyle === 'garden' ? 'garden' : 'church',
    priorities: [],
    bookedCategories,
  };
}

function asAction(value: unknown, fallback: PlanningAction): PlanningAction {
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Record<string, unknown>;
  return {
    title: typeof candidate.title === 'string' ? candidate.title : fallback.title,
    detail: typeof candidate.detail === 'string' ? candidate.detail : fallback.detail,
    taskKey: typeof candidate.taskKey === 'string' ? candidate.taskKey : undefined,
  };
}

export async function loadPlanningExperiment(
  weddingId: string,
  userId?: string,
): Promise<StoredPlanningExperiment | null> {
  // The generated database types are refreshed after the staging migration is finalized.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const [profileResult, accountProfileResult, weddingResult, budgetResult, taskResult, vendorResult] = await Promise.all([
    db.from('wedding_planning_profiles').select('*').eq('wedding_id', weddingId).maybeSingle(),
    userId
      ? db.from('profiles').select('wedding_budget_goal, expected_guest_count').eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db.from('weddings').select('wedding_date').eq('id', weddingId).maybeSingle(),
    db.from('budget_categories').select('id, name, allocated').eq('wedding_id', weddingId).eq('budget_scope', 'wedding').order('created_at'),
    db.from('tasks').select('id, title, category, completed, priority_level, template_key').eq('wedding_id', weddingId).eq('template_source', PLANNING_EXPERIMENT_TASK_SOURCE).order('priority_level').order('created_at'),
    db.from('vendors').select('category').eq('wedding_id', weddingId).or('selection_status.eq.final,status.eq.booked'),
  ]);

  for (const result of [profileResult, accountProfileResult, weddingResult, budgetResult, taskResult, vendorResult]) {
    if (result.error) throw result.error;
  }
  if (!profileResult.data) return null;

  const storedBookedCategories = Array.isArray(profileResult.data.booked_categories)
    ? profileResult.data.booked_categories.filter((value: unknown): value is string => typeof value === 'string')
    : [];
  const vendorBookedCategories = (vendorResult.data ?? [])
    .map((row: { category?: string | null }) => row.category)
    .filter((value: string | null | undefined): value is string => Boolean(value));
  const bookedCategories = [...new Set([...storedBookedCategories, ...vendorBookedCategories])];
  const tasks: PlanningTaskState[] = (taskResult.data ?? []).map((row: Record<string, unknown>, index: number) => ({
    id: String(row.id),
    key: typeof row.template_key === 'string' ? row.template_key : `task-${index + 1}`,
    title: String(row.title ?? 'Planning task'),
    category: String(row.category ?? 'Planning'),
    completed: Boolean(row.completed),
    priorityLevel: Number(row.priority_level ?? index + 1),
  }));
  const actions = buildNextActions(tasks, bookedCategories);
  const accountBudget = Number(accountProfileResult.data?.wedding_budget_goal ?? 0);
  const accountGuests = Number(accountProfileResult.data?.expected_guest_count ?? 0);
  const estimatedBudget = accountBudget > 0
    ? accountBudget
    : Number(profileResult.data.estimated_budget ?? 0);
  const estimatedGuestCount = accountGuests > 0
    ? accountGuests
    : Number(profileResult.data.estimated_guest_count ?? 0);

  if (
    JSON.stringify(profileResult.data.primary_next_action ?? {}) !== JSON.stringify(actions.primaryNextAction)
    || JSON.stringify(profileResult.data.secondary_actions ?? []) !== JSON.stringify(actions.secondaryActions)
    || JSON.stringify(storedBookedCategories) !== JSON.stringify(bookedCategories)
    || Number(profileResult.data.estimated_budget ?? 0) !== estimatedBudget
    || Number(profileResult.data.estimated_guest_count ?? 0) !== estimatedGuestCount
  ) {
    const { error } = await db.from('wedding_planning_profiles').update({
      estimated_budget: estimatedBudget,
      estimated_guest_count: estimatedGuestCount,
      booked_categories: bookedCategories,
      primary_next_action: actions.primaryNextAction,
      secondary_actions: actions.secondaryActions,
    }).eq('wedding_id', weddingId);
    if (error) throw error;
  }

  return {
    input: {
      weddingDate: weddingResult.data?.wedding_date ?? '',
      estimatedBudget,
      estimatedGuestCount,
      weddingType: String(profileResult.data.wedding_type ?? 'church'),
      priorities: Array.isArray(profileResult.data.top_priorities) ? profileResult.data.top_priorities : [],
      bookedCategories,
    },
    budgetRows: (budgetResult.data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      name: String(row.name),
      allocated: Number(row.allocated ?? 0),
    })),
    tasks,
    primaryNextAction: asAction(profileResult.data.primary_next_action, actions.primaryNextAction),
    secondaryActions: Array.isArray(profileResult.data.secondary_actions)
      ? profileResult.data.secondary_actions.slice(0, 3).map((action: unknown, index: number) => asAction(action, actions.secondaryActions[index] ?? actions.primaryNextAction))
      : actions.secondaryActions,
  };
}

export async function savePlanningExperiment({
  userId,
  weddingId,
  input,
}: {
  userId: string;
  weddingId: string;
  input: PlanningInput;
}): Promise<StoredPlanningExperiment> {
  // The generated database types are refreshed after the staging migration is finalized.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const recommendations = buildPlanningRecommendations(input);
  const { data: existingTasks, error: taskReadError } = await db.from('tasks')
    .select('id, template_key, completed')
    .eq('wedding_id', weddingId)
    .eq('template_source', PLANNING_EXPERIMENT_TASK_SOURCE);
  if (taskReadError) throw taskReadError;

  const existingByKey = new Map<string, { id: string; completed: boolean }>(
    (existingTasks ?? []).map((row: Record<string, unknown>) => [
      String(row.template_key ?? ''),
      { id: String(row.id), completed: Boolean(row.completed) },
    ]),
  );
  const tasks = recommendations.tasks.map((task) => ({
    ...task,
    completed: existingByKey.get(task.key)?.completed ?? false,
  }));
  const actions = buildNextActions(tasks, input.bookedCategories);

  const { error: saveError } = await db.rpc('save_planning_experiment', {
    wedding_id_input: weddingId,
    wedding_date_input: input.weddingDate,
    estimated_budget_input: input.estimatedBudget,
    estimated_guest_count_input: input.estimatedGuestCount,
    wedding_type_input: input.weddingType,
    top_priorities_input: input.priorities,
    booked_categories_input: input.bookedCategories,
    primary_next_action_input: actions.primaryNextAction,
    secondary_actions_input: actions.secondaryActions,
    budget_rows_input: recommendations.budgetRows.map((row) => ({
      name: row.name,
      allocated: row.allocated,
      suggested_percentage: row.suggestedPercentage,
    })),
    tasks_input: tasks.map((task) => ({
      key: task.key,
      title: task.title,
      category: task.category,
      priority_level: task.priorityLevel,
      completed: task.completed,
    })),
  });
  if (saveError) throw saveError;

  const saved = await loadPlanningExperiment(weddingId, userId);
  if (!saved) throw new Error('Zania built the plan but could not load it again.');
  return saved;
}

export async function recalculatePlanningExperiment(
  weddingId: string,
  overrides: Partial<PlanningInput> = {},
): Promise<StoredPlanningExperiment | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Sign in again to update your plan.');
  const current = await loadPlanningExperiment(weddingId, authData.user.id);
  if (!current) return null;

  return savePlanningExperiment({
    userId: authData.user.id,
    weddingId,
    input: { ...current.input, ...overrides },
  });
}

export async function setPlanningTaskCompleted({
  weddingId,
  taskId,
  completed,
  tasks,
  bookedCategories,
}: {
  weddingId: string;
  taskId: string;
  completed: boolean;
  tasks: PlanningTaskState[];
  bookedCategories: string[];
}) {
  // The generated database types are refreshed after the staging migration is finalized.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { error } = await db.from('tasks').update({ completed }).eq('id', taskId).eq('wedding_id', weddingId);
  if (error) throw error;
  const nextTasks = tasks.map((task) => task.id === taskId ? { ...task, completed } : task);
  const actions = buildNextActions(nextTasks, bookedCategories);
  const { error: actionError } = await db.from('wedding_planning_profiles').update({
    primary_next_action: actions.primaryNextAction,
    secondary_actions: actions.secondaryActions,
  }).eq('wedding_id', weddingId);
  if (actionError) throw actionError;
  return { tasks: nextTasks, ...actions };
}
