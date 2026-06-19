# Couple-First GTM Implementation Plan

## Goal

Shift Zania's primary go-to-market motion from:

- vendor discovery first

to:

- couple planning workspace first

The product promise should become:

- `Plan your wedding from start to finish in one workspace, even if your vendors are not on Zania yet.`

This plan assumes:

- couples are the main acquisition entry point
- manual vendor entry is a core feature, not a fallback
- vendors are pulled in later through real wedding context
- public vendor marketplace value grows after private workspace adoption

## What Already Exists

The current app already has strong foundations for this strategy:

- wedding-owned workspace setup in [src/pages/WeddingSetup.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/WeddingSetup.tsx)
- couple dashboard and planning surfaces in [src/pages/Dashboard.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/Dashboard.tsx)
- budget, guests, tasks, timeline, contributions, and table planning pages
- a vendor workspace that already supports fully manual vendor records in [src/pages/Vendors.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/Vendors.tsx)
- a vendor directory and vendor connection flow for on-platform vendors in [src/pages/VendorDirectory.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/VendorDirectory.tsx) and [src/components/VendorInterestButton.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/components/VendorInterestButton.tsx)
- a vendor claim flow for curated or unclaimed public listings in [src/pages/VendorClaim.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/VendorClaim.tsx) and [supabase/migrations/20260606173000_vendor_listing_claim_flow.sql](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/supabase/migrations/20260606173000_vendor_listing_claim_flow.sql)

This means the strategy does not require a product rewrite. It requires repositioning, a clearer couple journey, and a better bridge from private vendor records to later vendor participation.

## Product Shift

### New hierarchy

1. Wedding workspace
2. Couple planning tools
3. Shared collaboration with partner, family, planner
4. Private vendor records
5. Vendor invite and claim flows
6. Public vendor marketplace

### What should no longer be true

- couples should not feel blocked if their vendors are not listed
- the first meaningful action should not be browsing the directory
- vendor sign-up should not be required before planning value appears
- public listings should not be created automatically from private couple-entered data

## Core Product Decisions

### 1. Rename the concept internally and in UI

Do not use `dummy account`.

Use:

- `private vendor record`
- `unclaimed vendor`
- `off-platform vendor`
- `external vendor record`

Recommended distinction:

- `private vendor record`: couple-entered vendor data visible only inside one wedding workspace
- `external vendor record`: same planning object, phrased in a more vendor-neutral way when needed
- `linked vendor listing`: workspace vendor row attached to an existing public Zania vendor listing
- `claimed vendor profile`: vendor has accepted ownership of a public profile

### 2. Preserve privacy by default

If a couple adds:

- name
- phone
- quote
- deposits
- notes
- contracts

that data must remain private to their workspace unless the vendor actively joins and consents to publish profile information.

### 3. Separate planning value from marketplace value

Couples should get immediate value from:

- guest list
- tasks
- budget
- contributions
- vendor tracking
- documents
- seating
- reminders

Vendor marketplace value should appear as an optional enhancement, not the prerequisite.

## Phase 1: Messaging And Entry Point Changes

### Outcome

Make the app clearly feel couple-first before any backend changes.

### Files to update

- [src/pages/Landing.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/Landing.tsx)
- [README.md](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/README.md)
- optionally [src/pages/Pricing.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/Pricing.tsx)

### Changes

- change hero copy from vendor-forward language to workspace-forward language
- make the main CTA about starting a wedding workspace
- keep the public estimator as the top-of-funnel bridge into planning
- move vendor discovery further down the page
- explicitly say couples can add vendors manually even if they are not on Zania

### Recommended landing copy direction

- `Plan your wedding in one place.`
- `Track guests, budget, payments, vendors, documents, and timelines from one workspace.`
- `Your vendors do not need to be on Zania yet. Add them yourself and invite them later if you want.`

### UX change

The first couple onboarding story should be:

1. estimate budget
2. create wedding workspace
3. add wedding basics
4. land in dashboard
5. add first vendors manually

not:

1. browse vendors
2. hope the right vendors already exist

## Phase 2: Make Manual Vendor Entry The Default

### Outcome

Treat private vendor records as a primary planning object.

### Files to update

- [src/pages/Vendors.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/Vendors.tsx)
- [src/pages/Dashboard.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/Dashboard.tsx)

### Current state

The vendor page already supports:

- adding vendors from directory
- adding vendors manually
- storing quote and payment state
- attaching tasks and notes

### Required product changes

- make `Add vendor manually` the default tab or the first option shown
- relabel directory search as `Link to a Zania vendor` or `Find on Zania`
- show a badge for manual records such as `Private vendor record`
- explain that manual records stay private unless the vendor joins
- explicitly say private vendor details do not become public automatically
- add empty-state copy that encourages adding the couple's existing vendors first

### Suggested vendor row states

- `Private record`
- `Private vendor record`
- `Linked to Zania listing`
- `Vendor joined`

### Suggested empty state

- `Start with the vendors you already have. Add their names, quotes, deposits, notes, and due dates now. You can invite them to join Zania later.`

## Phase 3: Introduce Off-Platform Vendor Invite Flow

### Outcome

Let couples invite a private vendor into Zania without requiring an existing public listing first.

### Why this matters

Right now the main vendor outreach flow assumes an existing `vendor_listing_id`.

That works for:

- directory vendors already on Zania

It does not fully support:

- a couple who has entered `Jane Events` manually with a phone number and wants Jane to join later

### Existing files to build from

- [src/components/MyConnections.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/components/MyConnections.tsx)
- [src/components/VendorInterestButton.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/components/VendorInterestButton.tsx)
- [src/pages/VendorClaim.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/VendorClaim.tsx)
- [supabase/functions/send-connection-notification/index.ts](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/supabase/functions/send-connection-notification/index.ts)

### New backend concept

Add a claim-and-invite path for private workspace vendors.

Recommended approach:

1. couple selects a private vendor record
2. couple clicks `Invite vendor to collaborate`
3. Zania stores an invite token against the workspace vendor record
4. vendor receives a join link
5. vendor creates or signs into a vendor account
6. vendor chooses whether to:
   - collaborate only on this wedding
   - also create or claim a public profile later

### Recommended data additions

On `vendors` table or a new invite table:

- `invite_contact_email`
- `invite_contact_phone`
- `invite_token`
- `invite_sent_at`
- `invite_expires_at`
- `invite_status`
- `claimed_by_user_id`
- `public_profile_opt_in`

If cleaner, create a separate table such as:

- `workspace_vendor_invites`

This is preferable if you want multiple invite attempts, auditing, and better status history.

### Important design choice

Do not automatically create a public `vendor_listings` row from a private vendor record.

Better sequence:

1. private workspace vendor exists
2. vendor joins through invite
3. vendor claims workspace connection
4. vendor optionally creates a public listing

## Phase 4: Add A Lightweight Vendor Collaboration Mode

### Outcome

Allow invited vendors to participate in a real wedding context before they care about full marketplace setup.

### Why

If vendor onboarding asks for a full portfolio, public profile, pricing bands, and directory setup immediately, many invited vendors will drop.

### Product behavior

When invited by a couple, vendor should be able to enter a slim mode first:

- confirm they are the vendor for that wedding
- see event date and workspace summary
- review tasks or deliverables relevant to them
- confirm contact details
- optionally upload contract, quote, or requirements

Only after that should Zania ask:

- do you want to make your business discoverable on Zania?

### Files likely affected

- [src/pages/VendorDashboard.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/VendorDashboard.tsx)
- [src/pages/VendorSettings.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/VendorSettings.tsx)
- [src/pages/VendorClaim.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/VendorClaim.tsx)

## Phase 5: Turn Private Vendor Usage Into Supply Intelligence

### Outcome

Use couple behavior to identify which vendors are organically important before doing outbound supply work.

### What to track

From manual and linked vendor records:

- vendor name frequency
- category frequency
- county and town
- quote ranges
- final paid ranges
- repeat appearances across weddings
- conversion from manual record to invited vendor
- conversion from invited vendor to claimed vendor account
- conversion from claimed vendor to public listing

### Why this matters

This gives Zania a much stronger vendor pitch later:

- `You have been added to 7 wedding workspaces on Zania.`

That is far more compelling than:

- `Please join our new platform.`

### Suggested analytics additions

- event when manual vendor is created
- event when manual vendor is edited with quote
- event when invite is sent
- event when invite is opened
- event when vendor joins
- event when vendor opts into public listing

## Phase 6: Marketplace Comes After Workspace Pull

### Outcome

Keep the marketplace, but demote it from core value proposition to growth layer.

### Marketplace role after pivot

- supports discovery for couples who still need vendors
- gives claimed vendors a growth upside
- provides social proof and trust signals
- becomes a monetization surface later

### What should stay

- [src/pages/VendorDirectory.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/VendorDirectory.tsx)
- trust signals
- reviews
- curated collections
- claim flow for public vendor listings

### What should change

- directory should no longer feel like the app's primary reason to exist
- `Interested` actions should be secondary to `Add your own vendor`
- couples should always know they can proceed without finding their vendor in the directory

## Recommended Delivery Order

### Sprint 1

- update landing and pricing copy
- adjust onboarding language
- make manual vendor entry the default UI path
- add private record labeling in vendor workspace

### Sprint 2

- add private vendor invite model
- create invite email flow for off-platform vendors
- add claim-or-collaborate landing flow

### Sprint 3

- add lightweight vendor collaboration mode
- add instrumentation for manual vendor adoption and claim conversion

### Sprint 4

- optimize marketplace surfaces using real vendor demand data
- build admin tooling around repeated vendor mentions and conversion funnels

## Suggested Acceptance Criteria

### Couple experience

- a new couple can complete meaningful planning without using the vendor directory
- a couple can add at least one fully manual vendor with quote, notes, deposit, and due date
- a couple can clearly tell whether a vendor is private, linked, or joined
- a couple can invite an off-platform vendor to join later

### Vendor experience

- an invited vendor can join from a real wedding context
- an invited vendor is not forced into full marketplace setup immediately
- an invited vendor can optionally create a public profile after accepting the wedding relationship

### Trust and privacy

- private vendor records never become public automatically
- couple-entered vendor pricing and notes remain private until explicit vendor consent
- public listings only appear after vendor approval or admin curation

## My Recommendation

This is the right strategic direction for Zania.

It fits what the product already does best:

- owned wedding workspaces
- structured planning
- collaboration
- payment and document coordination

It also avoids the hardest early marketplace problem:

- needing vendor supply before couples feel value

If Zania follows this path, the app should be positioned as:

- `the wedding workspace couples start with`

and not:

- `a vendor marketplace that also has planning tools`

That order matters both for growth and for product clarity.
