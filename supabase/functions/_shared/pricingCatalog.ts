type CouplePlanTier = 'basic' | 'premium';
type CoupleBundleType = 'wedding_pass' | 'registry_addon' | 'guest_rsvp_addon';
type ProfessionalFeatureKey = 'media_portfolio' | 'advertising' | 'team_workspace';

export type CoupleCheckoutMapping = {
  bundleCode: string;
  bundleType: CoupleBundleType;
  features: string[];
  couplePlanTier: CouplePlanTier | null;
  seatLimits: { committee: number; family: number } | null;
  syncLegacyPlanningPass: boolean;
};

export type ProfessionalCheckoutMapping = {
  features: ProfessionalFeatureKey[];
  seatLimit?: number;
};

type PricingCatalogCheckoutOverrides = {
  allowedLookupKeys?: string[];
  coupleCheckoutMap?: Record<string, Partial<CoupleCheckoutMapping>>;
  professionalCheckoutMap?: Record<string, Partial<ProfessionalCheckoutMapping>>;
};

export type PricingCatalogCheckoutConfig = {
  allowedLookupKeys: string[];
  coupleCheckoutMap: Record<string, CoupleCheckoutMapping>;
  professionalCheckoutMap: Record<string, ProfessionalCheckoutMapping>;
};

export type PricingPaymentCatalogItem = {
  title: string;
  amountKes: number | null;
  audience: 'couple' | 'planner' | 'vendor';
  cadence: 'one_time' | 'monthly' | 'annual';
  feature: string | null;
};

const defaultPaymentCatalog: Record<string, PricingPaymentCatalogItem> = {
  planning_pass_one_time: {
    title: 'Planning Pass',
    amountKes: null,
    audience: 'couple',
    cadence: 'one_time',
    feature: null,
  },
  couple_basic_monthly: {
    title: 'Couple Basic',
    amountKes: 750,
    audience: 'couple',
    cadence: 'monthly',
    feature: null,
  },
  couple_basic_annual: {
    title: 'Couple Basic',
    amountKes: 5000,
    audience: 'couple',
    cadence: 'annual',
    feature: null,
  },
  couple_premium_monthly: {
    title: 'Couple Premium',
    amountKes: 2000,
    audience: 'couple',
    cadence: 'monthly',
    feature: null,
  },
  couple_premium_annual: {
    title: 'Couple Premium',
    amountKes: 15000,
    audience: 'couple',
    cadence: 'annual',
    feature: null,
  },
  gift_registry_addon: {
    title: 'Gift Registry',
    amountKes: null,
    audience: 'couple',
    cadence: 'monthly',
    feature: 'gift_registry',
  },
  guest_rsvp_management_addon: {
    title: 'Guest RSVP & Management',
    amountKes: null,
    audience: 'couple',
    cadence: 'monthly',
    feature: 'guest_rsvp_management',
  },
  media_addon: {
    title: 'Media Add-on',
    amountKes: null,
    audience: 'planner',
    cadence: 'monthly',
    feature: 'media_portfolio',
  },
  advertising_addon: {
    title: 'Advertising Add-on',
    amountKes: null,
    audience: 'planner',
    cadence: 'monthly',
    feature: 'advertising',
  },
  team_workspace_bundle_3: {
    title: 'Team Workspace Bundle (3)',
    amountKes: null,
    audience: 'planner',
    cadence: 'monthly',
    feature: 'team_workspace',
  },
  team_workspace_bundle_5: {
    title: 'Team Workspace Bundle (5)',
    amountKes: null,
    audience: 'planner',
    cadence: 'monthly',
    feature: 'team_workspace',
  },
  team_workspace_bundle_10: {
    title: 'Team Workspace Bundle (10)',
    amountKes: null,
    audience: 'planner',
    cadence: 'monthly',
    feature: 'team_workspace',
  },
};

const defaultAllowedLookupKeys = [
  'planning_pass_one_time',
  'committee_pass_one_time',
  'planner_pro_monthly',
  'planner_pro_annual',
  'planner_premium_monthly',
  'planner_premium_annual',
  'vendor_pro_monthly',
  'vendor_pro_annual',
  'vendor_premium_monthly',
  'vendor_premium_annual',
  'couple_basic_monthly',
  'couple_basic_annual',
  'couple_premium_monthly',
  'couple_premium_annual',
  'gift_registry_addon',
  'guest_rsvp_management_addon',
  'media_addon',
  'advertising_addon',
  'team_workspace_bundle_3',
  'team_workspace_bundle_5',
  'team_workspace_bundle_10',
];

const defaultCoupleCheckoutMap: Record<string, CoupleCheckoutMapping> = {
  planning_pass_one_time: {
    bundleCode: 'planning_pass_one_time',
    bundleType: 'wedding_pass',
    features: [
      'wedding_collaboration',
      'planner_collaboration',
      'vendor_collaboration',
      'committee_collaboration',
      'family_collaboration',
      'timeline_management',
      'ai_wedding_assistant',
    ],
    couplePlanTier: 'premium',
    seatLimits: { committee: 20, family: 20 },
    syncLegacyPlanningPass: true,
  },
  couple_basic_monthly: {
    bundleCode: 'couple_basic_monthly',
    bundleType: 'wedding_pass',
    features: [
      'wedding_collaboration',
      'planner_collaboration',
      'vendor_collaboration',
      'committee_collaboration',
      'family_collaboration',
    ],
    couplePlanTier: 'basic',
    seatLimits: { committee: 10, family: 10 },
    syncLegacyPlanningPass: false,
  },
  couple_basic_annual: {
    bundleCode: 'couple_basic_annual',
    bundleType: 'wedding_pass',
    features: [
      'wedding_collaboration',
      'planner_collaboration',
      'vendor_collaboration',
      'committee_collaboration',
      'family_collaboration',
    ],
    couplePlanTier: 'basic',
    seatLimits: { committee: 10, family: 10 },
    syncLegacyPlanningPass: false,
  },
  couple_premium_monthly: {
    bundleCode: 'couple_premium_monthly',
    bundleType: 'wedding_pass',
    features: [
      'wedding_collaboration',
      'planner_collaboration',
      'vendor_collaboration',
      'committee_collaboration',
      'family_collaboration',
      'timeline_management',
      'ai_wedding_assistant',
    ],
    couplePlanTier: 'premium',
    seatLimits: { committee: 20, family: 20 },
    syncLegacyPlanningPass: true,
  },
  couple_premium_annual: {
    bundleCode: 'couple_premium_annual',
    bundleType: 'wedding_pass',
    features: [
      'wedding_collaboration',
      'planner_collaboration',
      'vendor_collaboration',
      'committee_collaboration',
      'family_collaboration',
      'timeline_management',
      'ai_wedding_assistant',
    ],
    couplePlanTier: 'premium',
    seatLimits: { committee: 20, family: 20 },
    syncLegacyPlanningPass: true,
  },
  gift_registry_addon: {
    bundleCode: 'gift_registry_addon',
    bundleType: 'registry_addon',
    features: ['gift_registry'],
    couplePlanTier: null,
    seatLimits: null,
    syncLegacyPlanningPass: false,
  },
  guest_rsvp_management_addon: {
    bundleCode: 'guest_rsvp_management_addon',
    bundleType: 'guest_rsvp_addon',
    features: ['guest_rsvp_management'],
    couplePlanTier: null,
    seatLimits: null,
    syncLegacyPlanningPass: false,
  },
};

const defaultProfessionalCheckoutMap: Record<string, ProfessionalCheckoutMapping> = {
  media_addon: {
    features: ['media_portfolio'],
  },
  advertising_addon: {
    features: ['advertising'],
  },
  team_workspace_bundle_3: {
    features: ['team_workspace'],
    seatLimit: 3,
  },
  team_workspace_bundle_5: {
    features: ['team_workspace'],
    seatLimit: 5,
  },
  team_workspace_bundle_10: {
    features: ['team_workspace'],
    seatLimit: 10,
  },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeCoupleCheckoutMap(
  overrides?: Record<string, Partial<CoupleCheckoutMapping>>,
): Record<string, CoupleCheckoutMapping> {
  const merged: Record<string, CoupleCheckoutMapping> = { ...defaultCoupleCheckoutMap };

  for (const [lookupKey, base] of Object.entries(defaultCoupleCheckoutMap)) {
    const override = overrides?.[lookupKey];
    if (!override) continue;
    merged[lookupKey] = {
      ...base,
      ...override,
      features: Array.isArray(override.features) ? override.features : base.features,
      seatLimits:
        isObject(override.seatLimits)
          && typeof override.seatLimits.committee === 'number'
          && typeof override.seatLimits.family === 'number'
          ? {
              committee: override.seatLimits.committee,
              family: override.seatLimits.family,
            }
          : base.seatLimits,
    };
  }

  if (!overrides) return merged;

  for (const [lookupKey, override] of Object.entries(overrides)) {
    if (merged[lookupKey] || !override.bundleCode || !override.bundleType) continue;
    merged[lookupKey] = {
      bundleCode: override.bundleCode,
      bundleType: override.bundleType,
      features: Array.isArray(override.features) ? override.features : [],
      couplePlanTier: override.couplePlanTier ?? null,
      seatLimits:
        isObject(override.seatLimits)
          && typeof override.seatLimits.committee === 'number'
          && typeof override.seatLimits.family === 'number'
          ? {
              committee: override.seatLimits.committee,
              family: override.seatLimits.family,
            }
          : null,
      syncLegacyPlanningPass: override.syncLegacyPlanningPass === true,
    };
  }

  return merged;
}

function mergeProfessionalCheckoutMap(
  overrides?: Record<string, Partial<ProfessionalCheckoutMapping>>,
): Record<string, ProfessionalCheckoutMapping> {
  const merged: Record<string, ProfessionalCheckoutMapping> = { ...defaultProfessionalCheckoutMap };

  for (const [lookupKey, base] of Object.entries(defaultProfessionalCheckoutMap)) {
    const override = overrides?.[lookupKey];
    if (!override) continue;
    merged[lookupKey] = {
      ...base,
      ...override,
      features: Array.isArray(override.features) ? override.features as ProfessionalFeatureKey[] : base.features,
    };
  }

  if (!overrides) return merged;

  for (const [lookupKey, override] of Object.entries(overrides)) {
    if (merged[lookupKey] || !Array.isArray(override.features)) continue;
    merged[lookupKey] = {
      features: override.features as ProfessionalFeatureKey[],
      seatLimit: typeof override.seatLimit === 'number' ? override.seatLimit : undefined,
    };
  }

  return merged;
}

function getCheckoutOverrides(config: unknown): PricingCatalogCheckoutOverrides | null {
  if (!isObject(config) || !isObject(config.checkout)) return null;
  return config.checkout as PricingCatalogCheckoutOverrides;
}

function buildConfigFromOverrides(overrides?: PricingCatalogCheckoutOverrides | null): PricingCatalogCheckoutConfig {
  const allowedLookupKeys = Array.isArray(overrides?.allowedLookupKeys)
    ? [...new Set([...defaultAllowedLookupKeys, ...overrides.allowedLookupKeys.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)])]
    : defaultAllowedLookupKeys;

  return {
    allowedLookupKeys,
    coupleCheckoutMap: mergeCoupleCheckoutMap(overrides?.coupleCheckoutMap),
    professionalCheckoutMap: mergeProfessionalCheckoutMap(overrides?.professionalCheckoutMap),
  };
}

export async function loadPricingCheckoutConfig(serviceClient: {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => {
        order: (column: string, options: { ascending: boolean }) => {
          limit: (count: number) => {
            maybeSingle: () => Promise<{ data: { config?: unknown } | null; error: { message?: string } | null }>;
          };
        };
      };
    };
  };
}) {
  try {
    const { data, error } = await serviceClient
      .from('pricing_catalog')
      .select('config')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Could not load pricing checkout config from Supabase. Falling back to defaults.', error.message ?? error);
      return buildConfigFromOverrides(null);
    }

    return buildConfigFromOverrides(getCheckoutOverrides(data?.config));
  } catch (error) {
    console.warn('Unexpected pricing checkout config error. Falling back to defaults.', error);
    return buildConfigFromOverrides(null);
  }
}

function getObject(value: unknown) {
  return isObject(value) ? value : null;
}

function getNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getNullableString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getLookupKey(
  value: Record<string, unknown>,
  primaryKey: string,
  legacyKey: string,
) {
  return getNullableString(value[primaryKey]) ?? getNullableString(value[legacyKey]);
}

function upsertPaymentCatalogItem(
  catalog: Record<string, PricingPaymentCatalogItem>,
  lookupKey: string | null,
  item: PricingPaymentCatalogItem,
) {
  if (!lookupKey) return;
  catalog[lookupKey] = item;
}

export async function loadPricingPaymentCatalog(serviceClient: {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => {
        order: (column: string, options: { ascending: boolean }) => {
          limit: (count: number) => {
            maybeSingle: () => Promise<{ data: { config?: unknown } | null; error: { message?: string } | null }>;
          };
        };
      };
    };
  };
}) {
  const catalog: Record<string, PricingPaymentCatalogItem> = { ...defaultPaymentCatalog };

  try {
    const { data, error } = await serviceClient
      .from('pricing_catalog')
      .select('config')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Could not load pricing payment catalog from Supabase. Falling back to defaults.', error.message ?? error);
      return catalog;
    }

    const config = getObject(data?.config);
    const couplePlans = getObject(config?.couplePlans);
    const coupleAddons = getObject(config?.coupleAddons);
    const professionalPlans = getObject(config?.professionalPlans);
    const professionalAddons = getObject(config?.professionalAddons);

    for (const [tier, value] of Object.entries(couplePlans ?? {})) {
      const plan = getObject(value);
      if (!plan) continue;

      upsertPaymentCatalogItem(catalog, getLookupKey(plan, 'checkoutMonthlyLookupKey', 'stripeMonthlyLookupKey'), {
        title: getNullableString(plan.title) ?? `Couple ${tier}`,
        amountKes: getNullableNumber(plan.monthlyPriceKes),
        audience: 'couple',
        cadence: 'monthly',
        feature: null,
      });

      upsertPaymentCatalogItem(catalog, getLookupKey(plan, 'checkoutAnnualLookupKey', 'stripeAnnualLookupKey'), {
        title: getNullableString(plan.title) ?? `Couple ${tier}`,
        amountKes: getNullableNumber(plan.annualPriceKes),
        audience: 'couple',
        cadence: 'annual',
        feature: null,
      });
    }

    for (const [code, value] of Object.entries(coupleAddons ?? {})) {
      const addon = getObject(value);
      if (!addon) continue;
      upsertPaymentCatalogItem(catalog, getLookupKey(addon, 'checkoutMonthlyLookupKey', 'stripeMonthlyLookupKey'), {
        title: getNullableString(addon.title) ?? code,
        amountKes: getNullableNumber(addon.monthlyPriceKes),
        audience: 'couple',
        cadence: 'monthly',
        feature: code,
      });
    }

    for (const [audience, value] of Object.entries(professionalPlans ?? {})) {
      const plans = getObject(value);
      if (!plans || (audience !== 'planner' && audience !== 'vendor')) continue;

      for (const [tier, planValue] of Object.entries(plans)) {
        const plan = getObject(planValue);
        if (!plan) continue;

        upsertPaymentCatalogItem(catalog, getLookupKey(plan, 'checkoutMonthlyLookupKey', 'stripeMonthlyLookupKey'), {
          title: getNullableString(plan.title) ?? `${audience} ${tier}`,
          amountKes: getNullableNumber(plan.monthlyPriceKes),
          audience,
          cadence: 'monthly',
          feature: null,
        });

        upsertPaymentCatalogItem(catalog, getLookupKey(plan, 'checkoutAnnualLookupKey', 'stripeAnnualLookupKey'), {
          title: getNullableString(plan.title) ?? `${audience} ${tier}`,
          amountKes: getNullableNumber(plan.annualPriceKes),
          audience,
          cadence: 'annual',
          feature: null,
        });
      }
    }

    for (const [code, value] of Object.entries(professionalAddons ?? {})) {
      const addon = getObject(value);
      if (!addon) continue;
      const audience = getNullableString(addon.audience);
      upsertPaymentCatalogItem(catalog, getLookupKey(addon, 'checkoutMonthlyLookupKey', 'stripeMonthlyLookupKey'), {
        title: getNullableString(addon.title) ?? code,
        amountKes: getNullableNumber(addon.monthlyPriceKes),
        audience: audience === 'vendor' ? 'vendor' : 'planner',
        cadence: 'monthly',
        feature: code,
      });
    }

    return catalog;
  } catch (error) {
    console.warn('Unexpected pricing payment catalog error. Falling back to defaults.', error);
    return catalog;
  }
}
