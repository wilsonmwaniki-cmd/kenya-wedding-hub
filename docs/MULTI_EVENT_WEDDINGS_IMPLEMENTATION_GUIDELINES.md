# Multi-Event Weddings Implementation Guidelines

## Status and authority

This document is the product and implementation guardrail for adding multi-event weddings to Zania.

Codex must read this document before planning, implementing, reviewing, or completing work that changes wedding dates, timelines, tasks, guests, invitations, vendors, budgets, seating, contracts, dashboards, or onboarding in ways related to wedding events.

If an implementation choice conflicts with this document, Codex must either:

1. follow this document; or
2. stop, describe the conflict, and obtain an explicit product decision before proceeding.

Codex must not silently reinterpret these requirements.

## Product goal

Make Zania capable of planning a wedding with any number of events on any number of dates under one wedding workspace.

The experience must work equally well for:

- a single-day wedding with one ceremony and reception
- a three-day wedding with several celebrations
- ceremonies held in different venues
- civil, religious, customary, cultural, interfaith, or non-religious weddings
- weddings whose event names and structure do not match Zania's examples

The first release does **not** require cultural planning packs. The foundation must be culture-neutral and user-defined.

Core promise:

> One wedding, any number of events, on any number of dates.

## Product principles

### 1. The wedding remains the primary workspace

An event is a child of a wedding. It is not a separate wedding, account, subscription, or workspace.

All events under a wedding share the wedding's:

- owners and collaborators
- subscription and entitlements
- high-level identity
- overall planning progress
- overall budget summary
- vendor and guest directories

### 2. Events are user-defined

Zania must not require a fixed ceremony/reception structure.

Users must be able to:

- create an event with any name
- rename it later
- add, reorder, archive, or remove events safely
- use one event or many events
- leave optional details incomplete

Neutral suggestions such as `Ceremony`, `Reception`, `Dinner`, and `Celebration` are acceptable. They must never limit the names or number of events.

### 3. Do not infer culture from event names

An event named `Mehndi`, `Nikah`, `Anand Karaj`, `Ruracio`, `Ngurario`, `Walima`, or any other term must remain ordinary user-entered data unless the couple explicitly chooses a future cultural feature.

Codex must not:

- infer religion, ethnicity, gender, or required rituals from a name
- auto-add culturally specific tasks without explicit consent
- assume that two weddings using the same event name follow the same customs
- make culture-specific fields mandatory

### 4. Single-day weddings must stay simple

Multi-event support must not make a one-day wedding feel complicated.

For a wedding with one event:

- Zania should create or use one primary event automatically
- the UI may hide unnecessary event-switching controls
- existing workflows should remain familiar
- users should not be forced through a multi-step event builder

### 5. Wedding-wide and event-specific data are both valid

Some records belong to the whole wedding. Others belong to one or more events.

Examples of wedding-wide records:

- choose a planner
- set an overall budget
- obtain legal documents
- create the master guest directory
- select a photographer who covers the entire wedding

Examples of event-specific records:

- confirm transport for Friday's celebration
- build Saturday's ceremony timeline
- seat guests for Sunday's reception
- record catering costs for one dinner

The data model and UI must preserve this distinction. `No event selected` must mean `Entire wedding`, not `Unknown` or invalid data.

### 6. Existing weddings must continue to work

This is an additive migration, not a reset.

Existing weddings, profiles, planner clients, tasks, timelines, guests, invitations, bookings, and public links must remain usable throughout the rollout.

No implementation phase may require deleting and recreating an existing wedding.

## Scope for the initial multi-event release

The initial release should provide the smallest complete foundation:

1. a `wedding_events` source of truth
2. automatic conversion of existing wedding dates into default primary events
3. event creation, editing, ordering, and safe removal/archive behavior
4. an event selector within the wedding workspace
5. timelines connected to wedding events
6. tasks that can be wedding-wide or connected to an event
7. dashboard and date displays that understand one or multiple wedding dates

The following should be designed for but may be implemented after the initial release:

- per-event guest invitations and RSVP responses
- per-event vendor assignments
- per-event budgets and payments
- per-event contracts and deliverables
- per-event seating and space plans
- per-event check-in

Do not claim full multi-event support until guest attendance, invitations, vendors, budgets, and operational tools have been audited for single-date assumptions.

## Explicit non-goals for the first release

- cultural planning packs
- automatic ritual recommendations
- a separate workspace per event
- a separate subscription per event
- replacing the master wedding guest directory with duplicate guest lists
- forcing every task, vendor, guest, or cost to have an event
- rewriting every date-dependent feature in one unsafe change
- changing ownership or wedding membership semantics

## Required data model

### `wedding_events`

Create a wedding-scoped event table with, at minimum:

```text
id                uuid primary key
wedding_id        uuid not null references weddings(id)
name              text not null
event_date        date not null
start_time        time null
end_time          time null
venue_name        text null
location          text null
notes             text null
is_primary        boolean not null default false
sort_order        integer not null default 0
created_at        timestamptz not null default now()
updated_at        timestamptz not null default now()
archived_at       timestamptz null
```

Implementation notes:

- Prefer `event_date` plus local times for the first release because the current product models wedding dates and timeline times separately.
- Do not introduce UTC conversion that changes the displayed local date.
- If weddings later span time zones, add an explicit wedding or event time-zone field through a separate reviewed migration.
- Enforce non-empty trimmed names.
- Index `(wedding_id, event_date, sort_order)`.
- Enforce at most one non-archived primary event per wedding, preferably with a partial unique index.
- Event ordering must be deterministic. Use event date first and `sort_order` as the user-controlled tie-breaker unless product UI explicitly chooses manual ordering across all dates.

### Relationship rules

Initial relationships:

```text
timelines.event_id  -> wedding_events.id, nullable
tasks.event_id      -> wedding_events.id, nullable
```

Required invariants:

- An attached event must belong to the same wedding as the record.
- A null `event_id` means `Entire wedding`.
- A timeline template is not required to belong to a dated wedding event.
- A dated, non-template timeline should normally have an event after migration.
- Event deletion must not cascade-delete planning work, timelines, guests, costs, bookings, contracts, or space plans.
- Prefer archive or `ON DELETE SET NULL` plus an explicit reassignment flow.

Do not rely only on the client to enforce same-wedding relationships. Use database constraints, triggers, or security-definer validation functions where a normal foreign key cannot express the invariant.

### Future many-to-many relationships

Guests and vendors may participate in several events. Do not model these by placing one `event_id` directly on a guest or vendor record.

Use join tables when those phases are implemented.

Suggested guest relationship:

```text
guest_event_attendance
- id
- wedding_id
- guest_id
- event_id
- invitation_status
- rsvp_status
- meal_preference
- plus_one_status
- checked_in
- checked_in_at
- created_at
- updated_at
```

Suggested vendor relationship:

```text
vendor_event_assignments
- id
- wedding_id
- vendor/booking relationship id
- event_id
- scope notes
- created_at
```

The exact vendor foreign key must follow the canonical booking/vendor workspace model discovered at implementation time. Codex must not create a parallel vendor system merely to attach events.

## Compatibility and migration requirements

### Existing wedding backfill

For every existing wedding:

1. create one default event using the best canonical existing wedding date
2. use a neutral event name such as `Wedding day`
3. mark it as primary
4. preserve the existing wedding date field during the compatibility period
5. do not create duplicate default events if the migration or reconciliation is rerun

The backfill must be idempotent.

If no wedding date exists, do not invent one. Either defer event creation until a date is supplied or support an explicitly reviewed date-to-be-confirmed state. The schema and UX must agree on this behavior before implementation.

### Primary event compatibility

During rollout, the existing `weddings.wedding_date`, profile wedding date, and planner-client wedding date may still be read by legacy features.

Rules:

- The primary event is the future source of truth for the main displayed wedding date.
- Compatibility fields must not drift silently from the primary event.
- Updates must use one reviewed synchronization path rather than scattered client-side dual writes.
- A database function, RPC, or central application service should own synchronization.
- Codex must identify all existing write paths before changing which field is authoritative.
- Legacy fields must not be removed until repository-wide reads, Edge Functions, emails, public pages, and integrations have migrated.

### Timeline backfill

Existing timelines already support independent `timeline_date` values.

Backfill logic should:

- attach a non-template timeline to an event with the same wedding and date when the match is unambiguous
- attach it to the primary event when its date matches the primary wedding date
- leave it unattached and report it for review when multiple events share the date and a safe match cannot be inferred
- never attach templates to a wedding event solely because of a date
- never change timeline event times during relationship backfill

### Task backfill

Existing tasks should remain wedding-wide by default.

Do not infer event assignment from task titles, categories, cultural terms, or due dates. Event assignment can be added by the user after migration unless there is an explicit, deterministic source relationship.

## Required user experience

### Wedding setup

Replace the conceptual assumption of one `wedding date` with a simple choice:

> Is your wedding happening on one day or across several days?

Expected behavior:

- `One day`: create one primary event with minimal extra UI.
- `Several days`: allow the user to add event name and date rows.
- Do not require venue, time, guest list, or detailed schedule during setup.
- Users must be able to add more events later regardless of their initial choice.
- The choice is onboarding guidance, not a permanent wedding type.

### Event management

Users need one clear place to:

- see all active events
- add an event
- edit name, date, times, venue, location, and notes
- select the primary event
- reorder events when dates are equal or presentation order matters
- archive or remove an event with a dependency warning
- reassign attached records before destructive removal when required

### Workspace event selector

Use a consistent selector such as:

```text
Entire wedding | Event A | Event B | Event C
```

Requirements:

- `Entire wedding` shows wedding-wide records plus records from all events, with event labels where useful.
- A selected event shows records for that event and relevant wedding-wide records.
- The selector must not imply that wedding-wide records are unassigned errors.
- Preserve the selected event while moving between compatible workspace modules when practical.
- On narrow screens, use a compact accessible control rather than an overflowing tab row.

### Dashboard and dates

For one event, continue displaying a single date naturally.

For multiple events:

- display a date range when summarizing the wedding
- identify the next upcoming event
- show per-event progress where it adds clarity
- avoid countdown copy that implies the entire wedding is one day
- use `days until the next event` or name the event when appropriate

### Timelines

- A wedding event may have zero, one, or several timelines.
- Creating a timeline from an event should prefill its date.
- Changing an event date must have an explicit policy for related timeline dates; never silently shift operational schedules without informing the user.
- Timeline templates remain reusable and independent from specific wedding events.
- Existing public and per-assignee timeline links must continue to work.

### Tasks

- Task creation and editing must offer `Entire wedding` plus active events.
- Task filters must support all events and a particular event.
- Event labels should appear where tasks from several events are mixed.
- Assignment to a person and assignment to an event are separate concepts.
- Do not overload the current `assigned_to` field with event information.

### Inclusive product language

Audit new and modified copy for assumptions such as:

- exactly one wedding day
- exactly one ceremony
- every wedding has a reception
- every wedding is held in a church
- every wedding has a bride and groom
- all guests attend every event
- all vendors work every event

Use `couple`, `partners`, `wedding`, `event`, `celebration`, `primary event`, and `wedding dates` when specific roles or traditions are not known.

## Security and permissions

Every event operation must be wedding-scoped.

Codex must verify:

- RLS uses canonical wedding membership/ownership checks
- users cannot read or mutate events from weddings they cannot access
- event IDs from another wedding cannot be attached to a local task or timeline
- planner approval rules continue to apply where the current product requires couple approval
- public timeline and invitation RPCs reveal only intended event information
- archived events cannot be mutated through normal active-event flows unless explicitly supported

Do not create permissive policies based only on possession of an event UUID.

## Implementation sequence

Codex should deliver this update in reviewable phases.

### Phase 0: discovery and impact inventory

Before editing code:

1. locate the canonical wedding, membership, task, timeline, guest, vendor, budget, contract, invitation, portfolio, and space-plan schemas
2. identify every read and write of `wedding_date` and `timeline_date`
3. identify date rendering in dashboards, public pages, emails, Edge Functions, exports, and AI context
4. identify all wedding creation and update paths
5. record which paths are in scope for the current phase

Codex must not assume generated Supabase types represent the complete live schema without checking migrations and runtime usage.

### Phase 1: event foundation

- add `wedding_events`
- add indexes, constraints, RLS, and update timestamps
- add idempotent existing-wedding reconciliation/backfill
- add typed data-access helpers
- add tests for ownership, primary-event uniqueness, and cross-wedding rejection

### Phase 2: event management UI

- add event list and editor
- add one-day/several-days setup behavior
- add primary-event behavior
- add archive/removal dependency handling
- verify keyboard, screen-reader, mobile, empty, loading, and error states

### Phase 3: timelines and tasks

- add nullable event relationships
- backfill timelines safely
- add event selection and filtering
- preserve templates and share links
- add cross-wedding integrity tests

### Phase 4: dashboard and compatibility reads

- add wedding date range and next-event behavior
- centralize primary-event compatibility
- update relevant countdowns, AI context, and high-visibility date displays
- leave documented compatibility fallbacks where later phases still depend on one date

### Phase 5: guests and invitations

- add guest-event attendance join data
- support per-event invitations and RSVP status
- define whole-wedding and per-event invitation presentation
- migrate check-in and seating assumptions carefully

### Phase 6: vendors, budgets, contracts, and operations

- add vendor-to-event relationships without duplicating vendors
- support wedding-wide and event-specific costs
- connect deliverables, contracts, seating, check-in, and operational views
- complete the repository-wide single-date assumption audit

Do not combine all phases into one migration or one unreviewable UI change.

## Codebase integration anchors

At the time this document was written, Codex must inspect at least these areas before implementation:

- `supabase/migrations/*wedding_workspace*`
- `src/lib/weddingWorkspace.ts`
- `src/lib/pendingWeddingSetup.ts`
- `src/pages/WeddingSetup.tsx`
- `src/pages/ProfileSettings.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Timeline.tsx`
- `src/pages/TimelineShare.tsx`
- `src/pages/Tasks.tsx`
- `src/pages/Guests.tsx`
- `src/pages/GuestRsvp.tsx`
- `src/pages/Budget.tsx`
- `src/pages/Vendors.tsx`
- `src/pages/VendorDashboard.tsx`
- `src/pages/SpaceTablePlan.tsx`
- `src/pages/ManagePortfolio.tsx`
- `src/pages/WeddingPortfolio.tsx`
- `supabase/functions/send-guest-invite/index.ts`
- `supabase/functions/send-wedding-invite/index.ts`
- `supabase/functions/wedding-ai-chat/index.ts`
- `src/integrations/supabase/types.ts`

This list is an inspection floor, not a complete scope declaration. Files may move, and new date-dependent paths may exist.

## Testing requirements

### Database tests

Verify at minimum:

- a wedding can have one event
- a wedding can have several events on different dates
- a wedding can have several events on the same date
- only one active primary event exists per wedding
- an unauthorised user cannot read or change events
- an event from Wedding A cannot be assigned to a record in Wedding B
- backfill is idempotent
- deleting or archiving an event does not delete planning records unexpectedly
- null event relationships remain valid for wedding-wide records

### Application tests

Verify at minimum:

- existing single-day wedding behavior
- new multi-day setup
- adding, editing, selecting, ordering, and archiving events
- entire-wedding and event-specific task views
- event-linked timeline creation
- timeline templates remain independent
- same-date events are distinguishable
- date ranges and next-event display correctly
- empty, loading, error, and permission-denied states
- keyboard and mobile usability

### Regression scenarios

Test these representative weddings without attaching cultural rules to them:

1. One event on one date.
2. Three events across three consecutive dates.
3. Two events on one date and another event on the following date.
4. A wedding with no confirmed date during setup, if that state is supported.
5. An existing production wedding migrated from one `wedding_date`.
6. A planner-managed wedding with approval requirements.
7. A wedding with public timeline and guest invitation links.

### Verification commands

Codex must inspect repository scripts and run the applicable equivalents of:

- targeted unit/integration tests
- database or migration validation
- lint
- TypeScript checking
- production build
- browser verification of changed flows

Do not report a command as passing unless it was actually run. If a command cannot run, state the exact reason and what remains unverified.

## Observability and rollout

Add enough instrumentation to answer:

- how many weddings have more than one event
- where users abandon multi-event setup
- event creation/edit/archive failure rates
- how many timelines and tasks are event-linked
- whether compatibility synchronization fails
- whether public invitations or timelines fail after event rollout

Recommended rollout controls:

- place unfinished UI behind an explicit feature flag if schema ships first
- deploy additive schema before code that requires it
- keep compatibility reads during staged rollout
- provide a rollback path that hides multi-event UI without deleting event data
- never roll back by dropping populated event tables

## Forbidden shortcuts and anti-patterns

Codex must not:

- clone the entire wedding workspace for every event
- store events only as timeline titles or JSON metadata
- represent a multi-day wedding only with `start_date` and `end_date`
- overload `timeline_date` as the event source of truth
- attach one event directly to a guest or vendor that may attend several events
- infer task-event relationships from wording
- make `event_id` mandatory on all existing records
- duplicate guests, vendors, or collaborators per event
- bypass wedding-scoped RLS for convenience
- use client-side checks as the only cross-wedding protection
- delete an event with cascading loss of planning data
- remove legacy date fields before all consumers are migrated
- introduce culture-specific defaults into the neutral foundation
- mark the feature complete after only adding event CRUD

## Codex execution protocol

For every multi-event implementation task, Codex must follow this sequence:

1. **Read** this entire document and any repository-level instructions.
2. **Inspect** the current code and migrations instead of relying on prior memory.
3. **State the phase** being implemented and list explicit non-goals.
4. **Inventory impact** on existing single-date reads and writes.
5. **Plan additive changes** with compatibility behavior and rollback safety.
6. **Implement** the smallest coherent phase.
7. **Test** database integrity, permissions, UI behavior, and regressions proportionate to the phase.
8. **Search again** for affected single-date assumptions after editing.
9. **Self-audit** against the checklist below.
10. **Report evidence**, remaining gaps, migrations, feature flags, and deployment order.

Codex must not proceed to deployment unless deployment is part of the user's explicit request.

## Mandatory self-review checklist

Codex must include this checklist, completed with `PASS`, `FAIL`, or `N/A`, in its implementation handoff. Every `N/A` requires a short reason. Any `FAIL` means the work must not be described as complete.

### Product model

- [ ] The wedding remains one workspace with many child events.
- [ ] Users can name events freely.
- [ ] No culture, religion, ritual, or gender is inferred.
- [ ] One-day weddings remain simple.
- [ ] Wedding-wide records remain valid.
- [ ] Same-date events remain distinguishable.

### Data integrity

- [ ] Event ownership is wedding-scoped.
- [ ] Cross-wedding event attachment is rejected server-side.
- [ ] At most one active primary event exists.
- [ ] The backfill is idempotent.
- [ ] Existing records are preserved.
- [ ] Event removal cannot cascade-delete important planning data.
- [ ] Null event relationships consistently mean `Entire wedding`.

### Compatibility

- [ ] Existing single-day weddings still work.
- [ ] Primary-event and legacy wedding dates cannot drift silently.
- [ ] Timeline templates remain reusable.
- [ ] Existing public links still work.
- [ ] Planner/couple approval behavior remains intact.
- [ ] Date rendering does not shift because of time-zone conversion.

### UX and accessibility

- [ ] Event creation and editing have loading, empty, success, and error states.
- [ ] Entire-wedding versus event-specific scope is clear.
- [ ] Mobile layout is usable.
- [ ] Keyboard interaction is usable.
- [ ] Labels and controls are accessible.
- [ ] Copy avoids single-day and cultural assumptions.

### Security

- [ ] RLS policies were reviewed and tested.
- [ ] UUID possession alone does not grant event access.
- [ ] Public RPC payloads expose only intended information.
- [ ] Archived event behavior is enforced consistently.

### Verification

- [ ] Relevant automated tests pass.
- [ ] Migration validation passes.
- [ ] Lint/type checking passes.
- [ ] Production build passes.
- [ ] Changed UI flows were verified in a browser.
- [ ] Representative one-day and multi-day scenarios were tested.
- [ ] Remaining single-date assumptions are documented.

## Definition of done

A phase is done only when:

- its schema and UI behavior match this document
- compatibility behavior is implemented, not merely planned
- RLS and cross-wedding integrity are verified
- single-day regression coverage exists
- multi-event behavior is verified with representative scenarios
- applicable checks pass
- the mandatory self-review contains no `FAIL`
- remaining phases and limitations are stated plainly

The overall multi-event initiative is not done until a couple can plan, invite, budget, staff, and operate several events under one wedding without duplicating the wedding, its guests, its collaborators, or its vendors.

## Product decision log

Record decisions that refine or intentionally override this guidance here. Each entry must include the date, decision, reason, affected phases, and approving product owner.

| Date | Decision | Reason | Affected phases | Approved by |
|---|---|---|---|---|
| — | No decisions recorded yet | — | — | — |
