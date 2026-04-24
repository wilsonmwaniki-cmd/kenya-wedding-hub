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

type RawChecklistRow = readonly [
  key: string,
  category: string,
  title: string,
  timelineLabel: string,
  visibilityRaw: string,
  delegatableRaw: string,
  recommendedRole: string | null,
];

const RAW_CHECKLIST_ROWS: RawChecklistRow[] = [
  [
    "marriage-preparation-research-marriage-preparation-therapy-classes",
    "Marriage Preparation",
    "Research marriage preparation therapy / classes.",
    "18 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "marriage-preparation-lock-in-selected-marriage-preparation-therapy-classes-with-deposit-pl",
    "Marriage Preparation",
    "Lock in selected marriage preparation therapy / classes with deposit | Plan to attend",
    "14 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "rings-research-wedding-rings",
    "Rings",
    "Research wedding rings",
    "14 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "bridal-gown-accessories-preparation-research-bridal-gowns",
    "Bridal Gown, Accessories, Preparation",
    "Research bridal gowns",
    "14 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "grooms-attire-and-accessories-preparation-research-grooms-attire",
    "Groom's Attire & Accessories, Preparation",
    "Research groom's attire",
    "14 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "couples-tasks-decide-on-a-wedding-date",
    "Couple's Tasks",
    "Decide on a wedding date",
    "14 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "church-and-officiating-minister-research-churches-and-officiating-ministers-decide-if-chur",
    "Church & Officiating Minister",
    "Research churches and officiating ministers | Decide if church or garden wedding",
    "13 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "wedding-planner-planning-team-research-wedding-planners",
    "Wedding Planner / Planning Team",
    "Research wedding planners",
    "13 Months",
    "private",
    "",
    null
  ],
  [
    "wedding-venue-research-wedding-venues",
    "Wedding Venue",
    "Research wedding venues",
    "13 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "photo-shoot-venue-research-photo-shoot-venues",
    "Photo Shoot Venue",
    "Research photo shoot venues",
    "13 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "couples-tasks-research-where-you-shall-live-as-a-couple-after-the-wedding-if-applicable",
    "Couple's Tasks",
    "Research where you shall live as a couple after the wedding (if applicable)",
    "13 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "invitations-research-invitation-cards-vendor",
    "Invitations",
    "Research invitation cards vendor",
    "12 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "d-cor-tents-chairs-tables-research-d-corators",
    "Décor, Tents, Chairs, Tables",
    "Research décorators",
    "12 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "caterer-research-caterers",
    "Caterer",
    "Research caterers",
    "12 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "photographer-research-photographers",
    "Photographer",
    "Research photographers",
    "12 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "cinematographer-research-cinematographers",
    "Cinematographer",
    "Research cinematographers",
    "12 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "honeymoon-research-honeymoon-destinations",
    "Honeymoon",
    "Research honeymoon destinations",
    "11 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "master-of-ceremonies-research-master-of-ceremonies",
    "Master of Ceremonies",
    "Research master of ceremonies",
    "11 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "dj-or-band-and-sound-research-djs-or-bands",
    "DJ (or Band) and Sound",
    "Research DJs (or bands)",
    "11 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "cake-artist-and-baker-research-cake-artist-bakers",
    "Cake Artist & Baker",
    "Research cake artist / bakers",
    "11 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "hair-stylist-research-hair-stylists",
    "Hair Stylist",
    "Research hair stylists",
    "10 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "make-up-artist-research-make-up-artists",
    "Make-up Artist",
    "Research make-up artists",
    "10 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "couples-tasks-map-out-the-dates-for-the-key-events-leading-up-to-the-wedding-day",
    "Couple's Tasks",
    "Map out the dates for the key events leading up to the wedding day",
    "10 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "wedding-planner-planning-team-lock-in-wedding-planner-plan-future-payment-or-select-the-pe",
    "Wedding Planner / Planning Team",
    "Lock in wedding planner | Plan future payment OR Select the people who shall form your planning team",
    "10 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "church-and-officiating-minister-lock-in-church-and-officiating-minister-with-payment-if-re",
    "Church & Officiating Minister",
    "Lock in church and officiating minister with payment (if required)",
    "9 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "wedding-venue-lock-in-wedding-venue-with-a-deposit-plan-future-payment-dates",
    "Wedding Venue",
    "Lock in wedding venue with a deposit | Plan future payment dates",
    "9 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "photo-shoot-venue-lock-in-photo-shoot-venue-with-a-deposit-plan-future-payment-dates",
    "Photo Shoot Venue",
    "Lock in photo shoot venue with a deposit | Plan future payment dates",
    "9 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "rings-lock-in-wedding-rings-with-a-deposit-plan-future-payment-dates",
    "Rings",
    "Lock in wedding rings with a deposit | Plan future payment dates",
    "9 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "bridal-gown-accessories-preparation-lock-in-bridal-gown-with-a-deposit-plan-future-payment",
    "Bridal Gown, Accessories, Preparation",
    "Lock in bridal gown with a deposit | Plan future payment dates",
    "9 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "grooms-attire-and-accessories-preparation-lock-in-grooms-attire-with-a-deposit-plan-future",
    "Groom's Attire & Accessories, Preparation",
    "Lock in groom's attire with a deposit | Plan future payment dates",
    "9 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "couples-tasks-identify-and-document-all-venues-to-be-used-throughout-the-wedding",
    "Couple's Tasks",
    "Identify and document all venues to be used throughout the wedding",
    "9 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "couples-tasks-develop-a-detailed-program-covering-the-day-from-the-couple-s-morning-prepar",
    "Couple's Tasks",
    "Develop a detailed program covering the day from the couple’s morning preparations to the end of the reception",
    "8 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "invitations-lock-in-invitation-cards-vendor-with-a-deposit-plan-future-payment-dates",
    "Invitations",
    "Lock in invitation cards vendor with a deposit | Plan future payment dates",
    "8 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "d-cor-tents-chairs-tables-lock-in-decorator-with-a-deposit-plan-future-payment-dates",
    "Décor, Tents, Chairs, Tables",
    "Lock in decorator with a deposit | Plan future payment dates",
    "8 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "caterer-lock-in-caterer-with-a-deposit-plan-future-payment-dates",
    "Caterer",
    "Lock in caterer with a deposit | Plan future payment dates",
    "8 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "cake-artist-and-baker-lock-in-cake-artist-baker-with-a-deposit-plan-future-payment-dates",
    "Cake Artist & Baker",
    "Lock in cake artist / baker with a deposit | Plan future payment dates",
    "8 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "couples-tasks-meet-with-the-bridal-party-to-review-attire-vendors-and-costs-make-up-and-ha",
    "Couple's Tasks",
    "Meet with the bridal party to review attire vendors and costs, make-up and hair styling expenses, rehearsal date, pre-wedding accommodations, and wedding day timings",
    "8 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "honeymoon-lock-in-honeymoon-destination-s-with-a-deposit-plan-future-payment-dates",
    "Honeymoon",
    "Lock in honeymoon destination(s) with a deposit | Plan future payment dates",
    "7 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "photographer-lock-in-photographer-with-a-deposit-plan-future-payment-dates",
    "Photographer",
    "Lock in photographer with a deposit | Plan future payment dates",
    "7 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "cinematographer-lock-in-cinematographer-with-a-deposit-plan-future-payment-dates",
    "Cinematographer",
    "Lock in cinematographer with a deposit | Plan future payment dates",
    "7 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "master-of-ceremonies-lock-in-master-of-ceremonies-with-a-deposit-plan-future-payment-dates",
    "Master of Ceremonies",
    "Lock in master of ceremonies with a deposit | Plan future payment dates",
    "7 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "dj-or-band-and-sound-lock-in-dj-or-band-with-a-deposit-plan-future-payment-dates",
    "DJ (or Band) and Sound",
    "Lock in DJ (or band) with a deposit | Plan future payment dates",
    "7 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "bridal-gown-accessories-preparation-research-brides-pedi-mani-artists",
    "Bridal Gown, Accessories, Preparation",
    "Research bride's pedi-mani artists.",
    "6 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "grooms-attire-and-accessories-preparation-research-grooms-pedi-mani-artists",
    "Groom's Attire & Accessories, Preparation",
    "Research groom's pedi-mani artists",
    "6 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "bridal-gown-accessories-preparation-research-bridesmaids-attire-designer-shop",
    "Bridal Gown, Accessories, Preparation",
    "Research bridesmaids' attire designer/shop",
    "7 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "grooms-attire-and-accessories-preparation-research-groomsmens-attire-designer-shop",
    "Groom's Attire & Accessories, Preparation",
    "Research groomsmen's attire designer/shop",
    "7 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "bridal-gown-accessories-preparation-bridal-gown-fitting-1",
    "Bridal Gown, Accessories, Preparation",
    "Bridal gown fitting #1",
    "6 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "grooms-attire-and-accessories-preparation-grooms-attire-fitting-1",
    "Groom's Attire & Accessories, Preparation",
    "Groom's attire fitting #1",
    "6 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "couples-tasks-select-the-people-who-shall-be-in-your-bridal-party",
    "Couple's Tasks",
    "Select the people who shall be in your bridal party.",
    "6 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "invitations-confirm-wedding-details-are-accurate-on-invitations",
    "Invitations",
    "Confirm wedding details are accurate on invitations",
    "5 Months",
    "public",
    "Delegatable",
    "Stationery Coordinator"
  ],
  [
    "invitations-confirm-if-other-stationery-items-are-needed-gift-box-guest-book-envelopes-bad",
    "Invitations",
    "Confirm if other stationery items are needed (gift box, guest book, envelopes, badges, signage)",
    "5 Months",
    "public",
    "Delegatable",
    "Stationery Coordinator"
  ],
  [
    "honeymoon-plan-honeymoon-itinerary",
    "Honeymoon",
    "Plan honeymoon itinerary",
    "5 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "d-cor-tents-chairs-tables-finalize-all-d-cor-and-set-up-elements-with-decorator",
    "Décor, Tents, Chairs, Tables",
    "Finalize all décor and set up elements with decorator",
    "5 Months",
    "public",
    "Delegatable",
    "Aesthetics Coordinator"
  ],
  [
    "caterer-finalize-menu-with-caterer",
    "Caterer",
    "Finalize menu with caterer",
    "5 Months",
    "public",
    "Delegatable",
    "Edibles Coordinator"
  ],
  [
    "cake-artist-and-baker-attend-wedding-cake-tasting-lock-in-cake-flavour-and-design",
    "Cake Artist & Baker",
    "Attend wedding cake tasting | Lock in cake flavour & design",
    "5 Months",
    "public",
    "Delegatable",
    "Edibles Coordinator"
  ],
  [
    "bridal-gown-accessories-preparation-have-the-ladies-lock-in-bridesmaids-attire-designer-wi",
    "Bridal Gown, Accessories, Preparation",
    "Have the ladies lock in bridesmaids' attire designer with a deposit",
    "5 Months",
    "public",
    "Delegatable",
    "Best Lady"
  ],
  [
    "grooms-attire-and-accessories-preparation-have-the-men-lock-in-groomsmens-attire-designer-",
    "Groom's Attire & Accessories, Preparation",
    "Have the men lock in groomsmen's attire designer with a deposit",
    "5 Months",
    "public",
    "Delegatable",
    "Best Man"
  ],
  [
    "couples-tasks-lock-in-with-a-deposit-where-you-shall-live-as-a-couple-after-the-wedding-if",
    "Couple's Tasks",
    "Lock in with a deposit, where you shall live as a couple after the wedding (if applicable)",
    "4 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "bridal-gown-accessories-preparation-choose-and-visit-family-gynaecologist",
    "Bridal Gown, Accessories, Preparation",
    "Choose and visit family gynaecologist.",
    "4 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "church-and-officiating-minister-meet-officiating-minister-to-discuss-wedding-ceremony-requ",
    "Church & Officiating Minister",
    "Meet officiating minister to discuss wedding ceremony | Request copy of his officiating licence",
    "4 Months",
    "public",
    "Delegatable",
    "Aesthetics Coordinator"
  ],
  [
    "master-of-ceremonies-go-through-the-program-with-the-master-of-ceremonies",
    "Master of Ceremonies",
    "Go through the program with the master of ceremonies",
    "4 Months",
    "public",
    "Delegatable",
    "Experience Coordinator"
  ],
  [
    "dj-or-band-and-sound-meet-dj-or-band-to-discuss-and-finalize-music-playlist",
    "DJ (or Band) and Sound",
    "Meet DJ (or band) to discuss and finalize music playlist",
    "4 Months",
    "public",
    "Delegatable",
    "Experience Coordinator"
  ],
  [
    "photographer-brief-photographer-on-wedding-vision-and-days-plans",
    "Photographer",
    "Brief photographer on wedding vision & day's plans",
    "4 Months",
    "public",
    "Delegatable",
    "Experience Coordinator"
  ],
  [
    "cinematographer-brief-cinematographer-on-wedding-vision-and-days-plans",
    "Cinematographer",
    "Brief cinematographer on wedding vision & day's plans",
    "4 Months",
    "public",
    "Delegatable",
    "Experience Coordinator"
  ],
  [
    "bridal-gown-accessories-preparation-bridal-gown-fitting-2",
    "Bridal Gown, Accessories, Preparation",
    "Bridal gown fitting #2",
    "4 Months",
    "public",
    "Delegatable",
    "Best Lady"
  ],
  [
    "grooms-attire-and-accessories-preparation-grooms-attire-fitting-2",
    "Groom's Attire & Accessories, Preparation",
    "Groom's attire fitting #2",
    "4 Months",
    "public",
    "Delegatable",
    "Best Man"
  ],
  [
    "invitations-create-gift-registry-at-outlets-offering-the-same",
    "Invitations",
    "Create gift registry at outlets offering the same",
    "4 Months",
    "public",
    "Delegatable",
    "Stationery Coordinator"
  ],
  [
    "wedding-licenses-apply-for-your-wedding-permit",
    "Wedding Licenses",
    "Apply for your wedding permit",
    "3 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "rings-confirm-wedding-rings-fit-make-adjustents-if-necessary",
    "Rings",
    "Confirm wedding rings fit, make adjustents if necessary",
    "3 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "invitations-confirm-invitations-and-stationery-are-delivered-as-agreed-make-final-payment",
    "Invitations",
    "Confirm invitations and stationery are delivered as agreed | Make final payment",
    "3 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "wedding-planner-planning-team-schedule-and-run-for-all-planning-team-meetings-if-applicabl",
    "Wedding Planner / Planning Team",
    "Schedule and run for all planning team meetings (if applicable).",
    "3 Months",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "hair-stylist-lock-in-hair-stylist-with-a-deposit-plan-future-payment-dates",
    "Hair Stylist",
    "Lock in hair stylist with a deposit | Plan future payment dates",
    "3 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "make-up-artist-lock-in-make-up-artist-with-a-deposit-plan-future-payment-dates",
    "Make-up Artist",
    "Lock in make-up artist with a deposit | Plan future payment dates",
    "3 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "bridal-gown-accessories-preparation-lock-in-brides-pedi-mani-artist-with-a-deposit",
    "Bridal Gown, Accessories, Preparation",
    "Lock in bride's pedi-mani artist with a deposit",
    "3 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "grooms-attire-and-accessories-preparation-lock-in-grooms-pedi-mani-artist-with-a-deposit",
    "Groom's Attire & Accessories, Preparation",
    "Lock in groom's pedi-mani artist with a deposit",
    "3 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "wedding-licenses-attend-the-wedding-permit-interview",
    "Wedding Licenses",
    "Attend the wedding permit interview",
    "8 Weeks",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "church-and-officiating-minister-if-church-wedding-confirm-church-is-ready-for-ceremony-mak",
    "Church & Officiating Minister",
    "(if church wedding) Confirm church is ready for ceremony | Make final payment",
    "8 Weeks",
    "public",
    "Delegatable",
    "Secretary"
  ],
  [
    "wedding-venue-confirm-wedding-venue-is-ready-for-the-wedding-make-final-payment",
    "Wedding Venue",
    "Confirm wedding venue is ready for the wedding | Make final payment",
    "8 Weeks",
    "public",
    "Delegatable",
    "Secretary"
  ],
  [
    "photo-shoot-venue-confirm-venue-is-ready-for-the-photo-shoot-make-final-payment",
    "Photo Shoot Venue",
    "Confirm venue is ready for the photo shoot | Make final payment",
    "8 Weeks",
    "public",
    "Delegatable",
    "Secretary"
  ],
  [
    "honeymoon-make-final-payment-ahead-of-the-wedding-day",
    "Honeymoon",
    "Make final payment ahead of the wedding day.",
    "8 Weeks",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "church-and-officiating-minister-decide-who-shall-preach-at-the-ceremony",
    "Church & Officiating Minister",
    "Decide who shall preach at the ceremony",
    "8 Weeks",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "wedding-planner-planning-team-liasise-with-couple-to-list-out-family-ushers",
    "Wedding Planner / Planning Team",
    "Liasise with couple to list out family ushers",
    "7 Weeks",
    "public",
    "Delegatable",
    "Ushers Coordinator"
  ],
  [
    "wedding-planner-planning-team-liaisie-with-couple-to-hire-or-identify-from-among-friends-a",
    "Wedding Planner / Planning Team",
    "Liaisie with couple to hire (or identify from among friends and family) an ushering team",
    "7 Weeks",
    "public",
    "Delegatable",
    "Ushers Coordinator"
  ],
  [
    "wedding-planner-planning-team-liaisie-with-couple-to-hire-or-identify-from-among-friends-a",
    "Wedding Planner / Planning Team",
    "Liaisie with couple to hire (or identify from among friends and family) a security team",
    "7 Weeks",
    "public",
    "Delegatable",
    "Security Coordinator"
  ],
  [
    "wedding-planner-planning-team-liaisie-with-couple-to-identify-the-gift-tables-team",
    "Wedding Planner / Planning Team",
    "Liaisie with couple to identify the gift tables team",
    "7 Weeks",
    "public",
    "Delegatable",
    "Stationery Coordinator"
  ],
  [
    "invitations-send-off-wedding-invitation-cards",
    "Invitations",
    "Send off wedding invitation cards",
    "6 Weeks",
    "public",
    "Delegatable",
    "Stationery Coordinator"
  ],
  [
    "wedding-planner-planning-team-liaise-with-couple-to-ensure-all-vendors-have-signed-contrac",
    "Wedding Planner / Planning Team",
    "Liaise with couple to ensure all vendors have signed contracts",
    "6 Weeks",
    "public",
    "Delegatable",
    "Secretary"
  ],
  [
    "transport-determine-the-number-of-vehicles-needed",
    "Transport",
    "Determine the number of vehicles needed",
    "6 Weeks",
    "public",
    "Delegatable",
    "Transport Coordinator"
  ],
  [
    "transport-designate-a-favourable-route-for-all-transfers-on-the-wedding-day",
    "Transport",
    "Designate a favourable route for all transfers on the wedding day",
    "6 Weeks",
    "public",
    "Delegatable",
    "Transport Coordinator"
  ],
  [
    "transport-decide-where-vehicles-shall-be-cleaned-and-decorated",
    "Transport",
    "Decide where vehicles shall be cleaned and decorated",
    "6 Weeks",
    "public",
    "Delegatable",
    "Transport Coordinator"
  ],
  [
    "hair-stylist-have-a-hair-consult",
    "Hair Stylist",
    "Have a hair consult",
    "6 Weeks",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "make-up-artist-have-a-make-up-trial",
    "Make-up Artist",
    "Have a make-up trial",
    "6 Weeks",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "bridal-gown-accessories-preparation-purchase-bridal-shoes-and-other-bridal-accessories",
    "Bridal Gown, Accessories, Preparation",
    "Purchase bridal shoes and other bridal accessories",
    "6 Weeks",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "grooms-attire-and-accessories-preparation-purchase-grooms-shoes-and-other-grooms-accessori",
    "Groom's Attire & Accessories, Preparation",
    "Purchase groom's shoes and other groom's accessories",
    "6 Weeks",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "rings-collect-weddings-rings-make-final-payment",
    "Rings",
    "Collect weddings rings | Make final payment",
    "1 Months",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "wedding-licenses-collect-the-wedding-permit-and-give-a-copy-to-the-officiating-minister",
    "Wedding Licenses",
    "Collect the wedding permit and give a copy to the officiating minister",
    "4 Weeks",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "wedding-planner-planning-team-organize-a-meeting-with-the-couples-parents-to-align-on-wedd",
    "Wedding Planner / Planning Team",
    "Organize a meeting with the couples parents to align on wedding plans.",
    "4 Weeks",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "bridal-gown-accessories-preparation-pick-up-bridal-gown-make-final-payment",
    "Bridal Gown, Accessories, Preparation",
    "Pick up bridal gown | Make final payment",
    "4 Weeks",
    "private",
    "Delegatable",
    "Best Lady"
  ],
  [
    "grooms-attire-and-accessories-preparation-pick-up-grooms-attire-make-final-payment",
    "Groom's Attire & Accessories, Preparation",
    "Pick up groom's attire | Make final payment",
    "4 Weeks",
    "private",
    "Delegatable",
    "Best Man"
  ],
  [
    "transport-have-a-record-of-how-long-each-vehicle-is-available-on-the-wedding-day-ensuring-",
    "Transport",
    "Have a record of how long each vehicle is available on the wedding day, ensuring no transport gaps",
    "4 Weeks",
    "public",
    "Delegatable",
    "Transport Coordinator"
  ],
  [
    "church-and-officiating-minister-meet-with-officiating-minister-and-bridal-party-for-the-re",
    "Church & Officiating Minister",
    "Meet with officiating minister and bridal party for the rehearsals",
    "3 Weeks",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "master-of-ceremonies-build-the-program-participants-list-with-the-master-of-ceremonies",
    "Master of Ceremonies",
    "Build the program participants list with the master of ceremonies",
    "3 Weeks",
    "public",
    "Delegatable",
    "Secretary"
  ],
  [
    "master-of-ceremonies-build-the-family-and-friends-group-photo-list-with-the-master-of-cere",
    "Master of Ceremonies",
    "Build the family and friends group photo list with the master of ceremonies",
    "3 Weeks",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "wedding-planner-planning-team-plan-a-vendors-meeting-and-ensure-the-planning-team-if-appli",
    "Wedding Planner / Planning Team",
    "Plan a vendors’ meeting and ensure the planning team (if applicable) is also in attendance.",
    "3 Weeks",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "wedding-licenses-confirm-if-the-venue-has-a-nema-license-if-not-make-arrangement-to-have-i",
    "Wedding Licenses",
    "Confirm if the Venue has a NEMA license. If not, make arrangement to have it paid",
    "3 Weeks",
    "public",
    "Delegatable",
    "Experience Coordinator"
  ],
  [
    "wedding-venue-confirm-the-wedding-venue-has-ample-security-and-make-arrangements-if-not",
    "Wedding Venue",
    "Confirm the wedding venue has ample security and make arrangements if not",
    "6 Weeks",
    "public",
    "Delegatable",
    "Security Coordinator"
  ],
  [
    "honeymoon-pack-for-your-honeymoon",
    "Honeymoon",
    "Pack for your honeymoon",
    "1 Weeks",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "bridal-gown-accessories-preparation-visit-brides-pedi-mani-artist-make-final-payment",
    "Bridal Gown, Accessories, Preparation",
    "Visit bride's pedi-mani artist | Make final payment",
    "1 Week",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "grooms-attire-and-accessories-preparation-visit-grooms-pedi-mani-artist-make-final-payment",
    "Groom's Attire & Accessories, Preparation",
    "Visit groom's pedi-mani artist | Make final payment",
    "1 Week",
    "private",
    "Not Delegatable",
    null
  ],
  [
    "d-cor-tents-chairs-tables-confirm-setup-has-commenced-on-agreed-day",
    "Décor, Tents, Chairs, Tables",
    "Confirm setup has commenced on agreed day",
    "3 Days",
    "public",
    "Delegatable",
    "Aesthetics Coordinator"
  ],
  [
    "hair-stylist-have-brides-hair-styled-at-agreed-place-and-time-make-final-payment",
    "Hair Stylist",
    "Have bride's hair styled at agreed place and time | Make final payment",
    "Wedding Day",
    "private",
    "Delegatable",
    "Best Lady"
  ],
  [
    "make-up-artist-have-brides-make-up-done-at-agreed-place-and-time-make-final-payment",
    "Make-up Artist",
    "Have bride's make-up done at agreed place and time | Make final payment",
    "Wedding Day",
    "private",
    "Delegatable",
    "Best Lady"
  ],
  [
    "photographer-confirm-photographer-has-arrived-at-agreed-place-and-time",
    "Photographer",
    "Confirm photographer has arrived at agreed place and time",
    "Wedding Day",
    "public",
    "Must Be Delegated",
    "Experience Coordinator"
  ],
  [
    "cinematographer-confirm-cinematographer-has-arrived-at-agreed-place-and-time",
    "Cinematographer",
    "Confirm cinematographer has arrived at agreed place and time",
    "Wedding Day",
    "public",
    "Must Be Delegated",
    "Experience Coordinator"
  ],
  [
    "transport-confirm-all-vehicles-have-arrived-at-agreed-place-and-time",
    "Transport",
    "Confirm all vehicles have arrived at agreed place and time",
    "Wedding Day",
    "public",
    "Must Be Delegated",
    "Transport Coordinator"
  ],
  [
    "transport-organize-the-transfer-of-couple-family-bridal-party-and-their-luggage-along-desi",
    "Transport",
    "Organize the transfer of couple, family, bridal party and their luggage along designated routes",
    "Wedding Day",
    "public",
    "Must Be Delegated",
    "Transport Coordinator"
  ],
  [
    "master-of-ceremonies-confirm-master-of-ceremonies-has-delivered-as-agreed-make-final-payme",
    "Master of Ceremonies",
    "Confirm master of ceremonies has delivered as agreed | Make final payment",
    "Wedding Day",
    "public",
    "Must Be Delegated",
    "Experience Coordinator"
  ],
  [
    "dj-or-band-and-sound-confirm-all-music-and-sound-requirements-are-delivered-as-agreed-make",
    "DJ (or Band) and Sound",
    "Confirm all music and sound requirements are delivered as agreed | Make final payment",
    "Wedding Day",
    "public",
    "Must Be Delegated",
    "Experience Coordinator"
  ],
  [
    "wedding-venue-ensure-washrooms-are-clean-at-all-times",
    "Wedding Venue",
    "Ensure washrooms are clean at all times",
    "Wedding Day",
    "public",
    "Must Be Delegated",
    "Aesthetics Coordinator"
  ],
  [
    "caterer-confirm-all-catering-elements-are-delivered-as-agreed-make-final-payment",
    "Caterer",
    "Confirm all catering elements are delivered as agreed | Make final payment",
    "Wedding Day",
    "public",
    "Must Be Delegated",
    "Edibles Coordinator"
  ],
  [
    "transport-organize-the-transfer-of-service-teams-ushers-security-along-designated-routes",
    "Transport",
    "Organize the transfer of service teams (ushers, security) along designated routes",
    "Wedding Day",
    "public",
    "Must Be Delegated",
    "Transport Coordinator"
  ],
  [
    "caterer-ensure-service-teams-ushers-security-and-vendors-are-served-at-the-best-times-poss",
    "Caterer",
    "Ensure service teams (ushers, security) & vendors are served at the best times possible so their functions are uninterrupted",
    "Wedding Day",
    "public",
    "Must Be Delegated",
    "Edibles Coordinator"
  ],
  [
    "cake-artist-and-baker-confirm-cake-is-delivered-as-agreed-make-final-payment",
    "Cake Artist & Baker",
    "Confirm cake is delivered as agreed | Make final payment",
    "Wedding Day",
    "public",
    "Must Be Delegated",
    "Edibles Coordinator"
  ],
  [
    "d-cor-tents-chairs-tables-confirm-all-d-cor-elements-tents-chairs-and-tables-are-delivered",
    "Décor, Tents, Chairs, Tables",
    "Confirm all décor elements, tents, chairs and tables are delivered as agreed | Make final payment",
    "Wedding Day",
    "public",
    "Delegatable",
    "Secretary"
  ],
  [
    "transport-organize-the-transfer-of-gifts-to-designated-storage-location",
    "Transport",
    "Organize the transfer of gifts to designated storage location",
    "Wedding Day",
    "public",
    "Must Be Delegated",
    "Transport Coordinator"
  ],
  [
    "photographer-confirm-photos-are-delivered-as-agreed-make-final-payment",
    "Photographer",
    "Confirm photos are delivered as agreed | Make final payment",
    "Post Wedding",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "cinematographer-confirm-video-footage-is-delivered-as-agreed-make-final-payment",
    "Cinematographer",
    "Confirm video footage is delivered as agreed | Make final payment",
    "Post Wedding",
    "public",
    "Not Delegatable",
    null
  ],
  [
    "transport-research-transport-vendors",
    "Transport",
    "Research transport vendors",
    "Wedding Day",
    "public",
    "Must Be Delegated",
    "Transport Coordinator"
  ],
  [
    "transport-lock-in-transport-vendors-with-a-deposit-plan-future-payment-dates",
    "Transport",
    "Lock in transport vendors with a deposit | Plan future payment dates",
    "Wedding Day",
    "public",
    "Must Be Delegated",
    "Transport Coordinator"
  ],
  [
    "transport-confirm-transport-requirements-were-met-as-agreed-make-final-payment",
    "Transport",
    "Confirm transport requirements were met as agreed | Make final payment",
    "Wedding Day",
    "public",
    "Must Be Delegated",
    "Transport Coordinator"
  ]
];

const CATEGORY_ALIASES: Record<string, string> = {
  venue: 'Wedding Venue',
  'venue ceremony': 'Wedding Venue',
  'venue reception': 'Wedding Venue',
  'wedding venue': 'Wedding Venue',
  'photo shoot venue': 'Photo Shoot Venue',
  'venue photo shoot': 'Photo Shoot Venue',
  cake: 'Cake Artist & Baker',
  'cake artist baker': 'Cake Artist & Baker',
  catering: 'Caterer',
  caterer: 'Caterer',
  photography: 'Photographer',
  photographer: 'Photographer',
  videography: 'Cinematographer',
  cinematographer: 'Cinematographer',
  'master of ceremonies': 'Master of Ceremonies',
  mc: 'Master of Ceremonies',
  'dj or band and sound': 'DJ (or Band) and Sound',
  'dj band and sound': 'DJ (or Band) and Sound',
  'music dj': 'DJ (or Band) and Sound',
  'music and sound dj band': 'DJ (or Band) and Sound',
  'music and sound': 'DJ (or Band) and Sound',
  'decor tents chairs': 'Décor, Tents, Chairs, Tables',
  decor: 'Décor, Tents, Chairs, Tables',
  'décor': 'Décor, Tents, Chairs, Tables',
  'décor tents chairs tables': 'Décor, Tents, Chairs, Tables',
  flowers: 'Décor, Tents, Chairs, Tables',
  invitations: 'Invitations',
  stationery: 'Invitations',
  transport: 'Transport',
  honeymoon: 'Honeymoon',
  'couples rings': 'Rings',
  'couple rings': 'Rings',
  rings: 'Rings',
  'hair stylist': 'Hair Stylist',
  'make-up artist': 'Make-up Artist',
  'make up artist': 'Make-up Artist',
  'church and officiating minister': 'Church & Officiating Minister',
  'church officiating minister': 'Church & Officiating Minister',
  'officiating minister': 'Church & Officiating Minister',
  'wedding planner planning team': 'Wedding Planner / Planning Team',
  'wedding planner': 'Wedding Planner / Planning Team',
  'planning team': 'Wedding Planner / Planning Team',
  'wedding licenses': 'Wedding Licenses',
  legal: 'Wedding Licenses',
  'couples tasks': "Couple's Tasks",
  'bridal gown accessories preparation': 'Bridal Gown, Accessories, Preparation',
  'grooms attire accessories preparation': "Groom's Attire & Accessories, Preparation",
};

function normalizeValue(value?: string | null) {
  return value
    ?.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim() ?? '';
}

function canonicalizeCategory(category: string) {
  const normalized = normalizeValue(category);
  return CATEGORY_ALIASES[normalized] ?? category.trim();
}

function parseVisibility(raw: string): WeddingTaskVisibility {
  return raw === 'private' ? 'private' : 'public';
}

function parseDelegatable(raw: string) {
  const normalized = raw.trim().toLowerCase();
  return normalized === 'delegatable' || normalized === 'must be delegated';
}

function parseTimelineOffsetMonths(label: string | null | undefined) {
  if (!label) return null;
  const monthsMatch = label.match(/(\d+)\s*Months?/i);
  if (monthsMatch) return Number(monthsMatch[1]);
  const weeksMatch = label.match(/(\d+)\s*Weeks?/i);
  if (weeksMatch) return Number(weeksMatch[1]) / 4.345;
  const daysMatch = label.match(/(\d+)\s*Days?/i);
  if (daysMatch) return Number(daysMatch[1]) / 30;
  if (label.toLowerCase() === 'wedding day') return 0;
  if (label.toLowerCase() === 'post wedding') return -0.25;
  return null;
}

function subtractDays(date: Date, days: number) {
  const clone = new Date(date);
  clone.setDate(clone.getDate() - days);
  return clone;
}

function addDays(date: Date, days: number) {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + days);
  return clone;
}

function resolveDueDateFromTimeline(weddingDate: Date, timelineLabel: string | null | undefined) {
  if (!timelineLabel) return null;
  const monthsMatch = timelineLabel.match(/(\d+)\s*Months?/i);
  if (monthsMatch) {
    const clone = new Date(weddingDate);
    clone.setMonth(clone.getMonth() - Number(monthsMatch[1]));
    return clone;
  }
  const weeksMatch = timelineLabel.match(/(\d+)\s*Weeks?/i);
  if (weeksMatch) return subtractDays(weddingDate, Number(weeksMatch[1]) * 7);
  const daysMatch = timelineLabel.match(/(\d+)\s*Days?/i);
  if (daysMatch) return subtractDays(weddingDate, Number(daysMatch[1]));
  if (timelineLabel.toLowerCase() === 'wedding day') return new Date(weddingDate);
  if (timelineLabel.toLowerCase() === 'post wedding') return addDays(weddingDate, 7);
  return null;
}

function inferPhase(title: string, timelineLabel: string): WeddingTaskPhase {
  const lower = title.toLowerCase();
  if (lower.startsWith('research')) return 'research';
  if (lower.includes('lock in') || lower.includes('deposit') || lower.includes('apply for your wedding permit') || lower.includes('attend the wedding permit interview')) {
    return 'selection_booking';
  }
  if (
    lower.includes('make final payment') ||
    lower.includes('arrival') ||
    lower.includes('ensure') ||
    timelineLabel.toLowerCase() === 'wedding day' ||
    timelineLabel.toLowerCase() === 'post wedding'
  ) {
    return 'closure_final_payment';
  }
  if (
    lower.includes('finalize') ||
    lower.includes('brief ') ||
    lower.includes('go through the program') ||
    lower.includes('meet ') ||
    lower.includes('plan honeymoon itinerary') ||
    lower.includes('fitting') ||
    lower.includes('confirm') ||
    lower.includes('create gift registry') ||
    lower.includes('schedule and run')
  ) {
    return 'second_payment';
  }
  return 'foundation';
}

function inferPriorityLevel(timelineLabel: string): 1 | 2 | 3 | 4 {
  const lower = timelineLabel.toLowerCase();
  if (lower === 'wedding day' || lower === 'post wedding' || lower.includes('1 day')) return 1;
  const weekMatch = timelineLabel.match(/(\d+)\s*Weeks?/i);
  if (weekMatch) {
    const weeks = Number(weekMatch[1]);
    if (weeks <= 1) return 1;
    if (weeks <= 4) return 2;
    return 3;
  }
  const dayMatch = timelineLabel.match(/(\d+)\s*Days?/i);
  if (dayMatch) {
    const days = Number(dayMatch[1]);
    if (days <= 3) return 1;
    if (days <= 14) return 2;
    return 3;
  }
  const monthMatch = timelineLabel.match(/(\d+)\s*Months?/i);
  if (monthMatch) {
    const months = Number(monthMatch[1]);
    if (months <= 3) return 2;
    if (months <= 8) return 3;
    return 4;
  }
  return 3;
}

function buildDescription(
  title: string,
  timelineLabel: string,
  visibility: WeddingTaskVisibility,
  recommendedRole: string | null,
  delegatableRaw: string,
) {
  const parts = [title];
  if (timelineLabel) parts.push(`Timeline: ${timelineLabel}.`);
  parts.push(visibility === 'private' ? 'Private task.' : 'Public task.');
  if (recommendedRole) parts.push(`Suggested owner: ${recommendedRole}.`);
  else if (delegatableRaw.trim()) parts.push(`${delegatableRaw}.`);
  return parts.join(' ');
}

const CHECKLIST_TEMPLATES: WeddingTaskTemplate[] = RAW_CHECKLIST_ROWS.map((row) => {
  const [key, category, title, timelineLabel, visibilityRaw, delegatableRaw, recommendedRole] = row;
  const visibility = parseVisibility(visibilityRaw);
  return {
    key,
    title,
    category,
    description: buildDescription(title, timelineLabel, visibility, recommendedRole, delegatableRaw),
    phase: inferPhase(title, timelineLabel),
    visibility,
    delegatable: parseDelegatable(delegatableRaw),
    recommendedRole,
    priorityLevel: inferPriorityLevel(timelineLabel),
    timelineOffsetMonths: parseTimelineOffsetMonths(timelineLabel),
    timelineLabel,
  };
});

const CHECKLIST_CATEGORIES = [...new Set(CHECKLIST_TEMPLATES.map((template) => template.category))].sort((left, right) => left.localeCompare(right));

function sortTemplates(left: WeddingTaskTemplate, right: WeddingTaskTemplate) {
  const leftTimeline = left.timelineOffsetMonths ?? Number.MAX_SAFE_INTEGER;
  const rightTimeline = right.timelineOffsetMonths ?? Number.MAX_SAFE_INTEGER;
  if (leftTimeline !== rightTimeline) return rightTimeline - leftTimeline;
  if (left.priorityLevel !== right.priorityLevel) return left.priorityLevel - right.priorityLevel;
  return left.title.localeCompare(right.title);
}

function getChecklistTemplatesForCategory(category: string) {
  const canonical = canonicalizeCategory(category);
  return CHECKLIST_TEMPLATES.filter((template) => template.category === canonical).sort(sortTemplates);
}

function getGenericVendorWorkflowTemplates(category: string): WeddingTaskTemplate[] {
  const safeCategory = canonicalizeCategory(category);
  return [
    {
      key: `${safeCategory}-research`,
      title: `Research ${safeCategory.toLowerCase()} options`,
      category: safeCategory,
      description: `Research and shortlist viable ${safeCategory.toLowerCase()} options. Timeline: 8 Months. Public task.`,
      phase: 'research',
      visibility: 'public',
      delegatable: false,
      recommendedRole: null,
      priorityLevel: 3,
      timelineOffsetMonths: 8,
      timelineLabel: '8 Months',
    },
    {
      key: `${safeCategory}-selection-booking`,
      title: `Lock in ${safeCategory.toLowerCase()} with a deposit`,
      category: safeCategory,
      description: `Choose the preferred ${safeCategory.toLowerCase()} option, pay a deposit, and plan the next payment. Timeline: 6 Months. Public task.`,
      phase: 'selection_booking',
      visibility: 'public',
      delegatable: false,
      recommendedRole: null,
      priorityLevel: 3,
      timelineOffsetMonths: 6,
      timelineLabel: '6 Months',
    },
    {
      key: `${safeCategory}-closure`,
      title: `Confirm ${safeCategory.toLowerCase()} requirements and make final payment`,
      category: safeCategory,
      description: `Confirm final requirements and close the outstanding balance. Timeline: 4 Weeks. Public task.`,
      phase: 'closure_final_payment',
      visibility: 'public',
      delegatable: false,
      recommendedRole: null,
      priorityLevel: 2,
      timelineOffsetMonths: 1,
      timelineLabel: '4 Weeks',
    },
  ];
}

export function getVendorWorkflowTemplates(category: string): WeddingTaskTemplate[] {
  const checklistTemplates = getChecklistTemplatesForCategory(category);
  if (checklistTemplates.length) return checklistTemplates;
  return getGenericVendorWorkflowTemplates(category);
}

export function getWeddingTaskTemplates(input: {
  vendorCategories: string[];
  role: string | null | undefined;
  plannerType?: PlannerType | null;
}) {
  const templates = [...CHECKLIST_TEMPLATES];

  for (const category of input.vendorCategories) {
    const canonical = canonicalizeCategory(category);
    const alreadyIncluded = templates.some((template) => template.category === canonical || template.category === category);
    if (!alreadyIncluded) {
      templates.push(...getVendorWorkflowTemplates(category));
    }
  }

  return templates.sort(sortTemplates);
}

export function buildSeededTasksFromTemplates(input: {
  vendorCategories: string[];
  role: string | null | undefined;
  plannerType?: PlannerType | null;
  weddingDate?: string | null;
}) {
  const templates = getWeddingTaskTemplates(input);
  const weddingDate = input.weddingDate ? new Date(input.weddingDate) : null;

  return templates.map((template) => {
    const resolvedDueDate = weddingDate ? resolveDueDateFromTimeline(weddingDate, template.timelineLabel) : null;
    return {
      title: template.title,
      description: template.description,
      category: template.category,
      assigned_to: template.recommendedRole,
      due_date: resolvedDueDate ? resolvedDueDate.toISOString().slice(0, 10) : null,
      completed: false,
      phase: template.phase,
      visibility: template.visibility,
      delegatable: template.delegatable,
      recommended_role: template.recommendedRole,
      priority_level: template.priorityLevel,
      template_source: 'zania_checklist_v2',
    };
  });
}

export function getTaskCategoryDefaults(input: {
  category: string;
  role: string | null | undefined;
  plannerType?: PlannerType | null;
}): WeddingTaskCategoryDefaults | null {
  const templates = getChecklistTemplatesForCategory(input.category);
  if (!templates.length) return null;

  const [bestTemplate] = templates;
  const recommendedRole = templates.find((template) => template.recommendedRole)?.recommendedRole ?? bestTemplate.recommendedRole ?? null;

  return {
    category: canonicalizeCategory(input.category),
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
  const categories = new Set(CHECKLIST_CATEGORIES);
  for (const category of input.vendorCategories ?? []) {
    categories.add(canonicalizeCategory(category));
  }
  return [...categories].sort((left, right) => left.localeCompare(right));
}

export function getSuggestedTaskTemplates(input: {
  category: string;
  vendorCategories?: string[];
  role: string | null | undefined;
  plannerType?: PlannerType | null;
}) {
  const templates = getChecklistTemplatesForCategory(input.category);
  const sourceTemplates = templates.length ? templates : getGenericVendorWorkflowTemplates(input.category);

  const deduped = new Map<string, SuggestedTaskTemplateOption>();
  for (const template of sourceTemplates) {
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

  return [...deduped.values()].sort((left, right) => {
    const leftTimeline = left.timelineOffsetMonths ?? Number.MAX_SAFE_INTEGER;
    const rightTimeline = right.timelineOffsetMonths ?? Number.MAX_SAFE_INTEGER;
    if (leftTimeline !== rightTimeline) return rightTimeline - leftTimeline;
    if (left.priorityLevel !== right.priorityLevel) return left.priorityLevel - right.priorityLevel;
    return left.title.localeCompare(right.title);
  });
}
