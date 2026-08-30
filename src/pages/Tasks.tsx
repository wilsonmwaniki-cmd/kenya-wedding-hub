import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Download, Link2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { buildGoogleCalendarUrl } from '@/lib/googleCalendar';
import { createVendorTask } from '@/lib/vendorTasks';
import { vendorPaymentStatusLabel } from '@/lib/vendorPayments';
import { cn } from '@/lib/utils';
import { getSuggestedTaskTemplates, getTaskCategoryDefaults } from '@/lib/weddingTaskTemplates';
import { getEntitlementDecision, type EntitlementFeature } from '@/lib/entitlements';
import { useWeddingEntitlements } from '@/hooks/useWeddingEntitlements';
import { UpgradePromptDialog } from '@/components/UpgradePrompt';
import { downloadCsv, safeDateLabel } from '@/lib/exportHelpers';
import InlineAssistantCard from '@/components/InlineAssistantCard';
import { useInlineAssistant } from '@/hooks/useInlineAssistant';
import { submitPlannerChangeRequest } from '@/lib/plannerChangeRequests';
import { WorkspacePageSkeleton } from '@/components/AppLoadingSkeletons';
import { FormFieldError, FormSubmitError } from '@/components/FormFeedback';
import { buildConciergeContext } from '@/lib/conciergeContext';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ToastAction } from '@/components/ui/toast';
import { SlidingSegmentedControl } from '@/components/SlidingSegmentedControl';
import { AnimatedCardDetails } from '@/components/AnimatedCardDetails';
import { HierarchyGroup } from '@/components/HierarchyGroup';
import { getConfirmedVendorForTask, getRelatedBudgetCategoryForTask } from '@/lib/budgetRelations';
import { canonicalizeVendorCategory, vendorCategoriesMatch, vendorCategoryCatalog } from '@/lib/vendorCategories';
import { recalculatePlanningExperiment } from '@/lib/planningExperimentService';

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  category: string | null;
  assigned_to: string | null;
  source_vendor_id: string | null;
  phase: string | null;
  visibility: string;
  delegatable: boolean;
  recommended_role: string | null;
  priority_level: number | null;
  wedding_id: string | null;
}

interface VendorOption {
  id: string;
  name: string;
  category: string;
  selection_status: string;
  price: number | null;
  amount_paid: number;
  payment_status: string;
  payment_due_date: string | null;
  contract_status: string;
}

interface BudgetCategoryOption {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  budget_scope: 'wedding' | 'personal';
}

type TaskViewMode = 'by_date' | 'by_category' | 'completed';
type TaskPickerMode = 'suggested' | 'custom';
type TaskScopeFilter = 'all' | 'urgent' | 'vendor' | 'private' | 'shared';

function selectionLabel(status?: string | null) {
  switch (status) {
    case 'final':
      return 'Final';
    case 'backup':
      return 'Backup';
    case 'declined':
      return 'Declined';
    default:
      return 'Shortlisted';
  }
}

function phaseLabel(phase?: string | null) {
  switch (phase) {
    case 'foundation':
      return 'Foundation';
    case 'research':
      return 'Research';
    case 'selection_booking':
      return 'Selection & booking';
    case 'second_payment':
      return 'Second payment';
    case 'closure_final_payment':
      return 'Closure';
    default:
      return null;
  }
}

function normalizeCategory(value?: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function priorityLabel(priority?: number | null) {
  switch (priority) {
    case 1:
      return 'Critical';
    case 2:
      return 'High';
    case 3:
      return 'Medium';
    case 4:
      return 'Low';
    default:
      return null;
  }
}

function isUrgentTask(task: Task) {
  if (task.completed) return false;
  if (task.priority_level === 1) return true;
  if (!task.due_date) return false;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dueDate = new Date(task.due_date);
  dueDate.setHours(0, 0, 0, 0);
  const inThreeDays = new Date(now);
  inThreeDays.setDate(now.getDate() + 3);

  return dueDate <= inThreeDays;
}

function sortTasksByDateAndPriority(left: Task, right: Task) {
  const leftDue = left.due_date ? new Date(left.due_date).getTime() : Number.MAX_SAFE_INTEGER;
  const rightDue = right.due_date ? new Date(right.due_date).getTime() : Number.MAX_SAFE_INTEGER;
  if (leftDue !== rightDue) return leftDue - rightDue;

  const leftPriority = left.priority_level ?? 99;
  const rightPriority = right.priority_level ?? 99;
  if (leftPriority !== rightPriority) return leftPriority - rightPriority;

  return left.title.localeCompare(right.title);
}

function getTasksAssistantFeature(role?: string | null, plannerType?: string | null): EntitlementFeature {
  if (role === 'planner' && plannerType === 'committee') return 'committee.ai_assistant';
  if (role === 'planner') return 'planner.ai_assistant';
  return 'couple.ai_assistant';
}

interface TasksWorkspaceData {
  tasks: Task[];
  vendorOptions: VendorOption[];
  budgetCategories: BudgetCategoryOption[];
}

async function loadTasksWorkspace(dataOrFilter: string): Promise<TasksWorkspaceData> {
  const [tasksResult, vendorsResult, budgetsResult] = await Promise.all([
    supabase.from('tasks').select('*').or(dataOrFilter).order('due_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('vendors')
      .select('id, name, category, selection_status, price, amount_paid, payment_status, payment_due_date, contract_status')
      .or(dataOrFilter)
      .order('name'),
    supabase.from('budget_categories').select('id, name, allocated, spent, budget_scope').or(dataOrFilter).order('name'),
  ]);

  if (tasksResult.error) throw tasksResult.error;
  if (vendorsResult.error) throw vendorsResult.error;
  if (budgetsResult.error) throw budgetsResult.error;

  return {
    tasks: (tasksResult.data ?? []) as Task[],
    vendorOptions: ((vendorsResult.data ?? []) as any[]).map((vendor) => ({
      ...vendor,
      category: canonicalizeVendorCategory(vendor.category),
      price: vendor.price != null ? Number(vendor.price) : null,
      amount_paid: Number(vendor.amount_paid ?? 0),
    })) as VendorOption[],
    budgetCategories: ((budgetsResult.data ?? []) as any[]).map((category) => ({
      ...category,
      allocated: Number(category.allocated ?? 0),
      spent: Number(category.spent ?? 0),
    })) as BudgetCategoryOption[],
  };
}

export default function Tasks() {
  const { user, profile } = useAuth();
  const { isPlanner, selectedClient, dataOrFilter, plannerClientHydrating } = usePlanner();
  const { entitlements: weddingEntitlements, couplePlanTier } = useWeddingEntitlements();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();
  const plannerNeedsApproval = isPlanner && Boolean(selectedClient?.linked_user_id);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [taskCategory, setTaskCategory] = useState('none');
  const [taskTemplateKey, setTaskTemplateKey] = useState('none');
  const [taskPickerMode, setTaskPickerMode] = useState<TaskPickerMode>('custom');
  const [sourceVendorId, setSourceVendorId] = useState<string>('none');
  const [taskViewMode, setTaskViewMode] = useState<TaskViewMode>('by_date');
  const [taskScopeFilter, setTaskScopeFilter] = useState<TaskScopeFilter>('all');
  const [taskSearch, setTaskSearch] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [expandedTaskGroups, setExpandedTaskGroups] = useState<Record<string, boolean>>({});
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [exportUpgradeOpen, setExportUpgradeOpen] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(false);
  const [taskAdded, setTaskAdded] = useState(false);
  const taskSuccessTimerRef = useRef<number | null>(null);
  const [taskFormErrors, setTaskFormErrors] = useState<{ title?: string }>({});
  const [taskSubmitError, setTaskSubmitError] = useState<string | null>(null);
  const requestedTaskId = searchParams.get('task');

  const tasksQueryKey = ['tasks', user?.id ?? null, selectedClient?.id ?? null, dataOrFilter ?? null];
  const tasksQuery = useQuery({
    queryKey: tasksQueryKey,
    queryFn: () => loadTasksWorkspace(dataOrFilter!),
    enabled: Boolean(dataOrFilter),
    staleTime: 30_000,
  });

  useEffect(() => () => {
    if (taskSuccessTimerRef.current != null) window.clearTimeout(taskSuccessTimerRef.current);
  }, []);
  const tasks = tasksQuery.data?.tasks ?? [];
  const vendorOptions = tasksQuery.data?.vendorOptions ?? [];
  const budgetCategories = tasksQuery.data?.budgetCategories ?? [];

  useEffect(() => {
    if (isPlanner && !plannerClientHydrating && !selectedClient) navigate('/clients');
  }, [isPlanner, plannerClientHydrating, selectedClient, navigate]);

  const vendorLookup = useMemo(
    () => Object.fromEntries(vendorOptions.map((vendor) => [vendor.id, vendor])),
    [vendorOptions],
  );

  const budgetLookup = useMemo(
    () => Object.fromEntries(budgetCategories.map((category) => [normalizeCategory(category.name), category])),
    [budgetCategories],
  );

  const resolveTaskVendor = (task: Task) => getConfirmedVendorForTask(task, vendorOptions);
  const resolveTaskBudget = (task: Task) => {
    const exactCategory = task.category ? budgetLookup[normalizeCategory(task.category)] : null;
    return exactCategory ?? getRelatedBudgetCategoryForTask(task, budgetCategories);
  };

  const categoryOptions = useMemo(() => {
    const set = new Map<string, string>();
    vendorCategoryCatalog.forEach((category) => set.set(normalizeCategory(category.name), category.name));
    budgetCategories.forEach((category) => {
      const canonical = canonicalizeVendorCategory(category.name);
      if (!set.has(normalizeCategory(canonical))) set.set(normalizeCategory(category.name), category.name);
    });
    vendorOptions.forEach((vendor) => {
      const canonical = canonicalizeVendorCategory(vendor.category);
      if (!set.has(normalizeCategory(canonical))) {
        set.set(normalizeCategory(vendor.category), vendor.category);
      }
    });

    return [...set.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [budgetCategories, vendorOptions]);

  const selectedCategoryName = useMemo(() => {
    if (sourceVendorId !== 'none') {
      const linkedVendor = vendorLookup[sourceVendorId];
      if (linkedVendor?.category) return linkedVendor.category;
    }

    if (taskCategory !== 'none') {
      return categoryOptions.find((category) => category.value === taskCategory)?.label ?? null;
    }

    return null;
  }, [sourceVendorId, vendorLookup, taskCategory, categoryOptions]);

  const selectedCategoryDefaults = useMemo(() => {
    if (!selectedCategoryName) return null;
    return getTaskCategoryDefaults({
      category: selectedCategoryName,
      role: profile?.role,
      plannerType: profile?.planner_type,
    });
  }, [selectedCategoryName, profile?.role, profile?.planner_type]);

  const suggestedTaskOptions = useMemo(() => {
    if (!selectedCategoryName) return [];
    return getSuggestedTaskTemplates({
      category: selectedCategoryName,
      vendorCategories: vendorOptions.map((vendor) => vendor.category),
      role: profile?.role,
      plannerType: profile?.planner_type,
    });
  }, [selectedCategoryName, vendorOptions, profile?.role, profile?.planner_type]);

  const selectedTaskTemplate = useMemo(() => {
    if (taskTemplateKey === 'none') return null;
    return suggestedTaskOptions.find((template) => template.key === taskTemplateKey) ?? null;
  }, [taskTemplateKey, suggestedTaskOptions]);

  const applySuggestedTemplate = (templateKey: string) => {
    if (templateKey === 'none') {
      setTaskTemplateKey('none');
      setTaskPickerMode('custom');
      setTitle('');
      setDescription('');
      return;
    }

    const template = suggestedTaskOptions.find((option) => option.key === templateKey);
    if (!template) return;

    setTaskPickerMode('suggested');
    setTaskTemplateKey(template.key);
    setTitle(template.title);
    setDescription(template.description);
    if (!assignedTo && template.recommendedRole) {
      setAssignedTo(template.recommendedRole);
    }
  };

  const resolvedTaskDefaults = selectedTaskTemplate
    ? {
        visibility: selectedTaskTemplate.visibility,
        delegatable: selectedTaskTemplate.delegatable,
        recommendedRole: selectedTaskTemplate.recommendedRole,
        priorityLevel: selectedTaskTemplate.priorityLevel,
      }
    : selectedCategoryDefaults;

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setTaskSubmitError(null);
    if (!title.trim()) {
      setTaskFormErrors({ title: 'Pick a checklist task or type a custom title before saving.' });
      return;
    }
    setTaskFormErrors({});
    setSubmittingTask(true);

    const linkedVendor = sourceVendorId !== 'none' ? vendorLookup[sourceVendorId] : null;
    const categoryName = linkedVendor?.category ?? selectedCategoryName ?? null;

    try {
      if (plannerNeedsApproval && selectedClient?.linked_user_id) {
        await submitPlannerChangeRequest({
          clientId: selectedClient.id,
          coupleUserId: selectedClient.linked_user_id,
          plannerUserId: user.id,
          targetTable: 'tasks',
          changeType: 'create',
          proposedPayload: {
            title,
            description: description || null,
            due_date: dueDate || null,
            assigned_to: assignedTo || null,
            source_vendor_id: linkedVendor?.id ?? null,
            category: categoryName,
            phase: selectedTaskTemplate?.phase ?? null,
            visibility: resolvedTaskDefaults?.visibility ?? 'public',
            priority_level: resolvedTaskDefaults?.priorityLevel ?? null,
            delegatable: resolvedTaskDefaults?.delegatable ?? false,
            recommended_role: resolvedTaskDefaults?.recommendedRole ?? null,
            template_source: selectedTaskTemplate?.key ? 'planner_spreadsheet_picker_v1' : selectedCategoryDefaults ? 'manual_category_template_v1' : null,
            completed: false,
          },
        });
        toast({
          title: 'Task request sent for approval',
          description: 'The couple will review this task before it goes live.',
        });
      } else {
      await createVendorTask({
        userId: user.id,
        title,
        description,
        dueDate: dueDate || null,
        assignedTo: assignedTo || null,
        clientId: isPlanner && selectedClient ? selectedClient.id : null,
        sourceVendorId: linkedVendor?.id ?? null,
        category: categoryName,
        phase: selectedTaskTemplate?.phase ?? null,
        visibility: resolvedTaskDefaults?.visibility ?? 'public',
        priorityLevel: resolvedTaskDefaults?.priorityLevel ?? null,
        delegatable: resolvedTaskDefaults?.delegatable ?? false,
        recommendedRole: resolvedTaskDefaults?.recommendedRole ?? null,
        templateSource: selectedTaskTemplate?.key ? 'planner_spreadsheet_picker_v1' : selectedCategoryDefaults ? 'manual_category_template_v1' : null,
      });
      }
      await queryClient.invalidateQueries({ queryKey: tasksQueryKey });
      setTaskAdded(true);
      if (taskSuccessTimerRef.current != null) window.clearTimeout(taskSuccessTimerRef.current);
      taskSuccessTimerRef.current = window.setTimeout(() => {
        setTitle('');
        setDescription('');
        setDueDate('');
        setAssignedTo('');
        setTaskCategory('none');
        setTaskTemplateKey('none');
        setTaskPickerMode('custom');
        setSourceVendorId('none');
        setTaskAdded(false);
        setOpen(false);
      }, 700);
    } catch (error: any) {
      setTaskSubmitError(error.message || 'Could not save this task right now.');
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSubmittingTask(false);
    }
  };

  const toggleTask = async (id: string, completed: boolean) => {
    if (plannerNeedsApproval && selectedClient?.linked_user_id) {
      const task = tasks.find((row) => row.id === id);
      if (!task) return;
      await submitPlannerChangeRequest({
        clientId: selectedClient.id,
        coupleUserId: selectedClient.linked_user_id,
        plannerUserId: user!.id,
        targetTable: 'tasks',
        changeType: 'update',
        targetId: id,
        currentPayload: { completed },
        proposedPayload: { completed: !completed },
      });
      toast({
        title: 'Task status change sent for approval',
        description: `${task.title} will update after the couple approves it.`,
      });
      return;
    }
    const task = tasks.find((row) => row.id === id);
    if (!task) return;
    const nextCompleted = !completed;
    const { error } = await supabase.from('tasks').update({ completed: nextCompleted }).eq('id', id);
    if (error) {
      toast({ title: 'Could not update task', description: error.message, variant: 'destructive' });
      return;
    }

    if (task.wedding_id) {
      try {
        await recalculatePlanningExperiment(task.wedding_id);
      } catch (recalculationError) {
        toast({
          title: 'Task saved; plan refresh delayed',
          description: recalculationError instanceof Error ? recalculationError.message : 'Open Wedding Home to refresh your next steps.',
          variant: 'destructive',
        });
      }
    }

    queryClient.setQueryData<TasksWorkspaceData>(tasksQueryKey, (current) => current ? {
      ...current,
      tasks: current.tasks.map((row) => row.id === id ? { ...row, completed: nextCompleted } : row),
    } : current);

    if (nextCompleted) {
      toast({
        title: 'Task completed',
        description: task.title,
        variant: 'success',
        action: (
          <ToastAction
            altText={`Reopen ${task.title}`}
            onClick={async () => {
              const { error: undoError } = await supabase.from('tasks').update({ completed: false }).eq('id', id);
              if (undoError) {
                toast({ title: 'Could not reopen task', description: undoError.message, variant: 'destructive' });
                return;
              }
              if (task.wedding_id) await recalculatePlanningExperiment(task.wedding_id);
              await queryClient.invalidateQueries({ queryKey: tasksQueryKey });
              toast({ title: 'Task reopened', description: task.title, variant: 'info' });
            }}
          >
            Undo
          </ToastAction>
        ),
      });
    }

    await queryClient.invalidateQueries({ queryKey: tasksQueryKey });
  };

  const deleteTask = async (id: string) => {
    const task = tasks.find((row) => row.id === id);
    if (!task) return;

    if (plannerNeedsApproval && selectedClient?.linked_user_id) {
      await submitPlannerChangeRequest({
        clientId: selectedClient.id,
        coupleUserId: selectedClient.linked_user_id,
        plannerUserId: user!.id,
        targetTable: 'tasks',
        changeType: 'delete',
        targetId: id,
        currentPayload: task as unknown as Record<string, unknown>,
        proposedPayload: { title: task.title },
      });
      toast({
        title: 'Task removal sent for approval',
        description: `${task.title} will only be removed if the couple approves it.`,
      });
      return;
    }
    queryClient.setQueryData<TasksWorkspaceData>(tasksQueryKey, (current) => current ? {
      ...current,
      tasks: current.tasks.filter((row) => row.id !== id),
    } : current);
    const deletionTimer = window.setTimeout(async () => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) {
        await queryClient.invalidateQueries({ queryKey: tasksQueryKey });
        toast({ title: 'Could not remove task', description: error.message, variant: 'destructive' });
      }
    }, 5_500);

    toast({
      title: 'Task removed',
      description: task.title,
      variant: 'info',
      duration: 6_000,
      action: (
        <ToastAction
          altText={`Restore ${task.title}`}
          onClick={() => {
            window.clearTimeout(deletionTimer);
            queryClient.setQueryData<TasksWorkspaceData>(tasksQueryKey, (current) => current ? {
              ...current,
              tasks: [...current.tasks, task],
            } : current);
            setSelectedTaskId(task.id);
            toast({ title: 'Task restored', description: task.title, variant: 'success' });
          }}
        >
          Undo
        </ToastAction>
      ),
    });
  };

  const pending = tasks.filter((task) => !task.completed);
  const done = tasks
    .filter((task) => task.completed)
    .sort((left, right) => sortTasksByDateAndPriority(left, right));
  const urgentPending = pending.filter(isUrgentTask).sort(sortTasksByDateAndPriority);
  const scheduledPending = pending.filter((task) => !isUrgentTask(task)).sort(sortTasksByDateAndPriority);
  const vendorLinkedTasks = tasks.filter((task) => resolveTaskVendor(task));
  const openVendorTaskCount = vendorLinkedTasks.filter((task) => !task.completed).length;
  const privateTaskCount = pending.filter((task) => task.visibility === 'private').length;
  const calendarFeature = profile?.role === 'planner'
    ? profile?.planner_type === 'committee'
      ? 'committee.calendar_sync'
      : 'planner.calendar_sync'
    : 'couple.calendar_sync';
  const calendarDecision = getEntitlementDecision(calendarFeature, { profile, weddingEntitlements, couplePlanTier });
  const exportFeature = profile?.role === 'planner'
    ? profile?.planner_type === 'committee'
      ? 'committee.export_progress'
      : 'planner.export_progress'
    : 'couple.export_progress';
  const exportDecision = getEntitlementDecision(exportFeature, { profile, weddingEntitlements, couplePlanTier });
  const delegatedTaskCount = pending.filter((task) => task.delegatable).length;
  const vendorsWithOpenTasks = new Set(
    vendorLinkedTasks
      .filter((task) => !task.completed)
      .map((task) => resolveTaskVendor(task)?.id)
      .filter((vendorId): vendorId is string => Boolean(vendorId)),
  ).size;
  const dueSoonVendorTasks = vendorLinkedTasks.filter((task) => {
    if (task.completed || !task.due_date) return false;
    const due = new Date(task.due_date);
    const now = new Date();
    const inSevenDays = new Date();
    inSevenDays.setDate(now.getDate() + 7);
    return due >= now && due <= inSevenDays;
  }).length;
  const tasksAssistantFeature = useMemo(
    () => getTasksAssistantFeature(profile?.role, profile?.planner_type),
    [profile?.planner_type, profile?.role],
  );

  const overduePending = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return pending.filter((task) => {
      if (!task.due_date) return false;
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < now;
    }).sort(sortTasksByDateAndPriority);
  }, [pending]);

  const nextPendingTask = useMemo(
    () => pending.slice().sort(sortTasksByDateAndPriority)[0] ?? null,
    [pending],
  );

  const searchTerm = taskSearch.trim().toLowerCase();

  const taskMatchesWorkspaceFilters = (task: Task) => {
    if (searchTerm) {
      const linkedVendor = resolveTaskVendor(task);
      const searchBlob = [
        task.title,
        task.description,
        task.category,
        task.assigned_to,
        linkedVendor?.name,
        linkedVendor?.category,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!searchBlob.includes(searchTerm)) return false;
    }

    switch (taskScopeFilter) {
      case 'urgent':
        return isUrgentTask(task);
      case 'vendor':
        return Boolean(resolveTaskVendor(task));
      case 'private':
        return task.visibility === 'private';
      case 'shared':
        return task.visibility !== 'private';
      default:
        return true;
    }
  };

  const tasksPrompts = useMemo(() => {
    const prompts: string[] = [];

    if (overduePending.length > 0) {
      prompts.push('Look at our overdue tasks and turn them into a catch-up plan for this week.');
    }

    if (nextPendingTask?.category) {
      prompts.push(`Tell me what to do first for the next ${nextPendingTask.category} task on our list.`);
    } else if (nextPendingTask) {
      prompts.push('Tell me which open task should be tackled first and why.');
    }

    if (openVendorTaskCount > 0 || dueSoonVendorTasks > 0) {
      prompts.push('Review the vendor-linked tasks and tell me what needs attention first.');
    }

    if (privateTaskCount > 0) {
      prompts.push('Separate the private couple tasks from the shared ones and tell me what we should handle ourselves first.');
    }

    if (prompts.length === 0) {
      prompts.push('Give me a simple action plan for the next tasks we should complete.');
    }

    return prompts.slice(0, 3);
  }, [dueSoonVendorTasks, nextPendingTask, openVendorTaskCount, overduePending.length, privateTaskCount]);

  const tasksConciergeContext = useMemo(() => buildConciergeContext({
    page: 'Tasks',
    role: profile?.role,
    primaryGoal: 'Help the user decide what to do first and turn the task queue into a calm action plan.',
    nextBestAction: nextPendingTask?.title ?? 'Create or choose the first planning task',
    facts: [
      ['Open tasks', pending.length],
      ['Urgent tasks', urgentPending.length],
      ['Overdue tasks', overduePending.length],
      ['Completed tasks', done.length],
      ['Private tasks', privateTaskCount],
      ['Vendor-linked open tasks', openVendorTaskCount],
      ['Vendor tasks due soon', dueSoonVendorTasks],
      ['Next pending task', nextPendingTask?.title],
      ['Current view mode', taskViewMode],
    ],
    risks: [
      overduePending.length > 0 ? `${overduePending.length} task(s) are overdue.` : null,
      urgentPending.length > 0 ? `${urgentPending.length} task(s) are critical or due soon.` : null,
      dueSoonVendorTasks > 0 ? `${dueSoonVendorTasks} vendor-linked task(s) are due soon.` : null,
      pending.length === 0 ? 'No active task queue exists.' : null,
    ].filter(Boolean) as string[],
  }), [
    done.length,
    dueSoonVendorTasks,
    nextPendingTask?.title,
    openVendorTaskCount,
    overduePending.length,
    pending.length,
    privateTaskCount,
    profile?.role,
    taskViewMode,
    urgentPending.length,
  ]);

  const tasksAssistant = useInlineAssistant({
    feature: tasksAssistantFeature,
    page: 'tasks',
    surface: 'task_focus_card',
    contextSource: taskViewMode === 'completed' ? 'completed_tasks_summary' : 'pending_tasks_summary',
    conciergeContext: tasksConciergeContext,
  });

  const filteredPending = useMemo(
    () => pending.filter(taskMatchesWorkspaceFilters).sort(sortTasksByDateAndPriority),
    [pending, searchTerm, taskScopeFilter, vendorLookup],
  );

  const filteredDone = useMemo(
    () => done.filter(taskMatchesWorkspaceFilters).sort(sortTasksByDateAndPriority),
    [done, searchTerm, taskScopeFilter, vendorLookup],
  );

  const filteredUrgentPending = useMemo(
    () => filteredPending.filter(isUrgentTask).sort(sortTasksByDateAndPriority),
    [filteredPending],
  );

  const filteredScheduledPending = useMemo(
    () => filteredPending.filter((task) => !isUrgentTask(task)).sort(sortTasksByDateAndPriority),
    [filteredPending],
  );

  const byDateGroups = useMemo(() => {
    return filteredScheduledPending.reduce<Record<string, Task[]>>((groups, task) => {
      const key = task.due_date ? formatDateLabel(task.due_date) : 'Unscheduled';
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
      return groups;
    }, {});
  }, [filteredScheduledPending]);

  const byCategoryGroups = useMemo(() => {
    return filteredPending
      .slice()
      .sort(sortTasksByDateAndPriority)
      .reduce<Record<string, Task[]>>((groups, task) => {
        const linkedVendor = getConfirmedVendorForTask(task, vendorOptions);
        const key = task.category || linkedVendor?.category || 'Uncategorized';
        if (!groups[key]) groups[key] = [];
        groups[key].push(task);
        return groups;
      }, {});
  }, [filteredPending, vendorOptions]);

  const sortedCategoryGroups = useMemo(
    () =>
      Object.entries(byCategoryGroups).sort(([leftLabel, leftGroup], [rightLabel, rightGroup]) => {
        const leftFirst = leftGroup[0];
        const rightFirst = rightGroup[0];
        const leftDue = leftFirst?.due_date ? new Date(leftFirst.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        const rightDue = rightFirst?.due_date ? new Date(rightFirst.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        if (leftDue !== rightDue) return leftDue - rightDue;
        return leftLabel.localeCompare(rightLabel);
      }),
    [byCategoryGroups],
  );

  const completedByCategory = useMemo(() => {
    return filteredDone.reduce<Record<string, Task[]>>((groups, task) => {
      const linkedVendor = getConfirmedVendorForTask(task, vendorOptions);
      const key = task.category || linkedVendor?.category || 'Uncategorized';
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
      return groups;
    }, {});
  }, [filteredDone, vendorOptions]);

  const taskGroups = useMemo(() => {
    if (taskViewMode === 'by_date') {
      const groups: Array<{ label: string; tasks: Task[]; tone?: 'urgent' | 'default' }> = [];
      if (filteredUrgentPending.length > 0) {
        groups.push({ label: 'Complete as soon as possible', tasks: filteredUrgentPending, tone: 'urgent' });
      }
      Object.entries(byDateGroups).forEach(([label, group]) => {
        groups.push({ label, tasks: group, tone: 'default' });
      });
      return groups;
    }

    if (taskViewMode === 'by_category') {
      return sortedCategoryGroups.map(([label, group]) => ({ label, tasks: group, tone: 'default' as const }));
    }

    return Object.entries(completedByCategory)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([label, group]) => ({ label, tasks: group, tone: 'default' as const }));
  }, [byDateGroups, completedByCategory, filteredUrgentPending, sortedCategoryGroups, taskViewMode]);

  const visibleTasks = useMemo(
    () => taskGroups.flatMap((group) => group.tasks),
    [taskGroups],
  );

  const selectedTask = useMemo(
    () => visibleTasks.find((task) => task.id === selectedTaskId) ?? null,
    [visibleTasks, selectedTaskId],
  );

  useEffect(() => {
    if (selectedTaskId && !visibleTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(null);
    }
  }, [visibleTasks, selectedTaskId]);

  useEffect(() => {
    if (!requestedTaskId || tasksQuery.isLoading) return;
    const requestedTask = tasksQuery.data?.tasks.find((task) => task.id === requestedTaskId);
    if (!requestedTask) return;

    setTaskSearch('');
    setTaskScopeFilter('all');
    setTaskViewMode(requestedTask.completed ? 'completed' : 'by_date');
    setSelectedTaskId(requestedTask.id);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById(`task-${requestedTask.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  }, [requestedTaskId, tasksQuery.data?.tasks, tasksQuery.isLoading]);

  if (isPlanner && (plannerClientHydrating || !selectedClient)) return <WorkspacePageSkeleton compact />;
  if (tasksQuery.isLoading) return <WorkspacePageSkeleton compact />;

  const exportTasks = () => {
    downloadCsv(
      `zania-tasks-${new Date().toISOString().slice(0, 10)}.csv`,
      tasks.map((task) => {
        const linkedVendor = resolveTaskVendor(task);
        const resolvedCategory = task.category || linkedVendor?.category || '';
        const linkedBudget = resolveTaskBudget(task);

        return {
          title: task.title,
          category: resolvedCategory,
          due_date: safeDateLabel(task.due_date),
          completed: task.completed ? 'Yes' : 'No',
          priority: task.priority_level ?? '',
          priority_label: priorityLabel(task.priority_level) ?? '',
          visibility: task.visibility,
          phase: phaseLabel(task.phase) ?? '',
          assigned_to: task.assigned_to ?? '',
          linked_vendor: linkedVendor?.name ?? '',
          vendor_payment_status: linkedVendor ? vendorPaymentStatusLabel(linkedVendor.payment_status) : '',
          linked_budget_scope: linkedBudget?.budget_scope ?? '',
          linked_budget_remaining_kes: linkedBudget ? linkedBudget.allocated - linkedBudget.spent : '',
          description: task.description ?? '',
        };
      }),
    );
  };

  const renderTaskRow = (t: Task, isDone: boolean) => {
    const linkedVendor = resolveTaskVendor(t);
    const resolvedCategory = t.category || linkedVendor?.category || null;
    const active = selectedTaskId === t.id;
    const isUrgent = isUrgentTask(t);

    const linkedBudget = resolveTaskBudget(t);

    return (
      <motion.div
        key={t.id}
        id={`task-${t.id}`}
        layout={!prefersReducedMotion}
        animate={prefersReducedMotion ? undefined : active ? { y: -1 } : { y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: 'easeOut' }}
        className={cn(
          'relative w-full min-w-0 max-w-full scroll-mt-24 overflow-hidden rounded-lg border text-left transition-[border-color,background-color,box-shadow,opacity] duration-200',
          active
            ? 'z-10 border-primary/70 bg-primary/[0.075] shadow-[0_14px_34px_-24px_hsl(var(--foreground)/0.55)] ring-1 ring-primary/15'
            : 'border-border/80 bg-card/90 hover:border-primary/25 hover:bg-card',
          isDone && 'opacity-70',
        )}
      >
        <span aria-hidden="true" className={cn('absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-primary transition-opacity', active ? 'opacity-100' : 'opacity-0')} />
        <div className="flex items-start gap-3 p-4">
          <Checkbox
            checked={isDone}
            onCheckedChange={() => toggleTask(t.id, t.completed)}
            className="mt-1"
            onClick={(event) => event.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setSelectedTaskId(active ? null : t.id)}
            aria-expanded={active}
            className="min-w-0 flex-1 text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={cn('break-words font-medium text-card-foreground', isDone && 'line-through text-muted-foreground')}>{t.title}</p>
                  {active ? <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-primary">Open</span> : null}
                </div>
                <div className="mt-3 border-l-2 border-primary/30 pl-3">
                  {resolvedCategory ? (
                    <p className="break-words text-[0.66rem] font-semibold uppercase leading-4 tracking-[0.14em] text-muted-foreground">
                      {resolvedCategory}
                    </p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium">
                    <span className={t.visibility === 'private' ? 'text-destructive' : 'text-muted-foreground'}>
                      {t.visibility === 'private' ? 'Private' : 'Shared'}
                    </span>
                    {isUrgent && !isDone ? (
                      <span className="inline-flex items-center gap-1.5 text-destructive">
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-destructive" />
                        Urgent
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <span className={cn('mt-0.5 hidden shrink-0 text-xs font-semibold sm:inline', active ? 'text-primary' : 'text-muted-foreground')}>
                {active ? 'Hide details' : 'View details'}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {t.due_date && (
                <span>Due {new Date(t.due_date).toLocaleDateString()}</span>
              )}
              {t.assigned_to && (
                <span>Assigned to {t.assigned_to}</span>
              )}
            </div>
          </button>
        </div>

        <AnimatedCardDetails open={active}>
              <div className="space-y-4 border-t border-primary/15 px-4 pb-4 pt-4 sm:px-6">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                  <div><p className="text-xs text-muted-foreground">Due</p><p className="mt-1 font-medium">{t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No date'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Who</p><p className="mt-1 font-medium">{t.assigned_to || 'Not assigned'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Vendor</p><p className="mt-1 font-medium">{linkedVendor?.name || 'None'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Budget</p><p className="mt-1 font-medium">{linkedBudget ? `KES ${(linkedBudget.allocated - linkedBudget.spent).toLocaleString()} left` : 'None'}</p></div>
                </div>
                {t.description && t.description.trim() !== t.title.trim() ? (
                  <p className="text-sm leading-6 text-muted-foreground">{t.description}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => toggleTask(t.id, t.completed)}>{t.completed ? 'Mark as open' : 'Mark complete'}</Button>
                  {t.due_date ? (
                    calendarDecision.allowed ? (
                      <a href={buildGoogleCalendarUrl({ title: t.title, date: t.due_date, description: t.description ?? '' })} target="_blank" rel="noopener noreferrer">
                        <Button type="button" variant="outline">Add to calendar</Button>
                      </a>
                    ) : <Button type="button" variant="outline" onClick={() => setUpgradeOpen(true)}>Add to calendar</Button>
                  ) : null}
                  <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label="Delete task" title="Delete task" onClick={() => deleteTask(t.id)}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
                </div>
              </div>
        </AnimatedCardDetails>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-editorial text-3xl font-semibold text-foreground sm:text-4xl">Tasks</h1>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>Add task</Button>
      </header>

      <Card className="overflow-hidden rounded-lg border-primary/25 bg-card shadow-none">
        <CardContent className="grid p-0 md:grid-cols-[minmax(0,1fr)_18rem] md:divide-x md:divide-border">
          <button
            type="button"
            className="group min-w-0 bg-primary/5 px-4 py-3 text-left transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset sm:px-5"
            onClick={() => {
              if (nextPendingTask) {
                navigate(`/tasks?task=${encodeURIComponent(nextPendingTask.id)}`);
                return;
              }
              setOpen(true);
            }}
          >
            <div className="flex min-w-0 items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Next task</p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-foreground transition-colors group-hover:text-primary sm:text-base">
                  {nextPendingTask?.title ?? 'Add your first task'}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-muted-foreground">
                  {nextPendingTask?.due_date
                    ? `Due ${new Date(nextPendingTask.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : nextPendingTask ? 'No due date' : 'Get started'}
                </p>
                <p className="mt-1 text-xs font-semibold text-primary">{nextPendingTask ? 'Open task' : 'Add task'}</p>
              </div>
            </div>
          </button>

          <div className="grid grid-cols-3 border-t border-border md:border-t-0">
            <div className="border-r border-border px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">Open</p>
              <p className="mt-0.5 text-base font-semibold text-foreground">{pending.length}</p>
            </div>
            <div className="border-r border-border px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">Urgent</p>
              <p className="mt-0.5 text-base font-semibold text-foreground">{urgentPending.length}</p>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">Done</p>
              <p className="mt-0.5 text-base font-semibold text-foreground">{done.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border bg-card p-2">
        <div className="min-w-0">
          <SlidingSegmentedControl
            label="Task view"
            layoutId="task-view-selection"
            value={taskViewMode}
            options={[{ value: 'by_date', label: 'By date' }, { value: 'by_category', label: 'Categories' }, { value: 'completed', label: 'Completed' }]}
            onChange={setTaskViewMode}
            reducedMotion={Boolean(prefersReducedMotion)}
            minWidthClassName="w-full min-w-0"
          />
        </div>
        <div className="contents">
          <UpgradePromptDialog
            open={upgradeOpen}
            onOpenChange={setUpgradeOpen}
            decision={calendarDecision.allowed ? null : calendarDecision}
          />
          <UpgradePromptDialog
            open={exportUpgradeOpen}
            onOpenChange={setExportUpgradeOpen}
            decision={exportDecision.allowed ? null : exportDecision}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Export tasks"
            className="shrink-0 px-2 text-muted-foreground hover:text-foreground sm:px-3"
            onClick={() => {
              if (!exportDecision.allowed) {
                setExportUpgradeOpen(true);
                return;
              }
              exportTasks();
            }}
          >
            <Download className="h-4 w-4 sm:mr-1.5" aria-hidden="true" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display">Add task</DialogTitle>
                <DialogDescription>Choose a checklist task or enter your own.</DialogDescription>
              </DialogHeader>
              <form onSubmit={addTask} className="space-y-4">
                <FormSubmitError message={taskSubmitError} />
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={taskCategory}
                    onValueChange={(value) => {
                      setTaskCategory(value);
                      if (value === 'none') {
                        setTaskTemplateKey('none');
                        setTaskPickerMode('custom');
                        setTitle('');
                        setDescription('');
                        return;
                      }

                      const nextCategoryName = categoryOptions.find((category) => category.value === value)?.label ?? null;
                      const nextTemplates = nextCategoryName
                        ? getSuggestedTaskTemplates({
                            category: nextCategoryName,
                            vendorCategories: vendorOptions.map((vendor) => vendor.category),
                            role: profile?.role,
                            plannerType: profile?.planner_type,
                          })
                        : [];

                      if (nextTemplates.length) {
                        setTaskPickerMode('suggested');
                        setTaskTemplateKey(nextTemplates[0].key);
                        setTitle(nextTemplates[0].title);
                        setDescription(nextTemplates[0].description);
                        if (!assignedTo && nextTemplates[0].recommendedRole) {
                          setAssignedTo(nextTemplates[0].recommendedRole);
                        }
                      } else {
                        setTaskTemplateKey('none');
                        setTaskPickerMode('custom');
                        setTitle('');
                        setDescription('');
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      {categoryOptions.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedCategoryName && (
                  <div className="space-y-2">
                    <Label>Task</Label>
                    <Select
                      value={taskPickerMode === 'custom' ? 'custom' : taskTemplateKey}
                      onValueChange={(value) => {
                        if (value === 'custom') {
                          setTaskTemplateKey('none');
                          setTaskPickerMode('custom');
                          setTitle('');
                          setDescription('');
                          return;
                        }
                        applySuggestedTemplate(value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a checklist task" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">Custom task</SelectItem>
                        {suggestedTaskOptions.map((template) => (
                          <SelectItem key={template.key} value={template.key}>
                            {template.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedTaskTemplate && (
                      <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">{selectedTaskTemplate.description}</p>
                      </div>
                    )}
                  </div>
                )}
                {taskPickerMode === 'custom' && (
                  <div className="space-y-2">
                    <Label>Task name</Label>
                    <Input
                      value={title}
                      onChange={(e) => { setTitle(e.target.value); setTaskFormErrors((current) => ({ ...current, title: undefined })); setTaskSubmitError(null); }}
                      placeholder="e.g. Confirm ushers transport plan"
                      required
                      aria-invalid={!!taskFormErrors.title}
                    />
                    <FormFieldError message={taskFormErrors.title} />
                  </div>
                )}
                <details className="rounded-2xl border border-border/70 bg-muted/20 p-3">
                  <summary className="cursor-pointer list-none text-sm font-medium text-foreground">More details</summary>
                  <div className="mt-4 space-y-4 border-t border-border/70 pt-4">
                    {resolvedTaskDefaults ? (
                      <p className="text-xs leading-5 text-muted-foreground">
                        {[
                          resolvedTaskDefaults.visibility === 'private' ? 'Private' : 'Shared',
                          priorityLabel(resolvedTaskDefaults.priorityLevel),
                          resolvedTaskDefaults.delegatable && resolvedTaskDefaults.recommendedRole
                            ? `Suggested owner: ${resolvedTaskDefaults.recommendedRole}`
                            : null,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                    <div className="space-y-2">
                      <Label>Vendor</Label>
                      <Select
                        value={sourceVendorId}
                        onValueChange={(value) => {
                          setSourceVendorId(value);
                          if (value === 'none') return;
                          const vendor = vendorLookup[value];
                          if (!vendor) return;
                          const matchedCategory = categoryOptions.find((category) => (
                            vendorCategoriesMatch(category.label, vendor.category)
                          ));
                          if (matchedCategory) {
                            setTaskCategory(matchedCategory.value);
                            const nextTemplates = getSuggestedTaskTemplates({
                              category: matchedCategory.label,
                              vendorCategories: vendorOptions.map((option) => option.category),
                              role: profile?.role,
                              plannerType: profile?.planner_type,
                            });
                            if (nextTemplates.length) {
                              setTaskPickerMode('suggested');
                              setTaskTemplateKey(nextTemplates[0].key);
                              setTitle(nextTemplates[0].title);
                              setDescription(nextTemplates[0].description);
                              if (!assignedTo && nextTemplates[0].recommendedRole) {
                                setAssignedTo(nextTemplates[0].recommendedRole);
                              }
                            } else {
                              setTaskTemplateKey('none');
                              setTaskPickerMode('custom');
                            }
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="No vendor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No vendor</SelectItem>
                          {vendorOptions.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              {vendor.name} · {vendor.category} · {selectionLabel(vendor.selection_status)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Due date</Label>
                      <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Assigned to</Label>
                      <Input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="Couple, committee lead, MC" />
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add useful details" rows={3} />
                    </div>
                  </div>
                </details>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={submittingTask}
                  status={submittingTask ? 'loading' : taskAdded ? 'success' : 'idle'}
                  loadingText="Adding task"
                  successText={plannerNeedsApproval ? 'Request sent' : 'Task added'}
                >
                  Add task
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <details className="hidden rounded-3xl border border-border/70 bg-background p-5 shadow-card">
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">AI guidance and reports</p>
              <h3 className="workspace-h3 mt-2">Open deeper task help only when you need it</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep the checklist in focus by default. Open this for AI recovery help and secondary workload signals.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link2 className="h-4 w-4" />
              Hidden by default
            </div>
          </div>
        </summary>
        <div className="mt-5 space-y-4">
          {!tasksAssistant.dismissed && (
            <InlineAssistantCard
              title="What should we tackle first?"
              description="Get a quick task recovery plan based on overdue items, vendor-linked work, and what is due next."
              badgeLabel="AI Tasks"
              prompts={tasksPrompts}
              response={tasksAssistant.response}
              error={tasksAssistant.error}
              loading={tasksAssistant.loading || tasksAssistant.usageLoading || tasksAssistant.accessLoading}
              decision={tasksAssistant.decision}
              canUseAssistant={tasksAssistant.canUseAssistant}
              emptyStateTitle="Get a simple task plan before you start checking things off"
              emptyStateBody="Ask for a catch-up plan, a vendor-task review, or the next best task to focus on from the list already on this page."
              dismissible
              onDismiss={() => tasksAssistant.setDismissed(true)}
              onPromptClick={(prompt) => tasksAssistant.runPrompt(prompt)}
            />
          )}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="shadow-none">
              <CardContent className="py-5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Link2 className="h-4 w-4" />
                  <p className="text-sm font-medium text-foreground">Vendor-linked tasks</p>
                </div>
                <p className="mt-2 text-2xl font-semibold text-foreground">{openVendorTaskCount}</p>
                <p className="text-sm text-muted-foreground">Open tasks tied directly to a vendor choice or shortlist.</p>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardContent className="py-5">
                <p className="text-sm font-medium text-foreground">Private couple tasks</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{privateTaskCount}</p>
                <p className="text-sm text-muted-foreground">Tasks reserved for the private couple workspace.</p>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardContent className="py-5">
                <p className="text-sm font-medium text-foreground">Delegatable actions</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{delegatedTaskCount}</p>
                <p className="text-sm text-muted-foreground">{vendorsWithOpenTasks} vendors and {dueSoonVendorTasks} due vendor actions are still active this week.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </details>

      <div className="w-full min-w-0 max-w-full">
        <Card className="w-full min-w-0 max-w-full border-primary/15 shadow-card">
          <CardContent className="space-y-5 p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="workspace-h2">Task list</h2>
              </div>
              <div className="shrink-0 border-l border-primary/25 pl-3 text-right" aria-live="polite">
                <p className="text-lg font-semibold leading-none text-foreground">{visibleTasks.length}</p>
                <p className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">visible</p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
              <div>
                <Input
                  value={taskSearch}
                  onChange={(event) => setTaskSearch(event.target.value)}
                  placeholder="Search tasks"
                />
              </div>
              <Select value={taskScopeFilter} onValueChange={(value) => setTaskScopeFilter(value as TaskScopeFilter)}>
                <SelectTrigger className="w-full lg:w-[190px]">
                  <SelectValue placeholder="Filter queue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tasks</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="vendor">Vendor tasks</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="shared">Shared</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {((taskViewMode === 'completed' && filteredDone.length === 0) ||
              (taskViewMode !== 'completed' && filteredPending.length === 0)) ? (
              <div className="rounded-3xl border border-dashed border-border/70 bg-muted/15 p-8 text-center">
                <p className="text-lg font-semibold text-foreground">
                  {taskViewMode === 'completed' ? 'No completed tasks yet' : 'No tasks found'}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {taskViewMode === 'completed'
                    ? 'Completed tasks will appear here.'
                    : 'Try another filter or add a task.'}
                </p>
                {taskViewMode !== 'completed' && pending.length === 0 ? (
                  <Button type="button" className="mt-4" onClick={() => setOpen(true)}>Add task</Button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-6">
                {taskGroups.map((group) => {
                  const completedCount = group.tasks.filter((task) => task.completed).length;
                  const openCount = group.tasks.length - completedCount;
                  const urgentCount = group.tasks.filter((task) => isUrgentTask(task)).length;
                  const vendorLinkedCount = group.tasks.filter((task) => resolveTaskVendor(task)).length;
                  const nextDueTask = group.tasks
                    .filter((task) => !task.completed && task.due_date)
                    .sort(sortTasksByDateAndPriority)[0] ?? null;
                  const allComplete = completedCount === group.tasks.length;
                  const groupOpen = expandedTaskGroups[group.label] ?? false;
                  const groupTone = allComplete
                    ? 'success'
                    : urgentCount > 0
                      ? 'danger'
                      : vendorLinkedCount > 0
                        ? 'warning'
                        : 'neutral';
                  const groupStatus = allComplete
                    ? 'Complete'
                    : urgentCount > 0
                      ? `${urgentCount} urgent`
                      : `${openCount} open`;
                  const groupEyebrow = taskViewMode === 'by_date'
                    ? 'Task date'
                    : taskViewMode === 'completed'
                      ? 'Completed category'
                      : 'Task category';

                  return (
                    <HierarchyGroup
                      key={group.label}
                      eyebrow={groupEyebrow}
                      title={group.label}
                      status={groupStatus}
                      tone={groupTone}
                      open={groupOpen}
                      onToggle={() => {
                        setExpandedTaskGroups((current) => ({
                          ...current,
                          [group.label]: !(current[group.label] ?? false),
                        }));
                      }}
                      meta={`${group.tasks.length} task${group.tasks.length === 1 ? '' : 's'}`}
                      summary={(
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span>{completedCount} complete</span>
                          <span>{openCount} remaining</span>
                          {vendorLinkedCount > 0 ? (
                            <span>{vendorLinkedCount} vendor-linked</span>
                          ) : null}
                          {nextDueTask?.due_date ? (
                            <span>Next due {new Date(nextDueTask.due_date).toLocaleDateString()}</span>
                          ) : null}
                        </div>
                      )}
                    >
                      <div className="space-y-3">
                        <AnimatePresence initial={false} mode="popLayout">
                          {group.tasks.map((task) => renderTaskRow(task, task.completed))}
                        </AnimatePresence>
                      </div>
                    </HierarchyGroup>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="hidden border-primary/15 shadow-card">
          <CardContent className="space-y-5 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-primary">Selected Task</p>
                <h2 className="workspace-h2 mt-2">
                  {selectedTask?.title ?? 'Pick a task from the queue'}
                </h2>
              </div>
              {selectedTask ? (
                <span className={`inline-flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] ${
                  selectedTask.completed ? 'text-success' : 'text-muted-foreground'
                }`}>
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${selectedTask.completed ? 'bg-success' : 'bg-primary/45'}`}
                  />
                  {selectedTask.completed ? 'Done' : 'Active'}
                </span>
              ) : null}
            </div>

            {selectedTask ? (() => {
              const linkedVendor = resolveTaskVendor(selectedTask);
              const resolvedCategory = selectedTask.category || linkedVendor?.category || null;
              const linkedBudget = resolveTaskBudget(selectedTask);
              const outstandingAmount =
                linkedVendor && linkedVendor.price != null ? Math.max(linkedVendor.price - linkedVendor.amount_paid, 0) : null;

              return (
                <div className="space-y-5">
                  <div className="border-l-2 border-primary/25 pl-3">
                    {resolvedCategory ? (
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{resolvedCategory}</p>
                    ) : null}
                    <p className="mt-1 text-sm text-foreground">
                      {[
                        selectedTask.visibility === 'private' ? 'Private' : 'Shared',
                        selectedTask.priority_level != null
                          ? `P${selectedTask.priority_level} · ${priorityLabel(selectedTask.priority_level)}`
                          : null,
                        phaseLabel(selectedTask.phase),
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Due date</p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {selectedTask.due_date
                          ? new Date(selectedTask.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                          : 'No due date set'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Assigned to</p>
                      <p className="mt-2 text-sm font-medium text-foreground">{selectedTask.assigned_to || 'Not assigned yet'}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Vendor link</p>
                      {linkedVendor ? (
                        <button
                          type="button"
                          className="mt-2 text-left text-sm font-medium text-primary underline-offset-4 hover:underline"
                          onClick={() => navigate(`/vendors?vendor=${encodeURIComponent(linkedVendor.id)}`)}
                        >
                          {linkedVendor.name}
                        </button>
                      ) : <p className="mt-2 text-sm font-medium text-foreground">No linked vendor</p>}
                      {linkedVendor && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {linkedVendor.selection_status === 'final' ? 'Confirmed · ' : ''}
                          {vendorPaymentStatusLabel(linkedVendor.payment_status)}
                          {outstandingAmount != null ? ` · KES ${outstandingAmount.toLocaleString()} outstanding` : ''}
                        </p>
                      )}
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Budget link</p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {linkedBudget
                          ? `${linkedBudget.budget_scope === 'personal' ? 'Personal' : 'Wedding'} budget`
                          : 'No linked budget category'}
                      </p>
                      {linkedBudget && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          KES {(linkedBudget.allocated - linkedBudget.spent).toLocaleString()} remaining
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Description</p>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {selectedTask.description || 'No extra notes yet. Use task descriptions to store logistics, handoff details, or contract reminders.'}
                    </p>
                  </div>

                  <div className="semantic-surface-info rounded-2xl border p-4">
                    <p className="text-sm font-medium text-foreground">Recommended next move</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {selectedTask.completed
                        ? 'This one is already complete. Move to the next item in the queue or review the completed history.'
                        : linkedVendor
                          ? 'Open the vendor workspace if this task depends on quote, payment, or booking follow-up.'
                          : selectedTask.visibility === 'private'
                            ? 'Keep this inside the couple workflow unless you intentionally want to delegate it.'
                            : 'Use this as a shared planning item and keep the owner, due date, and notes clear.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button type="button" onClick={() => toggleTask(selectedTask.id, selectedTask.completed)}>
                      {selectedTask.completed ? 'Mark as active' : 'Mark complete'}
                    </Button>
                    {selectedTask.due_date && (
                      calendarDecision.allowed ? (
                        <a
                          href={buildGoogleCalendarUrl({
                            title: selectedTask.title,
                            date: selectedTask.due_date,
                            description: [
                              linkedVendor ? `Vendor: ${linkedVendor.name}` : null,
                              selectedTask.category ? `Category: ${selectedTask.category}` : null,
                              selectedTask.description,
                              selectedTask.assigned_to ? `Assigned to: ${selectedTask.assigned_to}` : null,
                            ].filter(Boolean).join('\n'),
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button type="button" variant="outline">
                            Add to Calendar
                          </Button>
                        </a>
                      ) : (
                        <Button type="button" variant="outline" onClick={() => setUpgradeOpen(true)}>
                          Add to Calendar
                        </Button>
                      )
                    )}
                    {linkedVendor && (
                      <Button type="button" variant="outline" onClick={() => navigate('/vendors')}>
                        Open vendor workspace
                      </Button>
                    )}
                    <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label="Delete task" title="Delete task" onClick={() => deleteTask(selectedTask.id)}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              );
            })() : (
              <div className="rounded-3xl border border-dashed border-border/70 bg-muted/15 p-10 text-center">
                <p className="text-lg font-semibold text-foreground">Select a task to focus the workspace</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Pick any task from the queue to see its details, vendor link, budget context, and the next recommended move.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
