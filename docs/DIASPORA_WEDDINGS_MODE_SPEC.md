# Diaspora Weddings Mode Spec

## Goal

Make Zania meaningfully better for couples planning Kenyan weddings from abroad.

This mode should help a couple:

- coordinate a wedding remotely
- delegate work without losing control
- track vendors, planners, family members, and committee actions
- approve key decisions from abroad
- understand budget, payments, and contributions clearly

The app should feel like:

- a remote wedding command center
- not just a task list or local wedding planner

## Product Position

This is not a separate app.

It is a guided mode inside Zania for:

- diaspora couples
- planners working with diaspora couples
- family representatives on the ground
- committee-driven weddings where the couple is not locally present

Core promise:

- "Plan your Kenya wedding from anywhere without losing visibility or control."

## Who This Is For

Primary users:

- bride and/or groom living abroad
- one or both partners working outside Kenya

Supporting users:

- planner in Kenya
- parent / sibling / trusted family representative
- treasurer
- committee members

## Main User Problem

Diaspora couples are dealing with more than planning complexity.

They are dealing with:

- distance
- trust
- time zones
- delegated decisions
- money movement across people
- limited in-person verification

The real pain is:

- "How do we know what is happening without being there?"

## Product Principles

1. Remote visibility over local assumptions
- the couple should not have to guess what happened

2. Delegation with guardrails
- people on the ground should be able to work
- the couple should still control major decisions

3. Proof over promises
- payments, updates, and completed work should be visible

4. Kenya-first wedding reality
- planners, committees, family, church, and harambee-style support are normal

5. Calm, not noisy
- abroad users need signal, not another chaotic dashboard

## Mode Entry

### New onboarding path

Add a clear onboarding choice during couple signup:

- `Planning from Kenya`
- `Planning from abroad`

If `Planning from abroad` is chosen, save:

- `planning_mode = 'diaspora'`

Possible storage:

- `profiles.metadata.planning_mode`
- or a dedicated wedding setting:
  - `weddings.planning_mode`

Preferred source of truth:

- `weddings.planning_mode`

Because this is a wedding-level context, not just a user preference.

## Core Features To Prioritize

### 1. Approval workflows

Approvals needed for:

- vendor selection
- commercial document acceptance
- payment release
- budget changes above a threshold
- major guest list changes
- timeline changes tied to ceremony/travel

### 2. Activity feed / updates

Show:

- vendor added
- quote sent
- invoice recorded
- payment marked paid
- contribution logged
- task completed
- guest imported
- planner note added
- committee summary logged

### 3. Role and permission system

Clear role types:

- couple owner
- partner owner
- planner
- family representative
- treasurer
- committee member
- viewer

Permission model:

- can view
- can suggest
- can edit
- can approve
- can record payment
- can export

### 4. Dual-currency budget view

Base currency remains:

- `KES`

Optional reference currency:

- `GBP`
- `USD`
- `EUR`
- `CAD`
- `AUD`

This should be a reference view only for now, not accounting truth.

### 5. Updates + proof trail

Support:

- receipt uploads
- note uploads
- meeting summaries
- progress photos
- proof of vendor action

## Information Architecture

### New couple mode banner

For diaspora weddings, the dashboard should show a clear mode state:

- `Planning from abroad`

### Recommended dashboard sections

1. `Needs your approval`
2. `Latest updates from Kenya`
3. `Budget and payment health`
4. `Contributions and pledges`
5. `Travel and arrival countdown`
6. `Next planner / family actions`

## Exact Screen Plan

## Screen 1: Diaspora Onboarding

Route:

- `/auth` during couple signup flow

### UI

Question:

- `Where will you be planning from?`

Options:

- `In Kenya`
- `From abroad`

If `From abroad`, ask:

- primary planning country
- preferred reference currency
- timezone
- whether they already have:
  - planner
  - family representative
  - committee

### Data saved

- `weddings.planning_mode`
- `weddings.reference_currency`
- `weddings.owner_timezone`
- `weddings.remote_support_model`

## Screen 2: Diaspora Setup Checklist

Route:

- `/setup/diaspora`

### Purpose

Guide the couple to set up remote coordination correctly.

### Sections

- invite planner or family representative
- assign treasurer / committee members
- set approval preferences
- set budget currency view
- enable contribution tracking
- choose update summary cadence

### Outcome

The couple should finish setup with a working remote team structure.

## Screen 3: Diaspora Dashboard

Route:

- existing `/dashboard`

But render a diaspora-specific variant when:

- `weddings.planning_mode = 'diaspora'`

### Layout

Top row:

- `Needs your approval`
- `Budget health`
- `Contributions`
- `Travel countdown`

Middle row:

- `Latest updates from planner/family`
- `Payments and receipts`

Bottom row:

- `Upcoming decisions`
- `Wedding progress`

### Key behavior

The dashboard should answer:

- what changed
- what needs my decision
- what money moved
- what is at risk

## Screen 4: Approvals Inbox

Route:

- `/approvals`

### Approval item types

- vendor recommendation
- quote acceptance
- invoice payment release
- budget change request
- committee spending request
- task decision request

### Item structure

- title
- requested by
- requested at
- amount if relevant
- short summary
- supporting proof
- actions:
  - approve
  - reject
  - request more information

## Screen 5: Updates Feed

Route:

- `/updates`

### Feed item types

- payment received
- receipt uploaded
- vendor meeting completed
- planner note added
- contribution collected
- committee meeting summary
- guest progress update
- photo proof

### Filters

- all
- money
- vendors
- committee
- planner
- logistics

## Screen 6: Budget + FX View

Route:

- existing `/budget`

### Additions

- reference currency toggle
- estimated converted values
- disclaimer:
  - `Reference only`

### Cards

- total budget in KES
- total budget in reference currency
- paid in KES
- paid in reference currency
- remaining balance in both views

## Screen 7: Travel & Arrival

Route:

- `/travel`

### MVP content

- couple arrival date
- family arrival dates
- accommodation deadlines
- airport pickup tasks
- outfit pickup deadlines
- legal/church ceremony dependencies

### Why this matters

This becomes a real diaspora differentiator later.

## Screen 8: Planner / Family Summary Share

Route:

- `/remote-summary`

### Purpose

Simple clean summary that can be shared with:

- parent
- planner
- sibling
- committee lead

### Content

- wedding progress
- key decisions pending
- money raised / paid
- next important dates

## Homepage Copy

## Hero Option A

### Headline

Plan your Kenya wedding from anywhere.

### Supporting copy

Keep your planner, family, committee, vendors, budget, and approvals in one place so you can stay in control even when you are not on the ground.

### CTA

- `Start planning from abroad`
- `See how it works`

## Hero Option B

### Headline

Your Kenya wedding command center from abroad.

### Supporting copy

Zania helps couples abroad manage vendors, approvals, payments, contributions, and updates without relying on scattered chats and guesswork.

### CTA

- `Start your wedding`
- `Explore diaspora features`

## Hero Option C

### Headline

Built for couples planning from the UK, US, Europe, Canada, Australia, and beyond.

### Supporting copy

Coordinate your wedding team in Kenya, track what has been approved, see what has been paid, and keep every important update in one clear workspace.

### CTA

- `Start planning`
- `View pricing`

## Supporting landing sections

### Section: Why this matters

Planning from abroad means more than staying organized.

It means:

- trusting the right people
- seeing what changed
- approving the right decisions
- knowing where the money is going

### Section: What Zania helps you do

- approve vendors and payments remotely
- track family, planner, and committee activity
- manage contributions and pledges
- keep your budget and guest planning in sync
- see receipts, updates, and progress in one place

### Section: Designed for real Kenyan weddings

Zania is built for the way weddings are actually planned:

- with planners
- with family
- with committees
- with contributions
- with multiple people involved on the ground

## Implementation Plan

## Phase 1: Foundations

### Ticket 1

Add diaspora planning mode to wedding settings

Scope:

- add `planning_mode`
- add `reference_currency`
- add `owner_timezone`

Files likely touched:

- wedding settings schema
- auth/onboarding flow
- profile settings / wedding settings UI

### Ticket 2

Add diaspora onboarding choice in auth flow

Scope:

- couple signup asks:
  - local vs abroad
- conditional fields for:
  - country
  - currency
  - timezone

### Ticket 3

Render diaspora dashboard variant

Scope:

- reuse existing dashboard
- switch layout when `planning_mode = 'diaspora'`

## Phase 2: Approvals

### Ticket 4

Create approvals table + RLS

New table:

- `approval_requests`

Fields:

- `id`
- `wedding_id`
- `created_by`
- `assigned_to`
- `request_type`
- `status`
- `summary`
- `amount`
- `context_table`
- `context_id`
- `metadata`

### Ticket 5

Add approvals inbox UI

Route:

- `/approvals`

### Ticket 6

Connect vendor/commercial documents into approvals

Examples:

- quote needs approval
- invoice payment release needs approval

## Phase 3: Activity Feed

### Ticket 7

Create activity feed model

New table:

- `wedding_activity_feed`

### Ticket 8

Add updates feed UI

Route:

- `/updates`

### Ticket 9

Log core product events

Events:

- payment recorded
- contribution logged
- vendor added
- planner note saved
- receipt uploaded

## Phase 4: Currency View

### Ticket 10

Add reference currency preferences

### Ticket 11

Add conversion helpers in budget UI

Important:

- do not rewrite accounting truth
- this is a viewing aid

## Phase 5: Travel & Arrival

### Ticket 12

Create travel workspace

Route:

- `/travel`

### Ticket 13

Add arrival and logistics checklist

## Data Model Suggestions

### Wedding-level fields

Possible additions to `weddings`:

- `planning_mode text check (planning_mode in ('local','diaspora'))`
- `reference_currency text null`
- `owner_timezone text null`
- `planning_country text null`

### Role extensions

Possible additions to committee / collaboration system:

- `family_representative`
- `treasurer`
- `viewer`

## Success Metrics

Product success should look like:

- diaspora couples invite more collaborators
- approvals are used frequently
- activity feed is checked regularly
- contributions and payment-tracking usage increase
- fewer “what’s happening?” support moments

## Recommended Build Order

1. diaspora wedding settings + onboarding
2. diaspora dashboard variant
3. approvals backend + inbox
4. activity feed
5. dual-currency budget view
6. travel workspace

## Recommendation

Do not launch this as a giant separate mode all at once.

Launch it as:

- a focused onboarding path
- a better dashboard
- approvals
- updates

That is enough to make Zania materially better for couples abroad without bloating the product.
