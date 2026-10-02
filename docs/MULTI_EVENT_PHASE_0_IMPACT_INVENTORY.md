# Multi-Event Weddings Phase 0 Impact Inventory

## Scope of this implementation pass

This pass implements the event data foundation only:

- a wedding-scoped `wedding_events` table
- RLS and explicit Data API grants
- legacy primary-date compatibility
- idempotent backfill for existing dated weddings
- nullable event relationships for timelines and tasks
- server-side cross-wedding relationship validation
- typed application data-access helpers
- focused helper tests

It does not add event management screens, workspace filters, per-event RSVP, vendor assignment, budget allocation, contracts, seating, or deployment.

## Canonical workspace and permissions

The canonical wedding workspace is `public.weddings`, introduced in:

- `supabase/migrations/20260414194500_wedding_workspace_foundation.sql`

Wedding-scoped membership and permission helpers are introduced in:

- `supabase/migrations/20260414195500_wedding_workspace_permissions.sql`

The event foundation reuses:

- `public.is_wedding_member(wedding_id)` for participant reads
- `public.can_manage_wedding(wedding_id)` for owner/admin mutations

No account-global cultural or religious role is introduced.

## Existing date sources

Current compatibility date sources include:

- `weddings.wedding_date`
- `profiles.wedding_date`
- `planner_clients.wedding_date`
- `timelines.timeline_date`
- `wedding_portfolios.wedding_date`
- commercial-document and vendor booking event dates

The migration keeps `weddings.wedding_date` synchronized with the active primary event. Profile, planner-client, portfolio, contract, and booking migration remains later-phase work because they have independent compatibility and publication behavior.

## Existing wedding-date consumers

High-impact application consumers identified during discovery:

- `src/contexts/AuthContext.tsx`
- `src/contexts/PlannerContext.tsx`
- `src/lib/authEntryFlows.ts`
- `src/lib/commercialDocuments.ts`
- `src/lib/estimatorPlanSeed.ts`
- `src/lib/pendingWeddingSetup.ts`
- `src/lib/weddingWorkspace.ts`
- `src/pages/AdminPortal.tsx`
- `src/pages/Budget.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/GuestRsvp.tsx`
- `src/pages/Guests.tsx`
- `src/pages/ManagePortfolio.tsx`
- `src/pages/PlannerDashboard.tsx`
- `src/pages/ProfileSettings.tsx`
- `src/pages/VendorClaim.tsx`
- `src/pages/VendorDashboard.tsx`
- `src/pages/Vendors.tsx`
- `src/pages/WeddingPortfolio.tsx`

High-impact function consumers:

- `supabase/functions/send-guest-invite/index.ts`
- `supabase/functions/send-wedding-invite/index.ts`
- `supabase/functions/send-workspace-vendor-invite/index.ts`
- `supabase/functions/wedding-ai-chat/index.ts`

These consumers must not be converted mechanically. Each needs product-specific handling for one event, a date range, a primary event, or per-event attendance.

## Wedding creation and update paths

Current creation paths converge on versions of `public.create_wedding_workspace` called from:

- `src/lib/weddingWorkspace.ts`
- `src/lib/pendingWeddingSetup.ts`

Additional date updates occur through profile/workspace settings and planner-client management. The event foundation uses database triggers so existing wedding creation and direct `weddings.wedding_date` updates create or update the neutral primary event without requiring scattered client-side dual writes.

## Timeline behavior

`timelines` already supports:

- multiple timelines per user/wedding
- a separate `timeline_date`
- templates
- public share tokens
- per-assignee share links

The foundation adds a nullable `event_id`. Existing non-template timelines are backfilled only when wedding and date produce exactly one event match. Templates remain event-independent. Public link behavior is unchanged in this phase.

## Task behavior

Tasks already support wedding scoping, assignment, phases, visibility, and delegation. The foundation adds nullable `event_id` with this invariant:

- `event_id is null` means `Entire wedding`

No existing task is assigned to an event by title, due date, category, or cultural wording.

## Security and API exposure

The event table:

- has RLS enabled
- revokes default access from `public`, `anon`, and `authenticated`
- grants only `select`, `insert`, and `update` to `authenticated`
- grants no client-side delete capability
- uses wedding membership for reads
- uses owner/admin permission for writes
- validates task/timeline event relationships server-side

This explicit grant model accounts for Supabase's 2026 change that new tables are not automatically exposed to the Data API.

## Deferred single-date assumptions

The following remain intentionally deferred:

- onboarding UI for one day versus several days
- dashboard date ranges and next-event countdowns
- event-specific invitations and RSVP
- guest-event attendance and check-in
- vendor-event assignments
- event-level budgets and payments
- event-level contracts and deliverables
- event-level seating and space plans
- portfolio presentation of multiple dates
- AI assistant context for multiple events

These are not regressions introduced by Phase 1; they are the documented scope of later phases.

## Live schema preflight on 24 August 2026

A read-only query against Supabase project `csrrnirpgkqjhvqcyxjp` confirmed:

- PostgreSQL version: `17.6`
- `public.wedding_events` does not exist
- `tasks.event_id` does not exist
- `timelines.event_id` does not exist
- 12 wedding workspaces exist
- 11 wedding workspaces currently have a wedding date
- no dated, non-template wedding timelines currently require relationship backfill

No migration or data change was applied during this preflight.

## Reconciliation and application on 24 August 2026

The 50 missing migrations from `20260722095907` through `20260823080219` were reconstructed from the authoritative live migration ledger and verified against all 238 recorded statements without rewriting that ledger. A subsequent dry run showed only `20260823225725_multi_event_wedding_foundation.sql` pending.

The multi-event migration passed a transaction-and-rollback validation, was applied normally, and is recorded in the live ledger. The post-apply audit confirmed 11 primary events for the 11 dated wedding workspaces, no duplicate primary events, matching legacy dates, active RLS, correct grants, both event foreign keys, and all compatibility and scope-validation triggers.
