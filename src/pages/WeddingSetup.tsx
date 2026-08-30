import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import KenyaLocationFields from '@/components/KenyaLocationFields';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import BrandWordmark from '@/components/BrandWordmark';
import {
  clearPendingWeddingSetup,
  completePendingWeddingSetup,
  getPendingWeddingSetup,
  reconcilePendingWeddingSetupForExistingWorkspace,
  getSuggestedReferenceCurrencyForPlanningCountry,
  getSuggestedTimezoneForPlanningCountry,
  getTimezoneOptions,
  persistPendingWeddingSetup,
  planningCountryOptions,
  weddingReferenceCurrencies,
  weddingReferenceCurrencyLabels,
  type WeddingOwnerRole,
  type WeddingPlanningMode,
  type WeddingReferenceCurrency,
} from '@/lib/weddingWorkspace';
import { PublicPageSkeleton } from '@/components/AppLoadingSkeletons';
import PublicSiteFooter from '@/components/PublicSiteFooter';

type CreateStep = 'basics' | 'planning' | 'review';

type CompletionState = {
  action: 'created' | 'joined' | null;
  route: string;
  weddingName?: string | null;
  partnerInviteQueued?: boolean;
  partnerInviteSent?: boolean;
  proposedRole?: string | null;
};

const createSteps: Array<{ id: CreateStep; title: string; description: string }> = [
  { id: 'basics', title: 'Wedding details', description: 'Add the name, date, location, and your partner.' },
  { id: 'planning', title: 'Planning location', description: 'Tell us whether you are planning from Kenya or abroad.' },
  { id: 'review', title: 'Check details', description: 'Check everything before creating the wedding.' },
];

const planningModeOptions: Array<{ value: WeddingPlanningMode; title: string; body: string }> = [
  {
    value: 'local',
    title: 'From Kenya',
    body: 'Use Kenya time and KES.',
  },
  {
    value: 'diaspora',
    title: 'From another country',
    body: 'Choose your country, currency, and timezone.',
  },
];

const RECONCILE_SETUP_TIMEOUT_MS = 2500;

function buildSuggestedWeddingName(name: string) {
  const firstName = name.trim().split(/\s+/)[0];
  return firstName ? `${firstName}'s Wedding` : 'Our Wedding';
}

function summarizePlanningMode(mode: WeddingPlanningMode, country: string, currency: string, timezone: string) {
  if (mode === 'local') return 'Local wedding planning from Kenya';
  return [country, currency, timezone].filter(Boolean).join(' · ');
}

function formatWeddingDate(value: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export default function WeddingSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, loading } = useAuth();

  const pendingSetup = useMemo(
    () => (user ? getPendingWeddingSetup(user.user_metadata, user.email ?? null) : null),
    [user],
  );
  const timezoneOptions = useMemo(() => getTimezoneOptions(), []);
  const hydratedSetupKeyRef = useRef<string | null>(null);

  const [currentStep, setCurrentStep] = useState<CreateStep>('basics');
  const [weddingName, setWeddingName] = useState('');
  const [weddingOwnerRole, setWeddingOwnerRole] = useState<WeddingOwnerRole | ''>('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [weddingDate, setWeddingDate] = useState('');
  const [weddingCounty, setWeddingCounty] = useState('');
  const [weddingTown, setWeddingTown] = useState('');
  const [weddingCode, setWeddingCode] = useState('');
  const [planningMode, setPlanningMode] = useState<WeddingPlanningMode>('local');
  const [planningCountry, setPlanningCountry] = useState('');
  const [referenceCurrency, setReferenceCurrency] = useState<WeddingReferenceCurrency | ''>('');
  const [ownerTimezone, setOwnerTimezone] = useState('Africa/Nairobi');
  const [submitting, setSubmitting] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [completion, setCompletion] = useState<CompletionState | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detectedTimezone && timezoneOptions.includes(detectedTimezone)) {
      setOwnerTimezone(detectedTimezone);
    }
  }, [timezoneOptions]);

  useEffect(() => {
    if (planningMode !== 'diaspora') return;
    const suggestedTimezone = getSuggestedTimezoneForPlanningCountry(planningCountry);
    const suggestedCurrency = getSuggestedReferenceCurrencyForPlanningCountry(planningCountry);
    if (suggestedTimezone) {
      setOwnerTimezone(suggestedTimezone);
    }
    if (suggestedCurrency) {
      setReferenceCurrency(suggestedCurrency);
    }
  }, [planningCountry, planningMode]);

  const pendingSetupHydrationKey = useMemo(
    () => JSON.stringify(pendingSetup ?? null),
    [pendingSetup],
  );

  useEffect(() => {
    if (!pendingSetup) return;
    if (hydratedSetupKeyRef.current === pendingSetupHydrationKey) return;

    setWeddingName(
      pendingSetup.weddingName
      || (profile?.full_name ? buildSuggestedWeddingName(profile.full_name) : '')
      || buildSuggestedWeddingName(user?.email?.split('@')[0] ?? ''),
    );
    setWeddingOwnerRole(pendingSetup.weddingOwnerRole ?? '');
    setPartnerEmail(pendingSetup.partnerEmail ?? '');
    setWeddingDate(pendingSetup.weddingDate ?? '');
    setWeddingCounty(pendingSetup.weddingCounty ?? '');
    setWeddingTown(pendingSetup.weddingTown ?? '');
    setWeddingCode(pendingSetup.weddingCode ?? '');
    setPlanningMode(pendingSetup.planningMode ?? 'local');
    setPlanningCountry(pendingSetup.planningCountry ?? '');
    setReferenceCurrency(pendingSetup.referenceCurrency ?? '');
    setOwnerTimezone((currentTimezone) => pendingSetup.ownerTimezone ?? currentTimezone);
    hydratedSetupKeyRef.current = pendingSetupHydrationKey;
  }, [pendingSetup, pendingSetupHydrationKey, profile?.full_name, user?.email]);

  useEffect(() => {
    if (!user || !pendingSetup || completion) return;

    if (pendingSetup.intent === 'create_wedding') {
      persistPendingWeddingSetup({
        ...pendingSetup,
        intent: 'create_wedding',
        email: user.email ?? pendingSetup.email ?? null,
        weddingName: weddingName.trim() || null,
        weddingOwnerRole: weddingOwnerRole || null,
        partnerEmail: partnerEmail.trim().toLowerCase() || null,
        weddingDate: weddingDate || null,
        weddingCounty: weddingCounty || null,
        weddingTown: weddingTown || null,
        planningMode,
        planningCountry: planningMode === 'diaspora' ? planningCountry.trim() || null : null,
        referenceCurrency: planningMode === 'diaspora' ? referenceCurrency || null : null,
        ownerTimezone: planningMode === 'diaspora' ? ownerTimezone.trim() || null : null,
      });
      return;
    }

    persistPendingWeddingSetup({
      ...pendingSetup,
      intent: 'join_wedding',
      email: user.email ?? pendingSetup.email ?? null,
      weddingCode: weddingCode.trim().toUpperCase() || null,
    });
  }, [
    completion,
    ownerTimezone,
    partnerEmail,
    pendingSetup,
    planningCountry,
    planningMode,
    referenceCurrency,
    user,
    weddingCode,
    weddingCounty,
    weddingDate,
    weddingName,
    weddingOwnerRole,
    weddingTown,
  ]);

  useEffect(() => {
    if (!user || !pendingSetup || completion) return;

    let active = true;
    setReconciling(true);

    const reconcileAttempt = Promise.race([
      reconcilePendingWeddingSetupForExistingWorkspace(user),
      new Promise<{ handled: false; route: '' }>((resolve) => {
        window.setTimeout(() => resolve({ handled: false, route: '' }), RECONCILE_SETUP_TIMEOUT_MS);
      }),
    ]);

    void reconcileAttempt
      .then((result) => {
        if (!active || !result.handled) return;
        navigate(result.route, { replace: true });
      })
      .catch((error) => {
        console.error('Failed to reconcile pending wedding setup', error);
      })
      .finally(() => {
        if (active) {
          setReconciling(false);
        }
      });

    return () => {
      active = false;
    };
  }, [completion, navigate, pendingSetup, user]);

  if (loading || reconciling) {
    return <PublicPageSkeleton />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!pendingSetup) {
    return <Navigate to={profile?.role === 'couple' ? '/dashboard' : '/settings'} replace />;
  }

  const isCreateFlow = pendingSetup.intent === 'create_wedding';
  const activeStepIndex = createSteps.findIndex((step) => step.id === currentStep);

  const validateCreateStep = (step: CreateStep) => {
    if (step === 'basics') {
      if (!weddingName.trim()) throw new Error('Add a wedding name to continue.');
      if (!weddingOwnerRole) throw new Error('Choose whether you are starting this wedding as the bride or groom.');
      return;
    }

    if (step === 'planning' && planningMode === 'diaspora') {
      if (!planningCountry.trim()) throw new Error('Choose the country you are planning from.');
      if (!referenceCurrency) throw new Error('Choose a reference currency to continue.');
      if (!ownerTimezone.trim()) throw new Error('Choose your timezone to continue.');
    }
  };

  const goNextStep = () => {
    try {
      validateCreateStep(currentStep);
      setCurrentStep(createSteps[Math.min(activeStepIndex + 1, createSteps.length - 1)].id);
    } catch (error: unknown) {
      toast({ title: 'Almost there', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const goPreviousStep = () => {
    setCurrentStep(createSteps[Math.max(activeStepIndex - 1, 0)].id);
  };

  const goToStep = (nextStep: CreateStep) => {
    const nextIndex = createSteps.findIndex((step) => step.id === nextStep);
    if (nextIndex <= activeStepIndex) {
      setCurrentStep(nextStep);
      return;
    }

    try {
      for (let index = 0; index < nextIndex; index += 1) {
        validateCreateStep(createSteps[index].id);
      }
      setCurrentStep(nextStep);
    } catch (error: unknown) {
      toast({ title: 'Almost there', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const finishSetup = async () => {
    setSubmitting(true);

    try {
      if (isCreateFlow) {
        validateCreateStep('basics');
        validateCreateStep('planning');
      } else if (!weddingCode.trim()) {
        throw new Error('Add the wedding code from your invite before continuing.');
      }

      const result = await completePendingWeddingSetup(user);
      setCompletion({
        action: result.action,
        route: result.route,
        weddingName: result.weddingName ?? weddingName,
        partnerInviteQueued: result.partnerInviteQueued,
        partnerInviteSent: result.partnerInviteSent,
        proposedRole: result.proposedRole ?? null,
      });
      toast({
        title: result.action === 'created' ? 'Wedding workspace ready' : 'Wedding joined',
        description:
          result.action === 'created'
            ? result.partnerInviteSent
              ? 'Your wedding is ready and the partner invite email has been sent.'
              : result.partnerInviteQueued
                ? 'Your wedding is ready. You can resend the partner invite later from Settings.'
                : 'Your wedding workspace is ready.'
            : 'Your invitation was accepted successfully.',
      });
    } catch (error: unknown) {
      toast({
        title: 'Could not finish setup',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (completion) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/70 bg-card">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
            <BrandWordmark size="md" />
            <span className="text-sm text-muted-foreground">Wedding setup</span>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
          <Card className="border-border shadow-none">
            <CardHeader className="border-b border-border/70 text-center sm:p-8">
              <CardTitle className="mt-2 text-3xl sm:text-4xl">
                {completion.action === 'joined' ? 'You joined the wedding' : `${completion.weddingName ?? 'Your wedding'} is ready`}
              </CardTitle>
              <CardDescription className="mx-auto max-w-xl text-base">
                {completion.action === 'joined'
                  ? `Open ${completion.weddingName ?? 'the wedding'} to continue.`
                  : 'Open Wedding Home to see your first task.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-5 sm:p-8">
              {completion.partnerInviteSent || completion.partnerInviteQueued ? (
                <p className="text-sm text-muted-foreground">
                  Partner invite {completion.partnerInviteSent ? 'sent' : 'saved'}.
                </p>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => navigate('/settings')}>
                  Open settings
                </Button>
                <Button onClick={() => navigate(completion.route)}>Open Wedding Home</Button>
              </div>
            </CardContent>
          </Card>
        </main>
        <PublicSiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70 bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
          <div className="flex items-center gap-4">
            <BrandWordmark size="md" />
            <span className="hidden border-l border-border pl-4 text-sm text-muted-foreground sm:inline">Wedding setup</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-auto px-2 py-1 text-muted-foreground"
            onClick={() => {
              clearPendingWeddingSetup();
              navigate('/auth', { replace: true });
            }}
          >
            Exit setup
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <section className="mb-8 max-w-3xl">
          <h1 className="font-editorial text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
            {isCreateFlow ? 'Set up your wedding' : 'Join this wedding'}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {isCreateFlow
              ? 'Add the details you know now. You can change them later.'
              : 'Enter the code from your invitation.'}
          </p>
        </section>

        {isCreateFlow ? (
          <nav aria-label="Wedding setup progress" className="mb-6 border-y border-border/70">
            <ol className="grid grid-cols-3">
              {createSteps.map((step, index) => {
                const isActive = currentStep === step.id;
                const isComplete = index < activeStepIndex;
                return (
                  <li key={step.id} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => goToStep(step.id)}
                      aria-current={isActive ? 'step' : undefined}
                      className={`relative w-full px-2 py-4 text-left transition-colors duration-200 sm:px-5 ${
                        isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.16em]">
                        Step {index + 1}{isComplete ? ' · Complete' : ''}
                      </span>
                      <span className="mt-1 block truncate text-sm font-medium sm:text-base">{step.title}</span>
                      {isActive ? <span className="absolute inset-x-2 bottom-0 h-0.5 bg-primary sm:inset-x-5" /> : null}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : (
          <div className="mb-6 rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user.email}</span>
          </div>
        )}

        <main className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border/70 px-5 py-5 sm:px-8 sm:py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
                  {isCreateFlow ? createSteps[activeStepIndex].title : 'Join with your wedding code'}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {isCreateFlow ? createSteps[activeStepIndex].description : 'Enter the code from your invitation email and we will connect you to the shared wedding workspace.'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6 px-5 py-6 sm:px-8 sm:py-8">
            {isCreateFlow ? (
              <>
                {currentStep === 'basics' ? (
                  <div className="grid gap-6">
                    <Card className="rounded-lg border-border shadow-none">
                      <CardHeader className="p-5 sm:p-6">
                        <CardTitle className="font-sans text-xl">Wedding details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-5 px-5 pb-5 sm:px-6 sm:pb-6">
                        <div className="space-y-2">
                          <Label htmlFor="wedding-name">Wedding name</Label>
                          <Input
                            id="wedding-name"
                            value={weddingName}
                            onChange={(event) => setWeddingName(event.target.value)}
                            placeholder="e.g. Mary & James Wedding"
                          />
                        </div>

                        <div className="space-y-3">
                          <Label>I am starting this wedding as</Label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {([
                              { value: 'bride', title: 'Bride', body: 'We will connect the groom as the second owner later.' },
                              { value: 'groom', title: 'Groom', body: 'We will connect the bride as the second owner later.' },
                            ] as const).map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => setWeddingOwnerRole(option.value)}
                                aria-pressed={weddingOwnerRole === option.value}
                                className={`rounded-lg border px-4 py-4 text-left transition-colors duration-200 ${
                                  weddingOwnerRole === option.value
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border/60 bg-background hover:border-primary/40'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <p className="font-medium text-foreground">{option.title}</p>
                                  {weddingOwnerRole === option.value ? (
                                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Selected</span>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-sm leading-5 text-muted-foreground">{option.body}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="partner-email">Partner email</Label>
                            <Input
                              id="partner-email"
                              type="email"
                              value={partnerEmail}
                              onChange={(event) => setPartnerEmail(event.target.value)}
                              placeholder={weddingOwnerRole === 'bride' ? 'groom@example.com' : 'bride@example.com'}
                            />
                            <p className="text-xs text-muted-foreground">Optional. You can invite them later.</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="wedding-date">Wedding date</Label>
                            <Input
                              id="wedding-date"
                              type="date"
                              value={weddingDate}
                              onChange={(event) => setWeddingDate(event.target.value)}
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <p className="text-sm font-medium text-foreground">Wedding location</p>
                          <KenyaLocationFields
                            county={weddingCounty}
                            town={weddingTown}
                            onCountyChange={setWeddingCounty}
                            onTownChange={setWeddingTown}
                            countyLabel="County"
                            townLabel="Town / area"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : null}

                {currentStep === 'planning' ? (
                  <div className="grid gap-6">
                    <Card className="rounded-lg border-border shadow-none">
                      <CardHeader className="p-5 sm:p-6">
                        <CardTitle className="font-sans text-xl">Where are you planning from?</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-5 px-5 pb-5 sm:px-6 sm:pb-6">
                        <div className="grid gap-3">
                          {planningModeOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setPlanningMode(option.value)}
                              aria-pressed={planningMode === option.value}
                              className={`rounded-lg border px-4 py-4 text-left transition-colors duration-200 ${
                                planningMode === option.value
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border/60 bg-background hover:border-primary/40'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <p className="font-medium text-foreground">{option.title}</p>
                                {planningMode === option.value ? (
                                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Selected</span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-sm leading-5 text-muted-foreground">{option.body}</p>
                            </button>
                          ))}
                        </div>

                        {planningMode === 'diaspora' ? (
                          <div className="grid gap-4 rounded-lg border border-primary/15 bg-primary/5 p-4 sm:grid-cols-2">
                            <div className="space-y-2 sm:col-span-2">
                              <Label>Planning from</Label>
                              <Select value={planningCountry} onValueChange={setPlanningCountry}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Choose your planning country" />
                                </SelectTrigger>
                                <SelectContent>
                                  {planningCountryOptions.map((option) => (
                                    <SelectItem key={option} value={option}>{option}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Reference currency</Label>
                              <Select
                                value={referenceCurrency}
                                onValueChange={(value) => setReferenceCurrency(value as WeddingReferenceCurrency)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Choose a currency" />
                                </SelectTrigger>
                                <SelectContent>
                                  {weddingReferenceCurrencies.map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {weddingReferenceCurrencyLabels[option]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Timezone</Label>
                              <Select value={ownerTimezone} onValueChange={setOwnerTimezone}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Choose your timezone" />
                                </SelectTrigger>
                                <SelectContent>
                                  {timezoneOptions.map((option) => (
                                    <SelectItem key={option} value={option}>{option}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                            We will use Kenya time and KES.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ) : null}

                {currentStep === 'review' ? (
                  <div className="grid gap-6">
                    <Card className="rounded-lg border-border shadow-none">
                      <CardHeader className="p-5 sm:p-6">
                        <CardTitle className="font-sans text-2xl">Check your details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-5 px-5 pb-5 sm:px-6 sm:pb-6">
                        <div className="grid overflow-hidden rounded-lg border border-border sm:grid-cols-2">
                          <div className="border-b border-border p-4 sm:border-r">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Wedding</p>
                            <p className="mt-2 text-lg font-semibold text-foreground">{weddingName || 'Not set'}</p>
                          </div>
                          <div className="border-b border-border p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Owner role</p>
                            <p className="mt-2 text-lg font-semibold capitalize text-foreground">{weddingOwnerRole || 'Not set'}</p>
                          </div>
                          <div className="border-b border-border p-4 sm:border-b-0 sm:border-r">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Date & location</p>
                            <p className="mt-2 font-semibold text-foreground">
                              {formatWeddingDate(weddingDate) || 'Add later'}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {[weddingTown, weddingCounty].filter(Boolean).join(', ') || 'Location to be confirmed'}
                            </p>
                          </div>
                          <div className="p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Planning mode</p>
                            <p className="mt-2 font-semibold text-foreground">
                              {planningMode === 'local' ? 'Planning from Kenya' : planningCountry || 'Planning from abroad'}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {planningMode === 'local'
                                ? 'Kenya-first defaults'
                                : [referenceCurrency, ownerTimezone].filter(Boolean).join(' · ') || 'Diaspora setup'}
                            </p>
                          </div>
                        </div>
                        <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                          <p className="font-medium text-foreground">You can change these later.</p>
                          {partnerEmail ? (
                            <p className="mt-1">Partner invite ready for {partnerEmail}</p>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : null}
              </>
            ) : (
              <Card className="rounded-lg border-border shadow-none">
                <CardHeader>
                  <CardTitle>Join the wedding</CardTitle>
                  <CardDescription>
                    Use the same email that was invited and enter the wedding code exactly as it appears in the invite.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="wedding-code">Wedding code</Label>
                    <Input
                      id="wedding-code"
                      value={weddingCode}
                      onChange={(event) => setWeddingCode(event.target.value.toUpperCase())}
                      placeholder="e.g. ZN-NT32QM"
                    />
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                    We will open the wedding after the code is accepted.
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-border/70 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="text-sm text-muted-foreground">
              {isCreateFlow
                ? `Step ${activeStepIndex + 1} of ${createSteps.length}`
                : 'Invite-based wedding access'}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              {isCreateFlow && currentStep !== 'basics' ? (
                <Button type="button" variant="outline" onClick={goPreviousStep}>Back</Button>
              ) : null}
              {isCreateFlow && currentStep !== 'review' ? (
                <Button type="button" onClick={goNextStep}>Continue</Button>
              ) : (
                <Button type="button" onClick={finishSetup} disabled={submitting}>
                  {submitting
                    ? isCreateFlow ? 'Creating wedding…' : 'Joining wedding…'
                    : isCreateFlow ? 'Create wedding' : 'Join wedding'}
                </Button>
              )}
            </div>
          </div>
        </main>
      </div>
      <PublicSiteFooter />
    </div>
  );
}
