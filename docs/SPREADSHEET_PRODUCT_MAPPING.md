# Planner Spreadsheet Product Mapping

Source workbook reviewed:

- `/Users/Mwaniki1/Downloads/Tasks Checklist - Groom, Bride.xlsx`

Sheets reviewed:

1. `Checklist`
2. `Personal Budget`
3. `Wedding Budget and Vendors`

## What The Spreadsheet Does Well

The workbook is not a generic checklist. It encodes a working planning system with five useful structures:

1. Category-driven planning
2. Timeline by months before the wedding
3. Private vs public work separation
4. Delegation to named coordination roles
5. Budget and vendor tracking tied to payment progress

This is more structured than the app’s original flat checklist model and should drive how seeded plans behave.

## Sheet 1: Checklist

Columns found:

- `CATEGORY`
- `TASK`
- `TIMELINE`
- `PRIORITY`
- `PRIVATE / PUBLIC`
- `DELEGATABLE`
- `DELEGATABLE TO WHO`

### Product Meaning

Each task belongs to:

- a planning category
- a planning phase
- a privacy level
- a delegation rule
- a target timeline

### Task Phase Pattern

The sheet repeatedly uses this vendor task sequence:

1. `Research`
2. `Selection and Booking`
3. `Second Payment`
4. `Closure and Final Payment`

The app should treat these as first-class workflow phases, not just free-text task titles.

### Visibility Pattern

The planner distinguishes between:

- `Private`
- `Public`

Examples:

- private: couple rings, personal attire, gynaecology, post-wedding housing
- public: venue, catering, decor, stationery, MC, DJ, photography

This matters for couple, planner, and committee collaboration.

### Delegation Pattern

The sheet uses specific responsibility roles rather than generic “member” labels.

Examples:

- `Aesthetics Coordinator`
- `Stationery Coordinator`
- `Edibles Coordinator`
- `Experience Coordinator`
- `Best Man`
- `Best Lady`

This should inform committee defaults and task delegation hints.

## Sheet 2: Personal Budget

The workbook separates private spending from the main wedding budget.

Categories found include:

- Dowry
- House rent
- Utilities
- House shopping
- Pre-marital classes
- Honeymoon
- Gynaecologist
- Wedding bands
- Bride attire
- Bride body preparation
- Groom attire
- Groom body preparation

### Product Meaning

The app should not treat all wedding-related spending as one budget.

Recommended split:

1. `Wedding Budget`
2. `Personal Budget`

This matches real planning behavior in the market.

## Sheet 3: Wedding Budget and Vendors

Columns found:

- `BUDGET ITEM`
- `BUDGET COST`
- `AMOUNT PAID`
- `BALANCE`
- `VENDOR DETAILS`
- `COMMITTEE MEMBER IN-CHARGE`
- `DRAWN CONTRACT`
- `COMMENTS`

### Product Meaning

Every wedding budget line should support:

- financial tracking
- vendor attachment
- ownership
- contract state
- planning notes

This maps well onto the app’s vendor shortlist and payment workflow.

## Product Mapping

### Tasks

Add or use these task fields:

- `phase`
- `visibility`
- `delegatable`
- `recommended_role`
- `priority_level`
- `template_source`

Current implementation in PR-22:

- `phase`
- `visibility`
- `delegatable`
- `recommended_role`
- `priority_level`
- `template_source`

### Budgets

Recommended product shape:

1. `Wedding Budget`
   - public wedding spending
   - venue, catering, decor, stationery, transport, MC, DJ, photography, videography, etc.

2. `Personal Budget`
   - private couple spending
   - attire, body prep, rings, honeymoon, dowry, post-wedding home setup, health prep

Current status:

- not yet implemented as separate boards
- should be a follow-up PR

### Vendors

Recommended vendor/budget fields:

- `committee_role_in_charge`
- `contract_status`
- payment progress
- shortlist/final status
- comments

Current status:

- shortlist and final choice are implemented
- payment tracking is implemented
- contract status and role-in-charge still need to be added

## PR-22 Scope

PR-22 uses the spreadsheet to improve seeded planning templates by:

1. adding task metadata to `tasks`
2. encoding the spreadsheet’s workflow phases into seeded tasks
3. separating private and public tasks
4. adding delegation hints for committee-friendly workflows
5. deriving due dates from wedding date when one exists

## New Seeded Task Structure

Seeded tasks now support:

- `foundation`
- `research`
- `selection_booking`
- `second_payment`
- `closure_final_payment`

Seeded tasks also distinguish:

- `private`
- `public`

And can suggest delegation targets such as:

- `Aesthetics Coordinator`
- `Edibles Coordinator`
- `Stationery Coordinator`
- `Experience Coordinator`
- `Logistics Coordinator`

## Follow-Up PRs Recommended

### PR-23

Add `Personal Budget` as a separate budget board.

### PR-24

Add vendor ownership and contract status fields:

- `committee_role_in_charge`
- `contract_status`

### PR-25

Add category milestone views so vendor categories show workflow status by phase:

- research
- booking
- second payment
- closure

## Implementation Principle

Do not copy the spreadsheet literally.

Use its structure:

- staged vendor workflow
- budget separation
- delegation roles
- private/public work split
- timeline-based planning

That is the real value of the workbook.
