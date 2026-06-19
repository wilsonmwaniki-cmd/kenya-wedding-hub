# Space & Table Plan Product Spec

## Goal

Build a visual wedding layout tool inside Zania so couples, planners, decorators, venues, caterers, ushers, and photographers can align around one shared event-space plan.

This should not be framed as a generic seating chart tool.

The stronger Zania position is:

- `Zania Space & Table Plan`

It helps teams:

- sketch the event layout
- place tables and service zones
- assign guests to tables
- annotate execution details
- export print-ready layouts for wedding-day operations

## Product Position

Zania already manages:

- guests
- vendors
- timeline
- budgets
- planner collaboration

This module becomes the visual coordination layer that ties those systems together.

The core promise is:

`Help everyone see the wedding before the wedding day.`

That is more useful than a standalone seating chart because decorators, caterers, ushers, venues, and photographers all care about the same space for different reasons.

## Why This Matters For Zania

This is one of the strongest workflow add-ons for the product because it:

- makes guest planning more tangible
- gives decorators and venues a reason to use Zania directly
- creates more operational value than a purely informational page
- increases collaboration around real wedding execution
- gives couples a clear visual planning artifact they can share and approve

It also creates a stronger wedge into vendor-side usage because the output is directly useful on setup day.

## User Jobs

### Couples

- visualize what their wedding will look like
- decide where key people sit
- review planner and decorator proposals
- approve a final event layout

### Planners

- coordinate table counts and guest seating
- align decorator, caterer, venue, and usher teams
- export final layout packs for wedding day

### Decorators

- understand where the stage, aisle, cake table, dance floor, and florals go
- count table and decor requirements
- confirm setup zones and vendor responsibilities

### Caterers / Ushers / Venue Teams

- see guest distribution by table
- identify VIP and family zones
- understand buffet, service, and access flow

### Photographers / DJs / Production Teams

- understand stage placement
- note access paths and restricted zones
- work around audience and vendor setup patterns

## First-Release Positioning

Do not market the first version as a full architectural planning tool.

Do market it as:

- a visual reception and ceremony layout planner
- a table assignment tool tied to the real guest list
- a printable execution tool for planners and vendors

## MVP Scope

### In scope for Phase 1

- create a wedding `space plan`
- define one or more event spaces for a wedding
- drag and place core objects on a 2D canvas
- resize, rotate, duplicate, label, and delete objects
- create and manage tables
- assign guests to tables
- mark VIP / family / reserved zones
- add notes to layout objects
- export a full floor plan view
- export a table list view

### Out of scope for Phase 1

- 3D rendering
- precise venue blueprint import
- live multi-user editing
- seat-level drag positioning around a table
- public guest self-seat selection
- automatic capacity optimization
- AI crowd-flow suggestions
- full decorator inventory management
- print vendor branding customization

## MVP Objects

Phase 1 should support a deliberately small object library.

### Core layout objects

- round table
- rectangular table
- high table
- sweetheart table
- stage
- dance floor
- cake table
- buffet station
- bar
- DJ booth
- photo booth
- entrance
- aisle
- decor zone
- VIP zone
- reserved zone
- walkway
- power point
- vendor station

### Object behavior

Each object should support:

- x / y position
- width
- height
- rotation
- display label
- notes
- duplicate
- delete

### Table-specific behavior

Tables should additionally support:

- table number or name
- shape
- capacity
- guest assignments
- VIP flag
- dietary notes
- service notes
- decor notes

## Key Workflows

### 1. Create a new space plan

User chooses:

- wedding
- event day
- plan name
- space type

Recommended space types:

- reception tent
- church setup
- garden ceremony
- ballroom
- venue hall
- home compound
- after-party space

### 2. Build the layout

User:

- opens a blank canvas
- chooses objects from a palette
- drags them onto the space
- labels important areas
- sizes and arranges the layout

### 3. Assign guests to tables

User:

- creates tables with capacities
- selects guests from the existing guest list
- assigns guests to the correct tables
- flags priority guests and family seating

### 4. Review operational notes

User:

- adds layout notes
- marks decor or access concerns
- confirms vendor-sensitive zones

### 5. Export for execution

User exports:

- full floor plan PDF
- table list PDF
- CSV table list

## Zania-Specific Advantage

The advantage is not the canvas itself.

The advantage is that it connects to the rest of the wedding workspace.

Examples:

- guest list feeds the table planner
- vendor hub reflects table and decor requirements
- timeline can reference layout setup milestones
- planner can send a final plan to decorators or venue teams
- couples can review one shared source of truth

This is what separates the feature from an isolated third-party seating tool.

## Information Architecture

Recommended user-facing naming:

- Navigation label: `Space Plan`
- Module title: `Space & Table Plan`

Recommended placement:

- couple workspace primary nav
- planner wedding workspace nav

Do not place it under vendor public directory flows.

Vendor access should come later through controlled sharing or linked wedding workspace roles.

## Preview-Only Rollout

This should remain private while we shape the experience.

Use the existing preview workflow pattern in:

- [preview-feature-workflow.md](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/docs/preview-feature-workflow.md)

Recommended feature flag:

- `VITE_ENABLE_SPACE_TABLE_PLAN`

Recommended preview route:

- `/labs/space-plan`

Production should keep this hidden until:

- the object model is stable
- exports are useful
- guest assignments feel reliable

## Data Model

The model should stay simple and relational.

### 1. `public.wedding_space_plans`

Purpose:

- top-level space plan record tied to a wedding

Columns:

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `wedding_id uuid not null`
- `created_by uuid not null`
- `name text not null`
- `space_type text not null`
- `event_label text null`
- `notes text null`
- `canvas_width integer not null default 1600`
- `canvas_height integer not null default 900`
- `status text not null default 'draft' check (status in ('draft', 'review', 'final'))`
- `is_active boolean not null default true`

Indexes:

- `wedding_space_plans_wedding_id_idx`
- `wedding_space_plans_created_by_idx`
- `wedding_space_plans_status_idx`

### 2. `public.wedding_space_plan_objects`

Purpose:

- store all movable items on the canvas

Columns:

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `space_plan_id uuid not null references public.wedding_space_plans(id) on delete cascade`
- `object_type text not null`
- `label text null`
- `notes text null`
- `x numeric(10,2) not null`
- `y numeric(10,2) not null`
- `width numeric(10,2) not null`
- `height numeric(10,2) not null`
- `rotation numeric(8,2) not null default 0`
- `z_index integer not null default 0`
- `metadata jsonb not null default '{}'::jsonb`

Indexes:

- `wedding_space_plan_objects_space_plan_id_idx`
- `wedding_space_plan_objects_type_idx`

### 3. `public.wedding_space_plan_tables`

Purpose:

- extend layout objects that act as guest tables

Columns:

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `space_plan_object_id uuid not null references public.wedding_space_plan_objects(id) on delete cascade`
- `table_name text not null`
- `shape text not null check (shape in ('round', 'rectangle', 'high_table', 'sweetheart'))`
- `capacity integer not null`
- `vip boolean not null default false`
- `decor_notes text null`
- `service_notes text null`
- `dietary_notes text null`

Indexes:

- `wedding_space_plan_tables_object_id_idx`

### 4. `public.wedding_space_plan_guest_assignments`

Purpose:

- connect real guest records to a table

Columns:

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `space_plan_table_id uuid not null references public.wedding_space_plan_tables(id) on delete cascade`
- `guest_id uuid not null`
- `seat_label text null`
- `notes text null`

Indexes:

- `wedding_space_plan_guest_assignments_table_id_idx`
- `wedding_space_plan_guest_assignments_guest_id_idx`

Constraints:

- unique `(space_plan_table_id, guest_id)`

## Access Model

Phase 1 should follow existing workspace access rules.

### Couples

- can create, edit, and export plans in their own wedding workspace

### Planners linked to the wedding

- can create, edit, and export plans inside planner-managed client workspaces

### Vendors

Phase 1:

- no direct editing access

Later:

- controlled read access through wedding-linked vendor collaboration

## UI Shape

### Page structure

Recommended page layout:

1. header
2. plan selector
3. left object palette
4. center canvas
5. right inspector panel
6. bottom or side guest assignment drawer

### Header actions

- create plan
- rename plan
- save
- export
- duplicate plan

### Left palette

- core object chips
- search or grouped categories later

### Right inspector

Shows selected object settings:

- label
- size
- rotation
- notes
- table settings where relevant

### Guest assignment drawer

For table objects:

- available guests
- assigned guests
- table capacity state
- VIP and note fields

## Exports

Exports are essential to the feature's usefulness.

### Phase 1 exports

#### Full floor plan PDF

Show:

- canvas layout
- object labels
- plan title
- wedding name
- export date

#### Table list PDF

Show:

- each table
- guest names per table
- VIP markers
- notes where relevant

#### CSV export

Show:

- table name
- guest name
- guest group if available
- notes if any

### Later exports

- decorator execution sheet
- caterer summary
- usher seating list
- venue setup summary

## Integration Points

### Guests

Primary integration for MVP.

Use existing guest records so assignment stays connected to the real wedding workspace instead of a fake local list.

### Vendors

Do not deeply integrate vendor execution logic in Phase 1.

But prepare for later object metadata such as:

- assigned vendor
- vendor category
- setup owner

### Timeline

Later opportunity:

- add setup milestones tied to the space plan

### AI Assistant

Later opportunity:

- summarize space requirements
- suggest table counts from guest totals
- flag likely capacity mismatches

## Analytics

Track a small set of events at launch:

- `space_plan_created`
- `space_plan_object_added`
- `space_plan_table_created`
- `space_plan_guest_assigned`
- `space_plan_exported`

This will show whether people are only exploring the feature or actually finishing useful plans.

## Non-Goals

The first release should not attempt to be:

- CAD software
- interior design software
- a public RSVP seating portal
- a full production logistics system

Those can emerge later if real usage patterns justify them.

## Implementation Phases

### Phase 1: MVP

- preview-only feature flag
- one page with canvas and inspector
- object placement
- table creation
- guest assignment
- basic export views

Success looks like:

- a planner or couple can sketch a reception layout
- assign guests to tables
- export something they would actually use

### Phase 2: Decorator mode

Add:

- decor layers
- centerpieces and floral notes
- backdrop location
- lighting notes
- setup zones
- rental notes
- reference image attachments

### Phase 3: Venue templates

Add reusable templates such as:

- Karen garden wedding layout
- Naivasha tented reception
- hotel ballroom setup
- church ceremony layout
- home compound ruracio setup
- Indian wedding reception layout

### Phase 4: Smart planning support

Add optional guidance such as:

- estimated table count from guest totals
- overcrowding warnings
- decor quantity suggestions
- walkway congestion warnings
- VIP placement suggestions

## Suggested Build Order

1. Add preview-only feature flag and route.
2. Create schema and types for plans, objects, tables, and guest assignments.
3. Build canvas page with manual object placement.
4. Add table inspector and guest assignment flow.
5. Add print/export page.
6. Add analytics and polish.

## Recommended Immediate Next Step

Implement this privately first as a preview-only experiment, not in production navigation.

The first engineering milestone should be:

- schema
- route
- blank canvas
- draggable objects
- table object support

That is the smallest slice that proves whether the interaction feels right before deeper integrations are added.
