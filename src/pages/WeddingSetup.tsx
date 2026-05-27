import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Heart,
  Loader2,
  MapPin,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react';
import KenyaLocationFields from '@/components/KenyaLocationFields';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  clearPendingWeddingSetup,
  completePendingWeddingSetup,
  getPendingWeddingSetup,
  getTimezoneOptions,
  persistPendingWeddingSetup,
  planningCountryOptions,
  weddingReferenceCurrencies,
  weddingReferenceCurrencyLabels,
  type WeddingOwnerRole,
  type WeddingPlanningMode,
  type WeddingReferenceCurrency,
} from '@/lib/weddingWorkspace';

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
  { id: 'basics', title: 'Wedding basics', description: 'Name the wedding, choose your role, and add the core details.' },
  { id: 'planning', title: 'Planning setup', description: 'Set the planning mode, location context, and diaspora preferences if needed.' },
  { id: 'review', title: 'Review & create', description: 'Double-check the setup before creating the wedding workspace.' },
];

const planningModeOptions: Array<{ value: WeddingPlanningMode; title: string; body: string }> = [
  {
    value: 'local',
    title: 'Planning from Kenya',
    body: 'Use local wedding planning defaults and keep budgeting centered on the wedding location.',
  },
  {
    value: 'diaspora',
    title: 'Planning from abroad',
    body: 'Track the wedding from another country with your own timezone and reference currency.',
  },
];

function buildSuggestedWeddingName(name: string) {
  const firstName = name.trim().split(/\s+/)[0];
  return firstName ? `${firstName}'s Wedding` : 'Our Wedding';
}

function summarizePlanningMode(mode: WeddingPlanningMode, country: string, currency: string, timezone: string) {
  if (mode === 'local') return 'Local wedding planning from Kenya';
  return [country, currency, timezone].filter(Boolean).join(' · ');
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
  const [completion, setCompletion] = useState<CompletionState | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detectedTimezone && timezoneOptions.includes(detectedTimezone)) {
      setOwnerTimezone(detectedTimezone);
    }
  }, [timezoneOptions]);

  useEffect(() => {
    if (!pendingSetup) return;

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
    setOwnerTimezone(pendingSetup.ownerTimezone ?? ownerTimezone);
  }, [ownerTimezone, pendingSetup, profile?.full_name, user?.email]);

  useEffect(() => {
    if (loading || completion) return;
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }

    if (!pendingSetup) {
      navigate(profile?.role === 'couple' ? '/dashboard' : '/settings', { replace: true });
    }
  }, [completion, loading, navigate, pendingSetup, profile?.role, user]);

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

  if (loading || !user || !pendingSetup) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
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
    } catch (error: any) {
      toast({ title: 'Almost there', description: error.message, variant: 'destructive' });
    }
  };

  const goPreviousStep = () => {
    setCurrentStep(createSteps[Math.max(activeStepIndex - 1, 0)].id);
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
    } catch (error: any) {
      toast({
        title: 'Could not finish setup',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (completion) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(228,122,57,0.14),transparent_22%),linear-gradient(180deg,#fcfaf6,#f5efe8)] px-4 py-8">
        <div className="mx-auto max-w-3xl">
          <Card className="overflow-hidden border-primary/20 shadow-[0_22px_60px_rgba(71,49,32,0.12)]">
            <CardHeader className="border-b border-border/60 bg-primary/5 text-center">
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <CardTitle className="font-display text-4xl">
                {completion.action === 'joined' ? 'You are in' : 'Wedding workspace created'}
              </CardTitle>
              <CardDescription className="mx-auto max-w-xl text-base">
                {completion.action === 'joined'
                  ? `You are now connected to ${completion.weddingName ?? 'the wedding'} and can continue inside the workspace.`
                  : `${completion.weddingName ?? 'Your wedding'} is ready. The next step is to start turning plans into action.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6 sm:p-8">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <p className="text-sm font-medium text-muted-foreground">Wedding</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{completion.weddingName ?? 'Your wedding'}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <p className="text-sm font-medium text-muted-foreground">Partner invite</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    {completion.partnerInviteSent ? 'Sent' : completion.partnerInviteQueued ? 'Saved' : 'Optional'}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <p className="text-sm font-medium text-muted-foreground">Next stop</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    {completion.action === 'joined' ? 'Wedding Home' : 'Start planning'}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <p className="font-medium text-foreground">What happens next</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>Review your wedding home for the countdown, setup status, and next actions.</li>
                  <li>Open Tasks, Budget, Guests, or Timeline whenever you are ready to start moving.</li>
                  <li>Use Settings later for edits, partner invites, and ownership details.</li>
                </ul>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => navigate('/settings')}>
                  Open Settings
                </Button>
                <Button onClick={() => navigate(completion.route)} className="gap-2">
                  Go to wedding home
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(228,122,57,0.14),transparent_24%),linear-gradient(180deg,#fcfaf6,#f5efe8)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border border-border/60 bg-[linear-gradient(180deg,rgba(75,52,43,0.96),rgba(91,64,52,0.94))] p-5 text-[#fff7ed] shadow-[0_22px_60px_rgba(40,22,16,0.24)]">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f17a35]/22 text-[#ffd7bf]">
              <Heart className="h-5 w-5" fill="currentColor" />
            </span>
            <div>
              <p className="font-display text-2xl font-semibold">Zania</p>
              <p className="text-sm text-[#f8dcc8]/72">Wedding setup</p>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#f8dcc8]/62">
              {isCreateFlow ? 'Create your wedding' : 'Join a wedding'}
            </p>
            <h1 className="font-display text-3xl leading-tight">
              {isCreateFlow ? 'Set up your shared wedding workspace.' : 'Finish joining the wedding workspace.'}
            </h1>
            <p className="text-sm leading-6 text-[#fef2e9]/78">
              {isCreateFlow
                ? 'We only need the essentials now. You can refine details, invite your partner, and keep planning once the workspace is ready.'
                : 'Use the invitation code that was shared with you, then we will connect you to the right wedding role automatically.'}
            </p>
          </div>

          {isCreateFlow ? (
            <div className="mt-8 space-y-3">
              {createSteps.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setCurrentStep(step.id)}
                  className={`w-full rounded-[1.35rem] border px-4 py-4 text-left transition ${
                    currentStep === step.id
                      ? 'border-[#ffcfb1]/28 bg-white/[0.10]'
                      : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f8dcc8]/58">Step {index + 1}</p>
                  <p className="mt-1 text-lg font-semibold text-[#fff7ed]">{step.title}</p>
                  <p className="mt-1 text-sm text-[#fef2e9]/66">{step.description}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-[1.5rem] border border-white/12 bg-white/[0.05] p-4">
              <p className="text-sm font-medium text-[#fff7ed]">Signing in as</p>
              <p className="mt-2 text-base text-[#fef2e9]/78">{user.email}</p>
              <p className="mt-3 text-sm text-[#fef2e9]/66">
                If this is not the email that was invited, go back and sign in with the correct one before continuing.
              </p>
            </div>
          )}

          <div className="mt-8 rounded-[1.5rem] border border-white/12 bg-white/[0.05] p-4 text-sm text-[#fef2e9]/72">
            <p className="font-medium text-[#fff7ed]">Good to know</p>
            <p className="mt-2">
              Partner invites, planning mode, and budget context can all be adjusted later. This first pass is only about getting you into a usable wedding workspace fast.
            </p>
          </div>
        </aside>

        <main className="rounded-[2rem] border border-border/60 bg-card/96 shadow-[0_22px_60px_rgba(66,45,31,0.10)]">
          <div className="border-b border-border/60 px-5 py-5 sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/70">
                  {isCreateFlow ? 'Couple onboarding' : 'Wedding invite'}
                </p>
                <h2 className="mt-2 font-display text-3xl text-foreground">
                  {isCreateFlow ? createSteps[activeStepIndex].title : 'Join with your wedding code'}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {isCreateFlow ? createSteps[activeStepIndex].description : 'Enter the code from your invitation email and we will connect you to the shared wedding workspace.'}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  clearPendingWeddingSetup();
                  navigate('/auth', { replace: true });
                }}
              >
                Exit setup
              </Button>
            </div>
          </div>

          <div className="space-y-6 px-5 py-6 sm:px-8 sm:py-8">
            {isCreateFlow ? (
              <>
                {currentStep === 'basics' ? (
                  <div className="grid gap-6">
                    <Card className="border-border/70 shadow-none">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 font-display">
                          <Sparkles className="h-5 w-5 text-primary" />
                          Make it feel like your wedding
                        </CardTitle>
                        <CardDescription>
                          Start with the basics. We will use this to create the shared wedding workspace for both of you.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
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
                                className={`rounded-2xl border px-4 py-4 text-left transition ${
                                  weddingOwnerRole === option.value
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border/60 bg-background hover:border-primary/40'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                                    <UserRound className="h-5 w-5" />
                                  </span>
                                  <div>
                                    <p className="font-medium text-foreground">{option.title}</p>
                                    <p className="text-sm text-muted-foreground">{option.body}</p>
                                  </div>
                                </div>
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
                            <p className="text-xs text-muted-foreground">Optional now. You can send the invite later from Settings too.</p>
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
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            <p className="text-sm font-medium text-foreground">Wedding location</p>
                          </div>
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
                    <Card className="border-border/70 shadow-none">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 font-display">
                          <CalendarDays className="h-5 w-5 text-primary" />
                          Planning context
                        </CardTitle>
                        <CardDescription>
                          Choose the mode that best matches how this wedding will be managed day to day.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="grid gap-3">
                          {planningModeOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setPlanningMode(option.value)}
                              className={`rounded-2xl border px-4 py-4 text-left transition ${
                                planningMode === option.value
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border/60 bg-background hover:border-primary/40'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                                  {option.value === 'diaspora' ? <Users className="h-5 w-5" /> : <Heart className="h-5 w-5" fill="currentColor" />}
                                </span>
                                <div>
                                  <p className="font-medium text-foreground">{option.title}</p>
                                  <p className="mt-1 text-sm text-muted-foreground">{option.body}</p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>

                        {planningMode === 'diaspora' ? (
                          <div className="grid gap-4 rounded-2xl border border-primary/15 bg-primary/5 p-4 sm:grid-cols-2">
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
                          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                            Zania will use Kenya-first defaults for this wedding and keep the planning context centered on the wedding location.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ) : null}

                {currentStep === 'review' ? (
                  <div className="grid gap-6">
                    <Card className="border-primary/20 bg-primary/5 shadow-none">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 font-display">
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                          Ready to create
                        </CardTitle>
                        <CardDescription>
                          This is what we will use to create the wedding workspace. You can edit details later from inside Zania.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-border/70 bg-card p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Wedding</p>
                          <p className="mt-2 text-lg font-semibold text-foreground">{weddingName || 'Not set'}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-card p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Owner role</p>
                          <p className="mt-2 text-lg font-semibold capitalize text-foreground">{weddingOwnerRole || 'Not set'}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-card p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Date & location</p>
                          <p className="mt-2 text-lg font-semibold text-foreground">
                            {[weddingDate || null, [weddingTown, weddingCounty].filter(Boolean).join(', ') || null].filter(Boolean).join(' · ') || 'Add later'}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-card p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Planning mode</p>
                          <p className="mt-2 text-lg font-semibold text-foreground">
                            {summarizePlanningMode(planningMode, planningCountry, referenceCurrency, ownerTimezone)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/70 shadow-none">
                      <CardHeader>
                        <CardTitle className="font-display text-xl">What happens after create</CardTitle>
                        <CardDescription>
                          You will land in Wedding Home with space to keep planning right away.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm text-muted-foreground">
                        <p>We will create the shared wedding workspace and store your planning context immediately.</p>
                        <p>If you added a partner email, we will queue the invite so the second owner can join using that email.</p>
                        <p>You can keep refining budget, tasks, vendors, timeline, and guest coordination after the workspace opens.</p>
                      </CardContent>
                    </Card>
                  </div>
                ) : null}
              </>
            ) : (
              <Card className="border-border/70 shadow-none">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display">
                    <Users className="h-5 w-5 text-primary" />
                    Join the wedding
                  </CardTitle>
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
                  <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                    Once the code is accepted, we will connect you to the right wedding role automatically and take you straight into the shared workspace.
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-border/60 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="text-sm text-muted-foreground">
              {isCreateFlow
                ? `Step ${activeStepIndex + 1} of ${createSteps.length}`
                : 'Invite-based wedding access'}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              {isCreateFlow && currentStep !== 'basics' ? (
                <Button type="button" variant="outline" onClick={goPreviousStep} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              ) : null}
              {isCreateFlow && currentStep !== 'review' ? (
                <Button type="button" onClick={goNextStep} className="gap-2">
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" onClick={finishSetup} disabled={submitting} className="gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isCreateFlow ? 'Create wedding workspace' : 'Join wedding'}
                </Button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
