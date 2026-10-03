# Zania Conversational Planner — Production Validation Evidence

This log records the controlled production validation that began from deployment
`dpl_4WEuDUgQyGdVjwLYbpX5CprScyEG` and continued through the signed-in corrections
listed below. It deliberately omits personal data and
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
| Automated regression suite | Existing release behavior remains intact | 391 tests across 80 files pass; TypeScript, the production build and `git diff --check` pass | Passed |

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

## Signed-in planner release-day checks

| Check | Evidence | Status |
| --- | --- | --- |
| Planner identity and client context | The designated account landed in the professional planner workspace and exposed its single active linked wedding | Passed |
| Premium assistant availability | The full Planner Operations Copilot and the persistent in-workspace assistant are available; allowance started at 0/300 | Passed |
| Production route exposure | `/ai-chat` had been omitted from the production launch-path allowlist; the route was added, tested and deployed | Repaired and passed |
| Workspace coverage | The page originally read only the first 100 task rows. Bounded reads were raised to 1,000 in the page and assistant function; the live workspace signal now matches the application at 133 open and 68 overdue tasks | Repaired and passed |
| Grounded read response | A read-only weekly-blocker prompt used the selected wedding's tasks, budget, vendors, payments, guests and timeline without proposing or performing a write | Passed |
| Follow-up after a long response | A persisted assistant answer over 6,000 characters originally caused the next request to fail. Historical messages are now shortened and total model history is bounded on both client and server | Repaired and passed |
| Exact task-count comparison | The corrected follow-up returned 140 total, 7 completed, 133 open and 68 overdue tasks, matching the live workspace records | Passed |
| Usage accounting | The failed request did not consume allowance; the two successful requests produced 2/300 usage | Passed |
| Persistence | Reloading `/ai-chat` restored the selected client, prior long briefing and corrected task-count response | Passed |
| Browser errors | The post-fix request and reload produced no new browser error; the captured console retains only the earlier reproduced length failure | Passed |
| Planner context restoration | The assistant waits for the persisted active client to finish hydrating before it accepts a prompt, preventing a valid planner session from being read as clientless after navigation or reload | Repaired and passed |
| Budget definitions | The assistant and Budget page now distinguish intended/allocated budget, recorded spend, confirmed vendor quotes, payment-log payments and vendor-tracker payments; the signed-in response matched the visible production records | Repaired and passed |
| Received documents | A later private-schema hardening migration had broken both public RPC wrappers. Migration `20261003093615_repair_received_document_rpc_wrappers.sql` keeps the private schema closed and runs the narrow public wrappers as definer functions; production now resolves the organiser entitlement and document list successfully | Repaired and passed |

The route correction was deployed as `dpl_Dz5x5V6Xg5z2VkRPHQbfDW73qXMP`, the
complete-row correction as `dpl_ev6mN4Gti2hVy8egWNUeoY54J7vr`, and the final
persistent-history correction as production deployment
`dpl_D2f8X8QpP6eRm1Az6Qz7et5vAHw5`. The final deployment is `READY` and aliased
to `www.planwithzania.com`. The production `wedding-ai-chat` Edge Function was
redeployed with the matching server-side compaction.

No task, payment, vendor message, email or other write was previewed or
confirmed. Unrelated same-role isolation, a second planner or client, couple and
vendor role checks, and external-contact journeys still require separately
named consenting pilot accounts.

The later signed-in checks also confirmed that `/guests` and `/timeline` remain
intentionally outside the production route allowlist. Their page-to-assistant
comparisons therefore remain release decisions rather than failures in this
validation run.
