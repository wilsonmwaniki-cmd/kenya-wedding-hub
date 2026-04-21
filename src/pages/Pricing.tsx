import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Heart, Loader2, Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useWeddingEntitlements } from '@/hooks/useWeddingEntitlements';
import { supabase } from '@/integrations/supabase/client';
import {
  accessControlImplementationSteps,
  audiencePlans,
  coupleAddonDefinitions,
  coupleFeatureMatrix,
  couplePlanDefinitions,
  featureGateRows,
  formatEntitlementFeatureLabel,
  getAudiencePlan,
  getAvailableCheckoutCadences,
  getLookupKeyForCadence,
  getProfessionalAddonDefinition,
  getProfessionalPlanDefinition,
  professionalAddonDefinitions,
  professionalAddonEntitlementMap,
  professionalFeatureMatrix,
  type CoupleAddonCode,
  type CouplePlanCadence,
  type ProfessionalAddonCode,
  type ProfessionalAudience,
  type ProfessionalPlanCadence,
  type PricingAudience,
  type PricingCheckoutCadence,
} from '@/lib/pricingPlans';
import { startStripeCheckout } from '@/lib/billing';

const roleLabels = {
  couple: 'Couple',
  committee: 'Committee',
  planner: 'Planner',
  vendor: 'Vendor',
} as const;

const cadenceLabels: Record<PricingCheckoutCadence, string> = {
  one_time: 'One-time',
  monthly: 'Monthly',
  annual: 'Annual',
};

const coupleCadenceLabels: Record<CouplePlanCadence, string> = {
  monthly: 'Monthly',
  annual: 'Annual',
};

function isPricingAudience(value: string | null): value is PricingAudience {
  return value === 'couple' || value === 'committee' || value === 'planner' || value === 'vendor';
}

export default function Pricing() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { weddingId } = useWeddingEntitlements();
  const requestedAudience = searchParams.get('audience');
  const requestedFeature = searchParams.get('feature');
  const successPath = searchParams.get('successPath');
  const cancelPath = searchParams.get('cancelPath');
  const upgradeState = searchParams.get('upgrade');
  const professionalAddon = searchParams.get('professionalAddon');
  const professionalAudienceParam = searchParams.get('professionalAudience');
  const checkoutSessionId = searchParams.get('checkout_session_id');
  const [checkoutTarget, setCheckoutTarget] = useState<string | null>(null);
  const [processedProfessionalCheckout, setProcessedProfessionalCheckout] = useState<string | null>(null);
  const [selectedCadence, setSelectedCadence] = useState<Record<PricingAudience, PricingCheckoutCadence>>({
    couple: 'one_time',
    committee: 'one_time',
    planner: 'monthly',
    vendor: 'monthly',
  });
  const [selectedCoupleCadence, setSelectedCoupleCadence] = useState<Record<'basic' | 'premium', CouplePlanCadence>>({
    basic: 'annual',
    premium: 'annual',
  });
  const [selectedProfessionalCadence, setSelectedProfessionalCadence] = useState<Record<ProfessionalAudience, ProfessionalPlanCadence>>({
    planner: 'annual',
    vendor: 'annual',
  });
  const [selectedProfessionalAddonAudience, setSelectedProfessionalAddonAudience] = useState<ProfessionalAudience>('planner');

  const targetAudience = isPricingAudience(requestedAudience) ? requestedAudience : null;
  const targetPlan = targetAudience ? getAudiencePlan(targetAudience) : null;
  const highlightedFeature = formatEntitlementFeatureLabel(requestedFeature);

  useEffect(() => {
    if (!targetPlan) return;
    const availableCadences = getAvailableCheckoutCadences(targetPlan);
    setSelectedCadence((prev) => ({
      ...prev,
      [targetPlan.audience]: availableCadences[0],
    }));
  }, [targetPlan?.audience]);

  useEffect(() => {
    if (profile?.role === 'planner' && profile?.planner_type !== 'committee') {
      setSelectedProfessionalAddonAudience('planner');
      return;
    }

    if (profile?.role === 'vendor') {
      setSelectedProfessionalAddonAudience('vendor');
    }
  }, [profile?.planner_type, profile?.role]);

  useEffect(() => {
    const professionalAudience =
      professionalAudienceParam === 'planner' || professionalAudienceParam === 'vendor'
        ? professionalAudienceParam
        : null;
    const supportedAddon = professionalAddon && (
      professionalAddon === 'media_addon'
      || professionalAddon === 'advertising_addon'
      || professionalAddon === 'team_workspace_bundle_3'
      || professionalAddon === 'team_workspace_bundle_5'
      || professionalAddon === 'team_workspace_bundle_10'
    )
      ? professionalAddon
      : null;

    if (
      upgradeState !== 'success'
      || !checkoutSessionId
      || !professionalAudience
      || !supportedAddon
      || processedProfessionalCheckout === checkoutSessionId
      || !user
    ) {
      return;
    }

    let cancelled = false;
    setProcessedProfessionalCheckout(checkoutSessionId);

    const syncCheckout = async () => {
      const { data, error } = await supabase.functions.invoke<{
        activatedFeatures: string[];
        seatLimit: number | null;
      }>('sync-professional-checkout', {
        body: {
          sessionId: checkoutSessionId,
          audience: professionalAudience,
        },
      });

      if (cancelled) return;

      if (error) {
        toast({
          title: 'Payment completed but activation is still pending',
          description: error.message || 'The checkout succeeded, but we could not sync your professional add-on yet.',
          variant: 'destructive',
        });
        return;
      }

      const addonDefinition = getProfessionalAddonDefinition(supportedAddon as ProfessionalAddonCode);
      const extraSeatMessage = data?.seatLimit ? ` Your team workspace now allows up to ${data.seatLimit} seats.` : '';
      toast({
        title: `${addonDefinition.title} activated`,
        description: `Your ${professionalAudience} workspace add-on is now active.${extraSeatMessage}`,
      });
      navigate(`/pricing?upgrade=success&audience=${professionalAudience}`, { replace: true });
    };

    void syncCheckout();

    return () => {
      cancelled = true;
    };
  }, [
    checkoutSessionId,
    navigate,
    processedProfessionalCheckout,
    professionalAddon,
    professionalAudienceParam,
    toast,
    upgradeState,
    user,
  ]);

  const contextMessage = useMemo(() => {
    if (upgradeState === 'cancelled') {
      return {
        tone: 'warning' as const,
        title: 'Checkout cancelled',
        body: 'Your upgrade was not completed. You can review the plan again and continue whenever you are ready.',
      };
    }

    if (upgradeState === 'success') {
      return {
        tone: 'success' as const,
        title: 'Upgrade complete',
        body: 'Your payment was completed successfully. Return to your workspace and refresh if your new access does not appear immediately.',
      };
    }

    if (targetPlan && highlightedFeature) {
      return {
        tone: 'primary' as const,
        title: `${targetPlan.paidTierName} recommended`,
        body: `You came here to ${highlightedFeature}. This page is focused on the ${targetPlan.paidTierName} that unlocks that action.`,
      };
    }

    return null;
  }, [highlightedFeature, targetPlan, upgradeState]);

  const handleCheckout = async (audience: PricingAudience) => {
    const plan = getAudiencePlan(audience);
    const cadence = selectedCadence[audience];
    const overrides = audience === targetAudience
      ? {
          one_time: searchParams.get('oneTimeLookupKey'),
          monthly: searchParams.get('monthlyLookupKey'),
          annual: searchParams.get('annualLookupKey'),
        }
      : undefined;

    const lookupKey = getLookupKeyForCadence(plan, cadence, overrides);
    if (!lookupKey) {
      toast({
        title: 'Checkout is not configured',
        description: 'This plan is missing its Stripe price mapping. Add the lookup key and try again.',
        variant: 'destructive',
      });
      return;
    }

    if (!user) {
      const next = `/pricing?${searchParams.toString()}`;
      navigate(`/auth?mode=signup&next=${encodeURIComponent(next)}`);
      toast({
        title: 'Sign in to continue',
        description: 'We need your account before we can start checkout and connect the plan to your workspace.',
      });
      return;
    }

    setCheckoutTarget(`audience-${audience}`);
    try {
      await startStripeCheckout({
        audience,
        feature: audience === targetAudience ? requestedFeature : null,
        lookupKey,
        cadence,
        successPath: audience === targetAudience && successPath ? successPath : plan.successPath,
        cancelPath: audience === targetAudience && cancelPath ? cancelPath : plan.cancelPath,
      });
    } catch (error: any) {
      toast({
        title: 'Could not start checkout',
        description: error?.message || 'There was a problem creating your Stripe checkout session.',
        variant: 'destructive',
      });
      setCheckoutTarget(null);
    }
  };

  const handleCouplePlanCheckout = async (tier: 'basic' | 'premium') => {
    const plan = couplePlanDefinitions.find((item) => item.tier === tier);
    if (!plan) return;

    const cadence = selectedCoupleCadence[tier];
    const lookupKey = cadence === 'monthly' ? plan.stripeMonthlyLookupKey : plan.stripeAnnualLookupKey;
    if (!lookupKey) {
      toast({
        title: 'Checkout is not configured',
        description: 'This couple plan is missing its Stripe price mapping. Add the lookup key and try again.',
        variant: 'destructive',
      });
      return;
    }

    if (!user) {
      navigate('/auth?mode=signup');
      toast({
        title: 'Sign in to continue',
        description: 'We need your account before we can connect this plan to your wedding workspace.',
      });
      return;
    }

    if (!weddingId) {
      toast({
        title: 'Create or join a wedding first',
        description: 'Couple plans attach to a specific wedding workspace. Create or join your wedding before starting checkout.',
        variant: 'destructive',
      });
      return;
    }

    setCheckoutTarget(`couple-${tier}`);
    try {
      await startStripeCheckout({
        audience: 'couple',
        feature: tier === 'premium' ? 'ai_wedding_assistant' : 'wedding_collaboration',
        lookupKey,
        cadence,
        weddingId,
        successPath: '/budget?upgrade=success',
        cancelPath: '/pricing?upgrade=cancelled',
      });
    } catch (error: any) {
      toast({
        title: 'Could not start checkout',
        description: error?.message || 'There was a problem creating your Stripe checkout session.',
        variant: 'destructive',
      });
      setCheckoutTarget(null);
    }
  };

  const handleCoupleAddonCheckout = async (code: CoupleAddonCode) => {
    const addon = coupleAddonDefinitions.find((item) => item.code === code);
    if (!addon || !addon.stripeMonthlyLookupKey) return;

    if (!user) {
      navigate('/auth?mode=signup');
      toast({
        title: 'Sign in to continue',
        description: 'We need your account before we can attach this add-on to your wedding workspace.',
      });
      return;
    }

    if (!weddingId) {
      toast({
        title: 'Create or join a wedding first',
        description: 'Wedding add-ons attach to a specific wedding workspace. Create or join your wedding before checkout.',
        variant: 'destructive',
      });
      return;
    }

    setCheckoutTarget(`addon-${code}`);
    try {
      await startStripeCheckout({
        audience: 'couple',
        feature: code === 'guest_rsvp_management_addon' ? 'guest_rsvp_management' : 'gift_registry',
        lookupKey: addon.stripeMonthlyLookupKey,
        cadence: 'monthly',
        weddingId,
        successPath: code === 'guest_rsvp_management_addon' ? '/guests?upgrade=success' : '/pricing?upgrade=success',
        cancelPath: '/pricing?upgrade=cancelled',
      });
    } catch (error: any) {
      toast({
        title: 'Could not start checkout',
        description: error?.message || 'There was a problem creating your Stripe checkout session.',
        variant: 'destructive',
      });
      setCheckoutTarget(null);
    }
  };

  const handleProfessionalPlanCheckout = async (audience: ProfessionalAudience) => {
    const cadence = selectedProfessionalCadence[audience];
    setSelectedCadence((prev) => ({ ...prev, [audience]: cadence }));
    await handleCheckout(audience);
  };

  const handleProfessionalAddonCheckout = async (
    audience: ProfessionalAudience,
    code: ProfessionalAddonCode,
  ) => {
    const addon = getProfessionalAddonDefinition(code);
    if (!addon.stripeMonthlyLookupKey) return;

    if (!user) {
      navigate('/auth?mode=signup');
      toast({
        title: 'Sign in to continue',
        description: 'We need your account before we can attach this professional add-on to your workspace.',
      });
      return;
    }

    setCheckoutTarget(`professional-addon-${audience}-${code}`);
    try {
      await startStripeCheckout({
        audience,
        feature: professionalAddonEntitlementMap[code],
        lookupKey: addon.stripeMonthlyLookupKey,
        cadence: 'monthly',
        successPath: `/pricing?upgrade=success&professionalAddon=${code}&professionalAudience=${audience}&checkout_session_id={CHECKOUT_SESSION_ID}`,
        cancelPath: `/pricing?upgrade=cancelled&professionalAddon=${code}&professionalAudience=${audience}`,
      });
    } catch (error: any) {
      toast({
        title: 'Could not start checkout',
        description: error?.message || 'There was a problem creating your Stripe checkout session.',
        variant: 'destructive',
      });
      setCheckoutTarget(null);
    }
  };

  const formatKesPrice = (amount: number | null) => {
    if (amount == null) return 'Free';
    return `KES ${amount.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fcf8f3_0%,#fffdfa_24%,#ffffff_100%)] text-foreground">
      <nav className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <Heart className="h-5 w-5 text-primary" fill="currentColor" />
            <span className="font-display text-2xl font-semibold text-foreground">Zania</span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <Link to="/vendors-directory" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Vendors</Link>
            <Link to="/planners" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Planners</Link>
            <Link to="/pricing" className="text-sm font-medium text-foreground">Pricing</Link>
            <Link to="/auth" className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
              Sign In
            </Link>
          </div>
          <Link to="/auth" className="inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 md:hidden">
            Sign In
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary">
              Free to explore, pay to actively coordinate
            </Badge>
            <h1 className="mt-6 max-w-4xl font-display text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              Pricing that matches <span className="italic font-normal">how weddings really work</span>
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
              Couples and committees can explore for free, then upgrade when they need vendor connections and full coordination tools.
              Planners and vendors can start free, then pay when they scale into real operational value.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/auth">
                <Button className="w-full gap-2 sm:w-auto">
                  Create account
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/">
                <Button variant="outline" className="w-full sm:w-auto">
                  Back to homepage
                </Button>
              </Link>
            </div>
          </div>

          <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="font-display text-3xl">Commercial model</CardTitle>
                  <CardDescription className="mt-2 text-base leading-7">
                    Zania should feel generous at discovery and decisive at execution.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-background/70 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Free</p>
                <p className="mt-2 font-display text-2xl font-semibold">Explore</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  Cost estimator, browsing, shortlists, draft planning, and enough progress to understand the value.
                </p>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Paid</p>
                <p className="mt-2 font-display text-2xl font-semibold">Coordinate</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  Connections, collaboration, exports, sync, payments, and scale where the operational value actually starts.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {contextMessage && (
        <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <Card className={`rounded-[28px] border ${
            contextMessage.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50/80'
              : contextMessage.tone === 'warning'
                ? 'border-amber-200 bg-amber-50/80'
                : 'border-primary/20 bg-primary/5'
          }`}>
            <CardContent className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Upgrade context</p>
                <h2 className="mt-2 font-display text-2xl font-semibold">{contextMessage.title}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{contextMessage.body}</p>
              </div>
              {targetPlan && (
                <Badge variant="secondary" className="w-fit rounded-full px-3 py-1 text-sm">
                  {targetPlan.paidTierName}
                </Badge>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8 lg:pb-18">
        <div className="mb-12">
          <div className="mb-6 max-w-3xl">
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary">
              Couple plans
            </Badge>
            <h2 className="mt-4 font-display text-4xl font-semibold">Free helps you plan. Paid helps you coordinate.</h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              Couples start free, upgrade when the wedding becomes collaborative, and move to Premium when the whole wedding needs active coordination in one place.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {couplePlanDefinitions.map((plan) => {
              const isPaidTier = plan.tier !== 'free';
              const isLoading = checkoutTarget === `couple-${plan.tier}`;
              const cadence = isPaidTier ? selectedCoupleCadence[plan.tier] : null;
              const priceLabel = !isPaidTier
                ? 'Free forever'
                : cadence === 'monthly'
                  ? `${formatKesPrice(plan.monthlyPriceKes)} / month`
                  : `${formatKesPrice(plan.annualPriceKes)} / year`;

              return (
                <Card
                  key={plan.tier}
                  className={`h-full rounded-[28px] border bg-card/95 shadow-card ${
                    plan.tier === 'premium' ? 'border-primary/30 ring-2 ring-primary/10' : 'border-border/60'
                  }`}
                >
                  <CardHeader className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="font-display text-3xl">{plan.title}</CardTitle>
                        <CardDescription className="mt-2 text-base leading-7">{plan.tagline}</CardDescription>
                      </div>
                      {plan.tier === 'premium' && <Badge className="rounded-full px-3 py-1">Best for full coordination</Badge>}
                    </div>
                    <div>
                      <p className="font-display text-3xl font-semibold">{priceLabel}</p>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">{plan.supportCopy}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {isPaidTier && (
                      <div className="inline-flex rounded-full border border-border bg-background p-1">
                        {(['annual', 'monthly'] as const).map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setSelectedCoupleCadence((prev) => ({ ...prev, [plan.tier]: option }))}
                            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                              cadence === option ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {coupleCadenceLabels[option]}
                          </button>
                        ))}
                      </div>
                    )}

                    <ul className="space-y-2 text-sm leading-7 text-foreground/85">
                      {plan.includedFeatures.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>

                    {plan.tier === 'free' ? (
                      <Link to="/auth" className="block">
                        <Button className="w-full gap-2">
                          {plan.ctaLabel}
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        onClick={() => void handleCouplePlanCheckout(plan.tier)}
                        className="w-full gap-2"
                        disabled={isLoading}
                      >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {user ? plan.ctaLabel : 'Sign in to continue'}
                        {!isLoading && <ArrowRight className="h-4 w-4" />}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="mb-12">
          <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-3xl">Couple feature comparison</CardTitle>
              <CardDescription className="text-base leading-7">
                Free helps you plan. Basic helps you plan together. Premium helps you run the whole wedding in one place.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="hidden grid-cols-[1fr_110px_110px_110px] gap-2 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground md:grid">
                <span>Feature</span>
                <span className="text-center">Free</span>
                <span className="text-center">Basic</span>
                <span className="text-center">Premium</span>
              </div>
              {coupleFeatureMatrix.map((row) => (
                <div
                  key={row.feature}
                  className="grid gap-2 rounded-xl border border-border/50 bg-background/60 px-4 py-3 md:grid-cols-[1fr_110px_110px_110px] md:items-center"
                >
                  <p className="text-sm font-medium text-foreground">{row.feature}</p>
                  <p className="text-sm text-muted-foreground md:text-center">{row.free}</p>
                  <p className="text-sm text-muted-foreground md:text-center">{row.basic}</p>
                  <p className="text-sm font-medium text-primary md:text-center">{row.premium}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="mb-12">
          <div className="mb-6 max-w-3xl">
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary">
              Committee-led weddings
            </Badge>
            <h2 className="mt-4 font-display text-4xl font-semibold">Committee access stays bundled under the wedding</h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              Committee participation is unlocked by the couple&apos;s wedding plan. That keeps the wedding as the billable workspace and treats committee seats as collaboration capacity, not standalone subscriptions.
            </p>
          </div>

          {audiencePlans.filter((plan) => plan.audience === 'committee').map((plan) => {
            const availableCadences = getAvailableCheckoutCadences(plan);
            const isHighlighted = plan.audience === targetAudience;
            const cadence = selectedCadence[plan.audience];
            const isLoading = checkoutTarget === `audience-${plan.audience}`;

            return (
              <Card
                key={plan.audience}
                className={`rounded-[28px] border bg-card/95 shadow-card transition-all ${
                  isHighlighted ? 'border-primary/40 ring-2 ring-primary/15' : 'border-border/60'
                }`}
              >
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="font-display text-3xl">{plan.title}</CardTitle>
                    <div className="flex items-center gap-2">
                      {isHighlighted && <Badge className="rounded-full px-3 py-1">Recommended</Badge>}
                      <Badge variant="secondary" className="rounded-full px-3 py-1">
                        {plan.pricingModel}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="text-base leading-7">{plan.subtitle}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">{plan.freeTierName}</p>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-muted-foreground">
                      {plan.freeIncludes.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">{plan.paidTierName}</p>
                      {availableCadences.length > 1 && (
                        <div className="inline-flex rounded-full border border-border bg-background p-1">
                          {availableCadences.map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setSelectedCadence((prev) => ({ ...prev, [plan.audience]: option }))}
                              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                cadence === option ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {cadenceLabels[option]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-foreground/85">
                      {plan.paidUnlocks.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Sparkles className="mt-1 h-4 w-4 shrink-0 text-primary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    onClick={() => void handleCheckout(plan.audience)}
                    className="w-full gap-2"
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {user ? `Continue with ${plan.paidTierName}` : `Sign in to get ${plan.paidTierName}`}
                    {!isLoading && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mb-12">
          <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-3xl">Couple add-ons</CardTitle>
              <CardDescription className="text-base leading-7">
                Extend your wedding workspace when you need more guest coordination or gift commerce.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-2">
              {coupleAddonDefinitions.map((addon) => (
                <div key={addon.code} className="rounded-2xl border border-border/60 bg-background/60 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-2xl font-semibold">{addon.title}</h3>
                    <Badge variant="secondary" className="rounded-full px-3 py-1">Add-on</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{addon.supportCopy}</p>
                  <Button
                    variant="outline"
                    className="mt-5 w-full gap-2"
                    onClick={() => void handleCoupleAddonCheckout(addon.code)}
                    disabled={checkoutTarget === `addon-${addon.code}`}
                  >
                    {checkoutTarget === `addon-${addon.code}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {user ? 'Add to this wedding' : 'Sign in to continue'}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="mb-12">
          <div className="mb-6 max-w-3xl">
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary">
              Planner & vendor plans
            </Badge>
            <h2 className="mt-4 font-display text-4xl font-semibold">Get discovered free. Upgrade when operations matter.</h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              Planners and vendors start with verified visibility, then upgrade into bookings, invoices, contracts, and public trust tools when Zania becomes part of how they run the business.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            {(['planner', 'vendor'] as const).map((audience) => {
              const freePlan = getProfessionalPlanDefinition(audience, 'free');
              const premiumPlan = getProfessionalPlanDefinition(audience, 'premium');
              const isHighlighted = audience === targetAudience;
              const isLoading = checkoutTarget === `audience-${audience}`;
              const cadence = selectedProfessionalCadence[audience];
              const priceLabel =
                cadence === 'monthly'
                  ? `${formatKesPrice(premiumPlan.monthlyPriceKes)} / month`
                  : `${formatKesPrice(premiumPlan.annualPriceKes)} / year`;

              return (
                <Card
                  key={audience}
                  className={`rounded-[28px] border bg-card/95 shadow-card transition-all ${
                    isHighlighted ? 'border-primary/40 ring-2 ring-primary/15' : 'border-border/60'
                  }`}
                >
                  <CardHeader className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="font-display text-3xl">{roleLabels[audience]}s</CardTitle>
                        <CardDescription className="mt-2 text-base leading-7">
                          {getAudiencePlan(audience).subtitle}
                        </CardDescription>
                      </div>
                      {isHighlighted && <Badge className="rounded-full px-3 py-1">Recommended</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">{freePlan.title}</p>
                        <p className="mt-2 font-display text-2xl font-semibold">Free</p>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">{freePlan.supportCopy}</p>
                        <ul className="mt-4 space-y-2 text-sm leading-7 text-muted-foreground">
                          {freePlan.includedFeatures.map((item) => (
                            <li key={item} className="flex items-start gap-2">
                              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">{premiumPlan.title}</p>
                          <div className="inline-flex rounded-full border border-border bg-background p-1">
                            {(['annual', 'monthly'] as const).map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setSelectedProfessionalCadence((prev) => ({ ...prev, [audience]: option }))}
                                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                  cadence === option ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {coupleCadenceLabels[option]}
                              </button>
                            ))}
                          </div>
                        </div>
                        <p className="mt-2 font-display text-2xl font-semibold">{priceLabel}</p>
                        <p className="mt-2 text-sm leading-7 text-foreground/80">{premiumPlan.supportCopy}</p>
                        <ul className="mt-4 space-y-2 text-sm leading-7 text-foreground/85">
                          {premiumPlan.includedFeatures.map((item) => (
                            <li key={item} className="flex items-start gap-2">
                              <Sparkles className="mt-1 h-4 w-4 shrink-0 text-primary" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Upgrade triggers</p>
                      <ul className="mt-3 space-y-2 text-sm leading-7 text-muted-foreground">
                        {getAudiencePlan(audience).upgradeMoments.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <Lock className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Button
                      onClick={() => void handleProfessionalPlanCheckout(audience)}
                      className="w-full gap-2"
                      disabled={isLoading}
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {user ? premiumPlan.ctaLabel : 'Sign in to continue'}
                      {!isLoading && <ArrowRight className="h-4 w-4" />}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="mb-12">
          <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-card">
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle className="font-display text-3xl">Professional add-ons</CardTitle>
                  <CardDescription className="text-base leading-7">
                    Grow your business with richer portfolio media, promoted visibility, and bundled team collaboration seats.
                  </CardDescription>
                </div>
                <div className="inline-flex rounded-full border border-border/60 bg-background/70 p-1">
                  {(['planner', 'vendor'] as const).map((audience) => (
                    <button
                      key={audience}
                      type="button"
                      onClick={() => setSelectedProfessionalAddonAudience(audience)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        selectedProfessionalAddonAudience === audience
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {audience === 'planner' ? 'Planner add-ons' : 'Vendor add-ons'}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-3">
              {professionalAddonDefinitions.map((addon) => (
                <div key={addon.code} className="rounded-2xl border border-border/60 bg-background/60 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-2xl font-semibold">{addon.title}</h3>
                    <Badge variant="secondary" className="rounded-full px-3 py-1">Add-on</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{addon.supportCopy}</p>
                  {addon.seatLimit ? (
                    <p className="mt-3 text-sm font-medium text-primary">{addon.seatLimit} bundled seats</p>
                  ) : null}
                  <Button
                    variant="outline"
                    className="mt-5 w-full"
                    disabled={checkoutTarget === `professional-addon-${selectedProfessionalAddonAudience}-${addon.code}`}
                    onClick={() => void handleProfessionalAddonCheckout(selectedProfessionalAddonAudience, addon.code)}
                  >
                    {checkoutTarget === `professional-addon-${selectedProfessionalAddonAudience}-${addon.code}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {user ? `Add to ${selectedProfessionalAddonAudience === 'planner' ? 'planner' : 'vendor'} workspace` : 'Sign in to continue'}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="mb-12">
          <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-3xl">Professional feature comparison</CardTitle>
              <CardDescription className="text-base leading-7">
                Free gets planners and vendors discovered. Premium unlocks the business tools that turn discovery into real work.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="hidden grid-cols-[1fr_140px_140px] gap-2 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground md:grid">
                <span>Feature</span>
                <span className="text-center">Free</span>
                <span className="text-center">Premium</span>
              </div>
              {professionalFeatureMatrix.map((row) => (
                <div
                  key={row.feature}
                  className="grid gap-2 rounded-xl border border-border/50 bg-background/60 px-4 py-3 md:grid-cols-[1fr_140px_140px] md:items-center"
                >
                  <p className="text-sm font-medium text-foreground">{row.feature}</p>
                  <p className="text-sm text-muted-foreground md:text-center">{row.free}</p>
                  <p className="text-sm font-medium text-primary md:text-center">{row.premium}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8 lg:pb-18">
        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-3xl">Feature gate map</CardTitle>
            <CardDescription className="text-base leading-7">
              The exact product rule is simple: discovery stays open, coordination and operational scale become paid.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(['couple', 'committee', 'planner', 'vendor'] as const).map((role) => {
              if (role === 'couple') return null;
              const rows = featureGateRows.filter((row) => row.role === role);
              return (
                <div key={role} className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-display text-2xl font-semibold">{roleLabels[role]}</h3>
                    <div className="hidden grid-cols-[100px_100px] gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:grid">
                      <span>Free</span>
                      <span>Paid</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {rows.map((row) => (
                      <div key={`${role}-${row.feature}`} className="grid gap-2 rounded-xl border border-border/50 bg-card px-4 py-3 sm:grid-cols-[1fr_100px_100px] sm:items-center">
                        <p className="text-sm font-medium text-foreground">{row.feature}</p>
                        <p className="text-sm text-muted-foreground sm:text-center">{row.free}</p>
                        <p className="text-sm font-medium text-primary sm:text-center">{row.paid}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-18 sm:px-6 lg:px-8">
        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-3xl">Subscription and access control rollout</CardTitle>
            <CardDescription className="text-base leading-7">
              Build the commercial layer in a way that keeps discovery generous and enforcement predictable.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {accessControlImplementationSteps.map((step, index) => (
              <div key={step} className="rounded-2xl border border-border/60 bg-background/60 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Step {index + 1}</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{step}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
