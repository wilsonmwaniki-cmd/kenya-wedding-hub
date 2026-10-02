# Zania Design Bible

## Version

`1.0`

## Core Idea

`Designing calm in the middle of wedding chaos.`

## What This Document Is

This is not a style guide alone.

It is the product-design philosophy for Zania.

It defines:

- how Zania should feel
- why the interface should feel that way
- how product, design, and engineering should make tradeoffs
- what standards a screen must meet before it is considered done

The goal is not to make Zania merely attractive.

The goal is to make wedding planning feel controlled, clear, and collaborative.

## The Product Philosophy

### What is Zania?

Zania is not just a wedding planning app.

Zania is a `Wedding Operating System`.

It exists to reduce chaos by bringing every person involved in a wedding into one calm, shared workspace.

Every design decision should reinforce one emotional outcome:

`This wedding is under control.`

If a feature increases stress, confusion, or decision fatigue, it should be redesigned or removed.

## The North Star

`Zania is invisible.`

The highest compliment someone can give is not:

`Your app is beautiful.`

It is:

`Planning my wedding felt surprisingly easy.`

If every feature, animation, color, layout, and workflow moves the user closer to that feeling, the design is doing its job.

## The Five Principles

### 1. Calm Before Celebration

Weddings are emotional.

The software should not be.

The interface must feel quiet, spacious, and reassuring.

It should evoke:

`I've got this.`

It should never evoke:

`Oh no...`

This means:

- large whitespace
- few distractions
- restrained use of color
- clean layouts
- slow, deliberate animation

### 2. Show Only What Matters

Do not overwhelm the user.

Prioritize the next meaningful action.

Every screen should answer:

`What needs my attention right now?`

Everything else is secondary.

If something is not actionable yet, consider hiding it until it becomes relevant.

### 3. Every Action Builds Confidence

Users should never wonder:

`Did it work?`

Every action needs immediate, clear feedback.

Examples:

- guest added
- budget updated
- vendor notified
- planner accepted
- document uploaded

The system should always confirm the outcome.

### 4. Collaboration Should Feel Natural

Wedding planning is not individual work.

Every collaborative surface should make the following obvious:

- who is involved
- who made the last change
- what is waiting
- what is completed
- what needs follow-up

Nothing important should feel isolated from the people responsible for it.

### 5. Simplicity Wins

If two designs solve the same problem, choose the simpler one.

Always.

Simplicity is not the absence of capability.

It is the removal of unnecessary effort.

## Visual System

### Spacing

Whitespace is not empty.

It is breathing room.

Use this spacing system only:

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

Do not invent arbitrary spacing values unless there is a strong system-level reason.

### Grid

Use a `4-point grid`.

Consistency creates subconscious trust.

### Typography

Use one primary interface font.

Current standard:

- `Montserrat`

The font must be:

- modern
- highly legible
- neutral
- professional

Do not use serif fonts in the product UI.

No decorative type for interface UI.

The wedding provides the beauty.

The interface provides clarity.

### Typography Hierarchy

Use semantic hierarchy, not size alone.

Core levels:

- `Display`: large page titles
- `Heading`: section titles
- `Body`: primary information
- `Caption`: supporting information

Support the hierarchy with:

- weight
- spacing
- layout
- contrast

Recommended rules:

- display letter spacing: `-2% to -3%`
- display line height: `110% to 120%`
- body line height: `140% to 160%`

### Landing Page Type Scale

Landing pages should not exceed six text sizes.

Use this scale:

- `H1`: `64px`
- `H2`: `42px`
- `H3`: `32px`
- `H4`: `20px`
- `H5`: `16px`
- `H6`: `14px`

Rules:

- do not introduce extra display sizes for marketing pages
- use weight, spacing, and layout before introducing visual complexity
- keep this scale restrained so the brand feels deliberate, not noisy

## Color Philosophy

Most of Zania should not rely on color.

Color is communication.

It is not decoration.

### Base Interface Palette

- white
- off-white
- light gray
- dark gray
- black

### Semantic Colors

#### Green

Use for:

- completed
- paid
- confirmed
- finished

#### Blue

Use for:

- information
- neutral actions
- links
- trust signals

#### Yellow

Use for:

- warning
- upcoming deadlines
- needs attention

#### Red

Use for:

- errors
- over-budget states
- payment failure
- missed deadlines

#### Brand Color

Use the Zania brand color only for:

- primary actions
- selected states
- brand emphasis
- important navigation moments

If everything is highlighted, nothing is highlighted.

## Depth, Borders, and Surfaces

### Shadows

Depth should whisper, not shout.

Use:

- high blur
- low opacity
- small offset

Avoid harsh, obvious shadows.

### Borders

Prefer borders over shadows for structure.

Use:

- light gray borders
- soft separation
- rounded corners

Cards should feel gently defined, not boxed in aggressively.

## Icons

Icons follow typography.

Recommended sizing:

- `24px` text context -> `24px` icon
- `20px` text context -> `20px` icon

Icons should never dominate the interface.

They support recognition, not decoration.

## Component States

### Buttons

Every button must define:

- default
- hover
- pressed
- disabled
- loading
- success

Buttons should transform while loading.

They should not simply disappear.

### Inputs

Every input must define:

- empty
- focused
- typing
- completed
- warning
- error
- disabled

Users should always understand the current field state.

## Motion

Motion must communicate state change.

It must not entertain for its own sake.

Every animation should answer:

`What just happened?`

Examples:

- guest added -> card or row enters clearly
- payment received -> counter updates
- task completed -> completion state transitions visibly
- vendor accepted -> toast or status shift confirms outcome

Motion standards:

- duration: `200ms to 300ms`
- easing: natural, soft
- no bounce-based motion by default

## Information Hierarchy

All information belongs to one of four levels:

### Level 1

Needs action now

### Level 2

Coming soon

### Level 3

Completed

### Level 4

Reference information

If everything carries the same visual weight, the user will feel overwhelmed.

## Dashboard Philosophy

The dashboard is not a menu.

It is today's assistant.

Do not lead with a dump of modules.

Lead with:

- today's priorities
- recent activity
- upcoming deadlines
- pending approvals
- visible progress

Everything else can be one tap away.

## Role-Specific Experiences

### Couples

Design for emotional clarity first.

Prioritize:

- countdown
- progress
- budget
- guest list
- next milestone

Over time, the couple's wedding photo should become the emotional centerpiece.

### Wedding Planners

Design as a command center.

Prioritize:

- today's weddings
- urgent tasks
- vendor communication
- payments
- timeline
- recent activity

Planner views can be denser, but they must still remain structured and fast.

### Vendors

Design as an action center.

Prioritize:

- today's work
- outstanding invoices
- upcoming deliveries
- messages
- contracts

Vendor UI should be simple, direct, and commercially useful.

## Empty States

Empty states should encourage.

They should never punish or shame.

Do not write:

`No Guests`

Prefer:

`Your guest list begins with the people you can't imagine celebrating without. Add your first guest.`

Do not write:

`No Vendors`

Prefer:

`Every unforgettable wedding starts with one trusted vendor. Find or invite your first vendor.`

## Notifications

Every notification should answer:

- what happened
- why it happened
- what the user should do next

Do not write:

`Payment Failed`

Prefer:

`The payment couldn't be processed. Try again or choose another payment method.`

## Space & Table Plan Principle

This feature deserves premium treatment.

It should feel closer to interior design software than a generic form flow.

Required qualities:

- snap to grid
- smooth movement
- visible guest counts
- collision awareness
- print layouts
- drag clarity
- undo
- redo
- strong spatial rhythm

This is a high-value artifact surface for Zania and should be treated accordingly.

## Card Design

Cards must never feel crowded.

Every card should have clear internal structure:

- title
- primary information
- supporting information
- actions
- whitespace

Cards should breathe.

If a card looks busy, it is not finished.

### Tonal Editorial Surfaces

Zania surfaces should feel composed rather than assembled from generic components.

Use:

- warm porcelain, oat, clay, ink, muted blue, and sage tones
- typography, whitespace, and hairline rules to create hierarchy
- one dominant surface per hierarchy level
- attached action bands when an action belongs to the entire surface
- status lines, metadata rows, and small edge accents for structured information
- restrained corner radii and almost imperceptible shadows

Avoid:

- stacking multiple rounded cards inside another rounded card
- making every information group look independently clickable
- repeating the same white card treatment across an entire screen
- using capsules as decorative headings
- floating action areas that could be structurally attached to their content

Within a card, prefer a rule and spacing before introducing another container. Tonal contrast should group related information without making the interface feel boxed in.

### Pill Policy

Pills are controls, not decoration.

Pills are appropriate for:

- segmented navigation
- billing cadence and other mutually exclusive switches
- active filters
- removable selection chips
- compact controls whose shape communicates interaction

Pills are not appropriate for:

- plan names
- roles or ownership
- categories
- dates
- counts
- document states
- payment states
- decorative headline fragments

Present this information with overlines, status lines, metadata rows, semantic dots paired with text, or edge accents. A status must always remain understandable without relying on color alone.

## Photos and Imagery

When using photos, never place text directly on an image without protection.

Always use one or more of:

- gradient overlay
- blur treatment
- dark fade

Readability always wins.

## Accessibility

Contrast takes priority over aesthetics.

Standards:

- minimum touch target: `44px`
- minimum body text size: `14px`
- color is never the only indicator of state

Accessibility is not a polish layer.

It is part of clarity.

## Writing Style

The product voice should be:

- friendly
- professional
- clear
- calm

Avoid robotic phrasing.

Avoid exaggerated cheerfulness.

Do not write:

`Awesome!`

Prefer:

`Guest successfully added.`

Do not write:

`Oops!`

Prefer:

`We couldn't save your changes. Try again.`

## Success Metric For Design

Good design is not measured by beauty alone.

It is measured by confidence.

A strong screen lets the user answer within three seconds:

- what happened?
- what's next?
- am I okay?

## The Zania Test

Every screen must pass these questions:

- does this reduce stress?
- does this reduce decisions?
- does this increase confidence?
- does this improve collaboration?
- can the screen breathe?

If the answer is no, redesign it.

## Final Principle

The wedding is the event.

Zania is the quiet confidence behind it.

People should not remember the interface for its own sake.

They should remember how organized they felt.

## Practical Product Rule

When in doubt:

1. remove visual noise
2. surface the next action
3. confirm outcomes clearly
4. show who is responsible
5. hide secondary detail until needed

That is how the software disappears and the planning feels easier.
