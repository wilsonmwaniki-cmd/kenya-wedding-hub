import {
  buildPricingHref,
  getAudiencePlan,
  getCouplePlanDefinition,
  type CoupleEntitlementKey,
  type CouplePlanTier,
  type ProfessionalEntitlementKey,
  type ProfessionalAudience,
  type PricingAudience,
} from '@/lib/pricingPlans';
import { hasActiveBetaTrial } from '@/lib/betaTrial';
import { isCommitteePlanner, plannerHasActiveSubscription, plannerHasFullAccess } from '@/lib/plannerAccess';
import { vendorCanCollaborate, vendorHasActiveSubscription, vendorHasFullAccess } from '@/lib/vendorAccess';

const ENTITLEMENT_TEST_MODE_STORAGE_KEY = 'zania-unlock-all-features';
const TEMPORARILY_UNLOCK_ALL_FEATURES_FOR_TESTING = false;

export type PlanningPassStatus = 'inactive' | 'active' | 'past_due' | 'cancelled';

export type EntitlementFeature =
  | 'couple.ai_assistant'
  | 'couple.connect_vendors'
  | 'couple.connect_planners'
  | 'couple.calendar_sync'
  | 'couple.export_progress'
  | 'couple.gift_registry'
  | 'couple.guest_rsvp_management'
  | 'committee.ai_assistant'
  | 'committee.connect_vendors'
  | 'committee.connect_couples'
  | 'committee.calendar_sync'
  | 'committee.export_progress'
  | 'planner.ai_assistant'
  | 'planner.additional_weddings'
  | 'planner.vendor_outreach'
  | 'planner.calendar_sync'
  | 'planner.full_workspace'
  | 'planner.export_progress'
  | 'planner.media_portfolio'
  | 'planner.advertising'
  | 'planner.team_workspace'
  | 'vendor.ai_assistant'
  | 'vendor.direct_leads'
  | 'vendor.analytics'
  | 'vendor.media_portfolio'
  | 'vendor.advertising'
  | 'vendor.team_workspace';

export interface EntitlementProfileLike {
  role?: string | null;
  planner_type?: string | null;
  planner_verified?: boolean | null;
  planner_verification_requested?: boolean | null;
  planner_subscription_status?: string | null;
  planner_subscription_expires_at?: string | null;
  planning_pass_status?: string | null;
  planning_pass_expires_at?: string | null;
  beta_trial_status?: string | null;
  beta_trial_started_at?: string | null;
  beta_trial_expires_at?: string | null;
}

export interface EntitlementVendorLike {
  is_approved?: boolean | null;
  is_verified?: boolean | null;
  verification_requested?: boolean | null;
  subscription_status?: string | null;
  subscription_expires_at?: string | null;
  beta_trial_status?: string | null;
  beta_trial_started_at?: string | null;
  beta_trial_expires_at?: string | null;
}

export interface EntitlementDecision {
  allowed: boolean;
  audience: PricingAudience;
  feature: EntitlementFeature;
  planName: string;
  entitlementCode: string;
  billingCadence: 'one_time' | 'monthly' | 'annual' | 'monthly_or_annual';
  billingProductKey: string;
  checkoutMonthlyLookupKey: string | null;
  checkoutAnnualLookupKey: string | null;
  checkoutOneTimeLookupKey: string | null;
  pricingHref: string;
  title: string;
  description: string;
  ctaLabel: string;
  reasons: string[];
}

interface EntitlementContext {
  profile?: EntitlementProfileLike | null;
  vendorListing?: EntitlementVendorLike | null;
  activeWeddingCount?: number;
  plannerFreeWeddingEligible?: boolean | null;
  plannerFreeWeddingReason?: string | null;
  weddingEntitlements?: Partial<Record<CoupleEntitlementKey, boolean>> | null;
  couplePlanTier?: CouplePlanTier | null;
  professionalAudience?: ProfessionalAudience | null;
  professionalEntitlements?: Partial<Record<ProfessionalEntitlementKey, boolean>> | null;
  professionalTeamSeatLimit?: number | null;
  bypass?: boolean;
}

function isGlobalEntitlementBypassEnabled() {
  if (TEMPORARILY_UNLOCK_ALL_FEATURES_FOR_TESTING) {
    return true;
  }

  if (import.meta.env.VITE_ALLOW_ALL_FEATURES === 'true') {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(ENTITLEMENT_TEST_MODE_STORAGE_KEY) === 'true';
}

function planForAudience(audience: PricingAudience) {
  return getAudiencePlan(audience);
}

function isActiveStatus(status?: string | null, expiresAt?: string | null) {
  if (status !== 'active') return false;
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

export function hasActivePlanningPass(profile?: EntitlementProfileLike | null) {
  return isActiveStatus(profile?.planning_pass_status, profile?.planning_pass_expires_at);
}

export function getPricingAudience(profile?: EntitlementProfileLike | null): PricingAudience {
  if (profile?.role === 'planner') {
    return isCommitteePlanner(profile) ? 'committee' : 'planner';
  }
  if (profile?.role === 'vendor') return 'vendor';
  return 'couple';
}

function plannerReasons(profile?: EntitlementProfileLike | null) {
  const reasons: string[] = [];
  if (hasActiveBetaTrial(profile)) {
    return reasons;
  }
  if (!plannerHasActiveSubscription(profile)) {
    reasons.push(isCommitteePlanner(profile) ? 'Your committee subscription is not active yet.' : 'Your Professional subscription is not active yet.');
  }
  if (profile?.planner_verification_requested && !profile?.planner_verified) {
    reasons.push('Your verification request is still under review.');
  } else if (!profile?.planner_verified) {
    reasons.push(isCommitteePlanner(profile) ? 'Committee verification is still required.' : 'Planner verification is still required.');
  }
  return reasons;
}

function vendorReasons(vendorListing?: EntitlementVendorLike | null, profile?: EntitlementProfileLike | null) {
  const reasons: string[] = [];
  if (hasActiveBetaTrial(profile) || hasActiveBetaTrial(vendorListing)) {
    return reasons;
  }
  if (!vendorListing?.is_approved) reasons.push('Your vendor listing still needs approval.');
  if (!vendorHasActiveSubscription(vendorListing)) reasons.push('Your Professional subscription is not active yet.');
  if (vendorListing?.verification_requested && !vendorListing?.is_verified) {
    reasons.push('Your verification request is still under review.');
  } else if (!vendorListing?.is_verified) {
    reasons.push('Vendor verification is still required.');
  }
  return reasons;
}

function vendorCollaborationReasons(vendorListing?: EntitlementVendorLike | null) {
  const reasons: string[] = [];
  if (!vendorListing?.is_approved) reasons.push('Your vendor listing still needs approval.');
  if (vendorListing?.verification_requested && !vendorListing?.is_verified) {
    reasons.push('Your verification request is still under review.');
  } else if (!vendorListing?.is_verified) {
    reasons.push('Vendor verification is still required.');
  }
  return reasons;
}

function planningPassReasons() {
  return ['Your Wedding Plan is not active yet.'];
}

function hasWeddingEntitlement(context: EntitlementContext, entitlementKey: CoupleEntitlementKey) {
  const explicitValue = context.weddingEntitlements?.[entitlementKey];
  if (typeof explicitValue === 'boolean') return explicitValue;
  return hasActiveBetaTrial(context.profile) || hasActivePlanningPass(context.profile);
}

function hasProfessionalEntitlement(context: EntitlementContext, entitlementKey: ProfessionalEntitlementKey) {
  const explicitValue = context.professionalEntitlements?.[entitlementKey];
  return hasActiveBetaTrial(context.profile) || Boolean(explicitValue);
}

function getEffectiveCouplePlanTier(context: EntitlementContext, requiredTier: Exclude<CouplePlanTier, 'free'>) {
  return context.couplePlanTier === 'collaborative'
    || hasActiveBetaTrial(context.profile)
    || hasActivePlanningPass(context.profile)
    ? 'collaborative'
    : requiredTier;
}

function buildCouplePricingHref(tier: Exclude<CouplePlanTier, 'free'>, feature?: string) {
  const plan = getCouplePlanDefinition(tier);
  const params = new URLSearchParams({
    audience: 'couple',
    plan: `couple_${tier}`,
    successPath: '/budget?upgrade=success',
    cancelPath: '/pricing?upgrade=cancelled',
  });

  if (feature) params.set('feature', feature);
  if (plan.checkoutMonthlyLookupKey) params.set('monthlyLookupKey', plan.checkoutMonthlyLookupKey);
  if (plan.checkoutAnnualLookupKey) params.set('annualLookupKey', plan.checkoutAnnualLookupKey);

  return `/pricing?${params.toString()}`;
}

function buildDecision(
  feature: EntitlementFeature,
  audience: PricingAudience,
  allowed: boolean,
  overrides?: Partial<Pick<EntitlementDecision, 'title' | 'description' | 'ctaLabel' | 'reasons'>>,
): EntitlementDecision {
  const plan = planForAudience(audience);
  return {
    allowed,
    audience,
    feature,
    planName: plan.paidTierName,
    entitlementCode: plan.entitlementCode,
    billingCadence: plan.billingCadence,
    billingProductKey: plan.billingProductKey,
    checkoutMonthlyLookupKey: plan.checkoutMonthlyLookupKey,
    checkoutAnnualLookupKey: plan.checkoutAnnualLookupKey,
    checkoutOneTimeLookupKey: plan.checkoutOneTimeLookupKey,
    pricingHref: buildPricingHref(audience, feature),
    title: overrides?.title ?? `Upgrade to ${plan.paidTierName}`,
    description: overrides?.description ?? `Unlock ${plan.paidTierName} to continue.`,
    ctaLabel: overrides?.ctaLabel ?? 'View pricing',
    reasons: overrides?.reasons ?? [],
  };
}

function buildCoupleDecision(
  feature: EntitlementFeature,
  tier: Exclude<CouplePlanTier, 'free'>,
  allowed: boolean,
  overrides?: Partial<Pick<EntitlementDecision, 'title' | 'description' | 'ctaLabel' | 'reasons'>>,
): EntitlementDecision {
  const plan = getCouplePlanDefinition(tier);
  return {
    allowed,
    audience: 'couple',
    feature,
    planName: plan.title,
    entitlementCode: `couple_${tier}`,
    billingCadence: 'monthly_or_annual',
    billingProductKey: `couple_${tier}`,
    checkoutMonthlyLookupKey: plan.checkoutMonthlyLookupKey,
    checkoutAnnualLookupKey: plan.checkoutAnnualLookupKey,
    checkoutOneTimeLookupKey: null,
    pricingHref: buildCouplePricingHref(tier, feature),
    title: overrides?.title ?? `Upgrade to ${plan.title}`,
    description: overrides?.description ?? `Unlock ${plan.title} to continue.`,
    ctaLabel: overrides?.ctaLabel ?? 'View pricing',
    reasons: overrides?.reasons ?? [],
  };
}

export function getEntitlementDecision(feature: EntitlementFeature, context: EntitlementContext): EntitlementDecision {
  if (context.bypass || isGlobalEntitlementBypassEnabled()) {
    const audience = feature.startsWith('planner.') ? 'planner' : feature.startsWith('vendor.') ? 'vendor' : getPricingAudience(context.profile);
    return buildDecision(feature, audience, true);
  }

  const audience = getPricingAudience(context.profile);
  const activeWeddingCount = context.activeWeddingCount ?? 0;
  const plannerFreeWeddingEligible = context.plannerFreeWeddingEligible ?? activeWeddingCount < 1;

  switch (feature) {
    case 'couple.ai_assistant':
      return buildDecision(feature, 'couple', true);
    case 'couple.connect_vendors':
      return buildCoupleDecision(feature, getEffectiveCouplePlanTier(context, 'collaborative'), hasWeddingEntitlement(context, 'vendor_collaboration'), {
        title: 'Upgrade to Collaborative',
        description: 'Your wedding now involves more people and moving parts. Upgrade to Collaborative to invite your planner, committee, family or vendors.',
        reasons: hasWeddingEntitlement(context, 'vendor_collaboration')
          ? []
          : ['Vendor collaboration needs Collaborative access.'],
      });
    case 'couple.connect_planners':
      return buildCoupleDecision(feature, getEffectiveCouplePlanTier(context, 'collaborative'), hasWeddingEntitlement(context, 'planner_collaboration'), {
        title: 'Upgrade to Collaborative',
        description: 'Your wedding now involves more people and moving parts. Upgrade to Collaborative to invite your planner, committee, family or vendors.',
        reasons: hasWeddingEntitlement(context, 'planner_collaboration')
          ? []
          : ['Planner collaboration needs Collaborative access.'],
      });
    case 'couple.calendar_sync':
      return buildDecision(feature, 'couple', true);
    case 'couple.export_progress':
      return buildDecision(feature, 'couple', true);
    case 'couple.gift_registry':
      return buildDecision(feature, 'couple', true);
    case 'couple.guest_rsvp_management':
      return buildDecision(feature, 'couple', true);
    case 'committee.connect_vendors':
    case 'committee.connect_couples':
    case 'committee.calendar_sync':
    case 'committee.export_progress':
      return buildDecision(feature, 'committee', plannerHasFullAccess(context.profile), {
        title:
          feature === 'committee.calendar_sync'
            ? 'Upgrade to sync committee schedules'
            : feature === 'committee.export_progress'
              ? 'Upgrade to export committee progress'
              : 'Upgrade to unlock full committee coordination',
        description:
          feature === 'committee.calendar_sync'
            ? 'Committee Pass unlocks Google Calendar syncing and the full shared execution workflow.'
            : feature === 'committee.export_progress'
              ? 'Committee Pass unlocks exports, reporting, and the shareable progress views that matter once execution is underway.'
              : 'Committee Pass unlocks vendor and couple coordination, delegated execution, and the shared wedding workspace.',
        reasons: plannerReasons(context.profile),
      });
    case 'committee.ai_assistant':
      return buildDecision(feature, 'committee', plannerHasActiveSubscription(context.profile), {
        title: 'Upgrade to unlock the AI committee assistant',
        description: 'Committee Pass unlocks an AI assistant that understands delegated planning, vendors, budgets, tasks, and wedding execution across the committee workspace.',
        reasons: plannerHasActiveSubscription(context.profile) ? [] : ['AI committee support is part of Committee Pass.'],
      });
    case 'planner.ai_assistant':
      return buildDecision(feature, 'planner', plannerHasActiveSubscription(context.profile), {
        title: 'Upgrade to unlock the AI planner assistant',
        description: 'Professional unlocks an AI assistant that can reason across client tasks, vendors, timelines, budgets, and payment workflows while helping you operate faster.',
        reasons: plannerHasActiveSubscription(context.profile) ? [] : ['AI planning support is part of Professional.'],
      });
    case 'planner.additional_weddings':
      return buildDecision(feature, 'planner', plannerFreeWeddingEligible || plannerHasActiveSubscription(context.profile), {
        title: 'You’ve reached your free planner limit',
        description: 'Your free planner account includes 1 active wedding. Upgrade to Professional to manage more weddings without closing your current work.',
        reasons: !plannerFreeWeddingEligible && !plannerHasActiveSubscription(context.profile)
          ? [context.plannerFreeWeddingReason || 'Your free planner tier includes only 1 active wedding.']
          : [],
      });
    case 'planner.vendor_outreach':
    case 'planner.full_workspace':
      return buildDecision(feature, 'planner', plannerHasFullAccess(context.profile), {
        title: 'Upgrade to unlock the full planner workspace',
        description: 'Professional unlocks multi-wedding operations and vendor outreach once your verification and subscription are active.',
        reasons: plannerReasons(context.profile),
      });
    case 'planner.calendar_sync':
      return buildDecision(feature, 'planner', plannerHasActiveSubscription(context.profile), {
        title: 'Upgrade to sync planner schedules',
        description: 'Professional unlocks Google Calendar syncing, exports, and the scheduling tools that matter once you are operating at scale.',
        reasons: plannerHasActiveSubscription(context.profile) ? [] : ['Planner calendar sync is part of Professional.'],
      });
    case 'planner.export_progress':
      return buildDecision(feature, 'planner', plannerHasActiveSubscription(context.profile), {
        title: 'Upgrade to export client progress',
        description: 'Professional unlocks client exports, handoff reports, and the shareable planning documents that matter once you manage weddings professionally.',
        reasons: plannerHasActiveSubscription(context.profile) ? [] : ['Planner exports are part of Professional.'],
      });
    case 'vendor.ai_assistant':
      return buildDecision(feature, 'vendor', vendorHasActiveSubscription(context.vendorListing), {
        title: 'Upgrade to unlock the AI vendor assistant',
        description: 'Professional unlocks an AI assistant that can help you improve your listing, understand bookings, review tasks, and manage client-facing work more efficiently.',
        reasons: vendorHasActiveSubscription(context.vendorListing) ? [] : ['AI vendor support is part of Professional.'],
      });
    case 'vendor.direct_leads':
      return buildDecision(feature, 'vendor', vendorCanCollaborate(context.vendorListing), {
        title: 'Complete verification to receive inquiries',
        description: 'Free includes direct inquiries after your listing is approved and verified.',
        reasons: vendorCollaborationReasons(context.vendorListing),
      });
    case 'vendor.analytics':
      return buildDecision(feature, 'vendor', vendorHasFullAccess(context.vendorListing), {
        title: 'Upgrade to unlock vendor analytics',
        description: 'Professional unlocks analytics, performance insights, and the business tools behind your listing.',
        reasons: vendorReasons(context.vendorListing, context.profile),
      });
    case 'planner.media_portfolio':
      return buildDecision(feature, 'planner', plannerHasActiveSubscription(context.profile) || hasProfessionalEntitlement(context, 'media_portfolio'), {
        title: 'Upgrade to Professional for an advanced portfolio',
        description: 'Professional includes richer portfolio media and advanced business presentation.',
        reasons: plannerHasActiveSubscription(context.profile) || hasProfessionalEntitlement(context, 'media_portfolio') ? [] : ['Advanced portfolio tools are part of Professional.'],
      });
    case 'planner.advertising':
      return buildDecision(feature, 'planner', false, {
        title: 'Advertising is not part of subscriptions',
        description: 'Zania will introduce clearly labelled advertising separately when the product is ready.',
        ctaLabel: 'View Professional',
        reasons: ['Advertising is not currently available.'],
      });
    case 'planner.team_workspace':
      return buildDecision(feature, 'planner', hasProfessionalEntitlement(context, 'team_workspace'), {
        title: 'Team workspace is coming soon',
        description: 'Team roles will be released as part of Professional rather than as a separate add-on.',
        ctaLabel: 'View Professional',
        reasons: hasProfessionalEntitlement(context, 'team_workspace') ? [] : ['Team workspace is still in development.'],
      });
    case 'vendor.media_portfolio':
      return buildDecision(feature, 'vendor', vendorHasActiveSubscription(context.vendorListing) || hasProfessionalEntitlement(context, 'media_portfolio'), {
        title: 'Upgrade to Professional for an advanced portfolio',
        description: 'Professional includes richer portfolio media and advanced business presentation.',
        reasons: vendorHasActiveSubscription(context.vendorListing) || hasProfessionalEntitlement(context, 'media_portfolio') ? [] : ['Advanced portfolio tools are part of Professional.'],
      });
    case 'vendor.advertising':
      return buildDecision(feature, 'vendor', false, {
        title: 'Advertising is not part of subscriptions',
        description: 'Zania will introduce clearly labelled advertising separately when the product is ready.',
        ctaLabel: 'View Professional',
        reasons: ['Advertising is not currently available.'],
      });
    case 'vendor.team_workspace':
      return buildDecision(feature, 'vendor', hasProfessionalEntitlement(context, 'team_workspace'), {
        title: 'Team workspace is coming soon',
        description: 'Team roles will be released as part of Professional rather than as a separate add-on.',
        ctaLabel: 'View Professional',
        reasons: hasProfessionalEntitlement(context, 'team_workspace') ? [] : ['Team workspace is still in development.'],
      });
    default:
      return buildDecision(feature, audience, false);
  }
}
