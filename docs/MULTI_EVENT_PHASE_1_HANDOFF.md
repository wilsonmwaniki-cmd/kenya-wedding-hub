# Multi-Event Weddings Phase 1 Handoff

## Outcome

Phase 1 has been implemented, validated, and applied to the linked Supabase project on 24 August 2026.

Implemented:

- additive `wedding_events` schema
- explicit authenticated Data API grants and RLS
- one active primary-event constraint
- neutral and idempotent existing-wedding backfill
- compatibility synchronization with `weddings.wedding_date`
- nullable task and timeline event relationships
- server-side cross-wedding relationship validation
- atomic primary-event selection RPC
- typed application data-access helpers
- unit coverage for culture-neutral names, same-day ordering, date ranges, and next-event selection

## Migration reconciliation and release

The linked database was ahead of this checkout by 50 migrations. Those migration files were reconstructed from the authoritative `supabase_migrations.schema_migrations` ledger, added without changing the live ledger, and byte-for-byte verified against all 238 recorded statements.

After reconciliation, `supabase db push --dry-run --include-all` listed only `20260823225725_multi_event_wedding_foundation.sql`. The migration was then validated inside a live transaction with assertions and rolled back before the release command applied it normally. The live migration ledger now records version `20260823225725`.

## Verification evidence

- Targeted wedding-event tests: 5 passed
- Full Vitest suite: 70 passed across 17 files
- TypeScript: `npx tsc --noEmit` passed
- Targeted ESLint for changed TypeScript: passed
- Production build and prerender: passed
- `git diff --check`: passed
- Full repository ESLint: failed on 457 pre-existing errors and 80 warnings outside the changed files
- Live Supabase schema preflight: passed; no conflicting table or columns exist
- Migration history reconciliation: passed; 50 missing files match all 238 authoritative live statements
- Remote migration dry run: passed; only the multi-event foundation migration was pending
- Transactional migration validation: passed and rolled back; backfill, grants, RLS, uniqueness, relationship scope, synchronization, and primary-event switching were asserted
- Production migration application: passed on 24 August 2026
- Post-apply live audit: passed; 11 dated weddings have 11 matching primary events, with zero duplicates or mismatches
- Post-apply Supabase security advisor: no finding related to this migration
- Post-apply Supabase performance advisor: two expected informational unused-index notices for the new task and timeline event indexes
- Supabase TypeScript types: regenerated from the applied schema

## Mandatory Phase 1 self-review

### Product model

- `PASS` The wedding remains one workspace with many child events.
- `PASS` Event names are free text and trimmed only.
- `PASS` No culture, religion, ritual, or gender is inferred.
- `PASS` Existing one-day weddings receive one neutral primary event.
- `PASS` Null task/timeline event relationships remain wedding-wide.
- `PASS` Same-date events are ordered by explicit sort order and remain separate records.

### Data integrity

- `PASS` Events are wedding-scoped by foreign key and RLS.
- `PASS` Cross-wedding task/timeline attachment is rejected by a database trigger.
- `PASS` A partial unique index permits at most one active primary event.
- `PASS` The backfill uses an idempotent `not exists` guard.
- `PASS` Existing records are preserved; event foreign keys use `on delete set null`.
- `PASS` Authenticated clients receive no event delete grant.
- `PASS` Null event relationships consistently mean `Entire wedding`.

### Compatibility

- `PASS` Existing `weddings.wedding_date` remains available.
- `PASS` Database triggers synchronize the legacy date and active primary event.
- `PASS` Timeline templates are prohibited from event attachment.
- `PASS` No public timeline token or payload behavior is changed in Phase 1.
- `PASS` Event writes use the existing wedding owner/admin permission helper.
- `PASS` Dates remain PostgreSQL `date` values and local times remain `time without time zone`.

### UX and accessibility

- `N/A` Event management UI is Phase 2.
- `N/A` Workspace event selector is Phase 2/3.
- `N/A` Mobile and keyboard event UI verification begins with Phase 2.
- `PASS` New helper errors use user-facing language.
- `PASS` New names and documentation avoid single-day and cultural assumptions.

### Security

- `PASS` RLS and explicit grants are included in the migration.
- `PASS` UUID possession alone does not grant access.
- `N/A` Public RPC payloads were not extended in Phase 1.
- `PASS` Archived events are excluded from active selection and cannot remain primary.
- `PASS` Privileged trigger functions have empty search paths and direct execution revoked.
- `PASS` Primary selection uses a security-invoker RPC with an explicit permission check.

### Verification

- `PASS` Relevant automated application tests pass.
- `PASS` Migration execution was transactionally validated, rolled back, then applied through the reconciled migration history.
- `PASS` Targeted lint and TypeScript checks pass.
- `PASS` Production build passes.
- `N/A` Browser verification begins when Phase 2 adds UI.
- `PASS` One-day, multi-day, and same-date event helper scenarios are tested.
- `PASS` Remaining single-date assumptions are inventoried and deferred explicitly.

## Required next actions

1. Add repeatable database-level tests for RLS, primary uniqueness, idempotent backfill, cross-wedding rejection, and compatibility triggers.
2. Begin Phase 2 event management UI on the validated schema.
3. Recheck the two new index-usage notices after production traffic exercises event-scoped task and timeline queries.
