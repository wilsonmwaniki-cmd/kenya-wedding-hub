# Zania Conversational Planner — Production Validation Evidence

This log records the controlled production validation for deployment
`dpl_4WEuDUgQyGdVjwLYbpX5CprScyEG`. It deliberately omits personal data and
secrets. External contact and financial actions remain outside the release-day
read-only checks.

## 3 October 2026 — release and database boundary checks

| Check | Expected | Result | Status |
| --- | --- | --- | --- |
| Production frontend | Verified candidate serves the production domains and production Supabase project only | Deployment is `READY`; the live bundle contains `csrrnirpgkqjhvqcyxjp` and no staging or obsolete project reference | Passed |
| Production migrations | Release migrations match the reviewed repository | Post-release dry run reports no pending migrations | Passed |
| Edge authentication | Assistant, MCP, contract analysis and planner enquiry review reject unauthenticated requests | All four return `401` | Passed |
| New table boundary | Conversational-planner tables have RLS and are unavailable to `anon` | Seven target tables have RLS enabled and no anonymous table privileges | Passed |
| External contract files | Temporary contracts are private to the uploader | Bucket is private; object policies require the authenticated user's ID as the first folder segment | Passed |
| Gateway functions | Trigger-only functions are not directly callable; authenticated and token-gated functions have deliberate grants | Trigger functions reject `PUBLIC`, `anon` and `authenticated`; authenticated RPCs and token response functions match their intended caller | Passed |
| Designated planner identity | Production routes the designated owner account as a premium professional planner | One profile found: `planner`, `professional`, verified, active planner subscription, six active professional entitlements, one active linked client/wedding | Passed |
| Automated regression suite | Existing release behavior remains intact | 388 tests across 80 files pass; `git diff --check` passes | Passed |

### Authorization defect found and repaired

Inspection of the production `vendor_enquiries` insert policy found two
unqualified `wedding_id` references inside correlated subqueries. PostgreSQL
resolved them to the inner table, turning each intended cross-table equality
into a self-comparison. The conversational Gateway still re-read and matched
the active wedding and vendor before delivery, but a crafted direct Data API
insert could bypass the intended relationship check.

Migration `20261003042739_harden_vendor_enquiry_wedding_scope.sql` now:

- qualifies the enquiry, planner-client and vendor wedding references;
- preserves participant-only reads;
- removes unused authenticated `DELETE` privileges from Gateway confirmations,
  vendor enquiries and negotiation profiles.

Production verification shows the corrected policy expression, all three
delete privileges are false, anonymous enquiry privileges are false, and the
migration ledger is current. A database-only impersonation could not be used
for the final negative insert because Zania correctly requires a live trusted
device session; that check moves to the signed-in browser test.

## Pending signed-in release-day checks

The production sign-in page is open for the designated planner. Once that user
signs in, run these read-only checks in order:

1. Confirm the account lands in the professional planner workspace and the
   conversational assistant is available as a premium feature.
2. Confirm the selected client is the single active linked client and ask for a
   wedding summary, weekly priorities, tasks, budget, guests, vendors, payments
   and received documents.
3. Compare every amount, date and count with the corresponding production
   screens. Preserve missing values as unknown.
4. Reload the assistant and confirm the conversation persists for the same
   planner and selected client.
5. Attempt a read with an unrelated record ID through the normal UI/API path;
   expect an authorization failure with no private data.

Do not preview or confirm a write during this window. Couple, vendor,
multi-client and external-email tests require separately named consenting pilot
accounts.
