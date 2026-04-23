import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Heart, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useWeddingEntitlements } from '@/hooks/useWeddingEntitlements';
import { supabase } from '@/integrations/supabase/client';
import {
  coupleAddonDefinitions,
  couplePlanDefinitions,
  formatEntitlementFeatureLabel,
  getAudiencePlan,
  getAvailableCheckoutCadences,
  getLookupKeyForCadence,
  getProfessionalAddonDefinition,
  getProfessionalPlanDefinition,
  professionalAddonEntitlementMap,
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
  const requestedPlanCode = searchParams.get('plan');
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
  const focusedCoupleTier =
    requestedPlanCode === 'couple_basic' ? 'basic'
      : requestedPlanCode === 'couple_premium' ? 'premium'
        : null;
  const isFocusedUpgradeView =
    Boolean(targetAudience)
    && Boolean(requestedPlanCode || requestedFeature || professionalAddon)
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
        successPath: code === 'guest_rsvp_management_addon' ? '/guests?upgrade=success' : '/gift-registry?upgrade=success',
        cancelPath:
          code === 'guest_rsvp_management_addon'
            ? '/guests?intent=upgrade&upgrade=cancelled'
            : '/gift-registry?intent=upgrade&upgrade=cancelled',
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

  const compactComparisonRows = [
    {
      feature: 'Core planning workspace',
      coupleFree: 'Tasks, budget, guests, vendor discovery',
      coupleBasic: 'Everything in Free',
      couplePremium: 'Everything in Basic',
      professionalFree: 'Directory listing and profile',
      professionalPremium: 'Operational workspace tools',
    },
    {
      feature: 'Shared collaboration',
      coupleFree: 'Not included',
      coupleBasic: 'Planner, vendor, family, and committee access',
      couplePremium: 'More seats and deeper coordination',
      professionalFree: 'Solo profile only',
      professionalPremium: 'Manage client work in one place',
    },
    {
      feature: 'AI support',
      coupleFree: 'Not included',
      coupleBasic: 'Not included',
      couplePremium: 'AI Wedding Assistant',
      professionalFree: 'Not included',
      professionalPremium: 'Not included',
    },
    {
      feature: 'Vendor and planner coordination',
      coupleFree: 'Vendor management only',
      coupleBasic: 'Included',
      couplePremium: 'Included',
      professionalFree: 'Discovery only',
      professionalPremium: 'Bookings and follow-through',
    },
    {
      feature: 'Bookings, invoices, contracts',
      coupleFree: 'Not included',
      coupleBasic: 'Not included',
      couplePremium: 'Not included',
      professionalFree: 'Not included',
      professionalPremium: 'Included',
    },
    {
      feature: 'Public trust and growth',
      coupleFree: 'Not included',
      coupleBasic: 'Not included',
      couplePremium: 'Not included',
      professionalFree: 'Verified listing eligibility',
      professionalPremium: 'Visible ratings and stronger profile',
    },
  ];

  const renderFocusedUpgrade = () => {
    if (!targetAudience) return null;

    if (targetAudience === 'couple' && focusedCoupleTier) {
      const plan = couplePlanDefinitions.find((item) => item.tier === focusedCoupleTier);
      if (!plan) return null;

      const cadence = selectedCoupleCadence[plan.tier];
      const isLoading = checkoutTarget === `couple-${plan.tier}`;
      const priceLabel =
        cadence === 'monthly'
          ? `${formatKesPrice(plan.monthlyPriceKes)} / month`
          : `${formatKesPrice(plan.annualPriceKes)} / year`;

      return (
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <Card className="rounded-[28px] border-primary/20 bg-card/95 shadow-card">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="rounded-full px-3 py-1">{plan.title}</Badge>
                {highlightedFeature ? (
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    For {highlightedFeature}
                  </Badge>
                ) : null}
              </div>
              <div>
                <CardTitle className="font-display text-4xl">Upgrade to {plan.title}</CardTitle>
                <CardDescription className="mt-3 max-w-2xl text-base leading-8">
                  {highlightedFeature
                    ? `${plan.title} unlocks ${highlightedFeature.toLowerCase()} and keeps the rest of your wedding planning in the same workspace.`
                    : plan.supportCopy}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 bg-background/60 p-5">
                <div>
                  <p className="font-display text-3xl font-semibold">{priceLabel}</p>
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
              </div>

              <div className="rounded-2xl border border-border/60 bg-background/60 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Included</p>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-foreground/85">
                  {plan.includedFeatures.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={() => void handleCouplePlanCheckout(plan.tier)}
                  className="gap-2"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {user ? `Continue with ${plan.title}` : 'Sign in to continue'}
                  {!isLoading && <ArrowRight className="h-4 w-4" />}
                </Button>
                <Button asChild variant="outline">
                  <Link to="/pricing?audience=couple">See all wedding pricing</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      );
    }

    if (targetAudience === 'planner' || targetAudience === 'vendor') {
      const plan = getProfessionalPlanDefinition(targetAudience, 'premium');
      const cadence = selectedProfessionalCadence[targetAudience];
      const isLoading = checkoutTarget === `audience-${targetAudience}`;
      const priceLabel =
        cadence === 'monthly'
          ? `${formatKesPrice(plan.monthlyPriceKes)} / month`
          : `${formatKesPrice(plan.annualPriceKes)} / year`;

      return (
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <Card className="rounded-[28px] border-primary/20 bg-card/95 shadow-card">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="rounded-full px-3 py-1">{plan.title}</Badge>
                {highlightedFeature ? (
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    For {highlightedFeature}
                  </Badge>
                ) : null}
              </div>
              <div>
                <CardTitle className="font-display text-4xl">Upgrade to {plan.title}</CardTitle>
                <CardDescription className="mt-3 max-w-2xl text-base leading-8">
                  {highlightedFeature
                    ? `${plan.title} unlocks ${highlightedFeature.toLowerCase()} and the rest of the operational tools for your ${targetAudience} workspace.`
                    : plan.supportCopy}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 bg-background/60 p-5">
                <div>
                  <p className="font-display text-3xl font-semibold">{priceLabel}</p>
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
              </div>

              <div className="rounded-2xl border border-border/60 bg-background/60 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Included</p>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-foreground/85">
                  {plan.includedFeatures.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={() => void handleProfessionalPlanCheckout(targetAudience)}
                  className="gap-2"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {user ? `Continue with ${plan.title}` : 'Sign in to continue'}
                  {!isLoading && <ArrowRight className="h-4 w-4" />}
                </Button>
                <Button asChild variant="outline">
                  <Link to={`/pricing?audience=${targetAudience}`}>See all {targetAudience} pricing</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      );
    }

    if (targetAudience === 'committee' && targetPlan) {
      const availableCadences = getAvailableCheckoutCadences(targetPlan);
      const cadence = selectedCadence[targetAudience];
      const isLoading = checkoutTarget === `audience-${targetAudience}`;
      const priceLabel = cadence === 'annual'
        ? `${formatKesPrice(targetPlan.stripeAnnualLookupKey ? 5000 : null)}`
        : `${formatKesPrice(targetPlan.stripeMonthlyLookupKey ? 750 : null)}`;

      return (
        <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <Card className="rounded-[28px] border-primary/20 bg-card/95 shadow-card">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="rounded-full px-3 py-1">{targetPlan.paidTierName}</Badge>
                {highlightedFeature ? <Badge variant="outline" className="rounded-full px-3 py-1">For {highlightedFeature}</Badge> : null}
              </div>
              <div>
                <CardTitle className="font-display text-4xl">{targetPlan.paidTierName}</CardTitle>
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
                  <p className="font-display text-3xl font-semibold">{priceLabel}</p>
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

      {isFocusedUpgradeView ? (
        renderFocusedUpgrade()
      ) : (
        <>
          <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary">
                  Simple pricing
                </Badge>
                <h1 className="mt-6 max-w-4xl font-display text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                  Start free. Upgrade when the wedding or the business gets real.
                </h1>
                <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
                  Couples begin with the essentials, then upgrade when planning becomes collaborative and operational.
                  Planners and vendors list for free, then upgrade when they need bookings, invoices, contracts, and visible trust.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link to="/auth">
                    <Button className="w-full gap-2 sm:w-auto">
                      Start free
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/auth">
                    <Button variant="outline" className="w-full sm:w-auto">
                      Sign in
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
                      <CardTitle className="font-display text-3xl">What changes when you pay</CardTitle>
                      <CardDescription className="mt-2 text-base leading-7">
                        Zania stays generous at the start and becomes paid when coordination matters.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Couples</p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      Free gets you planning tools. Paid unlocks shared planning, vendor and planner collaboration, AI help, and timeline coordination.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Wedding professionals</p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      Free gets you discovered. Premium unlocks inquiries, bookings, invoicing, contracts, and public trust tools.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Committee access</p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      Committee members access Zania under the couple&apos;s plan. They do not need a separate public pricing tier.
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
            <div className="mb-6 max-w-3xl">
              <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary">
                Couple plans
              </Badge>
              <h2 className="mt-4 font-display text-4xl font-semibold">Choose the stage your wedding is in</h2>
              <p className="mt-4 text-base leading-8 text-muted-foreground">
                Free is for getting started. Basic is for shared planning. Premium is for fully coordinated weddings with AI and timeline support.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
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
                        {plan.tier === 'premium' ? (
                          <Badge className="rounded-full px-3 py-1">Most complete</Badge>
                        ) : null}
                      </div>
                      <div>
                        <p className="font-display text-3xl font-semibold">{priceLabel}</p>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">{plan.supportCopy}</p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
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

                      <ul className="space-y-2 text-sm leading-7 text-foreground/85">
                        {plan.includedFeatures.slice(0, 5).map((item) => (
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

            <p className="mt-5 text-sm text-muted-foreground">
              Committee members and family members access Zania inside the couple&apos;s wedding plan, not through a separate public subscription.
            </p>
          </section>

          <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8 lg:pb-18">
            <div className="mb-6 max-w-3xl">
              <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary">
                Planner & vendor plans
              </Badge>
              <h2 className="mt-4 font-display text-4xl font-semibold">Get discovered free. Upgrade when operations matter.</h2>
              <p className="mt-4 text-base leading-8 text-muted-foreground">
                Both planners and vendors follow the same commercial logic: free for visibility, premium for the tools that help them actually run the work.
              </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              {(['planner', 'vendor'] as const).map((audience) => {
                const freePlan = getProfessionalPlanDefinition(audience, 'free');
                const premiumPlan = getProfessionalPlanDefinition(audience, 'premium');
                const isLoading = checkoutTarget === `audience-${audience}`;
                const cadence = selectedProfessionalCadence[audience];
                const priceLabel =
                  cadence === 'monthly'
                    ? `${formatKesPrice(premiumPlan.monthlyPriceKes)} / month`
                    : `${formatKesPrice(premiumPlan.annualPriceKes)} / year`;

                return (
                  <Card key={audience} className="rounded-[28px] border border-border/60 bg-card/95 shadow-card">
                    <CardHeader className="space-y-4">
                      <div>
                        <CardTitle className="font-display text-3xl">{roleLabels[audience]}s</CardTitle>
                        <CardDescription className="mt-2 text-base leading-7">
                          {getAudiencePlan(audience).subtitle}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">{freePlan.title}</p>
                        <p className="mt-2 font-display text-2xl font-semibold">Free</p>
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
                          {premiumPlan.includedFeatures.slice(0, 5).map((item) => (
                            <li key={item} className="flex items-start gap-2">
                              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
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
          </section>

          <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8 lg:pb-18">
            <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-card">
              <CardHeader>
                <CardTitle className="font-display text-3xl">Quick comparison</CardTitle>
                <CardDescription className="text-base leading-7">
                  The main difference is simple: couples pay for shared planning and coordination, while professionals pay for business operations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <div className="min-w-[920px]">
                    <div className="grid grid-cols-[1.4fr_repeat(5,minmax(110px,1fr))] gap-2 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      <span>Feature</span>
                      <span className="text-center">Couple Free</span>
                      <span className="text-center">Couple Basic</span>
                      <span className="text-center">Couple Premium</span>
                      <span className="text-center">Pro Free</span>
                      <span className="text-center">Pro Premium</span>
                    </div>
                    <div className="mt-3 space-y-3">
                      {compactComparisonRows.map((row) => (
                        <div
                          key={row.feature}
                          className="grid grid-cols-[1.4fr_repeat(5,minmax(110px,1fr))] gap-2 rounded-xl border border-border/50 bg-background/60 px-4 py-3"
                        >
                          <p className="text-sm font-medium text-foreground">{row.feature}</p>
                          <p className="text-center text-sm text-muted-foreground">{row.coupleFree}</p>
                          <p className="text-center text-sm text-muted-foreground">{row.coupleBasic}</p>
                          <p className="text-center text-sm font-medium text-primary">{row.couplePremium}</p>
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

          <section className="mx-auto max-w-7xl px-4 pb-18 sm:px-6 lg:px-8">
            <Card className="rounded-[28px] border border-primary/20 bg-primary/5 shadow-card">
              <CardContent className="flex flex-col gap-5 px-6 py-8 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Ready to start?</p>
                  <h2 className="mt-2 font-display text-3xl font-semibold">Open your account and choose the right plan later.</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                    Most couples and professionals can begin on the free tier, get their bearings, and only upgrade when the real coordination work starts.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link to="/auth">
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
    </div>
  );
}
