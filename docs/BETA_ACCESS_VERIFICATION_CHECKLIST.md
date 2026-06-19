# Beta Access Verification Checklist

Use this against the real Supabase project after applying the latest migrations.

## Preconditions

- Apply:
  - `20260602193000_function_event_logs_and_beta_snapshot.sql`
  - `20260602204500_invite_abuse_guardrails.sql`
  - `20260602213000_public_token_guardrails.sql`
- Confirm edge-function secrets are present:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`
  - `STRIPE_SECRET_KEY`
  - `OPENAI_API_KEY`
  - `PUBLIC_APP_URL`

## Accounts To Test

- Couple owner A
- Couple owner B / partner invitee
- Committee chair
- Committee member
- Planner
- Vendor
- Admin
- Signed-in unrelated user
- Anonymous browser session

## Wedding Workspace RLS

- Couple owner can view and update own wedding workspace.
- Committee chair can manage memberships/invites only where intended.
- Committee member can not start couple checkout or alter owner-only records.
- Unrelated signed-in user can not read another wedding's memberships, invites, tasks, guests, budget, vendors, or entitlements.
- Admin-only RPCs fail for non-admin accounts.

## Auth And Onboarding

- New couple account without workspace is forced through wedding setup.
- Join-wedding invite flow lands in the right workspace and role.
- Expired or revoked invite can not be accepted.
- OAuth callback without complete metadata still lands on a safe route.

## Billing And Entitlements

- Couple owner can start checkout for own wedding.
- Non-owner active member gets blocked from couple checkout.
- Rapid repeated checkout attempts hit the new guardrail instead of creating endless sessions.
- Successful checkout sync updates entitlements/trial state as expected.
- Failed checkout sync is visible in admin ops.

## Invite Abuse Protection

- Guest invite only works for a guest inside the caller's accessible workspace.
- Tampering with `guestId` for another wedding fails.
- Re-sending the same guest invite immediately is blocked.
- Burst-sending many guest invites eventually rate-limits.
- Wedding invite resend cooldown works.

## AI Gating

- Free/ineligible account is blocked from AI.
- Paid/trial account can use AI.
- Oversized AI payload is rejected cleanly.
- Burst AI requests hit the short-window rate limit.
- AI failures show up in admin ops.

## Public Token Surfaces

- Valid RSVP link opens and records access.
- Revoked or expired RSVP link shows invalid/inactive.
- Rapid RSVP flip-flops are throttled.
- Valid timeline share link opens.
- Revoked or expired timeline share link returns nothing.
- Valid contribution share link opens.
- Revoked or expired contribution share link returns nothing.
- Valid commercial document share link opens.
- Revoked or expired commercial document share link returns nothing.

## Admin Visibility

- `Ops & Beta` shows recent function failures.
- `Ops & Beta` snapshot reflects trial/entitlement counts.
- Token/access issues can be inspected in `public_token_access_logs`.
- Invite/checkout/AI issues can be inspected in `function_event_logs`.
