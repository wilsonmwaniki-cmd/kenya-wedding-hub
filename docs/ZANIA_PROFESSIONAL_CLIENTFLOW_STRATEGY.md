# Zania Professional Clientflow Strategy

## Purpose

This is the durable product guide for every Zania feature affecting vendors, planners, clients, documents, payments, leads, and professional workspaces.

Zania is becoming the affordable, Kenya-first alternative to generic clientflow software such as HoneyBook for wedding professionals. It must not imitate another product feature by feature. It must make the Kenyan wedding-business workflow more local, more affordable, and easier to run.

Read this alongside:

- `ZANIA_DESIGN_BIBLE.md`
- `ZANIA_PRODUCT_SIMPLICITY_STANDARD.md`
- `COMMERCIAL_DOCUMENTS_MODULE_SPEC.md`
- `PAYSTACK_CUTOVER_RUNBOOK.md` when a change touches Zania Pay

## Product promise

> Run your wedding business from first enquiry to final payment, in one calm workspace built for Kenya.

For a professional, Zania must replace the fragmented combination of WhatsApp, spreadsheets, Word documents, manual M-Pesa reconciliation, and memory.

The success measure is not the number of tools on the screen. It is whether a vendor can confidently answer, in seconds:

1. Who is this client?
2. What have we agreed?
3. What is due, paid, or overdue?
4. Who needs to act next?
5. What should I do now?

## The single connected clientflow

Every professional-facing feature must strengthen this path:

```text
Enquiry → Lead → Consultation → Quote → Contract → Deposit →
Planning → Invoice → M-Pesa payment → Receipt → Wedding complete → Review / referral
```

Each step belongs to the same client and wedding workspace. Do not create a separate tool, record, or dashboard that forces the user to reconnect this information manually.

## Kenya-first advantages

These are not optional add-ons. They are Zania's reason to exist.

- M-Pesa-first invoices and clear payment outcomes.
- Transparent fee and settlement information.
- KES as the default monetary language.
- WhatsApp-friendly sharing, reminders, and client communication.
- Wedding-specific templates and workflows for photographers, videographers, planners, venues, décor, florists, beauty teams, MCs, caterers, and other vendors.
- Mobile-first completion for clients and professionals.
- Local onboarding that helps professionals move their existing documents and client records into Zania.
- Kenyan privacy, consent, and access-control expectations for client and guest data.

## Product principles

### 1. One workspace, not a collection of tools

A client or wedding should have a single home with contacts, documents, payments, activity, tasks, communication history, and next actions. Links between those records must be automatic wherever Zania already knows the relationship.

### 2. Make the next action obvious

Every meaningful record shows a plain-language state and one clear next action. Avoid generic labels such as `Pending` when the real state is `Waiting for client payment` or `Send contract for signature`.

### 3. Minimise data entry

Never ask for information Zania already knows. Selecting a contact should fill known details. A paid invoice should create or connect the receipt automatically. A quote converted to an invoice should retain the client, line items, and wedding context.

### 4. Payments are trustworthy by design

Amounts, fees, payment status, receipts, payouts, and settlement state must be accurate, plain-language, and auditable. Never imply a payment is complete until its provider-confirmed state is recorded. Do not make users reconcile payment records manually when a verified provider event can do it.

### 5. Mobile is the default completion path

Clients will open links from WhatsApp and email on a phone. The full path—view, understand, sign in if required, pay, receive confirmation—must work without copying links, re-entering information, or guessing what to do.

### 6. Capability is progressive

New or free professionals see the minimum needed to succeed. Advanced tools—automation, team permissions, reporting, multiple brands—appear when relevant. Do not make the first booking feel like configuration work.

### 7. Save work without making users think about saving

All editable document content autosaves after a short pause and clearly confirms the result. Explicit actions remain only where they carry a real consequence: send, issue, accept, sign, void, record payment, refund, or publish.

## Core product surfaces

### A. Professional home

The professional dashboard answers:

- What needs attention today?
- Who needs a reply?
- Which payments are due or overdue?
- What money was collected recently?
- What wedding is next?

Show a short priority list before charts or aggregate metrics.

### B. Client and wedding workspace

The workspace is the source of truth for a booking. It contains:

- Client/contact details and communication preference
- Wedding identity, event date, location, and services
- Pipeline stage and ownership
- Quotes, contracts, invoices, payments, and receipts
- Tasks, activity, notes, and files
- A clear next action

### C. Documents and payments

Quotes, contracts, invoices, receipts, and templates must be connected rather than isolated libraries. A payment should visibly update its invoice, receipt, and client workspace.

Zania Pay must be easy to locate whenever an invoice can be paid. It must state the payer's total, vendor amount, Zania fee, processing fee, and settlement expectation in plain language.

### D. Pipeline and follow-up

Professionals need a simple visual list or board for:

- New enquiry
- Needs follow-up
- Quote sent
- Awaiting approval or signature
- Deposit due
- Booked / planning
- Completed

Each stage should show the number of records and the most urgent item, not an overwhelming wall of cards.

### E. Templates and automation

Templates remove repetitive work. Automations should begin with a small, useful set:

- Reply reminder for a new enquiry
- Quote follow-up
- Contract signature reminder
- Deposit and balance reminders
- Wedding-day preparation reminder
- Review/referral request after completion

Users should be able to understand, turn on, and stop each automation without specialist knowledge.

## Scope sequence

### Now: make the core switch-worthy

Prioritise reliability and connection over breadth:

- Contacts and client/wedding workspaces
- Quotes, contracts, invoices, receipts, templates, and autosave
- Zania Pay invoice payment, provider confirmation, receipt generation, and settlement visibility
- Mobile document links and client completion flow
- Clear payment balances, overdue states, and reminders
- Basic activity history and next-action cues

### Next: help the business run itself

- Pipeline view and follow-up queue
- Task assignment and wedding timeline linkage
- WhatsApp and email share/reminder workflows
- Lead forms and website/Instagram capture
- Simple professional cashflow and conversion reports
- Easy imports for contacts, templates, and existing documents

### Later: support growing teams

- Team roles and permissions
- Automation builder and integrations
- Multiple brands or branches
- Advanced reporting
- Accounting exports and integrations
- Scheduler and availability management

## Non-goals until the core is proven

Do not prioritise these ahead of the connected booking-to-payment flow:

- Feature-for-feature HoneyBook parity
- Complex custom workflow builders
- Deep accounting replacement
- Broad marketplace expansion unrelated to professional clientflow
- AI features that do not remove a real workflow step
- Extra dashboards that do not lead to a decision or action

## Pricing principles

Pricing must be simple enough to explain in one minute. Separate membership access from payment fees.

Suggested shape:

| Tier | Intended user | Core value |
| --- | --- | --- |
| Free | New professional trying Zania | Contacts, limited documents, basic listing and workflow |
| Professional | Active solo vendor or planner | Full clientflow, unlimited core documents, templates, Zania Pay and reminders |
| Studio | Growing team | Team access, automation, richer reports and multiple brands when ready |

Before publishing a price, validate willingness to pay with real professionals. The price page must show what changes by plan, what is included, and any payment fees without hidden conditions.

## Feature definition template

Every feature proposal and implementation plan must answer:

1. **User and job:** Who uses this and what real-world task are they trying to complete?
2. **Clientflow step:** Which stage(s) above does this strengthen?
3. **Connected records:** Which client, wedding, document, payment, task, and activity records should link automatically?
4. **One primary action:** What is the main action on the first screen?
5. **Mobile path:** Can a client complete the core task from a phone link without coaching?
6. **Status and next action:** What does each party see when the task is waiting, completed, failed, expired, or cancelled?
7. **Data and permissions:** Who can see or change it? What personal or payment data is stored? How is consent handled?
8. **Money safety:** If money is involved, what is provider-confirmed, what is only requested, and what happens on retries, failures, duplicate events, refunds, and reversals?
9. **Success metric:** What behaviour proves this is useful?
10. **What stays out:** Which complexity is deliberately deferred?

## Release gate

Before shipping, confirm all of the following:

- The feature serves a named clientflow step and does not create a disconnected workflow.
- A first-time user can identify the next action in five seconds.
- The main task is completable on a mobile phone.
- Important state is written in plain language and not conveyed by colour alone.
- User-entered work survives refresh, authentication, recoverable errors, and normal navigation.
- Financial records are provider-confirmed where applicable and never silently changed by background behaviour.
- Permissions, data ownership, privacy, and deletion/retention implications are understood.
- The feature follows `ZANIA_PRODUCT_SIMPLICITY_STANDARD.md` and `ZANIA_DESIGN_BIBLE.md`.
- The feature has an observable success measure and safe error/retry state.

## Success metrics

Track outcomes that show Zania is replacing fragmented work, not merely being explored:

- Activation: professional sends their first real quote or invoice.
- Booking conversion: enquiry to paid deposit.
- Payment completion: invoice payment attempts that become confirmed payments.
- Time to paid: time from invoice sent to confirmed payment.
- Workflow adoption: share of active professionals using contacts, documents, payments, and a client workspace in the same month.
- Retention: professionals returning to run the next real booking.
- Support friction: payment, document, and navigation problems per completed workflow.
- Revenue: paying professionals, active paid subscriptions, Zania Pay volume, successful settlements, and refunds/reversals.

Demo activity is valuable curiosity data, but it must be tracked separately from real-user adoption and revenue.

## Initial validation programme

Recruit 10–15 active Kenyan wedding professionals across different specialties. Onboard them personally and observe one real booking workflow each.

Ask them to:

1. Add a client.
2. Send a quote or invoice.
3. Share it on the channel they normally use.
4. Complete or observe payment.
5. Find the receipt, balance, and next required action.

Measure where they pause, ask for help, return to WhatsApp/Excel/Word, or abandon the flow. Build the next feature only when it removes a repeated, observed source of friction.

## Decision rule

When deciding between two implementations, choose the one that lets a Kenyan wedding professional complete the next meaningful clientflow step with fewer screens, fewer choices, less data entry, and greater confidence.
