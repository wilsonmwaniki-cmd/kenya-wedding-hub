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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Calendar, CalendarPlus, UserCircle, BriefcaseBusiness, Link2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { buildGoogleCalendarUrl } from '@/lib/googleCalendar';
import { createVendorTask } from '@/lib/vendorTasks';
import { vendorPaymentStatusLabel } from '@/lib/vendorPayments';
import { cn } from '@/lib/utils';
import { getSuggestedTaskCategories, getSuggestedTaskTemplates, getTaskCategoryDefaults } from '@/lib/weddingTaskTemplates';
import { getEntitlementDecision } from '@/lib/entitlements';
import { useWeddingEntitlements } from '@/hooks/useWeddingEntitlements';
import { UpgradePromptDialog } from '@/components/UpgradePrompt';
import { downloadCsv, safeDateLabel } from '@/lib/exportHelpers';

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

export default function Tasks() {
  const { user, profile } = useAuth();
  const { isPlanner, selectedClient, dataOrFilter } = usePlanner();
  const { entitlements: weddingEntitlements, couplePlanTier } = useWeddingEntitlements();
  const navigate = useNavigate();
  const { toast } = useToast();
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

  const byDateGroups = useMemo(() => {
    return scheduledPending.reduce<Record<string, Task[]>>((groups, task) => {
      const key = task.due_date ? formatDateLabel(task.due_date) : 'Unscheduled';
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
      return groups;
    }, {});
  }, [scheduledPending]);

  const byCategoryGroups = useMemo(() => {
    return pending
      .slice()
      .sort(sortTasksByDateAndPriority)
      .reduce<Record<string, Task[]>>((groups, task) => {
        const linkedVendor = task.source_vendor_id ? vendorLookup[task.source_vendor_id] : null;
        const key = task.category || linkedVendor?.category || 'Uncategorized';
        if (!groups[key]) groups[key] = [];
        groups[key].push(task);
        return groups;
      }, {});
  }, [pending, vendorLookup]);

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
    return done.reduce<Record<string, Task[]>>((groups, task) => {
      const linkedVendor = task.source_vendor_id ? vendorLookup[task.source_vendor_id] : null;
      const key = task.category || linkedVendor?.category || 'Uncategorized';
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
      return groups;
    }, {});
  }, [done, vendorLookup]);

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

  const TaskCard = ({ t, isDone }: { t: Task; isDone: boolean }) => {
    const linkedVendor = t.source_vendor_id ? vendorLookup[t.source_vendor_id] : null;
    const resolvedCategory = t.category || linkedVendor?.category || null;
    const linkedBudget = resolvedCategory ? budgetLookup[normalizeCategory(resolvedCategory)] : null;
    const outstandingAmount =
      linkedVendor && linkedVendor.price != null ? Math.max(linkedVendor.price - linkedVendor.amount_paid, 0) : null;

    return (
      <Card key={t.id} className={`shadow-card ${isDone ? 'opacity-60' : ''}`}>
        <CardContent className="flex items-start gap-3 py-3">
          <Checkbox checked={isDone} onCheckedChange={() => toggleTask(t.id, t.completed)} className="mt-1" />
          <div className="min-w-0 flex-1">
            <p className={`truncate font-medium text-card-foreground ${isDone ? 'line-through text-muted-foreground' : ''}`}>{t.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {linkedVendor && (
                <Badge variant="outline" className="rounded-full text-[11px]">
                  <BriefcaseBusiness className="mr-1 h-3 w-3" />
                  {linkedVendor.name} · {selectionLabel(linkedVendor.selection_status)}
                </Badge>
              )}
              {resolvedCategory && (
                <Badge variant="secondary" className="rounded-full text-[11px]">
                  {resolvedCategory}
                </Badge>
              )}
              {linkedBudget && (
                <Badge variant="outline" className="rounded-full text-[11px]">
                  Budget KES {linkedBudget.spent.toLocaleString()} / {linkedBudget.allocated.toLocaleString()}
                </Badge>
              )}
              {phaseLabel(t.phase) && (
                <Badge variant="outline" className="rounded-full text-[11px]">
                  {phaseLabel(t.phase)}
                </Badge>
              )}
              <Badge variant={t.visibility === 'private' ? 'destructive' : 'outline'} className="rounded-full text-[11px]">
                {t.visibility === 'private' ? 'Private' : 'Public'}
              </Badge>
              {t.priority_level != null && (
                <Badge variant="outline" className="rounded-full text-[11px]">
                  P{t.priority_level} · {priorityLabel(t.priority_level)}
                </Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5">
              {t.due_date && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" /> {new Date(t.due_date).toLocaleDateString()}
                </p>
              )}
              {t.assigned_to && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <UserCircle className="h-3 w-3" /> {t.assigned_to}
                </p>
              )}
              {t.delegatable && t.recommended_role && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Link2 className="h-3 w-3" /> Delegate to {t.recommended_role}
                </p>
              )}
              {linkedVendor && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <BriefcaseBusiness className="h-3 w-3" /> {vendorPaymentStatusLabel(linkedVendor.payment_status)}
                  {outstandingAmount != null ? ` · KES ${outstandingAmount.toLocaleString()} outstanding` : ''}
                </p>
              )}
              {linkedBudget && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Link2 className="h-3 w-3" />
                  {linkedBudget.budget_scope === 'personal' ? 'Personal budget' : 'Wedding budget'} · KES{' '}
                  {(linkedBudget.allocated - linkedBudget.spent).toLocaleString()} remaining
                </p>
              )}
            </div>
            {t.description && <p className="mt-2 text-sm text-muted-foreground">{t.description}</p>}
          </div>
          {t.due_date && (
            calendarDecision.allowed ? (
              <a
                href={buildGoogleCalendarUrl({
                  title: t.title,
                  date: t.due_date,
                  description: [
                    linkedVendor ? `Vendor: ${linkedVendor.name}` : null,
                    t.category ? `Category: ${t.category}` : null,
                    t.description,
                    t.assigned_to ? `Assigned to: ${t.assigned_to}` : null,
                  ]
                    .filter(Boolean)
                    .join('\n'),
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 text-muted-foreground transition-colors hover:text-primary"
                title="Add to Google Calendar"
              >
                <CalendarPlus className="h-4 w-4" />
              </a>
            ) : (
              <button
                type="button"
                className="mt-1 text-muted-foreground transition-colors hover:text-primary"
                title="Upgrade to unlock Google Calendar sync"
                onClick={() => setUpgradeOpen(true)}
              >
                <CalendarPlus className="h-4 w-4" />
              </button>
            )
          )}
          <button onClick={() => deleteTask(t.id)} className="mt-1 text-muted-foreground transition-colors hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Tasks</h1>
          <p className="text-muted-foreground">{pending.length} pending, {done.length} completed</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto">
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
            <DialogTrigger asChild>
              <Button className="w-full gap-2 sm:w-auto"><Plus className="h-4 w-4" /> Add Task</Button>
            </DialogTrigger>
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

      <div className="space-y-6">
        {taskViewMode === 'by_date' && (
          <>
            {urgentPending.length > 0 && (
              <div className="space-y-3 border-t border-border pt-6">
                <h2 className="text-2xl font-semibold text-destructive">Complete As Soon As Possible</h2>
                {urgentPending.map((task) => <TaskCard key={task.id} t={task} isDone={false} />)}
              </div>
            )}
            {Object.entries(byDateGroups).map(([label, group]) => (
              <div key={label} className="space-y-3 border-t border-border pt-6">
                <h2 className="text-2xl font-semibold text-foreground">{label}</h2>
                {group.map((task) => <TaskCard key={task.id} t={task} isDone={false} />)}
              </div>
            ))}
          </>
        )}

        {taskViewMode === 'by_category' && (
          <>
            {sortedCategoryGroups.map(([label, group]) => (
                <div key={label} className="space-y-3 border-t border-border pt-6">
                  <h2 className="text-2xl font-semibold text-foreground">{label}</h2>
                  {group.map((task) => <TaskCard key={task.id} t={task} isDone={false} />)}
                </div>
              ))}
          </>
        )}

        {taskViewMode === 'completed' && (
          <>
            {Object.entries(completedByCategory)
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([label, group]) => (
                <div key={label} className="space-y-3 border-t border-border pt-6">
                  <h2 className="text-2xl font-semibold text-foreground">{label}</h2>
                  {group.map((task) => <TaskCard key={task.id} t={task} isDone />)}
                </div>
              ))}
          </>
        )}

        {((taskViewMode === 'completed' && done.length === 0) ||
          (taskViewMode !== 'completed' && pending.length === 0)) && (
          <p className="py-12 text-center text-muted-foreground">
            {taskViewMode === 'completed' ? 'No completed tasks yet.' : 'No tasks yet. Add your first planning to-do.'}
          </p>
        )}
      </div>
    </div>
  );
}
