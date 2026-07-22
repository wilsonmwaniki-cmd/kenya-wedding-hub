import {
  getAudiencePlan,
  getCouplePlanDefinition,
  getProfessionalPlanDefinition,
  type AudiencePlan,
  type CouplePlanDefinition,
  type CouplePlanTier,
  type PricingAudience,
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

type ProfessionalPlanContent = {
  tagline: string;
  supportCopy: string;
  includedFeatures: string[];
  ctaLabel: string;
};

export type AudiencePlanDefinition = AudiencePlan & AudiencePlanContent;
export type CouplePlanDefinitionWithContent = CouplePlanDefinition & CouplePlanContent;
export type ProfessionalPlanDefinitionWithContent = ProfessionalPlanDefinition & ProfessionalPlanContent;

const audiencePlanContent: Record<PricingAudience, AudiencePlanContent> = {
  couple: {
    subtitle: 'Explore and plan for free. Upgrade only when you are ready to collaborate with vendors and a planner.',
    pricingModel: 'Wedding plan',
    freeIncludes: [
      'Sign up and create a wedding workspace',
      'Use the cost estimator',
      'Browse planners and vendors',
      'Save favorites and build a shortlist',
      'Draft budget, tasks, and guest planning',
    ],
    paidUnlocks: [
      'Connect with vendors and planners',
      'Work together inside one shared wedding workspace',
      'Access new Collaborative features as they are released',
    ],
    upgradeMoments: [
      'Trying to contact a vendor',
      'Trying to connect to a planner',
      'Opening a future Collaborative feature',
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
      'Receive invitations and inquiries',
      'Collaborate in a couple-funded workspace',
      'Public ratings from completed weddings',
    ],
    paidUnlocks: [
      'Inquiries and bookings tracker',
      'Quotes, invoicing, and receipts',
      'Couple-linked payment tracking',
      'Contract management with reusable templates',
      'Advanced portfolio and business analytics',
    ],
    upgradeMoments: [
      'Trying to manage inquiries or bookings',
      'Trying to create quotes or invoices',
      'Trying to manage contracts',
      'Trying to use advanced portfolio or business tools',
    ],
  },
  vendor: {
    subtitle: 'Start with a verified listing for discovery, then upgrade when you need operational tools for bookings, payments, contracts, and trust.',
    pricingModel: 'Monthly or annual subscription',
    freeIncludes: [
      'Directory listing',
      'Basic public profile',
      'Verification eligibility',
      'Receive invitations and inquiries',
      'Collaborate in a couple-funded workspace',
      'Public ratings from completed weddings',
    ],
    paidUnlocks: [
      'Inquiries and bookings tracker',
      'Quotes, invoicing, and receipts',
      'Couple-linked payment tracking',
      'Contract management with reusable templates',
      'Advanced portfolio and business analytics',
    ],
    upgradeMoments: [
      'Trying to manage inquiries or bookings',
      'Trying to create quotes or invoices',
      'Trying to manage contracts',
      'Trying to use advanced portfolio or business tools',
    ],
  },
};

const couplePlanContent: Record<CouplePlanTier, CouplePlanContent> = {
  free: {
    tagline: 'Explore and plan your wedding for free',
    supportCopy: 'Use Zania\'s couple planning tools at no cost. Upgrade only when you want vendors or a planner to join your workspace.',
    includedFeatures: [
      'All current couple planning features',
      'Budget, tasks, timeline, and guest tools',
      'Vendor and planner discovery',
      'AI planning support',
      'Gift registry and RSVP management',
      'One private wedding workspace',
    ],
    ctaLabel: 'Start free',
  },
  collaborative: {
    tagline: 'Bring your wedding team into Zania',
    supportCopy: 'Invite vendors and a planner into your wedding workspace, coordinate together, and receive new Collaborative features as they are released.',
    includedFeatures: [
      'Everything in Intimate',
      'Planner collaboration',
      'Vendor collaboration',
      'Shared coordination in one workspace',
      'Coming soon: new Collaborative features',
    ],
    ctaLabel: 'Upgrade to Collaborative',
  },
};

const professionalPlanContent: Record<ProfessionalAudience, Record<ProfessionalPlanTier, ProfessionalPlanContent>> = {
  planner: {
    free: {
      tagline: 'Get discovered on Zania',
      supportCopy: 'Create a verified presence, receive invitations, and collaborate when a couple brings you into their paid workspace.',
      includedFeatures: ['Verified directory listing', 'Basic public profile and portfolio', 'Receive invitations and inquiries', 'Collaborate in couple-funded workspaces', 'Public ratings from completed weddings'],
      ctaLabel: 'Start free',
    },
    premium: {
      tagline: 'Run your wedding business on Zania',
      supportCopy: 'Run your wider planning business with multi-wedding operations, documents, analytics, and advanced professional tools.',
      includedFeatures: [
        'Inquiries and bookings tracker',
        'Quotes, invoicing, and receipts',
        'Couple-linked payment tracking',
        'Contract management with reusable templates',
        'Advanced portfolio and business analytics',
        'New Professional tools as they are released',
      ],
      ctaLabel: 'Upgrade to Professional',
    },
  },
  vendor: {
    free: {
      tagline: 'Get discovered on Zania',
      supportCopy: 'Create a verified presence, receive inquiries, and collaborate when a couple brings you into their paid workspace.',
      includedFeatures: ['Verified directory listing', 'Basic public profile and portfolio', 'Receive invitations and inquiries', 'Collaborate in couple-funded workspaces', 'Public ratings from completed weddings'],
      ctaLabel: 'Start free',
    },
    premium: {
      tagline: 'Run your wedding business on Zania',
      supportCopy: 'Run your wider vendor business with booking operations, documents, analytics, and advanced professional tools.',
      includedFeatures: [
        'Inquiries and bookings tracker',
        'Quotes, invoicing, and receipts',
        'Couple-linked payment tracking',
        'Contract management with reusable templates',
        'Advanced portfolio and business analytics',
        'New Professional tools as they are released',
      ],
      ctaLabel: 'Upgrade to Professional',
    },
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
  return (['free', 'collaborative'] as const).map((tier) => getCouplePlanDefinitionWithContent(tier));
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
