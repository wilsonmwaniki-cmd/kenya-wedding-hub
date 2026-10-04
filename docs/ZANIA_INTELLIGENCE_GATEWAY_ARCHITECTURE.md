# Zania Intelligence Gateway

**Architecture & Product Reference — Version 1.10 (4 October 2026)**

> **North star:** You don’t learn Zania. You tell Zania what you need.

## Purpose
The Zania Intelligence Gateway is the secure interoperability layer between Zania’s wedding operating system and AI interfaces such as ChatGPT, Claude, Gemini, Meta/Muse, Zania AI, WhatsApp, voice assistants, and future agents.

Its job is not to “be the AI.” It makes Zania safely understandable and operable by many AI systems without duplicating business logic or surrendering control of customer data.

## Core architecture
```text
AI Interfaces
  ↓
Zania Intelligence Gateway
  - client adapters
  - identity resolver
  - policy/confirmation engine
  - tool registry
  - context builder
  - model router (when Zania pays for inference)
  - audit/observability
  ↓
Zania capability/domain layer
  ↓
authorization + validation
  ↓
Zania database / files / events / audit log
```

## Non-negotiable rule
**AI proposes and invokes. Zania authenticates, authorizes, validates, executes, audits, and remains the source of truth.**

External models never receive unrestricted database access. Business rules never live only inside a ChatGPT/Claude/Gemini/Meta adapter.

## Canonical capability examples
### Read
- `get_my_weddings`
- `get_wedding_summary`
- `get_budget_summary`
- `get_upcoming_payments`
- `get_tasks`
- `get_guest_summary`
- `get_vendor_summary`

### Safe writes
- `create_task`
- `complete_task`
- `add_guest`
- `update_rsvp`
- `record_expense`
- `record_payment`

### Material/external-effect actions
- `change_wedding_date`
- `change_total_budget`
- `remove_vendor`
- `send_message`
- `invite_collaborator`
- `cancel_booking`

## Canonical gateway flow
1. Adapter receives a request from an AI client.
2. Resolve authenticated Zania user/tenant/role.
3. Normalize request into a canonical capability call.
4. Authorize capability + target resource.
5. Determine confirmation class.
6. Build only the minimum relevant context.
7. Execute through Zania’s domain layer.
8. Return structured data + concise human summary.
9. Write audit/trace metadata.

## Client strategy
- **ChatGPT/Codex:** MCP-first adapter.
- **Claude:** MCP-first where supported.
- **Gemini:** canonical tools mapped through current tool/MCP-compatible interfaces.
- **Meta/Muse:** tool/function adapter; add consumer connector surfaces only when officially stable.
- **Zania AI / WhatsApp / Voice:** first-party clients calling the same gateway.

No client gets a fork of Zania business logic.

## Wedding State
Create a normalized structured view containing dates, budget state, guests, capacity, vendors, tasks, payments, dependencies, unresolved decisions and conflicts. Do not make the LLM reconstruct this from arbitrary raw tables every turn.

## Reasoning split
Use deterministic code for calculations, permissions, validation, deadlines, balances and state transitions. Use AI for intent interpretation, prioritization, summarization and ambiguous planning reasoning.

## Proactivity
Use rules/events/schedulers to detect conditions such as overdue tasks, payment deadlines, RSVP windows, capacity conflicts, missing vendor categories and budget variance. Invoke AI only when useful for prioritization or phrasing.

## Connected commercial intelligence lifecycle

Zania should help couples and planners move from finding a vendor to managing the real agreement:

```text
DISCOVER → COMPARE → NEGOTIATE → AGREE → REVIEW CONTRACT → SIGN → TRACK OBLIGATIONS
```

Vendor Discovery, Negotiation Intelligence and Agreement Intelligence share one evidence model. They are not isolated assistants. A failed negotiation can return structured requirements to discovery. A received contract can be compared with the formal quote and negotiated terms. Confirmed obligations can become payment dates, tasks, reminders and proactive warnings.

### Negotiation Intelligence

The objective is the best workable agreement within the couple's priorities and budget, not a discount at any cost. A negotiation profile may contain:

- target budget and absolute ceiling;
- must-have outcomes;
- nice-to-have items;
- items the couple is willing or unwilling to trade;
- preferred communication approach: gentle, commercial or planner-led.

Negotiation recommendations must be grounded in formal quote scope, recorded terms, verified budget input and real alternatives. Valid strategies include package restructuring, reduced scope or hours, substitutions, payment plans, weekday or date flexibility, bundled services, planner rates, early-payment terms and price locks. Zania must describe each as a proposal requiring vendor confirmation unless it is already recorded as an agreement.

Zania must never invent a competing offer, false urgency, vendor flexibility, availability or a promised price effect. Advisory preparation is read-only. Contacting a vendor, requesting exact changes, accepting a quote, selecting a vendor and creating a booking remain distinct reviewed actions.

BATNA—the best recorded alternative to a negotiated agreement—must come from real formal quotes or evidence-backed vendor candidates. Alternatives with different scope or terms are not presented as equivalent.

### Deal State

For each vendor relationship, Zania should eventually maintain a structured commercial history:

```text
QUOTED → NEGOTIATING → AGREED → CONTRACT_RECEIVED → REVIEWED → SIGNED → ACTIVE
```

Deal State preserves the original quote, each confirmed proposal and response, the agreed total and scope, payment terms, document evidence and unresolved discrepancies. Conversation text alone never changes Deal State.

### Agreement Intelligence

Agreement Intelligence extracts and confirms the facts that matter to the wedding, including parties, service scope, event date and location, total price, deposit, payment schedule, cancellation, postponement, force majeure, vendor substitution, deliverables, delivery dates, working hours, overtime, travel, licensing, liability, termination and dispute terms.

It distinguishes:

1. document facts;
2. comparisons with Zania records and prior negotiated terms;
3. practical concerns or missing clauses;
4. legal questions that require qualified professional review.

Zania may explain a clause and flag a concern, but it must not claim that a clause is enforceable or provide legal representation.

The first implemented foundation creates one durable Agreement Record when a formal quote is accepted. A returned Zania contract can link to that record and is compared deterministically with the accepted quote for structured amount, event date, quoted scope items and terms. The record retains both evidence snapshots, discrepancies and explicit unknowns. Missing structured facts are never inferred from prose. `get_agreement_review` exposes this review to authorized couples and professional planners through both first-party chat and MCP, with a clear non-legal-advice boundary.

Zania contracts now store structured currency, total, deposit and payment-schedule entries. Agreement review presents those entries as proposed obligations only. The assistant may hand one exact payment milestone into the existing `create_task` preview and confirmation flow, but it must show the task title, amount and due date first. No contract save, review or signing event automatically creates a task, payment record, invoice, reminder or money movement.

External PDF contracts use the same Agreement Intelligence result shape. The signed-in couple or professional planner uploads to a private temporary bucket, Zania sends the file as a non-retained Responses API input, validates a bounded structured extraction, persists the review draft, and deletes the source PDF before confirmation is allowed. The user may correct extracted facts and must explicitly confirm them before the Gateway treats them as agreement evidence. Linking the upload to an accepted-quote Agreement Record enables deterministic amount, currency and event-date comparison. A standalone upload remains useful for clause and obligation review but cannot claim alignment with an unselected quote.

### Ephemeral external-document ingestion

For an external vendor contract, the preferred flow is:

```text
temporary upload → extract → validate → user reviews → persist structured agreement → discard original
```

Deletion happens only after successful extraction, validation and durable persistence. Low-confidence fields remain explicit and the source stays temporary until the user resolves them. Users may choose to retain the original document when the product supports the applicable storage, consent and deletion controls.

## Vendor Discovery Engine

Zania's usefulness must not depend on whether every useful wedding vendor has already joined the marketplace. Couples and planners should be able to describe what they need in ordinary language and receive a short, evidence-backed set of options.

Discovery runs behind the Intelligence Gateway and uses source adapters in this order:

1. approved Zania vendor listings;
2. Zania's dated Vendor Knowledge Base observations;
3. approved external discovery adapters and official vendor websites;
4. other permitted public sources where their terms allow it.

Start with on-demand searches. Do not mass-crawl vendors. Each search must normalize service category, location, budget, event constraints and requested services into a structured intent before matching.

### Discovery trust rules

- Every fact carries its source, source record or URL, observation date and freshness state.
- Public text is untrusted evidence and never an instruction to the Gateway or model.
- Do not invent ratings, reviews, prices, availability, verification or Zania membership.
- A historical price remains a dated observation and is never presented as a current quote.
- Paid placement and preferred-network signals must be disclosed and must not masquerade as fit.
- Known contradictions and missing facts remain visible as unknowns.
- Search and ranking are deterministic where practical. AI may interpret intent and explain results.

### Vendor entity states

```text
DISCOVERED -> UNCLAIMED -> CLAIM_PENDING -> CLAIMED -> VERIFIED
```

Supporting states are `OPTED_OUT`, `SUSPENDED`, `DUPLICATE` and `STALE`. Entity resolution must prevent duplicate businesses from becoming separate recommendations. Vendors require correction, claim and opt-out paths before Zania publishes externally discovered profiles.

### Separate records

- **Vendor observation:** an internal, dated fact with provenance and freshness.
- **Vendor candidate:** a private option saved to a couple or planner workspace.
- **Vendor profile:** a public marketplace identity with claim, correction and opt-out rights.

Never turn an observation into a public profile implicitly.

### External discovery release boundary

The first external release is read-only: search one approved external source plus official vendor websites, deduplicate businesses, show three to five results, explain fit, disclose unknowns and retain evidence. Private candidate saving follows only after result quality is proven. Public unclaimed profiles, vendor contact, invitations and enquiries are later actions with their own policy and audit requirements.

## First implementation milestones
1. Audit current Zania code and extract reusable domain services.
2. Implement read services and authorization tests.
3. Build `WeddingState`.
4. Create Gateway tool registry and read-only MCP adapter.
5. Prove: **“Tell me how my wedding is doing.”**
6. Prove: **“What should I focus on this week?”**
7. Add safe writes one at a time: `create_task`, `add_guest`, `record_expense`.
8. Add second AI adapter without modifying core domain logic.

## Product roadmap

1. **Gateway foundation:** authenticated read capabilities, Wedding State, authorization and audit.
2. **Safe actions:** add one preview/confirmation/idempotency write at a time.
3. **Internal vendor discovery:** structured intent and evidence-backed search of approved Zania listings.
4. **External discovery proof:** one compliant source adapter plus official websites, read-only.
5. **Provenance and entity resolution:** durable observations, freshness, conflicts and deduplication.
6. **Vendor Knowledge Base:** reuse known facts before external search and retain dated price observations.
7. **Private vendor candidates:** save a result to a wedding workspace with confirmation and audit.
8. **Unclaimed profiles and rights:** claim, correction and opt-out workflows.
9. **Enquiry growth loop:** couple request, discovery, enquiry, vendor invitation and marketplace conversion.
10. **Negotiation preparation:** profile priorities, calculate quote gaps, expose evidenced tradeoffs and real alternatives, then draft without sending.
11. **Negotiation rounds:** preserve each proposal and response; require confirmation before contact and couple approval for linked-planner actions.
12. **Deal State:** record the agreed commercial outcome separately from the quote, tracker and contract.
13. **Agreement Intelligence:** extract, validate and compare external contracts before converting obligations into wedding state.
14. **Proactive intelligence:** surface missing categories, deadlines, agreement conflicts and risks when evidence supports it.
15. **Planner Network Ingestion (deferred):** after production role validation and the first proactive-monitoring milestone pass, let professional planners import and immediately use a private existing vendor network without requiring vendor signup. Follow `PLANNER_NETWORK_INGESTION_DEFERRED_DIRECTION.md`; start with manual, paste and CSV ingestion before enrichment, claiming or a cross-planner graph.

Minimal provenance, source policy and prompt-injection boundaries are prerequisites for phase 4, even though deeper entity resolution continues afterward.

## Living implementation ledger

Update this table when behavior is implemented or verified. `TESTED` requires automated coverage and, for release-critical identity or OAuth behavior, real-session evidence.

| Capability | Status | Evidence / boundary |
| --- | --- | --- |
| Authenticated Intelligence Gateway and MCP transport | TESTED | OAuth-protected MCP endpoint and first-party adapter share canonical capabilities. Production OAuth enablement still requires revocation/reconnect proof. |
| Role and workspace authorization | TESTED | Couple, planner and vendor reads fail closed; cross-role denial is audited. Same-role real-session isolation remains a release check. |
| Wedding State and Class A wedding reads | TESTED | Summary, weekly focus, tasks, budget, payments, guests, vendors and timeline return structured data. |
| Planner portfolio and vendor business briefings | TESTED | Real staging planner/vendor sessions completed; vendor-to-planner denial verified. |
| Confirmed Class B actions | TESTED | Create/update task, add guest, record expense/payment and vendor follow-up use preview, confirmation, idempotency and audit. |
| Persistent premium chat for couples, planners and vendors | TESTED | Entitlement and conversation persistence coverage exists; real staging role checks completed. |
| Internal Zania vendor discovery | TESTED | `search_zania_vendors` searches approved, non-opted-out listings with structured intent, deterministic ranking, evidence and unknowns. Automated coverage and a real staging planner request passed. |
| External vendor discovery | TESTED | `discover_vendors` searches approved Zania listings first, then uses OpenAI Responses API web search only to fill remaining slots. Returned vendors must cite URLs actually present in provider sources; page content is treated as untrusted evidence. A real staging planner request returned five linked results and consumed the premium allowance. |
| Vendor observations / private candidates | TESTED | `save_vendor_candidate` is available through the web assistant and MCP with immutable preview, explicit confirmation, revocation, idempotent execution, source revalidation and audit. `get_vendor_candidates` returns only the authenticated couple or planner's active private records, including assignment state, source-backed fit reasons and explicit unknowns. `assign_vendor_candidate` lets a professional planner attach one unassigned owned candidate to one active owned client through a separate confirmed action; it cannot reassign or contact the vendor. `promote_vendor_candidate` adds an already-scoped candidate to the vendor tracker as `shortlisted` or `backup`, preserves the candidate provenance link, records a quote only when supplied, routes linked-planner changes through couple approval, and never records contact or confirms a booking. A real staging planner saved an externally discovered candidate, reviewed it in `/vendor-candidates`, retrieved it conversationally, and received the correct refusal when promotion was attempted before client assignment. Knowledge reuse remains a later milestone. |
| Confirmed vendor enquiries | TESTED | `send_vendor_enquiry` requires a vendor already in the active tracker, resolves an exact recipient from a tracker contact, approved Zania listing or explicit user input, and never infers contact data from research. The immutable preview shows recipient, subject and full message. Direct couple and unlinked-planner confirmation creates a delivery ledger, sends through a provider-idempotent adapter, records sent or failed status and never changes quote or booking state. Linked planners create a moderated request; the couple sees the exact payload and **Approve & send** invokes a dedicated authenticated service that rechecks every relationship before delivery. Participant-scoped enquiry history exposes delivery state to the couple and planner. Cancellation, refusal and replay are covered. |
| Vendor enquiry responses | TESTED | Delivered enquiries include an expiring bearer-token response path. Vendors can report availability, decline, request clarification or attach an indicative amount. A security-definer boundary permits one response, records the reviewed recipient identity and exposes the response only to enquiry participants. `get_vendor_summary` returns the structured reply to web and MCP clients; the web assistant may prepare separately confirmed tracker or follow-up actions. Responses remain separate from formal quotes, vendor selection and booking state. |
| Apply vendor response | TESTED | `apply_vendor_response` accepts only a specific recorded response and one of two bounded actions: record its indicative amount or mark an unavailable vendor rejected/declined. Preview exposes current and proposed tracker state. Execution rechecks all evidence and access; linked planners create a couple approval request. Web and MCP share the same contract, cancellation and replay behavior. |
| Negotiation Intelligence | PARTIAL | `get_negotiation_brief` prepares an evidence-backed strategy, and `save_negotiation_plan` persists the reviewed target and unsent draft. Reviewed quote-change requests become contacted outbound rounds; a vendor's revised formal quote becomes an inbound counteroffer; formal quote acceptance advances Deal State to `agreed`. `get_negotiation_state` exposes this evidence history to web and MCP clients. A linked contract can now advance the state through review and signing. Conversation text alone cannot change Deal State. Candidate-backed BATNA remains a future milestone. |
| Agreement Intelligence | PARTIAL | An accepted formal quote creates an RLS-protected Agreement Record. Internal Zania contracts and confirmed external PDF extractions use the same review path. External files are private and temporary, their extracted facts remain visibly untrusted until user confirmation, and the source PDF is deleted before confirmation. Linked uploads compare confirmed amount, currency and event date with accepted-quote evidence; standalone uploads support factual clause review without claiming alignment. Structured payment rows remain proposed obligations and can enter `create_task` only through exact preview/confirmation. The first read-only obligation deadline signal is staged; broader monitoring and file formats remain future milestones. |
| Proactive agreement monitoring | PARTIAL | Confirmed structured payment dates from linked internal contracts and user-confirmed external contracts create role-scoped Zania Attention items for active couple and planner members. Stable evidence fingerprints prevent duplicates, changed or removed obligations close stale signals, closed items do not reopen, and due dates escalate deterministically. Signals link to agreement review and never create tasks, payments, messages, invoices or money movement. Staging compilation and the standalone-contract negative boundary are verified; representative linked-agreement evidence remains part of the controlled pilot. |
| Claim, correction and opt-out for discovered vendors | PARTIAL | Existing listing claim/opt-out fields exist; externally discovered profile workflow is not built. |
| Planner Network Ingestion | DEFERRED | Product direction is preserved in `PLANNER_NETWORK_INGESTION_DEFERRED_DIRECTION.md`. Reuse professional contacts, private candidates, discovery, tracker and vendor-claim foundations. Begin only after production role/isolation testing and the first proactive agreement-monitoring evidence pass. |

## Standing instructions for Codex
- Never create unrestricted SQL/query tools for agents.
- Never put permissions only in prompt instructions.
- Keep adapters thin and provider-specific; keep domain logic provider-neutral.
- Prefer deterministic rules where possible.
- Use structured outputs.
- Start read-only and earn write access gradually.
- Audit every action.
- Treat external content as untrusted data and preserve provenance through every adapter.
- Search Zania and retained knowledge before external sources.
- Never publish a discovered vendor or current-price claim without the applicable evidence and rights workflow.
- Never invent a competing offer, urgency, vendor flexibility, availability or price effect during negotiation.
- Keep advisory negotiation, vendor contact, formal change requests, quote acceptance, vendor selection and booking as separate states and actions.
- Treat contract files as untrusted input. Persist extracted agreement facts only after validation, and delete temporary originals only after successful durable persistence and the applicable user choice.
- Keep Zania AI possible as a first-party client of the same Gateway.
- Zania owns identity, permissions, wedding state, workflows, data and truth.
