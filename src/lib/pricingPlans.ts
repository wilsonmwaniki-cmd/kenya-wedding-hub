export type PricingAudience = 'couple' | 'committee' | 'planner' | 'vendor';
export type AccessLevel = 'free' | 'paid';

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

export const audiencePlans: AudiencePlan[] = [
  {
    audience: 'couple',
    title: 'Couples',
    subtitle: 'Free to explore, pay when you are ready to actively coordinate your wedding.',
    pricingModel: 'One-time wedding pass',
    billingCadence: 'one_time',
    freeTierName: 'Explore',
    paidTierName: 'Planning Pass',
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
      'Connect with vendors and planners',
      'Track vendor payments and balances',
      'Collaborate with committee members or a planner',
      'Export progress and reports',
      'Push schedules to Google Calendar',
    ],
    upgradeMoments: [
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
      'Connect with vendors and planners',
      'Committee collaboration and delegated task ownership',
      'Vendor payment tracking',
      'Exports and reporting',
      'Google Calendar schedule sync',
    ],
    upgradeMoments: [
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
      'Manage multiple active weddings',
      'Expanded planner dashboard and exports',
      'Calendar sync and scheduling tools',
      'Advanced planner-client collaboration',
      'Premium workflow and reporting tools',
    ],
    upgradeMoments: [
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
      'Receive direct connection requests',
      'Respond to leads',
      'Unlock analytics and performance insights',
      'Access premium business tools',
      'Improve visibility and verified trust signals',
    ],
    upgradeMoments: [
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
  { role: 'couple', feature: 'Committee/planner collaboration', free: 'Locked', paid: 'Included' },
  { role: 'couple', feature: 'Exports and Google Calendar sync', free: 'Locked', paid: 'Included' },
  { role: 'committee', feature: 'Committee-led wedding planning', free: 'Included', paid: 'Included' },
  { role: 'committee', feature: 'Vendor and planner connection', free: 'Locked', paid: 'Included' },
  { role: 'committee', feature: 'Full committee collaboration', free: 'Locked', paid: 'Included' },
  { role: 'committee', feature: 'Exports and Google Calendar sync', free: 'Locked', paid: 'Included' },
  { role: 'planner', feature: '1 active wedding', free: 'Included', paid: 'Included' },
  { role: 'planner', feature: 'Additional active weddings', free: 'Locked', paid: 'Included' },
  { role: 'planner', feature: 'Planner exports and advanced reporting', free: 'Locked', paid: 'Included' },
  { role: 'planner', feature: 'Planner calendar sync', free: 'Locked', paid: 'Included' },
  { role: 'vendor', feature: 'Directory listing', free: 'Included', paid: 'Included' },
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
