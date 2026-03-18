import type { PlannerType } from '@/lib/roles';

export type WeddingTaskPhase =
  | 'foundation'
  | 'research'
  | 'selection_booking'
  | 'second_payment'
  | 'closure_final_payment';

export type WeddingTaskVisibility = 'private' | 'public';

export interface WeddingTaskTemplate {
  key: string;
  title: string;
  category: string;
  description: string;
  phase: WeddingTaskPhase;
  visibility: WeddingTaskVisibility;
  delegatable: boolean;
  recommendedRole: string | null;
  priorityLevel: 1 | 2 | 3 | 4;
  timelineOffsetMonths: number | null;
}

interface VendorWorkflowConfig {
  visibility: WeddingTaskVisibility;
  priorityLevel: 1 | 2 | 3 | 4;
  secondPaymentRole: string | null;
  closureRole: string | null;
}

const roleByCategory: Record<string, VendorWorkflowConfig> = {
  Venue: { visibility: 'public', priorityLevel: 1, secondPaymentRole: 'Aesthetics Coordinator', closureRole: 'Aesthetics Coordinator' },
  Catering: { visibility: 'public', priorityLevel: 3, secondPaymentRole: 'Edibles Coordinator', closureRole: 'Edibles Coordinator' },
  Photography: { visibility: 'public', priorityLevel: 3, secondPaymentRole: 'Experience Coordinator', closureRole: 'Experience Coordinator' },
  Flowers: { visibility: 'public', priorityLevel: 3, secondPaymentRole: 'Aesthetics Coordinator', closureRole: 'Aesthetics Coordinator' },
  Décor: { visibility: 'public', priorityLevel: 3, secondPaymentRole: 'Aesthetics Coordinator', closureRole: 'Aesthetics Coordinator' },
  Transport: { visibility: 'public', priorityLevel: 3, secondPaymentRole: 'Logistics Coordinator', closureRole: 'Logistics Coordinator' },
  Videography: { visibility: 'public', priorityLevel: 3, secondPaymentRole: 'Experience Coordinator', closureRole: 'Experience Coordinator' },
  'Music/DJ': { visibility: 'public', priorityLevel: 3, secondPaymentRole: 'Experience Coordinator', closureRole: 'Experience Coordinator' },
  MC: { visibility: 'public', priorityLevel: 3, secondPaymentRole: 'Experience Coordinator', closureRole: 'Experience Coordinator' },
  Cake: { visibility: 'public', priorityLevel: 3, secondPaymentRole: 'Edibles Coordinator', closureRole: 'Edibles Coordinator' },
  Stationery: { visibility: 'public', priorityLevel: 1, secondPaymentRole: 'Stationery Coordinator', closureRole: 'Stationery Coordinator' },
  'Couple Rings': { visibility: 'private', priorityLevel: 1, secondPaymentRole: null, closureRole: null },
  'Bride Attire': { visibility: 'private', priorityLevel: 2, secondPaymentRole: null, closureRole: null },
  'Groom Attire': { visibility: 'private', priorityLevel: 2, secondPaymentRole: null, closureRole: null },
  Honeymoon: { visibility: 'private', priorityLevel: 2, secondPaymentRole: null, closureRole: null },
};

const sharedFoundationTemplates: WeddingTaskTemplate[] = [
  {
    key: 'records-wedding-details',
    title: 'Capture your wedding details',
    category: 'Records',
    description: 'Document the wedding date, theme, colours, guest target, and headline priorities before detailed planning starts.',
    phase: 'foundation',
    visibility: 'public',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 1,
    timelineOffsetMonths: 14,
  },
  {
    key: 'records-wedding-calendar',
    title: 'Map the wedding calendar',
    category: 'Records',
    description: 'Set the dates for key events leading up to the wedding so vendors and family work from the same sequence.',
    phase: 'foundation',
    visibility: 'public',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 2,
    timelineOffsetMonths: 14,
  },
  {
    key: 'records-family-database',
    title: 'Capture key family contacts',
    category: 'Records',
    description: 'Add parents, siblings, and other priority contacts who will matter during approvals and wedding-day coordination.',
    phase: 'foundation',
    visibility: 'public',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 2,
    timelineOffsetMonths: 14,
  },
  {
    key: 'records-wedding-program',
    title: 'Draft the wedding program',
    category: 'Records',
    description: 'Build the day-of program from wake-up through reception close so vendors, family, and the committee align on timing.',
    phase: 'foundation',
    visibility: 'public',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 2,
    timelineOffsetMonths: 9,
  },
  {
    key: 'records-budget-framework',
    title: 'Set the personal and wedding budget framework',
    category: 'Budget',
    description: 'Separate personal/private spending from the public wedding budget and fill both with working estimates from your research.',
    phase: 'foundation',
    visibility: 'private',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 2,
    timelineOffsetMonths: 10,
  },
  {
    key: 'bridal-party-selection',
    title: 'Confirm the bridal party line-up',
    category: 'Bridal Party',
    description: 'Choose the people who are reliable, willing, and available to stand with you and carry the related responsibilities.',
    phase: 'foundation',
    visibility: 'private',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 2,
    timelineOffsetMonths: 6,
  },
  {
    key: 'logistics-committee-selection',
    title: 'Appoint the logistics committee',
    category: 'Logistics',
    description: 'Select the people who will help run the wedding day and confirm they are available for the key coordination roles.',
    phase: 'foundation',
    visibility: 'public',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 2,
    timelineOffsetMonths: 5,
  },
  {
    key: 'officiant-selection',
    title: 'Choose the officiant and church requirements',
    category: 'Officiating Minister',
    description: 'Confirm who will officiate the wedding, book a meeting, and capture any church or officiant requirements early.',
    phase: 'foundation',
    visibility: 'public',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 1,
    timelineOffsetMonths: 4,
  },
  {
    key: 'legal-wedding-permit',
    title: 'Apply for the wedding permit',
    category: 'Legal',
    description: 'Prepare the legal paperwork, submit the permit application, and track the issue date so it does not become a last-minute blocker.',
    phase: 'foundation',
    visibility: 'private',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 1,
    timelineOffsetMonths: 3,
  },
  {
    key: 'registry-gift-list',
    title: 'Set up the gift registry',
    category: 'Registry',
    description: 'Create the gift registry or gifting guidance you want guests to see before invitations and RSVP details go out.',
    phase: 'foundation',
    visibility: 'private',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 2,
    timelineOffsetMonths: 3,
  },
];

const coupleOnlyTemplates: WeddingTaskTemplate[] = [
  {
    key: 'premarital-classes',
    title: 'Choose and book pre-marital counselling classes',
    category: 'Pre-Marital Counselling',
    description: 'Confirm where you will attend pre-marital classes, find the next available intake, and lock in your place.',
    phase: 'foundation',
    visibility: 'private',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 1,
    timelineOffsetMonths: 18,
  },
  {
    key: 'post-wedding-home-plan',
    title: 'Decide where you will live after the wedding',
    category: 'Post Wedding Preparation',
    description: 'Make the post-wedding home decision early and track deposits, move-in timing, and any setup costs separately from the public wedding budget.',
    phase: 'foundation',
    visibility: 'private',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 2,
    timelineOffsetMonths: 4,
  },
  {
    key: 'health-family-planning',
    title: 'Book the family health consultation',
    category: 'Bride Body Preparation',
    description: 'Choose a family health or gynaecology consultation and set the appointment early enough to act on the recommendations before the wedding.',
    phase: 'foundation',
    visibility: 'private',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 2,
    timelineOffsetMonths: 4,
  },
];

function buildVendorWorkflowTasks(category: string): WeddingTaskTemplate[] {
  const config = roleByCategory[category] ?? {
    visibility: 'public' as const,
    priorityLevel: 3 as const,
    secondPaymentRole: null,
    closureRole: null,
  };

  const lower = category.toLowerCase();

  return [
    {
      key: `${category}-research`,
      title: `${category}: Research and shortlist top options`,
      category,
      description: `Research ${lower} options, inspect quality of service, compare pricing, and narrow the list to the strongest candidates.`,
      phase: 'research',
      visibility: config.visibility,
      delegatable: false,
      recommendedRole: null,
      priorityLevel: config.priorityLevel,
      timelineOffsetMonths: 12,
    },
    {
      key: `${category}-selection-booking`,
      title: `${category}: Selection, contract, and booking`,
      category,
      description: `Choose the preferred ${lower} provider, confirm scope and deliverables, pay the deposit, and lock in the contract.`,
      phase: 'selection_booking',
      visibility: config.visibility,
      delegatable: false,
      recommendedRole: null,
      priorityLevel: config.priorityLevel,
      timelineOffsetMonths: 8,
    },
    {
      key: `${category}-second-payment`,
      title: `${category}: Second payment and service review`,
      category,
      description: `Make the next scheduled payment, resolve open questions, and confirm any service details that affect the wedding-day experience.`,
      phase: 'second_payment',
      visibility: config.visibility,
      delegatable: Boolean(config.secondPaymentRole),
      recommendedRole: config.secondPaymentRole,
      priorityLevel: config.priorityLevel,
      timelineOffsetMonths: 5,
    },
    {
      key: `${category}-closure`,
      title: `${category}: Final confirmation and balance`,
      category,
      description: `Confirm final delivery details, close any outstanding balance, and make sure the vendor is aligned with the day-of schedule.`,
      phase: 'closure_final_payment',
      visibility: config.visibility,
      delegatable: Boolean(config.closureRole),
      recommendedRole: config.closureRole,
      priorityLevel: config.priorityLevel,
      timelineOffsetMonths: 2,
    },
  ];
}

function subtractMonths(date: Date, months: number) {
  const clone = new Date(date);
  clone.setMonth(clone.getMonth() - months);
  return clone;
}

export function getWeddingTaskTemplates(input: {
  vendorCategories: string[];
  role: string | null | undefined;
  plannerType?: PlannerType | null;
}) {
  const templates = [...sharedFoundationTemplates];

  if (input.role === 'couple') {
    templates.push(...coupleOnlyTemplates);
  }

  for (const category of input.vendorCategories) {
    templates.push(...buildVendorWorkflowTasks(category));
  }

  return templates;
}

export function buildSeededTasksFromTemplates(input: {
  vendorCategories: string[];
  role: string | null | undefined;
  plannerType?: PlannerType | null;
  weddingDate?: string | null;
}) {
  const templates = getWeddingTaskTemplates(input);
  const weddingDate = input.weddingDate ? new Date(input.weddingDate) : null;

  return templates.map((template) => ({
    title: template.title,
    description: template.description,
    category: template.category,
    assigned_to: null,
    due_date:
      weddingDate && template.timelineOffsetMonths != null
        ? subtractMonths(weddingDate, template.timelineOffsetMonths).toISOString().slice(0, 10)
        : null,
    completed: false,
    phase: template.phase,
    visibility: template.visibility,
    delegatable: template.delegatable,
    recommended_role: template.recommendedRole,
    priority_level: template.priorityLevel,
    template_source: 'planner_spreadsheet_v1',
  }));
}
