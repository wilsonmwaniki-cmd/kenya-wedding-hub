export type PricingAudience = 'couple' | 'committee' | 'planner' | 'vendor';
export type AccessLevel = 'free' | 'paid';
export type PricingCheckoutCadence = 'one_time' | 'monthly' | 'annual';
export type CouplePlanTier = 'free' | 'basic' | 'premium';
export type CouplePlanCadence = 'monthly' | 'annual';
export type CoupleAddonCode = 'gift_registry_addon' | 'guest_rsvp_management_addon';
export type ProfessionalAudience = 'planner' | 'vendor';
export type ProfessionalPlanTier = 'free' | 'premium';
export type ProfessionalPlanCadence = 'monthly' | 'annual';
export type ProfessionalAddonCode =
  | 'media_addon'
  | 'advertising_addon'
  | 'team_workspace_bundle_3'
  | 'team_workspace_bundle_5'
  | 'team_workspace_bundle_10';

export type CouplePlanDefinition = {
  tier: CouplePlanTier;
  title: string;
  annualPriceKes: number | null;
  monthlyPriceKes: number | null;
  bundleType: 'couple_plan';
  bundleCode: string | null;
  stripeMonthlyLookupKey: string | null;
  stripeAnnualLookupKey: string | null;
};

export type CoupleAddonDefinition = {
  code: CoupleAddonCode;
  title: string;
  bundleType: 'wedding_addon';
  bundleCode: CoupleAddonCode;
  stripeMonthlyLookupKey: string | null;
  stripeAnnualLookupKey: string | null;
};

export type ProfessionalPlanDefinition = {
  audience: ProfessionalAudience;
  tier: ProfessionalPlanTier;
  title: string;
  annualPriceKes: number | null;
  monthlyPriceKes: number | null;
  bundleType: 'professional_plan';
  bundleCode: string | null;
  stripeMonthlyLookupKey: string | null;
  stripeAnnualLookupKey: string | null;
};

export type ProfessionalAddonDefinition = {
  audience: ProfessionalAudience | 'shared';
  code: ProfessionalAddonCode;
  title: string;
  bundleType: 'professional_addon';
  bundleCode: ProfessionalAddonCode;
  stripeMonthlyLookupKey: string | null;
  stripeAnnualLookupKey: string | null;
  seatLimit: number | null;
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
  stripeProductKey: string;
  stripeMonthlyLookupKey: string | null;
  stripeAnnualLookupKey: string | null;
  stripeOneTimeLookupKey: string | null;
  successPath: string;
  cancelPath: string;
};

type PricingConfigOverrides = {
  couplePlans?: Partial<Record<CouplePlanTier, Partial<CouplePlanDefinition>>>;
  coupleAddons?: Partial<Record<CoupleAddonCode, Partial<CoupleAddonDefinition>>>;
  professionalPlans?: Partial<
    Record<ProfessionalAudience, Partial<Record<ProfessionalPlanTier, Partial<ProfessionalPlanDefinition>>>>
  >;
  professionalAddons?: Partial<Record<ProfessionalAddonCode, Partial<ProfessionalAddonDefinition>>>;
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
    return parsed as PricingConfigOverrides;
  } catch (error) {
    console.warn('Could not parse VITE_PRICING_CONFIG_JSON. Falling back to default pricing config.', error);
    return {};
  }
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
    coupleAddons: {
      ...(base.coupleAddons ?? {}),
      ...(override.coupleAddons ?? {}),
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
    professionalAddons: {
      ...(base.professionalAddons ?? {}),
      ...(override.professionalAddons ?? {}),
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
    title: 'Free',
    annualPriceKes: null,
    monthlyPriceKes: null,
    bundleType: 'couple_plan',
    bundleCode: null,
    stripeMonthlyLookupKey: null,
    stripeAnnualLookupKey: null,
  },
  {
    tier: 'basic',
    title: 'Basic',
    annualPriceKes: 5000,
    monthlyPriceKes: 750,
    bundleType: 'couple_plan',
    bundleCode: 'couple_basic_annual',
    stripeMonthlyLookupKey: 'couple_basic_monthly',
    stripeAnnualLookupKey: 'couple_basic_annual',
  },
  {
    tier: 'premium',
    title: 'Premium',
    annualPriceKes: 15000,
    monthlyPriceKes: 2000,
    bundleType: 'couple_plan',
    bundleCode: 'couple_premium_annual',
    stripeMonthlyLookupKey: 'couple_premium_monthly',
    stripeAnnualLookupKey: 'couple_premium_annual',
  },
];

const defaultCoupleAddonDefinitions: CoupleAddonDefinition[] = [
  {
    code: 'gift_registry_addon',
    title: 'Gift Registry',
    bundleType: 'wedding_addon',
    bundleCode: 'gift_registry_addon',
    stripeMonthlyLookupKey: 'gift_registry_addon',
    stripeAnnualLookupKey: null,
  },
  {
    code: 'guest_rsvp_management_addon',
    title: 'Guest RSVP & Management',
    bundleType: 'wedding_addon',
    bundleCode: 'guest_rsvp_management_addon',
    stripeMonthlyLookupKey: 'guest_rsvp_management_addon',
    stripeAnnualLookupKey: null,
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
  basic: [
    'wedding_collaboration',
    'planner_collaboration',
    'vendor_collaboration',
    'committee_collaboration',
    'family_collaboration',
  ],
  premium: [
    'wedding_collaboration',
    'planner_collaboration',
    'vendor_collaboration',
    'committee_collaboration',
    'family_collaboration',
    'timeline_management',
    'ai_wedding_assistant',
  ],
};

export const couplePlanSeatLimits: Record<CouplePlanTier, { committee: number; family: number }> = {
  free: { committee: 0, family: 0 },
  basic: { committee: 10, family: 10 },
  premium: { committee: 20, family: 20 },
};

export const coupleAddonEntitlementMap: Record<CoupleAddonCode, CoupleEntitlementKey> = {
  gift_registry_addon: 'gift_registry',
  guest_rsvp_management_addon: 'guest_rsvp_management',
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
    stripeMonthlyLookupKey: null,
    stripeAnnualLookupKey: null,
  },
  {
    audience: 'planner',
    tier: 'premium',
    title: 'Premium',
    annualPriceKes: 9000,
    monthlyPriceKes: 1000,
    bundleType: 'professional_plan',
    bundleCode: 'planner_premium_annual',
    stripeMonthlyLookupKey: 'planner_premium_monthly',
    stripeAnnualLookupKey: 'planner_premium_annual',
  },
  {
    audience: 'vendor',
    tier: 'free',
    title: 'Free',
    annualPriceKes: null,
    monthlyPriceKes: null,
    bundleType: 'professional_plan',
    bundleCode: null,
    stripeMonthlyLookupKey: null,
    stripeAnnualLookupKey: null,
  },
  {
    audience: 'vendor',
    tier: 'premium',
    title: 'Premium',
    annualPriceKes: 9000,
    monthlyPriceKes: 1000,
    bundleType: 'professional_plan',
    bundleCode: 'vendor_premium_annual',
    stripeMonthlyLookupKey: 'vendor_premium_monthly',
    stripeAnnualLookupKey: 'vendor_premium_annual',
  },
];

const defaultProfessionalAddonDefinitions: ProfessionalAddonDefinition[] = [
  {
    audience: 'shared',
    code: 'media_addon',
    title: 'Media',
    bundleType: 'professional_addon',
    bundleCode: 'media_addon',
    stripeMonthlyLookupKey: 'media_addon',
    stripeAnnualLookupKey: null,
    seatLimit: null,
  },
  {
    audience: 'shared',
    code: 'advertising_addon',
    title: 'Advertising',
    bundleType: 'professional_addon',
    bundleCode: 'advertising_addon',
    stripeMonthlyLookupKey: 'advertising_addon',
    stripeAnnualLookupKey: null,
    seatLimit: null,
  },
  {
    audience: 'shared',
    code: 'team_workspace_bundle_3',
    title: 'Team Workspace',
    bundleType: 'professional_addon',
    bundleCode: 'team_workspace_bundle_3',
    stripeMonthlyLookupKey: 'team_workspace_bundle_3',
    stripeAnnualLookupKey: null,
    seatLimit: 3,
  },
  {
    audience: 'shared',
    code: 'team_workspace_bundle_5',
    title: 'Team Workspace',
    bundleType: 'professional_addon',
    bundleCode: 'team_workspace_bundle_5',
    stripeMonthlyLookupKey: 'team_workspace_bundle_5',
    stripeAnnualLookupKey: null,
    seatLimit: 5,
  },
  {
    audience: 'shared',
    code: 'team_workspace_bundle_10',
    title: 'Team Workspace',
    bundleType: 'professional_addon',
    bundleCode: 'team_workspace_bundle_10',
    stripeMonthlyLookupKey: 'team_workspace_bundle_10',
    stripeAnnualLookupKey: null,
    seatLimit: 10,
  },
];

export const professionalPlanEntitlementMap: Record<Exclude<ProfessionalPlanTier, 'free'>, ProfessionalEntitlementKey[]> = {
  premium: ['directory_listing', 'booking_management', 'invoicing', 'contract_management', 'public_reputation'],
};

export const professionalAddonEntitlementMap: Record<ProfessionalAddonCode, ProfessionalEntitlementKey> = {
  media_addon: 'media_portfolio',
  advertising_addon: 'advertising',
  team_workspace_bundle_3: 'team_workspace',
  team_workspace_bundle_5: 'team_workspace',
  team_workspace_bundle_10: 'team_workspace',
};

export const professionalAddonSeatLimits: Partial<Record<ProfessionalAddonCode, number>> = {
  team_workspace_bundle_3: 3,
  team_workspace_bundle_5: 5,
  team_workspace_bundle_10: 10,
};

const defaultAudiencePlans: AudiencePlan[] = [
  {
    audience: 'couple',
    title: 'Couples',
    freeTierName: 'Explore',
    paidTierName: 'Wedding Plan',
    billingCadence: 'one_time',
    displayOneTimePriceKes: 15000,
    displayMonthlyPriceKes: null,
    displayAnnualPriceKes: null,
    entitlementCode: 'planning_pass',
    stripeProductKey: 'planning_pass',
    stripeMonthlyLookupKey: null,
    stripeAnnualLookupKey: null,
    stripeOneTimeLookupKey: 'planning_pass_one_time',
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
    stripeProductKey: 'committee_pass',
    stripeMonthlyLookupKey: null,
    stripeAnnualLookupKey: null,
    stripeOneTimeLookupKey: 'committee_pass_one_time',
    successPath: '/dashboard?upgrade=success',
    cancelPath: '/pricing?upgrade=cancelled',
  },
  {
    audience: 'planner',
    title: 'Professional Planners',
    freeTierName: 'Free',
    paidTierName: 'Premium',
    billingCadence: 'monthly_or_annual',
    displayOneTimePriceKes: null,
    displayMonthlyPriceKes: 1000,
    displayAnnualPriceKes: 9000,
    entitlementCode: 'booking_management',
    stripeProductKey: 'planner_premium',
    stripeMonthlyLookupKey: 'planner_premium_monthly',
    stripeAnnualLookupKey: 'planner_premium_annual',
    stripeOneTimeLookupKey: null,
    successPath: '/clients?upgrade=success',
    cancelPath: '/pricing?upgrade=cancelled',
  },
  {
    audience: 'vendor',
    title: 'Vendors',
    freeTierName: 'Free',
    paidTierName: 'Premium',
    billingCadence: 'monthly_or_annual',
    displayOneTimePriceKes: null,
    displayMonthlyPriceKes: 1000,
    displayAnnualPriceKes: 9000,
    entitlementCode: 'booking_management',
    stripeProductKey: 'vendor_premium',
    stripeMonthlyLookupKey: 'vendor_premium_monthly',
    stripeAnnualLookupKey: 'vendor_premium_annual',
    stripeOneTimeLookupKey: null,
    successPath: '/vendor-dashboard?upgrade=success',
    cancelPath: '/pricing?upgrade=cancelled',
  },
];

function buildResolvedPricingCatalog(overrides: PricingConfigOverrides) {
  return {
    couplePlans: defaultCouplePlanDefinitions.map((plan) => applyOverride(plan, overrides.couplePlans?.[plan.tier])),
    coupleAddons: defaultCoupleAddonDefinitions.map((addon) => applyOverride(addon, overrides.coupleAddons?.[addon.code])),
    professionalPlans: defaultProfessionalPlanDefinitions.map((plan) =>
      applyOverride(plan, overrides.professionalPlans?.[plan.audience]?.[plan.tier]),
    ),
    professionalAddons: defaultProfessionalAddonDefinitions.map((addon) =>
      applyOverride(addon, overrides.professionalAddons?.[addon.code]),
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
  replaceArrayContents(coupleAddonDefinitions, resolved.coupleAddons);
  replaceArrayContents(professionalPlanDefinitions, resolved.professionalPlans);
  replaceArrayContents(professionalAddonDefinitions, resolved.professionalAddons);
  replaceArrayContents(audiencePlans, resolved.audiencePlans);
}

const initialResolvedPricingCatalog = buildResolvedPricingCatalog(pricingConfigOverrides);

export const couplePlanDefinitions: CouplePlanDefinition[] = [...initialResolvedPricingCatalog.couplePlans];
export const coupleAddonDefinitions: CoupleAddonDefinition[] = [...initialResolvedPricingCatalog.coupleAddons];
export const professionalPlanDefinitions: ProfessionalPlanDefinition[] = [...initialResolvedPricingCatalog.professionalPlans];
export const professionalAddonDefinitions: ProfessionalAddonDefinition[] = [...initialResolvedPricingCatalog.professionalAddons];
export const audiencePlans: AudiencePlan[] = [...initialResolvedPricingCatalog.audiencePlans];

export function hydratePricingCatalog(overrides: PricingConfigOverrides | null | undefined) {
  if (!overrides) return;
  applyPricingConfig(mergePricingConfigOverrides(overrides, pricingConfigOverrides));
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

export function getCoupleAddonDefinition(code: CoupleAddonCode) {
  return coupleAddonDefinitions.find((addon) => addon.code === code)!;
}

export function getProfessionalPlanDefinition(audience: ProfessionalAudience, tier: ProfessionalPlanTier) {
  return professionalPlanDefinitions.find((plan) => plan.audience === audience && plan.tier === tier)!;
}

export function getProfessionalAddonDefinition(code: ProfessionalAddonCode) {
  return professionalAddonDefinitions.find((addon) => addon.code === code)!;
}

export function getLookupKeyForCadence(
  plan: AudiencePlan,
  cadence: PricingCheckoutCadence,
  overrides?: Partial<Record<'one_time' | 'monthly' | 'annual', string | null>>,
) {
  if (cadence === 'one_time') return overrides?.one_time ?? plan.stripeOneTimeLookupKey;
  if (cadence === 'monthly') return overrides?.monthly ?? plan.stripeMonthlyLookupKey;
  return overrides?.annual ?? plan.stripeAnnualLookupKey;
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
  if (plan.stripeOneTimeLookupKey) params.set('oneTimeLookupKey', plan.stripeOneTimeLookupKey);
  if (plan.stripeMonthlyLookupKey) params.set('monthlyLookupKey', plan.stripeMonthlyLookupKey);
  if (plan.stripeAnnualLookupKey) params.set('annualLookupKey', plan.stripeAnnualLookupKey);
  params.set('successPath', plan.successPath);
  params.set('cancelPath', plan.cancelPath);

  return `/pricing?${params.toString()}`;
}
