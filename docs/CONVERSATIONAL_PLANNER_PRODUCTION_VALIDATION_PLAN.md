# Zania Conversational Planner — Production Validation Plan

Status: ready to run when the conversational-planner release is authorized for production.

This plan uses production because that environment contains the representative couples, planner clients, vendors, document requests and commercial documents needed to prove the complete journeys. It is a controlled pilot plan, not permission to deploy to production or contact users. Production deployment remains a separate release decision.

## Release rule

Start with named pilot accounts only. Do not widen access until the exit criteria at the end of this document pass. Every write must show its preview and require the actor's confirmation. External email tests must use a vendor who agreed to participate. Financial tests may record an already-completed real payment or exercise cancellation; they must not initiate a payment, refund or payout.

Keep one evidence log for every test:

- date and production deployment ID;
- signed-in role and selected wedding/client;
- exact user prompt;
- preview shown before a write;
- resulting entity or approval-request ID;
- expected and actual authorization result;
- screenshot or response text;
- cleanup performed, if any;
- defect and retest status.

## Production test schedule

| Window | Scope | Gate to continue |
| --- | --- | --- |
| Before release | Deployment, environment and migration preflight | Production bundle points only to production Supabase; migrations and function versions match the release; automated suite and build pass |
| Release day, first hour | Authentication, role routing, premium access and read-only smoke tests | Couple, planner and vendor land in the correct workspaces; free accounts are gated; no cross-role data appears |
| Release day, hours 1–4 | Real-data summaries and client selection | Answers match existing tasks, budget, guests, vendors, payments and documents for the selected workspace |
| Day 1 | Persistent chat and authorization isolation | Conversation history stays with the correct user, role and selected client; unrelated accounts cannot read each other's records |
| Days 2–3 | Controlled internal writes | Task, guest, expense, recorded-payment and reminder previews, cancellation, confirmation and replay behave correctly |
| Days 3–4 | Planner-to-couple approvals | Planner proposals remain pending until the linked couple approves; rejection produces no domain write |
| Days 4–5 | Vendor discovery and enquiry journey | Candidate provenance is preserved; promotion does not imply contact or booking; one consenting vendor receives one reviewed enquiry |
| Days 5–6 | Formal quote journey | One connected vendor receives one formal request, returns a real formal quote, and Zania reports the correct request/document states |
| Days 6–7 | Quote comparison, requested changes and agreement obligations | Comparison uses formal documents only; an exact change request is delivered once; contract financials remain proposals until each task is confirmed |
| End of week 1 | MCP/OAuth and operational review | ChatGPT reconnect/revocation works, audit evidence is complete, and no severity-one or severity-two defect remains |
| Week 2 | Small controlled pilot | Named pilot users complete normal work with monitored support; access widens only after the exit criteria pass |

## Test groups

### 1. Identity, roles and premium access — release day

- Sign in as one production couple, professional planner and vendor. Confirm each reaches the correct dashboard and conversational assistant.
- Confirm a committee planner cannot use professional-planner capabilities.
- Confirm a free or expired account sees the premium boundary and cannot call premium tools through either the web assistant or MCP.
- Confirm an entitled account can use the assistant and that usage is charged once per completed request.
- Verify email verification and resend behavior with a designated pilot address if production auth still requires verification.

### 2. Client and tenant isolation — release day and day 1

- In a planner account with at least two clients, switch between clients and ask the same summary question. Each answer must contain only the selected client's records.
- Open persistent chat after switching clients. Earlier client-specific context must not be reused as evidence for the new client.
- Repeat a read with a second unrelated planner and a second unrelated vendor. Each must receive only its own records.
- Attempt direct references to another account's wedding, client, request, document, candidate and confirmation IDs. Every attempt must fail before returning private data.
- Verify revoked, archived and invitation-only relationships do not grant access.

### 3. Real-data read accuracy — release day

For one representative wedding, compare the assistant's response with the existing application screens:

- wedding summary and weekly priorities;
- task totals, overdue tasks and due dates;
- budget allocation, recorded spending and upcoming payments;
- guest and RSVP counts;
- vendor tracker states, recorded payments and enquiry replies;
- timeline milestones;
- received documents and formal quote request states.

Amounts, dates, names and counts must match the source records. Unknown or missing values must remain unknown. Indicative enquiry amounts must never appear as formal quote totals.

### 4. Controlled internal writes — days 2–3

Use clearly labelled pilot records and remove them after verification when deletion will not damage audit evidence.

- Create and edit one task; cancel one preview; replay one executed confirmation and prove there is still one task.
- Add one guest through the couple path and one through a planner-to-couple approval. Reject a second planner proposal and prove no guest was created.
- Record one small test expense in a designated pilot budget category. Confirm it changes spending only.
- Record one already-completed real payment or use the cancellation path. Confirm it never moves money, invokes Zania Pay or creates an invoice receipt.
- Create and complete one private vendor follow-up for the signed-in vendor's own connected booking.
- Verify every action writes one audit receipt and uses the expected wedding/client scope.

### 5. Candidate-to-enquiry journey — days 4–5

- Discover a vendor from an approved Zania listing or sourced public result. Check source links, reasons and unknowns.
- Save it as a private candidate, assign it to the intended planner client and promote it to the tracker as shortlisted.
- Confirm these steps do not contact the vendor, create a public listing, select the final vendor or create a booking.
- Prepare an enquiry to one consenting pilot vendor. Verify exact recipient, subject and full message before confirmation.
- Confirm the email is delivered once and the enquiry ledger records the provider receipt.
- Use the vendor response link to return Available, Unavailable or Need more details. Confirm the response is immutable evidence and does not change tracker selection or price automatically.

### 6. Formal quote journey — days 5–7

- From a connected tracker vendor, request one formal quote. If a linked planner initiates it, confirm the vendor receives nothing until the couple approves.
- Have the pilot vendor view and respond with a formal quote containing realistic items, total, validity, notes and terms.
- Ask Zania which requests are new, viewed, responded to or overdue. Compare the answer with the received-document screens.
- Ask Zania to compare returned formal quotes. Confirm it uses only formal document totals and clearly preserves differences in scope, terms, exclusions and validity.
- Request exact changes to one returned quote. Verify the preview contains the correct document number, vendor and complete message.
- For the linked-planner path, reject one request and approve a separate one. Rejection must send nothing; approval must create one `changes_requested` response.
- Replay the confirmed request and prove no duplicate response is created.

The later vendor-selection action should be built and tested only after this production quote journey supplies a genuine returned formal quote. Its separate acceptance criteria are: exact source document, formal total recorded in the tracker, linked-planner couple approval, idempotent execution, and no automatic quote acceptance or booking creation.

### 7. Agreement review and obligation handoff — days 6–7

- Accept one representative formal quote and confirm exactly one Agreement Record is created from that accepted evidence.
- Link or return one Zania contract containing a total, deposit and at least two dated payment-schedule entries. Confirm the shared and printable contract views match the saved structure.
- Upload one consenting vendor's external PDF contract and link it to the accepted quote. Confirm the file is private, extraction records confidence and unknowns, and the temporary source is deleted before confirmation is enabled.
- Correct at least one extracted value before confirming. Verify conversation and MCP distinguish the earlier unconfirmed extraction from the reviewed facts and compare only the confirmed version.
- Upload a second contract without linking an accepted quote. Confirm Zania can summarize the reviewed clauses but does not claim that the contract matches an agreement.
- Ask Zania to review the contract against the accepted quote. Verify discrepancies and unknowns match the documents and that the response makes no legal conclusion.
- Confirm the proposed obligations do not appear as tasks, payments, reminders, invoices or Zania Pay activity before an explicit action.
- Ask Zania to create one exact payment reminder task. Verify the preview includes the title, amount and due date; cancel it and prove no task exists. Confirm a second preview, replay the confirmation, and prove exactly one task exists.
- Switch clients in a planner account and confirm agreement evidence and proposed obligations never cross the selected-client boundary.

### 8. ChatGPT MCP and OAuth — end of week 1

- Connect the production MCP server from a designated pilot ChatGPT account and approve access.
- Compare one read result with the Zania web assistant for the same identity and selected client.
- Run one low-impact confirmed write and verify the same preview, confirmation, authorization and receipt semantics as the web assistant.
- Revoke the OAuth connection. Confirm the old token can no longer read or write.
- Reconnect and confirm a new session works without restoring access from the revoked token.

### 9. Reliability and support checks — throughout week 1

- Review Edge Function errors, failed deliveries, authorization denials, AI usage and cost after every test window.
- Verify model or provider failure returns a useful retry message and never commits a partial write.
- Verify duplicate browser submissions and network retries produce one result.
- Test desktop and mobile for confirmation cards, long responses, source links and error recovery.
- Record confusing prompts and wrong tool choices as product defects even when authorization remains safe.

## Stop conditions

Pause the pilot immediately if any test reveals:

- cross-user, cross-client or cross-role data exposure;
- a write without explicit confirmation;
- an external email sent before the reviewed approval step;
- duplicate money, guest, task, enquiry, quote-request or quote-response records after replay;
- an indicative amount represented as a formal quote;
- a quote accepted, vendor selected or booking created implicitly;
- incorrect production environment wiring;
- unexplained payment, refund or payout activity.

## Exit criteria for widening the pilot

- All role and tenant-isolation tests pass with real independent accounts.
- Read summaries match production source records for at least one representative wedding per supported role.
- Every supported write passes preview, cancellation, confirmation and idempotent replay.
- The linked planner-to-couple approval path passes for guest/budget changes, enquiry, formal quote request and formal quote changes.
- One consenting vendor completes enquiry response and formal quote journeys end to end.
- One accepted quote and linked contract complete agreement comparison, obligation cancellation, explicit task confirmation and idempotent replay without financial side effects.
- OAuth revoke and reconnect pass.
- No unresolved severity-one or severity-two defects remain.
- Support owner, rollback path and evidence log are ready before access expands.

## Ownership and calendar conversion

The schedule is relative to the production release so it remains valid if the release date changes. When a production release date is chosen, convert **Release day** and **Days 1–7** into calendar dates and name the couple, planner and vendor pilot accounts. Do not begin the external enquiry or formal quote windows until those participants have agreed to the test.
