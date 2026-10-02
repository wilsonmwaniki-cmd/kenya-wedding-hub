import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EditorialEyebrow } from '@/components/ui/editorial-eyebrow';
import {
  StatusLine,
  TonalCard,
  TonalCardBody,
  TonalCardDescription,
  TonalCardFooter,
  TonalCardHeader,
  TonalCardTitle,
  TonalSection,
} from '@/components/ui/tonal-card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useWeddingEntitlements } from '@/hooks/useWeddingEntitlements';
import { supabase } from '@/integrations/supabase/client';
import {
  formatEntitlementFeatureLabel,
  getAudiencePlan,
  getAvailableCheckoutCadences,
  getDisplayPriceForCadence,
  getLookupKeyForCadence,
  type CouplePlanTier,
  type CouplePlanCadence,
  type ProfessionalAudience,
  type ProfessionalPlanCadence,
  type PricingAudience,
  type PricingCheckoutCadence,
} from '@/lib/pricingPlans';
import {
  getAudiencePlanDefinition,
  getCouplePlanDefinitionWithContent,
  getProfessionalPlanDefinitionWithContent,
  listCouplePlanDefinitions,
} from '@/lib/pricingContent';
import { getCheckoutProviderFromSearchParams, getCheckoutReferenceFromSearchParams, startCheckout, syncProfessionalCheckout, withCheckoutSessionId } from '@/lib/billing';
import BrandWordmark from '@/components/BrandWordmark';
import PublicSiteFooter from '@/components/PublicSiteFooter';

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
  const { user } = useAuth();
  const { weddingId } = useWeddingEntitlements();
  const requestedAudience = searchParams.get('audience');
  const requestedPlanCode = searchParams.get('plan');
  const requestedFeature = searchParams.get('feature');
  const successPath = searchParams.get('successPath');
  const cancelPath = searchParams.get('cancelPath');
  const upgradeState = searchParams.get('upgrade');
  const professionalAudienceParam = searchParams.get('professionalAudience');
  const professionalPlanParam = searchParams.get('professionalPlan');
  const checkoutReference = getCheckoutReferenceFromSearchParams(searchParams);
  const checkoutProvider = getCheckoutProviderFromSearchParams(searchParams);
  const [checkoutTarget, setCheckoutTarget] = useState<string | null>(null);
  const [processedProfessionalCheckout, setProcessedProfessionalCheckout] = useState<string | null>(null);
  const [selectedCadence, setSelectedCadence] = useState<Record<PricingAudience, PricingCheckoutCadence>>({
    couple: 'one_time',
    committee: 'one_time',
    planner: 'monthly',
    vendor: 'monthly',
  });
  const [selectedCoupleCadence, setSelectedCoupleCadence] = useState<Record<'collaborative', CouplePlanCadence>>({
    collaborative: 'annual',
  });
  const [selectedProfessionalCadence, setSelectedProfessionalCadence] = useState<Record<ProfessionalAudience, ProfessionalPlanCadence>>({
    planner: 'annual',
    vendor: 'annual',
  });
  const couplePlanDefinitions = listCouplePlanDefinitions();

  const targetAudience = isPricingAudience(requestedAudience) ? requestedAudience : null;
  const targetPlan = targetAudience ? getAudiencePlanDefinition(targetAudience) : null;
  const highlightedFeature = formatEntitlementFeatureLabel(requestedFeature);
  const focusedCoupleTier =
    requestedPlanCode === 'couple_collaborative'
      || requestedPlanCode === 'couple_basic'
      || requestedPlanCode === 'couple_premium' ? 'collaborative'
        : null;
  const inferredCoupleTier =
    requestedFeature === 'couple.connect_vendors' || requestedFeature === 'couple.connect_planners'
      ? 'collaborative'
      : null;
  const resolvedCoupleTier = focusedCoupleTier ?? inferredCoupleTier;
  const isFocusedUpgradeView =
    Boolean(targetAudience)
    && Boolean(requestedPlanCode || requestedFeature)
    && upgradeState !== 'success'
    && upgradeState !== 'cancelled';

  useEffect(() => {
    if (!targetPlan) return;
    const availableCadences = getAvailableCheckoutCadences(targetPlan);
    setSelectedCadence((prev) => ({
      ...prev,
      [targetPlan.audience]: availableCadences[0],
    }));
  }, [targetPlan?.audience]);

  useEffect(() => {
    const professionalAudience =
      professionalAudienceParam === 'planner' || professionalAudienceParam === 'vendor'
        ? professionalAudienceParam
        : null;
    if (
      upgradeState !== 'success'
      || !checkoutReference
      || !professionalAudience
      || professionalPlanParam !== 'premium'
      || processedProfessionalCheckout === checkoutReference
      || !user
    ) {
      return;
    }

    let cancelled = false;
    setProcessedProfessionalCheckout(checkoutReference);

    const syncCheckout = async () => {
      try {
        await syncProfessionalCheckout(checkoutReference, professionalAudience, checkoutProvider);
      } catch (error: any) {
        if (cancelled) return;
        toast({
          title: 'Payment completed but activation is still pending',
          description: error?.message || 'The checkout succeeded, but we could not sync your Professional plan yet.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Professional activated',
        description: `Your ${professionalAudience} Professional workspace is now active.`,
      });
      navigate(professionalAudience === 'planner' ? '/clients?upgrade=success' : '/vendor-dashboard?upgrade=success', { replace: true });
    };

    void syncCheckout();

    return () => {
      cancelled = true;
    };
  }, [
    checkoutProvider,
    checkoutReference,
    navigate,
    processedProfessionalCheckout,
    professionalAudienceParam,
    professionalPlanParam,
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
        description: 'This plan is missing its checkout mapping. Add the lookup key and try again.',
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
      await startCheckout({
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
        description: error?.message || 'There was a problem starting your payment session.',
        variant: 'destructive',
      });
      setCheckoutTarget(null);
    }
  };

  const handleCouplePlanCheckout = async (tier: 'collaborative') => {
    const plan = getCouplePlanDefinitionWithContent(tier);
    if (!plan) return;

    const cadence = selectedCoupleCadence[tier];
    const lookupKey = cadence === 'monthly' ? plan.checkoutMonthlyLookupKey : plan.checkoutAnnualLookupKey;
    if (!lookupKey) {
      toast({
        title: 'Checkout is not configured',
        description: 'This couple plan is missing its checkout mapping. Add the lookup key and try again.',
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
      await startCheckout({
        audience: 'couple',
        feature: 'wedding_collaboration',
        lookupKey,
        cadence,
        weddingId,
        successPath: withCheckoutSessionId('/budget?upgrade=success'),
        cancelPath: '/pricing?upgrade=cancelled',
      });
    } catch (error: any) {
      toast({
        title: 'Could not start checkout',
        description: error?.message || 'There was a problem starting your payment session.',
        variant: 'destructive',
      });
      setCheckoutTarget(null);
    }
  };

  const handleProfessionalPlanCheckout = async (audience: ProfessionalAudience) => {
    const cadence = selectedProfessionalCadence[audience];
    const plan = getAudiencePlan(audience);
    const lookupKey = getLookupKeyForCadence(plan, cadence);
    if (!lookupKey) return;

    if (!user) {
      navigate('/auth?mode=signup');
      toast({
        title: 'Sign in to continue',
        description: 'We need your account before we can attach Professional access to your workspace.',
      });
      return;
    }

    setCheckoutTarget(`audience-${audience}`);
    try {
      await startCheckout({
        audience,
        feature: 'booking_management',
        lookupKey,
        cadence,
        successPath: `/pricing?upgrade=success&professionalAudience=${audience}&professionalPlan=premium`,
        cancelPath: `/pricing?upgrade=cancelled&audience=${audience}`,
      });
    } catch (error: any) {
      toast({
        title: 'Could not start checkout',
        description: error?.message || 'There was a problem starting your Professional payment session.',
        variant: 'destructive',
      });
      setCheckoutTarget(null);
    }
  };

  const formatKesPrice = (amount: number | null) => {
    if (amount == null) return 'Free';
    return `KES ${amount.toLocaleString()}`;
  };

  const renderFocusedUpgrade = () => {
    if (!targetAudience) return null;

    if (targetAudience === 'couple' && resolvedCoupleTier) {
      const plan = getCouplePlanDefinitionWithContent(resolvedCoupleTier);
      if (!plan) return null;

      const cadence = selectedCoupleCadence[plan.tier];
      const isLoading = checkoutTarget === `couple-${plan.tier}`;
      const priceLabel =
        cadence === 'monthly'
          ? `${formatKesPrice(plan.monthlyPriceKes)} / month`
          : `${formatKesPrice(plan.annualPriceKes)} / year`;

      return (
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <TonalCard tone="porcelain">
            <TonalCardHeader className="space-y-6">
              <div className="border-l-2 border-primary pl-4">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary">{plan.title}</p>
                {highlightedFeature ? <p className="mt-2 text-sm font-medium text-current/60">For {highlightedFeature}</p> : null}
              </div>
              <div>
                <TonalCardTitle className="marketing-h2">Upgrade to {plan.title}</TonalCardTitle>
                <TonalCardDescription className="mt-3 text-base leading-8">
                  {highlightedFeature
                    ? `${plan.title} unlocks ${highlightedFeature.toLowerCase()} and keeps the rest of your wedding planning in the same workspace.`
                    : plan.supportCopy}
                </TonalCardDescription>
              </div>
            </TonalCardHeader>
            <TonalCardBody className="space-y-6">
              <TonalSection className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="marketing-h3">{priceLabel}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Choose how you want to pay, then continue straight to checkout.</p>
                </div>
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
              </TonalSection>

              <TonalSection>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Included</p>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-foreground/85">
                  {plan.includedFeatures.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </TonalSection>
            </TonalCardBody>
            <TonalCardFooter tone="ink">
              <Button
                onClick={() => void handleCouplePlanCheckout(plan.tier)}
                className="gap-2 border-[#ead8b8] bg-[#ead8b8] text-[#2b211a] shadow-none hover:bg-[#f3e4ca]"
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {user ? `Continue with ${plan.title}` : 'Sign in to continue'}
                {!isLoading && <ArrowRight className="h-4 w-4" />}
              </Button>
              <Button asChild variant="ghost" className="text-[#f8f0e6]/72 hover:bg-white/[0.08] hover:text-[#f8f0e6]">
                <Link to="/pricing?audience=couple">See all wedding pricing</Link>
              </Button>
            </TonalCardFooter>
          </TonalCard>
        </section>
      );
    }

    if (targetAudience === 'planner' || targetAudience === 'vendor') {
      const plan = getProfessionalPlanDefinitionWithContent(targetAudience, 'premium');
      const cadence = selectedProfessionalCadence[targetAudience];
      const isLoading = checkoutTarget === `audience-${targetAudience}`;
      const priceLabel =
        cadence === 'monthly'
          ? `${formatKesPrice(plan.monthlyPriceKes)} / month`
          : `${formatKesPrice(plan.annualPriceKes)} / year`;

      return (
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <TonalCard tone="porcelain">
            <TonalCardHeader className="space-y-6">
              <div className="border-l-2 border-primary pl-4">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary">{plan.title}</p>
                {highlightedFeature ? <p className="mt-2 text-sm font-medium text-current/60">For {highlightedFeature}</p> : null}
              </div>
              <div>
                <TonalCardTitle className="marketing-h2">Upgrade to {plan.title}</TonalCardTitle>
                <TonalCardDescription className="mt-3 text-base leading-8">
                  {highlightedFeature
                    ? `${plan.title} unlocks ${highlightedFeature.toLowerCase()} and the rest of the operational tools for your ${targetAudience} workspace.`
                    : plan.supportCopy}
                </TonalCardDescription>
              </div>
            </TonalCardHeader>
            <TonalCardBody className="space-y-6">
              <TonalSection className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="marketing-h3">{priceLabel}</p>
                  <p className="mt-2 text-sm text-muted-foreground">One focused upgrade, then straight into checkout.</p>
                </div>
                <div className="inline-flex rounded-full border border-border bg-background p-1">
                  {(['annual', 'monthly'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSelectedProfessionalCadence((prev) => ({ ...prev, [targetAudience]: option }))}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        cadence === option ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {coupleCadenceLabels[option]}
                    </button>
                  ))}
                </div>
              </TonalSection>

              <TonalSection>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Included</p>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-foreground/85">
                  {plan.includedFeatures.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </TonalSection>
            </TonalCardBody>
            <TonalCardFooter tone="ink">
              <Button
                onClick={() => void handleProfessionalPlanCheckout(targetAudience)}
                className="gap-2 border-[#ead8b8] bg-[#ead8b8] text-[#2b211a] shadow-none hover:bg-[#f3e4ca]"
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {user ? `Continue with ${plan.title}` : 'Sign in to continue'}
                {!isLoading && <ArrowRight className="h-4 w-4" />}
              </Button>
              <Button asChild variant="ghost" className="text-[#f8f0e6]/72 hover:bg-white/[0.08] hover:text-[#f8f0e6]">
                <Link to={`/pricing?audience=${targetAudience}`}>See all {targetAudience} pricing</Link>
              </Button>
            </TonalCardFooter>
          </TonalCard>
        </section>
      );
    }

    if (targetAudience === 'committee' && targetPlan) {
      const availableCadences = getAvailableCheckoutCadences(targetPlan);
      const cadence = selectedCadence[targetAudience];
      const isLoading = checkoutTarget === `audience-${targetAudience}`;
      const priceLabel = `${formatKesPrice(getDisplayPriceForCadence(targetPlan, cadence))}`;

      return (
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <Card className="rounded-[28px] border-primary/20 bg-card/95 shadow-card">
            <CardHeader className="space-y-4">
              <EditorialEyebrow>{targetPlan.paidTierName}</EditorialEyebrow>
              {highlightedFeature ? (
                <StatusLine label="Unlocks" value={highlightedFeature} tone="info" className="max-w-md" />
              ) : null}
              <div>
                <CardTitle className="marketing-h2">{targetPlan.paidTierName}</CardTitle>
                <CardDescription className="mt-3 max-w-2xl text-base leading-8">
                  {highlightedFeature
                    ? `${targetPlan.paidTierName} unlocks ${highlightedFeature.toLowerCase()} for committee-led weddings.`
                    : targetPlan.subtitle}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 bg-background/60 p-5">
                <div>
                  <p className="marketing-h3">{priceLabel}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Choose the billing cadence and continue to checkout.</p>
                </div>
                {availableCadences.length > 1 && (
                  <div className="inline-flex rounded-full border border-border bg-background p-1">
                    {availableCadences.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setSelectedCadence((prev) => ({ ...prev, [targetAudience]: option }))}
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

              <div className="rounded-2xl border border-border/60 bg-background/60 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Included</p>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-foreground/85">
                  {targetPlan.paidUnlocks.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={() => void handleCheckout(targetAudience)}
                  className="gap-2"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {user ? `Continue with ${targetPlan.paidTierName}` : 'Sign in to continue'}
                  {!isLoading && <ArrowRight className="h-4 w-4" />}
                </Button>
                <Button asChild variant="outline">
                  <Link to="/pricing?audience=committee">See all committee pricing</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      );
    }

    return null;
  };

  const focusedUpgradeContent = isFocusedUpgradeView ? renderFocusedUpgrade() : null;
  const authSignupHref = '/auth?mode=signup';
  const activeAudience: 'couple' | ProfessionalAudience =
    targetAudience === 'planner' || targetAudience === 'vendor' ? targetAudience : 'couple';
  const audienceHeading = activeAudience === 'couple'
    ? 'Plan privately or bring your team in'
    : `Choose how you run your ${activeAudience} business`;
  const audienceDescription = activeAudience === 'couple'
    ? 'Planning stays free. Pay only when a planner or vendor needs to work inside your wedding workspace.'
    : 'Your listing and document tools are free. Pay only when you want them connected to Zania clients and bookings.';

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbf4ec_0%,#fffdfa_48%,#ffffff_100%)] text-foreground">
      <nav className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center"><BrandWordmark size="md" /></Link>
          <div className="hidden items-center gap-8 md:flex">
            <Link to="/vendors-directory" className="text-sm text-muted-foreground hover:text-foreground">Vendors</Link>
            <Link to="/planners" className="text-sm text-muted-foreground hover:text-foreground">Planners</Link>
            <Link to="/pricing" className="text-sm font-medium text-foreground">Pricing</Link>
            <Link to="/sign-in" className="inline-flex h-10 items-center bg-primary px-6 text-sm font-medium text-primary-foreground hover:opacity-90">Sign in</Link>
          </div>
          <Link to="/sign-in" className="inline-flex h-10 items-center bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 md:hidden">Sign in</Link>
        </div>
      </nav>

      {focusedUpgradeContent ? focusedUpgradeContent : (
        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <section className="grid gap-10 border-b border-border/60 pb-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:pb-16">
            <div className="max-w-3xl">
              <EditorialEyebrow tone="info">Simple pricing</EditorialEyebrow>
              <h1 className="marketing-h1 mt-6 max-w-[13ch]">Start free. Pay when you need teamwork.</h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
                Pick who you are. We will show you only the plans that matter.
              </p>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">I am a...</p>
              <div className="grid grid-cols-3 border border-border/70 bg-background" aria-label="Choose your role">
                {(['couple', 'planner', 'vendor'] as const).map((audience) => (
                  <Link
                    key={audience}
                    to={`/pricing?audience=${audience}`}
                    aria-current={activeAudience === audience ? 'page' : undefined}
                    className={`border-r border-border/70 px-3 py-4 text-center text-sm font-semibold transition-colors last:border-r-0 sm:px-5 ${
                      activeAudience === audience ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    }`}
                  >
                    {audience === 'couple' ? 'Couple' : `${roleLabels[audience]}`}
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {contextMessage ? (
            <section className={`mt-8 border-l-2 px-5 py-4 ${
              contextMessage.tone === 'success' ? 'border-emerald-500 bg-emerald-50/70' : 'border-amber-500 bg-amber-50/70'
            }`}>
              <p className="font-semibold">{contextMessage.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{contextMessage.body}</p>
            </section>
          ) : null}

          <section className="py-12 lg:py-16">
            <div className="mb-8 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{activeAudience === 'couple' ? 'For couples' : `For ${activeAudience}s`}</p>
              <h2 className="marketing-h2 mt-3">{audienceHeading}</h2>
              <p className="mt-3 text-base leading-7 text-muted-foreground">{audienceDescription}</p>
            </div>

            {activeAudience === 'couple' ? (
              <div className="grid gap-5 lg:grid-cols-2">
                {couplePlanDefinitions.map((plan) => {
                  const isPaid = plan.tier === 'collaborative';
                  const cadence = isPaid ? selectedCoupleCadence.collaborative : null;
                  const isLoading = checkoutTarget === `couple-${plan.tier}`;
                  const price = !isPaid
                    ? 'Free'
                    : cadence === 'monthly'
                      ? `${formatKesPrice(plan.monthlyPriceKes)} / month`
                      : `${formatKesPrice(plan.annualPriceKes)} / year`;

                  return (
                    <Card key={plan.tier} className={`flex h-full flex-col rounded-[22px] shadow-card ${isPaid ? 'border-primary/35 bg-primary/[0.04]' : 'border-border/60 bg-card/95'}`}>
                      <CardHeader className="px-6 pb-3 pt-6 sm:px-8 sm:pt-8">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{isPaid ? 'Work together' : 'Plan privately'}</p>
                        <CardTitle className="marketing-h3 mt-2">{plan.title}</CardTitle>
                        <p className="mt-3 text-3xl font-semibold tracking-tight">{price}</p>
                        <CardDescription className="mt-3 text-sm leading-7">{plan.tagline}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col px-6 pb-6 sm:px-8 sm:pb-8">
                        {isPaid ? (
                          <div className="mb-5 flex border-b border-border/70" aria-label="Choose billing period">
                            {(['annual', 'monthly'] as const).map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setSelectedCoupleCadence({ collaborative: option })}
                                className={`border-b-2 px-4 py-2 text-sm font-medium ${cadence === option ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}
                              >
                                {coupleCadenceLabels[option]}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <ul className="mb-7 space-y-3 text-sm leading-6">
                          {plan.includedFeatures.slice(0, 4).map((item) => (
                            <li key={item} className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{item}</span></li>
                          ))}
                        </ul>
                        {isPaid ? (
                          <Button onClick={() => void handleCouplePlanCheckout('collaborative')} className="mt-auto w-full gap-2" disabled={isLoading}>
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {user ? 'Choose Collaborative' : 'Sign in to upgrade'}
                            {!isLoading ? <ArrowRight className="h-4 w-4" /> : null}
                          </Button>
                        ) : (
                          <Button asChild className="mt-auto w-full gap-2"><Link to={authSignupHref}>Start free <ArrowRight className="h-4 w-4" /></Link></Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (() => {
              const freePlan = getProfessionalPlanDefinitionWithContent(activeAudience, 'free');
              const premiumPlan = getProfessionalPlanDefinitionWithContent(activeAudience, 'premium');
              const cadence = selectedProfessionalCadence[activeAudience];
              const isLoading = checkoutTarget === `audience-${activeAudience}`;
              const premiumPrice = cadence === 'monthly'
                ? `${formatKesPrice(premiumPlan.monthlyPriceKes)} / month`
                : `${formatKesPrice(premiumPlan.annualPriceKes)} / year`;
              const plans = [freePlan, premiumPlan];

              return (
                <div className="grid gap-5 lg:grid-cols-2">
                  {plans.map((plan) => {
                    const isPaid = plan.tier === 'premium';
                    return (
                      <Card key={plan.tier} className={`flex h-full flex-col rounded-[22px] shadow-card ${isPaid ? 'border-primary/35 bg-primary/[0.04]' : 'border-border/60 bg-card/95'}`}>
                        <CardHeader className="px-6 pb-3 pt-6 sm:px-8 sm:pt-8">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{isPaid ? 'Connected business' : 'Standalone tools'}</p>
                          <CardTitle className="marketing-h3 mt-2">{plan.title}</CardTitle>
                          {isPaid && <p className="mt-3 text-3xl font-semibold tracking-tight">{premiumPrice}</p>}
                          <CardDescription className="mt-3 text-sm leading-7">{plan.tagline}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-1 flex-col px-6 pb-6 sm:px-8 sm:pb-8">
                          {isPaid ? (
                            <div className="mb-5 flex border-b border-border/70" aria-label="Choose billing period">
                              {(['annual', 'monthly'] as const).map((option) => (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() => setSelectedProfessionalCadence((previous) => ({ ...previous, [activeAudience]: option }))}
                                  className={`border-b-2 px-4 py-2 text-sm font-medium ${cadence === option ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}
                                >
                                  {coupleCadenceLabels[option]}
                                </button>
                              ))}
                            </div>
                          ) : null}
                          <ul className="mb-7 space-y-3 text-sm leading-6">
                            {plan.includedFeatures.slice(0, 4).map((item) => (
                              <li key={item} className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{item}</span></li>
                            ))}
                          </ul>
                          {isPaid ? (
                            <Button onClick={() => void handleProfessionalPlanCheckout(activeAudience)} className="mt-auto w-full gap-2" disabled={isLoading}>
                              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              {user ? 'Choose Professional' : 'Sign in to upgrade'}
                              {!isLoading ? <ArrowRight className="h-4 w-4" /> : null}
                            </Button>
                          ) : (
                            <Button asChild className="mt-auto w-full gap-2"><Link to={authSignupHref}>Start free <ArrowRight className="h-4 w-4" /></Link></Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              );
            })()}
          </section>

          <section className="border-y border-border/60 py-8 sm:flex sm:items-center sm:justify-between sm:gap-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">The simple rule</p>
              <p className="mt-2 max-w-2xl text-lg font-semibold">
                {activeAudience === 'couple'
                  ? 'Your planning tools stay free. Collaboration is the upgrade.'
                  : 'Your documents stay free. Connecting them to clients is the upgrade.'}
              </p>
            </div>
            <Button asChild variant="outline" className="mt-5 shrink-0 sm:mt-0"><Link to={authSignupHref}>Create free account</Link></Button>
          </section>
        </main>
      )}
      <PublicSiteFooter />
    </div>
  );
}
