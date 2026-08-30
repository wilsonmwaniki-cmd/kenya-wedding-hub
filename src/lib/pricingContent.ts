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
    subtitle: 'Create and manage business documents for free. Upgrade when you want those documents connected to couples and client workspaces.',
    pricingModel: 'Monthly or annual subscription',
    freeIncludes: [
      'Directory listing',
      'Basic public profile',
      'Verification eligibility',
      'Receive invitations and inquiries',
      'Collaborate in a couple-funded workspace',
      'Public ratings from completed weddings',
      'Standalone quotes, invoices, receipts, and contracts',
      'Reusable document templates and PDF exports',
    ],
    paidUnlocks: [
      'Inquiries and bookings tracker',
      'Connect documents to Zania couples and client workspaces',
      'Answer in-app quote and contract requests',
      'Keep linked payments and document status in sync',
      'Advanced portfolio and business analytics',
    ],
    upgradeMoments: [
      'Trying to manage inquiries or bookings',
      'Trying to connect a document to a client workspace',
      'Trying to answer an in-app document request',
      'Trying to use advanced portfolio or business tools',
    ],
  },
  vendor: {
    subtitle: 'Create and manage business documents for free. Upgrade when you want those documents connected to couples, planners, and bookings.',
    pricingModel: 'Monthly or annual subscription',
    freeIncludes: [
      'Directory listing',
      'Basic public profile',
      'Verification eligibility',
      'Receive invitations and inquiries',
      'Collaborate in a couple-funded workspace',
      'Public ratings from completed weddings',
      'Standalone quotes, invoices, receipts, and contracts',
      'Reusable document templates and PDF exports',
    ],
    paidUnlocks: [
      'Inquiries and bookings tracker',
      'Connect documents to Zania couples, planners, and bookings',
      'Answer in-app quote and contract requests',
      'Keep linked payments and document status in sync',
      'Advanced portfolio and business analytics',
    ],
    upgradeMoments: [
      'Trying to manage inquiries or bookings',
      'Trying to connect a document to a Zania booking',
      'Trying to answer an in-app document request',
      'Trying to use advanced portfolio or business tools',
    ],
  },
};

const couplePlanContent: Record<CouplePlanTier, CouplePlanContent> = {
  free: {
    tagline: 'Plan your wedding in one private workspace.',
    supportCopy: 'Use Zania\'s planning tools at no cost.',
    includedFeatures: [
      'Budget, tasks, timeline, and guests',
      'Find and save vendors and planners',
      'Zania planning assistant',
      'Gift registry and RSVP tools',
      'One private wedding workspace',
    ],
    ctaLabel: 'Start free',
  },
  collaborative: {
    tagline: 'Invite your planner and vendors to work with you.',
    supportCopy: 'Bring your wedding team into the same workspace.',
    includedFeatures: [
      'Everything in Intimate',
      'Invite your planner',
      'Invite your vendors',
      'Plan together in one shared workspace',
    ],
    ctaLabel: 'Upgrade to Collaborative',
  },
};

const professionalPlanContent: Record<ProfessionalAudience, Record<ProfessionalPlanTier, ProfessionalPlanContent>> = {
  planner: {
    free: {
      tagline: 'Get listed and create business documents.',
      supportCopy: 'Use your public profile and standalone document desk without paying.',
      includedFeatures: ['Public directory listing', 'Standalone quotes, invoices, receipts, and contracts', 'Reusable templates and PDF exports', 'Receive invitations and inquiries', 'Public ratings from completed weddings'],
      ctaLabel: 'Start free',
    },
    premium: {
      tagline: 'Connect your documents to real client work.',
      supportCopy: 'Run client work and documents from one shared system.',
      includedFeatures: [
        'Everything in Free',
        'Connect documents to couples and weddings',
        'Manage inquiries, requests, and bookings',
        'Keep payments and document status in sync',
        'Advanced portfolio and business insights',
      ],
      ctaLabel: 'Upgrade to Professional',
    },
  },
  vendor: {
    free: {
      tagline: 'Get listed and create business documents.',
      supportCopy: 'Use your public profile and standalone document desk without paying.',
      includedFeatures: ['Public directory listing', 'Standalone quotes, invoices, receipts, and contracts', 'Reusable templates and PDF exports', 'Receive invitations and inquiries', 'Public ratings from completed weddings'],
      ctaLabel: 'Start free',
    },
    premium: {
      tagline: 'Connect your documents to real bookings.',
      supportCopy: 'Run bookings and documents from one shared system.',
      includedFeatures: [
        'Everything in Free',
        'Connect documents to couples and planners',
        'Manage inquiries, requests, and bookings',
        'Keep payments and document status in sync',
        'Advanced portfolio and business insights',
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
