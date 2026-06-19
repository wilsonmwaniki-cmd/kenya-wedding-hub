export type ProfessionalNetworkRole = 'planner' | 'vendor';

export type ProfessionalRelationshipKind =
  | 'recommended'
  | 'worked_with'
  | 'preferred_vendor'
  | 'trusted_collaborator';

export type ProfessionalThreadContext =
  | 'introduction'
  | 'booking'
  | 'partnership'
  | 'general';

export interface ProfessionalNetworkStep {
  key: string;
  label: string;
  complete: boolean;
  helper: string;
}

export interface ProfessionalNetworkChecklist {
  score: number;
  completeCount: number;
  totalCount: number;
  headline: string;
  steps: ProfessionalNetworkStep[];
}

export interface ProfessionalRelationshipMeta {
  label: string;
  shortLabel: string;
  description: string;
}

export const professionalRelationshipMeta: Record<ProfessionalRelationshipKind, ProfessionalRelationshipMeta> = {
  recommended: {
    label: 'Recommended',
    shortLabel: 'Recommended',
    description: 'A public trust signal that says you would confidently refer this professional.',
  },
  worked_with: {
    label: 'Worked with',
    shortLabel: 'Worked together',
    description: 'Use this when you have collaborated on a real wedding or client delivery.',
  },
  preferred_vendor: {
    label: 'Preferred vendor',
    shortLabel: 'Preferred',
    description: 'Best for planners naming the vendors they prefer to work with repeatedly.',
  },
  trusted_collaborator: {
    label: 'Trusted collaborator',
    shortLabel: 'Trusted',
    description: 'A stronger signal for professionals you rely on for steady execution.',
  },
};

export const professionalThreadContextMeta: Record<ProfessionalThreadContext, { label: string; description: string }> = {
  introduction: {
    label: 'Introduction',
    description: 'Start a new working relationship or make a first introduction.',
  },
  booking: {
    label: 'Booking',
    description: 'Use for live quote, date, availability, and scope coordination.',
  },
  partnership: {
    label: 'Partnership',
    description: 'Use for longer-term referral, collaboration, or partner discussions.',
  },
  general: {
    label: 'General',
    description: 'Use for professional follow-up that does not fit a narrower workflow.',
  },
};

export function getRecommendationRequestKindsForRole(role: ProfessionalNetworkRole): ProfessionalRelationshipKind[] {
  if (role === 'planner') {
    return ['recommended', 'worked_with', 'trusted_collaborator'];
  }

  return ['recommended', 'worked_with', 'preferred_vendor', 'trusted_collaborator'];
}

function toPercent(completeCount: number, totalCount: number) {
  if (totalCount === 0) return 0;
  return Math.round((completeCount / totalCount) * 100);
}

export function buildProfessionalNetworkChecklist(
  role: ProfessionalNetworkRole,
  profile: {
    company_name?: string | null;
    bio?: string | null;
    specialties?: string[] | null;
    company_email?: string | null;
    company_phone?: string | null;
    company_website?: string | null;
    primary_county?: string | null;
    service_areas?: string[] | null;
    minimum_budget_kes?: number | null;
    maximum_budget_kes?: number | null;
  },
  vendorListing?: {
    business_name?: string | null;
    description?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    location_county?: string | null;
    service_areas?: string[] | null;
    services?: string[] | null;
    minimum_budget_kes?: number | null;
    maximum_budget_kes?: number | null;
  } | null,
): ProfessionalNetworkChecklist {
  const plannerSteps: ProfessionalNetworkStep[] = [
    {
      key: 'identity',
      label: 'Set your professional identity',
      complete: Boolean(profile.company_name?.trim()),
      helper: 'Add a company or studio name so couples and vendors can recognize you quickly.',
    },
    {
      key: 'bio',
      label: 'Explain what kind of weddings you lead',
      complete: Boolean(profile.bio?.trim()),
      helper: 'A concise bio helps couples and vendors understand your style, strength, and pace.',
    },
    {
      key: 'specialties',
      label: 'Choose clear specialties',
      complete: Boolean(profile.specialties?.length),
      helper: 'Specialties make recommendations and network matching more credible.',
    },
    {
      key: 'location',
      label: 'Add your primary county or service area',
      complete: Boolean(profile.primary_county?.trim() || profile.service_areas?.length),
      helper: 'Local clarity helps vendors and couples know where you work confidently.',
    },
    {
      key: 'contact',
      label: 'Make yourself reachable',
      complete: Boolean(profile.company_email?.trim() || profile.company_phone?.trim() || profile.company_website?.trim()),
      helper: 'At least one public contact path makes professional outreach easier.',
    },
    {
      key: 'budget-band',
      label: 'Set a working budget band',
      complete: profile.minimum_budget_kes != null || profile.maximum_budget_kes != null,
      helper: 'A budget band helps you match with the right couples and vendors faster.',
    },
  ];

  const vendorSteps: ProfessionalNetworkStep[] = [
    {
      key: 'identity',
      label: 'Name your business clearly',
      complete: Boolean(vendorListing?.business_name?.trim()),
      helper: 'A strong business name is the first trust signal for new vendors.',
    },
    {
      key: 'services',
      label: 'List what you actually deliver',
      complete: Boolean(vendorListing?.services?.length),
      helper: 'Services help planners understand whether they should introduce you.',
    },
    {
      key: 'description',
      label: 'Describe your style and reliability',
      complete: Boolean(vendorListing?.description?.trim()),
      helper: 'A short positioning statement makes your profile feel bookable, not empty.',
    },
    {
      key: 'coverage',
      label: 'Show where you work',
      complete: Boolean(vendorListing?.location_county?.trim() || vendorListing?.service_areas?.length),
      helper: 'Coverage matters for referrals, especially in county-based planning.',
    },
    {
      key: 'contact',
      label: 'Add a public contact path',
      complete: Boolean(vendorListing?.email?.trim() || vendorListing?.phone?.trim() || vendorListing?.website?.trim()),
      helper: 'If people cannot reach you easily, the network cannot convert into bookings.',
    },
    {
      key: 'budget-band',
      label: 'Set a budget range',
      complete: vendorListing?.minimum_budget_kes != null || vendorListing?.maximum_budget_kes != null,
      helper: 'A realistic budget band helps planners know when to introduce you.',
    },
  ];

  const steps = role === 'planner' ? plannerSteps : vendorSteps;
  const completeCount = steps.filter((step) => step.complete).length;
  const totalCount = steps.length;

  return {
    score: toPercent(completeCount, totalCount),
    completeCount,
    totalCount,
    headline: role === 'planner'
      ? 'Build a planner profile vendors and couples can trust.'
      : 'Build a vendor profile planners can confidently introduce.',
    steps,
  };
}

export function formatProfessionalRelationshipSummary(kind: ProfessionalRelationshipKind, targetName: string) {
  const meta = professionalRelationshipMeta[kind];
  return `${meta.label} · ${targetName}`;
}
