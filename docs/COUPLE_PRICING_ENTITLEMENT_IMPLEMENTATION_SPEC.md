# Couple Pricing And Entitlement Implementation Spec

## Purpose

This document translates the agreed couple pricing strategy into:

- polished pricing copy for the website
- a final feature matrix
- the entitlement model we should implement next
- the exact direction for `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/lib/pricingPlans.ts`
- the exact direction for `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/lib/entitlements.ts`

This spec assumes the newer wedding-owned workspace model is the product direction:

- the wedding is the billable workspace
- the couple owns the wedding
- collaboration access attaches to the wedding, not to a user account globally

## Product Thesis

Couples should be able to start planning for free.

They should pay when the wedding becomes collaborative.

They should pay more when the wedding becomes operationally complex and needs active coordination across people, vendors, timelines, and AI support.

That means the couple product should be sold in three layers:

- `Free`: plan your wedding
- `Basic`: plan together
- `Premium`: run the whole wedding in one place

With add-ons:

- Gift Registry
- Guest RSVP & Management

## Website Pricing Copy

### Pricing hero

**Headline**

Choose the planning style that fits your wedding

**Support copy**

Start planning for free. Upgrade when you are ready to collaborate with your people, work with vendors and planners, and run your whole wedding in one shared workspace.

### Free

**Title**

Free

**Tagline**

Plan your wedding on your own

**Support copy**

Best for couples getting started with budgeting, vendor discovery, guests, and early planning.

**Includes**

- Task list
- Cost estimator
- Budget tracking
- Vendor directory
- Vendor management
- Guest list

**CTA**

Start free

### Basic

**Title**

Basic

**Price**

KES 5,000 / year or KES 750 / month

**Tagline**

Plan together

**Support copy**

Stop planning alone. Bring your committee, family, planner, and vendors into one shared wedding workspace.

**Includes**

- Everything in Free
- Planner collaboration
- Vendor collaboration
- Committee collaboration up to 10 people
- Family collaboration up to 10 people

**CTA**

Upgrade to Basic

### Premium

**Title**

Premium

**Price**

KES 15,000 / year or KES 2,000 / month

**Tagline**

Run the whole wedding in one place

**Support copy**

Turn your wedding into a fully coordinated workspace with AI support, collaborative timelines, and richer vendor and planner coordination.

**Includes**

- Everything in Basic
- Committee collaboration up to 20 people
- Family collaboration up to 20 people
- AI Wedding Assistant
- Vendor collaboration tools
- Planner collaboration tools
- Timeline management

**CTA**

Go Premium

### Add-ons

**Section title**

Add-ons

**Support copy**

Extend your wedding workspace when you need more guest coordination or gift commerce.

#### Gift Registry

Let guests buy directly from your wedding wishlist. Purchased items are automatically marked off so there are no duplicates.

#### Guest RSVP & Management

Collect RSVPs, track attendance, and manage guest coordination beyond a simple guest list.

## Final Feature Matrix

| Feature | Free | Basic | Premium |
|---|---|---|---|
| Task list | Included | Included | Included |
| Cost estimator | Included | Included | Included |
| Budget tracking | Included | Included | Included |
| Vendor directory | Included | Included | Included |
| Vendor management | Included | Included | Included |
| Guest list | Included | Included | Included |
| Planner collaboration | Not included | Included | Included |
| Vendor collaboration | Not included | Included | Included |
| Committee collaboration | Not included | Up to 10 people | Up to 20 people |
| Family collaboration | Not included | Up to 10 people | Up to 20 people |
| AI Wedding Assistant | Not included | Not included | Included |
| Timeline management | Not included | Not included | Included |
| Gift Registry | Add-on | Add-on | Add-on |
| Guest RSVP & Management | Add-on | Add-on | Add-on |

## Important Product Distinctions

### Vendor management vs vendor collaboration

`Vendor management` stays in Free.

This means:

- browse vendors
- shortlist vendors
- compare vendors
- save notes
- mark vendor decisions

`Vendor collaboration` is paid.

This means:

- vendor-facing planning communication
- shared brief or vision alignment
- shared timeline communication
- location coordination
- workspace-based collaboration with vendors

### Guest list vs guest RSVP and management

`Guest list` stays in Free.

This means:

- add guests
- edit guest details
- basic guest planning

`Guest RSVP & Management` is a paid add-on.

This means:

- RSVP collection
- attendance tracking
- follow-up workflows
- grouped invitations
- richer coordination workflows

### Planner collaboration naming

Use `Planner collaboration` in product copy instead of `Planner engagement`.

It is clearer and sounds like platform capability instead of external consulting.

## Wedding-Level Entitlement Model

The couple product should move from the old profile-level `planning_pass` model to wedding-level entitlements.

The wedding is the paid workspace.

### Canonical wedding entitlement keys

These should be the capability names used for wedding access control:

- `wedding_collaboration`
- `planner_collaboration`
- `vendor_collaboration`
- `committee_collaboration`
- `family_collaboration`
- `timeline_management`
- `ai_wedding_assistant`
- `gift_registry`
- `guest_rsvp_management`

### Seat limits

These should be numeric limits associated with the wedding subscription rather than free-form role logic:

- `committee_seat_limit`
- `family_seat_limit`

Recommended values:

- Free:
  - `committee_seat_limit = 0`
  - `family_seat_limit = 0`
- Basic:
  - `committee_seat_limit = 10`
  - `family_seat_limit = 10`
- Premium:
  - `committee_seat_limit = 20`
  - `family_seat_limit = 20`

## Recommended Bundle Model

The existing schema already gives us the right foundation in:

- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/supabase/migrations/20260414194500_wedding_workspace_foundation.sql`

We should represent plans using wedding-level bundles in `public.wedding_subscription_bundles`.

### Couple bundles

Recommended primary bundle codes:

- `couple_basic_monthly`
- `couple_basic_annual`
- `couple_premium_monthly`
- `couple_premium_annual`

Recommended bundle types:

- `couple_plan`

### Add-on bundle codes

- `gift_registry_addon`
- `guest_rsvp_management_addon`

Recommended bundle types:

- `wedding_addon`

### Bundle-to-entitlement mapping

#### Free

No paid wedding bundle required.

The wedding simply has no paid collaboration entitlements.

#### Basic

Entitlements granted:

- `wedding_collaboration`
- `planner_collaboration`
- `vendor_collaboration`
- `committee_collaboration`
- `family_collaboration`

Seat metadata:

- `committee_seat_limit = 10`
- `family_seat_limit = 10`

#### Premium

Everything in Basic, plus:

- `timeline_management`
- `ai_wedding_assistant`

Seat metadata:

- `committee_seat_limit = 20`
- `family_seat_limit = 20`

#### Gift Registry add-on

Entitlement granted:

- `gift_registry`

#### Guest RSVP & Management add-on

Entitlement granted:

- `guest_rsvp_management`

## Gating Rules To Implement

### Free

Allow:

- tasks
- estimator
- budget tracking
- vendor discovery
- vendor management
- guest list

Block or upgrade-prompt:

- planner collaboration
- vendor collaboration
- committee invitations
- family invitations
- timeline management
- AI Wedding Assistant
- paid add-ons

### Basic

Allow:

- planner collaboration
- vendor collaboration
- committee collaboration within seat cap
- family collaboration within seat cap

Block or upgrade-prompt:

- AI Wedding Assistant
- timeline management
- committee invites beyond 10
- family invites beyond 10
- paid add-ons if not purchased

### Premium

Allow:

- all Basic collaboration
- AI Wedding Assistant
- timeline management
- larger seat caps

Block or upgrade-prompt:

- committee invites beyond 20
- family invites beyond 20
- paid add-ons if not purchased

## Upgrade Prompt Language

Use capability-based upgrade copy, not internal entitlement names.

Recommended examples:

- Upgrade to Basic to plan with your committee, family, planner, and vendors.
- Upgrade to Premium to unlock AI support and collaborative timeline management.
- Add Gift Registry to publish a wedding wishlist for guests.
- Add Guest RSVP & Management to collect responses and track attendance.

## Exact Changes Needed In pricingPlans.ts

File:

- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/lib/pricingPlans.ts`

### Current problem

The file is still built around audience-based paid products such as:

- `planning_pass`
- `committee_pass`
- `planner_pro`
- `vendor_pro`

This no longer matches the newer wedding-owned billing direction for couples.

### Recommended next refactor

Split pricing definitions into:

- wedding couple plans
- professional plans

For the couple side, replace the current one-time `planning_pass` shape with:

- `free`
- `basic_monthly`
- `basic_annual`
- `premium_monthly`
- `premium_annual`

Add add-ons:

- `gift_registry_addon`
- `guest_rsvp_management_addon`

### Recommended TypeScript model

Introduce a wedding-focused plan type alongside the existing audience model:

```ts
export type WeddingPlanTier = 'free' | 'basic' | 'premium';
export type WeddingPlanCadence = 'monthly' | 'annual';

export type WeddingPlanDefinition = {
  tier: WeddingPlanTier;
  cadence: WeddingPlanCadence | null;
  title: string;
  tagline: string;
  audience: 'couple';
  bundleCode: string | null;
  bundleType: 'couple_plan' | 'wedding_addon';
  annualPriceKes: number | null;
  monthlyPriceKes: number | null;
  stripeMonthlyLookupKey: string | null;
  stripeAnnualLookupKey: string | null;
  includedFeatures: string[];
};
```

### Recommended lookup keys to prepare for Stripe

- `couple_basic_monthly`
- `couple_basic_annual`
- `couple_premium_monthly`
- `couple_premium_annual`
- `gift_registry_addon`
- `guest_rsvp_management_addon`

### Feature matrix in code

Replace the current `free` vs `paid` rows for couples with a 3-tier matrix:

```ts
type CoupleFeatureRow = {
  feature: string;
  free: string;
  basic: string;
  premium: string;
};
```

This will let the pricing page speak clearly to the actual plan ladder.

## Exact Changes Needed In entitlements.ts

File:

- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/lib/entitlements.ts`

### Current problem

The current file still uses legacy audience-based feature keys such as:

- `couple.ai_assistant`
- `couple.connect_vendors`
- `couple.connect_planners`
- `couple.calendar_sync`
- `couple.export_progress`

And it still checks:

- `planning_pass_status`
- `planning_pass_expires_at`

on the profile.

That is no longer the right control plane for the couple product.

### Recommended next refactor

Introduce wedding-scoped entitlement checks for couple features.

Recommended couple feature keys:

- `wedding_collaboration`
- `planner_collaboration`
- `vendor_collaboration`
- `committee_collaboration`
- `family_collaboration`
- `timeline_management`
- `ai_wedding_assistant`
- `gift_registry`
- `guest_rsvp_management`

### Recommended decision API direction

Instead of basing couple access on the profile, base it on:

- active wedding id
- wedding entitlements
- wedding bundle seat metadata

Recommended context shape:

```ts
type WeddingEntitlementContext = {
  weddingId?: string | null;
  weddingEntitlements?: Record<string, boolean>;
  committeeSeatLimit?: number;
  committeeSeatsUsed?: number;
  familySeatLimit?: number;
  familySeatsUsed?: number;
};
```

### Couple gating examples

- inviting planner:
  - require `planner_collaboration`
- inviting vendor into collaboration:
  - require `vendor_collaboration`
- inviting committee member:
  - require `committee_collaboration`
  - require available committee seats
- inviting family collaborator:
  - require `family_collaboration`
  - require available family seats
- opening AI Wedding Assistant:
  - require `ai_wedding_assistant`
- editing collaborative timeline:
  - require `timeline_management`
- opening registry:
  - require `gift_registry`
- opening RSVP management:
  - require `guest_rsvp_management`

## Schema And Data Direction

The schema already supports most of this model through:

- `public.wedding_subscription_bundles`
- `public.wedding_entitlements`

Recommended next schema follow-up:

1. Standardize `bundle_type` and `bundle_code` values for couple plans and add-ons
2. Store seat caps in either:
   - `wedding_subscription_bundles.seat_limit` for the relevant collaboration bundle
   - or `wedding_entitlements.metadata`
3. Keep entitlements capability-based and wedding-scoped

### Recommended data normalization rule

Do not reintroduce `planning_pass` as the primary couple control plane.

If legacy planning-pass records still exist, map them into:

- wedding bundle codes
- wedding entitlements

Then gate the UI from the wedding, not the profile.

## Implementation Order

Recommended next coding sequence:

1. Add a dedicated wedding plan definition model in `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/lib/pricingPlans.ts`
2. Update the pricing page to use the new couple plan ladder
3. Refactor couple gating in `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/lib/entitlements.ts` to read from wedding entitlements
4. Keep planner and vendor subscriptions on their existing audience-specific model for now
5. Add add-on entitlement prompts for:
   - Gift Registry
   - Guest RSVP & Management

## Final Recommendation

Keep the product framing simple:

- `Free`: plan your wedding
- `Basic`: plan together
- `Premium`: run the whole wedding in one place

That is the clearest version of your pricing model and it fits the newer wedding-owned architecture cleanly.
