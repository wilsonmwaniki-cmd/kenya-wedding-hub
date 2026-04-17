export type PricingAudience = 'couple' | 'committee' | 'planner' | 'vendor';
export type AccessLevel = 'free' | 'paid';
export type PricingCheckoutCadence = 'one_time' | 'monthly' | 'annual';
export type CouplePlanTier = 'free' | 'basic' | 'premium';
export type CouplePlanCadence = 'monthly' | 'annual';
export type CoupleAddonCode = 'gift_registry_addon' | 'guest_rsvp_management_addon';

export type CouplePlanDefinition = {
  tier: CouplePlanTier;
  title: string;
  tagline: string;
  supportCopy: string;
  annualPriceKes: number | null;
  monthlyPriceKes: number | null;
  bundleType: 'couple_plan';
  bundleCode: string | null;
  stripeMonthlyLookupKey: string | null;
  stripeAnnualLookupKey: string | null;
  includedFeatures: string[];
  ctaLabel: string;
};

export type CoupleAddonDefinition = {
  code: CoupleAddonCode;
  title: string;
  supportCopy: string;
  bundleType: 'wedding_addon';
  bundleCode: CoupleAddonCode;
  stripeMonthlyLookupKey: string | null;
  stripeAnnualLookupKey: string | null;
};

export type AudiencePlan = {
  audience: PricingAudience;
  title: string;
  subtitle: string;
  pricingModel: string;
  billingCadence: 'one_time' | 'monthly' | 'annual' | 'monthly_or_annual';
  freeTierName: string;
  paidTierName: string;
  entitlementCode: string;
  stripeProductKey: string;
  stripeMonthlyLookupKey: string | null;
  stripeAnnualLookupKey: string | null;
  stripeOneTimeLookupKey: string | null;
  successPath: string;
  cancelPath: string;
  freeIncludes: string[];
  paidUnlocks: string[];
  upgradeMoments: string[];
};

export type FeatureGateRow = {
  feature: string;
  role: PricingAudience;
  free: string;
  paid: string;
};

export type CoupleFeatureMatrixRow = {
  feature: string;
  free: string;
  basic: string;
  premium: string;
};

export const couplePlanDefinitions: CouplePlanDefinition[] = [
  {
    tier: 'free',
    title: 'Free',
    tagline: 'Plan your wedding on your own',
    supportCopy: 'Best for couples getting started with budgeting, vendor discovery, guests, and early planning.',
    annualPriceKes: null,
    monthlyPriceKes: null,
    bundleType: 'couple_plan',
    bundleCode: null,
    stripeMonthlyLookupKey: null,
    stripeAnnualLookupKey: null,
    includedFeatures: [
      'Task list',
      'Cost estimator',
      'Budget tracking',
      'Vendor directory',
      'Vendor management',
      'Guest list',
    ],
    ctaLabel: 'Start free',
  },
  {
    tier: 'basic',
    title: 'Basic',
    tagline: 'Plan together',
    supportCopy: 'Stop planning alone. Bring your committee, family, planner, and vendors into one shared wedding workspace.',
    annualPriceKes: 5000,
    monthlyPriceKes: 750,
    bundleType: 'couple_plan',
    bundleCode: 'couple_basic_annual',
    stripeMonthlyLookupKey: 'couple_basic_monthly',
    stripeAnnualLookupKey: 'couple_basic_annual',
    includedFeatures: [
      'Everything in Free',
      'Planner collaboration',
      'Vendor collaboration',
      'Committee collaboration up to 10 people',
      'Family collaboration up to 10 people',
    ],
    ctaLabel: 'Upgrade to Basic',
  },
  {
    tier: 'premium',
    title: 'Premium',
    tagline: 'Run the whole wedding in one place',
    supportCopy: 'Turn your wedding into a fully coordinated workspace with AI support, collaborative timelines, and richer vendor and planner coordination.',
    annualPriceKes: 15000,
    monthlyPriceKes: 2000,
    bundleType: 'couple_plan',
    bundleCode: 'couple_premium_annual',
    stripeMonthlyLookupKey: 'couple_premium_monthly',
    stripeAnnualLookupKey: 'couple_premium_annual',
    includedFeatures: [
      'Everything in Basic',
      'Committee collaboration up to 20 people',
      'Family collaboration up to 20 people',
      'AI Wedding Assistant',
      'Vendor collaboration tools',
      'Planner collaboration tools',
      'Timeline management',
    ],
    ctaLabel: 'Go Premium',
  },
];

export const coupleAddonDefinitions: CoupleAddonDefinition[] = [
  {
    code: 'gift_registry_addon',
    title: 'Gift Registry',
    supportCopy: 'Let guests buy directly from your wedding wishlist. Purchased items are automatically marked off so there are no duplicates.',
    bundleType: 'wedding_addon',
    bundleCode: 'gift_registry_addon',
    stripeMonthlyLookupKey: 'gift_registry_addon',
    stripeAnnualLookupKey: null,
  },
  {
    code: 'guest_rsvp_management_addon',
    title: 'Guest RSVP & Management',
    supportCopy: 'Collect RSVPs, track attendance, and manage guest coordination beyond a simple guest list.',
    bundleType: 'wedding_addon',
    bundleCode: 'guest_rsvp_management_addon',
    stripeMonthlyLookupKey: 'guest_rsvp_management_addon',
    stripeAnnualLookupKey: null,
  },
];

export const coupleFeatureMatrix: CoupleFeatureMatrixRow[] = [
  { feature: 'Task list', free: 'Included', basic: 'Included', premium: 'Included' },
  { feature: 'Cost estimator', free: 'Included', basic: 'Included', premium: 'Included' },
  { feature: 'Budget tracking', free: 'Included', basic: 'Included', premium: 'Included' },
  { feature: 'Vendor directory', free: 'Included', basic: 'Included', premium: 'Included' },
  { feature: 'Vendor management', free: 'Included', basic: 'Included', premium: 'Included' },
  { feature: 'Guest list', free: 'Included', basic: 'Included', premium: 'Included' },
  { feature: 'Planner collaboration', free: 'Not included', basic: 'Included', premium: 'Included' },
  { feature: 'Vendor collaboration', free: 'Not included', basic: 'Included', premium: 'Included' },
  { feature: 'Committee collaboration', free: 'Not included', basic: 'Up to 10 people', premium: 'Up to 20 people' },
  { feature: 'Family collaboration', free: 'Not included', basic: 'Up to 10 people', premium: 'Up to 20 people' },
  { feature: 'AI Wedding Assistant', free: 'Not included', basic: 'Not included', premium: 'Included' },
  { feature: 'Timeline management', free: 'Not included', basic: 'Not included', premium: 'Included' },
  { feature: 'Gift Registry', free: 'Add-on', basic: 'Add-on', premium: 'Add-on' },
  { feature: 'Guest RSVP & Management', free: 'Add-on', basic: 'Add-on', premium: 'Add-on' },
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

export const audiencePlans: AudiencePlan[] = [
  {
    audience: 'couple',
    title: 'Couples',
    subtitle: 'Free to explore, pay when you are ready to actively coordinate your wedding.',
    pricingModel: 'Wedding plan',
    billingCadence: 'one_time',
    freeTierName: 'Explore',
    paidTierName: 'Wedding Plan',
    entitlementCode: 'planning_pass',
    stripeProductKey: 'planning_pass',
    stripeMonthlyLookupKey: null,
    stripeAnnualLookupKey: null,
    stripeOneTimeLookupKey: 'planning_pass_one_time',
    successPath: '/budget?upgrade=success',
    cancelPath: '/pricing?upgrade=cancelled',
    freeIncludes: [
      'Sign up and create a wedding workspace',
      'Use the cost estimator',
      'Browse planners and vendors',
      'Save favorites and build a shortlist',
      'Draft budget, tasks, and guest planning',
    ],
    paidUnlocks: [
      'AI wedding assistant with workspace-aware guidance and actions',
      'Connect with vendors and planners',
      'Track vendor payments and balances',
      'Collaborate with committee members or a planner',
      'Export progress and reports',
      'Push schedules to Google Calendar',
    ],
    upgradeMoments: [
      'Opening the AI assistant',
      'Trying to contact a vendor',
      'Trying to connect to a planner',
      'Inviting collaborators',
      'Exporting progress',
      'Syncing to Google Calendar',
    ],
  },
  {
    audience: 'committee',
    title: 'Wedding Committees',
    subtitle: 'Built like a couple pass, but for families and committee-led weddings.',
    pricingModel: 'One-time wedding pass',
    billingCadence: 'one_time',
    freeTierName: 'Explore',
    paidTierName: 'Committee Pass',
    entitlementCode: 'committee_pass',
    stripeProductKey: 'committee_pass',
    stripeMonthlyLookupKey: null,
    stripeAnnualLookupKey: null,
    stripeOneTimeLookupKey: 'committee_pass_one_time',
    successPath: '/planner?upgrade=success',
    cancelPath: '/pricing?upgrade=cancelled',
    freeIncludes: [
      'Create a committee-led wedding workspace',
      'Estimate costs and draft the initial plan',
      'Browse planners and vendors',
      'Build shortlist, budget, and tasks',
      'Assign internal planning responsibilities',
    ],
    paidUnlocks: [
      'AI committee assistant for planning and delegated execution',
      'Connect with vendors and planners',
      'Committee collaboration and delegated task ownership',
      'Vendor payment tracking',
      'Exports and reporting',
      'Google Calendar schedule sync',
    ],
    upgradeMoments: [
      'Opening the AI assistant',
      'Trying to connect with a vendor',
      'Trying to collaborate at full committee level',
      'Recording detailed execution progress',
      'Exporting or syncing schedules',
    ],
  },
  {
    audience: 'planner',
    title: 'Professional Planners',
    subtitle: 'Let planners test the system free, then pay as soon as they need to operate at scale.',
    pricingModel: 'Monthly or annual subscription',
    billingCadence: 'monthly_or_annual',
    freeTierName: 'Starter',
    paidTierName: 'Planner Pro',
    entitlementCode: 'planner_pro',
    stripeProductKey: 'planner_pro',
    stripeMonthlyLookupKey: 'planner_pro_monthly',
    stripeAnnualLookupKey: 'planner_pro_annual',
    stripeOneTimeLookupKey: null,
    successPath: '/planner?upgrade=success',
    cancelPath: '/pricing?upgrade=cancelled',
    freeIncludes: [
      'Create a planner profile',
      'Manage 1 active wedding',
      'Use the core planning workflow',
      'Review vendor matches and budgets',
      'Invite one client into a shared workflow',
    ],
    paidUnlocks: [
      'AI planner assistant across clients, budgets, vendors, and timelines',
      'Manage multiple active weddings',
      'Expanded planner dashboard and exports',
      'Calendar sync and scheduling tools',
      'Advanced planner-client collaboration',
      'Premium workflow and reporting tools',
    ],
    upgradeMoments: [
      'Opening the AI assistant',
      'Trying to add a second active wedding',
      'Trying to export client progress',
      'Trying to use premium planner reporting',
      'Trying to scale beyond trial usage',
    ],
  },
  {
    audience: 'vendor',
    title: 'Vendors',
    subtitle: 'Free listings help discovery. Paid access starts when leads and business tools become valuable.',
    pricingModel: 'Monthly subscription',
    billingCadence: 'monthly',
    freeTierName: 'Listing',
    paidTierName: 'Vendor Pro',
    entitlementCode: 'vendor_pro',
    stripeProductKey: 'vendor_pro',
    stripeMonthlyLookupKey: 'vendor_pro_monthly',
    stripeAnnualLookupKey: null,
    stripeOneTimeLookupKey: null,
    successPath: '/vendor-dashboard?upgrade=success',
    cancelPath: '/pricing?upgrade=cancelled',
    freeIncludes: [
      'Create a vendor profile and listing',
      'Appear in the directory',
      'Manage your portfolio and business details',
      'Be discovered through search and matching',
    ],
    paidUnlocks: [
      'AI vendor assistant for listing and booking operations',
      'Receive direct connection requests',
      'Respond to leads',
      'Unlock analytics and performance insights',
      'Access premium business tools',
      'Improve visibility and verified trust signals',
    ],
    upgradeMoments: [
      'Opening the AI assistant',
      'Trying to receive or respond to direct leads',
      'Trying to access analytics',
      'Trying to unlock premium visibility and growth tools',
    ],
  },
];

export const featureGateRows: FeatureGateRow[] = [
  { role: 'couple', feature: 'Cost estimator', free: 'Included', paid: 'Included' },
  { role: 'couple', feature: 'Vendor and planner browsing', free: 'Included', paid: 'Included' },
  { role: 'couple', feature: 'Vendor/planner connection', free: 'Locked', paid: 'Included' },
  { role: 'couple', feature: 'AI wedding assistant', free: 'Locked', paid: 'Included' },
  { role: 'couple', feature: 'Committee/planner collaboration', free: 'Locked', paid: 'Included' },
  { role: 'couple', feature: 'Exports and Google Calendar sync', free: 'Locked', paid: 'Included' },
  { role: 'committee', feature: 'Committee-led wedding planning', free: 'Included', paid: 'Included' },
  { role: 'committee', feature: 'AI committee assistant', free: 'Locked', paid: 'Included' },
  { role: 'committee', feature: 'Vendor and planner connection', free: 'Locked', paid: 'Included' },
  { role: 'committee', feature: 'Full committee collaboration', free: 'Locked', paid: 'Included' },
  { role: 'committee', feature: 'Exports and Google Calendar sync', free: 'Locked', paid: 'Included' },
  { role: 'planner', feature: '1 active wedding', free: 'Included', paid: 'Included' },
  { role: 'planner', feature: 'AI planner assistant', free: 'Locked', paid: 'Included' },
  { role: 'planner', feature: 'Additional active weddings', free: 'Locked', paid: 'Included' },
  { role: 'planner', feature: 'Planner exports and advanced reporting', free: 'Locked', paid: 'Included' },
  { role: 'planner', feature: 'Planner calendar sync', free: 'Locked', paid: 'Included' },
  { role: 'vendor', feature: 'Directory listing', free: 'Included', paid: 'Included' },
  { role: 'vendor', feature: 'AI vendor assistant', free: 'Locked', paid: 'Included' },
  { role: 'vendor', feature: 'Direct lead access', free: 'Locked', paid: 'Included' },
  { role: 'vendor', feature: 'Analytics and premium tools', free: 'Locked', paid: 'Included' },
];

export const accessControlImplementationSteps = [
  'Introduce role-aware plan records so couples/committees use one-time wedding passes while planners and vendors use recurring subscriptions.',
  'Centralize feature gates in one entitlement layer instead of scattering checks across UI pages.',
  'Count planner access by active weddings, not lifetime weddings.',
  'Gate vendor lead responses separately from directory visibility so free listings still help discovery.',
  'Use upgrade prompts at the action point where value starts, such as connecting, exporting, syncing, or adding another active wedding.',
  'Add billing webhooks later to update entitlement state without changing the product rules defined here.',
];

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

export function getLookupKeyForCadence(
  plan: AudiencePlan,
  cadence: PricingCheckoutCadence,
  overrides?: Partial<Record<'one_time' | 'monthly' | 'annual', string | null>>,
) {
  if (cadence === 'one_time') {
    return overrides?.one_time ?? plan.stripeOneTimeLookupKey;
  }
  if (cadence === 'monthly') {
    return overrides?.monthly ?? plan.stripeMonthlyLookupKey;
  }
  return overrides?.annual ?? plan.stripeAnnualLookupKey;
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
