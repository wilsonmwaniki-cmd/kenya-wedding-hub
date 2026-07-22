export type PricingAudience = 'couple' | 'committee' | 'planner' | 'vendor';
export type AccessLevel = 'free' | 'paid';
export type PricingCheckoutCadence = 'one_time' | 'monthly' | 'annual';
export type CouplePlanTier = 'free' | 'collaborative';
export type CouplePlanCadence = 'monthly' | 'annual';
export type ProfessionalAudience = 'planner' | 'vendor';
export type ProfessionalPlanTier = 'free' | 'premium';
export type ProfessionalPlanCadence = 'monthly' | 'annual';

export type CouplePlanDefinition = {
  tier: CouplePlanTier;
  title: string;
  annualPriceKes: number | null;
  monthlyPriceKes: number | null;
  bundleType: 'couple_plan';
  bundleCode: string | null;
  checkoutMonthlyLookupKey: string | null;
  checkoutAnnualLookupKey: string | null;
};

export type ProfessionalPlanDefinition = {
  audience: ProfessionalAudience;
  tier: ProfessionalPlanTier;
  title: string;
  annualPriceKes: number | null;
  monthlyPriceKes: number | null;
  bundleType: 'professional_plan';
  bundleCode: string | null;
  checkoutMonthlyLookupKey: string | null;
  checkoutAnnualLookupKey: string | null;
};

export type AudiencePlan = {
  audience: PricingAudience;
  title: string;
  freeTierName: string;
  paidTierName: string;
  billingCadence: 'one_time' | 'monthly' | 'annual' | 'monthly_or_annual';
  displayOneTimePriceKes: number | null;
  displayMonthlyPriceKes: number | null;
  displayAnnualPriceKes: number | null;
  entitlementCode: string;
  billingProductKey: string;
  checkoutMonthlyLookupKey: string | null;
  checkoutAnnualLookupKey: string | null;
  checkoutOneTimeLookupKey: string | null;
  successPath: string;
  cancelPath: string;
};

type LegacyLookupFields = {
  stripeMonthlyLookupKey?: string | null;
  stripeAnnualLookupKey?: string | null;
  stripeOneTimeLookupKey?: string | null;
  stripeProductKey?: string | null;
};

type PricingConfigOverrides = {
  couplePlans?: Partial<Record<CouplePlanTier, Partial<CouplePlanDefinition>>>;
  professionalPlans?: Partial<
    Record<ProfessionalAudience, Partial<Record<ProfessionalPlanTier, Partial<ProfessionalPlanDefinition>>>>
  >;
  audiencePlans?: Partial<Record<PricingAudience, Partial<AudiencePlan>>>;
};

function parsePricingConfigOverrides(): PricingConfigOverrides {
  const raw = import.meta.env.VITE_PRICING_CONFIG_JSON?.trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.warn('Ignoring VITE_PRICING_CONFIG_JSON because it is not a JSON object.');
      return {};
    }
    return normalizePricingConfigOverridesShape(parsed);
  } catch (error) {
    console.warn('Could not parse VITE_PRICING_CONFIG_JSON. Falling back to default pricing config.', error);
    return {};
  }
}

function normalizeLookupValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeLookupFields<T extends Record<string, unknown>>(value: T) {
  const legacy = value as T & LegacyLookupFields;
  const next = { ...value } as T & {
    billingProductKey?: string | null;
    checkoutMonthlyLookupKey?: string | null;
    checkoutAnnualLookupKey?: string | null;
    checkoutOneTimeLookupKey?: string | null;
  };

  next.billingProductKey = normalizeLookupValue(next.billingProductKey) ?? normalizeLookupValue(legacy.stripeProductKey);
  next.checkoutMonthlyLookupKey = normalizeLookupValue(next.checkoutMonthlyLookupKey) ?? normalizeLookupValue(legacy.stripeMonthlyLookupKey);
  next.checkoutAnnualLookupKey = normalizeLookupValue(next.checkoutAnnualLookupKey) ?? normalizeLookupValue(legacy.stripeAnnualLookupKey);
  next.checkoutOneTimeLookupKey = normalizeLookupValue(next.checkoutOneTimeLookupKey) ?? normalizeLookupValue(legacy.stripeOneTimeLookupKey);

  delete legacy.stripeProductKey;
  delete legacy.stripeMonthlyLookupKey;
  delete legacy.stripeAnnualLookupKey;
  delete legacy.stripeOneTimeLookupKey;

  return next;
}

function normalizePricingConfigOverridesShape(raw: unknown): PricingConfigOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const parsed = raw as Record<string, unknown>;
  const next: PricingConfigOverrides = {};

  if (parsed.couplePlans && typeof parsed.couplePlans === 'object' && !Array.isArray(parsed.couplePlans)) {
    next.couplePlans = Object.fromEntries(
      Object.entries(parsed.couplePlans as Record<string, unknown>).map(([key, value]) => [
        key,
        value && typeof value === 'object' && !Array.isArray(value)
          ? normalizeLookupFields(value as Record<string, unknown>)
          : {},
      ]),
    ) as PricingConfigOverrides['couplePlans'];
  }

  if (parsed.professionalPlans && typeof parsed.professionalPlans === 'object' && !Array.isArray(parsed.professionalPlans)) {
    next.professionalPlans = Object.fromEntries(
      Object.entries(parsed.professionalPlans as Record<string, unknown>).map(([audience, tiers]) => [
        audience,
        tiers && typeof tiers === 'object' && !Array.isArray(tiers)
          ? Object.fromEntries(
              Object.entries(tiers as Record<string, unknown>).map(([tier, value]) => [
                tier,
                value && typeof value === 'object' && !Array.isArray(value)
                  ? normalizeLookupFields(value as Record<string, unknown>)
                  : {},
              ]),
            )
          : {},
      ]),
    ) as PricingConfigOverrides['professionalPlans'];
  }

  if (parsed.audiencePlans && typeof parsed.audiencePlans === 'object' && !Array.isArray(parsed.audiencePlans)) {
    next.audiencePlans = Object.fromEntries(
      Object.entries(parsed.audiencePlans as Record<string, unknown>).map(([key, value]) => [
        key,
        value && typeof value === 'object' && !Array.isArray(value)
          ? normalizeLookupFields(value as Record<string, unknown>)
          : {},
      ]),
    ) as PricingConfigOverrides['audiencePlans'];
  }

  return next;
}

function applyOverride<T extends Record<string, unknown>>(base: T, override?: Partial<T>) {
  if (!override) return base;
  return { ...base, ...override } as T;
}

function mergePricingConfigOverrides(
  base: PricingConfigOverrides,
  override: PricingConfigOverrides,
): PricingConfigOverrides {
  return {
    couplePlans: {
      ...(base.couplePlans ?? {}),
      ...(override.couplePlans ?? {}),
    },
    professionalPlans: {
      planner: {
        ...(base.professionalPlans?.planner ?? {}),
        ...(override.professionalPlans?.planner ?? {}),
      },
      vendor: {
        ...(base.professionalPlans?.vendor ?? {}),
        ...(override.professionalPlans?.vendor ?? {}),
      },
    },
    audiencePlans: {
      ...(base.audiencePlans ?? {}),
      ...(override.audiencePlans ?? {}),
    },
  };
}

const pricingConfigOverrides = parsePricingConfigOverrides();

const defaultCouplePlanDefinitions: CouplePlanDefinition[] = [
  {
    tier: 'free',
    title: 'Intimate',
    annualPriceKes: null,
    monthlyPriceKes: null,
    bundleType: 'couple_plan',
    bundleCode: null,
    checkoutMonthlyLookupKey: null,
    checkoutAnnualLookupKey: null,
  },
  {
    tier: 'collaborative',
    title: 'Collaborative',
    annualPriceKes: 15000,
    monthlyPriceKes: 1999,
    bundleType: 'couple_plan',
    bundleCode: 'couple_collaborative_annual',
    checkoutMonthlyLookupKey: 'couple_collaborative_monthly',
    checkoutAnnualLookupKey: 'couple_collaborative_annual',
  },
];

export const coupleEntitlementKeys = [
  'wedding_collaboration',
  'planner_collaboration',
  'vendor_collaboration',
  'committee_collaboration',
  'family_collaboration',
  'timeline_management',
  'ai_wedding_assistant',
  'gift_registry',
  'guest_rsvp_management',
] as const;

export type CoupleEntitlementKey = (typeof coupleEntitlementKeys)[number];

export const couplePlanEntitlementMap: Record<Exclude<CouplePlanTier, 'free'>, CoupleEntitlementKey[]> = {
  collaborative: [
    'wedding_collaboration',
    'planner_collaboration',
    'vendor_collaboration',
  ],
};

export const couplePlanSeatLimits: Record<CouplePlanTier, { committee: number; family: number }> = {
  free: { committee: 0, family: 0 },
  collaborative: { committee: 20, family: 20 },
};

export const professionalEntitlementKeys = [
  'directory_listing',
  'verified_listing',
  'booking_management',
  'invoicing',
  'contract_management',
  'public_reputation',
  'media_portfolio',
  'advertising',
  'team_workspace',
] as const;

export type ProfessionalEntitlementKey = (typeof professionalEntitlementKeys)[number];

const defaultProfessionalPlanDefinitions: ProfessionalPlanDefinition[] = [
  {
    audience: 'planner',
    tier: 'free',
    title: 'Free',
    annualPriceKes: null,
    monthlyPriceKes: null,
    bundleType: 'professional_plan',
    bundleCode: null,
    checkoutMonthlyLookupKey: null,
    checkoutAnnualLookupKey: null,
  },
  {
    audience: 'planner',
    tier: 'premium',
    title: 'Professional',
    annualPriceKes: 9000,
    monthlyPriceKes: 1000,
    bundleType: 'professional_plan',
    bundleCode: 'planner_premium_annual',
    checkoutMonthlyLookupKey: 'planner_premium_monthly',
    checkoutAnnualLookupKey: 'planner_premium_annual',
  },
  {
    audience: 'vendor',
    tier: 'free',
    title: 'Free',
    annualPriceKes: null,
    monthlyPriceKes: null,
    bundleType: 'professional_plan',
    bundleCode: null,
    checkoutMonthlyLookupKey: null,
    checkoutAnnualLookupKey: null,
  },
  {
    audience: 'vendor',
    tier: 'premium',
    title: 'Professional',
    annualPriceKes: 9000,
    monthlyPriceKes: 1000,
    bundleType: 'professional_plan',
    bundleCode: 'vendor_premium_annual',
    checkoutMonthlyLookupKey: 'vendor_premium_monthly',
    checkoutAnnualLookupKey: 'vendor_premium_annual',
  },
];

export const professionalPlanEntitlementMap: Record<Exclude<ProfessionalPlanTier, 'free'>, ProfessionalEntitlementKey[]> = {
  premium: ['booking_management', 'invoicing', 'contract_management', 'media_portfolio'],
};

const defaultAudiencePlans: AudiencePlan[] = [
  {
    audience: 'couple',
    title: 'Couples',
    freeTierName: 'Intimate',
    paidTierName: 'Collaborative',
    billingCadence: 'monthly_or_annual',
    displayOneTimePriceKes: null,
    displayMonthlyPriceKes: 1999,
    displayAnnualPriceKes: 15000,
    entitlementCode: 'couple_collaborative',
    billingProductKey: 'couple_collaborative',
    checkoutMonthlyLookupKey: 'couple_collaborative_monthly',
    checkoutAnnualLookupKey: 'couple_collaborative_annual',
    checkoutOneTimeLookupKey: null,
    successPath: '/budget?upgrade=success',
    cancelPath: '/pricing?upgrade=cancelled',
  },
  {
    audience: 'committee',
    title: 'Wedding Committees',
    freeTierName: 'Explore',
    paidTierName: 'Committee Pass',
    billingCadence: 'one_time',
    displayOneTimePriceKes: 5000,
    displayMonthlyPriceKes: null,
    displayAnnualPriceKes: null,
    entitlementCode: 'committee_pass',
    billingProductKey: 'committee_pass',
    checkoutMonthlyLookupKey: null,
    checkoutAnnualLookupKey: null,
    checkoutOneTimeLookupKey: 'committee_pass_one_time',
    successPath: '/dashboard?upgrade=success',
    cancelPath: '/pricing?upgrade=cancelled',
  },
  {
    audience: 'planner',
    title: 'Professional Planners',
    freeTierName: 'Free',
    paidTierName: 'Professional',
    billingCadence: 'monthly_or_annual',
    displayOneTimePriceKes: null,
    displayMonthlyPriceKes: 1000,
    displayAnnualPriceKes: 9000,
    entitlementCode: 'booking_management',
    billingProductKey: 'planner_premium',
    checkoutMonthlyLookupKey: 'planner_premium_monthly',
    checkoutAnnualLookupKey: 'planner_premium_annual',
    checkoutOneTimeLookupKey: null,
    successPath: '/pricing?upgrade=success&professionalAudience=planner&professionalPlan=premium',
    cancelPath: '/pricing?upgrade=cancelled',
  },
  {
    audience: 'vendor',
    title: 'Vendors',
    freeTierName: 'Free',
    paidTierName: 'Professional',
    billingCadence: 'monthly_or_annual',
    displayOneTimePriceKes: null,
    displayMonthlyPriceKes: 1000,
    displayAnnualPriceKes: 9000,
    entitlementCode: 'booking_management',
    billingProductKey: 'vendor_premium',
    checkoutMonthlyLookupKey: 'vendor_premium_monthly',
    checkoutAnnualLookupKey: 'vendor_premium_annual',
    checkoutOneTimeLookupKey: null,
    successPath: '/pricing?upgrade=success&professionalAudience=vendor&professionalPlan=premium',
    cancelPath: '/pricing?upgrade=cancelled',
  },
];

function buildResolvedPricingCatalog(overrides: PricingConfigOverrides) {
  return {
    couplePlans: defaultCouplePlanDefinitions.map((plan) => applyOverride(plan, overrides.couplePlans?.[plan.tier])),
    professionalPlans: defaultProfessionalPlanDefinitions.map((plan) =>
      applyOverride(plan, overrides.professionalPlans?.[plan.audience]?.[plan.tier]),
    ),
    audiencePlans: defaultAudiencePlans.map((plan) => applyOverride(plan, overrides.audiencePlans?.[plan.audience])),
  };
}

function replaceArrayContents<T>(target: T[], next: T[]) {
  target.splice(0, target.length, ...next);
}

function applyPricingConfig(overrides: PricingConfigOverrides) {
  const resolved = buildResolvedPricingCatalog(overrides);
  replaceArrayContents(couplePlanDefinitions, resolved.couplePlans);
  replaceArrayContents(professionalPlanDefinitions, resolved.professionalPlans);
  replaceArrayContents(audiencePlans, resolved.audiencePlans);
}

const initialResolvedPricingCatalog = buildResolvedPricingCatalog(pricingConfigOverrides);

export const couplePlanDefinitions: CouplePlanDefinition[] = [...initialResolvedPricingCatalog.couplePlans];
export const professionalPlanDefinitions: ProfessionalPlanDefinition[] = [...initialResolvedPricingCatalog.professionalPlans];
export const audiencePlans: AudiencePlan[] = [...initialResolvedPricingCatalog.audiencePlans];

export function hydratePricingCatalog(overrides: PricingConfigOverrides | null | undefined) {
  if (!overrides) return;
  applyPricingConfig(mergePricingConfigOverrides(normalizePricingConfigOverridesShape(overrides), pricingConfigOverrides));
}

export function getAudiencePlan(audience: PricingAudience) {
  return audiencePlans.find((plan) => plan.audience === audience)!;
}

export function getAvailableCheckoutCadences(plan: AudiencePlan): PricingCheckoutCadence[] {
  switch (plan.billingCadence) {
    case 'one_time':
      return ['one_time'];
    case 'monthly':
      return ['monthly'];
    case 'annual':
      return ['annual'];
    case 'monthly_or_annual':
      return ['monthly', 'annual'];
    default:
      return ['one_time'];
  }
}

export function getCouplePlanDefinition(tier: CouplePlanTier) {
  return couplePlanDefinitions.find((plan) => plan.tier === tier)!;
}

export function getProfessionalPlanDefinition(audience: ProfessionalAudience, tier: ProfessionalPlanTier) {
  return professionalPlanDefinitions.find((plan) => plan.audience === audience && plan.tier === tier)!;
}

export function getLookupKeyForCadence(
  plan: AudiencePlan,
  cadence: PricingCheckoutCadence,
  overrides?: Partial<Record<'one_time' | 'monthly' | 'annual', string | null>>,
) {
  if (cadence === 'one_time') return overrides?.one_time ?? plan.checkoutOneTimeLookupKey;
  if (cadence === 'monthly') return overrides?.monthly ?? plan.checkoutMonthlyLookupKey;
  return overrides?.annual ?? plan.checkoutAnnualLookupKey;
}

export function getDisplayPriceForCadence(plan: AudiencePlan, cadence: PricingCheckoutCadence) {
  if (cadence === 'one_time') return plan.displayOneTimePriceKes;
  if (cadence === 'monthly') return plan.displayMonthlyPriceKes;
  return plan.displayAnnualPriceKes;
}

export function formatEntitlementFeatureLabel(feature?: string | null) {
  if (!feature) return null;

  const knownLabels: Record<string, string> = {
    'couple.connect_vendors': 'connect with vendors',
    'couple.connect_planners': 'connect with planners',
    'couple.ai_assistant': 'unlock the AI wedding assistant',
    'couple.calendar_sync': 'sync your wedding schedule',
    'couple.export_progress': 'export your planning progress',
    'committee.ai_assistant': 'unlock the AI committee assistant',
    'committee.connect_vendors': 'connect with vendors',
    'committee.connect_couples': 'unlock full committee coordination',
    'committee.calendar_sync': 'sync committee schedules',
    'committee.export_progress': 'export committee progress',
    'planner.ai_assistant': 'unlock the AI planner assistant',
    'planner.additional_weddings': 'add another active wedding',
    'planner.vendor_outreach': 'reach out to vendors',
    'planner.calendar_sync': 'sync planner schedules',
    'planner.full_workspace': 'unlock the full planner workspace',
    'planner.export_progress': 'export client progress',
    'vendor.ai_assistant': 'unlock the AI vendor assistant',
    'vendor.direct_leads': 'receive direct leads',
    'vendor.analytics': 'unlock vendor analytics',
  };

  if (knownLabels[feature]) return knownLabels[feature];

  return feature
    .replace(/^[^.]+\./, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildPricingHref(audience: PricingAudience, feature?: string) {
  const plan = getAudiencePlan(audience);
  const params = new URLSearchParams({
    audience,
    plan: plan.entitlementCode,
  });

  if (feature) params.set('feature', feature);
  if (plan.checkoutOneTimeLookupKey) params.set('oneTimeLookupKey', plan.checkoutOneTimeLookupKey);
  if (plan.checkoutMonthlyLookupKey) params.set('monthlyLookupKey', plan.checkoutMonthlyLookupKey);
  if (plan.checkoutAnnualLookupKey) params.set('annualLookupKey', plan.checkoutAnnualLookupKey);
  params.set('successPath', plan.successPath);
  params.set('cancelPath', plan.cancelPath);

  return `/pricing?${params.toString()}`;
}
