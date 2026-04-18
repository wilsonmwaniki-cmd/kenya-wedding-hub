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

export type ProfessionalPlanDefinition = {
  audience: ProfessionalAudience;
  tier: ProfessionalPlanTier;
  title: string;
  tagline: string;
  supportCopy: string;
  annualPriceKes: number | null;
  monthlyPriceKes: number | null;
  bundleType: 'professional_plan';
  bundleCode: string | null;
  stripeMonthlyLookupKey: string | null;
  stripeAnnualLookupKey: string | null;
  includedFeatures: string[];
  ctaLabel: string;
};

export type ProfessionalAddonDefinition = {
  audience: ProfessionalAudience | 'shared';
  code: ProfessionalAddonCode;
  title: string;
  supportCopy: string;
  bundleType: 'professional_addon';
  bundleCode: ProfessionalAddonCode;
  stripeMonthlyLookupKey: string | null;
  stripeAnnualLookupKey: string | null;
  seatLimit: number | null;
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

export type ProfessionalFeatureMatrixRow = {
  feature: string;
  free: string;
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

export const professionalPlanDefinitions: ProfessionalPlanDefinition[] = [
  {
    audience: 'planner',
    tier: 'free',
    title: 'Free',
    tagline: 'Get discovered on Zania',
    supportCopy:
      'Best for planners who want a public profile, directory visibility, and a verified business presence before upgrading into operational tools.',
    annualPriceKes: null,
    monthlyPriceKes: null,
    bundleType: 'professional_plan',
    bundleCode: null,
    stripeMonthlyLookupKey: null,
    stripeAnnualLookupKey: null,
    includedFeatures: ['Directory listing', 'Basic public profile', 'Verification eligibility'],
    ctaLabel: 'Start free',
  },
  {
    audience: 'planner',
    tier: 'premium',
    title: 'Premium',
    tagline: 'Run your wedding business on Zania',
    supportCopy:
      'Manage inquiries, bookings, payments, contracts, and public credibility in one business workspace designed for wedding professionals.',
    annualPriceKes: 9000,
    monthlyPriceKes: 1000,
    bundleType: 'professional_plan',
    bundleCode: 'planner_premium_annual',
    stripeMonthlyLookupKey: 'planner_premium_monthly',
    stripeAnnualLookupKey: 'planner_premium_annual',
    includedFeatures: [
      'Inquiries and bookings tracker',
      'Quotes, invoicing, and receipts',
      'Couple-linked payment tracking',
      'Contract management with reusable templates',
      'Public ratings from completed weddings',
    ],
    ctaLabel: 'Upgrade to Premium',
  },
  {
    audience: 'vendor',
    tier: 'free',
    title: 'Free',
    tagline: 'Get discovered on Zania',
    supportCopy:
      'Best for vendors who want a public profile, directory visibility, and a verified business presence before upgrading into operational tools.',
    annualPriceKes: null,
    monthlyPriceKes: null,
    bundleType: 'professional_plan',
    bundleCode: null,
    stripeMonthlyLookupKey: null,
    stripeAnnualLookupKey: null,
    includedFeatures: ['Directory listing', 'Basic public profile', 'Verification eligibility'],
    ctaLabel: 'Start free',
  },
  {
    audience: 'vendor',
    tier: 'premium',
    title: 'Premium',
    tagline: 'Run your wedding business on Zania',
    supportCopy:
      'Manage inquiries, bookings, payments, contracts, and public credibility in one business workspace designed for wedding professionals.',
    annualPriceKes: 9000,
    monthlyPriceKes: 1000,
    bundleType: 'professional_plan',
    bundleCode: 'vendor_premium_annual',
    stripeMonthlyLookupKey: 'vendor_premium_monthly',
    stripeAnnualLookupKey: 'vendor_premium_annual',
    includedFeatures: [
      'Inquiries and bookings tracker',
      'Quotes, invoicing, and receipts',
      'Couple-linked payment tracking',
      'Contract management with reusable templates',
      'Public ratings from completed weddings',
    ],
    ctaLabel: 'Upgrade to Premium',
  },
];

export const professionalAddonDefinitions: ProfessionalAddonDefinition[] = [
  {
    audience: 'shared',
    code: 'media_addon',
    title: 'Media',
    supportCopy: 'Showcase your work with a richer photo and video portfolio experience beyond a basic profile.',
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
    supportCopy: 'Promote your listing through boosted placement, featured visibility, and directory marketing opportunities.',
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
    supportCopy: 'Collaborate with colleagues inside Zania through a 3-seat team workspace bundle.',
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
    supportCopy: 'Collaborate with colleagues inside Zania through a 5-seat team workspace bundle.',
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
    supportCopy: 'Collaborate with colleagues inside Zania through a 10-seat team workspace bundle.',
    bundleType: 'professional_addon',
    bundleCode: 'team_workspace_bundle_10',
    stripeMonthlyLookupKey: 'team_workspace_bundle_10',
    stripeAnnualLookupKey: null,
    seatLimit: 10,
  },
];

export const professionalFeatureMatrix: ProfessionalFeatureMatrixRow[] = [
  { feature: 'Directory listing', free: 'Included', premium: 'Included' },
  { feature: 'Verification eligibility', free: 'Included', premium: 'Included' },
  { feature: 'Public profile', free: 'Basic', premium: 'Advanced' },
  { feature: 'Inquiries tracker', free: 'Not included', premium: 'Included' },
  { feature: 'Bookings tracker', free: 'Not included', premium: 'Included' },
  { feature: 'Quotes, invoicing, and receipts', free: 'Not included', premium: 'Included' },
  { feature: 'Couple-linked payment tracking', free: 'Not included', premium: 'Included' },
  { feature: 'Contract management', free: 'Not included', premium: 'Included' },
  { feature: 'Public ratings', free: 'Not included', premium: 'Included' },
  { feature: 'Rich media portfolio', free: 'Add-on', premium: 'Add-on' },
  { feature: 'Advertising', free: 'Add-on', premium: 'Add-on' },
  { feature: 'Team workspace', free: 'Add-on', premium: 'Add-on' },
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
    subtitle: 'Start with a verified listing for discovery, then upgrade when you need operational tools for bookings, payments, contracts, and trust.',
    pricingModel: 'Monthly or annual subscription',
    billingCadence: 'monthly_or_annual',
    freeTierName: 'Free',
    paidTierName: 'Premium',
    entitlementCode: 'booking_management',
    stripeProductKey: 'planner_premium',
    stripeMonthlyLookupKey: 'planner_premium_monthly',
    stripeAnnualLookupKey: 'planner_premium_annual',
    stripeOneTimeLookupKey: null,
    successPath: '/planner?upgrade=success',
    cancelPath: '/pricing?upgrade=cancelled',
    freeIncludes: [
      'Directory listing',
      'Basic public profile',
      'Verification eligibility',
    ],
    paidUnlocks: [
      'Inquiries and bookings tracker',
      'Quotes, invoicing, and receipts',
      'Couple-linked payment tracking',
      'Contract management with reusable templates',
      'Public ratings from completed weddings',
    ],
    upgradeMoments: [
      'Trying to manage inquiries or bookings',
      'Trying to create quotes or invoices',
      'Trying to manage contracts',
      'Trying to surface public ratings',
      'Trying to use premium portfolio or growth tools',
    ],
  },
  {
    audience: 'vendor',
    title: 'Vendors',
    subtitle: 'Start with a verified listing for discovery, then upgrade when you need operational tools for bookings, payments, contracts, and trust.',
    pricingModel: 'Monthly or annual subscription',
    billingCadence: 'monthly_or_annual',
    freeTierName: 'Free',
    paidTierName: 'Premium',
    entitlementCode: 'booking_management',
    stripeProductKey: 'vendor_premium',
    stripeMonthlyLookupKey: 'vendor_premium_monthly',
    stripeAnnualLookupKey: 'vendor_premium_annual',
    stripeOneTimeLookupKey: null,
    successPath: '/vendor-dashboard?upgrade=success',
    cancelPath: '/pricing?upgrade=cancelled',
    freeIncludes: [
      'Directory listing',
      'Basic public profile',
      'Verification eligibility',
    ],
    paidUnlocks: [
      'Inquiries and bookings tracker',
      'Quotes, invoicing, and receipts',
      'Couple-linked payment tracking',
      'Contract management with reusable templates',
      'Public ratings from completed weddings',
    ],
    upgradeMoments: [
      'Trying to manage inquiries or bookings',
      'Trying to create quotes or invoices',
      'Trying to manage contracts',
      'Trying to surface public ratings',
      'Trying to use premium portfolio or growth tools',
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
  { role: 'planner', feature: 'Directory listing', free: 'Included', paid: 'Included' },
  { role: 'planner', feature: 'Inquiries and bookings tracker', free: 'Locked', paid: 'Included' },
  { role: 'planner', feature: 'Quotes, invoicing, and receipts', free: 'Locked', paid: 'Included' },
  { role: 'planner', feature: 'Contract management', free: 'Locked', paid: 'Included' },
  { role: 'planner', feature: 'Public ratings', free: 'Locked', paid: 'Included' },
  { role: 'vendor', feature: 'Directory listing', free: 'Included', paid: 'Included' },
  { role: 'vendor', feature: 'Inquiries and bookings tracker', free: 'Locked', paid: 'Included' },
  { role: 'vendor', feature: 'Quotes, invoicing, and receipts', free: 'Locked', paid: 'Included' },
  { role: 'vendor', feature: 'Contract management', free: 'Locked', paid: 'Included' },
  { role: 'vendor', feature: 'Public ratings', free: 'Locked', paid: 'Included' },
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
