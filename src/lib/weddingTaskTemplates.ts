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
  timelineLabel?: string | null;
}

export interface WeddingTaskCategoryDefaults {
  category: string;
  visibility: WeddingTaskVisibility;
  delegatable: boolean;
  recommendedRole: string | null;
  priorityLevel: 1 | 2 | 3 | 4;
}

export interface SuggestedTaskTemplateOption {
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
  timelineLabel: string | null;
}

interface VendorWorkflowConfig {
  visibility: WeddingTaskVisibility;
  priorityLevel: 1 | 2 | 3 | 4;
  secondPaymentRole: string | null;
  closureRole: string | null;
}

const roleByCategory: Record<string, VendorWorkflowConfig> = {
  Venue: { visibility: 'public', priorityLevel: 1, secondPaymentRole: 'Aesthetics Coordinator', closureRole: 'Aesthetics Coordinator' },
  'Venue (Ceremony)': { visibility: 'public', priorityLevel: 1, secondPaymentRole: 'Aesthetics Coordinator', closureRole: 'Secretary' },
  'Venue (Reception)': { visibility: 'public', priorityLevel: 1, secondPaymentRole: 'Aesthetics Coordinator', closureRole: 'Secretary' },
  'Venue (Photo Shoot)': { visibility: 'public', priorityLevel: 1, secondPaymentRole: 'Aesthetics Coordinator', closureRole: 'Secretary' },
  Catering: { visibility: 'public', priorityLevel: 3, secondPaymentRole: 'Edibles Coordinator', closureRole: 'Edibles Coordinator' },
  Photography: { visibility: 'public', priorityLevel: 3, secondPaymentRole: 'Experience Coordinator', closureRole: 'Experience Coordinator' },
  Photographer: { visibility: 'public', priorityLevel: 3, secondPaymentRole: 'Experience Coordinator', closureRole: 'Secretary' },
  Cinematographer: { visibility: 'public', priorityLevel: 3, secondPaymentRole: 'Experience Coordinator', closureRole: 'Secretary' },
  Flowers: { visibility: 'public', priorityLevel: 3, secondPaymentRole: 'Aesthetics Coordinator', closureRole: 'Aesthetics Coordinator' },
  Décor: { visibility: 'public', priorityLevel: 3, secondPaymentRole: 'Aesthetics Coordinator', closureRole: 'Aesthetics Coordinator' },
  Decor: { visibility: 'public', priorityLevel: 3, secondPaymentRole: 'Aesthetics Coordinator', closureRole: 'Aesthetics Coordinator' },
  Setup: { visibility: 'public', priorityLevel: 4, secondPaymentRole: 'Aesthetics Coordinator', closureRole: 'Aesthetics Coordinator' },
  Transport: { visibility: 'public', priorityLevel: 3, secondPaymentRole: 'Logistics Coordinator', closureRole: 'Logistics Coordinator' },
  Videography: { visibility: 'public', priorityLevel: 3, secondPaymentRole: 'Experience Coordinator', closureRole: 'Experience Coordinator' },
  'Music/DJ': { visibility: 'public', priorityLevel: 3, secondPaymentRole: 'Experience Coordinator', closureRole: 'Experience Coordinator' },
  'Music and Sound (DJ / Band)': { visibility: 'public', priorityLevel: 3, secondPaymentRole: 'Experience Coordinator', closureRole: 'Secretary' },
  MC: { visibility: 'public', priorityLevel: 3, secondPaymentRole: 'Experience Coordinator', closureRole: 'Experience Coordinator' },
  Cake: { visibility: 'public', priorityLevel: 3, secondPaymentRole: 'Edibles Coordinator', closureRole: 'Edibles Coordinator' },
  Stationery: { visibility: 'public', priorityLevel: 1, secondPaymentRole: 'Stationery Coordinator', closureRole: 'Stationery Coordinator' },
  Legal: { visibility: 'private', priorityLevel: 1, secondPaymentRole: null, closureRole: null },
  Registry: { visibility: 'private', priorityLevel: 2, secondPaymentRole: null, closureRole: null },
  Family: { visibility: 'private', priorityLevel: 2, secondPaymentRole: null, closureRole: null },
  Committee: { visibility: 'public', priorityLevel: 3, secondPaymentRole: null, closureRole: null },
  Logistics: { visibility: 'public', priorityLevel: 2, secondPaymentRole: 'Chair', closureRole: 'Chair' },
  Security: { visibility: 'public', priorityLevel: 4, secondPaymentRole: 'Security Coordinator', closureRole: 'Security Coordinator' },
  Ushering: { visibility: 'public', priorityLevel: 4, secondPaymentRole: 'Ushers Coordinator', closureRole: 'Ushers Coordinator' },
  'Officiating Minister': { visibility: 'public', priorityLevel: 1, secondPaymentRole: null, closureRole: null },
  'Bride Body Preparation': { visibility: 'private', priorityLevel: 2, secondPaymentRole: null, closureRole: null },
  "Bride's Body Preparation": { visibility: 'private', priorityLevel: 2, secondPaymentRole: null, closureRole: null },
  "Groom's Body Preparation": { visibility: 'private', priorityLevel: 3, secondPaymentRole: null, closureRole: null },
  'Bride Body Preparation (Pedi-Mani, Facials)': { visibility: 'private', priorityLevel: 3, secondPaymentRole: null, closureRole: null },
  'Groom Body Preparation (Pedi-Mani, Facials)': { visibility: 'private', priorityLevel: 3, secondPaymentRole: null, closureRole: null },
  'Hair Stylist': { visibility: 'private', priorityLevel: 3, secondPaymentRole: null, closureRole: 'Best Lady' },
  'Make-Up Artist': { visibility: 'private', priorityLevel: 3, secondPaymentRole: null, closureRole: 'Best Lady' },
  "Bride's Gown": { visibility: 'private', priorityLevel: 2, secondPaymentRole: null, closureRole: 'Best Lady' },
  "Groom's Attire": { visibility: 'private', priorityLevel: 2, secondPaymentRole: null, closureRole: 'Best Man' },
  "Couple's Rings": { visibility: 'private', priorityLevel: 1, secondPaymentRole: null, closureRole: null },
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

const spreadsheetDetailedTemplates: WeddingTaskTemplate[] = [
  {
    key: 'records-bio-data',
    title: 'Bio Data',
    category: 'Records',
    description: 'Fill in your names, future family name, phone numbers, and email addresses in the wedding records.',
    phase: 'foundation',
    visibility: 'public',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 1,
    timelineOffsetMonths: 14,
    timelineLabel: '14 Months',
  },
  {
    key: 'records-family-bio-data',
    title: 'Family Bio Data',
    category: 'Records',
    description: 'Capture the names, phone numbers, and email addresses of parents and key family contacts.',
    phase: 'foundation',
    visibility: 'public',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 2,
    timelineOffsetMonths: 14,
    timelineLabel: '14 Months',
  },
  {
    key: 'records-venue-details',
    title: 'Venue Details',
    category: 'Records',
    description: 'Key in all venue details that will be used at different points of the wedding.',
    phase: 'selection_booking',
    visibility: 'public',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 2,
    timelineOffsetMonths: 9,
    timelineLabel: '9 Months',
  },
  {
    key: 'records-personal-public-budget',
    title: 'Personal and Public Budget',
    category: 'Records',
    description: 'Write down your personal and public wedding budgets using estimates gathered from research.',
    phase: 'foundation',
    visibility: 'private',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 2,
    timelineOffsetMonths: 10,
    timelineLabel: '10 Months',
  },
  {
    key: 'records-record-management',
    title: 'Record Management',
    category: 'Records',
    description: 'Hand over records to the planner or secretary, track task status, keep planning minutes, and maintain the budget accountability trail.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Secretary',
    priorityLevel: 3,
    timelineOffsetMonths: 2,
    timelineLabel: '8 Weeks',
  },
  {
    key: 'records-program-participants',
    title: 'Program Participants',
    category: 'Records',
    description: 'Fill in the wedding program participants list and keep it updated before the ceremony.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Secretary',
    priorityLevel: 3,
    timelineOffsetMonths: 1,
    timelineLabel: '3 Weeks',
  },
  {
    key: 'records-photo-list',
    title: 'Photo List',
    category: 'Records',
    description: 'Prepare the list of group photo combinations the media team should capture after the ceremony.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 3,
    timelineOffsetMonths: 1,
    timelineLabel: '3 Weeks',
  },
  {
    key: 'records-record-availability',
    title: 'Record Availability',
    category: 'Records',
    description: 'Ensure all wedding records and databases are physically available and handed over on the wedding day.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Secretary',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'records-contracts',
    title: 'Contracts',
    category: 'Records',
    description: 'Ensure all vendors have signed contracts with the couple and the signed copies are available.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Secretary',
    priorityLevel: 3,
    timelineOffsetMonths: 1,
    timelineLabel: '6 Weeks',
  },
  {
    key: 'logistics-meetings',
    title: 'Logistics Meetings',
    category: 'Logistics',
    description: 'Chair all logistics meetings, including committee meetings, vendor site visits, and bridal party rehearsals.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Chair',
    priorityLevel: 3,
    timelineOffsetMonths: null,
    timelineLabel: 'Ongoing Task',
  },
  {
    key: 'logistics-coordination',
    title: 'Coordination',
    category: 'Logistics',
    description: 'Coordinate logistics before and during the wedding so all assigned responsibilities are carried through.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Chair',
    priorityLevel: 3,
    timelineOffsetMonths: null,
    timelineLabel: 'Ongoing Task',
  },
  {
    key: 'logistics-time-keeping',
    title: 'Time Keeping',
    category: 'Logistics',
    description: 'Own the wedding-day running order and keep the ceremony and reception flowing according to the agreed program.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Chair',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'logistics-committee-meeting',
    title: 'Logistics Committee',
    category: 'Logistics',
    description: 'Select the people who are reliable and available to help run the wedding day for you.',
    phase: 'second_payment',
    visibility: 'public',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 2,
    timelineOffsetMonths: 5,
    timelineLabel: '5 Months',
  },
  {
    key: 'committee-site-visit',
    title: 'Site Visit',
    category: 'Committee',
    description: 'Carry out a site visit with your committee to align logistics and confirm venue readiness.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 3,
    timelineOffsetMonths: 1,
    timelineLabel: '3 Weeks',
  },
  {
    key: 'registry-gift-registry-visit',
    title: 'Gift Registry',
    category: 'Registry',
    description: 'Visit the selected stores and finalize the gift registry items for guests.',
    phase: 'closure_final_payment',
    visibility: 'private',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 2,
    timelineOffsetMonths: 3,
    timelineLabel: '3 Months',
  },
  {
    key: 'legal-wedding-permit-interview',
    title: 'Wedding Permit Interview',
    category: 'Legal',
    description: 'Attend the wedding permit interview and complete all legal requirements in time.',
    phase: 'closure_final_payment',
    visibility: 'private',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 1,
    timelineOffsetMonths: 2,
    timelineLabel: '8 Weeks',
  },
  {
    key: 'legal-wedding-permit-collection',
    title: 'Wedding Permit Collection',
    category: 'Legal',
    description: 'Collect the permit and provide a copy to the officiating minister before the wedding.',
    phase: 'closure_final_payment',
    visibility: 'private',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 1,
    timelineOffsetMonths: 1,
    timelineLabel: '4 Weeks',
  },
  {
    key: 'officiating-minister-meeting',
    title: 'Officiant Meeting',
    category: 'Officiating Minister',
    description: 'Meet with the officiating minister, walk through the program, and request a copy of their license.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 1,
    timelineOffsetMonths: 3,
    timelineLabel: '3 Months',
  },
  {
    key: 'officiating-minister-rehearsal',
    title: 'Rehearsal with Officiant',
    category: 'Officiating Minister',
    description: 'Attend the final rehearsal with the officiant before the wedding day.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 1,
    timelineOffsetMonths: 0,
    timelineLabel: '1 Week',
  },
  {
    key: 'family-meeting',
    title: 'Family Meeting',
    category: 'Family',
    description: 'Meet with both families to review the wedding program, speeches, cake matron, and logistics expectations.',
    phase: 'closure_final_payment',
    visibility: 'private',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 2,
    timelineOffsetMonths: 1,
    timelineLabel: '4 Weeks',
  },
  {
    key: 'transport-vehicle-numbers',
    title: 'Needed Vehicle Numbers',
    category: 'Transport',
    description: 'Determine how many vehicles and drivers are needed for the couple, bridal party, parents, and gifts.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Transport Coordinator',
    priorityLevel: 3,
    timelineOffsetMonths: 1,
    timelineLabel: '6 Weeks',
  },
  {
    key: 'transport-route-plans',
    title: 'Route Plans',
    category: 'Transport',
    description: 'Design the transfer routes that will be used on the wedding day between home, ceremony, and reception.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Transport Coordinator',
    priorityLevel: 3,
    timelineOffsetMonths: 1,
    timelineLabel: '6 Weeks',
  },
  {
    key: 'transport-transfer-key-people',
    title: 'Transfer of Key People',
    category: 'Transport',
    description: 'Organize transport for the bride, groom, best couple, and both sets of parents on the wedding day.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Transport Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'transport-transfer-teams',
    title: 'Transfer of Teams',
    category: 'Transport',
    description: 'Ensure transport teams can move ushers and security staff from the ceremony to the reception smoothly.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Transport Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'transport-transfer-gifts',
    title: 'Transfer of Gifts',
    category: 'Transport',
    description: 'Ensure gifts are moved safely into storage after the function with the proper vehicle registration and security handling.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Transport Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'ushering-family-ushers',
    title: 'Family Ushers',
    category: 'Ushering',
    description: 'Find ushers from each family who understand the relationships and can guide guests confidently.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Ushers Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 2,
    timelineLabel: '7 Weeks',
  },
  {
    key: 'ushering-team',
    title: 'Ushering Team',
    category: 'Ushering',
    description: 'Recruit and brief the full ushering team to support seating, movement, and guest support.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Ushers Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 2,
    timelineLabel: '7 Weeks',
  },
  {
    key: 'ushering-arrival',
    title: 'Arrival of Ushers',
    category: 'Ushering',
    description: 'Ensure the ushers arrive at the venue well before guests start arriving.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Ushers Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'ushering-management',
    title: 'Management of Ushering Team',
    category: 'Ushering',
    description: 'Lead the ushering team in seating guests, directing food service queues, and helping families move around the venue.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Ushers Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'security-team',
    title: 'Security Team',
    category: 'Security',
    description: 'Recruit and brief the security team that will support venue access, gift security, and guest safety.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Security Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 2,
    timelineLabel: '7 Weeks',
  },
  {
    key: 'security-arrival',
    title: 'Arrival of Security',
    category: 'Security',
    description: 'Ensure the security team is at the venue before the wedding begins.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Security Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'security-management',
    title: 'Management of Security Team',
    category: 'Security',
    description: 'Lead the security team around parking, gifts, paparazzi control, cake safety, and venue security requirements.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Security Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'stationery-invitations',
    title: 'Invitations Cards',
    category: 'Stationery',
    description: 'Send out invitation cards and make sure all final guest-facing stationery is ready.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Stationery Coordinator',
    priorityLevel: 3,
    timelineOffsetMonths: 1,
    timelineLabel: '6 Weeks',
  },
  {
    key: 'stationery-signage',
    title: 'Signage and Badges',
    category: 'Stationery',
    description: 'Place signage in the right positions and hand over relevant badges to ushers, security, media, and overall coordinators.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Stationery Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'stationery-gift-team',
    title: 'Management of Gifts Team',
    category: 'Stationery',
    description: 'Lead the gifts team, receive gifts properly, and keep the monetary token box secure with the Best Man after the wedding.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Stationery Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'bridal-party-meeting',
    title: 'Bridal Party Meeting',
    category: 'Bridal Party',
    description: 'Meet with the full bridal party and discuss attire, trials, sleeping arrangements, rehearsal date, and the morning schedule.',
    phase: 'second_payment',
    visibility: 'public',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 3,
    timelineOffsetMonths: 5,
    timelineLabel: '5 Months',
  },
  {
    key: 'bridal-party-rehearsals',
    title: 'Bridal Party Rehearsals',
    category: 'Bridal Party',
    description: 'Meet with the bridal party and run the rehearsal for procession and role clarity.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: false,
    recommendedRole: null,
    priorityLevel: 3,
    timelineOffsetMonths: 0,
    timelineLabel: '3 Weeks',
  },
  {
    key: 'mc-arrival',
    title: 'MC Arrival',
    category: 'MC',
    description: 'Ensure the MC is at the venue at the agreed time and fully familiar with the wedding-day program.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Experience Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'music-arrival',
    title: 'Music and Sound Arrival',
    category: 'Music and Sound (DJ / Band)',
    description: 'Ensure the DJ or band arrives early, equipment is delivered, and sound setup is completed before the function starts.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Experience Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'photographer-arrival',
    title: 'Photographer Arrival',
    category: 'Photographer',
    description: 'Ensure the photographers are at the agreed venue and ready at the agreed time.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Experience Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'cinematographer-arrival',
    title: 'Cinematographer Arrival',
    category: 'Cinematographer',
    description: 'Ensure the cinematographers are at the agreed venue and ready at the agreed time.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Experience Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'hair-artist-arrival',
    title: 'Hair Stylist Artist Arrival',
    category: 'Hair Stylist',
    description: 'Ensure the hair stylist is at the agreed venue and time on the wedding day.',
    phase: 'closure_final_payment',
    visibility: 'private',
    delegatable: true,
    recommendedRole: 'Best Lady',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'makeup-artist-arrival',
    title: 'Make-Up Artist Arrival',
    category: 'Make-Up Artist',
    description: 'Ensure the make-up artist is at the agreed venue and time on the wedding day.',
    phase: 'closure_final_payment',
    visibility: 'private',
    delegatable: true,
    recommendedRole: 'Best Lady',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'catering-delivery-food',
    title: 'Delivery of Food',
    category: 'Catering',
    description: 'Ensure food and drinks are ready, delivered at the agreed times, and meet the expected quality and quantity.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Edibles Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'catering-food-service-teams',
    title: 'Food Service for Teams',
    category: 'Catering',
    description: 'Ensure key teams like ushers, security, transport, photographers, videographers, and entertainment are served at practical times.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Edibles Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'cake-delivery',
    title: 'Delivery of Cake',
    category: 'Cake',
    description: 'Ensure the cake is delivered in good time, in good condition, and placed in the designated position.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Edibles Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'setup-ceremony',
    title: 'Ceremony Setup',
    category: 'Setup',
    description: 'Ensure ceremony chairs, tents, and tables are delivered and dressed as agreed at least two hours before start time.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Aesthetics Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'setup-reception',
    title: 'Reception Setup',
    category: 'Setup',
    description: 'Ensure reception chairs, tents, and tables are delivered and dressed as agreed ahead of the service.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Aesthetics Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'decor-ceremony',
    title: 'Ceremony Décor',
    category: 'Decor',
    description: 'Ensure ceremony décor is set up as agreed at least two hours before the wedding ceremony starts.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Aesthetics Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
  {
    key: 'decor-reception',
    title: 'Reception Décor',
    category: 'Decor',
    description: 'Ensure service and reception areas are decorated as agreed in time for the service.',
    phase: 'closure_final_payment',
    visibility: 'public',
    delegatable: true,
    recommendedRole: 'Aesthetics Coordinator',
    priorityLevel: 4,
    timelineOffsetMonths: 0,
    timelineLabel: 'Wedding Day',
  },
];

export function getVendorWorkflowTemplates(category: string): WeddingTaskTemplate[] {
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

  templates.push(...spreadsheetDetailedTemplates);

  for (const category of input.vendorCategories) {
    templates.push(...getVendorWorkflowTemplates(category));
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

export function getTaskCategoryDefaults(input: {
  category: string;
  role: string | null | undefined;
  plannerType?: PlannerType | null;
}): WeddingTaskCategoryDefaults | null {
  const templates = getWeddingTaskTemplates({
    vendorCategories: [input.category],
    role: input.role,
    plannerType: input.plannerType,
  }).filter((template) => template.category === input.category);

  if (!templates.length) return null;

  const [bestTemplate] = templates
    .slice()
    .sort((left, right) => {
      if (left.priorityLevel !== right.priorityLevel) return left.priorityLevel - right.priorityLevel;
      const leftTimeline = left.timelineOffsetMonths ?? Number.MAX_SAFE_INTEGER;
      const rightTimeline = right.timelineOffsetMonths ?? Number.MAX_SAFE_INTEGER;
      if (leftTimeline !== rightTimeline) return rightTimeline - leftTimeline;
      return left.title.localeCompare(right.title);
    });

  const recommendedRole =
    templates.find((template) => template.recommendedRole)?.recommendedRole ?? bestTemplate.recommendedRole ?? null;

  return {
    category: input.category,
    visibility: bestTemplate.visibility,
    delegatable: templates.some((template) => template.delegatable),
    recommendedRole,
    priorityLevel: bestTemplate.priorityLevel,
  };
}

export function getSuggestedTaskCategories(input: {
  vendorCategories?: string[];
  role: string | null | undefined;
  plannerType?: PlannerType | null;
}) {
  const templates = getWeddingTaskTemplates({
    vendorCategories: input.vendorCategories ?? [],
    role: input.role,
    plannerType: input.plannerType,
  });

  return [...new Set(templates.map((template) => template.category))].sort((left, right) => left.localeCompare(right));
}

export function getSuggestedTaskTemplates(input: {
  category: string;
  vendorCategories?: string[];
  role: string | null | undefined;
  plannerType?: PlannerType | null;
}) {
  const templates = getWeddingTaskTemplates({
    vendorCategories: input.vendorCategories ?? [],
    role: input.role,
    plannerType: input.plannerType,
  })
    .filter((template) => template.category === input.category)
    .sort((left, right) => {
      const leftTimeline = left.timelineOffsetMonths ?? Number.MAX_SAFE_INTEGER;
      const rightTimeline = right.timelineOffsetMonths ?? Number.MAX_SAFE_INTEGER;
      if (leftTimeline !== rightTimeline) return rightTimeline - leftTimeline;
      if (left.priorityLevel !== right.priorityLevel) return left.priorityLevel - right.priorityLevel;
      return left.title.localeCompare(right.title);
    });

  const deduped = new Map<string, SuggestedTaskTemplateOption>();
  for (const template of templates) {
    const key = `${template.category}::${template.title}`;
    if (deduped.has(key)) continue;
    deduped.set(key, {
      key: template.key,
      title: template.title,
      category: template.category,
      description: template.description,
      phase: template.phase,
      visibility: template.visibility,
      delegatable: template.delegatable,
      recommendedRole: template.recommendedRole,
      priorityLevel: template.priorityLevel,
      timelineOffsetMonths: template.timelineOffsetMonths,
      timelineLabel: template.timelineLabel ?? null,
    });
  }

  return [...deduped.values()];
}
