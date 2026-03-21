import { useEffect, useMemo, useState } from 'react';
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
import { Plus, Trash2, Wallet, Loader2, Save, Receipt, Sparkles, Lock, CalendarDays } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { committeeResponsibilityOptions, contractStatusLabel, contractStatusOptions } from '@/lib/committeeRoles';
import { createVendorPriceObservation, getVendorPriceBenchmark, type VendorPriceBenchmark } from '@/lib/vendorPriceIntelligence';
import { vendorPaymentStatusLabel, vendorPaymentStatusTone } from '@/lib/vendorPayments';
import { personalBudgetTemplates } from '@/lib/personalBudgetTemplates';
import { weddingBudgetTemplates } from '@/lib/weddingBudgetTemplates';

interface BudgetCategory {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  budget_scope: 'wedding' | 'personal';
  visibility: 'public' | 'private';
  committee_role_in_charge: string | null;
  contract_status: string;
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

export default function Budget() {
  const { user } = useAuth();
  const { isPlanner, selectedClient, dataOrFilter } = usePlanner();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [allocated, setAllocated] = useState('');
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [newCategoryScope, setNewCategoryScope] = useState<BudgetScope>('wedding');
  const [activeBudgetScope, setActiveBudgetScope] = useState<BudgetScope>('wedding');
  const [budgetViewMode, setBudgetViewMode] = useState<BudgetViewMode>('by_category');
  const [spentDrafts, setSpentDrafts] = useState<Record<string, string>>({});
  const [workflowDrafts, setWorkflowDrafts] = useState<Record<string, BudgetWorkflowDraft>>({});
  const [savingSpentId, setSavingSpentId] = useState<string | null>(null);
  const [savingWorkflowId, setSavingWorkflowId] = useState<string | null>(null);
  const [benchmarksLoading, setBenchmarksLoading] = useState(false);
  const [categoryBenchmarks, setCategoryBenchmarks] = useState<Record<string, VendorPriceBenchmark>>({});
  const [addModalBenchmark, setAddModalBenchmark] = useState<VendorPriceBenchmark | null>(null);
  const [addModalBenchmarkLoading, setAddModalBenchmarkLoading] = useState(false);
  const [recordingCategory, setRecordingCategory] = useState<BudgetCategory | null>(null);
  const [recordingSpend, setRecordingSpend] = useState(false);
  const [finalVendorPayments, setFinalVendorPayments] = useState<FinalVendorPayment[]>([]);
  const [vendorOptions, setVendorOptions] = useState<BudgetVendorOption[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<BudgetPaymentRecord[]>([]);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [recordingPaymentMade, setRecordingPaymentMade] = useState(false);
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

  useEffect(() => {
    if (isPlanner && !selectedClient) navigate('/clients');
  }, [isPlanner, selectedClient, navigate]);

  const showPersonalBudget = !isPlanner;

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

  const load = async () => {
    if (!dataOrFilter) return;
    const { data, error } = await supabase.from('budget_categories').select('*').or(dataOrFilter).order('created_at');
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    const rows = (data ?? []).map((item) => ({
      ...item,
      allocated: Number(item.allocated),
      spent: Number(item.spent),
      budget_scope: (item.budget_scope ?? 'wedding') as BudgetScope,
      visibility: (item.visibility ?? 'public') as 'public' | 'private',
      committee_role_in_charge: item.committee_role_in_charge ?? null,
      contract_status: item.contract_status ?? (item.budget_scope === 'personal' ? 'not_required' : 'not_started'),
    })) as BudgetCategory[];

    setCategories(rows);
    setSpentDrafts(Object.fromEntries(rows.map((row) => [row.id, String(row.spent || 0)])));
    setWorkflowDrafts(
      Object.fromEntries(
        rows.map((row) => [
          row.id,
          {
            committeeRoleInCharge: row.committee_role_in_charge ?? 'unassigned',
            contractStatus: row.contract_status ?? (row.budget_scope === 'personal' ? 'not_required' : 'not_started'),
          },
        ]),
      ),
    );
  };

  useEffect(() => {
    void load();
  }, [user, selectedClient, dataOrFilter]);

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

  const loadFinalVendorPayments = async () => {
    if (!dataOrFilter) return;

    const { data, error } = await supabase
      .from('vendors')
      .select('id, name, category, price, amount_paid, payment_status, payment_due_date, selection_status')
      .or(dataOrFilter)
      .order('category');

    if (error) {
      toast({
        title: 'Failed to load final vendor payments',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    const normalized = ((data ?? []) as any[]).map((row) => ({
      ...row,
      amount_paid: Number(row.amount_paid ?? 0),
      price: row.price != null ? Number(row.price) : null,
    }));

    setVendorOptions(normalized);
    setFinalVendorPayments(normalized.filter((row) => (row as any).selection_status === 'final'));
  };

  useEffect(() => {
    void loadFinalVendorPayments();
  }, [user, selectedClient, dataOrFilter]);

  const loadPaymentRecords = async () => {
    if (!dataOrFilter) return;

    const { data, error } = await supabase
      .from('budget_payments')
      .select('*')
      .or(dataOrFilter)
      .order('payment_date', { ascending: false });

    if (error) {
      toast({
        title: 'Failed to load payment records',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setPaymentRecords(
      ((data ?? []) as any[]).map((row) => ({
        ...row,
        amount: Number(row.amount ?? 0),
      })),
    );
  };

  useEffect(() => {
    void loadPaymentRecords();
  }, [user, selectedClient, dataOrFilter]);

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

    const insert: Record<string, unknown> = {
      user_id: user.id,
      name,
      allocated: parseFloat(allocated) || 0,
      spent: 0,
      budget_scope: newCategoryScope,
      visibility: newCategoryScope === 'personal' ? 'private' : 'public',
    };

    if (newCategoryScope === 'wedding' && isPlanner && selectedClient) insert.client_id = selectedClient.id;

    const { error } = await supabase.from('budget_categories').insert(insert);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    setName('');
    setAllocated('');
    setSelectedTemplateName('');
    setOpen(false);
    await load();
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
      await load();
    }
    setSavingSpentId(null);
  };

  const deleteCategory = async (id: string) => {
    await supabase.from('budget_categories').delete().eq('id', id);
    await load();
    await loadPaymentRecords();
  };

  const saveWorkflow = async (category: BudgetCategory) => {
    const draft = workflowDrafts[category.id];
    if (!draft) return;

    setSavingWorkflowId(category.id);
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
      await load();
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
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Enter a real KES amount greater than zero.',
        variant: 'destructive',
      });
      return;
    }

    if (!spendLog.vendorName.trim()) {
      toast({
        title: 'Vendor name required',
        description: 'Enter the vendor or payee name for this spend.',
        variant: 'destructive',
      });
      return;
    }

    setRecordingSpend(true);
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
      await load();
    } catch (error: any) {
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
  const remainingBudget = Math.max(visibleAllocated - currentScopePaymentTotal, 0);

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
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({
        title: 'Invalid payment amount',
        description: 'Enter a KES amount greater than zero.',
        variant: 'destructive',
      });
      return;
    }

    const selectedCategoryOption = selectedPaymentCategoryOption;
    if (!selectedCategoryOption) {
      toast({
        title: 'Category required',
        description: 'Choose the budget category this payment belongs to.',
        variant: 'destructive',
      });
      return;
    }

    let selectedCategory =
      paymentScopeCategories.find((category) => category.id === selectedCategoryOption.budgetCategoryId) ??
      paymentScopeCategories.find((category) => normalizeCategoryName(category.name) === normalizeCategoryName(selectedCategoryOption.name)) ??
      null;

    const selectedVendor = vendorOptions.find((vendor) => vendor.id === paymentLog.vendorId);
    const payeeName = paymentLog.payeeName.trim() || selectedVendor?.name;
    if (!payeeName) {
      toast({
        title: 'Payee required',
        description: 'Enter the vendor or payee name for this payment.',
        variant: 'destructive',
      });
      return;
    }

    setRecordingPaymentMade(true);
    try {
      if (!selectedCategory) {
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

      setPaymentDialogOpen(false);
      await Promise.all([load(), loadFinalVendorPayments(), loadPaymentRecords()]);
    } catch (error: any) {
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

  if (isPlanner && !selectedClient) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Budget</h1>
          <p className="text-muted-foreground">
            Split your shared wedding spend from the couple-only personal budget.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-full border border-border bg-background p-1">
            <Button
              type="button"
              variant={activeBudgetScope === 'wedding' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveBudgetScope('wedding')}
            >
              Wedding Budget
            </Button>
            {showPersonalBudget && (
              <Button
                type="button"
                variant={activeBudgetScope === 'personal' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveBudgetScope('personal')}
              >
                Personal Budget
              </Button>
            )}
          </div>
          <div className="flex items-center rounded-full border border-border bg-background p-1">
            <Button
              type="button"
              variant={budgetViewMode === 'payments_made' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setBudgetViewMode('payments_made')}
            >
              Payments Made
            </Button>
            <Button
              type="button"
              variant={budgetViewMode === 'by_category' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setBudgetViewMode('by_category')}
            >
              By Category
            </Button>
          </div>
          <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" variant="outline">
                <Receipt className="h-4 w-4" />
                Record Payment Made
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Record Payment Made</DialogTitle>
              </DialogHeader>
              <form onSubmit={recordPaymentMade} className="space-y-4">
                {showPersonalBudget && (
                  <div className="space-y-2">
                    <Label>Budget Type</Label>
                    <div className="flex items-center rounded-full border border-border bg-background p-1">
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
                    onValueChange={(value) => setPaymentLog((prev) => ({ ...prev, categorySelection: value, vendorId: '' }))}
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
                    onChange={(e) => setPaymentLog((prev) => ({ ...prev, payeeName: e.target.value }))}
                    placeholder="e.g. Little Cake Girl"
                    required
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Amount (KES)</Label>
                    <Input
                      type="number"
                      value={paymentLog.amount}
                      onChange={(e) => setPaymentLog((prev) => ({ ...prev, amount: e.target.value }))}
                      placeholder="0"
                      required
                    />
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
                <Button type="submit" className="w-full gap-2" disabled={recordingPaymentMade}>
                  {recordingPaymentMade ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                  Record Payment
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Category</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">Add Budget Category</DialogTitle></DialogHeader>
            <form onSubmit={addCategory} className="space-y-4">
              {newCategoryScope === 'wedding' ? (
                <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {addModalBenchmarkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-primary" />}
                    Market signal for this category
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {addModalBenchmarkLoading ? 'Loading price benchmark…' : benchmarkSummary(addModalBenchmark)}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Lock className="h-4 w-4 text-primary" />
                    Private couple spending
                  </div>
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
                    if (selectedTemplateName && e.target.value !== selectedTemplateName) {
                      setSelectedTemplateName('');
                    }
                  }}
                  placeholder={newCategoryScope === 'personal' ? 'e.g. Honeymoon, Wedding Bands' : 'e.g. Venue, Catering'}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Allocated Amount (KES)</Label>
                <Input type="number" value={allocated} onChange={e => setAllocated(e.target.value)} placeholder="0" required />
              </div>
              <Button type="submit" className="w-full">Add Category</Button>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="flex items-center gap-6 py-5">
          <Wallet className="h-10 w-10 text-primary" />
          <div className="flex-1">
            <div className="flex justify-between text-sm text-muted-foreground mb-1">
              <span>KES {visibleSpent.toLocaleString()} spent</span>
              <span>KES {visibleAllocated.toLocaleString()} budget</span>
            </div>
            <Progress value={visibleAllocated ? (visibleSpent / visibleAllocated) * 100 : 0} className="h-2.5" />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Spending summary</p>
              <p className="text-sm text-muted-foreground">
                {activeBudgetScope === 'wedding'
                  ? 'Track budget room, vendor commitments, payments made, and balance still outstanding.'
                  : 'Track private spending against your personal budget and what is still left to cover.'}
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
              <p className="text-xs uppercase tracking-wide text-emerald-600">Total payments made</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-600">{formatCurrency(currentScopePaymentTotal)}</p>
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
                {activeBudgetScope === 'personal' ? 'Personal budget board' : 'Budget intelligence is active'}
              </p>
              <p className="text-sm text-muted-foreground">
                {activeBudgetScope === 'personal'
                  ? 'Track private couple costs like rent, dowry, honeymoon, rings, and preparation expenses separately from the public wedding budget.'
                  : `Record actual paid spend here to improve your planning benchmarks.${selectedClient?.wedding_location ? ` Benchmarks are tuned to ${selectedClient.wedding_location}.` : ''}`}
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
                This summary tracks committed vendor spend from the vendors shortlist and final-selection workflow.
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
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium text-foreground">Payments made</p>
            </div>
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
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium text-foreground">Payments by category</p>
            </div>
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

      <div className="grid gap-4 sm:grid-cols-2">
        {visibleCategories.map((category) => {
          const pct = category.allocated ? Math.min((category.spent / category.allocated) * 100, 100) : 0;
          const benchmark = categoryBenchmarks[benchmarkKey(category.name)];
          const overMedian =
            category.budget_scope === 'wedding'
            && benchmark?.benchmark_visible
            && benchmark.median_amount != null
            && category.spent > benchmark.median_amount;

          return (
            <Card key={category.id} className="shadow-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base font-medium">{category.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={category.budget_scope === 'personal' ? 'secondary' : 'outline'}>
                      {category.budget_scope === 'personal' ? 'Personal' : 'Wedding'}
                    </Badge>
                    {category.visibility === 'private' && (
                      <Badge variant="secondary" className="gap-1">
                        <Lock className="h-3 w-3" />
                        Private
                      </Badge>
                    )}
                  </div>
                </div>
                <button onClick={() => deleteCategory(category.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardHeader>
              <CardContent className="space-y-4">
                {category.budget_scope === 'wedding' ? (
                  <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">Market benchmark</p>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                        {benchmark?.sample_size ?? 0} obs
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {benchmarkSummary(benchmark)}
                    </p>
                    {overMedian && (
                      <p className="mt-2 text-xs font-medium text-foreground">
                        Current spend is above the benchmark median.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Lock className="h-4 w-4 text-primary" />
                      Personal budget line
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Use this board for private couple costs that should stay separate from shared wedding vendor planning.
                    </p>
                  </div>
                )}

                <div className="flex justify-between text-sm text-muted-foreground mb-1">
                  <span>KES {category.spent.toLocaleString()}</span>
                  <span>KES {category.allocated.toLocaleString()}</span>
                </div>
                <Progress value={pct} className="h-2" />

                {category.budget_scope === 'wedding' && (
                  <div className="rounded-lg border border-border/70 bg-background px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Ownership & contract</p>
                        <p className="text-sm text-muted-foreground">
                          Match this budget line to the committee role handling it and track whether a contract exists.
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {contractStatusLabel(workflowDrafts[category.id]?.contractStatus ?? category.contract_status)}
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Role in charge</Label>
                        <Select
                          value={workflowDrafts[category.id]?.committeeRoleInCharge ?? 'unassigned'}
                          onValueChange={(value) =>
                            setWorkflowDrafts((prev) => ({
                              ...prev,
                              [category.id]: {
                                ...(prev[category.id] ?? {
                                  committeeRoleInCharge: 'unassigned',
                                  contractStatus: category.contract_status,
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
                          value={workflowDrafts[category.id]?.contractStatus ?? category.contract_status}
                          onValueChange={(value) =>
                            setWorkflowDrafts((prev) => ({
                              ...prev,
                              [category.id]: {
                                ...(prev[category.id] ?? {
                                  committeeRoleInCharge: category.committee_role_in_charge ?? 'unassigned',
                                  contractStatus: category.contract_status,
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
                        onClick={() => saveWorkflow(category)}
                        disabled={savingWorkflowId === category.id}
                      >
                        {savingWorkflowId === category.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Workflow
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="space-y-2">
                    <Label htmlFor={`spent-${category.id}`}>Spent so far</Label>
                    <Input
                      id={`spent-${category.id}`}
                      type="number"
                      value={spentDrafts[category.id] ?? ''}
                      onChange={(e) => setSpentDrafts((prev) => ({ ...prev, [category.id]: e.target.value }))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => saveSpent(category)}
                    disabled={savingSpentId === category.id}
                  >
                    {savingSpentId === category.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Spent
                  </Button>
                </div>

                {category.budget_scope === 'wedding' ? (
                  <Button type="button" variant="secondary" className="w-full gap-2" onClick={() => openSpendRecorder(category)}>
                    <Receipt className="h-4 w-4" />
                    Record Actual Spend
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Personal lines stay manual. Update spent totals directly as you commit those private costs.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
        {visibleCategories.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-12">
            {activeBudgetScope === 'personal'
              ? 'No personal budget categories yet. Add one to track private couple costs like dowry, honeymoon, or home setup.'
              : 'No wedding budget categories yet. Add one to get started!'}
          </p>
        )}
      </div>

      <Dialog open={Boolean(recordingCategory)} onOpenChange={(nextOpen) => { if (!nextOpen) setRecordingCategory(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              Record Actual Spend{recordingCategory ? ` · ${recordingCategory.name}` : ''}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={recordSpendObservation} className="space-y-4">
            <div className="space-y-2">
              <Label>Vendor / payee name</Label>
              <Input
                value={spendLog.vendorName}
                onChange={(e) => setSpendLog((prev) => ({ ...prev, vendorName: e.target.value }))}
                placeholder="e.g. Enashipai, Bloom Flowers, DJ Mo"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Amount paid (KES)</Label>
              <Input
                type="number"
                value={spendLog.amount}
                onChange={(e) => setSpendLog((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0"
                required
              />
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
              {recordingSpend ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
              Record Spend
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
