import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AnimatedCardDetails } from '@/components/AnimatedCardDetails';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { committeeResponsibilityOptions, contractStatusLabel, contractStatusOptions } from '@/lib/committeeRoles';
import { createVendorPriceObservation, getVendorPriceBenchmark, type VendorPriceBenchmark } from '@/lib/vendorPriceIntelligence';
import { vendorPaymentStatusLabel, vendorPaymentStatusTone } from '@/lib/vendorPayments';
import { personalBudgetTemplates } from '@/lib/personalBudgetTemplates';
import { weddingBudgetTemplates } from '@/lib/weddingBudgetTemplates';
import { getEntitlementDecision } from '@/lib/entitlements';
import { useWeddingEntitlements } from '@/hooks/useWeddingEntitlements';
import { UpgradePromptDialog } from '@/components/UpgradePrompt';
import { downloadCsv, safeDateLabel } from '@/lib/exportHelpers';
import InfoTip from '@/components/InfoTip';
import { getCheckoutReferenceFromSearchParams, syncCoupleCheckout } from '@/lib/billing';
import { submitPlannerChangeRequest } from '@/lib/plannerChangeRequests';
import { WorkspacePageSkeleton } from '@/components/AppLoadingSkeletons';
import { FormFieldError, FormSubmitError } from '@/components/FormFeedback';
import { createVendorTask } from '@/lib/vendorTasks';
import { getSuggestedTaskTemplates, type SuggestedTaskTemplateOption } from '@/lib/weddingTaskTemplates';
import { SlidingSegmentedControl } from '@/components/SlidingSegmentedControl';
import { hasPendingEstimatorPlanDraft, seedPendingEstimatorPlanForUser } from '@/lib/estimatorPlanSeed';
import {
  getRecordedVendorsForBudgetCategory,
  getRelatedTasksForBudgetCategory,
  planningCategoryRelationScore,
} from '@/lib/budgetRelations';

interface BudgetCategory {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  budget_scope: 'wedding' | 'personal';
  visibility: 'public' | 'private';
  committee_role_in_charge: string | null;
  contract_status: string;
  suggested_allocated: number | null;
  suggested_percentage: number | null;
  allocation_manually_edited: boolean;
  allocation_last_edited_field: 'amount' | 'percentage' | null;
}

type BudgetScope = 'wedding' | 'personal';
type BudgetWorkflowDraft = {
  committeeRoleInCharge: string;
  contractStatus: string;
};

interface SpendLogForm {
  vendorName: string;
  amount: string;
  notes: string;
  addToSpent: boolean;
}

interface FinalVendorPayment {
  id: string;
  name: string;
  category: string;
  price: number | null;
  amount_paid: number;
  payment_status: string;
  payment_due_date: string | null;
}

interface BudgetPaymentRecord {
  id: string;
  amount: number;
  budget_scope: BudgetScope;
  category_name: string;
  payee_name: string;
  payment_date: string;
  reference: string | null;
  notes: string | null;
  vendor_id: string | null;
  budget_category_id: string | null;
}

interface BudgetVendorOption {
  id: string;
  name: string;
  category: string;
  price: number | null;
  amount_paid: number;
  payment_status: string;
  payment_due_date: string | null;
  selection_status?: string | null;
  vendor_listing_id?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

interface DirectoryVendorSuggestion {
  id: string;
  business_name: string;
  category: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  is_verified: boolean;
}

interface BudgetTaskOption {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  completed: boolean;
  source_vendor_id: string | null;
}

interface PaymentCategoryOption {
  value: string;
  name: string;
  budgetCategoryId: string | null;
}

type BudgetViewMode = 'by_category' | 'payments_made';

interface PaymentLogForm {
  budgetScope: BudgetScope;
  categorySelection: string;
  vendorId: string;
  payeeName: string;
  amount: string;
  paymentDate: string;
  reference: string;
  notes: string;
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return 'N/A';
  return `KES ${Number(value).toLocaleString()}`;
}

function normalizeCategoryName(value: string) {
  return value.trim().toLowerCase();
}

function benchmarkKey(category: string) {
  return category.toLowerCase().trim();
}

function benchmarkSummary(benchmark?: VendorPriceBenchmark | null) {
  if (!benchmark) return 'Loading market data...';
  if (benchmark.benchmark_visible) {
    return `Median ${formatCurrency(benchmark.median_amount)} · Range ${formatCurrency(benchmark.minimum_amount)} - ${formatCurrency(benchmark.maximum_amount)}`;
  }
  if (benchmark.sample_size > 0) {
    return `${benchmark.sample_size} observations captured. Benchmarks unlock at 5 samples.`;
  }
  return 'No market observations captured yet for this category.';
}

async function loadBudgetCategories(dataOrFilter: string): Promise<BudgetCategory[]> {
  const { data, error } = await supabase.from('budget_categories').select('*').or(dataOrFilter).order('created_at');
  if (error) throw error;

  return ((data ?? []) as any[]).map((item) => ({
    ...item,
    allocated: Number(item.allocated),
    spent: Number(item.spent),
    budget_scope: (item.budget_scope ?? 'wedding') as BudgetScope,
    visibility: (item.visibility ?? 'public') as 'public' | 'private',
    committee_role_in_charge: item.committee_role_in_charge ?? null,
    contract_status: item.contract_status ?? (item.budget_scope === 'personal' ? 'not_required' : 'not_started'),
    suggested_allocated: item.suggested_allocated == null ? null : Number(item.suggested_allocated),
    suggested_percentage: item.suggested_percentage == null ? null : Number(item.suggested_percentage),
    allocation_manually_edited: Boolean(item.allocation_manually_edited),
    allocation_last_edited_field:
      item.allocation_last_edited_field === 'amount' || item.allocation_last_edited_field === 'percentage'
        ? item.allocation_last_edited_field
        : null,
  })) as BudgetCategory[];
}

async function loadBudgetVendorOptions(dataOrFilter: string): Promise<BudgetVendorOption[]> {
  const { data, error } = await supabase
    .from('vendors')
    .select('id, name, category, price, amount_paid, payment_status, payment_due_date, selection_status, vendor_listing_id, phone, email, notes')
    .or(dataOrFilter)
    .order('category');

  if (error) throw error;

  return ((data ?? []) as any[]).map((row) => ({
    ...row,
    amount_paid: Number(row.amount_paid ?? 0),
    price: row.price != null ? Number(row.price) : null,
  }));
}

async function loadDirectoryVendorSuggestions(): Promise<DirectoryVendorSuggestion[]> {
  const { data, error } = await supabase
    .from('vendor_listings')
    .select('id, business_name, category, phone, email, location, is_verified')
    .eq('is_approved', true)
    .order('is_verified', { ascending: false })
    .order('business_name')
    .limit(200);

  if (error) throw error;
  return (data ?? []) as DirectoryVendorSuggestion[];
}

async function loadBudgetPaymentRecords(dataOrFilter: string): Promise<BudgetPaymentRecord[]> {
  const { data, error } = await supabase
    .from('budget_payments')
    .select('*')
    .or(dataOrFilter)
    .order('payment_date', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as any[]).map((row) => ({
    ...row,
    amount: Number(row.amount ?? 0),
  })) as BudgetPaymentRecord[];
}

async function loadBudgetTasks(dataOrFilter: string): Promise<BudgetTaskOption[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, description, category, completed, source_vendor_id')
    .or(dataOrFilter)
    .order('completed');

  if (error) throw error;
  return (data ?? []) as BudgetTaskOption[];
}

export default function Budget() {
  const { user, profile } = useAuth();
  const { isPlanner, selectedClient, dataOrFilter, plannerClientHydrating } = usePlanner();
  const { entitlements: weddingEntitlements, couplePlanTier, refresh } = useWeddingEntitlements();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();
  const plannerNeedsApproval = isPlanner && Boolean(selectedClient?.linked_user_id);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [allocated, setAllocated] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryFormErrors, setCategoryFormErrors] = useState<{ name?: string; allocated?: string }>({});
  const [categorySubmitError, setCategorySubmitError] = useState<string | null>(null);
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [newCategoryScope, setNewCategoryScope] = useState<BudgetScope>('wedding');
  const [activeBudgetScope, setActiveBudgetScope] = useState<BudgetScope>('wedding');
  const [budgetViewMode, setBudgetViewMode] = useState<BudgetViewMode>('by_category');
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [inlineModule, setInlineModule] = useState<{ categoryId: string; type: 'vendor' | 'task' } | null>(null);
  const [inlineVendorDrafts, setInlineVendorDrafts] = useState<Record<string, string>>({});
  const [inlineTaskDrafts, setInlineTaskDrafts] = useState<Record<string, string>>({});
  const [savingInlineVendorId, setSavingInlineVendorId] = useState<string | null>(null);
  const [savingInlineTaskId, setSavingInlineTaskId] = useState<string | null>(null);
  const [spentDrafts, setSpentDrafts] = useState<Record<string, string>>({});
  const [allocationDrafts, setAllocationDrafts] = useState<Record<string, { amount: string; percentage: string; lastEditedField: 'amount' | 'percentage' }>>({});
  const [savingAllocationId, setSavingAllocationId] = useState<string | null>(null);
  const [workflowDrafts, setWorkflowDrafts] = useState<Record<string, BudgetWorkflowDraft>>({});
  const [savingSpentId, setSavingSpentId] = useState<string | null>(null);
  const [savingWorkflowId, setSavingWorkflowId] = useState<string | null>(null);
  const [benchmarksLoading, setBenchmarksLoading] = useState(false);
  const [categoryBenchmarks, setCategoryBenchmarks] = useState<Record<string, VendorPriceBenchmark>>({});
  const [addModalBenchmark, setAddModalBenchmark] = useState<VendorPriceBenchmark | null>(null);
  const [addModalBenchmarkLoading, setAddModalBenchmarkLoading] = useState(false);
  const [recordingCategory, setRecordingCategory] = useState<BudgetCategory | null>(null);
  const [recordingSpend, setRecordingSpend] = useState(false);
  const [spendFormErrors, setSpendFormErrors] = useState<{ vendorName?: string; amount?: string }>({});
  const [spendSubmitError, setSpendSubmitError] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [recordingPaymentMade, setRecordingPaymentMade] = useState(false);
  const [paymentRecorded, setPaymentRecorded] = useState(false);
  const paymentSuccessTimerRef = useRef<number | null>(null);
  const estimatorRecoveryAttemptedRef = useRef(false);
  const [paymentFormErrors, setPaymentFormErrors] = useState<{ categorySelection?: string; payeeName?: string; amount?: string }>({});
  const [paymentSubmitError, setPaymentSubmitError] = useState<string | null>(null);
  const [exportUpgradeOpen, setExportUpgradeOpen] = useState(false);
  const [spendLog, setSpendLog] = useState<SpendLogForm>({
    vendorName: '',
    amount: '',
    notes: '',
    addToSpent: true,
  });
  const [paymentLog, setPaymentLog] = useState<PaymentLogForm>({
    budgetScope: 'wedding',
    categorySelection: '',
    vendorId: '',
    payeeName: '',
    amount: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    reference: '',
    notes: '',
  });
  const [processedCheckoutSessionId, setProcessedCheckoutSessionId] = useState<string | null>(null);
  const upgradeState = searchParams.get('upgrade');
  const checkoutReference = getCheckoutReferenceFromSearchParams(searchParams);

  const categoriesQueryKey = ['budget', user?.id ?? null, selectedClient?.id ?? null, dataOrFilter ?? null];
  const vendorsQueryKey = ['budget-vendors', user?.id ?? null, selectedClient?.id ?? null, dataOrFilter ?? null];
  const paymentsQueryKey = ['budget-payments', user?.id ?? null, selectedClient?.id ?? null, dataOrFilter ?? null];
  const tasksQueryKey = ['budget-tasks', user?.id ?? null, selectedClient?.id ?? null, dataOrFilter ?? null];

  const categoriesQuery = useQuery({
    queryKey: categoriesQueryKey,
    queryFn: () => loadBudgetCategories(dataOrFilter!),
    enabled: Boolean(dataOrFilter),
    staleTime: 30_000,
  });

  const vendorOptionsQuery = useQuery({
    queryKey: vendorsQueryKey,
    queryFn: () => loadBudgetVendorOptions(dataOrFilter!),
    enabled: Boolean(dataOrFilter),
    staleTime: 30_000,
  });

  const paymentRecordsQuery = useQuery({
    queryKey: paymentsQueryKey,
    queryFn: () => loadBudgetPaymentRecords(dataOrFilter!),
    enabled: Boolean(dataOrFilter),
    staleTime: 30_000,
  });

  const tasksQuery = useQuery({
    queryKey: tasksQueryKey,
    queryFn: () => loadBudgetTasks(dataOrFilter!),
    enabled: Boolean(dataOrFilter),
    staleTime: 30_000,
  });

  const directorySuggestionsQuery = useQuery({
    queryKey: ['budget-directory-suggestions'],
    queryFn: loadDirectoryVendorSuggestions,
    enabled: Boolean(dataOrFilter),
    staleTime: 5 * 60_000,
  });

  const categories = categoriesQuery.data ?? [];
  const vendorOptions = vendorOptionsQuery.data ?? [];
  const paymentRecords = paymentRecordsQuery.data ?? [];
  const budgetTasks = tasksQuery.data ?? [];
  const directorySuggestions = directorySuggestionsQuery.data ?? [];

  useEffect(() => {
    if (
      estimatorRecoveryAttemptedRef.current
      || isPlanner
      || !user
      || categoriesQuery.isLoading
      || categoriesQuery.isError
      || categories.length > 0
      || !hasPendingEstimatorPlanDraft(user.user_metadata)
    ) return;

    estimatorRecoveryAttemptedRef.current = true;
    void (async () => {
      const result = await seedPendingEstimatorPlanForUser({
        userId: user.id,
        role: profile?.role,
        userMetadata: user.user_metadata,
      });

      if (!result) return;
      await refreshBudgetWorkspace();
      toast({
        title: 'Wedding estimate restored',
        description: 'Your saved estimate is now in your budget.',
      });
    })();
  }, [categories.length, categoriesQuery.isError, categoriesQuery.isLoading, isPlanner, profile?.role, user]);

  useEffect(() => () => {
    if (paymentSuccessTimerRef.current != null) window.clearTimeout(paymentSuccessTimerRef.current);
  }, []);
  const finalVendorPayments = useMemo(
    () => vendorOptions.filter((row) => row.selection_status === 'final') as FinalVendorPayment[],
    [vendorOptions],
  );

  const refreshBudgetWorkspace = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: categoriesQueryKey }),
      queryClient.invalidateQueries({ queryKey: vendorsQueryKey }),
      queryClient.invalidateQueries({ queryKey: paymentsQueryKey }),
      queryClient.invalidateQueries({ queryKey: tasksQueryKey }),
    ]);
  };

  const addInlineVendor = async (category: BudgetCategory, suggestion?: DirectoryVendorSuggestion) => {
    if (!user) return;
    const vendorName = suggestion?.business_name ?? inlineVendorDrafts[category.id]?.trim();
    if (!vendorName) {
      toast({ title: 'Enter a vendor name', description: 'Add the business name before saving.' });
      return;
    }

    const savingKey = suggestion?.id ?? `custom-${category.id}`;
    setSavingInlineVendorId(savingKey);
    const insert: Record<string, unknown> = {
      user_id: user.id,
      name: vendorName,
      category: category.name,
      phone: suggestion?.phone ?? null,
      email: suggestion?.email ?? null,
      price: null,
      status: 'contacted',
      selection_status: 'shortlisted',
      vendor_listing_id: suggestion?.id ?? null,
    };
    if (isPlanner && selectedClient) insert.client_id = selectedClient.id;

    try {
      if (plannerNeedsApproval && selectedClient?.linked_user_id) {
        await submitPlannerChangeRequest({
          clientId: selectedClient.id,
          coupleUserId: selectedClient.linked_user_id,
          plannerUserId: user.id,
          targetTable: 'vendors',
          changeType: 'create',
          proposedPayload: {
            name: insert.name,
            category: insert.category,
            phone: insert.phone,
            email: insert.email,
            price: insert.price,
            status: insert.status,
            selection_status: insert.selection_status,
            vendor_listing_id: insert.vendor_listing_id,
          },
        });
        toast({ title: 'Vendor sent for approval', description: `${vendorName} will appear after the couple approves it.` });
      } else {
        const { error } = await supabase.from('vendors').insert(insert);
        if (error) throw error;
        toast({ title: 'Vendor added', description: `${vendorName} is now linked to ${category.name}.` });
      }
      setInlineVendorDrafts((current) => ({ ...current, [category.id]: '' }));
      await queryClient.invalidateQueries({ queryKey: vendorsQueryKey });
    } catch (error: unknown) {
      toast({
        title: 'Could not add vendor',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingInlineVendorId(null);
    }
  };

  const addInlineTask = async (category: BudgetCategory, suggestion?: SuggestedTaskTemplateOption) => {
    if (!user) return;
    const taskTitle = suggestion?.title ?? inlineTaskDrafts[category.id]?.trim();
    if (!taskTitle) {
      toast({ title: 'Enter a task', description: 'Add a short task before saving.' });
      return;
    }

    const savingKey = suggestion?.key ?? `custom-${category.id}`;
    setSavingInlineTaskId(savingKey);
    try {
      if (plannerNeedsApproval && selectedClient?.linked_user_id) {
        await submitPlannerChangeRequest({
          clientId: selectedClient.id,
          coupleUserId: selectedClient.linked_user_id,
          plannerUserId: user.id,
          targetTable: 'tasks',
          changeType: 'create',
          proposedPayload: {
            title: taskTitle,
            description: suggestion?.description ?? null,
            category: category.name,
            phase: suggestion?.phase ?? null,
            visibility: suggestion?.visibility ?? 'public',
            priority_level: suggestion?.priorityLevel ?? null,
            delegatable: suggestion?.delegatable ?? false,
            recommended_role: suggestion?.recommendedRole ?? null,
            template_source: suggestion ? 'budget_context_suggestion_v1' : 'budget_context_custom_v1',
            completed: false,
          },
        });
        toast({ title: 'Task sent for approval', description: 'The couple will review it before it is added.' });
      } else {
        await createVendorTask({
          userId: user.id,
          clientId: isPlanner && selectedClient ? selectedClient.id : null,
          title: taskTitle,
          description: suggestion?.description ?? null,
          category: category.name,
          phase: suggestion?.phase ?? null,
          visibility: suggestion?.visibility ?? 'public',
          priorityLevel: suggestion?.priorityLevel ?? null,
          delegatable: suggestion?.delegatable ?? false,
          recommendedRole: suggestion?.recommendedRole ?? null,
          templateSource: suggestion ? 'budget_context_suggestion_v1' : 'budget_context_custom_v1',
        });
        toast({ title: 'Task added', description: `It is now connected to ${category.name}.` });
      }
      setInlineTaskDrafts((current) => ({ ...current, [category.id]: '' }));
      await queryClient.invalidateQueries({ queryKey: tasksQueryKey });
    } catch (error: unknown) {
      toast({
        title: 'Could not add task',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingInlineTaskId(null);
    }
  };

  useEffect(() => {
    if (
      upgradeState !== 'success'
      || !checkoutReference
      || processedCheckoutSessionId === checkoutReference
      || !profile
    ) {
      return;
    }

    let cancelled = false;
    setProcessedCheckoutSessionId(checkoutReference);

    const runSync = async () => {
      try {
        const result = await syncCoupleCheckout(checkoutReference);
        if (cancelled) return;

        await refresh();
        if (cancelled) return;

        const planLabel = result.couplePlanTier === 'premium' ? 'Premium' : 'Basic';
        toast({
          title: `${planLabel} activated`,
          description: 'Your wedding workspace now has the upgraded planning access.',
        });
        navigate('/budget?upgrade=success', { replace: true });
      } catch (error: any) {
        if (cancelled) return;
        toast({
          title: 'Payment received. Waiting for activation',
          description: error?.message || 'The checkout succeeded, but we could not sync your wedding upgrade yet.',
          variant: 'destructive',
        });
      }
    };

    void runSync();

    return () => {
      cancelled = true;
    };
  }, [checkoutReference, navigate, processedCheckoutSessionId, profile, refresh, toast, upgradeState]);

  useEffect(() => {
    if (isPlanner && !plannerClientHydrating && !selectedClient) navigate('/clients');
  }, [isPlanner, plannerClientHydrating, selectedClient, navigate]);

  const showPersonalBudget = !isPlanner;
  const exportFeature = isPlanner
    ? profile?.planner_type === 'committee'
      ? 'committee.export_progress'
      : 'planner.export_progress'
    : 'couple.export_progress';
  const exportDecision = getEntitlementDecision(exportFeature, { profile, weddingEntitlements, couplePlanTier });

  useEffect(() => {
    if (!showPersonalBudget && activeBudgetScope === 'personal') {
      setActiveBudgetScope('wedding');
    }
  }, [showPersonalBudget, activeBudgetScope]);

  useEffect(() => {
    if (open) {
      setNewCategoryScope(activeBudgetScope);
      setSelectedTemplateName('');
    }
  }, [open, activeBudgetScope]);

  useEffect(() => {
    if (paymentDialogOpen) {
      setPaymentRecorded(false);
      setPaymentLog((prev) => ({
        ...prev,
        budgetScope: activeBudgetScope,
        categorySelection: '',
        vendorId: '',
        payeeName: '',
        amount: '',
        paymentDate: new Date().toISOString().slice(0, 10),
        reference: '',
        notes: '',
      }));
    }
  }, [paymentDialogOpen, activeBudgetScope]);

  useEffect(() => {
    setSelectedTemplateName('');
    setName('');
  }, [newCategoryScope]);

  useEffect(() => {
    setSpentDrafts(Object.fromEntries(categories.map((row) => [row.id, String(row.spent || 0)])));
    setWorkflowDrafts(
      Object.fromEntries(
        categories.map((row) => [
          row.id,
          {
            committeeRoleInCharge: row.committee_role_in_charge ?? 'unassigned',
            contractStatus: row.contract_status ?? (row.budget_scope === 'personal' ? 'not_required' : 'not_started'),
          },
        ]),
      ),
    );
  }, [categories]);

  const loadBenchmarks = async (rows: BudgetCategory[]) => {
    if (!rows.length) {
      setCategoryBenchmarks({});
      return;
    }

    setBenchmarksLoading(true);
    try {
      const uniqueCategories = [...new Set(rows.filter((row) => row.budget_scope === 'wedding').map((row) => row.name).filter(Boolean))];
      const results = await Promise.all(
        uniqueCategories.map(async (category) => [
          benchmarkKey(category),
          await getVendorPriceBenchmark({
            category,
            venue: selectedClient?.wedding_location ?? null,
            minSampleSize: 5,
          }),
        ] as const),
      );

      setCategoryBenchmarks(Object.fromEntries(results));
    } catch (error: any) {
      toast({
        title: 'Failed to load budget benchmarks',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setBenchmarksLoading(false);
    }
  };

  useEffect(() => {
    void loadBenchmarks(categories);
  }, [categories, selectedClient?.wedding_location]);

  useEffect(() => {
    if (!open) return;

    let active = true;
    const run = async () => {
      if (!name.trim()) {
        setAddModalBenchmark(null);
        return;
      }

      setAddModalBenchmarkLoading(true);
      try {
        const result = await getVendorPriceBenchmark({
          category: name.trim(),
          venue: selectedClient?.wedding_location ?? null,
          minSampleSize: 5,
        });
        if (active) setAddModalBenchmark(result);
      } catch {
        if (active) setAddModalBenchmark(null);
      } finally {
        if (active) setAddModalBenchmarkLoading(false);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [open, name, selectedClient?.wedding_location]);

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const nextErrors: { name?: string; allocated?: string } = {};
    const allocatedAmount = allocated.trim() === '' ? Number.NaN : parseFloat(allocated);
    if (!name.trim()) nextErrors.name = 'Choose a suggested category or type your own before saving.';
    if (!Number.isFinite(allocatedAmount) || allocatedAmount < 0) nextErrors.allocated = 'Enter a valid allocated amount in KES.';
    setCategoryFormErrors(nextErrors);
    setCategorySubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setAddingCategory(true);

    const insert: Record<string, unknown> = {
      user_id: user.id,
      name,
      allocated: allocatedAmount,
      suggested_allocated: allocatedAmount,
      suggested_percentage: newCategoryScope === 'wedding' && visibleBudgetGoal > 0
        ? (allocatedAmount / visibleBudgetGoal) * 100
        : null,
      allocation_manually_edited: false,
      allocation_last_edited_field: null,
      spent: 0,
      budget_scope: newCategoryScope,
      visibility: newCategoryScope === 'personal' ? 'private' : 'public',
    };

    if (newCategoryScope === 'wedding' && isPlanner && selectedClient) insert.client_id = selectedClient.id;

    if (plannerNeedsApproval && newCategoryScope === 'wedding' && selectedClient?.linked_user_id) {
      try {
        await submitPlannerChangeRequest({
          clientId: selectedClient.id,
          coupleUserId: selectedClient.linked_user_id,
          plannerUserId: user.id,
          targetTable: 'budget_categories',
          changeType: 'create',
          proposedPayload: {
            name: insert.name,
            allocated: insert.allocated,
            suggested_allocated: insert.suggested_allocated,
            suggested_percentage: insert.suggested_percentage,
            allocation_manually_edited: insert.allocation_manually_edited,
            allocation_last_edited_field: insert.allocation_last_edited_field,
            spent: insert.spent,
            budget_scope: insert.budget_scope,
            visibility: insert.visibility,
          },
        });
        setName('');
        setAllocated('');
        setSelectedTemplateName('');
        setOpen(false);
        toast({
          title: 'Budget category sent for approval',
          description: 'The couple will review this budget line before it goes live.',
        });
      } catch (error: any) {
        setCategorySubmitError(error?.message || 'We could not submit this budget category for approval.');
        toast({ title: 'Could not submit budget request', description: error?.message, variant: 'destructive' });
      } finally {
        setAddingCategory(false);
      }
      return;
    }

    const { error } = await supabase.from('budget_categories').insert(insert);
    if (error) {
      setCategorySubmitError(error.message || 'We could not save this budget category right now.');
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setAddingCategory(false);
      return;
    }

    setName('');
    setAllocated('');
    setSelectedTemplateName('');
    setOpen(false);
    await queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
    setAddingCategory(false);
  };

  const saveSpent = async (category: BudgetCategory) => {
    const draft = spentDrafts[category.id]?.trim() ?? '';
    const nextSpent = draft === '' ? 0 : Number(draft);

    if (!Number.isFinite(nextSpent) || nextSpent < 0) {
      toast({
        title: 'Invalid spent amount',
        description: 'Enter a valid KES amount that is zero or higher.',
        variant: 'destructive',
      });
      return;
    }

    setSavingSpentId(category.id);
    if (plannerNeedsApproval && selectedClient?.linked_user_id) {
      try {
        await submitPlannerChangeRequest({
          clientId: selectedClient.id,
          coupleUserId: selectedClient.linked_user_id,
          plannerUserId: user!.id,
          targetTable: 'budget_categories',
          changeType: 'update',
          targetId: category.id,
          currentPayload: { spent: category.spent },
          proposedPayload: { spent: nextSpent },
        });
        toast({
          title: 'Spent update sent for approval',
          description: `${category.name} will update after the couple approves it.`,
        });
      } catch (error: any) {
        toast({ title: 'Could not submit spent update', description: error?.message, variant: 'destructive' });
      }
      setSavingSpentId(null);
      return;
    }
    const { error } = await supabase
      .from('budget_categories')
      .update({ spent: nextSpent })
      .eq('id', category.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'Spent total updated',
        description: `${category.name} now shows ${formatCurrency(nextSpent)} spent.`,
      });
      await queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
    }
    setSavingSpentId(null);
  };

  const deleteCategory = async (id: string) => {
    if (plannerNeedsApproval && selectedClient?.linked_user_id) {
      const category = categories.find((item) => item.id === id);
      if (!category) return;
      try {
        await submitPlannerChangeRequest({
          clientId: selectedClient.id,
          coupleUserId: selectedClient.linked_user_id,
          plannerUserId: user!.id,
          targetTable: 'budget_categories',
          changeType: 'delete',
          targetId: id,
          currentPayload: category as unknown as Record<string, unknown>,
          proposedPayload: { name: category.name, allocated: category.allocated },
        });
        toast({
          title: 'Budget removal sent for approval',
          description: `${category.name} will only be removed if the couple approves it.`,
        });
      } catch (error: any) {
        toast({ title: 'Could not submit removal request', description: error?.message, variant: 'destructive' });
      }
      return;
    }
    await supabase.from('budget_categories').delete().eq('id', id);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: categoriesQueryKey }),
      queryClient.invalidateQueries({ queryKey: paymentsQueryKey }),
    ]);
  };

  const saveWorkflow = async (category: BudgetCategory) => {
    const draft = workflowDrafts[category.id];
    if (!draft) return;

    setSavingWorkflowId(category.id);
    if (plannerNeedsApproval && selectedClient?.linked_user_id) {
      try {
        await submitPlannerChangeRequest({
          clientId: selectedClient.id,
          coupleUserId: selectedClient.linked_user_id,
          plannerUserId: user!.id,
          targetTable: 'budget_categories',
          changeType: 'update',
          targetId: category.id,
          currentPayload: category as unknown as Record<string, unknown>,
          proposedPayload: {
            committee_role_in_charge: draft.committeeRoleInCharge === 'unassigned' ? null : draft.committeeRoleInCharge,
            contract_status: draft.contractStatus,
          },
        });
        toast({
          title: 'Budget workflow sent for approval',
          description: `${category.name} changes are waiting for couple approval.`,
        });
      } catch (error: any) {
        toast({ title: 'Could not submit workflow update', description: error?.message, variant: 'destructive' });
      }
      setSavingWorkflowId(null);
      return;
    }
    const { error } = await supabase
      .from('budget_categories')
      .update({
        committee_role_in_charge: draft.committeeRoleInCharge === 'unassigned' ? null : draft.committeeRoleInCharge,
        contract_status: draft.contractStatus,
      })
      .eq('id', category.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'Budget workflow updated',
        description: `${category.name} now tracks ownership and contract state.`,
      });
      await queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
    }
    setSavingWorkflowId(null);
  };

  const openSpendRecorder = (category: BudgetCategory) => {
    setRecordingCategory(category);
    setSpendLog({
      vendorName: '',
      amount: '',
      notes: '',
      addToSpent: true,
    });
  };

  const recordSpendObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordingCategory) return;

    const amount = Number(spendLog.amount);
    const nextErrors: { vendorName?: string; amount?: string } = {};
    if (!Number.isFinite(amount) || amount <= 0) nextErrors.amount = 'Enter a real KES amount greater than zero.';
    if (!spendLog.vendorName.trim()) nextErrors.vendorName = 'Enter the vendor or payee name for this spend.';
    setSpendFormErrors(nextErrors);
    setSpendSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setRecordingSpend(true);
    if (plannerNeedsApproval && selectedClient?.linked_user_id) {
      try {
        await submitPlannerChangeRequest({
          clientId: selectedClient.id,
          coupleUserId: selectedClient.linked_user_id,
          plannerUserId: user!.id,
          targetTable: 'budget_categories',
          changeType: 'update',
          targetId: recordingCategory.id,
          currentPayload: { spent: recordingCategory.spent },
          proposedPayload: { spent: recordingCategory.spent + amount },
          note: `${spendLog.vendorName.trim()} • ${spendLog.notes.trim() || 'Spend observation'}`,
        });
        toast({
          title: 'Spend update sent for approval',
          description: 'The couple can approve this spend adjustment before it changes the live budget.',
        });
        setRecordingCategory(null);
      } catch (error: any) {
        setSpendSubmitError(error?.message || 'We could not submit this spend update right now.');
        toast({ title: 'Could not submit spend update', description: error?.message, variant: 'destructive' });
      } finally {
        setRecordingSpend(false);
      }
      return;
    }
    try {
      await createVendorPriceObservation({
        amount,
        category: recordingCategory.name,
        vendorName: spendLog.vendorName.trim(),
        clientId: selectedClient?.id ?? null,
        source: 'budget_entry',
        priceType: 'final_paid',
        venue: selectedClient?.wedding_location ?? null,
        eventDate: selectedClient?.wedding_date ?? null,
        notes: spendLog.notes.trim() || null,
        isAnonymized: true,
      });

      if (spendLog.addToSpent) {
        const nextSpent = recordingCategory.spent + amount;
        const { error } = await supabase
          .from('budget_categories')
          .update({ spent: nextSpent })
          .eq('id', recordingCategory.id);

        if (error) throw error;
      }

      toast({
        title: 'Spend recorded',
        description: 'Your actual spend has been added to pricing intelligence.',
      });
      setRecordingCategory(null);
      await queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
    } catch (error: any) {
      setSpendSubmitError(error.message || 'We could not record this spend right now.');
      toast({
        title: 'Failed to record spend',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setRecordingSpend(false);
    }
  };

  const totalAllocated = categories.reduce((sum, category) => sum + category.allocated, 0);
  const totalSpent = categories.reduce((sum, category) => sum + category.spent, 0);
  const weddingCategories = categories.filter((category) => category.budget_scope === 'wedding');
  const personalCategories = categories.filter((category) => category.budget_scope === 'personal');
  const visibleCategories = activeBudgetScope === 'personal' ? personalCategories : weddingCategories;
  const visibleAllocated = visibleCategories.reduce((sum, category) => sum + category.allocated, 0);
  const visibleSpent = visibleCategories.reduce((sum, category) => sum + category.spent, 0);
  const storedWeddingBudgetGoal = Number(isPlanner ? selectedClient?.wedding_budget_goal : profile?.wedding_budget_goal);
  const visibleBudgetGoal = activeBudgetScope === 'wedding' && storedWeddingBudgetGoal > 0
    ? storedWeddingBudgetGoal
    : visibleAllocated;
  const visibleAllocationPercentage = visibleBudgetGoal > 0
    ? (visibleAllocated / visibleBudgetGoal) * 100
    : 0;
  const totalFinalVendorContract = finalVendorPayments.reduce((sum, vendor) => sum + (vendor.price ?? 0), 0);
  const totalFinalVendorPaid = finalVendorPayments.reduce((sum, vendor) => sum + vendor.amount_paid, 0);
  const totalFinalVendorOutstanding = finalVendorPayments.reduce(
    (sum, vendor) => sum + Math.max((vendor.price ?? 0) - vendor.amount_paid, 0),
    0,
  );

  const highlightedBenchmarks = useMemo(() => {
    return weddingCategories.slice(0, 4).map((category) => ({
      category: category.name,
      benchmark: categoryBenchmarks[benchmarkKey(category.name)],
    }));
  }, [weddingCategories, categoryBenchmarks]);

  const currentScopeCategories = activeBudgetScope === 'personal' ? personalCategories : weddingCategories;
  const paymentScopeCategories = paymentLog.budgetScope === 'personal' ? personalCategories : weddingCategories;
  const paymentCategoryOptions = useMemo<PaymentCategoryOption[]>(() => {
    const existingByName = new Map(
      paymentScopeCategories.map((category) => [normalizeCategoryName(category.name), category]),
    );
    const templateSource = paymentLog.budgetScope === 'personal' ? personalBudgetTemplates : weddingBudgetTemplates;

    const options: PaymentCategoryOption[] = paymentScopeCategories.map((category) => ({
      value: `existing:${category.id}`,
      name: category.name,
      budgetCategoryId: category.id,
    }));

    templateSource.forEach((template) => {
      const normalizedName = normalizeCategoryName(template.name);
      if (existingByName.has(normalizedName)) return;
      options.push({
        value: `template:${template.name}`,
        name: template.name,
        budgetCategoryId: null,
      });
    });

    return options.sort((left, right) => left.name.localeCompare(right.name));
  }, [paymentScopeCategories, paymentLog.budgetScope]);

  const selectedPaymentCategoryOption = paymentCategoryOptions.find(
    (option) => option.value === paymentLog.categorySelection,
  );
  const currentScopePayments = paymentRecords.filter((payment) => payment.budget_scope === activeBudgetScope);
  const currentScopePaymentTotal = currentScopePayments.reduce((sum, payment) => sum + payment.amount, 0);
  const invoiceTotal = activeBudgetScope === 'wedding' ? totalFinalVendorContract : visibleAllocated;
  const totalBalance = Math.max(invoiceTotal - currentScopePaymentTotal, 0);
  const remainingBudget = Math.max(visibleBudgetGoal - currentScopePaymentTotal, 0);
  const visibleOverBudgetCategories = useMemo(
    () => visibleCategories.filter((category) => category.allocated > 0 && category.spent > category.allocated),
    [visibleCategories],
  );

  const visibleNearLimitCategories = useMemo(
    () =>
      visibleCategories
        .filter(
          (category) =>
            category.allocated > 0 &&
            category.spent <= category.allocated &&
            category.spent / category.allocated >= 0.85,
        )
        .sort((left, right) => right.spent / right.allocated - left.spent / left.allocated),
    [visibleCategories],
  );

  const paymentsDueSoon = useMemo(() => {
    if (activeBudgetScope !== 'wedding') return [];
    const today = new Date();
    return finalVendorPayments.filter((vendor) => {
      if (!vendor.payment_due_date || vendor.payment_status === 'paid_full') return false;
      const dueDate = new Date(vendor.payment_due_date);
      const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
      return diffDays >= 0 && diffDays <= 14;
    });
  }, [activeBudgetScope, finalVendorPayments]);

  const visibleSpentPercentage = visibleBudgetGoal > 0
    ? Math.min(Math.round((visibleSpent / visibleBudgetGoal) * 100), 999)
    : 0;

  const paymentsByCategory = useMemo(() => {
    return currentScopePayments.reduce<Record<string, BudgetPaymentRecord[]>>((groups, payment) => {
      const key = payment.category_name || 'Uncategorized';
      if (!groups[key]) groups[key] = [];
      groups[key].push(payment);
      return groups;
    }, {});
  }, [currentScopePayments]);

  const availableVendorsForPayment = useMemo(() => {
    if (paymentLog.budgetScope !== 'wedding') return [];
    const selectedCategory = selectedPaymentCategoryOption?.name;
    if (!selectedCategory) return vendorOptions;
    return vendorOptions.filter((vendor) => vendor.category === selectedCategory);
  }, [paymentLog.budgetScope, selectedPaymentCategoryOption, vendorOptions]);

  const recordPaymentMade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const amount = Number(paymentLog.amount);
    const nextErrors: { categorySelection?: string; payeeName?: string; amount?: string } = {};
    if (!Number.isFinite(amount) || amount <= 0) nextErrors.amount = 'Enter a KES amount greater than zero.';

    const selectedCategoryOption = selectedPaymentCategoryOption;
    if (!selectedCategoryOption) nextErrors.categorySelection = 'Choose the budget category this payment belongs to.';

    let selectedCategory =
      paymentScopeCategories.find((category) => category.id === selectedCategoryOption.budgetCategoryId) ??
      paymentScopeCategories.find((category) => normalizeCategoryName(category.name) === normalizeCategoryName(selectedCategoryOption.name)) ??
      null;

    const selectedVendor = vendorOptions.find((vendor) => vendor.id === paymentLog.vendorId);
    const payeeName = paymentLog.payeeName.trim() || selectedVendor?.name;
    if (!payeeName) nextErrors.payeeName = 'Enter the vendor or payee name for this payment.';
    setPaymentFormErrors(nextErrors);
    setPaymentSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setRecordingPaymentMade(true);
    try {
      if (!selectedCategory) {
        if (plannerNeedsApproval) {
          throw new Error('Ask the couple to approve or create the budget category first, then record the payment.');
        }
        const insert: Record<string, unknown> = {
          user_id: user.id,
          name: selectedCategoryOption.name,
          allocated: 0,
          spent: 0,
          budget_scope: paymentLog.budgetScope,
          visibility: paymentLog.budgetScope === 'personal' ? 'private' : 'public',
        };

        if (paymentLog.budgetScope === 'wedding' && isPlanner && selectedClient) {
          insert.client_id = selectedClient.id;
        }

        const { data: insertedCategory, error: insertCategoryError } = await supabase
          .from('budget_categories')
          .insert(insert)
          .select('*')
          .single();

        if (insertCategoryError) throw insertCategoryError;

        selectedCategory = {
          ...insertedCategory,
          allocated: Number(insertedCategory.allocated ?? 0),
          spent: Number(insertedCategory.spent ?? 0),
          budget_scope: (insertedCategory.budget_scope ?? paymentLog.budgetScope) as BudgetScope,
          visibility: (insertedCategory.visibility ?? (paymentLog.budgetScope === 'personal' ? 'private' : 'public')) as 'public' | 'private',
          committee_role_in_charge: insertedCategory.committee_role_in_charge ?? null,
          contract_status:
            insertedCategory.contract_status ?? (paymentLog.budgetScope === 'personal' ? 'not_required' : 'not_started'),
        } as BudgetCategory;
      }

      if (plannerNeedsApproval && selectedClient?.linked_user_id) {
        const nextPaid = selectedVendor ? Number(selectedVendor.amount_paid ?? 0) + amount : null;
        const nextStatus =
          selectedVendor && selectedVendor.price && nextPaid != null && nextPaid >= selectedVendor.price
            ? 'paid_full'
            : selectedVendor && nextPaid != null && nextPaid > 0
              ? 'part_paid'
              : selectedVendor?.payment_status ?? null;

        await submitPlannerChangeRequest({
          clientId: selectedClient.id,
          coupleUserId: selectedClient.linked_user_id,
          plannerUserId: user.id,
          targetTable: 'budget_payments',
          changeType: 'create',
          currentPayload: {
            category_spent: selectedCategory.spent,
          },
          proposedPayload: {
            budget_category_id: selectedCategory.id,
            vendor_id: selectedVendor?.id ?? null,
            budget_scope: paymentLog.budgetScope,
            category_name: selectedCategory.name,
            payee_name: payeeName,
            amount,
            payment_date: paymentLog.paymentDate,
            reference: paymentLog.reference.trim() || null,
            notes: paymentLog.notes.trim() || null,
            vendor_amount_paid: nextPaid,
            vendor_payment_status: nextStatus,
          },
        });

        toast({
          title: 'Payment request sent for approval',
          description: `${formatCurrency(amount)} is waiting on the couple before it affects the budget.`,
        });

        setPaymentRecorded(true);
        if (paymentSuccessTimerRef.current != null) window.clearTimeout(paymentSuccessTimerRef.current);
        paymentSuccessTimerRef.current = window.setTimeout(() => {
          setPaymentRecorded(false);
          setPaymentDialogOpen(false);
        }, 800);
        return;
      }

      const { error } = await supabase.from('budget_payments').insert({
        user_id: user.id,
        client_id: selectedClient?.id ?? null,
        budget_category_id: selectedCategory.id,
        vendor_id: selectedVendor?.id ?? null,
        budget_scope: paymentLog.budgetScope,
        category_name: selectedCategory.name,
        payee_name: payeeName,
        amount,
        payment_date: paymentLog.paymentDate,
        reference: paymentLog.reference.trim() || null,
        notes: paymentLog.notes.trim() || null,
      });

      if (error) throw error;

      const { error: categoryError } = await supabase
        .from('budget_categories')
        .update({ spent: selectedCategory.spent + amount })
        .eq('id', selectedCategory.id);

      if (categoryError) throw categoryError;

      if (selectedVendor) {
        const nextPaid = Number(selectedVendor.amount_paid ?? 0) + amount;
        const contractAmount = selectedVendor.price ?? null;
        const nextStatus =
          contractAmount && nextPaid >= contractAmount
            ? 'paid_full'
            : nextPaid > 0
              ? 'part_paid'
              : selectedVendor.payment_status;

        await supabase
          .from('vendors')
          .update({
            amount_paid: nextPaid,
            payment_status: nextStatus,
            last_payment_at: paymentLog.paymentDate,
          } as any)
          .eq('id', selectedVendor.id);
      }

      toast({
        title: 'Payment recorded',
        description: `${formatCurrency(amount)} added to ${selectedCategory.name}.`,
      });

      await refreshBudgetWorkspace();
      setPaymentRecorded(true);
      if (paymentSuccessTimerRef.current != null) window.clearTimeout(paymentSuccessTimerRef.current);
      paymentSuccessTimerRef.current = window.setTimeout(() => {
        setPaymentRecorded(false);
        setPaymentDialogOpen(false);
      }, 800);
    } catch (error: any) {
      setPaymentSubmitError(error.message || 'We could not record this payment right now.');
      toast({
        title: 'Failed to record payment',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setRecordingPaymentMade(false);
    }
  };

  const suggestedTemplates = useMemo(() => {
    const existingNames = new Set(
      categories
        .filter((category) => category.budget_scope === newCategoryScope)
        .map((category) => category.name.toLowerCase().trim()),
    );

    const source = newCategoryScope === 'personal' ? personalBudgetTemplates : weddingBudgetTemplates;
    return source.filter((template) => !existingNames.has(template.name.toLowerCase().trim()));
  }, [categories, newCategoryScope]);

  const persistCategoryAllocation = async (
    category: BudgetCategory,
    nextAllocated: number,
    editedField: 'amount' | 'percentage',
    manuallyEdited: boolean,
  ) => {
    if (!user || !Number.isFinite(nextAllocated) || nextAllocated < 0) return;
    const normalizedAllocated = Math.round(nextAllocated);
    setSavingAllocationId(category.id);

    if (plannerNeedsApproval && selectedClient?.linked_user_id) {
      try {
        await submitPlannerChangeRequest({
          clientId: selectedClient.id,
          coupleUserId: selectedClient.linked_user_id,
          plannerUserId: user.id,
          targetTable: 'budget_categories',
          targetId: category.id,
          changeType: 'update',
          proposedPayload: {
            allocated: normalizedAllocated,
            allocation_manually_edited: manuallyEdited,
            allocation_last_edited_field: manuallyEdited ? editedField : null,
          },
        });
        toast({ title: 'Allocation sent for approval', description: `${category.name} will update after the couple approves it.` });
      } catch (error) {
        toast({ title: 'Could not update allocation', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
      } finally {
        setSavingAllocationId(null);
      }
      return;
    }

    const previousCategories = queryClient.getQueryData<BudgetCategory[]>(categoriesQueryKey);
    queryClient.setQueryData<BudgetCategory[]>(categoriesQueryKey, (current = []) => current.map((item) => (
      item.id === category.id
        ? {
            ...item,
            allocated: normalizedAllocated,
            allocation_manually_edited: manuallyEdited,
            allocation_last_edited_field: manuallyEdited ? editedField : null,
          }
        : item
    )));

    try {
      const { error } = await supabase
        .from('budget_categories')
        .update({
          allocated: normalizedAllocated,
          allocation_manually_edited: manuallyEdited,
          allocation_last_edited_field: manuallyEdited ? editedField : null,
        })
        .eq('id', category.id);
      if (error) throw error;
      setAllocationDrafts((current) => {
        const next = { ...current };
        delete next[category.id];
        return next;
      });
      toast({ title: manuallyEdited ? 'Allocation updated' : 'Suggestion restored', description: `${category.name} is now ${formatCurrency(normalizedAllocated)}.` });
    } catch (error) {
      queryClient.setQueryData(categoriesQueryKey, previousCategories);
      toast({ title: 'Could not update allocation', description: error instanceof Error ? error.message : 'Your previous amount has been restored.', variant: 'destructive' });
    } finally {
      setSavingAllocationId(null);
    }
  };

  const updateAllocationDraft = (
    category: BudgetCategory,
    currentPercentage: number,
    value: string,
    field: 'amount' | 'percentage',
  ) => {
    const numericValue = Number(value.replace(/,/g, ''));
    setAllocationDrafts((current) => {
      const fallback = current[category.id] ?? {
        amount: String(category.allocated),
        percentage: currentPercentage.toFixed(1),
        lastEditedField: field,
      };
      if (!Number.isFinite(numericValue) || numericValue < 0 || value.trim() === '') {
        return { ...current, [category.id]: { ...fallback, [field]: value, lastEditedField: field } };
      }
      return {
        ...current,
        [category.id]: field === 'amount'
          ? {
              amount: value,
              percentage: visibleBudgetGoal > 0 ? ((numericValue / visibleBudgetGoal) * 100).toFixed(1) : '0.0',
              lastEditedField: field,
            }
          : {
              amount: String(Math.round((numericValue / 100) * visibleBudgetGoal)),
              percentage: value,
              lastEditedField: field,
            },
      };
    });
  };

  const filteredVisibleCategories = useMemo(() => {
    const searchTerm = categorySearch.trim().toLowerCase();
    return visibleCategories
      .filter((category) => {
        if (!searchTerm) return true;
        const searchBlob = [
          category.name,
          category.committee_role_in_charge,
          contractStatusLabel(category.contract_status),
          category.visibility,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return searchBlob.includes(searchTerm);
      })
      .sort((left, right) => {
        const leftPressure = left.allocated > 0 ? left.spent / left.allocated : 0;
        const rightPressure = right.allocated > 0 ? right.spent / right.allocated : 0;
        if (leftPressure !== rightPressure) return rightPressure - leftPressure;
        return left.name.localeCompare(right.name);
      });
  }, [categorySearch, visibleCategories]);

  const selectedBudgetCategory = useMemo(
    () => filteredVisibleCategories.find((category) => category.id === selectedCategoryId) ?? null,
    [filteredVisibleCategories, selectedCategoryId],
  );

  const selectedCategoryPayments = useMemo(() => {
    if (!selectedBudgetCategory) return [];
    return currentScopePayments
      .filter(
        (payment) =>
          normalizeCategoryName(payment.category_name) === normalizeCategoryName(selectedBudgetCategory.name),
      )
      .slice(0, 5);
  }, [currentScopePayments, selectedBudgetCategory]);

  const selectedCategoryBenchmark =
    selectedBudgetCategory?.budget_scope === 'wedding'
      ? categoryBenchmarks[benchmarkKey(selectedBudgetCategory.name)]
      : null;
  const selectedCategorySpentPercentage =
    selectedBudgetCategory && selectedBudgetCategory.allocated > 0
      ? Math.min((selectedBudgetCategory.spent / selectedBudgetCategory.allocated) * 100, 100)
      : 0;
  const selectedCategoryRemaining = selectedBudgetCategory
    ? Math.max(selectedBudgetCategory.allocated - selectedBudgetCategory.spent, 0)
    : 0;
  const selectedCategoryOverMedian =
    selectedBudgetCategory?.budget_scope === 'wedding'
    && selectedCategoryBenchmark?.benchmark_visible
    && selectedCategoryBenchmark.median_amount != null
    && selectedBudgetCategory.spent > selectedCategoryBenchmark.median_amount;

  useEffect(() => {
    if (filteredVisibleCategories.length === 0) {
      if (selectedCategoryId !== null) setSelectedCategoryId(null);
      return;
    }

    if (selectedCategoryId && !filteredVisibleCategories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId(filteredVisibleCategories[0].id);
    }
  }, [filteredVisibleCategories, selectedCategoryId]);

  const budgetScopeLabel = activeBudgetScope === 'personal' ? 'personal budget' : 'wedding budget';

  const contextualBudgetMessage = (() => {
    if (activeBudgetScope === 'wedding' && visibleAllocationPercentage > 100.01) {
      return {
        className: 'semantic-surface-danger',
        label: 'Plan is over budget',
        message: `${formatCurrency(visibleAllocated - visibleBudgetGoal)} needs to be removed from your category plans or added to your overall budget.`,
      };
    }

    if (activeBudgetScope === 'wedding' && visibleBudgetGoal > 0 && visibleAllocationPercentage < 99.99) {
      return {
        className: 'semantic-surface-info',
        label: 'Money left to plan',
        message: `${formatCurrency(visibleBudgetGoal - visibleAllocated)} is still available for your categories.`,
      };
    }

    const over = visibleOverBudgetCategories[0];
    if (over) {
      return {
        className: 'semantic-surface-danger',
        label: 'Over budget',
        message: `${over.name} is ${formatCurrency(over.spent - over.allocated)} over its plan. Adjust it before the next payment.`,
      };
    }

    const near = visibleNearLimitCategories[0];
    if (near) {
      return {
        className: 'semantic-surface-warning',
        label: 'Getting close',
        message: `${near.name} has ${formatCurrency(Math.max(near.allocated - near.spent, 0))} left. Check it before paying more.`,
      };
    }

    const due = paymentsDueSoon[0];
    if (due) {
      return {
        className: 'semantic-surface-info',
        label: 'Payment coming up',
        message: `${due.name} has a payment due soon. Open its budget item to review it.`,
      };
    }

    if (visibleAllocated > 0 && visibleSpent === 0) {
      return {
        className: 'semantic-surface-info',
        label: 'Plan ready',
        message: 'Your budget is divided into categories. Record payments as you make them.',
      };
    }

    return {
      className: 'semantic-surface-success',
      label: 'On track',
      message: `${visibleSpentPercentage}% of the budget is spent, with ${formatCurrency(remainingBudget)} left.`,
    };
  })();

  const exportBudgetData = () => {
    const rows = visibleCategories.map((category) => ({
      scope: category.budget_scope,
      category: category.name,
      allocated_kes: category.allocated,
      spent_kes: category.spent,
      remaining_kes: Math.max(category.allocated - category.spent, 0),
      visibility: category.visibility,
      committee_role_in_charge: category.committee_role_in_charge ?? '',
      contract_status: category.contract_status,
    }));

    const paymentRows = currentScopePayments.map((payment) => ({
      scope: payment.budget_scope,
      category: payment.category_name,
      payee_name: payment.payee_name,
      amount_kes: payment.amount,
      payment_date: safeDateLabel(payment.payment_date),
      reference: payment.reference ?? '',
      notes: payment.notes ?? '',
    }));

    downloadCsv(
      `zania-${activeBudgetScope}-budget-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ...rows,
        ...(paymentRows.length ? [{ scope: '', category: '', allocated_kes: '', spent_kes: '', remaining_kes: '', visibility: '', committee_role_in_charge: '', contract_status: '' }] : []),
        ...paymentRows,
      ],
    );
  };

  if (isPlanner && (plannerClientHydrating || !selectedClient)) return <WorkspacePageSkeleton compact />;
  if (categoriesQuery.isLoading || vendorOptionsQuery.isLoading || paymentRecordsQuery.isLoading || tasksQuery.isLoading) {
    return <WorkspacePageSkeleton compact />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Budget</p>
          <h1 className="mt-2 font-editorial text-3xl font-semibold text-foreground sm:text-4xl">Where is the money going?</h1>
          <p className="mt-2 text-sm text-muted-foreground">Plan each cost and record what you pay.</p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>Add category</Button>
      </header>

      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-4">
        {[
          ['Overall budget', formatCurrency(visibleBudgetGoal)],
          ['Allocated', formatCurrency(visibleAllocated)],
          ['Spent', formatCurrency(visibleSpent)],
          ['Remaining', formatCurrency(remainingBudget)],
        ].map(([label, value], index) => (
          <div key={label} className={`p-3 sm:p-4 ${index < 3 ? 'border-r border-border' : ''} ${index < 2 ? 'border-b border-border sm:border-b-0' : ''}`}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 truncate text-base font-semibold text-foreground sm:text-lg">{value}</p>
            {index === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">Your spending limit</p>
            ) : index === 1 ? (
              <p className={`mt-1 text-xs ${visibleAllocationPercentage > 100 ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>{visibleAllocationPercentage.toFixed(1)}% planned</p>
            ) : index === 2 ? (
              <p className="mt-1 text-xs text-muted-foreground">{visibleSpentPercentage}% of budget</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 rounded-lg border border-border bg-card p-3 sm:p-4">
        <SlidingSegmentedControl
          label="Budget type"
          layoutId="budget-scope-selection"
          value={activeBudgetScope}
          options={showPersonalBudget
            ? [{ value: 'wedding', label: 'Wedding' }, { value: 'personal', label: 'Personal' }]
            : [{ value: 'wedding', label: 'Wedding' }]}
          onChange={setActiveBudgetScope}
          reducedMotion={Boolean(prefersReducedMotion)}
        />
        <SlidingSegmentedControl
          label="Budget view"
          layoutId="budget-view-selection"
          value={budgetViewMode}
          options={[{ value: 'by_category', label: 'Categories' }, { value: 'payments_made', label: 'Payments' }]}
          onChange={setBudgetViewMode}
          reducedMotion={Boolean(prefersReducedMotion)}
        />
      </div>

      <div className="flex w-full flex-col justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto" variant="outline">
                Record payment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle className="font-display">Record Payment Made</DialogTitle>
              </DialogHeader>
              <form onSubmit={recordPaymentMade} className="space-y-4">
                <FormSubmitError message={paymentSubmitError} />
                {showPersonalBudget && (
                  <div className="space-y-2">
                    <Label>Budget Type</Label>
                    <div className="flex flex-wrap items-center rounded-full border border-border bg-background p-1">
                      <Button
                        type="button"
                        variant={paymentLog.budgetScope === 'wedding' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setPaymentLog((prev) => ({ ...prev, budgetScope: 'wedding', categorySelection: '', vendorId: '' }))}
                      >
                        Wedding
                      </Button>
                      <Button
                        type="button"
                        variant={paymentLog.budgetScope === 'personal' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setPaymentLog((prev) => ({ ...prev, budgetScope: 'personal', categorySelection: '', vendorId: '' }))}
                      >
                        Personal
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={paymentLog.categorySelection}
                    onValueChange={(value) => {
                      setPaymentLog((prev) => ({ ...prev, categorySelection: value, vendorId: '' }));
                      setPaymentFormErrors((current) => ({ ...current, categorySelection: undefined }));
                      setPaymentSubmitError(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a budget category" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentCategoryOptions.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormFieldError message={paymentFormErrors.categorySelection} />
                </div>
                {paymentLog.budgetScope === 'wedding' && (
                  <div className="space-y-2">
                    <Label>Link to vendor (optional)</Label>
                    <Select
                      value={paymentLog.vendorId || 'none'}
                      onValueChange={(value) => {
                        if (value === 'none') {
                          setPaymentLog((prev) => ({ ...prev, vendorId: '' }));
                          return;
                        }
                        const vendor = vendorOptions.find((item) => item.id === value);
                        setPaymentLog((prev) => ({
                          ...prev,
                          vendorId: value,
                          payeeName: vendor?.name || prev.payeeName,
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No linked vendor</SelectItem>
                        {availableVendorsForPayment.map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            {vendor.name} · {vendor.category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Payee name</Label>
                  <Input
                    value={paymentLog.payeeName}
                    onChange={(e) => {
                      setPaymentLog((prev) => ({ ...prev, payeeName: e.target.value }));
                      setPaymentFormErrors((current) => ({ ...current, payeeName: undefined }));
                      setPaymentSubmitError(null);
                    }}
                    placeholder="e.g. Little Cake Girl"
                    required
                  />
                  <FormFieldError message={paymentFormErrors.payeeName} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Amount (KES)</Label>
                    <Input
                      type="number"
                      value={paymentLog.amount}
                      onChange={(e) => {
                        setPaymentLog((prev) => ({ ...prev, amount: e.target.value }));
                        setPaymentFormErrors((current) => ({ ...current, amount: undefined }));
                        setPaymentSubmitError(null);
                      }}
                      placeholder="0"
                      required
                    />
                    <FormFieldError message={paymentFormErrors.amount} />
                  </div>
                  <div className="space-y-2">
                    <Label>Payment date</Label>
                    <Input
                      type="date"
                      value={paymentLog.paymentDate}
                      onChange={(e) => setPaymentLog((prev) => ({ ...prev, paymentDate: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input
                    value={paymentLog.reference}
                    onChange={(e) => setPaymentLog((prev) => ({ ...prev, reference: e.target.value }))}
                    placeholder="e.g. MPESA Ref: ET546GFDC"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input
                    value={paymentLog.notes}
                    onChange={(e) => setPaymentLog((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Deposit, second payment, balance, etc."
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={recordingPaymentMade}
                  status={recordingPaymentMade ? 'loading' : paymentRecorded ? 'success' : 'idle'}
                  loadingText="Recording payment"
                  successText={plannerNeedsApproval ? 'Request sent' : 'Payment recorded'}
                >
                  Record payment
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          <Button
            type="button"
            className="w-full sm:w-auto"
            variant="outline"
            onClick={() => {
              if (!exportDecision.allowed) {
                setExportUpgradeOpen(true);
                return;
              }
              exportBudgetData();
            }}
          >
            Export budget
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Add Budget Category</DialogTitle>
              </DialogHeader>
              <form onSubmit={addCategory} className="space-y-4">
                <FormSubmitError message={categorySubmitError} />
                {newCategoryScope === 'wedding' ? (
                  <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {addModalBenchmarkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Market signal for this category
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {addModalBenchmarkLoading ? 'Loading price benchmark…' : benchmarkSummary(addModalBenchmark)}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                    <div className="text-sm font-medium text-foreground">Private couple spending</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Personal budget lines are hidden from shared planner views and stay tied to the couple or committee workspace.
                    </p>
                  </div>
                )}
                {showPersonalBudget && (
                  <div className="space-y-2">
                    <Label>Budget Type</Label>
                    <div className="flex items-center rounded-full border border-border bg-background p-1">
                      <Button
                        type="button"
                        variant={newCategoryScope === 'wedding' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setNewCategoryScope('wedding')}
                      >
                        Wedding
                      </Button>
                      <Button
                        type="button"
                        variant={newCategoryScope === 'personal' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setNewCategoryScope('personal')}
                      >
                        Personal
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Suggested Category</Label>
                  <Select
                    value={selectedTemplateName || 'custom'}
                    onValueChange={(value) => {
                      if (value === 'custom') {
                        setSelectedTemplateName('');
                        setName('');
                        return;
                      }
                      setSelectedTemplateName(value);
                      setName(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Choose a ${newCategoryScope} budget category`} />
                    </SelectTrigger>
                    <SelectContent>
                      {suggestedTemplates.map((template) => (
                        <SelectItem key={template.name} value={template.name}>
                          {template.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Custom category</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Suggestions come from the planner spreadsheet templates we mapped into the app.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{selectedTemplateName ? 'Selected Category' : 'Category Name'}</Label>
                  <Input
                    value={name}
                    onChange={e => {
                      setName(e.target.value);
                      setCategoryFormErrors((current) => ({ ...current, name: undefined }));
                      setCategorySubmitError(null);
                      if (selectedTemplateName && e.target.value !== selectedTemplateName) {
                        setSelectedTemplateName('');
                      }
                    }}
                    placeholder={newCategoryScope === 'personal' ? 'e.g. Honeymoon, Wedding Bands' : 'e.g. Venue, Catering'}
                    required
                  />
                  <FormFieldError message={categoryFormErrors.name} />
                </div>
                <div className="space-y-2">
                  <Label>Allocated Amount (KES)</Label>
                  <Input type="number" value={allocated} onChange={e => {
                    setAllocated(e.target.value);
                    setCategoryFormErrors((current) => ({ ...current, allocated: undefined }));
                    setCategorySubmitError(null);
                  }} placeholder="0" required />
                  <FormFieldError message={categoryFormErrors.allocated} />
                </div>
                <Button type="submit" className="w-full" disabled={addingCategory}>
                  {addingCategory ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {addingCategory ? 'Saving...' : 'Add Category'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          <UpgradePromptDialog
            open={exportUpgradeOpen}
            onOpenChange={setExportUpgradeOpen}
            decision={exportDecision.allowed ? null : exportDecision}
          />
        </div>
      </div>

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: 'easeOut' }}
        className={`${contextualBudgetMessage.className} rounded-lg border px-4 py-3`}
        aria-live="polite"
      >
        <p className="text-sm font-semibold text-foreground">{contextualBudgetMessage.label}</p>
        <p className="mt-1 text-sm text-muted-foreground">{contextualBudgetMessage.message}</p>
      </motion.div>

      <Card className="overflow-hidden border-border bg-card shadow-none">
        <CardContent className="p-0">
          <div>
            <div>
              <div className="space-y-4 p-4 sm:p-5">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Budget items</p>
                  <p className="text-sm text-muted-foreground">Choose an item to view its vendor, tasks, and payments.</p>
                </div>

                <div>
                  <Input
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder={
                      activeBudgetScope === 'personal'
                        ? 'Search honeymoon, rings, dowry...'
                        : 'Search venue, catering, decor...'
                    }
                  />
                </div>
              </div>

              <div className="space-y-2 border-t border-border bg-muted/20 p-2 sm:p-3">
                {filteredVisibleCategories.length > 0 ? (
                  filteredVisibleCategories.map((category) => {
                    const isSelected = selectedBudgetCategory?.id === category.id;
                    const isOverBudget = category.allocated > 0 && category.spent > category.allocated;
                    const isNearLimit =
                      category.allocated > 0 &&
                      category.spent <= category.allocated &&
                      category.spent / category.allocated >= 0.85;
                    const categoryProgress = category.allocated
                      ? Math.min((category.spent / category.allocated) * 100, 100)
                      : 0;
                    const overallShare = visibleBudgetGoal > 0
                      ? (category.allocated / visibleBudgetGoal) * 100
                      : 0;
                    const allRelevantVendors = getRecordedVendorsForBudgetCategory(category.name, vendorOptions);
                    const relevantVendors = allRelevantVendors
                      .sort((left, right) => Number(right.selection_status === 'final') - Number(left.selection_status === 'final'))
                      .slice(0, 2);
                    const relevantTasks = getRelatedTasksForBudgetCategory(category.name, budgetTasks, allRelevantVendors)
                      .slice(0, 3);
                    const linkedDirectoryIds = new Set(
                      vendorOptions.map((vendor) => vendor.vendor_listing_id).filter(Boolean),
                    );
                    const suggestedVendors = directorySuggestions
                      .filter((vendor) => planningCategoryRelationScore(category.name, vendor.category) > 0)
                      .filter((vendor) => !linkedDirectoryIds.has(vendor.id))
                      .slice(0, 3);
                    const existingTaskTitles = new Set(budgetTasks.map((task) => task.title.trim().toLowerCase()));
                    const suggestedTasks = getSuggestedTaskTemplates({
                      category: category.name,
                      vendorCategories: vendorOptions.map((vendor) => vendor.category),
                      role: profile?.role,
                      plannerType: profile?.planner_type,
                    })
                      .filter((task) => !existingTaskTitles.has(task.title.trim().toLowerCase()))
                      .slice(0, 3);
                    const activeInlineModule = inlineModule?.categoryId === category.id ? inlineModule.type : null;

                    return (
                      <motion.div
                        layout={!prefersReducedMotion}
                        key={category.id}
                        animate={prefersReducedMotion ? undefined : isSelected ? { y: -1, scale: 1.006 } : { y: 0, scale: 1 }}
                        transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: 'easeOut' }}
                        className={`relative overflow-hidden rounded-lg border bg-card transition-[border-color,background-color,box-shadow,opacity] duration-200 ${isSelected ? 'z-10 border-primary/70 bg-primary/[0.025] shadow-[0_14px_34px_-24px_hsl(var(--foreground)/0.55)] ring-1 ring-primary/15' : 'border-border/80 bg-card/90 hover:border-primary/25 hover:bg-card'}`}
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute inset-y-3 left-0 z-10 w-[3px] rounded-r-full bg-primary transition-opacity duration-200 ${isSelected ? 'opacity-100' : 'opacity-0'}`}
                        />
                        <button
                          type="button"
                          aria-expanded={isSelected}
                          onClick={() => {
                            setSelectedCategoryId(isSelected ? null : category.id);
                            setInlineModule(null);
                          }}
                          className={`min-h-[4.75rem] w-full px-4 py-3 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5 ${isSelected ? 'bg-primary/[0.075]' : 'hover:bg-muted/30'}`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-semibold text-foreground">{category.name}</p>
                                {isSelected ? <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-primary">Open</span> : null}
                                {category.visibility === 'private' ? <span className="text-xs text-muted-foreground">Private</span> : null}
                                {isOverBudget ? (
                                  <span className="text-xs font-semibold text-destructive">Over budget</span>
                                ) : isNearLimit ? (
                                  <span className="text-xs font-semibold text-warning-foreground">Near limit</span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatCurrency(category.spent)} spent · {formatCurrency(Math.max(category.allocated - category.spent, 0))} left
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-semibold text-foreground">{formatCurrency(category.allocated)}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{overallShare.toFixed(1)}% of total</p>
                              <p className={`mt-1.5 text-xs font-semibold ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                                {isSelected ? 'Hide details' : 'View details'}
                              </p>
                            </div>
                          </div>
                          <Progress value={categoryProgress} className="mt-3 h-1" />
                        </button>

                        <AnimatedCardDetails open={isSelected}>
                          <div className="min-w-0 space-y-4 border-t border-border bg-background/60 p-4 sm:p-5">
                            <div className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)_auto] sm:items-end sm:p-4">
                              <div className="space-y-2">
                                <Label htmlFor={`planned-allocation-${category.id}`}>Planned amount</Label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">KES</span>
                                  <Input
                                    id={`planned-allocation-${category.id}`}
                                    type="number"
                                    min="0"
                                    inputMode="numeric"
                                    aria-label={`Edit planned allocation for ${category.name}`}
                                    value={allocationDrafts[category.id]?.amount ?? String(category.allocated)}
                                    onChange={(event) => updateAllocationDraft(category, overallShare, event.target.value, 'amount')}
                                    className="pl-12"
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`percentage-allocation-${category.id}`}>Percentage</Label>
                                <div className="relative">
                                  <Input
                                    id={`percentage-allocation-${category.id}`}
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    inputMode="decimal"
                                    aria-label={`Edit percentage allocation for ${category.name}`}
                                    value={allocationDrafts[category.id]?.percentage ?? overallShare.toFixed(1)}
                                    onChange={(event) => updateAllocationDraft(category, overallShare, event.target.value, 'percentage')}
                                    className="pr-9"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">%</span>
                                </div>
                              </div>
                              <Button
                                type="button"
                                className="w-full sm:w-auto"
                                disabled={savingAllocationId === category.id}
                                onClick={() => {
                                  const draft = allocationDrafts[category.id] ?? { amount: String(category.allocated), percentage: overallShare.toFixed(1), lastEditedField: 'amount' as const };
                                  const rawValue = Number(draft[draft.lastEditedField]);
                                  if (!Number.isFinite(rawValue) || rawValue < 0) {
                                    toast({ title: 'Enter a valid allocation', description: 'Use zero or a positive number.', variant: 'destructive' });
                                    return;
                                  }
                                  const nextAmount = draft.lastEditedField === 'percentage'
                                    ? (rawValue / 100) * visibleBudgetGoal
                                    : rawValue;
                                  void persistCategoryAllocation(category, nextAmount, draft.lastEditedField, true);
                                }}
                              >
                                {savingAllocationId === category.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                              </Button>
                            </div>

                            <div className="grid grid-cols-2 divide-x divide-border border-y border-border py-3 text-center">
                              <div className="px-2">
                                <p className="text-xs text-muted-foreground">Spent</p>
                                <p className="mt-1 text-sm font-semibold">{formatCurrency(category.spent)}</p>
                              </div>
                              <div className="px-2">
                                <p className="text-xs text-muted-foreground">{category.spent > category.allocated ? 'Over' : 'Left'}</p>
                                <p className={`mt-1 text-sm font-semibold ${category.spent > category.allocated ? 'text-destructive' : ''}`}>{formatCurrency(Math.abs(category.allocated - category.spent))}</p>
                              </div>
                            </div>

                            {category.allocation_manually_edited && category.suggested_allocated != null ? (
                              <Button
                                type="button"
                                variant="link"
                                className="h-auto p-0 text-sm"
                                disabled={savingAllocationId === category.id}
                                onClick={() => {
                                  const suggestedAmount = category.suggested_percentage != null && visibleBudgetGoal > 0
                                    ? (category.suggested_percentage / 100) * visibleBudgetGoal
                                    : category.suggested_allocated!;
                                  void persistCategoryAllocation(category, suggestedAmount, 'amount', false);
                                }}
                              >
                                Reset to suggested
                              </Button>
                            ) : null}

                            <div className="grid gap-4 md:grid-cols-2 md:divide-x md:divide-border">
                              <div className="min-w-0">
                                <p className="text-sm font-medium">Vendor</p>
                                {relevantVendors.length ? relevantVendors.map((vendor) => (
                                  <div key={vendor.id} className="mt-2 flex min-w-0 items-start justify-between gap-3 text-sm">
                                    <span className="min-w-0 flex-1 break-words">{vendor.name}</span>
                                    <Badge variant={vendor.selection_status === 'final' ? 'default' : 'outline'}>
                                      {vendor.selection_status === 'final' ? 'Linked' : 'Relevant'}
                                    </Badge>
                                  </div>
                                )) : <p className="mt-2 text-sm text-muted-foreground">No vendor linked yet.</p>}
                                <Button
                                  type="button"
                                  variant="link"
                                  className="mt-2 h-auto p-0"
                                  aria-expanded={activeInlineModule === 'vendor'}
                                  onClick={() => setInlineModule(activeInlineModule === 'vendor' ? null : { categoryId: category.id, type: 'vendor' })}
                                >
                                  {activeInlineModule === 'vendor' ? 'Close vendor suggestions' : relevantVendors.length ? 'Add another vendor' : 'Find a vendor'}
                                </Button>
                              </div>

                              <div className="min-w-0 md:pl-4">
                                <p className="text-sm font-medium">Related tasks</p>
                                {relevantTasks.length ? relevantTasks.map((task) => (
                                  <div key={task.id} className="mt-2 flex min-w-0 items-start justify-between gap-3 text-sm">
                                    <Link
                                      to={`/tasks?task=${encodeURIComponent(task.id)}`}
                                      className={task.completed
                                        ? 'min-w-0 flex-1 break-words text-muted-foreground line-through underline-offset-4 hover:text-foreground hover:underline'
                                        : 'min-w-0 flex-1 break-words font-medium text-foreground underline-offset-4 hover:text-primary hover:underline'}
                                    >
                                      {task.title}
                                    </Link>
                                    <Badge variant="outline">{task.completed ? 'Done' : 'Next'}</Badge>
                                  </div>
                                )) : <p className="mt-2 text-sm text-muted-foreground">No matching task yet.</p>}
                                <Button
                                  type="button"
                                  variant="link"
                                  className="mt-2 h-auto p-0"
                                  aria-expanded={activeInlineModule === 'task'}
                                  onClick={() => setInlineModule(activeInlineModule === 'task' ? null : { categoryId: category.id, type: 'task' })}
                                >
                                  {activeInlineModule === 'task' ? 'Close task suggestions' : relevantTasks.length ? 'Add another task' : 'Add a task'}
                                </Button>
                              </div>
                            </div>

                            <AnimatePresence initial={false} mode="wait">
                              {activeInlineModule === 'vendor' ? (
                                <motion.div
                                  key="vendor-module"
                                  initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
                                  transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: 'easeOut' }}
                                  className="overflow-hidden"
                                >
                                  <div className="min-w-0 space-y-3 border-y border-border bg-muted/20 px-3 py-4 sm:px-4">
                                    <div>
                                      <p className="text-sm font-semibold">Suggested {category.name.toLowerCase()} vendors</p>
                                      <p className="mt-1 text-xs text-muted-foreground">Approved Zania directory options you can add to this budget item.</p>
                                    </div>
                                    {directorySuggestionsQuery.isLoading ? (
                                      <p className="text-sm text-muted-foreground">Finding suitable vendors…</p>
                                    ) : suggestedVendors.length ? (
                                      <div className="divide-y divide-border rounded-md border border-border bg-card">
                                        {suggestedVendors.map((vendor) => (
                                          <div key={vendor.id} className="flex min-w-0 items-start justify-between gap-3 px-3 py-3">
                                            <div className="min-w-0">
                                              <p className="truncate text-sm font-medium">{vendor.business_name}</p>
                                              <p className="mt-0.5 text-xs text-muted-foreground">
                                                {[vendor.location, vendor.is_verified ? 'Verified' : null].filter(Boolean).join(' · ') || vendor.category}
                                              </p>
                                            </div>
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="outline"
                                              disabled={savingInlineVendorId !== null}
                                              onClick={() => void addInlineVendor(category, vendor)}
                                            >
                                              {savingInlineVendorId === vendor.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">No directory match yet. Add a vendor you already know below.</p>
                                    )}
                                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                                      <Input
                                        aria-label={`Vendor name for ${category.name}`}
                                        placeholder="Vendor business name"
                                        value={inlineVendorDrafts[category.id] ?? ''}
                                        onChange={(event) => setInlineVendorDrafts((current) => ({ ...current, [category.id]: event.target.value }))}
                                      />
                                      <Button
                                        type="button"
                                        disabled={savingInlineVendorId !== null}
                                        onClick={() => void addInlineVendor(category)}
                                      >
                                        {savingInlineVendorId === `custom-${category.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add vendor'}
                                      </Button>
                                    </div>
                                  </div>
                                </motion.div>
                              ) : activeInlineModule === 'task' ? (
                                <motion.div
                                  key="task-module"
                                  initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
                                  transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: 'easeOut' }}
                                  className="overflow-hidden"
                                >
                                  <div className="min-w-0 space-y-3 border-y border-border bg-muted/20 px-3 py-4 sm:px-4">
                                    <div>
                                      <p className="text-sm font-semibold">Suggested next tasks</p>
                                      <p className="mt-1 text-xs text-muted-foreground">Based on this budget item and Zania’s wedding checklist.</p>
                                    </div>
                                    {suggestedTasks.length ? (
                                      <div className="divide-y divide-border rounded-md border border-border bg-card">
                                        {suggestedTasks.map((task) => (
                                          <div key={task.key} className="flex min-w-0 items-start justify-between gap-3 px-3 py-3">
                                            <div className="min-w-0">
                                              <p className="break-words text-sm font-medium">{task.title}</p>
                                              {task.description ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{task.description}</p> : null}
                                            </div>
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="outline"
                                              disabled={savingInlineTaskId !== null}
                                              onClick={() => void addInlineTask(category, task)}
                                            >
                                              {savingInlineTaskId === task.key ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">The suggested checklist tasks are already in your plan.</p>
                                    )}
                                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                                      <Input
                                        aria-label={`New task for ${category.name}`}
                                        placeholder="Write a short task"
                                        value={inlineTaskDrafts[category.id] ?? ''}
                                        onChange={(event) => setInlineTaskDrafts((current) => ({ ...current, [category.id]: event.target.value }))}
                                      />
                                      <Button
                                        type="button"
                                        disabled={savingInlineTaskId !== null}
                                        onClick={() => void addInlineTask(category)}
                                      >
                                        {savingInlineTaskId === `custom-${category.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add task'}
                                      </Button>
                                    </div>
                                  </div>
                                </motion.div>
                              ) : null}
                            </AnimatePresence>

                            <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                              <div className="space-y-2">
                                <Label htmlFor={`quick-spent-${category.id}`}>Spent so far</Label>
                                <Input
                                  id={`quick-spent-${category.id}`}
                                  type="number"
                                  value={spentDrafts[category.id] ?? ''}
                                  onChange={(event) => setSpentDrafts((current) => ({ ...current, [category.id]: event.target.value }))}
                                />
                              </div>
                              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => saveSpent(category)} disabled={savingSpentId === category.id}>
                                {savingSpentId === category.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                              </Button>
                              <Button type="button" className="w-full sm:w-auto" onClick={() => openSpendRecorder(category)}>Record payment</Button>
                            </div>

                            <div className="flex justify-end">
                              <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label="Remove budget item" title="Remove budget item" onClick={() => deleteCategory(category.id)}>
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </div>
                          </div>
                        </AnimatedCardDetails>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-sm font-medium text-foreground">No budget items match this search</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {visibleCategories.length === 0
                        ? activeBudgetScope === 'personal'
                          ? 'Add the first private budget line to track costs the couple wants to keep separate.'
                          : 'Add the first wedding budget line to start planning costs properly.'
                        : 'Try a different category name, role, or status search.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="hidden" aria-hidden="true">
              {selectedBudgetCategory ? (
                <div className="space-y-6 p-5 lg:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={selectedBudgetCategory.budget_scope === 'personal' ? 'secondary' : 'outline'}>
                          {selectedBudgetCategory.budget_scope === 'personal' ? 'Personal budget line' : 'Wedding budget line'}
                        </Badge>
                        {selectedBudgetCategory.visibility === 'private' && (
                          <Badge variant="secondary">Private</Badge>
                        )}
                        {selectedCategoryOverMedian && (
                          <Badge variant="secondary">Above benchmark median</Badge>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="workspace-h2">
                            {selectedBudgetCategory.name}
                          </h2>
                          <InfoTip
                            content={selectedBudgetCategory.budget_scope === 'wedding'
                              ? 'Use this line to compare the planned amount, the real spend, and who is responsible for keeping it on track.'
                              : 'Use private lines for couple-only costs like rings, dowry, honeymoon, or home setup without mixing them into the shared wedding budget.'}
                          />
                        </div>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                          {selectedBudgetCategory.budget_scope === 'wedding'
                            ? 'Track this line from plan to payment.'
                            : 'Keep couple-only costs separate here.'}
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      aria-label="Delete budget line"
                      title="Delete budget line"
                      onClick={() => deleteCategory(selectedBudgetCategory.id)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Allocated</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {formatCurrency(selectedBudgetCategory.allocated)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Spent so far</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {formatCurrency(selectedBudgetCategory.spent)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Remaining</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {formatCurrency(selectedCategoryRemaining)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background px-4 py-4">
                    <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                      <span>{formatCurrency(selectedBudgetCategory.spent)} spent</span>
                      <span>{formatCurrency(selectedBudgetCategory.allocated)} planned</span>
                    </div>
                    <Progress value={selectedCategorySpentPercentage} className="h-2.5" />
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                    <div className="space-y-4">
                      {selectedBudgetCategory.budget_scope === 'wedding' ? (
                        <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">Market benchmark</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {benchmarkSummary(selectedCategoryBenchmark)}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-[10px]">
                              {selectedCategoryBenchmark?.sample_size ?? 0} obs
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        <div className="semantic-surface-info rounded-2xl border p-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            Couple-only spending
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Keep private costs here when they should not show up in the shared wedding budget discussions.
                          </p>
                        </div>
                      )}

                      {selectedBudgetCategory.budget_scope === 'wedding' && (
                        <div className="rounded-2xl border border-border/70 bg-background p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Ownership & contract</p>
                              <p className="text-sm text-muted-foreground">
                                Choose who owns this budget line and whether the vendor contract still needs action.
                              </p>
                            </div>
                            <Badge variant="outline" className="text-[10px]">
                              {contractStatusLabel(
                                workflowDrafts[selectedBudgetCategory.id]?.contractStatus ?? selectedBudgetCategory.contract_status,
                              )}
                            </Badge>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Role in charge</Label>
                              <Select
                                value={workflowDrafts[selectedBudgetCategory.id]?.committeeRoleInCharge ?? 'unassigned'}
                                onValueChange={(value) =>
                                  setWorkflowDrafts((prev) => ({
                                    ...prev,
                                    [selectedBudgetCategory.id]: {
                                      ...(prev[selectedBudgetCategory.id] ?? {
                                        committeeRoleInCharge: 'unassigned',
                                        contractStatus: selectedBudgetCategory.contract_status,
                                      }),
                                      committeeRoleInCharge: value,
                                    },
                                  }))
                                }
                              >
                                <SelectTrigger className="h-10 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned">Unassigned</SelectItem>
                                  {committeeResponsibilityOptions.map((role) => (
                                    <SelectItem key={role} value={role}>{role}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Contract status</Label>
                              <Select
                                value={workflowDrafts[selectedBudgetCategory.id]?.contractStatus ?? selectedBudgetCategory.contract_status}
                                onValueChange={(value) =>
                                  setWorkflowDrafts((prev) => ({
                                    ...prev,
                                    [selectedBudgetCategory.id]: {
                                      ...(prev[selectedBudgetCategory.id] ?? {
                                        committeeRoleInCharge: selectedBudgetCategory.committee_role_in_charge ?? 'unassigned',
                                        contractStatus: selectedBudgetCategory.contract_status,
                                      }),
                                      contractStatus: value,
                                    },
                                  }))
                                }
                              >
                                <SelectTrigger className="h-10 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {contractStatusOptions.map((status) => (
                                    <SelectItem key={status} value={status}>{contractStatusLabel(status)}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="mt-4 flex justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              className="gap-2"
                              onClick={() => saveWorkflow(selectedBudgetCategory)}
                              disabled={savingWorkflowId === selectedBudgetCategory.id}
                            >
                              {savingWorkflowId === selectedBudgetCategory.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : null}
                              Save Workflow
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-border/70 bg-background p-4">
                        <p className="text-sm font-medium text-foreground">Update spent total</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Keep the working budget honest by saving the real total committed to this line.
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                          <div className="space-y-2">
                            <Label htmlFor={`spent-${selectedBudgetCategory.id}`}>Spent so far</Label>
                            <Input
                              id={`spent-${selectedBudgetCategory.id}`}
                              type="number"
                              value={spentDrafts[selectedBudgetCategory.id] ?? ''}
                              onChange={(e) =>
                                setSpentDrafts((prev) => ({ ...prev, [selectedBudgetCategory.id]: e.target.value }))
                              }
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="gap-2"
                            onClick={() => saveSpent(selectedBudgetCategory)}
                            disabled={savingSpentId === selectedBudgetCategory.id}
                          >
                            {savingSpentId === selectedBudgetCategory.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : null}
                            Save Spent
                          </Button>
                        </div>
                        {selectedBudgetCategory.budget_scope === 'wedding' ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="mt-4 w-full gap-2"
                            onClick={() => openSpendRecorder(selectedBudgetCategory)}
                          >
                            Record Actual Spend
                          </Button>
                        ) : (
                          <p className="mt-4 text-xs text-muted-foreground">
                            Private lines stay manual. Update the total here as those couple-only costs become real.
                          </p>
                        )}
                      </div>

                      <div className="rounded-2xl border border-border/70 bg-background p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">Recent payments on this line</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              The latest payment activity linked to {selectedBudgetCategory.name}.
                            </p>
                          </div>
                          <Badge variant="outline">{selectedCategoryPayments.length}</Badge>
                        </div>

                        {selectedCategoryPayments.length > 0 ? (
                          <div className="mt-4 space-y-3">
                            {selectedCategoryPayments.map((payment) => (
                              <div key={payment.id} className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{payment.payee_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(payment.payment_date).toLocaleDateString()}
                                      {payment.reference ? ` · ${payment.reference}` : ''}
                                    </p>
                                  </div>
                                  <p className="text-sm font-semibold text-foreground">{formatCurrency(payment.amount)}</p>
                                </div>
                                {payment.notes && (
                                  <p className="mt-2 text-xs text-muted-foreground">{payment.notes}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-4 rounded-xl border border-dashed border-border/80 bg-muted/10 p-5 text-center">
                            <p className="text-sm font-medium text-foreground">No payments recorded for this line yet</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Use “Record Payment Made” when cash actually moves so the category history stays useful.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[420px] items-center justify-center p-8">
                  <div className="max-w-md text-center">
                    <h2 className="workspace-h2">
                      {activeBudgetScope === 'personal' ? 'No private budget lines yet' : 'No wedding budget lines yet'}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {activeBudgetScope === 'personal'
                        ? 'Add honeymoon, dowry, rings, or home setup costs so the couple can track them privately.'
                        : 'Add the first wedding category so the workspace can start tracking real budget pressure.'}
                    </p>
                    <Button type="button" className="mt-5 gap-2" onClick={() => setOpen(true)}>
                      Add Category
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <details className="hidden">
        <summary className="flex cursor-pointer list-none flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-info">Budget reports</p>
              <InfoTip content="Open this when you want the deeper reporting view: summary totals, market signals, vendor commitments, and payment history." />
            </div>
            <h2 className="workspace-h2 mt-2">Open the deeper money view</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep the main workspace focused on active budget lines, then open the full reports when you need broader financial context.
            </p>
          </div>
          <Badge variant="info" className="w-fit rounded-full px-3 py-1">
            View reports
          </Badge>
        </summary>
        <div className="space-y-6 border-t border-border/70 p-5 pt-6">
          <Card className="shadow-card">
            <CardContent className="py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Money snapshot</p>
                  <p className="text-sm text-muted-foreground">
                    A compact summary of this {budgetScopeLabel}: what is planned, what is paid, and what is still open.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Remaining budget</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(remainingBudget)}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {activeBudgetScope === 'wedding' ? 'Total vendor invoices' : 'Total planned costs'}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(invoiceTotal)}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-success">Total payments made</p>
                  <p className="mt-2 text-2xl font-semibold text-success">{formatCurrency(currentScopePaymentTotal)}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-primary">Total balance</p>
                  <p className="mt-2 text-2xl font-semibold text-primary">{formatCurrency(totalBalance)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="py-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {activeBudgetScope === 'personal' ? 'Personal budget signals' : 'Budget intelligence'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {activeBudgetScope === 'personal'
                      ? 'Keep private couple costs separate and visible without mixing them into the shared wedding budget.'
                      : `Use real paid spend to sharpen your planning benchmarks.${selectedClient?.wedding_location ? ` Benchmarks are tuned to ${selectedClient.wedding_location}.` : ''}`}
                  </p>
                </div>
                {activeBudgetScope === 'wedding' && benchmarksLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Refreshing benchmarks
                  </div>
                )}
              </div>
              {activeBudgetScope === 'wedding' && highlightedBenchmarks.length > 0 && (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {highlightedBenchmarks.map(({ category, benchmark }) => (
                    <div key={category} className="rounded-lg border border-border/70 bg-background px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">{category}</span>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                          {benchmark?.sample_size ?? 0} obs
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{benchmarkSummary(benchmark)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {activeBudgetScope === 'wedding' && (
            <Card className="shadow-card">
              <CardContent className="py-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Final vendor payment map</p>
                    <p className="text-sm text-muted-foreground">
                      Committed vendor spend from the vendors workflow, kept separate from the category editor.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Committed contracts</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(totalFinalVendorContract)}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Paid so far</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(totalFinalVendorPaid)}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(totalFinalVendorOutstanding)}</p>
                  </div>
                </div>

                {finalVendorPayments.length > 0 ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {finalVendorPayments.map((vendor) => (
                      <div key={vendor.id} className="rounded-lg border border-border/70 bg-background px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{vendor.category}</p>
                            <p className="text-sm text-muted-foreground">{vendor.name}</p>
                          </div>
                          <Badge variant={vendorPaymentStatusTone(vendor.payment_status)} className="text-[10px]">
                            {vendorPaymentStatusLabel(vendor.payment_status)}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Contract</p>
                            <p className="mt-1 text-sm font-medium text-foreground">{formatCurrency(vendor.price)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Paid</p>
                            <p className="mt-1 text-sm font-medium text-foreground">{formatCurrency(vendor.amount_paid)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Outstanding</p>
                            <p className="mt-1 text-sm font-medium text-foreground">{formatCurrency(Math.max((vendor.price ?? 0) - vendor.amount_paid, 0))}</p>
                          </div>
                        </div>
                        {vendor.payment_due_date && (
                          <p className="mt-3 text-xs text-muted-foreground">Next payment due {new Date(vendor.payment_due_date).toLocaleDateString()}.</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No final vendors selected yet. Finalize vendors in the vendors workflow to see contract and payment tracking here.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {budgetViewMode === 'payments_made' ? (
            <Card className="shadow-card">
              <CardContent className="py-5">
                <p className="text-sm font-medium text-foreground">Payments made</p>
                {currentScopePayments.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {currentScopePayments.map((payment) => (
                      <div key={payment.id} className="grid gap-3 rounded-lg border border-border/70 bg-background px-4 py-3 md:grid-cols-[1.2fr_0.8fr_0.8fr_1.2fr]">
                        <div>
                          <p className="text-sm font-medium text-foreground">{payment.payee_name}</p>
                          <p className="text-xs text-muted-foreground">{payment.category_name}</p>
                        </div>
                        <div className="text-sm font-medium text-foreground">{formatCurrency(payment.amount)}</div>
                        <div className="text-sm text-muted-foreground">{new Date(payment.payment_date).toLocaleDateString()}</div>
                        <div className="text-sm text-muted-foreground">{payment.reference || 'No payment reference'}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No payments recorded yet. Use “Record Payment Made” to start building your payment history.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : currentScopePayments.length > 0 ? (
            <Card className="shadow-card">
              <CardContent className="py-5">
                <p className="text-sm font-medium text-foreground">Payments by category</p>
                <div className="mt-4 space-y-6">
                  {Object.entries(paymentsByCategory).map(([categoryName, payments]) => (
                    <div key={categoryName} className="space-y-3">
                      <div className="border-b border-border pb-2">
                        <p className="text-lg font-semibold text-foreground">{categoryName}</p>
                      </div>
                      {payments.map((payment) => (
                        <div key={payment.id} className="grid gap-3 rounded-lg border border-border/70 bg-background px-4 py-3 md:grid-cols-[1.2fr_0.8fr_0.8fr_1.2fr]">
                          <div className="text-sm font-medium text-foreground">{payment.payee_name}</div>
                          <div className="text-sm font-medium text-foreground">{formatCurrency(payment.amount)}</div>
                          <div className="text-sm text-muted-foreground">{new Date(payment.payment_date).toLocaleDateString()}</div>
                          <div className="text-sm text-muted-foreground">{payment.reference || 'No payment reference'}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </details>

      <Dialog open={Boolean(recordingCategory)} onOpenChange={(nextOpen) => { if (!nextOpen) setRecordingCategory(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              Record Actual Spend{recordingCategory ? ` · ${recordingCategory.name}` : ''}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={recordSpendObservation} className="space-y-4">
            <FormSubmitError message={spendSubmitError} />
            <div className="space-y-2">
              <Label>Vendor / payee name</Label>
              <Input
                value={spendLog.vendorName}
                onChange={(e) => {
                  setSpendLog((prev) => ({ ...prev, vendorName: e.target.value }));
                  setSpendFormErrors((current) => ({ ...current, vendorName: undefined }));
                  setSpendSubmitError(null);
                }}
                placeholder="e.g. Enashipai, Bloom Flowers, DJ Mo"
                required
              />
              <FormFieldError message={spendFormErrors.vendorName} />
            </div>
            <div className="space-y-2">
              <Label>Amount paid (KES)</Label>
              <Input
                type="number"
                value={spendLog.amount}
                onChange={(e) => {
                  setSpendLog((prev) => ({ ...prev, amount: e.target.value }));
                  setSpendFormErrors((current) => ({ ...current, amount: undefined }));
                  setSpendSubmitError(null);
                }}
                placeholder="0"
                required
              />
              <FormFieldError message={spendFormErrors.amount} />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={spendLog.notes}
                onChange={(e) => setSpendLog((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="What this covered, negotiated extras, etc."
              />
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border/70 p-3">
              <Checkbox
                id="add-to-budget-spent"
                checked={spendLog.addToSpent}
                onCheckedChange={(checked) => setSpendLog((prev) => ({ ...prev, addToSpent: checked === true }))}
              />
              <div className="space-y-1">
                <Label htmlFor="add-to-budget-spent" className="cursor-pointer">Also add this amount to the category spent total</Label>
                <p className="text-xs text-muted-foreground">
                  Leave this on for real payments. Turn it off if you only want to log market intelligence.
                </p>
              </div>
            </div>
            <Button type="submit" className="w-full gap-2" disabled={recordingSpend}>
              {recordingSpend ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Record Spend
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
