import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Calendar, CalendarPlus, UserCircle, BriefcaseBusiness, Link2, Download, Search, ChevronRight, Sparkles, CircleDashed, PanelsTopLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { buildGoogleCalendarUrl } from '@/lib/googleCalendar';
import { createVendorTask } from '@/lib/vendorTasks';
import { vendorPaymentStatusLabel } from '@/lib/vendorPayments';
import { cn } from '@/lib/utils';
import { getSuggestedTaskCategories, getSuggestedTaskTemplates, getTaskCategoryDefaults } from '@/lib/weddingTaskTemplates';
import { getEntitlementDecision, type EntitlementFeature } from '@/lib/entitlements';
import { useWeddingEntitlements } from '@/hooks/useWeddingEntitlements';
import { UpgradePromptDialog } from '@/components/UpgradePrompt';
import { downloadCsv, safeDateLabel } from '@/lib/exportHelpers';
import InlineAssistantCard from '@/components/InlineAssistantCard';
import { useInlineAssistant } from '@/hooks/useInlineAssistant';
import { useAssistantPanel } from '@/contexts/AssistantPanelContext';

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

export default function Tasks() {
  const { user, profile } = useAuth();
  const { isPlanner, selectedClient, dataOrFilter } = usePlanner();
  const { entitlements: weddingEntitlements, couplePlanTier } = useWeddingEntitlements();
  const navigate = useNavigate();
  const { toast } = useToast();
  const assistantPanel = useAssistantPanel();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategoryOption[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [taskCategory, setTaskCategory] = useState('none');
  const [taskTemplateKey, setTaskTemplateKey] = useState('none');
  const [taskPickerMode, setTaskPickerMode] = useState<TaskPickerMode>('suggested');
  const [sourceVendorId, setSourceVendorId] = useState<string>('none');
  const [taskViewMode, setTaskViewMode] = useState<TaskViewMode>('by_date');
  const [taskScopeFilter, setTaskScopeFilter] = useState<TaskScopeFilter>('all');
  const [taskSearch, setTaskSearch] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [exportUpgradeOpen, setExportUpgradeOpen] = useState(false);

  useEffect(() => {
    if (isPlanner && !selectedClient) navigate('/clients');
  }, [isPlanner, selectedClient, navigate]);

  const load = async () => {
    if (!dataOrFilter) return;
    const [tasksResult, vendorsResult, budgetsResult] = await Promise.all([
      supabase.from('tasks').select('*').or(dataOrFilter).order('due_date', { ascending: true, nullsFirst: false }),
      supabase
        .from('vendors')
        .select('id, name, category, selection_status, price, amount_paid, payment_status, payment_due_date, contract_status')
        .or(dataOrFilter)
        .order('name'),
      supabase.from('budget_categories').select('id, name, allocated, spent, budget_scope').or(dataOrFilter).order('name'),
    ]);

    if (tasksResult.data) setTasks(tasksResult.data as Task[]);
    if (vendorsResult.data) {
      setVendorOptions(
        (vendorsResult.data as any[]).map((vendor) => ({
          ...vendor,
          price: vendor.price != null ? Number(vendor.price) : null,
          amount_paid: Number(vendor.amount_paid ?? 0),
        })) as VendorOption[],
      );
    }
    if (budgetsResult.data) {
      setBudgetCategories(
        (budgetsResult.data as any[]).map((category) => ({
          ...category,
          allocated: Number(category.allocated ?? 0),
          spent: Number(category.spent ?? 0),
        })) as BudgetCategoryOption[],
      );
    }
  };

  useEffect(() => {
    void load();
  }, [user, selectedClient, dataOrFilter]);

  const vendorLookup = useMemo(
    () => Object.fromEntries(vendorOptions.map((vendor) => [vendor.id, vendor])),
    [vendorOptions],
  );

  const budgetLookup = useMemo(
    () => Object.fromEntries(budgetCategories.map((category) => [normalizeCategory(category.name), category])),
    [budgetCategories],
  );

  const categoryOptions = useMemo(() => {
    const set = new Map<string, string>();
    getSuggestedTaskCategories({
      vendorCategories: vendorOptions.map((vendor) => vendor.category),
      role: profile?.role,
      plannerType: profile?.planner_type,
    }).forEach((category) => set.set(normalizeCategory(category), category));
    budgetCategories.forEach((category) => set.set(normalizeCategory(category.name), category.name));
    vendorOptions.forEach((vendor) => {
      if (!set.has(normalizeCategory(vendor.category))) {
        set.set(normalizeCategory(vendor.category), vendor.category);
      }
    });

    return [...set.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [budgetCategories, vendorOptions, profile?.role, profile?.planner_type]);

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
    if (!title.trim()) {
      toast({
        title: 'Choose a task first',
        description: 'Pick a checklist task or type a custom title before saving.',
        variant: 'destructive',
      });
      return;
    }

    const linkedVendor = sourceVendorId !== 'none' ? vendorLookup[sourceVendorId] : null;
    const categoryName = linkedVendor?.category ?? selectedCategoryName ?? null;

    try {
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
      setTitle('');
      setDescription('');
      setDueDate('');
      setAssignedTo('');
      setTaskCategory('none');
      setTaskTemplateKey('none');
      setTaskPickerMode('suggested');
      setSourceVendorId('none');
      setOpen(false);
      await load();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const toggleTask = async (id: string, completed: boolean) => {
    await supabase.from('tasks').update({ completed: !completed }).eq('id', id);
    load();
  };

  const deleteTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
    load();
  };

  const pending = tasks.filter((task) => !task.completed);
  const done = tasks
    .filter((task) => task.completed)
    .sort((left, right) => sortTasksByDateAndPriority(left, right));
  const urgentPending = pending.filter(isUrgentTask).sort(sortTasksByDateAndPriority);
  const scheduledPending = pending.filter((task) => !isUrgentTask(task)).sort(sortTasksByDateAndPriority);
  const vendorLinkedTasks = tasks.filter((task) => task.source_vendor_id);
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
    vendorLinkedTasks.filter((task) => !task.completed && task.source_vendor_id).map((task) => task.source_vendor_id as string),
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
      const linkedVendor = task.source_vendor_id ? vendorLookup[task.source_vendor_id] : null;
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
        return Boolean(task.source_vendor_id);
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
      prompts.push('Tell me which pending task should be tackled first and why.');
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

  const tasksAssistant = useInlineAssistant({
    feature: tasksAssistantFeature,
    page: 'tasks',
    surface: 'task_focus_card',
    contextSource: taskViewMode === 'completed' ? 'completed_tasks_summary' : 'pending_tasks_summary',
  });
  const [tasksNudgeDismissed, setTasksNudgeDismissed] = useState(false);

  const tasksNudge = useMemo(() => {
    if (overduePending.length > 0) {
      return {
        title: `${overduePending.length} overdue task${overduePending.length === 1 ? '' : 's'} need attention`,
        body: 'Get a quick catch-up plan before these tasks start blocking the rest of the wedding.',
        prompt: 'Turn the overdue tasks into a simple catch-up plan for this week.',
      };
    }

    if (dueSoonVendorTasks > 0 || openVendorTaskCount > 0) {
      return {
        title: 'Vendor-linked tasks are still open',
        body: 'Use the assistant to decide what vendor follow-up should happen next.',
        prompt: 'Review the vendor-linked tasks and tell me what needs attention first.',
      };
    }

    if (privateTaskCount > 0 && nextPendingTask) {
      return {
        title: 'Private couple tasks still need a plan',
        body: 'Sort out what the two of you should handle directly before delegating the rest.',
        prompt: 'Separate the private couple tasks from the shared ones and tell me what we should handle ourselves first.',
      };
    }

    if (nextPendingTask) {
      return {
        title: 'Start with the next right task',
        body: 'A quick AI pass can help you decide what to tackle before you get lost in the list.',
        prompt: nextPendingTask.category
          ? `Tell me what to do first for the next ${nextPendingTask.category} task on our list.`
          : 'Tell me which pending task should be tackled first and why.',
      };
    }

    return null;
  }, [dueSoonVendorTasks, nextPendingTask, openVendorTaskCount, overduePending.length, privateTaskCount]);

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
        const linkedVendor = task.source_vendor_id ? vendorLookup[task.source_vendor_id] : null;
        const key = task.category || linkedVendor?.category || 'Uncategorized';
        if (!groups[key]) groups[key] = [];
        groups[key].push(task);
        return groups;
      }, {});
  }, [filteredPending, vendorLookup]);

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
      const linkedVendor = task.source_vendor_id ? vendorLookup[task.source_vendor_id] : null;
      const key = task.category || linkedVendor?.category || 'Uncategorized';
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
      return groups;
    }, {});
  }, [filteredDone, vendorLookup]);

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
    if (visibleTasks.length === 0) {
      if (selectedTaskId !== null) {
        setSelectedTaskId(null);
      }
      return;
    }

    if (!selectedTaskId || !visibleTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(visibleTasks[0].id);
    }
  }, [visibleTasks, selectedTaskId]);

  if (isPlanner && !selectedClient) return null;

  const exportTasks = () => {
    downloadCsv(
      `zania-tasks-${new Date().toISOString().slice(0, 10)}.csv`,
      tasks.map((task) => {
        const linkedVendor = task.source_vendor_id ? vendorLookup[task.source_vendor_id] : null;
        const resolvedCategory = task.category || linkedVendor?.category || '';
        const linkedBudget = resolvedCategory ? budgetLookup[normalizeCategory(resolvedCategory)] : null;

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

  const TaskRow = ({ t, isDone }: { t: Task; isDone: boolean }) => {
    const linkedVendor = t.source_vendor_id ? vendorLookup[t.source_vendor_id] : null;
    const resolvedCategory = t.category || linkedVendor?.category || null;
    const active = selectedTaskId === t.id;
    const isUrgent = isUrgentTask(t);

    return (
      <button
        type="button"
        onClick={() => setSelectedTaskId(t.id)}
        className={cn(
          'w-full rounded-2xl border p-4 text-left transition-all',
          active
            ? 'border-primary bg-primary/5 shadow-sm'
            : 'border-border/70 bg-background hover:border-primary/40 hover:bg-muted/20',
          isDone && 'opacity-70',
        )}
      >
        <div className="flex items-start gap-3">
          <Checkbox
            checked={isDone}
            onCheckedChange={() => toggleTask(t.id, t.completed)}
            className="mt-1"
            onClick={(event) => event.stopPropagation()}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={cn('font-medium text-card-foreground', isDone && 'line-through text-muted-foreground')}>
                  {t.title}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {resolvedCategory && (
                    <Badge variant="secondary" className="rounded-full text-[11px]">
                      {resolvedCategory}
                    </Badge>
                  )}
                  <Badge variant={t.visibility === 'private' ? 'destructive' : 'outline'} className="rounded-full text-[11px]">
                    {t.visibility === 'private' ? 'Private' : 'Shared'}
                  </Badge>
                  {t.priority_level != null && (
                    <Badge variant="outline" className="rounded-full text-[11px]">
                      P{t.priority_level} · {priorityLabel(t.priority_level)}
                    </Badge>
                  )}
                  {isUrgent && !isDone && (
                    <Badge className="rounded-full bg-destructive/10 text-destructive hover:bg-destructive/10">
                      Urgent
                    </Badge>
                  )}
                </div>
              </div>
              <ChevronRight className={cn('mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform', active && 'translate-x-0.5 text-primary')} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {t.due_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(t.due_date).toLocaleDateString()}
                </span>
              )}
              {t.assigned_to && (
                <span className="flex items-center gap-1">
                  <UserCircle className="h-3 w-3" />
                  {t.assigned_to}
                </span>
              )}
              {linkedVendor && (
                <span className="flex items-center gap-1">
                  <BriefcaseBusiness className="h-3 w-3" />
                  {linkedVendor.name}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-accent/10 shadow-card">
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[1.35fr_0.95fr] lg:p-8">
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-primary">Task Workspace</p>
              <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Keep the wedding moving</h1>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
                Use this space to decide what happens next, what stays private, and what needs vendor follow-up before the week gets away from you.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Open tasks</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{pending.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Still active in the wedding queue</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Urgent now</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{urgentPending.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Critical or due in the next three days</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Completed</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{done.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Already moved out of the active queue</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border/70 bg-background/85 p-5 backdrop-blur-sm">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Focus snapshot</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                <p className="text-sm font-medium text-foreground">{nextPendingTask?.title ?? 'No pending task selected yet'}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {nextPendingTask?.due_date
                    ? `Due ${new Date(nextPendingTask.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`
                    : 'The next visible task will appear here once the queue starts filling up.'}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Private queue</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{privateTaskCount}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Vendor linked</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{openVendorTaskCount}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-medium text-foreground">
                  {overduePending.length > 0
                    ? `${overduePending.length} overdue task${overduePending.length === 1 ? '' : 's'} need recovery`
                    : dueSoonVendorTasks > 0
                      ? `${dueSoonVendorTasks} vendor task${dueSoonVendorTasks === 1 ? '' : 's'} are due soon`
                      : 'The queue is under control right now'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {overduePending.length > 0
                    ? 'Start with the overdue queue, then move into vendor-linked work.'
                    : 'Use the list filters below to focus on the work that matters most.'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-primary">Workspace Controls</p>
          <div className="flex w-full items-center rounded-full border border-border bg-background p-1 shadow-sm sm:w-auto">
            <Button
              type="button"
              size="sm"
              onClick={() => setTaskViewMode('by_date')}
              className={cn(
                'flex-1 rounded-full px-4 sm:flex-none sm:px-7',
                taskViewMode === 'by_date' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-transparent text-foreground hover:bg-muted',
              )}
            >
              By Date
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setTaskViewMode('by_category')}
              className={cn(
                'flex-1 rounded-full px-4 sm:flex-none sm:px-7',
                taskViewMode === 'by_category' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-transparent text-foreground hover:bg-muted',
              )}
            >
              By Category
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setTaskViewMode('completed')}
              className={cn(
                'flex-1 rounded-full px-4 sm:flex-none sm:px-7',
                taskViewMode === 'completed' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-transparent text-foreground hover:bg-muted',
              )}
            >
              Completed
            </Button>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto">
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
            variant="outline"
            className="w-full gap-2 sm:w-auto"
            onClick={() => {
              if (!exportDecision.allowed) {
                setExportUpgradeOpen(true);
                return;
              }
              exportTasks();
            }}
          >
            <Download className="h-4 w-4" />
            Export Tasks
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <Button type="button" className="w-full gap-2 sm:w-auto" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Task
            </Button>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle className="font-display">Add Task</DialogTitle></DialogHeader>
              <form onSubmit={addTask} className="space-y-4">
                <div className="space-y-2">
                  <Label>Checklist Category</Label>
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
                  {resolvedTaskDefaults && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="rounded-full text-[11px]">
                        {resolvedTaskDefaults.visibility === 'private' ? 'Private' : 'Public'}
                      </Badge>
                      <Badge variant="outline" className="rounded-full text-[11px]">
                        P{resolvedTaskDefaults.priorityLevel} · {priorityLabel(resolvedTaskDefaults.priorityLevel)}
                      </Badge>
                      {resolvedTaskDefaults.delegatable && resolvedTaskDefaults.recommendedRole && (
                        <Badge variant="outline" className="rounded-full text-[11px]">
                          Delegate to {resolvedTaskDefaults.recommendedRole}
                        </Badge>
                      )}
                      {selectedTaskTemplate?.timelineLabel && (
                        <Badge variant="outline" className="rounded-full text-[11px]">
                          {selectedTaskTemplate.timelineLabel}
                        </Badge>
                      )}
                      {selectedTaskTemplate?.phase && (
                        <Badge variant="outline" className="rounded-full text-[11px]">
                          {phaseLabel(selectedTaskTemplate.phase)}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                {selectedCategoryName && (
                  <div className="space-y-2">
                    <Label>Checklist Task</Label>
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
                        <p className="text-sm font-medium text-foreground">{selectedTaskTemplate.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{selectedTaskTemplate.description}</p>
                      </div>
                    )}
                  </div>
                )}
                {taskPickerMode === 'custom' && (
                  <div className="space-y-2">
                    <Label>Custom Task Title</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Confirm ushers transport plan"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Use this only if the checklist task you want is not in the suggested list above.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Linked vendor (optional)</Label>
                  <Select
                    value={sourceVendorId}
                    onValueChange={(value) => {
                      setSourceVendorId(value);
                      if (value === 'none') return;
                      const vendor = vendorLookup[value];
                      if (!vendor) return;
                      const matchedCategory = categoryOptions.find((category) => category.label.toLowerCase() === vendor.category.toLowerCase());
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
                      <SelectValue placeholder="No linked vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No linked vendor</SelectItem>
                      {vendorOptions.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.name} · {vendor.category} · {selectionLabel(vendor.selection_status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Due Date (optional)</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Assign To (optional)</Label>
                  <Input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="e.g. Couple, committee lead, MC" />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add contract, deposit, or logistics notes..." rows={3} />
                </div>
                <Button type="submit" className="w-full">Add Task</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-card">
          <CardContent className="py-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Link2 className="h-4 w-4" />
              <p className="text-sm font-medium text-foreground">Vendor-linked tasks</p>
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{openVendorTaskCount}</p>
            <p className="text-sm text-muted-foreground">Open tasks tied directly to a vendor choice or shortlist.</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="py-5">
            <p className="text-sm font-medium text-foreground">Private couple tasks</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{privateTaskCount}</p>
            <p className="text-sm text-muted-foreground">Tasks reserved for the private couple workspace.</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="py-5">
            <p className="text-sm font-medium text-foreground">Delegatable actions</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{delegatedTaskCount}</p>
            <p className="text-sm text-muted-foreground">{vendorsWithOpenTasks} vendors and {dueSoonVendorTasks} due vendor actions are still active this week.</p>
          </CardContent>
        </Card>
      </div>

      {!tasksNudgeDismissed && tasksNudge && assistantPanel && (
        <Card className="border-primary/20 bg-primary/5 shadow-card">
          <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{tasksNudge.title}</p>
              <p className="text-sm text-muted-foreground">{tasksNudge.body}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="gap-2"
                onClick={() => assistantPanel.openAssistant(tasksNudge.prompt)}
              >
                <CalendarPlus className="h-4 w-4" />
                Review with AI
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setTasksNudgeDismissed(true)}
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-primary/15 shadow-card">
          <CardContent className="space-y-5 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-primary">Task Queue</p>
                <h2 className="mt-2 font-display text-2xl font-semibold text-foreground">Browse the live checklist</h2>
              </div>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {visibleTasks.length} visible
              </Badge>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={taskSearch}
                  onChange={(event) => setTaskSearch(event.target.value)}
                  placeholder="Search tasks, categories, vendors, or assignees"
                  className="pl-10"
                />
              </div>
              <Select value={taskScopeFilter} onValueChange={(value) => setTaskScopeFilter(value as TaskScopeFilter)}>
                <SelectTrigger className="w-full lg:w-[190px]">
                  <SelectValue placeholder="Filter queue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All visible work</SelectItem>
                  <SelectItem value="urgent">Urgent only</SelectItem>
                  <SelectItem value="vendor">Vendor linked</SelectItem>
                  <SelectItem value="private">Private only</SelectItem>
                  <SelectItem value="shared">Shared only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1">Overdue {overduePending.length}</Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">Urgent {urgentPending.length}</Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">Vendor linked {openVendorTaskCount}</Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">Private {privateTaskCount}</Badge>
            </div>

            {((taskViewMode === 'completed' && filteredDone.length === 0) ||
              (taskViewMode !== 'completed' && filteredPending.length === 0)) ? (
              <div className="rounded-3xl border border-dashed border-border/70 bg-muted/15 p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/5">
                  <PanelsTopLeft className="h-5 w-5 text-primary" />
                </div>
                <p className="mt-4 text-lg font-semibold text-foreground">
                  {taskViewMode === 'completed' ? 'No completed tasks yet' : 'No tasks match this view yet'}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {taskViewMode === 'completed'
                    ? 'Completed work will gather here once the checklist starts moving.'
                    : 'Try another filter or add the first planning task to start the workspace.'}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {taskGroups.map((group) => (
                  <div key={group.label} className="space-y-3">
                    <div className="flex items-center justify-between gap-3 border-t border-border pt-5 first:border-t-0 first:pt-0">
                      <h3 className={cn('text-lg font-semibold', group.tone === 'urgent' ? 'text-destructive' : 'text-foreground')}>
                        {group.label}
                      </h3>
                      <Badge variant="outline" className="rounded-full">{group.tasks.length}</Badge>
                    </div>
                    <div className="space-y-3">
                      {group.tasks.map((task) => (
                        <TaskRow key={task.id} t={task} isDone={task.completed} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/15 shadow-card">
          <CardContent className="space-y-5 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-primary">Selected Task</p>
                <h2 className="mt-2 font-display text-2xl font-semibold text-foreground">
                  {selectedTask?.title ?? 'Pick a task from the queue'}
                </h2>
              </div>
              {selectedTask?.completed ? (
                <Badge className="rounded-full border border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
                  Done
                </Badge>
              ) : selectedTask ? (
                <Badge variant="outline" className="rounded-full">
                  Active
                </Badge>
              ) : null}
            </div>

            {selectedTask ? (() => {
              const linkedVendor = selectedTask.source_vendor_id ? vendorLookup[selectedTask.source_vendor_id] : null;
              const resolvedCategory = selectedTask.category || linkedVendor?.category || null;
              const linkedBudget = resolvedCategory ? budgetLookup[normalizeCategory(resolvedCategory)] : null;
              const outstandingAmount =
                linkedVendor && linkedVendor.price != null ? Math.max(linkedVendor.price - linkedVendor.amount_paid, 0) : null;

              return (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-2">
                    {resolvedCategory && (
                      <Badge variant="secondary" className="rounded-full">{resolvedCategory}</Badge>
                    )}
                    <Badge variant={selectedTask.visibility === 'private' ? 'destructive' : 'outline'} className="rounded-full">
                      {selectedTask.visibility === 'private' ? 'Private' : 'Shared'}
                    </Badge>
                    {selectedTask.priority_level != null && (
                      <Badge variant="outline" className="rounded-full">
                        P{selectedTask.priority_level} · {priorityLabel(selectedTask.priority_level)}
                      </Badge>
                    )}
                    {phaseLabel(selectedTask.phase) && (
                      <Badge variant="outline" className="rounded-full">
                        {phaseLabel(selectedTask.phase)}
                      </Badge>
                    )}
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
                      <p className="mt-2 text-sm font-medium text-foreground">{linkedVendor?.name || 'No linked vendor'}</p>
                      {linkedVendor && (
                        <p className="mt-1 text-xs text-muted-foreground">
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

                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Recommended next move
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {selectedTask.completed
                        ? 'This one is already complete. Move to the next item in the queue or review the completed history.'
                        : selectedTask.source_vendor_id
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
                          <Button type="button" variant="outline" className="gap-2">
                            <CalendarPlus className="h-4 w-4" />
                            Add to Calendar
                          </Button>
                        </a>
                      ) : (
                        <Button type="button" variant="outline" className="gap-2" onClick={() => setUpgradeOpen(true)}>
                          <CalendarPlus className="h-4 w-4" />
                          Add to Calendar
                        </Button>
                      )
                    )}
                    {linkedVendor && (
                      <Button type="button" variant="outline" className="gap-2" onClick={() => navigate('/vendors')}>
                        <BriefcaseBusiness className="h-4 w-4" />
                        Open vendor workspace
                      </Button>
                    )}
                    <Button type="button" variant="ghost" className="gap-2 text-destructive hover:text-destructive" onClick={() => deleteTask(selectedTask.id)}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })() : (
              <div className="rounded-3xl border border-dashed border-border/70 bg-muted/15 p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/5">
                  <CircleDashed className="h-5 w-5 text-primary" />
                </div>
                <p className="mt-4 text-lg font-semibold text-foreground">Select a task to focus the workspace</p>
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
