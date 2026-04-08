import { audiencePlans, type PricingAudience } from '@/lib/pricingPlans';
import { isCommitteePlanner, plannerHasActiveSubscription, plannerHasFullAccess } from '@/lib/plannerAccess';
import { vendorHasActiveSubscription, vendorHasFullAccess } from '@/lib/vendorAccess';

export type PlanningPassStatus = 'inactive' | 'active' | 'past_due' | 'cancelled';

export type EntitlementFeature =
  | 'couple.connect_vendors'
  | 'couple.connect_planners'
  | 'couple.calendar_sync'
  | 'committee.connect_vendors'
  | 'committee.connect_couples'
  | 'committee.calendar_sync'
  | 'planner.additional_weddings'
  | 'planner.vendor_outreach'
  | 'planner.calendar_sync'
  | 'planner.full_workspace'
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
  title: string;
  description: string;
  ctaLabel: string;
  reasons: string[];
}

interface EntitlementContext {
  profile?: EntitlementProfileLike | null;
  vendorListing?: EntitlementVendorLike | null;
  activeWeddingCount?: number;
  bypass?: boolean;
}

function planForAudience(audience: PricingAudience) {
  return audiencePlans.find((plan) => plan.audience === audience)!;
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
  return ['Your Planning Pass is not active yet.'];
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
    title: overrides?.title ?? `Upgrade to ${plan.paidTierName}`,
    description: overrides?.description ?? `Unlock ${plan.paidTierName} to continue.`,
    ctaLabel: overrides?.ctaLabel ?? 'View pricing',
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
    case 'couple.connect_vendors':
      return buildDecision(feature, 'couple', hasActivePlanningPass(context.profile), {
        title: 'Upgrade to connect with vendors',
        description: 'You can shortlist and compare vendors for free. Upgrade to Planning Pass to send direct requests, track payments, and coordinate the wedding in one place.',
        reasons: planningPassReasons(),
      });
    case 'couple.connect_planners':
      return buildDecision(feature, 'couple', hasActivePlanningPass(context.profile), {
        title: 'Upgrade to work with a planner',
        description: 'Unlock Planning Pass to connect with planners, share your progress, and keep your wedding workspace collaborative.',
        reasons: planningPassReasons(),
      });
    case 'couple.calendar_sync':
      return buildDecision(feature, 'couple', hasActivePlanningPass(context.profile), {
        title: 'Upgrade to sync schedules',
        description: 'Planning Pass unlocks Google Calendar syncing and other execution tools once you move from exploration into active planning.',
        reasons: planningPassReasons(),
      });
    case 'committee.connect_vendors':
    case 'committee.connect_couples':
    case 'committee.calendar_sync':
      return buildDecision(feature, 'committee', plannerHasFullAccess(context.profile), {
        title: feature === 'committee.calendar_sync' ? 'Upgrade to sync committee schedules' : 'Upgrade to unlock full committee coordination',
        description: feature === 'committee.calendar_sync'
          ? 'Committee Pass unlocks Google Calendar syncing and the full shared execution workflow.'
          : 'Committee Pass unlocks vendor and couple coordination, delegated execution, and the shared wedding workspace.',
        reasons: plannerReasons(context.profile),
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
