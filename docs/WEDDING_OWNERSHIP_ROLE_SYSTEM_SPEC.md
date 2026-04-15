# Wedding Ownership, Roles, And Collaboration Spec

## Purpose

This document defines the recommended Zania model for:

- wedding ownership
- multi-role participation
- invitation and join flows
- role-scoped permissions
- collaboration bundles and subscriptions
- schema changes required to implement the system cleanly

This spec intentionally moves Zania away from a single global account-role model and toward a wedding-scoped membership model.

That is the correct direction for this product because one person may participate in multiple weddings in different capacities.

## Core product principles

### 1. The wedding is the primary object

The system should treat a wedding as the central workspace.

Everything important hangs off the wedding:

- owners
- partner
- committee members
- planner access
- vendor relationships
- tasks
- budget
- guest list
- permissions
- subscription bundles

### 2. Accounts are identity, not authority

A user account should represent:

- one person
- one email
- one authenticated identity

It should not permanently define the user's global role.

Authority should come from the user's membership within a specific wedding.

### 3. Roles are wedding-scoped

A user can be:

- groom in Wedding A
- committee chair in Wedding B
- family helper in Wedding C
- planner for Wedding D

This should be supported without forcing separate accounts.

### 4. The couple owns the wedding

Each wedding should be owned by the couple.

Recommended ownership pattern:

- owner 1: bride or groom who created the wedding
- owner 2: invited partner who accepts and becomes co-owner

The couple owns:

- subscription decisions
- collaboration access
- budget visibility rules
- vendor access
- planner access
- committee invitations

### 5. Billing attaches to the wedding workspace

For couples and committees, paid collaboration should be attached to the wedding, not the person.

This keeps pricing intuitive and operationally clean.

## Recommended user entry flow

### Entry choice

When a user chooses sign up, the system should ask:

- `Create a wedding`
- `Join a wedding`

This is better than asking for a global role first.

### Create a wedding flow

If user selects `Create a wedding`:

1. Create account
2. Choose role:
   - bride
   - groom
3. Create wedding workspace
4. Capture basic wedding setup:
   - wedding name
   - estimated date
   - county / town
5. Prompt creator to invite partner by email
6. Prompt creator to choose collaboration model:
   - planning as a couple only
   - working with a committee
   - working with a planner
   - planner and committee later

### Join a wedding flow

If user selects `Join a wedding`:

1. Create account or sign in
2. Choose:
   - open invite link from email
   - enter wedding code
3. Accept assigned role
4. Join the wedding workspace

## Ownership model

### Wedding owners

Each wedding should have up to two owner memberships:

- bride
- groom

Both should be flagged as:

- `is_owner = true`

Owners have equal permissions unless future product rules introduce limited ownership tiers.

### Wedding code

Each wedding should have a unique join code used for:

- partner join fallback
- committee join fallback
- planner join fallback when invited
- support workflows

The primary invite path should still be email links, with code as fallback.

## Membership model

### Recommended wedding roles

Base wedding-scoped roles:

- `bride`
- `groom`
- `committee_chair`
- `committee_member`
- `planner`
- `family_contributor`
- `viewer`

Role-like assignment labels that do not need full workspace power can live separately as task assignments:

- best man
- maid of honor
- parent
- sibling
- usher coordinator
- transport coordinator
- secretary

Important distinction:

- `membership role` controls workspace permissions
- `assignment role` controls task responsibility and labels

### Membership states

Each wedding membership should track status:

- `invited`
- `active`
- `declined`
- `revoked`
- `expired`

## Recommended permission model

Permissions should be evaluated at three layers:

1. wedding ownership
2. membership role
3. subscription entitlements

Example:

- a committee member may be allowed to collaborate
- but only if the wedding has available committee seats
- and only if the wedding collaboration pass is active

### Permission families

Use stable permission keys so frontend and backend enforce the same rules.

Suggested permission families:

- `wedding.manage`
- `wedding.view_private`
- `wedding.view_shared`
- `memberships.invite_partner`
- `memberships.invite_committee`
- `memberships.invite_planner`
- `memberships.manage`
- `tasks.read`
- `tasks.write`
- `tasks.assign`
- `budget.read_shared`
- `budget.read_private`
- `budget.write`
- `payments.record`
- `guests.read`
- `guests.write`
- `vendors.read`
- `vendors.write`
- `exports.run`
- `calendar.sync`
- `ai.use`
- `billing.manage`

## Role and permission matrix

### Bride / Groom

Purpose:

- wedding co-owners

Default permissions:

- full shared workspace access
- private couple workspace access
- invite partner
- invite committee
- invite planner
- manage billing
- manage subscriptions
- manage wedding details
- full write access to tasks, budget, guests, vendors, payments
- export and calendar sync if entitlement exists

### Committee chair

Purpose:

- manages committee execution within a couple-owned wedding

Default permissions:

- shared workspace read/write
- assign tasks to committee members
- view shared budget
- record shared planning progress
- cannot manage billing
- cannot change owners
- cannot access couple-private data unless explicitly granted

### Committee member

Purpose:

- collaborates on delegated work

Default permissions:

- shared workspace read
- limited task write/update
- limited vendor progress updates
- no billing management
- no ownership changes
- no private couple budget access

### Planner

Purpose:

- professional collaborator invited into a wedding

Default permissions:

- shared workspace read/write
- task and vendor management
- budget planning access
- payment tracking access where allowed
- exports and calendar sync based on wedding entitlement
- no ownership changes
- no billing changes unless explicitly allowed

### Family contributor

Purpose:

- invited helper with specific responsibilities

Default permissions:

- view assigned tasks
- update their task progress
- limited shared visibility
- no budget management
- no member invitation

### Viewer

Purpose:

- read-only participant

Default permissions:

- read-only shared workspace
- no writes
- no invitations

## Subscription and bundle model

### Free account

Account creation should remain free.

Free includes:

- create account
- create wedding
- join wedding
- browse vendors and planners
- use estimator
- draft tasks, guest list, and budget

### Subscription timing

Annual subscriptions should start on payment date.

Recommended subscription fields:

- activated_at
- expires_at
- grace_ends_at

### Wedding-level passes

For weddings, billing should be applied at the wedding level.

Recommended wedding products:

- `Couple Pass`
- `Committee Bundle 5`
- `Committee Bundle 10`
- `Committee Unlimited`
- `Planner Collaboration Add-on`
- `Exports Add-on`
- `Calendar Sync Add-on`
- `AI Add-on` optional future separation

### Committee bundle behavior

The committee bundle should control how many active committee memberships can exist for that wedding.

Bundle examples:

- `committee_5`
  - up to 5 active committee memberships
- `committee_10`
  - up to 10 active committee memberships
- `committee_unlimited`
  - unlimited committee memberships

Important:

- these are wedding seats, not person subscriptions
- if a member is revoked, the seat becomes reusable

### Planner collaboration behavior

Planner access should be a separate wedding entitlement.

Reason:

- a couple may use a committee without a planner
- a couple may use a planner without committee seats
- a couple may use both

## Recommended security model

### Email verification

Always require email verification.

### Two-factor authentication

Do not force blanket 2FA every two months for all normal usage.

Recommended instead:

- encourage 2FA for owners, planners, admins, and vendors
- require re-authentication or step-up verification for sensitive actions

Sensitive actions:

- change owners
- transfer ownership
- manage billing
- run exports
- delete wedding
- revoke planner access
- change partner email

If periodic re-check is desired, use:

- re-authentication every 60 days for sensitive actions

That is lower-friction and more realistic than mandatory full 2FA every two months for all users.

## UX flows

### Flow 1: Create wedding as bride or groom

1. User clicks `Sign up`
2. User chooses `Create a wedding`
3. User chooses:
   - bride
   - groom
4. System creates:
   - account
   - wedding
   - owner membership
   - wedding code
5. System prompts:
   - invite your partner
6. User enters partner email
7. System sends invite email with:
   - invite link
   - wedding code fallback

### Flow 2: Join as partner

1. User opens invite link or enters wedding code
2. System tells them the assigned role:
   - bride or groom
3. User accepts
4. System activates second owner membership

### Flow 3: Add committee bundle and invite committee

1. Couple chooses committee collaboration
2. System shows bundle options:
   - 5 emails
   - 10 emails
   - unlimited
3. Couple pays
4. Wedding receives entitlement
5. Couple enters committee emails in batch
6. System sends invitations
7. Accepted invites consume committee seats

### Flow 4: Invite planner

1. Couple or owner selects planner collaboration
2. System checks planner entitlement
3. Couple invites planner via email or accepts planner request
4. Planner receives wedding-scoped planner membership

### Flow 5: Join wedding from invite

1. User selects `Join a wedding`
2. User enters wedding code or opens invite link
3. System resolves pending invite
4. User accepts role
5. Membership becomes active

## Recommended schema changes

The current profile-first model should be extended so permissions can be derived from wedding-scoped memberships.

### Keep

Keep:

- `auth.users`
- `profiles`

But reduce reliance on `profiles.role` as the main authority source.

`profiles` should represent identity and preference-level information, not primary wedding permissions.

### New core tables

#### `weddings`

Purpose:

- the core workspace object

Suggested fields:

- `id uuid primary key`
- `name text`
- `slug text nullable`
- `wedding_code text unique`
- `status text`
- `wedding_date date nullable`
- `location_county text nullable`
- `location_town text nullable`
- `created_by_user_id uuid`
- `created_at timestamptz`
- `updated_at timestamptz`

#### `wedding_memberships`

Purpose:

- one user’s role within one wedding

Suggested fields:

- `id uuid primary key`
- `wedding_id uuid not null`
- `user_id uuid nullable`
- `email text not null`
- `role text not null`
- `membership_status text not null`
- `is_owner boolean not null default false`
- `invited_by_user_id uuid nullable`
- `accepted_at timestamptz nullable`
- `revoked_at timestamptz nullable`
- `metadata jsonb default '{}'::jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`

Notes:

- `user_id` may be null until invite is accepted
- `email` allows invitation before account creation

#### `wedding_invites`

Purpose:

- explicit invitation and join-token management

Suggested fields:

- `id uuid primary key`
- `wedding_id uuid not null`
- `membership_id uuid nullable`
- `email text not null`
- `invite_type text not null`
- `proposed_role text not null`
- `invite_token text unique not null`
- `status text not null`
- `expires_at timestamptz nullable`
- `sent_at timestamptz nullable`
- `accepted_at timestamptz nullable`
- `created_by_user_id uuid`
- `created_at timestamptz`

#### `wedding_subscription_bundles`

Purpose:

- wedding-level purchases and limits

Suggested fields:

- `id uuid primary key`
- `wedding_id uuid not null`
- `bundle_code text not null`
- `bundle_type text not null`
- `status text not null`
- `seat_limit integer nullable`
- `seats_used integer not null default 0`
- `activated_at timestamptz nullable`
- `expires_at timestamptz nullable`
- `billing_provider text nullable`
- `billing_reference text nullable`
- `metadata jsonb default '{}'::jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`

#### `wedding_entitlements`

Purpose:

- normalized feature access for one wedding

Suggested fields:

- `id uuid primary key`
- `wedding_id uuid not null`
- `feature_key text not null`
- `status text not null`
- `source_bundle_id uuid nullable`
- `effective_from timestamptz`
- `effective_to timestamptz nullable`
- `metadata jsonb default '{}'::jsonb`

#### `wedding_assignment_roles`

Purpose:

- track non-membership labels like best man or secretary

Suggested fields:

- `id uuid primary key`
- `wedding_id uuid not null`
- `user_id uuid nullable`
- `email text nullable`
- `assignment_role text not null`
- `source_task_id uuid nullable`
- `status text not null`
- `created_at timestamptz`

### Recommended adjustments to existing tables

Current operational tables should reference `wedding_id` directly wherever possible.

Recommended direction:

- `tasks`
  - ensure `wedding_id` exists
  - optionally add `assigned_membership_id`
- `budget_categories`
  - ensure `wedding_id` exists
- `budget_payments`
  - ensure `wedding_id` exists
- `guests`
  - ensure `wedding_id` exists
- `vendors`
  - ensure `wedding_id` exists
- `planner_clients`
  - evolve toward wedding relationship records or map planners to weddings through memberships

### Recommended new constraints

#### `wedding_memberships.role`

Allowed values:

- `bride`
- `groom`
- `committee_chair`
- `committee_member`
- `planner`
- `family_contributor`
- `viewer`

#### `wedding_memberships.membership_status`

Allowed values:

- `invited`
- `active`
- `declined`
- `revoked`
- `expired`

#### ownership rules

Recommended enforcement:

- max 2 active owner memberships per wedding
- owner roles limited to bride and groom

## Permission evaluation rules

Recommended helper shape:

- `get_wedding_membership(user_id, wedding_id)`
- `can_user_access_wedding(user_id, wedding_id, permission_key)`
- `get_wedding_entitlements(wedding_id)`
- `can_add_committee_member(wedding_id)`

Permission should resolve from:

1. active wedding membership
2. role permission map
3. wedding entitlement state

## Migration strategy

### Phase 1: introduce wedding ownership layer

Add:

- `weddings`
- `wedding_memberships`
- `wedding_invites`

Map existing couple/planner/committee records into wedding memberships.

### Phase 2: attach collaboration and billing to weddings

Add:

- `wedding_subscription_bundles`
- `wedding_entitlements`

Move committee/planner/collaboration gating to wedding-level checks.

### Phase 3: refactor permissions

Move backend authorization from:

- `profiles.role`

Toward:

- `wedding_memberships.role`
- `wedding_entitlements.feature_key`

### Phase 4: role-aware UX

Update signup and invite flows:

- create wedding
- join wedding
- partner invite
- committee bundle purchase
- planner invite

## Recommended product decisions

### Strong recommendations

- make wedding the core workspace object
- keep accounts free
- make bride/groom co-owners
- use wedding-scoped roles
- attach bundles and subscriptions to the wedding
- keep planner access separate from committee bundles
- allow one email to participate in many weddings

### Recommendations with caution

- support batch committee invites, but enforce seat limits clearly
- allow family/task-level contributors with limited permissions
- use join codes as fallback, not the primary invitation method

### Recommendation to soften

- replace blanket two-month 2FA with periodic step-up verification for sensitive actions

## Open product questions

These are the remaining decisions to settle before implementation:

1. Should a couple be able to purchase both planner and committee collaboration at the same time?
2. Can a planner invite assistant planners into the same wedding, or only the couple can?
3. Should committee members be able to see payment amounts by default, or only selected shared budget lines?
4. Should family contributors be counted inside committee seat bundles or separately?
5. Should ownership transfer require both owners to approve when both are active?

## Implementation recommendation

Implement this as the next major account model refactor, not as scattered exceptions added on top of the existing global-role logic.

That means:

1. introduce wedding and membership tables first
2. migrate collaboration permissions to wedding-scoped checks
3. then move signup and invitations to the new flow

This sequence keeps the model coherent and gives Zania the right long-term structure for:

- couple ownership
- committee bundles
- planner collaboration
- multi-role participation
- secure permissions
- cleaner billing
