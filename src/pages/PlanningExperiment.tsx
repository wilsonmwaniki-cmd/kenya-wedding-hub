import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useWeddingEntitlements } from '@/hooks/useWeddingEntitlements';
import { useAuth } from '@/contexts/AuthContext';
import { formatIntegerInput, parseIntegerInput, sanitizeIntegerInput } from '@/lib/integerInput';
import type { PlanningInput } from '@/lib/planningExperiment';
import {
  loadPlanningExperiment,
  loadPlanningExperimentStarter,
  savePlanningExperiment,
  setPlanningTaskCompleted,
  type StoredPlanningExperiment,
} from '@/lib/planningExperimentService';

const PRIORITIES = ['Food', 'Photos', 'Family', 'Style', 'Music', 'Guests'];
const BOOKABLE_CATEGORIES = ['Venue', 'Catering', 'Photography', 'Attire', 'Décor', 'Entertainment', 'Planning', 'Transport', 'Beauty'];
const WEDDING_TYPES = [
  { value: 'church', label: 'Church' },
  { value: 'traditional', label: 'Traditional' },
  { value: 'civil', label: 'Civil' },
  { value: 'garden', label: 'Garden' },
  { value: 'destination', label: 'Destination' },
  { value: 'other', label: 'Other' },
];

const EMPTY_INPUT: PlanningInput = {
  weddingDate: '',
  estimatedBudget: 0,
  estimatedGuestCount: 0,
  weddingType: 'church',
  priorities: [],
  bookedCategories: [],
};

function formatMoney(value: number) {
  return `KES ${Math.round(value).toLocaleString('en-KE')}`;
}

function toggleValue(value: string, values: string[], maximum?: number) {
  if (values.includes(value)) return values.filter((item) => item !== value);
  if (maximum && values.length >= maximum) return values;
  return [...values, value];
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
}

function getPlanningSaveErrorMessage(error: unknown) {
  const message = getErrorMessage(error, "We couldn't save your plan. Try again.");
  if (message.toLowerCase().includes('planning catalog')) {
    return "We couldn't match part of your budget. Please try again.";
  }
  return message;
}

export default function PlanningExperiment() {
  const { user, updateProfile } = useAuth();
  const { weddingId, loading: weddingLoading } = useWeddingEntitlements();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [input, setInput] = useState<PlanningInput>(EMPTY_INPUT);
  const [plan, setPlan] = useState<StoredPlanningExperiment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [taskSavingId, setTaskSavingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [budgetDraft, setBudgetDraft] = useState('');
  const [guestDraft, setGuestDraft] = useState('');
  const editingBudgetRef = useRef(false);
  const editingGuestsRef = useRef(false);

  useEffect(() => {
    if (!editingBudgetRef.current) setBudgetDraft(formatIntegerInput(input.estimatedBudget));
  }, [input.estimatedBudget]);

  useEffect(() => {
    if (!editingGuestsRef.current) setGuestDraft(formatIntegerInput(input.estimatedGuestCount));
  }, [input.estimatedGuestCount]);

  useEffect(() => {
    if (weddingLoading) return;
    if (!weddingId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);
    void loadPlanningExperiment(weddingId, user?.id)
      .then(async (storedPlan) => {
        if (cancelled) return;
        setPlan(storedPlan);
        if (storedPlan) {
          setInput(storedPlan.input);
          return;
        }
        if (!user) return;
        const starterInput = await loadPlanningExperimentStarter({
          weddingId,
          userId: user.id,
          userMetadata: user.user_metadata,
        });
        if (!cancelled) setInput(starterInput);
      })
      .catch((error: unknown) => {
        if (!cancelled) setErrorMessage(getErrorMessage(error, "We couldn't open your plan. Try again."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user, weddingId, weddingLoading]);

  const formReady = useMemo(() => (
    Boolean(input.weddingDate)
    && Number.isFinite(input.estimatedBudget)
    && input.estimatedBudget > 0
    && Number.isFinite(input.estimatedGuestCount)
    && input.estimatedGuestCount > 0
    && input.priorities.length === 3
  ), [input]);

  const prioritiesRemaining = Math.max(0, 3 - input.priorities.length);

  const updateInput = (update: (current: PlanningInput) => PlanningInput) => {
    setErrorMessage(null);
    setInput(update);
  };

  const save = async () => {
    if (!user || !weddingId || !formReady) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const savedPlan = await savePlanningExperiment({ userId: user.id, weddingId, input });
      await updateProfile({
        wedding_date: savedPlan.input.weddingDate,
        wedding_budget_goal: savedPlan.input.estimatedBudget,
        expected_guest_count: savedPlan.input.estimatedGuestCount,
      });
      setPlan(savedPlan);
      setInput(savedPlan.input);
      toast({
        title: plan ? 'Plan updated' : 'Your starting plan is ready',
        description: 'Your budget, first tasks, and next action are ready to use.',
      });
    } catch (error: unknown) {
      const message = getPlanningSaveErrorMessage(error);
      setErrorMessage(message);
      toast({ title: 'Plan not saved', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = async (taskId: string, completed: boolean) => {
    if (!weddingId || !plan) return;
    setTaskSavingId(taskId);
    try {
      const next = await setPlanningTaskCompleted({
        weddingId,
        taskId,
        completed,
        tasks: plan.tasks,
        bookedCategories: input.bookedCategories,
      });
      setPlan((current) => current ? {
        ...current,
        tasks: next.tasks,
        primaryNextAction: next.primaryNextAction,
        secondaryActions: next.secondaryActions,
      } : current);
    } catch (error: unknown) {
      toast({
        title: 'Task not updated',
        description: getErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setTaskSavingId(null);
    }
  };

  if (loading || weddingLoading) {
    return <div className="flex min-h-[45vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading your plan" /></div>;
  }

  if (!weddingId) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <Card>
          <CardHeader>
            <CardTitle>Let’s set up your wedding first</CardTitle>
            <CardDescription>Zania needs one wedding workspace before it can build your plan.</CardDescription>
          </CardHeader>
          <CardContent><Button className="w-full" onClick={() => navigate('/wedding-setup')}>Set up my wedding</Button></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Simple start</p>
        <h1 className="mt-1 text-2xl font-semibold">Build your wedding plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Answer six short questions. You can change everything later.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{plan ? 'Your wedding details' : 'Tell Zania what matters'}</CardTitle>
          <CardDescription>Pick exactly three priorities. There are no wrong answers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="plan-wedding-date">Wedding date</Label>
            <Input id="plan-wedding-date" type="date" value={input.weddingDate} onChange={(event) => updateInput((current) => ({ ...current, weddingDate: event.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="plan-budget">Estimated budget (KES)</Label>
              <Input
                id="plan-budget"
                inputMode="numeric"
                type="text"
                autoComplete="off"
                value={budgetDraft}
                onFocus={() => {
                  editingBudgetRef.current = true;
                  setBudgetDraft((current) => sanitizeIntegerInput(current));
                }}
                onChange={(event) => {
                  const next = sanitizeIntegerInput(event.target.value);
                  setBudgetDraft(next);
                  updateInput((current) => ({ ...current, estimatedBudget: parseIntegerInput(next) }));
                }}
                onBlur={() => {
                  editingBudgetRef.current = false;
                  setBudgetDraft((current) => formatIntegerInput(parseIntegerInput(current)));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-guests">Estimated guests</Label>
              <Input
                id="plan-guests"
                inputMode="numeric"
                type="text"
                autoComplete="off"
                value={guestDraft}
                onFocus={() => {
                  editingGuestsRef.current = true;
                  setGuestDraft((current) => sanitizeIntegerInput(current));
                }}
                onChange={(event) => {
                  const next = sanitizeIntegerInput(event.target.value);
                  setGuestDraft(next);
                  updateInput((current) => ({ ...current, estimatedGuestCount: parseIntegerInput(next) }));
                }}
                onBlur={() => {
                  editingGuestsRef.current = false;
                  setGuestDraft((current) => formatIntegerInput(parseIntegerInput(current)));
                }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-type">Wedding type</Label>
            <select id="plan-type" className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" value={input.weddingType} onChange={(event) => updateInput((current) => ({ ...current, weddingType: event.target.value }))}>
              {WEDDING_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Your top three priorities ({input.priorities.length}/3)</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PRIORITIES.map((item) => {
                const selected = input.priorities.includes(item);
                return <Button key={item} type="button" variant={selected ? 'default' : 'outline'} className="justify-start" aria-pressed={selected} onClick={() => updateInput((current) => ({ ...current, priorities: toggleValue(item, current.priorities, 3) }))}>{selected ? <Check className="mr-2 h-4 w-4" /> : null}{item}</Button>;
              })}
            </div>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {prioritiesRemaining > 0
                ? `Select ${prioritiesRemaining} more ${prioritiesRemaining === 1 ? 'priority' : 'priorities'} to continue.`
                : 'Three priorities selected.'}
            </p>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">What is already booked?</legend>
            <p className="text-xs text-muted-foreground">Choose any that are already confirmed. Skip this if none are booked.</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BOOKABLE_CATEGORIES.map((item) => {
                const selected = input.bookedCategories.includes(item);
                return <Button key={item} type="button" size="sm" variant={selected ? 'secondary' : 'outline'} className="justify-start" aria-pressed={selected} onClick={() => updateInput((current) => ({ ...current, bookedCategories: toggleValue(item, current.bookedCategories) }))}>{selected ? <Check className="mr-2 h-4 w-4" /> : null}{item}</Button>;
              })}
            </div>
          </fieldset>

          {errorMessage ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{errorMessage}</p> : null}
          <Button className="h-12 w-full text-base" disabled={saving || !formReady} onClick={() => void save()}>
            {saving
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Building your plan…</>
              : prioritiesRemaining > 0
                ? `Select ${prioritiesRemaining} more ${prioritiesRemaining === 1 ? 'priority' : 'priorities'}`
                : (plan ? 'Update my plan' : 'Build my plan')}
          </Button>
          {!plan ? (
            <Button type="button" variant="ghost" className="w-full text-muted-foreground" onClick={() => navigate('/dashboard')}>
              Skip for now and explore Zania
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {plan ? (
        <>
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Do this next</p>
              <CardTitle>{plan.primaryNextAction.title}</CardTitle>
              <CardDescription>{plan.primaryNextAction.detail}</CardDescription>
            </CardHeader>
            {plan.secondaryActions.length ? (
              <CardContent>
                <p className="mb-2 text-sm font-medium">After that</p>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  {plan.secondaryActions.slice(0, 3).map((action, index) => <li key={`${action.title}-${index}`}>{index + 1}. {action.title}</li>)}
                </ol>
              </CardContent>
            ) : null}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your starting budget</CardTitle>
              <CardDescription>{plan.budgetRows.length} simple categories. Open Budget to edit any amount.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="divide-y rounded-md border">
                {plan.budgetRows.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><span>{row.name}</span><span className="font-medium tabular-nums">{formatMoney(row.allocated)}</span></div>)}
              </div>
              <Button variant="outline" className="w-full" onClick={() => navigate('/budget')}>Edit my budget</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your first tasks</CardTitle>
              <CardDescription>Only the first {plan.tasks.length}. Tick one when it is done and Zania will choose the next action.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {plan.tasks.map((task) => (
                <button key={task.id ?? task.key} type="button" disabled={!task.id || taskSavingId === task.id} className="flex w-full items-center gap-3 rounded-md border p-3 text-left disabled:opacity-60" onClick={() => task.id && void toggleTask(task.id, !task.completed)}>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${task.completed ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>{taskSavingId === task.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : task.completed ? <Check className="h-4 w-4" /> : null}</span>
                  <span className="min-w-0"><span className={`block text-sm font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>{task.title}</span><span className="block text-xs text-muted-foreground">{task.category}</span></span>
                </button>
              ))}
              <Button variant="outline" className="mt-3 w-full" onClick={() => navigate('/tasks')}>Open all tasks</Button>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
