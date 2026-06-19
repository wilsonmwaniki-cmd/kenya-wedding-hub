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
