# Zania Workspace Audit

## Purpose

This audit evaluates the current workspace pages against:

- [docs/ZANIA_DESIGN_BIBLE.md](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/docs/ZANIA_DESIGN_BIBLE.md)
- [docs/ZANIA_UI_SYSTEM.md](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/docs/ZANIA_UI_SYSTEM.md)

The goal is not to critique visuals in the abstract.

The goal is to identify where the product still creates:

- decision fatigue
- excessive card density
- unclear next steps
- weak information hierarchy
- drift from the intended Zania experience

## Summary

Current Zania has strong product depth, but several core workspace pages still behave more like `information dashboards` than `calm operating surfaces`.

The most common issues are:

1. too many same-weight cards above the fold
2. multiple competing calls to action
3. reference information shown too early
4. dense feature coverage before the user understands what matters now
5. inconsistent use of hero surfaces, summary bands, and supporting sections

The product is already useful.

The design problem is not lack of capability.

It is lack of enough hierarchy.

## Audit Scale

### Green

Mostly aligned with the design system. Refinement needed, not restructuring.

### Yellow

Useful surface, but still too busy or structurally inconsistent.

### Red

Needs significant restructuring to match Zania's intended product philosophy.

## Page Audit

### 1. Dashboard

File:

- [src/pages/Dashboard.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/Dashboard.tsx:264)

Status:

`Yellow`

What is working:

- clear wedding identity and context
- meaningful data aggregation
- strong cross-workspace awareness
- emerging "today's assistant" direction

What is not working:

- too many major sections still compete visually
- the page still transitions from focus surface into a broad information dump
- planning digest, vendor watch, timeline/support, collaboration, and module cards can all feel equally important
- deeper reference content appears before the user has completed the most important setup steps

Design problem:

The dashboard knows a lot, but it does not suppress enough.

Recommended direction:

- keep one dominant hero
- keep one compact setup/progress rail
- keep one "next moves" section
- collapse secondary digest areas behind `Show more detail`
- move collaboration and connection management lower or into a dedicated workspace section

Priority:

`High`

### 2. Budget

File:

- [src/pages/Budget.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/Budget.tsx:190)

Status:

`Red`

What is working:

- strong underlying workflows
- meaningful financial operations
- category, payments, benchmarks, and planner approvals are all product-rich

What is not working:

- too many modes, forms, benchmarks, exports, and workflow states on one page
- budgeting, payment logging, workflow responsibility, market benchmarking, and upgrade logic all live in the same surface
- the page likely asks too much interpretation effort from first-time users
- the difference between `set budget`, `track spending`, `record payments`, and `review commitments` is not visually separated enough

Design problem:

This page behaves like a power-user admin panel before it behaves like a confident budgeting workspace.

Recommended direction:

- split the page mentally into:
  - budget health
  - categories
  - payments
  - market signals
- make `budget health` the primary focus surface
- turn the rest into tabs or segmented subviews
- surface the next budget action first
- push advanced planner workflow details lower

Priority:

`Very high`

### 3. Guests

File:

- [src/pages/Guests.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/Guests.tsx:149)

Status:

`Yellow`

What is working:

- rich guest operations
- good product depth around RSVP links, imports, and check-in
- strong long-term value

What is not working:

- too many guest-management modes coexist too early
- list management, guest insights, RSVP operations, guest editing, import/export, and check-in all appear within the same cognitive envelope
- the page risks feeling like a control panel instead of a guest planning flow

Design problem:

The guest page tries to serve setup, communication, and event-day operations at once.

Recommended direction:

- lead with one guest status summary band
- separate `build list`, `send invites`, and `check in guests` more aggressively
- make event-day check-in feel like a distinct mode
- hide advanced tools until the user has a guest list to work with

Priority:

`High`

### 4. Tasks

File:

- [src/pages/Tasks.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/Tasks.tsx:202)

Status:

`Yellow`

What is working:

- task model is strong
- suggested tasks and vendor-linked tasks are strategically useful
- task urgency logic is aligned with the product philosophy

What is not working:

- there are many filters, task-creation paths, and scope concepts at once
- suggested vs custom, date vs category vs completed, urgent vs vendor vs private vs shared introduces high setup complexity
- the page can feel operationally powerful but not immediately calm

Design problem:

The task system exposes too much of its internal flexibility at the same time.

Recommended direction:

- lead with urgent and next-up tasks
- demote view-mode complexity
- make `create first task` or `review urgent tasks` the primary branch
- treat filters as progressive disclosure rather than the first thing users must interpret

Priority:

`High`

### 5. Contributions

File:

- [src/pages/Contributions.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/Contributions.tsx:153)

Status:

`Yellow`

What is working:

- contribution rounds and payment tracking are useful and differentiated
- contribution sharing is a strong workflow feature

What is not working:

- funding rounds, contribution entries, sharing, reminders, and budget coverage can collapse into one busy environment
- likely too many controls for a user who just wants to understand `how much support is committed` and `what follow-up is needed`

Design problem:

The page needs a cleaner split between `summary`, `people`, and `operations`.

Recommended direction:

- lead with support summary and contribution gap
- make active round status obvious
- move reminder/share tools into a secondary action row
- collapse low-frequency management actions

Priority:

`Medium`

### 6. Gift Registry

File:

- [src/pages/GiftRegistry.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/GiftRegistry.tsx:83)

Status:

`Green`

What is working:

- constrained surface area
- clear item model
- understandable empty-state logic
- simpler than many other workspace pages

What is not working:

- upgrade and access logic may still compete with the main registry task
- could benefit from a stronger top summary band and cleaner separation between `needed gifts` and `purchased gifts`

Design problem:

Mostly hierarchy polish, not structural confusion.

Recommended direction:

- keep this as a model for calmer single-purpose workspace design
- tighten the distinction between active items and completed purchases

Priority:

`Low to medium`

### 7. Timeline

File:

- [src/pages/Timeline.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/Timeline.tsx:112)

Status:

`Red`

What is working:

- high-value feature
- strong workflow depth
- template application and event operations are strategically valuable

What is not working:

- this page contains creation, templating, editing, filtering, sharing, printing, shifting, and drag-and-drop operations in one environment
- category decoration and tool density risk making the page feel busy instead of calm
- the user can easily understand that the page is powerful, but not immediately what the next best action is

Design problem:

Timeline is trying to be builder, manager, distributor, and editor all at once.

Recommended direction:

- lead with one active timeline view
- move creation/template operations into a dedicated upper control zone or modal entry flow
- keep timeline actions contextual to the selected timeline
- simplify the visible control set until an event or timeline is selected

Priority:

`Very high`

### 8. Portfolio

File:

- [src/pages/WeddingPortfolio.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/WeddingPortfolio.tsx:40)

Status:

`Green`

What is working:

- strong visual story flow
- clear separation of hero, metadata, vendor credits, and reviews
- public-facing presentation is naturally simpler than the workspace pages

What is not working:

- typography doctrine needs explicit alignment with the design system
- this surface may over-influence internal workspace styling if reused carelessly

Design problem:

Not a major UX issue. The main risk is system drift, not page confusion.

Recommended direction:

- keep portfolio expressive
- avoid importing its public storytelling density into operational workspace pages

Priority:

`Low`

## Cross-Cutting Product Problems

### 1. Too Many Equal-Weight Cards

This is the most common structural issue.

Many pages still present several cards with similar size, contrast, and elevation before the user knows what matters most.

### 2. Advanced Tools Appear Too Early

Import, export, template operations, sharing, and management utilities often appear near the top of pages that should first orient the user.

### 3. Setup, Management, and Event-Day Modes Are Mixed

Pages like `Guests`, `Tasks`, and `Timeline` serve fundamentally different moments on the same level:

- setup
- steady-state management
- execution-day operations

These need stronger separation.

### 4. The Product Often Explains Everything At Once

The app is rich, but richness is surfacing too early.

Zania needs more confidence in deferring secondary detail.

### 5. Shared Primitives Are Not Yet Strong Enough

Several pages solve similar hierarchy problems independently.

This creates drift in:

- hero structure
- metric presentation
- empty states
- action density
- disclosure patterns

## Recommended Rollout Order

### Phase 1

Focus on the highest-leverage couple workspace pages:

1. Dashboard
2. Budget
3. Tasks
4. Guests

### Phase 2

Then simplify the secondary but still important workspace pages:

1. Timeline
2. Contributions
3. Gift Registry

### Phase 3

Then normalize role-specific surfaces:

1. planner dashboard patterns
2. vendor dashboard patterns
3. shared workspace primitives

## Implementation Rule

Every redesign pass should answer:

1. what is the one thing the user needs from this page first?
2. what can be hidden until the user asks for it?
3. what information is reference-only and should move down?
4. where are two or more cards trying to be the hero?
5. what mode is this page in right now?

If those answers are not clear, the page is not ready.
