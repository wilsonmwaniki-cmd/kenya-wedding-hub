# Subscriptions And Access Control Implementation

## Goal

Implement subscriptions and paywalls without scattering business rules across the UI.

The access-control layer should answer one question consistently:

- can this user perform this action right now?

## Core principle

Do not treat billing as only a page-level concern.

Instead:

- model plans and entitlements centrally
- evaluate access at feature and action level
- keep UI messaging and backend enforcement aligned
- treat the wedding as the billable workspace for couple products

## Recommended plan model

### Couple wedding plans

Plan type:

- wedding-owned plan ladder

Recommended couple tiers:

- `Free`
- `Basic`
- `Premium`

Recommended add-ons:

- `Gift Registry`
- `Guest RSVP & Management`

State needed:

- wedding id
- plan tier
- billing cadence
- activated at
- renews at or expires at
- add-on state
- collaboration seat limits

### Planner

Plan type:

- recurring planner subscription

State needed:

- plan status
- active wedding allowance
- renewal period
- billing state

### Vendor

Plan type:

- recurring vendor subscription

State needed:

- plan status
- lead access enabled
- analytics enabled
- premium visibility enabled

## Recommended schema direction

Keep the current role and profile tables, but introduce or continue using a dedicated billing and entitlement layer.

### `billing_plans`

Fields:

- `id`
- `plan_code`
- `audience`
- `display_name`
- `billing_model`
- `is_active`
- `metadata`

Examples:

- `couple_basic_monthly`
- `couple_basic_annual`
- `couple_premium_monthly`
- `couple_premium_annual`
- `gift_registry_addon`
- `guest_rsvp_management_addon`
- `planner_pro`
- `vendor_pro`

### `account_subscriptions`

Fields:

- `id`
- `user_id` nullable
- `workspace_id` nullable
- `plan_id`
- `status`
- `started_at`
- `expires_at`
- `billing_provider`
- `billing_reference`

Purpose:

- single source of truth for whether a user or wedding workspace is paid
- couple billing should attach to the wedding workspace
- planner and vendor billing can remain account-owned for now

### `account_entitlements`

Fields:

- `id`
- `user_id` nullable
- `workspace_id` nullable
- `feature_key`
- `status`
- `source_subscription_id`
- `effective_from`
- `effective_to`
- `limit_value` nullable

Purpose:

- decouple features from pricing plans
- lets one plan unlock many actions cleanly
- supports seat limits and add-ons without hardcoding plan names into checks

### `planner_capacity`

Fields:

- `planner_user_id`
- `active_wedding_limit`
- `active_wedding_count`

Purpose:

- keep planner limits based on active weddings

## Feature keys

Use stable feature keys instead of hardcoding copy into checks.

### Couple wedding entitlements

- `wedding_collaboration`
- `planner_collaboration`
- `vendor_collaboration`
- `committee_collaboration`
- `family_collaboration`
- `timeline_management`
- `ai_wedding_assistant`
- `gift_registry`
- `guest_rsvp_management`

### Couple seat limits

- `committee_seat_limit`
- `family_seat_limit`

### Planner entitlements

- `planner.multi_active_weddings`
- `planner.export_progress`
- `planner.advanced_reporting`
- `planner.calendar_sync`

### Vendor entitlements

- `vendor.receive_leads`
- `vendor.respond_to_leads`
- `vendor.analytics`
- `vendor.premium_visibility`

## Access checks

Implement helper functions first, then apply them in pages and secure RPCs.

Suggested helper shape:

- `canAccessFeature(subject, featureKey)`
- `getBlockedReason(subject, featureKey)`
- `getUpgradePlanForFeature(featureKey)`

For couples, `subject` should resolve to the wedding workspace.

These helpers should be callable from:

- frontend UI
- Supabase RPCs
- edge functions

## Upgrade trigger points

Trigger upgrades where users cross from discovery to execution.

### Couple wedding plans

- when clicking connect to vendor
- when clicking connect to planner
- when inviting committee or family collaborators
- when opening the AI Wedding Assistant
- when unlocking collaborative timeline features
- when enabling gift registry
- when enabling RSVP workflows

### Planner

- when adding a second active wedding
- when exporting
- when opening advanced planner reporting

### Vendor

- when trying to receive or reply to leads
- when opening analytics
- when unlocking premium visibility

## UI behavior

When a feature is blocked:

- explain what the user can still do for free
- explain what unlocks after upgrade
- point to the correct paid tier or add-on

Do not:

- show a blank disabled state with no explanation
- hide why the feature is blocked
- use legacy `Planning Pass` language in couple-facing UI

## Enforcement layers

### Frontend

Purpose:

- explain locked actions
- present upgrade prompts

### Backend

Purpose:

- stop restricted actions even if someone bypasses the UI

Backend checks should protect:

- planner capacity increases
- vendor lead responses
- couple and planner collaboration requests if monetized
- exports if monetized
- calendar sync token setup if monetized
- AI assistant access if monetized
- committee and family seat limits

## Migration path from current schema

The current codebase already stores some legacy subscription state in planner, vendor, and older couple bridge fields.

Short-term:

- keep current planner and vendor subscription columns working
- keep legacy couple `planning_pass` fields only as compatibility mirrors or bridge data
- layer the wedding-level entitlement model gradually

Medium-term:

- move couple feature decisions fully to wedding entitlements
- keep old couple `planning_pass` fields only as historical or compatibility mirrors
- keep planner and vendor subscriptions centralized through the same helper layer

## Rollout plan

### Step 1

- introduce pricing page
- define plan and feature keys in code
- add upgrade prompts at trigger points

### Step 2

- add central entitlement helpers
- wire existing planner and vendor subscription state into those helpers
- wire couple gating to wedding-level entitlements

### Step 3

- add or finalize billing tables
- connect billing provider

### Step 4

- enforce access in frontend and backend
- add planner active wedding counting
- enforce couple seat limits and add-ons

### Step 5

- add analytics:
  - viewed upgrade prompt
  - upgraded
  - abandoned

## Recommended first implementation tasks

1. Add shared pricing and feature-gate config in code
2. Add `/pricing`
3. Add role-aware upgrade prompts on blocked actions
4. Add entitlement helper functions
5. Add billing schema only after prompt copy and trigger points feel right
