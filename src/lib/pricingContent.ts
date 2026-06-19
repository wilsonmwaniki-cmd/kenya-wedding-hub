import {
  getAudiencePlan,
  getCoupleAddonDefinition,
  getCouplePlanDefinition,
  getProfessionalAddonDefinition,
  getProfessionalPlanDefinition,
  type AudiencePlan,
  type CoupleAddonCode,
  type CoupleAddonDefinition,
  type CouplePlanDefinition,
  type CouplePlanTier,
  type PricingAudience,
  type ProfessionalAddonCode,
  type ProfessionalAddonDefinition,
  type ProfessionalAudience,
  type ProfessionalPlanDefinition,
  type ProfessionalPlanTier,
} from '@/lib/pricingPlans';

type AudiencePlanContent = {
  subtitle: string;
  pricingModel: string;
  freeIncludes: string[];
  paidUnlocks: string[];
  upgradeMoments: string[];
};

type CouplePlanContent = {
  tagline: string;
  supportCopy: string;
  includedFeatures: string[];
  ctaLabel: string;
};

type CoupleAddonContent = {
  supportCopy: string;
};

type ProfessionalPlanContent = {
  tagline: string;
  supportCopy: string;
  includedFeatures: string[];
  ctaLabel: string;
};

type ProfessionalAddonContent = {
  supportCopy: string;
};

export type AudiencePlanDefinition = AudiencePlan & AudiencePlanContent;
export type CouplePlanDefinitionWithContent = CouplePlanDefinition & CouplePlanContent;
export type CoupleAddonDefinitionWithContent = CoupleAddonDefinition & CoupleAddonContent;
export type ProfessionalPlanDefinitionWithContent = ProfessionalPlanDefinition & ProfessionalPlanContent;
export type ProfessionalAddonDefinitionWithContent = ProfessionalAddonDefinition & ProfessionalAddonContent;

const audiencePlanContent: Record<PricingAudience, AudiencePlanContent> = {
  couple: {
    subtitle: 'Free to explore, pay when you are ready to actively coordinate your wedding.',
    pricingModel: 'Wedding plan',
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
  committee: {
    subtitle: 'Built like a couple pass, but for families and committee-led weddings.',
    pricingModel: 'One-time wedding pass',
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
  planner: {
    subtitle: 'Start with a verified listing for discovery, then upgrade when you need operational tools for bookings, payments, contracts, and trust.',
    pricingModel: 'Monthly or annual subscription',
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
  vendor: {
    subtitle: 'Start with a verified listing for discovery, then upgrade when you need operational tools for bookings, payments, contracts, and trust.',
    pricingModel: 'Monthly or annual subscription',
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
};

const couplePlanContent: Record<CouplePlanTier, CouplePlanContent> = {
  free: {
    tagline: 'Plan your wedding on your own',
    supportCopy: 'Best for couples getting started with budgeting, vendor discovery, guests, and early planning.',
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
  basic: {
    tagline: 'Plan together',
    supportCopy: 'Stop planning alone. Bring your committee, family, planner, and vendors into one shared wedding workspace.',
    includedFeatures: [
      'Everything in Free',
      'Planner collaboration',
      'Vendor collaboration',
      'Committee collaboration up to 10 people',
      'Family collaboration up to 10 people',
    ],
    ctaLabel: 'Upgrade to Basic',
  },
  premium: {
    tagline: 'Run the whole wedding in one place',
    supportCopy: 'Turn your wedding into a fully coordinated workspace with AI support, collaborative timelines, and richer vendor and planner coordination.',
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
};

const coupleAddonContent: Record<CoupleAddonCode, CoupleAddonContent> = {
  gift_registry_addon: {
    supportCopy: 'Let guests buy directly from your wedding wishlist. Purchased items are automatically marked off so there are no duplicates.',
  },
  guest_rsvp_management_addon: {
    supportCopy: 'Collect RSVPs, track attendance, and manage guest coordination beyond a simple guest list.',
  },
};

const professionalPlanContent: Record<ProfessionalAudience, Record<ProfessionalPlanTier, ProfessionalPlanContent>> = {
  planner: {
    free: {
      tagline: 'Get discovered on Zania',
      supportCopy: 'Best for planners who want a public profile, directory visibility, and a verified business presence before upgrading into operational tools.',
      includedFeatures: ['Directory listing', 'Basic public profile', 'Verification eligibility'],
      ctaLabel: 'Start free',
    },
    premium: {
      tagline: 'Run your wedding business on Zania',
      supportCopy: 'Manage inquiries, bookings, payments, contracts, and public credibility in one business workspace designed for wedding professionals.',
      includedFeatures: [
        'Inquiries and bookings tracker',
        'Quotes, invoicing, and receipts',
        'Couple-linked payment tracking',
        'Contract management with reusable templates',
        'Public ratings from completed weddings',
      ],
      ctaLabel: 'Upgrade to Premium',
    },
  },
  vendor: {
    free: {
      tagline: 'Get discovered on Zania',
      supportCopy: 'Best for vendors who want a public profile, directory visibility, and a verified business presence before upgrading into operational tools.',
      includedFeatures: ['Directory listing', 'Basic public profile', 'Verification eligibility'],
      ctaLabel: 'Start free',
    },
    premium: {
      tagline: 'Run your wedding business on Zania',
      supportCopy: 'Manage inquiries, bookings, payments, contracts, and public credibility in one business workspace designed for wedding professionals.',
      includedFeatures: [
        'Inquiries and bookings tracker',
        'Quotes, invoicing, and receipts',
        'Couple-linked payment tracking',
        'Contract management with reusable templates',
        'Public ratings from completed weddings',
      ],
      ctaLabel: 'Upgrade to Premium',
    },
  },
};

const professionalAddonContent: Record<ProfessionalAddonCode, ProfessionalAddonContent> = {
  media_addon: {
    supportCopy: 'Showcase your work with a richer photo and video portfolio experience beyond a basic profile.',
  },
  advertising_addon: {
    supportCopy: 'Promote your listing through boosted placement, featured visibility, and directory marketing opportunities.',
  },
  team_workspace_bundle_3: {
    supportCopy: 'Collaborate with colleagues inside Zania through a 3-seat team workspace bundle.',
  },
  team_workspace_bundle_5: {
    supportCopy: 'Collaborate with colleagues inside Zania through a 5-seat team workspace bundle.',
  },
  team_workspace_bundle_10: {
    supportCopy: 'Collaborate with colleagues inside Zania through a 10-seat team workspace bundle.',
  },
};

export function getAudiencePlanDefinition(audience: PricingAudience): AudiencePlanDefinition {
  return {
    ...getAudiencePlan(audience),
    ...audiencePlanContent[audience],
  };
}

export function getCouplePlanDefinitionWithContent(tier: CouplePlanTier): CouplePlanDefinitionWithContent {
  return {
    ...getCouplePlanDefinition(tier),
    ...couplePlanContent[tier],
  };
}

export function listCouplePlanDefinitions(): CouplePlanDefinitionWithContent[] {
  return (['free', 'basic', 'premium'] as const).map((tier) => getCouplePlanDefinitionWithContent(tier));
}

export function getCoupleAddonDefinitionWithContent(code: CoupleAddonCode): CoupleAddonDefinitionWithContent {
  return {
    ...getCoupleAddonDefinition(code),
    ...coupleAddonContent[code],
  };
}

export function listCoupleAddonDefinitions(): CoupleAddonDefinitionWithContent[] {
  return (['gift_registry_addon', 'guest_rsvp_management_addon'] as const).map((code) => getCoupleAddonDefinitionWithContent(code));
}

export function getProfessionalPlanDefinitionWithContent(
  audience: ProfessionalAudience,
  tier: ProfessionalPlanTier,
): ProfessionalPlanDefinitionWithContent {
  return {
    ...getProfessionalPlanDefinition(audience, tier),
    ...professionalPlanContent[audience][tier],
  };
}

export function getProfessionalAddonDefinitionWithContent(
  code: ProfessionalAddonCode,
): ProfessionalAddonDefinitionWithContent {
  return {
    ...getProfessionalAddonDefinition(code),
    ...professionalAddonContent[code],
  };
}
