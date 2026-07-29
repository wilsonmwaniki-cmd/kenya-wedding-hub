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
- Device-session status and session list.
- Mobile workspace navigation.

## Next Priority

### Vendor Workspaces

- Vendor detail header selection, payment, and contract badges.
- Vendor task and milestone metadata.
- Vendor updates, suggestions, and benchmark summaries.
- Vendor directory cards and shortlist comparison rows.

### Tasks

- Add-task template defaults.
- Visible-count summary.
- Selected-task metadata and status.

### Settings And Access

- Planner access and verification states.
- Committee member roles and permissions.
- Specialty and service-area chips remain controls and should not be migrated.

### Documents

- Quote, invoice, receipt, and contract state badges.
- Request and approval rows.
- Document relationship timelines.

### Remaining Product Areas

- Admin portal.
- Pricing and upgrade cards.
- Space and table plan.
- Timeline and timeline sharing.
- Contributions and guests.
- Professional network.
- Vendor and planner dashboards.

## Verification Checklist

- No informational status is styled as a clickable control.
- Long labels wrap without narrowing the primary title.
- Mobile layouts fit at 320px without horizontal clipping.
- Semantic meaning is not conveyed by colour alone.
- Focus, hover, and expanded states remain clear.
- Existing routing, mutations, and form controls are unchanged.
