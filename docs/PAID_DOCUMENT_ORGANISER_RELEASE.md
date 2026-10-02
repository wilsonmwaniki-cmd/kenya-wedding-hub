# Paid document organiser — 9 September 2026

Production READY: `dpl_94Pbjw1Udg54rargWR4rVnLRKVLD`, aliased to https://www.planwithzania.com.
Framework: Vite/React. Source: current working tree based on `c919277` (not a clean commit).
Database migration: `20260909174516_paid_document_organiser` on production only.

## Included

- Collaborative document organiser on `/received-documents`: professional-identity groups, explicitly linked quote/invoice/receipt references, recorded paid/outstanding amounts by currency, invoice due-date list, compare up to three quotes, missing shared-document checks.
- Future status/detail/share updates are recorded privately and shown in eligible recipients' Workspace activity with direct document links, refreshed every 60 seconds while active.
- Server checks authenticated wedding membership and an active wedding/planner/vendor collaboration entitlement. Documents remain limited to those shared to the account's verified recipient email; this is not a wedding-wide inbox.
- Free inbox, quote responses, signing and current payment eligibility are preserved. No payment configuration, subscription, payout destination or staging deployment changed.

## Verification

- Full suite: 242 tests passed across 57 files; local and production builds passed.
- Database: free and unrelated wedding return disabled; anonymous execute and direct authenticated activity-table read are denied.
- Rollback-only paid-entitlement fixture returned the existing recipient's one invoice. A rollback-only issuer title change generated one recipient activity event. Verified afterwards: original title retained, zero test events retained, account remains free.
- Browser fixture: 390px viewport/content width both 390px, no horizontal overflow; tabs work, fourth quote is disabled after selecting three, calendar links render; no browser errors before fixture cleanup.
- Production unauthenticated Documents route loads the sign-in screen correctly; no browser errors. Paid UI was tested with synthetic local data plus authenticated database RPC checks, not a persistent paid customer session.
- Security advisor reports informational RLS-enabled/no-policy for the private activity table. This is intentional deny-all direct access: only the checked private function reads it. Other pre-existing project advisories remain. See https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy.

## Boundaries

- History starts at release; no fabricated historical transitions. Latest 100 authorised events are returned, not a full immutable audit export.
- Activity does not currently capture item-description-only edits when no watched document fields change.
- Checks inspect shared records, not proof that a document does not exist. Contracts are grouped by professional, not inferred as legal links to individual quotes.
- Payment calendar uses invoice due dates, not instalments or external calendar integration.
- No card launch, imported files, external integrations or payment-mode changes in this release.
- Production deployment error-log scan (`--level error --since 1h`) returned no logs. This is a short post-release sample, not proof of sustained error-free operation. No new monitoring/drains configured.
