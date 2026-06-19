# Wedding-Day Operations Scaling Plan

## Why this exists

Zania's hardest scaling moment is not total registered users. It is concurrent operational usage on wedding days:

- many weddings active at the same time
- many staff devices per wedding
- bursts of guest check-ins
- rapid timeline coordination updates
- repeated reads of the same guest, seating, and execution data

This document defines a scale-ready architecture that keeps costs relatively low while protecting the wedding-day experience.

## Current pressure points in the app

These flows already exist, but they are still shaped more like normal CRUD than burst-tolerant operations:

- Guest check-in writes directly to `guests`
  - [src/components/guests/GuestCheckIn.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/components/guests/GuestCheckIn.tsx)
- Timeline management is loaded and mutated as a normal workspace module
  - [src/pages/Timeline.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/pages/Timeline.tsx)
- Invite delivery already has basic abuse guardrails and function logging
  - [supabase/functions/send-guest-invite/index.ts](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/supabase/functions/send-guest-invite/index.ts)

Those are solid foundations, but the wedding-day path should be treated as a separate operational mode.

## Architecture principle

Split Zania into two modes:

- Planning mode
  - rich CRUD
  - broader reads and edits
  - lower concurrency pressure
- Wedding-day operations mode
  - append-first writes
  - per-wedding live coordination
  - short-lived cached reads
  - idempotent mutation handling
  - strict prioritization of high-value actions

## Recommended stack

Keep:

- Supabase Postgres for source-of-truth relational data
- Supabase Auth and RLS
- Vercel for the app shell and preview environments

Add:

- Cloudflare R2 for files, PDFs, gallery assets, exports, and large attachments
- Redis for rate limiting, dedupe, ephemeral locks, hot counters, and queue-friendly state

Do not migrate away from Supabase yet. The cost-sensitive move is to change traffic shape before changing primary infrastructure.

## Design goals

1. Guest check-in should stay fast under bursts.
2. Timeline coordination should avoid noisy full-table subscriptions.
3. Double taps and duplicate writes should be harmless.
4. Noncritical work must never block operational writes.
5. Each wedding should behave like an isolated operational shard.

## Proposed wedding-day data model

### 1. Check-in events

Add a dedicated append table:

`guest_check_in_events`

Suggested columns:

- `id uuid primary key`
- `wedding_id uuid not null`
- `guest_id uuid not null`
- `action text not null`
  - `check_in`
  - `undo_check_in`
- `performed_by_user_id uuid null`
- `performed_by_device_id text null`
- `idempotency_key text not null`
- `source text not null default 'app'`
- `created_at timestamptz not null default now()`
- `metadata jsonb not null default '{}'::jsonb`

Suggested indexes:

- `(wedding_id, created_at desc)`
- `(guest_id, created_at desc)`
- unique `(wedding_id, idempotency_key)`

Why:

- preserves the operational audit trail
- absorbs bursts safely
- makes repeated taps dedupeable
- supports offline or retry-friendly clients later

### 2. Check-in summary

Keep the current `guests.checked_in` and `guests.checked_in_at` fields as the fast read model.

Pattern:

- write event first
- update guest summary second
- emit lightweight realtime message third

This gives the UI a simple read model without losing event fidelity.

### 3. Timeline operation events

Add:

`timeline_operation_events`

Suggested columns:

- `id uuid primary key`
- `wedding_id uuid not null`
- `timeline_id uuid not null`
- `timeline_event_id uuid null`
- `operation_type text not null`
  - `event_created`
  - `event_updated`
  - `event_reordered`
  - `event_completed`
  - `event_note_added`
  - `event_delay_logged`
- `performed_by_user_id uuid null`
- `idempotency_key text not null`
- `payload jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Suggested indexes:

- `(wedding_id, created_at desc)`
- `(timeline_id, created_at desc)`
- unique `(wedding_id, idempotency_key)`

This becomes the operational log for event-day coordination without forcing every client to diff the full timeline repeatedly.

## Proposed runtime flow

### Guest check-in flow

Current weak point:

- client toggles `guests.checked_in` directly

Recommended flow:

1. Client sends `guest_id`, `wedding_id`, `action`, and `idempotency_key` to an Edge Function.
2. Function validates:
   - authenticated user
   - access to this wedding
   - device/user rate limits
   - guest belongs to this wedding
3. Function writes to `guest_check_in_events`.
4. Function updates `guests.checked_in` and `guests.checked_in_at`.
5. Function emits a small per-wedding realtime broadcast:
   - `guest_checked_in`
   - `guest_check_in_undone`
6. UI updates optimistically and reconciles with the response.

### Timeline operations flow

Recommended flow:

1. Timeline ops screens call an Edge Function or RPC for critical live mutations.
2. Server validates role, wedding, and current state.
3. Server writes a timeline operation event.
4. Server updates the canonical `timeline_events` row if needed.
5. Server emits a per-wedding broadcast message with only the minimal payload.

### Async follow-up work

Do not block operational writes on:

- email
- SMS or WhatsApp later
- analytics events
- AI recommendations
- export generation
- audit enrichment

Those should run after the critical write succeeds.

## Realtime strategy

Do not use broad Realtime patterns for wedding-day traffic.

Use:

- one operational channel per wedding
- optional narrower channels per module if needed

Examples:

- `wedding:{wedding_id}:ops`
- `wedding:{wedding_id}:checkin`
- `wedding:{wedding_id}:timeline`

Recommended message types:

- `guest_checked_in`
- `guest_check_in_undone`
- `timeline_event_updated`
- `timeline_event_reordered`
- `ops_status_changed`
- `user_joined_ops`
- `user_left_ops`

Use Broadcast or Presence for:

- who is online
- who is editing
- which team member is handling a guest or moment

Do not use Postgres changes as the only operational transport for all clients.

## Caching strategy

### Cache aggressively

Good candidates:

- guest roster snapshots
- vendor contact summaries
- wedding-day run sheets
- timeline read models
- seat and table plan snapshots

### Avoid shared cache for

- user-specific permissions
- active auth state
- mutation responses
- private cross-wedding operational data

### Read model targets

Build light wedding-day views or RPCs that return:

- total confirmed guests
- checked-in count
- recent arrivals
- next timeline block
- vendor contact quick list
- unresolved operational alerts

This avoids loading full workspace data on every screen refresh.

## Redis role in this architecture

Redis is not the source of truth. It is the traffic shock absorber.

Use Redis for:

- idempotency keys
- short-lived check-in locks
- burst rate limits
- temporary coordination state
- hot counters per wedding
- queue staging for noncritical tasks

Suggested keys:

- `ops:checkin:dedupe:{wedding_id}:{idempotency_key}`
- `ops:checkin:lock:{wedding_id}:{guest_id}`
- `ops:timeline:dedupe:{wedding_id}:{idempotency_key}`
- `ops:presence:{wedding_id}`
- `ops:rate:{wedding_id}:{user_id}`

TTL guidance:

- idempotency keys: `5-15 minutes`
- per-guest locks: `10-30 seconds`
- presence state: `30-90 seconds`

## Files and storage

Move these away from the core transactional path:

- contracts
- receipts
- invoices
- exports
- gallery media
- floor plans
- seating graphics
- vendor attachments

Recommended home:

- Cloudflare R2

Benefits:

- cheaper storage profile
- free Internet egress
- reduces pressure on backend bandwidth

## Prioritized operational surfaces

The first wedding-day surfaces to harden should be:

1. guest check-in
2. live timeline
3. team presence and handoff state
4. read-only run-of-show dashboard
5. vendor quick contacts and notes

Everything else can remain in planning-mode architecture longer.

## Proposed implementation phases

### Phase 1: Foundation

1. Add `guest_check_in_events`
2. Add `timeline_operation_events`
3. Add wedding-day Edge Functions:
   - `guest-check-in`
   - `timeline-ops`
4. Add idempotency handling
5. Add operational function logging

### Phase 2: Realtime and caching

1. Create per-wedding operational broadcast channels
2. Add presence support for active ops users
3. Add React Query caches for operational dashboards
4. Add lightweight wedding-day summary RPCs

### Phase 3: Redis protection

1. Add Redis-backed dedupe keys
2. Add Redis-backed rate limiting
3. Add per-guest temporary locks
4. Add optional queue handoff for noncritical side effects

### Phase 4: Storage offload

1. Move large assets to R2
2. Convert document and media delivery to signed URLs or controlled public URLs
3. Keep only metadata in Postgres

### Phase 5: Hardening

1. Add synthetic load tests for Saturday spikes
2. Add dashboards for:
   - concurrent operational weddings
   - check-in latency
   - function error rate
   - duplicate attempt rate
   - timeline mutation latency
3. Add emergency fallback views for degraded mode

## Capacity model to design for first

Initial target:

- `50` simultaneous active weddings
- `10` active devices per wedding
- `500` concurrent live operational devices
- `1-5` writes per second during bursts on busy weddings

That is already enough to justify dedicated wedding-day flows.

Second target:

- `100+` simultaneous active weddings
- `1,000+` concurrent operational devices

At that point, Redis and stricter realtime discipline become much more important.

## What should not happen on wedding day

Avoid:

- direct client writes for hot operational flows
- many clients subscribing to broad database change feeds
- loading the whole workspace to perform a single check-in
- heavy media delivery from the same path as live operations
- duplicate taps creating duplicate state transitions

## Immediate repo-aligned next steps

1. Refactor [src/components/guests/GuestCheckIn.tsx](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/components/guests/GuestCheckIn.tsx) to call a dedicated Edge Function instead of updating `guests` directly.
2. Add a migration for `guest_check_in_events`.
3. Add a migration for `timeline_operation_events`.
4. Create a wedding-day summary RPC for guest and timeline operations.
5. Add a preview-only wedding-day operations dashboard to test burst behavior safely before exposing it broadly.

## Recommendation

For Zania, the most cost-effective scale-ready path is:

- keep Supabase as the relational core
- add Redis for operational traffic control
- move heavy files to R2
- redesign wedding-day writes as append-first, idempotent, and per-wedding scoped

That approach is much safer and cheaper than a premature full backend migration.
