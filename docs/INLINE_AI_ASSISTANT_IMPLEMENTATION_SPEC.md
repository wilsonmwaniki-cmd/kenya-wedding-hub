# Inline AI Assistant Implementation Spec

## Goal
Move Zania AI from a single destination page into the workflow itself.

The current AI is strong, but it is isolated at:

- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/AiChat.tsx`

This creates friction for couples, planners, committees, and vendors because they have to:

1. leave the page where they are working
2. open the AI page
3. restate their context
4. then return to the workspace

The goal of this rollout is to make AI feel embedded into the workspace without rebuilding the existing AI backend.

## Current Architecture

### What already exists

#### 1. Strong AI entry point
The core assistant is already implemented in:

- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/AiChat.tsx`

This page already handles:

- role-aware assistant copy
- starter prompts
- entitlement checks
- workspace snapshot loading
- message handling
- write-action review before mutation

#### 2. One shared backend brain
The main AI backend already exists in:

- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/supabase/functions/wedding-ai-chat/index.ts`

This is the right architectural center.

It already supports:

- role-aware behavior
- workspace-aware behavior
- safe write proposals
- message logging and usage controls

#### 3. Existing entitlement model
AI access is already gated in:

- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/lib/entitlements.ts`

Relevant features already exist:

- `couple.ai_assistant`
- `committee.ai_assistant`
- `planner.ai_assistant`
- `vendor.ai_assistant`

#### 4. High-value workspace pages already exist
Best first inline surfaces:

- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/Dashboard.tsx`
- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/Budget.tsx`
- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/Tasks.tsx`
- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/Vendors.tsx`

These pages already load the same planning data the AI needs.

## Product Principle
The assistant should stop being a destination and become a layer.

We should not ask users to “go use AI.”

We should instead show AI where it helps most:

- when budget risk appears
- when tasks are overdue
- when vendor decisions are stuck
- when the next week needs prioritization

For couples especially, the experience should feel like:

- “Here’s the next useful thing to do”

not:

- “Open the AI page and ask something.”

## Product Outcomes

### For couples
- less confusion
- less planning paralysis
- better next-action guidance
- fewer moments where they leave a page to seek help

### For planners
- faster client coordination
- quicker risk summaries
- less manual triage across pages

### For committees
- clearer delegation
- better accountability nudges

### For vendors
- faster booking and follow-up guidance
- better inline commercial coaching

## Rollout Plan

## Phase 1: Inline AI cards
Add lightweight, contextual AI cards to the most important pages.

### First rollout pages

#### Dashboard
File:

- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/Dashboard.tsx`

Add:

- one card near the top:
  - “What should we focus on this week?”
- one-click actions based on current digest data

Example prompts:

- “Summarize our biggest risks this week.”
- “Turn this week into a simple wedding action plan.”
- “What is most behind right now?”

#### Budget
File:

- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/Budget.tsx`

Add:

- one contextual AI card above budget lists or near summary totals

Example triggers:

- total spent is high relative to allocated
- one category is at 80% or more of budget
- there are payment records but no obvious allocation clarity

Example prompts:

- “Review where we may be overspending.”
- “Help me rebalance this budget.”
- “What payments need attention first?”

#### Tasks
File:

- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/Tasks.tsx`

Add:

- one AI recovery card above the main task list

Example triggers:

- overdue tasks exist
- urgent tasks exist
- no due-date discipline on key tasks

Example prompts:

- “Create a catch-up plan for overdue tasks.”
- “What should we do first this week?”
- “Turn these overdue items into a simple recovery plan.”

#### Vendors
File:

- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/Vendors.tsx`

Add:

- one AI vendor decision card near shortlist/final vendor sections

Example triggers:

- important categories still not finalized
- payment due dates approaching
- vendor task follow-ups exist

Example prompts:

- “Which vendor decision is blocking us most?”
- “Help me decide what to do next with photographers.”
- “Summarize vendor payment and follow-up risks.”

### Phase 1 UX constraints

- no full chat window on every page yet
- no floating global bot yet
- no giant prompt wall
- one small, obvious assistant card per page
- max 3 suggested actions
- dismissible per page/session

This keeps the rollout light and avoids visual clutter.

## Phase 2: Slide-over assistant panel
After the inline cards prove useful, add a shared assistant panel.

### Behavior
- small launcher button in app shell
- opens a right-side panel
- automatically knows the current page
- automatically uses page context

### Benefits
- users can continue within their current workspace
- less navigation friction than `/ai-chat`
- more natural place for longer conversations

### Still reuse existing backend
The panel should still call:

- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/supabase/functions/wedding-ai-chat/index.ts`

No separate AI function should be created for this.

## Phase 3: Proactive nudges
Only after phases 1 and 2 are stable.

Examples:

- budget category exceeds 80%
- overdue tasks exceed threshold
- no confirmed vendor for an important category within a planning window
- payment due within 7 days
- guest RSVP follow-up backlog

Rules:

- short
- actionable
- dismissible
- never noisy

This should feel like helpful nudging, not alert spam.

## Recommended Architecture

## Core rule
Keep one AI backend brain and add multiple UI surfaces.

### Do not create
- separate AI functions per page
- separate business logic copies for budget/tasks/vendors

### Do create

#### 1. Shared page-context request layer
Add a reusable client helper:

- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/lib/aiAssistant.ts`

Suggested responsibilities:

- invoke `wedding-ai-chat`
- pass contextual metadata
- normalize errors
- expose a small API for inline assistant requests

Suggested payload additions:

- `page`
- `context_source`
- `entity_id`
- `surface`
- `starter_prompt`

Example values:

- `page: "budget"`
- `context_source: "inline_card"`
- `entity_id: null`
- `surface: "budget_summary_card"`

These fields should not replace existing workspace data; they should enrich it.

#### 2. Shared inline assistant hook
Add:

- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/hooks/useInlineAssistant.ts`

Suggested responsibilities:

- entitlement check
- loading state
- invoke shared AI helper
- store most recent response
- expose `runStarterAction(prompt)`
- handle dismiss state

Suggested return shape:

- `canUseAssistant`
- `isLoading`
- `response`
- `error`
- `runPrompt`
- `dismiss`

#### 3. Reusable UI component
Add:

- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/components/InlineAssistantCard.tsx`

Suggested responsibilities:

- display one short headline
- display 1–3 recommended prompts
- show loading state
- render short AI response
- include “Open full assistant” link to `/ai-chat`

This component should be presentational and generic.

#### 4. Reusable assistant panel
For phase 2, add:

- `/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/components/AssistantPanel.tsx`

Suggested responsibilities:

- slide-over container
- ongoing threaded conversation
- contextual page label
- optional write-action review support later

## Context design
The existing AI already loads workspace state.

We should add only enough context to make inline invocation smarter.

### Recommended request fields

- `page`
- `surface`
- `context_source`
- `entity_id`
- `user_prompt`

### Recommended page values

- `dashboard`
- `budget`
- `tasks`
- `vendors`
- `guests`

### Recommended surface values

- `weekly_focus_card`
- `budget_risk_card`
- `task_recovery_card`
- `vendor_decision_card`

## Product copy guidance
Do not lead with generic AI language.

Bad:

- “Ask the AI assistant anything”

Better:

- “You have 4 overdue tasks. Want a catch-up plan?”
- “Catering is close to budget. Want help rebalancing?”
- “You still need a photographer. Want next steps?”

This is especially important for couples.

We should sell:

- a useful next move

not:

- an abstract assistant

## Suggested Phase 1 component usage

### Dashboard
- headline:
  - `This week’s planning focus`
- prompts:
  - `What should we focus on first?`
  - `Summarize risks for this week`
  - `Turn this week into next steps`

### Budget
- headline:
  - `Budget check`
- prompts:
  - `Where are we overspending?`
  - `Help me rebalance this budget`
  - `What payments matter most next?`

### Tasks
- headline:
  - `Task recovery`
- prompts:
  - `Create a catch-up plan`
  - `What should happen first this week?`
  - `Turn overdue work into a simple checklist`

### Vendors
- headline:
  - `Vendor decisions`
- prompts:
  - `What vendor decision is blocking us?`
  - `Summarize vendor follow-up risks`
  - `Help me prioritize vendor next steps`

## Entitlement behavior
Reuse the existing entitlement system instead of creating separate inline-AI flags.

For couples:

- `couple.ai_assistant`

For planners:

- `planner.ai_assistant`

For committees:

- `committee.ai_assistant`

For vendors:

- `vendor.ai_assistant`

If access is locked:

- show a small upgrade state in the inline card
- CTA should route to the focused relevant upgrade flow

Do not dump users into a giant pricing wall.

## Analytics recommendations
Track usage at the surface level.

Suggested events:

- `ai_inline_card_viewed`
- `ai_inline_prompt_clicked`
- `ai_inline_response_rendered`
- `ai_panel_opened`
- `ai_inline_upgrade_prompt_opened`
- `ai_inline_to_full_assistant_clicked`

Important dimensions:

- `page`
- `surface`
- `role`
- `planner_type`
- `entitlement_state`

This will tell us which pages create real AI value.

## Recommended Implementation Sequence

### Step 1
Create shared helper:

- `src/lib/aiAssistant.ts`

### Step 2
Create shared hook:

- `src/hooks/useInlineAssistant.ts`

### Step 3
Create UI component:

- `src/components/InlineAssistantCard.tsx`

### Step 4
Add to:

- `src/pages/Dashboard.tsx`

### Step 5
Add to:

- `src/pages/Budget.tsx`

### Step 6
Add to:

- `src/pages/Tasks.tsx`

### Step 7
Add to:

- `src/pages/Vendors.tsx`

### Step 8
Measure usage and refine prompt quality

### Step 9
Build slide-over panel for phase 2

## What not to do next

- do not rebuild the AI prompt system first
- do not create separate AI logic per page
- do not start with a fully persistent chatbot everywhere
- do not over-automate nudges before we see page-level adoption

The existing AI backend is already good enough to power the first rollout.

## Final recommendation
The next AI milestone should be:

**Embed the existing assistant into the four most valuable workspace pages using one reusable inline component and one shared hook.**

That gives Zania:

- guided planning where users are already working
- less friction than `/ai-chat`
- more visible AI value
- minimal architectural waste

This is the highest-leverage way to make the current AI feel like a product advantage instead of a separate feature page.
