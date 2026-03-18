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
import { Plus, Trash2, Wallet, Loader2, Save, Receipt, Sparkles, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { createVendorPriceObservation, getVendorPriceBenchmark, type VendorPriceBenchmark } from '@/lib/vendorPriceIntelligence';
import { vendorPaymentStatusLabel, vendorPaymentStatusTone } from '@/lib/vendorPayments';

interface BudgetCategory {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  budget_scope: 'wedding' | 'personal';
  visibility: 'public' | 'private';
}

type BudgetScope = 'wedding' | 'personal';

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

function formatCurrency(value: number | null | undefined) {
  if (value == null) return 'N/A';
  return `KES ${Number(value).toLocaleString()}`;
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
  const [newCategoryScope, setNewCategoryScope] = useState<BudgetScope>('wedding');
  const [activeBudgetScope, setActiveBudgetScope] = useState<BudgetScope>('wedding');
  const [spentDrafts, setSpentDrafts] = useState<Record<string, string>>({});
  const [savingSpentId, setSavingSpentId] = useState<string | null>(null);
  const [benchmarksLoading, setBenchmarksLoading] = useState(false);
  const [categoryBenchmarks, setCategoryBenchmarks] = useState<Record<string, VendorPriceBenchmark>>({});
  const [addModalBenchmark, setAddModalBenchmark] = useState<VendorPriceBenchmark | null>(null);
  const [addModalBenchmarkLoading, setAddModalBenchmarkLoading] = useState(false);
  const [recordingCategory, setRecordingCategory] = useState<BudgetCategory | null>(null);
  const [recordingSpend, setRecordingSpend] = useState(false);
  const [finalVendorPayments, setFinalVendorPayments] = useState<FinalVendorPayment[]>([]);
  const [spendLog, setSpendLog] = useState<SpendLogForm>({
    vendorName: '',
    amount: '',
    notes: '',
    addToSpent: true,
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
    if (open) setNewCategoryScope(activeBudgetScope);
  }, [open, activeBudgetScope]);

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
    })) as BudgetCategory[];

    setCategories(rows);
    setSpentDrafts(Object.fromEntries(rows.map((row) => [row.id, String(row.spent || 0)])));
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
      .select('id, name, category, price, amount_paid, payment_status, payment_due_date')
      .or(dataOrFilter)
      .eq('selection_status', 'final')
      .order('category');

    if (error) {
      toast({
        title: 'Failed to load final vendor payments',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setFinalVendorPayments(
      ((data ?? []) as any[]).map((row) => ({
        ...row,
        amount_paid: Number(row.amount_paid ?? 0),
        price: row.price != null ? Number(row.price) : null,
      })),
    );
  };

  useEffect(() => {
    void loadFinalVendorPayments();
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
                <Label>Category Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Venue, Catering" required />
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
