import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Trash2 } from 'lucide-react';
import heroImage from '@/assets/hero-wedding.jpg';
import BrandWordmark from '@/components/BrandWordmark';
import { AnimatedCardDetails } from '@/components/AnimatedCardDetails';
import PublicSiteFooter from '@/components/PublicSiteFooter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getHomeRouteForRole } from '@/lib/roles';
import { isPlanningExperimentEnabled } from '@/lib/featureFlags';
import { saveEstimatorPlanDraft, seedPendingEstimatorPlanForUser } from '@/lib/estimatorPlanSeed';
import {
  buildInteractiveBudgetPlan,
  calculatePercentage,
  calculatePlannedAmount,
  getBudgetUtilizationPercentage,
  getBudgetUtilizationStatus,
  getCoreGuestCost,
  removeInteractiveBudgetCategory,
  resetAllInteractiveBudgetAllocations,
  resetInteractiveBudgetAllocation,
  updateInteractiveBudgetAllocation,
  updateInteractiveBudgetPercentage,
  updateInteractiveBudgetSettings,
  type BudgetResizeStrategy,
  type InteractiveBudgetPlan,
} from '@/lib/interactiveBudgetPlan';

function formatCurrency(value: number) {
  return `KES ${Math.round(value).toLocaleString()}`;
}

function formatIntegerInput(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('en-KE') : '';
}

function allocationDomId(name: string) {
  return `estimator-allocation-${name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}`;
}

export default function Landing() {
  const [budgetInput, setBudgetInput] = useState('1,500,000');
  const [guestInput, setGuestInput] = useState('120');
  const [plan, setPlan] = useState<InteractiveBudgetPlan | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [selectedAllocationName, setSelectedAllocationName] = useState<string | null>(null);
  const [allocationDraft, setAllocationDraft] = useState<{ amount: string; percentage: string; lastEditedField: 'amount' | 'percentage' } | null>(null);
  const [pendingTotalBudget, setPendingTotalBudget] = useState<number | null>(null);
  const [resetAllOpen, setResetAllOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const resultsRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();

  const previewPlan = useMemo(() => {
    if (!plan || !selectedAllocationName || !allocationDraft) return plan;
    const rawValue = allocationDraft[allocationDraft.lastEditedField].replace(/,/g, '');
    const nextValue = Number(rawValue);
    if (!Number.isFinite(nextValue) || nextValue < 0) return plan;
    const originalAllocation = plan.allocations.find((allocation) => allocation.name === selectedAllocationName);
    const nextPlan = allocationDraft.lastEditedField === 'amount'
      ? updateInteractiveBudgetAllocation(plan, selectedAllocationName, nextValue)
      : updateInteractiveBudgetPercentage(plan, selectedAllocationName, nextValue);
    if (!originalAllocation) return nextPlan;
    return {
      ...nextPlan,
      allocations: nextPlan.allocations.map((allocation) => {
        if (allocation.name !== selectedAllocationName) return allocation;
        const hasDraftChange = allocation.amount !== originalAllocation.amount;
        return {
          ...allocation,
          isManuallyEdited: originalAllocation.isManuallyEdited || hasDraftChange,
          lastEditedField: hasDraftChange ? allocationDraft.lastEditedField : originalAllocation.lastEditedField,
        };
      }),
    };
  }, [allocationDraft, plan, selectedAllocationName]);

  const coreGuestCost = useMemo(
    () => previewPlan ? getCoreGuestCost(previewPlan) : 0,
    [previewPlan],
  );

  const utilizationPercentage = useMemo(
    () => previewPlan ? getBudgetUtilizationPercentage(previewPlan) : 0,
    [previewPlan],
  );

  const utilizationStatus = getBudgetUtilizationStatus(utilizationPercentage);
  const utilizationLabel = utilizationStatus === 'complete'
    ? 'Budget fully allocated'
    : utilizationStatus === 'under'
      ? 'Left to allocate'
      : 'Over budget';
  const utilizationClassName = utilizationStatus === 'complete'
    ? 'text-success'
    : utilizationStatus === 'under'
      ? 'text-foreground'
      : 'text-destructive';

  const totalAllocated = useMemo(
    () => previewPlan?.allocations.reduce((sum, allocation) => sum + allocation.amount, 0) ?? 0,
    [previewPlan],
  );
  const remainingAllocation = (previewPlan?.totalBudget ?? 0) - totalAllocated;

  const visibleAllocations = useMemo(() => {
    if (!previewPlan) return [];
    if (showAllCategories) return previewPlan.allocations;
    return [...previewPlan.allocations]
      .filter((allocation) => allocation.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [previewPlan, showAllCategories]);

  const persistPlanDraft = (nextPlan: InteractiveBudgetPlan) => {
    saveEstimatorPlanDraft({
      guestCount: nextPlan.guestCount,
      county: 'Nairobi',
      weddingStyle: 'classic',
      venueTier: 'mid_tier',
      totalBudget: nextPlan.totalBudget,
      allocations: nextPlan.allocations.map(({ name, amount, percentage, suggestedAmount, suggestedPercentage, isManuallyEdited, lastEditedField }) => ({
        name,
        amount,
        percentage,
        suggestedAmount,
        suggestedPercentage,
        isManuallyEdited,
        lastEditedField,
      })),
    });
  };

  useEffect(() => {
    if (!plan || !selectedAllocationName) return;
    const selectedAllocation = plan.allocations.find((allocation) => allocation.name === selectedAllocationName);
    if (!selectedAllocation) return;
    setAllocationDraft({
      amount: String(selectedAllocation.amount),
      percentage: selectedAllocation.percentage.toFixed(1),
      lastEditedField: selectedAllocation.lastEditedField ?? 'amount',
    });
  }, [plan, selectedAllocationName]);

  const handleBuildPlan = () => {
    const totalBudget = Number(budgetInput.replace(/,/g, ''));
    const guestCount = Number(guestInput.replace(/,/g, ''));

    if (!Number.isFinite(totalBudget) || totalBudget <= 0) {
      toast({
        title: 'Enter your wedding budget',
        description: 'Use any amount above zero. You can change it as often as you like.',
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isFinite(guestCount) || guestCount <= 0) {
      toast({
        title: 'Enter your expected guests',
        description: 'Use your best estimate for now—you can change it later.',
        variant: 'destructive',
      });
      return;
    }

    const nextPlan = buildInteractiveBudgetPlan(totalBudget, guestCount);
    setBudgetInput(totalBudget.toLocaleString('en-KE'));
    setGuestInput(guestCount.toLocaleString('en-KE'));
    setPlan(nextPlan);
    persistPlanDraft(nextPlan);
    window.requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  };

  const handleAllocationChange = (category: string, value: string, field: 'amount' | 'percentage') => {
    if (!plan) return;
    const nextValue = Number(value.replace(/,/g, ''));
    if (!Number.isFinite(nextValue) || nextValue < 0) return;

    const nextPlan = field === 'amount'
      ? updateInteractiveBudgetAllocation(plan, category, nextValue)
      : updateInteractiveBudgetPercentage(plan, category, nextValue);
    setPlan(nextPlan);
    persistPlanDraft(nextPlan);
    const updated = nextPlan.allocations.find((allocation) => allocation.name === category);
    if (updated) {
      setAllocationDraft({
        amount: String(updated.amount),
        percentage: updated.percentage.toFixed(1),
        lastEditedField: field,
      });
    }
  };

  const handleAllocationDraftChange = (value: string, field: 'amount' | 'percentage') => {
    if (!plan) return;
    const nextValue = Number(value.replace(/,/g, ''));
    setAllocationDraft((current) => {
      const fallback = current ?? { amount: '', percentage: '', lastEditedField: field };
      if (!Number.isFinite(nextValue) || nextValue < 0 || value.trim() === '') {
        return { ...fallback, [field]: value, lastEditedField: field };
      }
      return field === 'amount'
        ? {
            amount: value,
            percentage: calculatePercentage(nextValue, plan.totalBudget).toFixed(1),
            lastEditedField: field,
          }
        : {
            amount: String(Math.round(calculatePlannedAmount(nextValue, plan.totalBudget))),
            percentage: value,
            lastEditedField: field,
          };
    });
  };

  const handleRemoveCategory = (category: string) => {
    if (!plan) return;
    const nextPlan = removeInteractiveBudgetCategory(plan, category);
    setPlan(nextPlan);
    persistPlanDraft(nextPlan);
    if (selectedAllocationName === category) {
      setSelectedAllocationName(null);
      setAllocationDraft(null);
    }
  };

  const handleBudgetGoalChange = () => {
    if (!plan) return;
    const totalBudget = Number(budgetInput.replace(/,/g, ''));
    if (!Number.isFinite(totalBudget) || totalBudget <= 0) {
      setBudgetInput(plan.totalBudget.toLocaleString('en-KE'));
      toast({
        title: 'Enter a valid budget',
        description: 'Your wedding budget must be greater than zero.',
        variant: 'destructive',
      });
      return;
    }
    if (totalBudget !== plan.totalBudget) setPendingTotalBudget(totalBudget);
  };

  const applyBudgetGoalChange = (strategy: BudgetResizeStrategy) => {
    if (!plan || pendingTotalBudget == null) return;
    const nextPlan = updateInteractiveBudgetSettings(plan, pendingTotalBudget, plan.guestCount, strategy);
    setPlan(nextPlan);
    setBudgetInput(nextPlan.totalBudget.toLocaleString('en-KE'));
    persistPlanDraft(nextPlan);
    setPendingTotalBudget(null);
  };

  const handleGuestCountChange = () => {
    if (!plan) return;
    const guestCount = Number(guestInput.replace(/,/g, ''));
    if (!Number.isFinite(guestCount) || guestCount <= 0) {
      setGuestInput(plan.guestCount.toLocaleString('en-KE'));
      toast({ title: 'Enter a valid guest count', description: 'Use at least one guest.', variant: 'destructive' });
      return;
    }

    const nextPlan = updateInteractiveBudgetSettings(plan, plan.totalBudget, guestCount, 'keep_amounts');
    setGuestInput(guestCount.toLocaleString('en-KE'));
    setPlan(nextPlan);
    persistPlanDraft(nextPlan);
  };

  const openAllocation = (name: string) => {
    if (!plan) return;
    if (selectedAllocationName === name) {
      setSelectedAllocationName(null);
      setAllocationDraft(null);
      return;
    }
    const allocation = plan.allocations.find((item) => item.name === name);
    if (!allocation) return;
    setSelectedAllocationName(name);
    setAllocationDraft({
      amount: String(allocation.amount),
      percentage: allocation.percentage.toFixed(1),
      lastEditedField: allocation.lastEditedField ?? 'amount',
    });
  };

  const resetAllocation = (name: string) => {
    if (!plan) return;
    const nextPlan = resetInteractiveBudgetAllocation(plan, name);
    setPlan(nextPlan);
    persistPlanDraft(nextPlan);
    const updated = nextPlan.allocations.find((allocation) => allocation.name === name);
    if (updated) setAllocationDraft({ amount: String(updated.amount), percentage: updated.percentage.toFixed(1), lastEditedField: 'amount' });
  };

  const handleSavePlan = async () => {
    if (!plan) return;
    persistPlanDraft(plan);

    if (!user) {
      navigate('/auth?mode=signup&flow=estimator&audience=couple&role=couple');
      return;
    }

    setIsSaving(true);
    try {
      const seeded = await seedPendingEstimatorPlanForUser({
        userId: user.id,
        role: profile?.role,
        plannerType: profile?.planner_type,
        userMetadata: user.user_metadata,
      });

      if (seeded) {
        toast({
          title: 'Estimate added',
          description: 'Confirm three priorities and Zania will build your first plan.',
        });
        navigate(isPlanningExperimentEnabled() ? '/plan' : getHomeRouteForRole(profile?.role, profile?.planner_type));
        return;
      }

      navigate(getHomeRouteForRole(profile?.role, profile?.planner_type));
    } catch (error) {
      toast({
        title: 'We could not save your plan',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-border bg-foreground text-primary-foreground">
        <div className="absolute inset-0" aria-hidden="true">
          <img src={heroImage} alt="" className="h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/95 via-foreground/75 to-foreground/55" />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/75 via-transparent to-foreground/30" />
        </div>

        <header className="relative z-20 border-b border-primary-foreground/15 bg-foreground/20 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4 lg:px-10">
            <BrandWordmark light size="sm" className="sm:hidden" />
            <BrandWordmark light size="md" className="hidden sm:inline-flex" />
            <nav className="flex items-center gap-3 sm:gap-6" aria-label="Landing page navigation">
              {!user ? (
                <Link
                  to="/auth?mode=signup&audience=professional"
                  className="inline-flex min-h-11 items-center text-xs font-medium text-primary-foreground/75 transition-colors duration-200 hover:text-primary-foreground sm:text-sm"
                >
                  For professionals
                </Link>
              ) : null}
              <Link
                to={user ? getHomeRouteForRole(profile?.role, profile?.planner_type) : '/sign-in'}
                className="inline-flex min-h-11 items-center text-xs font-semibold text-primary-foreground transition-colors duration-200 hover:text-accent sm:text-sm"
              >
                {user ? 'Open workspace' : 'Sign in'}
              </Link>
            </nav>
          </div>
        </header>

        <main className="relative z-10 mx-auto grid max-w-7xl items-center gap-8 px-4 py-8 sm:px-8 sm:py-12 lg:min-h-[720px] lg:grid-cols-[minmax(0,0.9fr)_minmax(34rem,1.1fr)] lg:gap-14 lg:px-10 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.35, ease: 'easeOut' }}
            className="max-w-xl text-center lg:text-left"
          >
            <h1 className="font-display text-3xl font-semibold leading-[1.1] tracking-tight text-primary-foreground sm:text-5xl lg:text-6xl">
              Plan your wedding budget.
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-primary-foreground/80 sm:mt-5 sm:text-xl sm:leading-8 lg:mx-0">
              Set a starting budget and guest count for a Kenyan wedding anywhere in the world.
            </p>
          </motion.div>

          <Card id="budget-builder" className="w-full border-border/80 bg-card/95 text-card-foreground shadow-card backdrop-blur-md">
            <CardContent className="p-4 sm:p-8">
              <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                  <p className="text-base font-semibold text-foreground sm:text-lg">Budget estimate</p>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{plan ? 'Adjust your plan below.' : 'Enter two numbers to begin.'}</p>
                </div>
                <span className="max-w-24 text-right text-xs font-semibold text-muted-foreground sm:max-w-none sm:text-sm">No sign-up required</span>
              </div>

              <div className="mt-4 grid gap-4 sm:mt-5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-1 xl:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="wedding-budget" className="text-sm font-semibold">Intended wedding budget</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">KES</span>
                    <Input
                      id="wedding-budget"
                      type="text"
                      inputMode="numeric"
                      value={budgetInput}
                      onChange={(event) => setBudgetInput(formatIntegerInput(event.target.value))}
                      className="h-11 bg-background pl-14 text-sm font-semibold sm:h-12 sm:text-base"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest-count" className="text-sm font-semibold">Expected guests</Label>
                  <Input
                    id="guest-count"
                    type="text"
                    inputMode="numeric"
                    value={guestInput}
                    onChange={(event) => setGuestInput(formatIntegerInput(event.target.value))}
                    className="h-11 bg-background text-sm font-semibold sm:h-12 sm:text-base"
                  />
                </div>
              </div>

              <Button onClick={handleBuildPlan} className="mt-5 h-11 w-full gap-2 text-sm font-semibold sm:mt-6 sm:h-12 sm:text-base">
                Get estimate
              </Button>

              {!user ? (
                <p className="mt-3 text-center text-xs text-muted-foreground sm:text-sm">
                  <Link
                    to="/auth?mode=signup&audience=couple&role=couple"
                    className="font-semibold text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Create an account instead
                  </Link>
                </p>
              ) : null}
            </CardContent>
          </Card>
        </main>
      </section>

      {plan ? (
        <motion.section
          ref={resultsRef}
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.25, ease: 'easeOut' }}
          className="mx-auto max-w-5xl scroll-mt-4 px-4 py-8 sm:px-8 sm:py-16 lg:px-10"
          aria-labelledby="budget-plan-heading"
        >
          <Card className="border-border bg-card shadow-card">
            <CardContent className="grid p-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
              <div className="border-b border-border p-4 sm:p-5 lg:border-b-0 lg:border-r">
                <Label htmlFor="plan-total-budget" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-sm sm:tracking-[0.16em]">
                  Intended wedding budget
                </Label>
                <div className="relative mt-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">KES</span>
                  <Input
                    id="plan-total-budget"
                    aria-label="Adjust wedding budget"
                    type="text"
                    inputMode="numeric"
                    value={budgetInput}
                    onChange={(event) => setBudgetInput(formatIntegerInput(event.target.value))}
                    onBlur={handleBudgetGoalChange}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur();
                    }}
                    className="h-10 bg-background pl-12 text-sm font-semibold sm:h-11 sm:text-base"
                  />
                </div>
              </div>

              <div className="border-b border-border lg:border-b-0 lg:border-r">
                <p className="border-b border-border px-4 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:px-5">
                  Tracking intended wedding budget
                </p>
                <div className="grid grid-cols-2">
                  <div className="border-r border-border p-4 sm:p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-sm sm:tracking-[0.16em]">Allocated</p>
                    <p className="mt-3 text-base font-bold sm:text-xl">{formatCurrency(totalAllocated)}</p>
                    <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{utilizationPercentage.toFixed(1)}% of budget</p>
                  </div>
                  <div className="p-4 sm:p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-sm sm:tracking-[0.16em]">
                      {remainingAllocation >= 0 ? 'Remaining' : 'Over budget'}
                    </p>
                    <p className={`mt-3 text-base font-bold sm:text-xl ${remainingAllocation < 0 ? 'text-destructive' : ''}`}>
                      {formatCurrency(Math.abs(remainingAllocation))}
                    </p>
                    <div className={`mt-2 inline-flex items-center gap-2 text-xs font-semibold ${utilizationClassName}`} aria-live="polite">
                      <span aria-hidden="true" className="h-px w-4 shrink-0 bg-current opacity-55" />
                      {utilizationLabel}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5">
                <Label htmlFor="plan-guest-count" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-sm sm:tracking-[0.16em]">
                  Expected guests
                </Label>
                <Input
                  id="plan-guest-count"
                  aria-label="Adjust guest count"
                  type="text"
                  inputMode="numeric"
                  value={guestInput}
                  onChange={(event) => setGuestInput(formatIntegerInput(event.target.value))}
                  onBlur={handleGuestCountChange}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                  className="mt-2 h-10 bg-background text-sm font-semibold sm:h-11 sm:text-base"
                />
                <p className="mt-2 text-xs text-muted-foreground sm:text-sm">{formatCurrency(coreGuestCost / plan.guestCount)} per guest</p>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-5 border-border bg-card shadow-card">
            <CardContent className="p-4 sm:p-8">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                  <div>
                    <h2 id="budget-plan-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">Your budget estimate</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Select a category to change it.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-muted-foreground sm:text-sm">{plan.allocations.length} items</span>
                    {plan.allocations.some((allocation) => allocation.isManuallyEdited) ? (
                      <button type="button" onClick={() => setResetAllOpen(true)} className="text-xs font-semibold text-primary underline-offset-4 hover:underline">Reset all</button>
                    ) : null}
                  </div>
                </div>

                <div id="budget-category-list" className="mt-4 space-y-2 sm:mt-6">
                  <AnimatePresence initial={false}>
                    {visibleAllocations.map((allocation) => {
                      const isSelected = selectedAllocationName === allocation.name;
                      const perGuestAmount = allocation.guestSensitive && plan.guestCount > 0
                        ? allocation.amount / plan.guestCount
                        : null;
                      return (
                        <motion.div
                          layout={!prefersReducedMotion}
                          key={allocation.name}
                          initial={false}
                          exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -4 }}
                          transition={{ duration: prefersReducedMotion ? 0 : 0.24, ease: 'easeOut' }}
                          className={`relative overflow-hidden rounded-lg border transition-[border-color,background-color,box-shadow] duration-200 ${isSelected ? 'border-primary/70 bg-primary/[0.025] shadow-card ring-1 ring-primary/15' : 'border-border bg-card hover:border-primary/30'}`}
                        >
                          <span aria-hidden="true" className={`absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-primary transition-opacity duration-200 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                          <button
                            type="button"
                            aria-expanded={isSelected}
                            aria-controls={allocationDomId(allocation.name)}
                            onClick={() => openAllocation(allocation.name)}
                            className={`min-h-[4.5rem] w-full px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5 ${isSelected ? 'bg-primary/[0.06]' : 'hover:bg-muted/25'}`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-semibold">{allocation.name}</p>
                                  {allocation.isManuallyEdited ? <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-primary">Edited</span> : null}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {isSelected ? 'Hide details' : 'View details'}
                                  {perGuestAmount == null ? '' : ` · ${formatCurrency(perGuestAmount)} per guest`}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-sm font-semibold">{formatCurrency(allocation.amount)}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{allocation.percentage.toFixed(1)}% of budget</p>
                              </div>
                            </div>
                            <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                              <motion.div layout className="h-full rounded-full bg-primary" animate={{ width: `${Math.min(allocation.percentage, 100)}%` }} transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: 'easeOut' }} />
                            </div>
                          </button>

                          <AnimatedCardDetails open={isSelected}>
                            <div id={allocationDomId(allocation.name)} className="space-y-4 border-t border-border bg-background/60 p-4 sm:p-5">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                  <Label htmlFor={`${allocationDomId(allocation.name)}-amount`}>Planned amount</Label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">KES</span>
                                    <Input
                                      id={`${allocationDomId(allocation.name)}-amount`}
                                      aria-label={`Edit planned allocation for ${allocation.name}`}
                                      type="number"
                                      min="0"
                                      inputMode="numeric"
                                      value={allocationDraft?.amount ?? String(allocation.amount)}
                                      onChange={(event) => handleAllocationDraftChange(event.target.value, 'amount')}
                                      className="pl-12"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`${allocationDomId(allocation.name)}-percentage`}>Allocation percentage</Label>
                                  <div className="relative">
                                    <Input
                                      id={`${allocationDomId(allocation.name)}-percentage`}
                                      aria-label={`Edit percentage allocation for ${allocation.name}`}
                                      type="number"
                                      min="0"
                                      step="0.1"
                                      inputMode="decimal"
                                      value={allocationDraft?.percentage ?? allocation.percentage.toFixed(1)}
                                      onChange={(event) => handleAllocationDraftChange(event.target.value, 'percentage')}
                                      className="pr-9"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">%</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <Button type="button" size="sm" onClick={() => allocationDraft && handleAllocationChange(allocation.name, allocationDraft[allocationDraft.lastEditedField], allocationDraft.lastEditedField)}>Apply</Button>
                                  <Button type="button" size="sm" variant="outline" onClick={() => openAllocation(allocation.name)}>Cancel</Button>
                                  {allocation.isManuallyEdited ? <Button type="button" size="sm" variant="link" onClick={() => resetAllocation(allocation.name)}>Reset</Button> : null}
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={plan.allocations.length <= 1}
                                  onClick={() => handleRemoveCategory(allocation.name)}
                                  className="text-destructive hover:text-destructive"
                                  aria-label={`Remove ${allocation.name}`}
                                  title={`Remove ${allocation.name}`}
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </Button>
                              </div>
                            </div>
                          </AnimatedCardDetails>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setShowAllCategories((current) => !current)}
                  aria-expanded={showAllCategories}
                  aria-controls="budget-category-list"
                  className="mt-3 h-11 w-full gap-2 border-border bg-muted/25 text-sm font-semibold text-foreground shadow-none transition-[background-color,border-color] duration-200 hover:border-primary/35 hover:bg-muted/55"
                >
                  {showAllCategories ? 'Show the essentials' : `View all ${plan.allocations.length} budget items`}
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${showAllCategories ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </Button>

                <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4 sm:flex sm:items-center sm:justify-between sm:gap-5">
                  <div>
                    <p className="text-sm font-semibold">Save this estimate</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">Keep it with your wedding plan.</p>
                  </div>
                  <Button disabled={isSaving} onClick={() => void handleSavePlan()} className="mt-4 h-11 w-full gap-2 sm:mt-0 sm:w-auto sm:px-6">
                    {isSaving ? 'Saving…' : user ? 'Save estimate' : 'Create account to save'}
                  </Button>
                </div>
            </CardContent>
          </Card>
        </motion.section>
      ) : null}

      <Dialog
        open={pendingTotalBudget != null}
        onOpenChange={(open) => {
          if (!open && plan) {
            setBudgetInput(plan.totalBudget.toLocaleString('en-KE'));
            setPendingTotalBudget(null);
          }
        }}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Update your budget</DialogTitle>
            <DialogDescription>How should Zania update the category amounts?</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Button type="button" variant="outline" className="h-auto justify-start px-4 py-3 text-left" onClick={() => applyBudgetGoalChange('scale_percentages')}>
              <span><span className="block font-semibold">Keep the same budget split</span><span className="mt-1 block text-xs font-normal text-muted-foreground">Category amounts scale with your new budget.</span></span>
            </Button>
            <Button type="button" className="h-auto justify-start px-4 py-3 text-left" onClick={() => applyBudgetGoalChange('keep_amounts')}>
              <span><span className="block font-semibold">Keep current category amounts</span><span className="mt-1 block text-xs font-normal opacity-80">Recommended · leave the added budget available for your next choice.</span></span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resetAllOpen} onOpenChange={setResetAllOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Reset all allocations?</DialogTitle>
            <DialogDescription>This restores Zania’s suggested split for the current wedding budget.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setResetAllOpen(false)}>Cancel</Button>
            <Button
              type="button"
              onClick={() => {
                if (!plan) return;
                const nextPlan = resetAllInteractiveBudgetAllocations(plan);
                setPlan(nextPlan);
                persistPlanDraft(nextPlan);
                setResetAllOpen(false);
              }}
            >
              Reset allocations
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PublicSiteFooter />
    </div>
  );
}
