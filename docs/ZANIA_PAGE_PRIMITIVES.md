# Zania Page Primitives

## Purpose

This document defines the reusable page-building blocks that should standardize workspace redesign across Zania.

It sits below:

- [docs/ZANIA_DESIGN_BIBLE.md](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/docs/ZANIA_DESIGN_BIBLE.md)
- [docs/ZANIA_UI_SYSTEM.md](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/docs/ZANIA_UI_SYSTEM.md)

And above page-specific implementation.

The goal is to stop every workspace page from inventing its own structure.

## Primitive Set

Zania workspace pages should be built from a small, repeated set of primitives:

1. `PageHeader`
2. `FocusHero`
3. `MetricsBand`
4. `NextStepSection`
5. `InsightCard`
6. `InfoTip`
7. `StatusBadge`
8. `ActionStrip`
9. `DisclosureSection`
10. `EmptyState`

## 1. PageHeader

### Job

Orient the user immediately.

### Must include

- page title
- one-sentence purpose or current-state framing
- optional contextual badge or info tip

### Must not include

- dense actions
- multiple metrics
- long descriptive paragraphs

### Example use

- `Budget`
- `Guests`
- `Tasks`
- `Timeline`

## 2. FocusHero

### Job

Present the single most important thing on the page.

This is the answer to:

`What matters right now?`

### Good uses

- budget health
- next planning move
- guest list progress
- current timeline readiness
- current vendor decision pressure

### Rules

- one per page above the fold
- must contain one primary action at most
- may contain one secondary action
- should not be used for generic navigation

## 3. MetricsBand

### Job

Show compact status signals without forcing multiple large cards.

### Structure

- `3 to 5` compact metrics
- low visual weight
- one-line labels
- one-line values

### Good uses

- total guests
- confirmed guests
- pending tasks
- final vendors
- contribution gap

### Rules

- use this instead of a row of equal-weight cards
- it supports the hero; it should not compete with it

## 4. NextStepSection

### Job

Translate the current state into immediate action.

### Structure

- short heading
- one-line framing
- `1 to 3` actions maximum

### Good uses

- create first task
- send guest invites
- shortlist your venue
- log the next payment

### Rules

- action phrasing should be specific
- do not mix urgent and optional actions equally

## 5. InsightCard

### Job

Deliver one focused interpretation or recommendation.

### Good uses

- AI planning focus
- budget risk
- vendor follow-up risk
- timeline conflict warning

### Rules

- one message per card
- if it needs several paragraphs, split it
- insight cards interpret data; they do not dump it

## 6. InfoTip

### Job

Provide secondary explanation without cluttering the main view.

### Rules

- use for optional context only
- never use to hide critical actions or required warnings
- the base screen should still make sense if the user never opens the tip

## 7. StatusBadge

### Job

Represent state consistently.

### Core statuses

- active
- pending
- completed
- warning
- blocked
- private
- shared

### Rules

- badge color must be semantic
- avoid inventing page-specific badge language when a shared term already exists

## 8. ActionStrip

### Job

Hold low-frequency but useful controls.

### Good uses

- export
- print
- import
- duplicate
- share

### Rules

- place it after orientation, not before it
- keep it visually lighter than the page's primary action

## 9. DisclosureSection

### Job

Hide reference or advanced detail until needed.

### Good uses

- historical logs
- advanced filters
- planner-only management metadata
- detailed diagnostics
- archived items

### Rules

- use disclosure to reduce cognitive noise
- do not use it to hide the primary workflow

## 10. EmptyState

### Job

Explain the purpose of an empty surface and make the first action obvious.

### Structure

- clear title
- encouraging explanation
- first action

### Rules

- no sterile `No items` copy
- tie the empty state to the user's actual planning goal

## Page Recipes

### Couple Dashboard

Recommended order:

1. `PageHeader`
2. `FocusHero`
3. `MetricsBand`
4. `NextStepSection`
5. `InsightCard`
6. `DisclosureSection`

### Budget

Recommended order:

1. `PageHeader`
2. `FocusHero`
3. `MetricsBand`
4. `ActionStrip`
5. segmented content for `Categories`, `Payments`, `Signals`
6. `InsightCard`

### Guests

Recommended order:

1. `PageHeader`
2. `FocusHero`
3. `MetricsBand`
4. `NextStepSection`
5. segmented content for `List`, `Invites`, `Check-in`
6. `ActionStrip`

### Tasks

Recommended order:

1. `PageHeader`
2. `FocusHero`
3. `MetricsBand`
4. `NextStepSection`
5. task list
6. secondary filters in `DisclosureSection`

### Timeline

Recommended order:

1. `PageHeader`
2. `FocusHero`
3. `ActionStrip`
4. active timeline workspace
5. sharing and printing controls
6. templates in `DisclosureSection`

## Anti-Patterns

Avoid these patterns:

- four or more same-weight cards above the fold
- putting export/import/share before orientation
- mixing setup and execution modes without a visible boundary
- large explanatory text blocks where one sentence and an info tip would do
- making every section look equally important
- using a hero section as a module menu

## Engineering Guidance

These primitives should become shared React components or composition patterns.

Suggested implementation targets:

- `WorkspacePageHeader`
- `WorkspaceFocusHero`
- `WorkspaceMetricsBand`
- `WorkspaceNextSteps`
- `WorkspaceActionStrip`
- `WorkspaceEmptyState`

The goal is not just visual reuse.

It is structural consistency.

## Definition Of Done For Page Redesign

A workspace page redesign is not done until:

1. the primary task is obvious above the fold
2. there is only one dominant visual surface
3. secondary actions are demoted appropriately
4. reference information is collapsed or moved down
5. the page still works clearly on mobile
6. the structure matches these primitives rather than one-off layout invention
