import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Trash2 } from 'lucide-react';
import heroImage from '@/assets/hero-wedding.jpg';
import BrandWordmark from '@/components/BrandWordmark';
import PublicSiteFooter from '@/components/PublicSiteFooter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getHomeRouteForRole } from '@/lib/roles';
import { saveEstimatorPlanDraft, seedPendingEstimatorPlanForUser } from '@/lib/estimatorPlanSeed';
import {
  buildInteractiveBudgetPlan,
  getBudgetUtilizationPercentage,
  getBudgetUtilizationStatus,
  getGuestExperienceCost,
  removeInteractiveBudgetCategory,
  updateInteractiveBudgetAllocation,
  updateInteractiveBudgetSettings,
  type InteractiveBudgetPlan,
} from '@/lib/interactiveBudgetPlan';

function formatCurrency(value: number) {
  return `KES ${Math.round(value).toLocaleString()}`;
}

export default function Landing() {
  const [budgetInput, setBudgetInput] = useState('1500000');
  const [guestInput, setGuestInput] = useState('120');
  const [plan, setPlan] = useState<InteractiveBudgetPlan | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const resultsRef = useRef<HTMLElement | null>(null);
  const professionalEntryRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();

  const guestExperienceCost = useMemo(
    () => plan ? getGuestExperienceCost(plan) : 0,
    [plan],
  );

  const utilizationPercentage = useMemo(
    () => plan ? getBudgetUtilizationPercentage(plan) : 0,
    [plan],
  );

  const utilizationStatus = getBudgetUtilizationStatus(utilizationPercentage);
  const utilizationLabel = utilizationStatus === 'safe'
    ? 'Safe range'
    : utilizationStatus === 'warning'
      ? utilizationPercentage < 100 ? 'Near limit' : 'At limit'
      : 'Over budget';
  const utilizationClassName = utilizationStatus === 'safe'
    ? 'border-success/30 bg-success/10 text-success'
    : utilizationStatus === 'warning'
      ? 'border-warning/40 bg-warning/10 text-warning-foreground'
      : 'border-destructive/30 bg-destructive/10 text-destructive';

  const visibleAllocations = useMemo(() => {
    if (!plan) return [];
    if (showAllCategories) return plan.allocations;
    return [...plan.allocations]
      .filter((allocation) => allocation.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [plan, showAllCategories]);

  const persistPlanDraft = (nextPlan: InteractiveBudgetPlan) => {
    saveEstimatorPlanDraft({
      guestCount: nextPlan.guestCount,
      county: 'Nairobi',
      weddingStyle: 'classic',
      venueTier: 'mid_tier',
      totalBudget: nextPlan.totalBudget,
      allocations: nextPlan.allocations.map(({ name, amount, percentage }) => ({
        name,
        amount,
        percentage,
      })),
    });
  };

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
    setPlan(nextPlan);
    persistPlanDraft(nextPlan);
    window.requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  };

  const handleProfessionalEntry = () => {
    professionalEntryRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'center',
    });
    window.requestAnimationFrame(() => professionalEntryRef.current?.focus({ preventScroll: true }));
  };

  const handleAllocationChange = (category: string, value: string) => {
    if (!plan) return;
    const amount = Number(value.replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount < 0) return;

    const nextPlan = updateInteractiveBudgetAllocation(plan, category, amount);
    setPlan(nextPlan);
    persistPlanDraft(nextPlan);
  };

  const handleRemoveCategory = (category: string) => {
    if (!plan) return;
    const nextPlan = removeInteractiveBudgetCategory(plan, category);
    setPlan(nextPlan);
    persistPlanDraft(nextPlan);
  };

  const handlePlanSettingsChange = () => {
    if (!plan) return;
    const totalBudget = Number(budgetInput.replace(/,/g, ''));
    const guestCount = Number(guestInput.replace(/,/g, ''));

    if (!Number.isFinite(totalBudget) || totalBudget <= 0 || !Number.isFinite(guestCount) || guestCount <= 0) {
      setBudgetInput(String(plan.totalBudget));
      setGuestInput(String(plan.guestCount));
      toast({
        title: 'Use valid planning numbers',
        description: 'Budget and guest count must both be greater than zero.',
        variant: 'destructive',
      });
      return;
    }

    const nextPlan = updateInteractiveBudgetSettings(plan, totalBudget, guestCount);
    setPlan(nextPlan);
    persistPlanDraft(nextPlan);
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
      });

      if (seeded) {
        toast({
          title: 'Wedding plan ready',
          description: 'Your budget, vendor shortlist, and starter tasks are ready.',
        });
        navigate('/budget');
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
                <button
                  type="button"
                  onClick={handleProfessionalEntry}
                  className="inline-flex min-h-11 items-center text-xs font-medium text-primary-foreground/75 transition-colors duration-200 hover:text-primary-foreground sm:text-sm"
                >
                  For professionals
                </button>
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent sm:text-sm sm:tracking-[0.2em]">Wedding planning, made clearer</p>
            <h1 className="mt-3 font-display text-3xl font-semibold leading-[1.1] tracking-tight text-primary-foreground sm:mt-4 sm:text-5xl lg:text-6xl">
              Welcome to Zania.
            </h1>
            <p className="mt-4 text-lg font-medium leading-7 text-primary-foreground sm:mt-5 sm:text-2xl sm:leading-9">
              Start planning your Kenyan wedding from anywhere in the world.
            </p>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-primary-foreground/75 sm:mt-5 sm:text-base sm:leading-7 lg:mx-0">
              Start by getting your wedding budget estimate here.
            </p>
          </motion.div>

          <Card id="budget-builder" className="w-full border-border/80 bg-card/95 text-card-foreground shadow-card backdrop-blur-md">
            <CardContent className="p-4 sm:p-8">
              <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary sm:text-sm sm:tracking-[0.16em]">Your starting point</p>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{plan ? 'Step 2 of 3 · Shape your plan' : 'Step 1 of 3 · Set your goal'}</p>
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
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={budgetInput}
                      onChange={(event) => setBudgetInput(event.target.value)}
                      className="h-11 bg-background pl-14 text-sm font-semibold sm:h-12 sm:text-base"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest-count" className="text-sm font-semibold">Expected guests</Label>
                  <Input
                    id="guest-count"
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={guestInput}
                    onChange={(event) => setGuestInput(event.target.value)}
                    className="h-11 bg-background text-sm font-semibold sm:h-12 sm:text-base"
                  />
                </div>
              </div>

              <Button onClick={handleBuildPlan} className="mt-5 h-11 w-full gap-2 text-sm font-semibold sm:mt-6 sm:h-12 sm:text-base">
                Get Estimate
              </Button>

              {!user ? (
                <div
                  ref={professionalEntryRef}
                  id="professional-entry"
                  tabIndex={-1}
                  className="mt-5 scroll-mt-24 border-t border-border pt-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 sm:mt-6 sm:pt-5"
                >
                  <div className="rounded-lg border border-border bg-secondary/35 p-3 sm:p-4">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary sm:text-sm sm:tracking-[0.16em]">Professional access</p>
                        <p className="mt-1 text-sm font-semibold text-foreground sm:text-base">Choose your workspace</p>
                      </div>
                      <p className="text-xs text-muted-foreground sm:text-sm">Skip the couple builder</p>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3 lg:grid-cols-1 xl:grid-cols-2">
                      <Link
                        to="/auth?mode=signup&audience=professional&role=planner"
                        className="group flex min-h-14 items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-foreground transition-[border-color,background-color] duration-200 hover:border-primary/50 hover:bg-background sm:gap-4 sm:px-4 sm:py-3"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">Planner</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground sm:text-sm">Create account</span>
                        </span>
                        <span className="hidden text-sm font-semibold text-primary transition-colors duration-200 group-hover:text-foreground sm:inline">Open</span>
                      </Link>

                      <Link
                        to="/auth?mode=signup&audience=professional&role=vendor"
                        className="group flex min-h-14 items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-foreground transition-[border-color,background-color] duration-200 hover:border-primary/50 hover:bg-background sm:gap-4 sm:px-4 sm:py-3"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">Vendor</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground sm:text-sm">Create account</span>
                        </span>
                        <span className="hidden text-sm font-semibold text-primary transition-colors duration-200 group-hover:text-foreground sm:inline">Open</span>
                      </Link>
                    </div>
                  </div>
                </div>
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
            <CardContent className="grid grid-cols-2 p-0 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="p-4 sm:p-5">
                <Label htmlFor="plan-total-budget" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-sm sm:tracking-[0.16em]">Your budget</Label>
                <div className="relative mt-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">KES</span>
                  <Input
                    id="plan-total-budget"
                    aria-label="Adjust wedding budget"
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={budgetInput}
                    onChange={(event) => setBudgetInput(event.target.value)}
                    onBlur={handlePlanSettingsChange}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur();
                    }}
                    className="h-10 bg-background pl-12 text-sm font-semibold sm:h-11 sm:text-base"
                  />
                </div>
                <div className={`mt-2 inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-xs font-semibold sm:mt-3 sm:px-3 sm:text-sm ${utilizationClassName}`} aria-live="polite">
                  {Math.round(utilizationPercentage)}%<span className="hidden sm:inline">&nbsp;planned</span>&nbsp;·&nbsp;{utilizationLabel}
                </div>
              </div>
              <div className="border-l border-border p-4 sm:border-l-0 sm:p-5">
                <Label htmlFor="plan-guest-count" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-sm sm:tracking-[0.16em]">Guests</Label>
                <Input
                  id="plan-guest-count"
                  aria-label="Adjust guest count"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={guestInput}
                  onChange={(event) => setGuestInput(event.target.value)}
                  onBlur={handlePlanSettingsChange}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                  className="mt-2 h-10 bg-background text-sm font-semibold sm:h-11 sm:text-base"
                />
                <p className="mt-3 hidden text-sm text-muted-foreground sm:block">Adjust as your guest list changes.</p>
              </div>
              <div className="col-span-2 flex items-center justify-between border-t border-border p-4 sm:col-span-1 sm:block sm:border-t-0 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-sm sm:tracking-[0.16em]">Guest-facing cost</p>
                <div className="text-right sm:text-left">
                  <p className="text-base font-bold sm:mt-2 sm:text-2xl">{formatCurrency(guestExperienceCost / plan.guestCount)}</p>
                  <p className="text-xs text-muted-foreground sm:mt-1 sm:text-sm">per guest</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-5 border-border bg-card shadow-card">
            <CardContent className="p-4 sm:p-8">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary sm:text-sm sm:tracking-[0.18em]">Your first draft</p>
                    <h2 id="budget-plan-heading" className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Shape the plan</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Change any amount or remove what you do not need. Your budget status updates automatically.</p>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground sm:text-sm">{plan.allocations.length} budget items available</span>
                </div>

                <div id="budget-category-list" className="mt-4 space-y-2 sm:mt-6">
                  <AnimatePresence initial={false}>
                    {visibleAllocations.map((allocation) => (
                    <motion.div
                      layout={!prefersReducedMotion}
                      key={allocation.name}
                      initial={false}
                      exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -4 }}
                      transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: 'easeOut' }}
                      className="grid grid-cols-[minmax(0,1fr)_7.5rem_3rem_2.75rem] items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 transition-colors duration-200 focus-within:border-ring sm:grid-cols-[minmax(0,1fr)_9rem_5rem_2.75rem] sm:gap-3 sm:p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground" title={allocation.name}>{allocation.name}</p>
                        <div className="mt-2 hidden h-1.5 overflow-hidden rounded-full bg-muted sm:block">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(allocation.percentage, 100)}%` }} />
                        </div>
                      </div>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[0.625rem] font-bold text-muted-foreground sm:left-3 sm:text-sm">KES</span>
                        <Input
                          key={`${allocation.name}-${allocation.amount}`}
                          type="number"
                          min="0"
                          aria-label={`${allocation.name} amount`}
                          defaultValue={allocation.amount}
                          onBlur={(event) => handleAllocationChange(allocation.name, event.target.value)}
                          className="h-10 pl-8 pr-2 text-right text-xs font-semibold sm:h-11 sm:pl-12 sm:pr-3 sm:text-sm"
                        />
                      </div>
                      <p className="text-right text-xs font-semibold text-muted-foreground sm:text-sm">{allocation.percentage.toFixed(1)}%</p>
                      <button
                        type="button"
                        disabled={plan.allocations.length <= 1}
                        onClick={() => handleRemoveCategory(allocation.name)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-destructive transition-[background-color,color] duration-200 hover:bg-destructive/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Remove ${allocation.name}`}
                        title={`Remove ${allocation.name}`}
                      >
                        <Trash2 className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </motion.div>
                  ))}
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
                    <p className="text-sm font-semibold">Happy with this starting point?</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">Save it to your private Zania workspace and continue with linked tasks and vendors.</p>
                  </div>
                  <Button disabled={isSaving} onClick={() => void handleSavePlan()} className="mt-4 h-11 w-full gap-2 sm:mt-0 sm:w-auto sm:px-6">
                    {isSaving ? 'Saving plan...' : user ? 'Save to my workspace' : 'Save my plan'}
                  </Button>
                </div>
            </CardContent>
          </Card>
        </motion.section>
      ) : null}

      <PublicSiteFooter />
    </div>
  );
}
