import {
  buildPricingHref,
  getAudiencePlan,
  getCoupleAddonDefinition,
  getCouplePlanDefinition,
  type CoupleAddonCode,
  type CoupleEntitlementKey,
  type CouplePlanTier,
  type PricingAudience,
} from '@/lib/pricingPlans';
import { isCommitteePlanner, plannerHasActiveSubscription, plannerHasFullAccess } from '@/lib/plannerAccess';
import { vendorHasActiveSubscription, vendorHasFullAccess } from '@/lib/vendorAccess';

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
  | 'vendor.ai_assistant'
  | 'vendor.direct_leads'
  | 'vendor.analytics';

export interface EntitlementProfileLike {
  role?: string | null;
  planner_type?: string | null;
  planner_verified?: boolean | null;
  planner_verification_requested?: boolean | null;
  planner_subscription_status?: string | null;
  planner_subscription_expires_at?: string | null;
  planning_pass_status?: string | null;
  planning_pass_expires_at?: string | null;
}

export interface EntitlementVendorLike {
  is_approved?: boolean | null;
  is_verified?: boolean | null;
  verification_requested?: boolean | null;
  subscription_status?: string | null;
  subscription_expires_at?: string | null;
}

export interface EntitlementDecision {
  allowed: boolean;
  audience: PricingAudience;
  feature: EntitlementFeature;
  planName: string;
  entitlementCode: string;
  billingCadence: 'one_time' | 'monthly' | 'annual' | 'monthly_or_annual';
  stripeProductKey: string;
  stripeMonthlyLookupKey: string | null;
  stripeAnnualLookupKey: string | null;
  stripeOneTimeLookupKey: string | null;
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
  weddingEntitlements?: Partial<Record<CoupleEntitlementKey, boolean>> | null;
  couplePlanTier?: CouplePlanTier | null;
  bypass?: boolean;
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
  if (!plannerHasActiveSubscription(profile)) {
    reasons.push(isCommitteePlanner(profile) ? 'Your committee subscription is not active yet.' : 'Your Planner Pro subscription is not active yet.');
  }
  if (profile?.planner_verification_requested && !profile?.planner_verified) {
    reasons.push('Your verification request is still under review.');
  } else if (!profile?.planner_verified) {
    reasons.push(isCommitteePlanner(profile) ? 'Committee verification is still required.' : 'Planner verification is still required.');
  }
  return reasons;
}

function vendorReasons(vendorListing?: EntitlementVendorLike | null) {
  const reasons: string[] = [];
  if (!vendorListing?.is_approved) reasons.push('Your vendor listing still needs approval.');
  if (!vendorHasActiveSubscription(vendorListing)) reasons.push('Your Vendor Pro subscription is not active yet.');
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
  return hasActivePlanningPass(context.profile);
}

function getEffectiveCouplePlanTier(context: EntitlementContext, requiredTier: Exclude<CouplePlanTier, 'free'>) {
  if (context.couplePlanTier) {
    return requiredTier === 'basic' || context.couplePlanTier === 'premium'
      ? context.couplePlanTier
      : requiredTier;
  }

  return hasActivePlanningPass(context.profile) ? 'premium' : requiredTier;
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
  if (plan.stripeMonthlyLookupKey) params.set('monthlyLookupKey', plan.stripeMonthlyLookupKey);
  if (plan.stripeAnnualLookupKey) params.set('annualLookupKey', plan.stripeAnnualLookupKey);

  return `/pricing?${params.toString()}`;
}

function buildCoupleAddonPricingHref(code: CoupleAddonCode, feature?: string) {
  const addon = getCoupleAddonDefinition(code);
  const params = new URLSearchParams({
    audience: 'couple',
    addon: addon.code,
    successPath:
      addon.code === 'guest_rsvp_management_addon'
        ? '/guests?upgrade=success'
        : '/pricing?upgrade=success',
    cancelPath: '/pricing?upgrade=cancelled',
    monthlyLookupKey: addon.stripeMonthlyLookupKey ?? '',
  });

  if (feature) params.set('feature', feature);
  if (addon.stripeAnnualLookupKey) params.set('annualLookupKey', addon.stripeAnnualLookupKey);

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
    stripeProductKey: plan.stripeProductKey,
    stripeMonthlyLookupKey: plan.stripeMonthlyLookupKey,
    stripeAnnualLookupKey: plan.stripeAnnualLookupKey,
    stripeOneTimeLookupKey: plan.stripeOneTimeLookupKey,
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
    stripeProductKey: `couple_${tier}`,
    stripeMonthlyLookupKey: plan.stripeMonthlyLookupKey,
    stripeAnnualLookupKey: plan.stripeAnnualLookupKey,
    stripeOneTimeLookupKey: null,
    pricingHref: buildCouplePricingHref(tier, feature),
    title: overrides?.title ?? `Upgrade to ${plan.title}`,
    description: overrides?.description ?? `Unlock ${plan.title} to continue.`,
    ctaLabel: overrides?.ctaLabel ?? 'View pricing',
    reasons: overrides?.reasons ?? [],
  };
}

function buildCoupleAddonDecision(
  feature: EntitlementFeature,
  code: CoupleAddonCode,
  allowed: boolean,
  overrides?: Partial<Pick<EntitlementDecision, 'title' | 'description' | 'ctaLabel' | 'reasons'>>,
): EntitlementDecision {
  const addon = getCoupleAddonDefinition(code);
  return {
    allowed,
    audience: 'couple',
    feature,
    planName: addon.title,
    entitlementCode: code,
    billingCadence: addon.stripeAnnualLookupKey ? 'monthly_or_annual' : 'monthly',
    stripeProductKey: code,
    stripeMonthlyLookupKey: addon.stripeMonthlyLookupKey,
    stripeAnnualLookupKey: addon.stripeAnnualLookupKey,
    stripeOneTimeLookupKey: null,
    pricingHref: buildCoupleAddonPricingHref(code, feature),
    title: overrides?.title ?? `Add ${addon.title}`,
    description: overrides?.description ?? `Unlock ${addon.title} for this wedding.`,
    ctaLabel: overrides?.ctaLabel ?? 'View add-on',
    reasons: overrides?.reasons ?? [],
  };
}

export function getEntitlementDecision(feature: EntitlementFeature, context: EntitlementContext): EntitlementDecision {
  if (context.bypass) {
    const audience = getPricingAudience(context.profile);
    return buildDecision(feature, audience, true);
  }

  const audience = getPricingAudience(context.profile);
  const activeWeddingCount = context.activeWeddingCount ?? 0;

  switch (feature) {
    case 'couple.ai_assistant':
      return buildCoupleDecision(feature, getEffectiveCouplePlanTier(context, 'premium'), hasWeddingEntitlement(context, 'ai_wedding_assistant'), {
        title: 'Upgrade to unlock the AI Wedding Assistant',
        description: 'Premium unlocks an AI planning copilot that can read your workspace, answer planning questions, and help manage tasks, vendors, guests, budget, and timelines for your wedding.',
        reasons: hasWeddingEntitlement(context, 'ai_wedding_assistant')
          ? []
          : ['AI Wedding Assistant is part of Premium.'],
      });
    case 'couple.connect_vendors':
      return buildCoupleDecision(feature, getEffectiveCouplePlanTier(context, 'basic'), hasWeddingEntitlement(context, 'vendor_collaboration'), {
        title: 'Upgrade to collaborate with vendors',
        description: 'You can shortlist and compare vendors for free. Upgrade to Basic to share briefs, coordinate updates, and manage vendor collaboration in one workspace.',
        reasons: hasWeddingEntitlement(context, 'vendor_collaboration')
          ? []
          : ['Vendor collaboration is part of Basic.'],
      });
    case 'couple.connect_planners':
      return buildCoupleDecision(feature, getEffectiveCouplePlanTier(context, 'basic'), hasWeddingEntitlement(context, 'planner_collaboration'), {
        title: 'Upgrade to work with a planner',
        description: 'Upgrade to Basic to invite a planner, share your progress, and keep your wedding workspace collaborative.',
        reasons: hasWeddingEntitlement(context, 'planner_collaboration')
          ? []
          : ['Planner collaboration is part of Basic.'],
      });
    case 'couple.calendar_sync':
      return buildCoupleDecision(feature, getEffectiveCouplePlanTier(context, 'premium'), hasWeddingEntitlement(context, 'timeline_management'), {
        title: 'Upgrade to sync your wedding timeline',
        description: 'Premium unlocks collaborative timeline management, calendar syncing, and execution tools once your wedding moves into active coordination.',
        reasons: hasWeddingEntitlement(context, 'timeline_management')
          ? []
          : ['Timeline management and calendar sync are part of Premium.'],
      });
    case 'couple.export_progress':
      return buildCoupleDecision(feature, getEffectiveCouplePlanTier(context, 'premium'), hasWeddingEntitlement(context, 'timeline_management'), {
        title: 'Upgrade to export wedding progress',
        description: 'Premium unlocks budget exports, task exports, and shareable planning reports once you are actively coordinating the wedding.',
        reasons: hasWeddingEntitlement(context, 'timeline_management')
          ? []
          : ['Advanced exports are part of Premium.'],
      });
    case 'couple.gift_registry':
      return buildCoupleAddonDecision(feature, 'gift_registry_addon', hasWeddingEntitlement(context, 'gift_registry'), {
        title: 'Add Gift Registry to this wedding',
        description: 'Publish a wedding wishlist, track purchased items automatically, and give guests one clear place to buy gifts without duplicates.',
        reasons: hasWeddingEntitlement(context, 'gift_registry')
          ? []
          : ['Gift Registry is a paid add-on.'],
      });
    case 'couple.guest_rsvp_management':
      return buildCoupleAddonDecision(feature, 'guest_rsvp_management_addon', hasWeddingEntitlement(context, 'guest_rsvp_management'), {
        title: 'Add RSVP & guest management',
        description: 'Unlock RSVP links, invite sending, guest insights, and check-in tools for this wedding while keeping the basic guest list free.',
        reasons: hasWeddingEntitlement(context, 'guest_rsvp_management')
          ? []
          : ['Guest RSVP & Management is a paid add-on.'],
      });
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
        description: 'Planner Pro unlocks an AI assistant that can reason across client tasks, vendors, timelines, budgets, and payment workflows while helping you operate faster.',
        reasons: plannerHasActiveSubscription(context.profile) ? [] : ['AI planning support is part of Planner Pro.'],
      });
    case 'planner.additional_weddings':
      return buildDecision(feature, 'planner', activeWeddingCount < 1 || plannerHasActiveSubscription(context.profile), {
        title: 'You’ve reached your free planner limit',
        description: 'Your free planner account includes 1 active wedding. Upgrade to Planner Pro to manage more weddings without closing your current work.',
        reasons: activeWeddingCount >= 1 && !plannerHasActiveSubscription(context.profile)
          ? ['Your free planner tier includes only 1 active wedding.']
          : [],
      });
    case 'planner.vendor_outreach':
    case 'planner.full_workspace':
      return buildDecision(feature, 'planner', plannerHasFullAccess(context.profile), {
        title: 'Upgrade to unlock the full planner workspace',
        description: 'Planner Pro unlocks couple links, vendor outreach, and the shared planner workspace once your verification and subscription are active.',
        reasons: plannerReasons(context.profile),
      });
    case 'planner.calendar_sync':
      return buildDecision(feature, 'planner', plannerHasActiveSubscription(context.profile), {
        title: 'Upgrade to sync planner schedules',
        description: 'Planner Pro unlocks Google Calendar syncing, exports, and the scheduling tools that matter once you are operating at scale.',
        reasons: plannerHasActiveSubscription(context.profile) ? [] : ['Planner calendar sync is part of Planner Pro.'],
      });
    case 'planner.export_progress':
      return buildDecision(feature, 'planner', plannerHasActiveSubscription(context.profile), {
        title: 'Upgrade to export client progress',
        description: 'Planner Pro unlocks client exports, handoff reports, and the shareable planning documents that matter once you manage weddings professionally.',
        reasons: plannerHasActiveSubscription(context.profile) ? [] : ['Planner exports are part of Planner Pro.'],
      });
    case 'vendor.ai_assistant':
      return buildDecision(feature, 'vendor', vendorHasActiveSubscription(context.vendorListing), {
        title: 'Upgrade to unlock the AI vendor assistant',
        description: 'Vendor Pro unlocks an AI assistant that can help you improve your listing, understand bookings, review tasks, and manage client-facing work more efficiently.',
        reasons: vendorHasActiveSubscription(context.vendorListing) ? [] : ['AI vendor support is part of Vendor Pro.'],
      });
    case 'vendor.direct_leads':
      return buildDecision(feature, 'vendor', vendorHasFullAccess(context.vendorListing), {
        title: 'Upgrade to start receiving direct leads',
        description: 'Vendor Pro unlocks direct connection requests and lead handling once your listing is approved, verified, and subscribed.',
        reasons: vendorReasons(context.vendorListing),
      });
    case 'vendor.analytics':
      return buildDecision(feature, 'vendor', vendorHasFullAccess(context.vendorListing), {
        title: 'Upgrade to unlock vendor analytics',
        description: 'Vendor Pro unlocks analytics, performance insights, and the premium business tools behind your listing.',
        reasons: vendorReasons(context.vendorListing),
      });
    default:
      return buildDecision(feature, audience, false);
  }
}
