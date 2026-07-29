import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
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

const coupleTierUpgradeCopy: Record<CouplePlanTier, string> = {
  free: 'Explore Zania and use the complete couple planning workspace without paying.',
  collaborative: 'Upgrade when you are ready to work directly with your vendors and planner in Zania.',
};

const professionalPlanCopy: Record<ProfessionalAudience, {
  sectionTitle: string;
  sectionDescription: string;
  freeSummary: string;
  premiumSummary: string;
  premiumValue: string;
}> = {
  planner: {
    sectionTitle: 'For planners turning coordination into a repeatable system',
    sectionDescription: 'Join free, prove the workflow, then upgrade when Zania becomes part of how your business runs.',
    freeSummary: 'A clean entry into the Zania workflow for testing one live client workspace.',
    premiumSummary: 'For planners who want reusable systems, stronger reporting, and smoother client operations.',
    premiumValue: 'Run multiple weddings with more rhythm, tighter client delivery, and less manual follow-up.',
  },
  vendor: {
    sectionTitle: 'For vendors who want to be discovered and booked professionally',
    sectionDescription: 'Start with a free verified presence, then upgrade when Zania becomes part of how your wider business runs.',
    freeSummary: 'A strong first step for getting visible inside Zania without friction.',
    premiumSummary: 'For vendors who want better operations across inquiries, bookings, documents, and delivery.',
    premiumValue: 'This is where Zania becomes your booking, quoting, invoicing, and contract workspace, not just your listing.',
  },
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

  const professionalUsePrompt = useMemo(() => {
    if (!profile) return null;

    const looksProfessional =
      profile.account_purpose === 'professional_planner'
      || profile.professional_use_risk_level === 'medium'
      || profile.professional_use_risk_level === 'high';

    if (!looksProfessional) return null;

    return {
      title: 'A professional workflow may fit better here',
      body: 'It looks like you may be helping manage weddings professionally. Zania Collaborative gives you proper access, roles, and tools for working with couples.',
      badge: profile.professional_use_risk_level === 'high' ? 'Professional signal' : 'Workflow fit',
    };
  }, [profile]);

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

  const compactComparisonRows = [
    {
      feature: 'Core planning workspace',
      coupleFree: 'All current couple planning tools',
      coupleCollaborative: 'Everything in Intimate',
      professionalFree: 'Directory listing and profile',
      professionalPremium: 'Operational workspace tools',
    },
    {
      feature: 'Shared collaboration',
      coupleFree: 'Not included',
      coupleCollaborative: 'Planner and vendor collaboration',
      professionalFree: 'Join couple-funded workspaces',
      professionalPremium: 'Manage client work in one place',
    },
    {
      feature: 'AI support',
      coupleFree: 'Included',
      coupleCollaborative: 'Included',
      professionalFree: 'Not included',
      professionalPremium: 'Included',
    },
    {
      feature: 'Vendor and planner coordination',
      coupleFree: 'Discovery and private records',
      coupleCollaborative: 'Shared workspace collaboration',
      professionalFree: 'Invitations and inquiries',
      professionalPremium: 'Bookings and follow-through',
    },
    {
      feature: 'Bookings, invoices, contracts',
      coupleFree: 'Not included',
      coupleCollaborative: 'Not included',
      professionalFree: 'Not included',
      professionalPremium: 'Included',
    },
    {
      feature: 'Public trust and growth',
      coupleFree: 'Not included',
      coupleCollaborative: 'Not included',
      professionalFree: 'Verified listing eligibility',
      professionalPremium: 'Advanced portfolio and analytics',
    },
  ];

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
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="rounded-full px-3 py-1">{targetPlan.paidTierName}</Badge>
                {highlightedFeature ? <Badge variant="outline" className="rounded-full px-3 py-1">For {highlightedFeature}</Badge> : null}
              </div>
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

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fcf8f3_0%,#fffdfa_24%,#ffffff_100%)] text-foreground">
      <nav className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center">
            <BrandWordmark size="md" />
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <Link to="/vendors-directory" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Vendors</Link>
            <Link to="/planners" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Planners</Link>
            <Link to="/pricing" className="text-sm font-medium text-foreground">Pricing</Link>
            <Link to="/sign-in" className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
              Sign In
            </Link>
          </div>
          <Link to="/sign-in" className="inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 md:hidden">
            Sign In
          </Link>
        </div>
      </nav>

      {focusedUpgradeContent ? (
        focusedUpgradeContent
      ) : (
        <>
          <section className="mx-auto max-w-[1500px] px-6 py-16 sm:px-8 lg:py-24 xl:px-12">
            <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-14">
              <div className="max-w-[46rem]">
                <Badge variant="info" className="rounded-full px-3 py-1">
                  Free to start
                </Badge>
                <h1 className="marketing-h1 mt-8 max-w-[12ch] text-foreground">
                  Plan freely. Upgrade when you are ready to collaborate.
                </h1>
                <p className="mt-8 max-w-[36rem] text-base leading-8 text-muted-foreground sm:text-[17px]">
                  Zania gives couples, planners, and vendors one elegant workspace for weddings in Kenya and beyond.
                  Couples can use the planning workspace for free, then move to Collaborative when vendors or a planner need to join them.
                </p>
                <p className="mt-5 max-w-[30rem] text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  No clutter. No forced upgrade on day one. Just a better way to run weddings.
                </p>
                <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                  <Link to={authSignupHref}>
                    <Button className="w-full gap-2 sm:w-auto">
                      Start free
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/sign-in">
                    <Button variant="outline" className="w-full sm:w-auto">
                      Sign in
                    </Button>
                  </Link>
                </div>
                <div className="mt-10 flex flex-wrap gap-3">
                  <Link to="/pricing?audience=couple">
                    <Button variant="outline" className="rounded-full">Couples</Button>
                  </Link>
                  <Link to="/pricing?audience=planner">
                    <Button variant="outline" className="rounded-full">Planners</Button>
                  </Link>
                  <Link to="/pricing?audience=vendor">
                    <Button variant="outline" className="rounded-full">Vendors</Button>
                  </Link>
                </div>
              </div>

              <Card className="rounded-[30px] border-border/60 bg-card/95 shadow-card">
                <CardHeader className="px-7 pb-4 pt-7 sm:px-8 sm:pt-8">
                  <div>
                    <CardTitle className="marketing-h3">How Zania grows with you</CardTitle>
                    <CardDescription className="mt-3 max-w-[30rem] text-sm leading-7 text-muted-foreground sm:text-base">
                      You do not pay to explore or plan your wedding. Couples pay when planning becomes collaborative.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 px-7 pb-7 sm:px-8 sm:pb-8">
                  <div className="rounded-[24px] border border-border/60 bg-background/70 p-5 sm:p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Couples</p>
                    <p className="mt-3 max-w-[26rem] text-sm leading-7 text-muted-foreground">
                      Intimate includes the current planning workspace. Collaborative unlocks direct work with vendors and a planner.
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-border/60 bg-background/70 p-5 sm:p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Planners</p>
                    <p className="mt-3 max-w-[26rem] text-sm leading-7 text-muted-foreground">
                      Free includes discovery and couple-funded collaboration. Professional unlocks multi-wedding operations and reusable systems.
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-primary/20 bg-primary/5 p-5 sm:p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Vendors</p>
                    <p className="mt-3 max-w-[26rem] text-sm leading-7 text-muted-foreground">
                      Free includes discovery and couple-funded collaboration. Professional unlocks quoting, contracts, invoices, receipts, and analytics.
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
                    <h2 className="marketing-h3 mt-2">{contextMessage.title}</h2>
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

          {professionalUsePrompt && (
            <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
              <Card className="rounded-[28px] border border-primary/20 bg-primary/5">
                <CardContent className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">{professionalUsePrompt.badge}</p>
                    <h2 className="marketing-h3 mt-2">{professionalUsePrompt.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{professionalUsePrompt.body}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link to="/pricing?audience=planner">
                      <Button className="rounded-full">View Collaborative plan</Button>
                    </Link>
                    <Link to="/planner-directory">
                      <Button variant="outline" className="rounded-full">Apply for planner access</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          <section className="mx-auto max-w-[1500px] px-6 pb-16 sm:px-8 lg:pb-22 xl:px-12">
            <div className="mb-8 max-w-[38rem]">
              <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary">
                Couples
              </Badge>
              <h2 className="marketing-h2 mt-4">For couples who want one calm place to run the whole wedding</h2>
              <p className="mt-4 text-base leading-8 text-muted-foreground">
                Use Zania freely while planning as a couple. Upgrade only when you want vendors or a planner inside your workspace.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {couplePlanDefinitions.map((plan) => {
                const isPaidTier = plan.tier !== 'free';
                const isLoading = checkoutTarget === `couple-${plan.tier}`;
                const cadence = isPaidTier ? selectedCoupleCadence[plan.tier] : null;
                const priceLabel = !isPaidTier
                  ? 'Free'
                  : cadence === 'monthly'
                    ? `${formatKesPrice(plan.monthlyPriceKes)} / month`
                    : `${formatKesPrice(plan.annualPriceKes)} / year`;

                return (
                  <Card
                    key={plan.tier}
                    className={`h-full rounded-[30px] border bg-card/95 shadow-card ${
                      plan.tier === 'collaborative' ? 'border-primary/30 ring-2 ring-primary/10' : 'border-border/60'
                    }`}
                  >
                    <CardHeader className="space-y-5 px-6 pb-4 pt-6 sm:px-7 sm:pt-7">
                      <div className="flex items-start justify-between gap-3">
                        <div className="max-w-[18rem]">
                          <CardTitle className="marketing-h3">{plan.title}</CardTitle>
                          <CardDescription className="mt-2 text-base leading-7">{plan.tagline}</CardDescription>
                        </div>
                        {plan.tier === 'collaborative' ? (
                          <Badge className="rounded-full px-3 py-1">Collaborate together</Badge>
                        ) : null}
                      </div>
                      <div>
                        <p className="marketing-h3">{priceLabel}</p>
                        <p className="mt-3 text-sm leading-7 text-muted-foreground">{plan.supportCopy}</p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6 px-6 pb-6 sm:px-7 sm:pb-7">
                      {isPaidTier ? (
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
                      ) : null}

                      <ul className="space-y-3 text-sm leading-7 text-foreground/85">
                        {plan.includedFeatures.slice(0, 5).map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="border-t border-border/60 pt-5 text-sm leading-7 text-muted-foreground">
                        {coupleTierUpgradeCopy[plan.tier]}
                      </p>

                      {plan.tier === 'free' ? (
                        <Link to={authSignupHref} className="block">
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

            <p className="mt-6 max-w-[42rem] text-sm leading-7 text-muted-foreground">
              There are no couple-facing add-ons. Existing planning tools stay included, and collaboration is the only upgrade decision.
            </p>
          </section>

          <section className="mx-auto max-w-[1500px] px-6 pb-16 sm:px-8 lg:pb-22 xl:px-12">
            <div className="mb-8 max-w-[38rem]">
              <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary">
                Professional plans
              </Badge>
              <h2 className="marketing-h2 mt-4">For planners and vendors building real wedding businesses</h2>
              <p className="mt-4 text-base leading-8 text-muted-foreground">
                Both roles begin free and can join a paying couple's workspace. Upgrade only when Zania becomes part of how you run your wider business.
              </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              {(['planner', 'vendor'] as const).map((audience) => {
                const freePlan = getProfessionalPlanDefinitionWithContent(audience, 'free');
                const premiumPlan = getProfessionalPlanDefinitionWithContent(audience, 'premium');
                const isLoading = checkoutTarget === `audience-${audience}`;
                const cadence = selectedProfessionalCadence[audience];
                const priceLabel =
                  cadence === 'monthly'
                    ? `${formatKesPrice(premiumPlan.monthlyPriceKes)} / month`
                    : `${formatKesPrice(premiumPlan.annualPriceKes)} / year`;

                return (
                  <Card key={audience} className="rounded-[30px] border border-border/60 bg-card/95 shadow-card">
                    <CardHeader className="space-y-4 px-6 pb-4 pt-6 sm:px-7 sm:pt-7">
                      <div>
                        <CardTitle className="marketing-h3">{roleLabels[audience]}s</CardTitle>
                        <CardDescription className="mt-2 text-base leading-7">
                          {professionalPlanCopy[audience].sectionDescription}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5 px-6 pb-6 sm:px-7 sm:pb-7">
                      <div className="rounded-[24px] border border-border/60 bg-background/60 p-5">
                        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">{freePlan.title}</p>
                        <p className="marketing-h3 mt-2">Free</p>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">{professionalPlanCopy[audience].freeSummary}</p>
                        <ul className="mt-4 space-y-2 text-sm leading-7 text-muted-foreground">
                          {freePlan.includedFeatures.map((item) => (
                            <li key={item} className="flex items-start gap-2">
                              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-[24px] border border-primary/20 bg-primary/5 p-5">
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
                        <p className="marketing-h3 mt-2">{priceLabel}</p>
                        <p className="mt-2 text-sm leading-7 text-foreground/80">{professionalPlanCopy[audience].premiumSummary}</p>
                        <ul className="mt-4 space-y-2 text-sm leading-7 text-foreground/85">
                          {premiumPlan.includedFeatures.slice(0, 5).map((item) => (
                            <li key={item} className="flex items-start gap-2">
                              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-4 text-sm leading-7 text-muted-foreground">{professionalPlanCopy[audience].premiumValue}</p>
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
          </section>

          <section className="mx-auto max-w-[1500px] px-6 pb-16 sm:px-8 lg:pb-22 xl:px-12">
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <Card className="rounded-[30px] border-border/60 bg-card/95 shadow-card">
                <CardHeader className="px-6 pb-4 pt-6 sm:px-7 sm:pt-7">
                  <CardTitle className="marketing-h3">Professional operations</CardTitle>
                  <CardDescription className="text-base leading-7">
                    This is the layer that turns Zania from a listing into a working revenue system for vendors.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-6 pb-6 text-sm leading-7 text-muted-foreground sm:px-7 sm:pb-7">
                  <p className="max-w-[28rem]">Use Zania to move from inquiry to booking without leaving the workspace.</p>
                  <ul className="space-y-3 text-foreground/85">
                    {[
                      'Turn inquiries into quotes',
                      'Generate contracts, invoices, and receipts',
                      'Track deposits, balances, and payment status',
                      'Save reusable document templates',
                      'Keep client records and wedding deliverables together',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="rounded-[30px] border-primary/20 bg-primary/5 shadow-card">
                <CardHeader className="px-6 pb-4 pt-6 sm:px-7 sm:pt-7">
                  <CardTitle className="marketing-h3">Professional roadmap</CardTitle>
                  <CardDescription className="text-base leading-7">
                    New business capabilities will arrive inside Professional without creating a maze of optional add-ons.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-6 pb-6 text-sm leading-7 text-foreground/85 sm:px-7 sm:pb-7">
                  <ul className="space-y-3">
                    {[
                      'Advanced portfolio presentation',
                      'Business performance analytics',
                      'Team workspace tools (coming soon)',
                      'New professional workflow features as they are released',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="pt-2 text-sm font-medium uppercase tracking-[0.16em] text-primary">
                    Verification and public ratings remain available on Free. Trust cannot be bought.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="mx-auto max-w-[1500px] px-6 pb-16 sm:px-8 lg:pb-22 xl:px-12">
            <Card className="rounded-[30px] border-border/60 bg-card/95 shadow-card">
              <CardHeader className="px-6 pb-4 pt-6 sm:px-7 sm:pt-7">
                <CardTitle className="marketing-h3">Compare the paths</CardTitle>
                <CardDescription className="text-base leading-7">
                  The difference is simple: couples pay for collaboration, while planners and vendors pay when Zania runs their wider business operations.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6 sm:px-7 sm:pb-7">
                <div className="overflow-x-auto">
                  <div className="min-w-[760px]">
                    <div className="grid grid-cols-[1.4fr_repeat(4,minmax(120px,1fr))] gap-2 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      <span>Feature</span>
                      <span className="text-center">Couple Intimate</span>
                      <span className="text-center">Couple Collaborative</span>
                      <span className="text-center">Pro Free</span>
                      <span className="text-center">Professional</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {compactComparisonRows.map((row) => (
                        <div
                          key={row.feature}
                          className="grid grid-cols-[1.4fr_repeat(4,minmax(120px,1fr))] gap-2 rounded-2xl border border-border/50 bg-background/60 px-4 py-4"
                        >
                          <p className="text-sm font-medium text-foreground">{row.feature}</p>
                          <p className="text-center text-sm text-muted-foreground">{row.coupleFree}</p>
                          <p className="text-center text-sm font-medium text-primary">{row.coupleCollaborative}</p>
                          <p className="text-center text-sm text-muted-foreground">{row.professionalFree}</p>
                          <p className="text-center text-sm font-medium text-primary">{row.professionalPremium}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="mx-auto max-w-[1500px] px-6 pb-16 sm:px-8 lg:pb-22 xl:px-12">
            <Card className="rounded-[30px] border-border/60 bg-card/95 shadow-card">
              <CardHeader className="px-6 pb-4 pt-6 sm:px-7 sm:pt-7">
                <CardTitle className="marketing-h3">AI that works inside the workflow</CardTitle>
                <CardDescription className="text-base leading-7">
                  Zania AI is not just a chatbot. It helps couples plan smarter, planners move faster, and vendors respond more professionally.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 px-6 pb-6 sm:px-7 sm:pb-7 lg:grid-cols-3">
                {[
                  {
                    title: 'For couples',
                    items: ['Weekly planning focus', 'Budget and timeline guidance', 'Smarter vendor suggestions'],
                  },
                  {
                    title: 'For planners',
                    items: ['Operational summaries', 'Decision support', 'Workflow acceleration'],
                  },
                  {
                    title: 'For vendors',
                    items: ['Quote and contract drafting help', 'Follow-up support', 'Faster response workflows'],
                  },
                ].map((group) => (
                  <div key={group.title} className="rounded-[24px] border border-border/60 bg-background/60 p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">{group.title}</p>
                    <ul className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
                      {group.items.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <section className="mx-auto max-w-[1500px] px-6 pb-16 sm:px-8 lg:pb-22 xl:px-12">
            <div className="mb-8 max-w-[38rem]">
              <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary">
                FAQ
              </Badge>
              <h2 className="marketing-h2 mt-4">A few practical questions</h2>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              {[
                {
                  question: 'Why is Zania free to start?',
                  answer: 'Because wedding planning is already expensive, and the core workspace should be accessible before any upgrade decision.',
                },
                {
                  question: 'What usually triggers a couple upgrade?',
                  answer: 'Inviting vendors or a planner to work directly inside the couple\'s wedding workspace.',
                },
                {
                  question: 'Why would a planner upgrade?',
                  answer: 'To manage multiple weddings, reuse systems, access analytics, and run their wider client operation from Zania.',
                },
                {
                  question: 'Why would a vendor upgrade?',
                  answer: 'To handle quotes, contracts, invoices, receipts, bookings, and business analytics from one place.',
                },
              ].map((item) => (
                <Card key={item.question} className="rounded-[26px] border border-border/60 bg-card/95 shadow-card">
                  <CardContent className="px-6 py-6 sm:px-7">
                    <h3 className="marketing-h3">{item.question}</h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.answer}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-[1500px] px-6 pb-20 sm:px-8 xl:px-12">
            <Card className="rounded-[30px] border border-primary/20 bg-primary/5 shadow-card">
              <CardContent className="flex flex-col gap-6 px-6 py-8 sm:px-8 sm:py-10 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-[40rem]">
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Ready to start?</p>
                  <h2 className="marketing-h3 mt-2">Choose the path that fits your role. Start free and grow from there.</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                    One elegant wedding workspace. Free to begin. Built to scale with real weddings, real businesses, and real coordination pressure.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link to={authSignupHref}>
                    <Button className="w-full gap-2 sm:w-auto">
                      Create account
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/">
                    <Button variant="outline" className="w-full sm:w-auto">
                      Back to home
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      )}
      <PublicSiteFooter />
    </div>
  );
}
