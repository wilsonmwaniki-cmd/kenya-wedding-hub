# Zania Tonal UI Migration Inventory

This inventory tracks the progressive removal of decorative pills, repeated nested cards, and low-value status capsules. It supports the design bible's tonal editorial direction without changing workflows globally.

## Rules

- Keep pills for controls: segmented navigation, filters, billing cadence, removable chips, and compact input selections.
- Replace informational pills with typography, semantic dots or rails, `StatusLine`, or `MetaRow`.
- Use one dominant tonal surface per hierarchy level.
- Prefer dividers and spacing over a card inside another card.
- Preserve semantic colour: red for blocked or destructive states, amber for attention, green for confirmed or complete, and blue for neutral information.

## Migrated

- Dashboard attention and recent-change surfaces.
- Couple settings plan, ownership, and lifecycle surfaces.
- Shared budget and task category headers through `HierarchyGroup`.
- Couple vendor category headers.
- Task-row category, privacy, and urgency metadata.
- Task visible-count summary, suggested defaults, and selected-task metadata.
- Budget related-task states and vendor-shortlist metadata.
- Pricing section eyebrows, plan context, and collaboration states.
- Planner access, verification, committee role, and permission states.
- Planner and vendor document attention, library, sharing, contract, template, and readiness states.
- Device-session status and session list.
- Mobile workspace navigation.

## Next Priority

### Vendor Workspaces

- Vendor detail header selection, payment, and contract badges.
- Vendor task and milestone metadata.
- Vendor updates, suggestions, and benchmark summaries.
- Vendor directory cards and shortlist comparison rows.

### Settings And Access

- Specialty and service-area chips remain controls and should not be migrated.

### Documents

- Public quote, invoice, receipt, and contract share pages.
- Document relationship timelines.
- Document creation and payment form controls remain controls and should not be migrated.

### Remaining Product Areas

- Admin portal.
- Space and table plan.
- Timeline and timeline sharing.
- Contributions and guests.
- Professional network.
- Vendor and planner dashboards.
- Public planner and vendor directory/profile cards.

## Verification Checklist

- No informational status is styled as a clickable control.
- Long labels wrap without narrowing the primary title.
- Mobile layouts fit at 320px without horizontal clipping.
- Semantic meaning is not conveyed by colour alone.
- Focus, hover, and expanded states remain clear.
- Existing routing, mutations, and form controls are unchanged.
