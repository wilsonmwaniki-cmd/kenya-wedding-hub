# Professional Pricing And Entitlement Implementation Spec

## Purpose

This document translates the agreed planner and vendor pricing strategy into:

- polished pricing copy for the website
- a final feature matrix
- the entitlement model we should implement next
- the exact direction for `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/lib/pricingPlans.ts`
- the exact direction for planner and vendor gating in the app

This spec assumes the professional side of Zania is sold separately from couple-owned wedding plans:

- couples buy access at the wedding workspace level
- planners and vendors buy access for their own business operations
- professional add-ons expand visibility, media, and team collaboration rather than changing couple-owned billing

## Product Thesis

Planners and vendors should be able to join Zania for free at the point of discovery.

They should pay when Zania becomes part of how they run their business:

- managing inquiries and bookings
- handling quotes, invoices, and receipts
- coordinating contracts
- building public trust and reputation

That means the professional product should be sold in three layers:

- `Free`: get discovered
- `Premium`: run your wedding business on Zania
- `Add-ons`: grow your business

This structure should apply to both planners and vendors, with UI language adjusted for each audience where needed.

## Website Pricing Copy

### Pricing hero

**Headline**

Run your wedding business on Zania

**Support copy**

Start with a verified listing for discovery. Upgrade when you need business tools for inquiries, bookings, contracts, payments, and public trust.

### Free

**Title**

Free

**Tagline**

Get discovered on Zania

**Support copy**

Best for planners and vendors who want a public profile, directory visibility, and a verified business presence before upgrading into operational tools.

**Includes**

- Directory listing
- Basic public profile
- Verification eligibility

**CTA**

Start free

**Important note**

Listings should only be publicly visible after verification.

### Premium

**Title**

Premium

**Price**

KES 9,000 / year or KES 1,000 / month

**Tagline**

Run your wedding business on Zania

**Support copy**

Manage inquiries, bookings, payments, contracts, and public credibility in one business workspace designed for wedding professionals.

**Includes**

- Inquiries and bookings tracker
- Quotes, invoicing, and receipts
- Couple-linked payment tracking
- Contract management with reusable templates
- Public ratings from completed weddings

**CTA**

Upgrade to Premium

### Add-ons

**Section title**

Add-ons

**Support copy**

Grow your business with richer portfolio media, promoted visibility, and team collaboration.

#### Media

Showcase your work with a richer photo and video portfolio experience beyond a basic profile.

#### Advertising

Promote your listing through boosted placement, featured visibility, and directory marketing opportunities.

#### Team Workspace

Collaborate with colleagues inside Zania through bundled team seats for planning firms, photography teams, decor teams, and other business groups.

## Final Feature Matrix

| Feature | Free | Premium |
|---|---|---|
| Directory listing | Included | Included |
| Verification eligibility | Included | Included |
| Public profile | Basic | Advanced |
| Inquiries tracker | Not included | Included |
| Bookings tracker | Not included | Included |
| Quotes, invoicing, and receipts | Not included | Included |
| Couple-linked payment tracking | Not included | Included |
| Contract management | Not included | Included |
| Public ratings | Not included | Included |
| Rich media portfolio | Add-on | Add-on |
| Advertising | Add-on | Add-on |
| Team workspace | Add-on | Add-on |

## Important Product Distinctions

### Listing visibility vs business operations

`Directory listing` stays in Free.

This means:

- create a planner or vendor profile
- submit business details
- appear publicly once verified
- be discoverable in the directory

`Business operations` is Premium.

This means:

- tracking inquiries
- managing bookings
- producing quotes and invoices
- linking receipts and payment records into couple workflows
- managing contracts
- surfacing public trust and ratings

### Verification vs public listing

Verification should not be sold as a paid feature.

Recommended rule:

- free users can apply for verification
- public listing should only go live after verification passes
- Premium should not bypass verification

This preserves trust in the professional directory.

### Public ratings and reputation

`Public ratings` should be shown only when they are reputation-safe.

Recommended rule set:

- ratings should come only from real completed weddings
- public reputation should only surface after a minimum threshold that avoids thin or misleading profiles
- reputation may eventually combine:
  - average couple rating
  - completed weddings on Zania
  - responsiveness or booking reliability

### Media add-on scope

Basic profile imagery should remain free.

The `Media` add-on should mean:

- richer galleries
- more photos and videos
- premium portfolio presentation
- embedded highlight content where relevant

This keeps free listings credible while still making the paid add-on valuable.

### Team workspace add-on scope

`Team Workspace` should be sold as business collaboration seats, not a different professional plan tier.

That means:

- a planner or vendor account owns the workspace
- colleagues are added as seats under that workspace
- billing expands by seat bundle, not by creating separate standalone accounts

## Professional Entitlement Model

The planner and vendor product should be account-owned rather than wedding-owned.

### Canonical professional entitlement keys

These should be the capability names used for professional access control:

- `directory_listing`
- `verified_listing`
- `booking_management`
- `invoicing`
- `contract_management`
- `public_reputation`
- `media_portfolio`
- `advertising`
- `team_workspace`

### Seat limits

These should be numeric limits associated with team collaboration rather than role-specific branching logic:

- `team_workspace_seat_limit`

Recommended values:

- Free:
  - `team_workspace_seat_limit = 0`
- Premium without add-on:
  - `team_workspace_seat_limit = 0`
- Team Workspace add-on:
  - seat limit depends on purchased bundle

Recommended first bundle ladder:

- 3 seats
- 5 seats
- 10 seats

### Plan-to-entitlement mapping

#### Free

- `directory_listing = true`
- `verified_listing = false` until approved by moderation/verification flow

#### Premium

- `directory_listing = true`
- `booking_management = true`
- `invoicing = true`
- `contract_management = true`
- `public_reputation = true`

Verification still remains controlled by the verification process, not auto-granted through payment.

### Add-on mappings

- `media_addon` -> `media_portfolio`
- `advertising_addon` -> `advertising`
- `team_workspace_bundle` -> `team_workspace`

The seat count should be stored separately from the boolean capability.

## Gating Rules In Product Terms

### Free professional experience

Allow:

- create business profile
- submit listing
- maintain profile details
- be visible after verification

Block or upgrade-prompt:

- inquiries and bookings tracker
- quotes/invoicing/receipts
- couple-linked payment tracking
- contract management
- public ratings display
- advanced media portfolio
- advertising tools
- team collaboration seats

### Premium professional experience

Allow:

- inquiries and bookings tracker
- quotes/invoicing/receipts
- couple-linked payment tracking
- contract management
- public ratings and credibility tools

Block or upgrade-prompt:

- premium media presentation if Media add-on is not active
- boosted/featured placement if Advertising add-on is not active
- colleague collaboration if Team Workspace add-on is not active

### Add-ons

#### Media

Unlock:

- advanced photo galleries
- video-rich portfolio presentation
- media-heavy public showcase layouts

#### Advertising

Unlock:

- sponsored or boosted placement
- featured listing slots
- paid visibility controls and reporting

#### Team Workspace

Unlock:

- invite colleagues
- assign internal business roles
- collaborate across team workflows inside one professional workspace

## Recommended Product Language In Upgrade Prompts

Use product-facing prompts like:

- `Upgrade to Premium to manage inquiries, bookings, contracts, and payments in one place.`
- `Add Media to unlock a richer photo and video portfolio.`
- `Add Advertising to promote your listing and increase visibility.`
- `Add Team Workspace to collaborate with colleagues inside your business workspace.`

Avoid internal language like:

- `You need entitlement X`
- `Enable planner_pro`
- `Enable vendor_pro`

## Exact Direction For `/src/lib/pricingPlans.ts`

### Keep a shared professional plan shape

The code should support a shared professional plan ladder for planners and vendors:

- `Free`
- `Premium`
- add-ons for Media, Advertising, and Team Workspace

### Recommended plan codes

Planner and vendor can keep separate Stripe product keys if needed, but the product language should stay aligned:

Planner premium:

- `planner_premium_monthly`
- `planner_premium_annual`

Vendor premium:

- `vendor_premium_monthly`
- `vendor_premium_annual`

Recommended add-on codes:

- `media_addon`
- `advertising_addon`
- `team_workspace_bundle_3`
- `team_workspace_bundle_5`
- `team_workspace_bundle_10`

### Recommended refactor direction

Refactor current professional pricing so that:

- `Planner Pro` becomes `Premium`
- `Vendor Pro` becomes `Premium`
- the planner/vendor cards share the same commercial structure but keep audience-specific copy

## Exact Direction For Entitlements And Gating

### Planner gating should check

- `booking_management`
- `invoicing`
- `contract_management`
- `public_reputation` where planner reputation surfaces publicly
- `media_portfolio` for richer portfolio features
- `advertising` for promotion tools
- `team_workspace` plus `team_workspace_seat_limit` for colleague access

### Vendor gating should check

- `booking_management`
- `invoicing`
- `contract_management`
- `public_reputation`
- `media_portfolio`
- `advertising`
- `team_workspace` plus `team_workspace_seat_limit`

### Verification state should remain separate

Do not model verification purely as a paid entitlement.

Verification should stay as a moderation/business trust state with its own review workflow.

## Suggested Next Implementation Steps

1. Add a professional pricing implementation spec to the docs so planner/vendor pricing has the same structure as couple pricing.
2. Refactor `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/lib/pricingPlans.ts` so planner and vendor plans use the newer Free / Premium + add-on structure.
3. Update `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/Pricing.tsx` so planners and vendors are shown using the newer commercial framing.
4. Refactor professional gating so the app checks capability-style entitlements rather than audience-tier names alone.
5. Add professional add-on checkout and gating for:
   - Media
   - Advertising
   - Team Workspace

## Summary Recommendation

Keep the professional commercial structure simple:

- `Free`: get discovered
- `Premium`: run your wedding business
- `Add-ons`: grow your business

That is clear, commercially strong, and consistent with the rest of the Zania pricing system.
