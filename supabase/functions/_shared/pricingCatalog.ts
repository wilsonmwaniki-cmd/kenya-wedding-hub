type CouplePlanTier = 'collaborative';
type CoupleBundleType = 'wedding_pass' | 'registry_addon' | 'guest_rsvp_addon';
type ProfessionalFeatureKey = 'booking_management' | 'document_collaboration' | 'invoicing' | 'contract_management' | 'media_portfolio';

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
  couple_collaborative_monthly: {
    title: 'Couple Collaborative',
    amountKes: 1999,
    audience: 'couple',
    cadence: 'monthly',
    feature: null,
  },
  couple_collaborative_annual: {
    title: 'Couple Collaborative',
    amountKes: 15000,
    audience: 'couple',
    cadence: 'annual',
    feature: null,
  },
  planner_premium_monthly: {
    title: 'Planner Professional',
    amountKes: 1000,
    audience: 'planner',
    cadence: 'monthly',
    feature: 'booking_management',
  },
  planner_premium_annual: {
    title: 'Planner Professional',
    amountKes: 9000,
    audience: 'planner',
    cadence: 'annual',
    feature: 'booking_management',
  },
  vendor_premium_monthly: {
    title: 'Vendor Professional',
    amountKes: 1000,
    audience: 'vendor',
    cadence: 'monthly',
    feature: 'booking_management',
  },
  vendor_premium_annual: {
    title: 'Vendor Professional',
    amountKes: 9000,
    audience: 'vendor',
    cadence: 'annual',
    feature: 'booking_management',
  },
};

const defaultAllowedLookupKeys = [
  'committee_pass_one_time',
  'planner_premium_monthly',
  'planner_premium_annual',
  'vendor_premium_monthly',
  'vendor_premium_annual',
  'couple_collaborative_monthly',
  'couple_collaborative_annual',
];

const defaultCoupleCheckoutMap: Record<string, CoupleCheckoutMapping> = {
  couple_collaborative_monthly: {
    bundleCode: 'couple_collaborative_monthly',
    bundleType: 'wedding_pass',
    features: [
      'wedding_collaboration',
      'planner_collaboration',
      'vendor_collaboration',
    ],
    couplePlanTier: 'collaborative',
    seatLimits: null,
    syncLegacyPlanningPass: false,
  },
  couple_collaborative_annual: {
    bundleCode: 'couple_collaborative_annual',
    bundleType: 'wedding_pass',
    features: [
      'wedding_collaboration',
      'planner_collaboration',
      'vendor_collaboration',
    ],
    couplePlanTier: 'collaborative',
    seatLimits: null,
    syncLegacyPlanningPass: false,
  },
};

const defaultProfessionalCheckoutMap: Record<string, ProfessionalCheckoutMapping> = {
  planner_premium_monthly: {
    features: ['booking_management', 'document_collaboration', 'media_portfolio'],
  },
  planner_premium_annual: {
    features: ['booking_management', 'document_collaboration', 'media_portfolio'],
  },
  vendor_premium_monthly: {
    features: ['booking_management', 'document_collaboration', 'media_portfolio'],
  },
  vendor_premium_annual: {
    features: ['booking_management', 'document_collaboration', 'media_portfolio'],
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

  return merged;
}

function getCheckoutOverrides(config: unknown): PricingCatalogCheckoutOverrides | null {
  if (!isObject(config) || !isObject(config.checkout)) return null;
  return config.checkout as PricingCatalogCheckoutOverrides;
}

function buildConfigFromOverrides(overrides?: PricingCatalogCheckoutOverrides | null): PricingCatalogCheckoutConfig {
  const configuredKeys = Array.isArray(overrides?.allowedLookupKeys)
    ? new Set(overrides.allowedLookupKeys.filter((value): value is string => typeof value === 'string'))
    : null;
  const allowedLookupKeys = configuredKeys
    ? defaultAllowedLookupKeys.filter((lookupKey) => configuredKeys.has(lookupKey))
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
    const professionalPlans = getObject(config?.professionalPlans);

    for (const [tier, value] of Object.entries(couplePlans ?? {})) {
      if (tier !== 'collaborative') continue;
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

    return catalog;
  } catch (error) {
    console.warn('Unexpected pricing payment catalog error. Falling back to defaults.', error);
    return catalog;
  }
}
