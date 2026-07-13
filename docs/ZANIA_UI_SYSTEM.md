# Zania UI System

## Purpose

This document translates the philosophy in [docs/ZANIA_DESIGN_BIBLE.md](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/docs/ZANIA_DESIGN_BIBLE.md) into implementation rules for product design and frontend engineering.

The design bible defines `why` Zania should feel the way it does.

This document defines `how` that philosophy should show up in:

- tokens
- layouts
- components
- interaction patterns
- review checklists

It is intended to reduce drift between vision and execution.

## Source Of Truth

For the current codebase, the active token sources are:

- [tailwind.config.ts](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/tailwind.config.ts:1)
- [src/index.css](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/index.css:1)

If this document conflicts with those files, either:

1. update the implementation to match this document, or
2. revise this document intentionally

Do not let the product drift silently.

## Important Current-State Conflict

The design bible says:

- one font
- no decorative fonts

The current implementation uses:

- `Cormorant Garamond` for headings
- `DM Sans` for body text

This is a real product decision that needs explicit resolution.

### Recommendation

For now:

- allow the two-font system for marketing and couple-facing emotional surfaces
- keep product UI heavily constrained and readable
- avoid introducing any third font

Longer term, choose one of these directions:

1. keep the two-font system and revise the design bible language
2. move the application UI to one type system and reserve editorial typography only for branded marketing surfaces

## Design Tokens

### Color Tokens

Current semantic tokens already exist in code:

- `background`
- `foreground`
- `card`
- `popover`
- `primary`
- `secondary`
- `muted`
- `accent`
- `destructive`
- `border`
- `input`
- `ring`
- `success`
- `warning`
- `sidebar.*`

### Token Principles

- `primary` is for primary action and emphasis, not for decoration
- `accent` is for warmth and brand lift, used sparingly
- `success`, `warning`, and `destructive` are semantic only
- `muted` is for de-emphasis, not low-contrast failure
- `border` should do more structural work than `shadow`

### Radius

Current base radius:

- `--radius: 0.75rem`

Use only:

- `rounded-lg`
- `rounded-md`
- `rounded-sm`
- deliberate larger hero or canvas radii where the surface justifies it

Do not mix many radius styles on one screen.

### Typography Tokens

Current type tokens:

- display/editorial: `Cormorant Garamond`
- body/interface: `DM Sans`

Rules:

- use editorial typography only for page titles, hero surfaces, and high-value emotional anchors
- use body font for navigation, forms, tables, labels, status, and workflow text
- never use editorial typography inside dense operational UI like tables, form controls, filters, or inline actions

### Landing Page Type Scale

Marketing and landing surfaces should use a fixed six-step scale only:

- `H1`: `64px`
- `H2`: `42px`
- `H3`: `32px`
- `H4`: `20px`
- `H5`: `16px`
- `H6`: `14px`

Implementation rules:

- do not exceed these six sizes on landing pages
- do not invent oversized hero variants
- if hierarchy feels weak, adjust spacing, max-width, weight, or contrast before adding a new size
- keep body copy at `16px` or `14px` depending on density and emphasis

### Spacing Tokens

Adopt the same spacing rhythm defined in the design bible:

- `4`
- `8`
- `12`
- `16`
- `20`
- `24`
- `32`
- `40`
- `48`
- `64`

When using Tailwind, bias toward classes that map to that rhythm.

Avoid ad hoc spacing unless the layout genuinely breaks without it.

## Surface Hierarchy

Zania should have a predictable surface hierarchy.

### Level A: Page Shell

Examples:

- app background
- sidebar
- top shell
- page max width

Rules:

- calm background
- strong structural rhythm
- no competing decorative treatment

### Level B: Primary Focus Surface

Examples:

- dashboard hero
- next-action card
- budget health summary
- active workspace canvas

Rules:

- largest visual emphasis on the page
- one primary job only
- should answer what matters now

### Level C: Supporting Cards

Examples:

- upcoming items
- summary metrics
- recent activity
- secondary actions

Rules:

- lighter emphasis than Level B
- clear card structure
- no overloaded content stacks

### Level D: Reference Blocks

Examples:

- audit metadata
- historical logs
- secondary notes
- archived items

Rules:

- reduced contrast
- collapsible when appropriate
- never compete with action surfaces

## Layout Doctrine

### Dashboard Rule

Every dashboard should lead with:

1. the next action
2. the current state
3. the nearest deadline or risk

It should not lead with a list of modules.

### Card Density Rule

If a page has more than three equal-weight cards above the fold, it is probably too noisy.

Preferred moves:

- merge related cards
- demote reference content
- hide low-value details behind `More info`
- convert secondary cards into inline rows or compact bands

### Flow Rule

Each screen should read top-to-bottom in this order:

1. where am I
2. what matters now
3. what can I do
4. what else can I inspect

If that flow is unclear, the page needs restructuring.

## Page Templates

### Couple Workspace Page

Recommended structure:

1. page title and context
2. one dominant focus surface
3. one compact summary band
4. one guided next-step section
5. deeper detail hidden below a divider or disclosure

Primary emotional goal:

`I know what to do next.`

### Planner Workspace Page

Recommended structure:

1. portfolio-level context
2. urgent items
3. operational queue
4. recent changes
5. searchable reference data

Primary emotional goal:

`I can manage this quickly.`

### Vendor Workspace Page

Recommended structure:

1. today or upcoming work
2. payment or contract status
3. required actions
4. conversation and document context

Primary emotional goal:

`I know what is expected of me.`

## Component Doctrine

### Cards

Every card should contain, in this order when relevant:

1. title
2. primary fact
3. supporting context
4. action

Rules:

- do not place two primary facts in one card unless they are tightly related
- do not bury the main action below long explanation
- if a card needs more than one paragraph, it may need to split or collapse

### Buttons

Primary button:

- one per major region
- highest contrast
- reserved for the most important action

Secondary button:

- useful alternative action
- lower emphasis than primary

Tertiary action:

- text or ghost style
- used for low-risk navigation or optional action

Rules:

- never place two competing primary buttons side by side
- loading states must keep button footprint stable
- success should confirm without causing layout shift

### Forms

Rules:

- labels stay visible; do not rely on placeholders as labels
- required vs optional should be explicit
- help text should explain decisions, not restate the label
- validation should appear as close to the input as possible
- forms should be chunked into meaningful groups

Avoid:

- long uninterrupted vertical walls of fields
- hidden validation that only appears on submit without context

### Tables

Tables are for operational scanning, not storytelling.

Rules:

- make status and next action scannable first
- keep row actions consistent
- use chips and badges for state, not paragraph text
- do not force users into dense tables on mobile if a stacked card list is clearer

### Empty States

Every empty state should include:

1. what this area is for
2. why it matters
3. the first useful action

Do not use sterile emptiness as the default.

### Toasts

Toasts should be:

- short
- factual
- action-oriented when needed

Preferred structure:

- outcome
- implication if relevant
- next step if relevant

## Motion Rules

Use motion in three places only:

1. state change
2. hierarchy entrance
3. spatial interaction

### State Change

Examples:

- save complete
- status update
- item created
- item archived

### Hierarchy Entrance

Examples:

- page title fade
- card stagger on initial load
- assistant surface reveal

### Spatial Interaction

Examples:

- drag canvas
- drag timeline item
- place table object

Rules:

- default duration should remain within `200ms to 300ms`
- use opacity and short-distance transforms more than scale theatrics
- no bounce unless there is a highly specific interaction reason

## Contextual AI Doctrine

The assistant should appear as a planning layer, not a separate universe.

Good contextual AI surfaces:

- next-step recommendations
- budget risk interpretation
- vendor follow-up suggestions
- planning summaries
- meeting prep

Bad contextual AI surfaces:

- generic prompt dumping
- repeating visible page content without synthesis
- interrupting primary workflow for low-value suggestions

Rule:

The assistant should reduce interpretation effort, not add another interface to manage.

## Review Checklists

### Screen Review Checklist

Every new or revised screen should be reviewed against these questions:

- What is the one primary action or understanding this screen is meant to deliver?
- Is the highest-priority item visible above the fold?
- Are there too many equal-weight cards?
- Does the screen make the current state obvious?
- Does it show who is responsible where collaboration matters?
- Does every action confirm outcome clearly?
- Can supporting detail be collapsed or deferred?
- Does the screen still work on mobile without becoming a wall of stacked cards?
- Does the page respect the spacing and hierarchy system?
- Can a first-time user understand what to do in under three seconds?

### Component Review Checklist

- Does the component have a clear semantic purpose?
- Does it reuse existing token decisions?
- Are all interactive states defined?
- Does it preserve layout stability in loading and error states?
- Is color doing semantic work rather than decorative work?
- Is the component accessible by contrast, size, and state signaling?

## Implementation Guidance For Engineering

When implementing new UI:

1. start from the product state model
2. identify the single most important user decision
3. assign information to hierarchy levels
4. design the primary surface first
5. add supporting surfaces only if they serve the main flow
6. verify empty, loading, success, and error states

Do not start from:

- decorative layout ideas
- card count symmetry
- visual novelty for its own sake

## Immediate Adoption Plan

To operationalize this system, the next practical steps should be:

1. audit the current dashboards against the screen review checklist
2. normalize token usage where pages are still using one-off colors or spacing
3. define a shared set of page primitives:
   - page header
   - focus card
   - compact metrics band
   - status badge
   - info tip
   - empty state
4. resolve the typography doctrine conflict explicitly
5. add design review to the definition of done for UI work

## Final Rule

If a screen is visually impressive but makes the wedding feel harder to manage, it failed.

If a screen is quiet, clear, and decisive enough that the user immediately knows what matters, it is on the right path.
