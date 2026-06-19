# Workspace Vendor Invites Deploy Candidate

This document defines the minimum safe frontend deploy candidate required to match the live Supabase rollout for:

- `workspace_vendor_invites`
- `update_vendor_workspace_record`
- `update_vendor_workspace_task`
- `send-workspace-vendor-invite`
- `handle-connection-response`
- `send-connection-notification`

## Goal

Bring the production frontend into alignment with the backend features that are already live on Supabase without bundling the full dirty worktree.

## Deploy Scope

Include these tracked files:

- `src/App.tsx`
- `src/contexts/AuthContext.tsx`
- `src/integrations/supabase/types.ts`
- `src/pages/Auth.tsx`
- `src/pages/AuthCallback.tsx`
- `src/pages/ProfileSettings.tsx`
- `src/pages/VendorDashboard.tsx`
- `src/pages/Vendors.tsx`

Include these dependent untracked files:

- `src/pages/VendorClaim.tsx`
- `src/lib/vendorClaimState.ts`
- `src/lib/workspaceVendorInvites.ts`
- `src/lib/vendorWorkspaceUpdates.ts`
- `src/lib/authRouting.ts`
- `src/lib/names.ts`
- `src/lib/passwords.ts`
- `src/lib/featureFlags.ts`
- `src/components/FormFeedback.tsx`
- `src/components/AppLoadingSkeletons.tsx`
- `src/components/AppleAuthButton.tsx`
- `src/components/AppErrorBoundary.tsx`
- `src/components/AppAnalytics.tsx`
- `src/components/WorkspaceProviders.tsx`

## Explicitly Out Of Scope

Do not include for this deploy candidate unless they are separately reviewed and intentionally added:

- landing redesign work
- pricing page/content work
- assistant UI work
- public brand/icon/manifest assets
- docs-only changes
- unrelated Supabase function edits
- unrelated migrations

## Why This Scope Must Ship Together

- `src/pages/Vendors.tsx` creates and sends workspace vendor invites.
- `src/pages/VendorDashboard.tsx` uses the live vendor workspace RPCs.
- `src/pages/VendorClaim.tsx`, `src/pages/Auth.tsx`, `src/pages/AuthCallback.tsx`, and `src/pages/ProfileSettings.tsx` cooperate to preserve and resume claim flow state.
- `src/App.tsx` wires the `VendorClaim` route.
- `src/integrations/supabase/types.ts` must reflect the live schema and RPCs.
- `src/contexts/AuthContext.tsx` participates in auth-entry and redirect behavior used by the claim flow.

## Pre-Deploy Gates

1. Create a clean deploy branch from the current release base.
2. Copy only the files in the deploy scope onto that branch.
3. Run a production build.
4. Verify Vercel env vars and Supabase auth callback settings.
5. Ship preview first.

## Preview QA Script

Run these in preview before production:

1. Signed-out public load
   - Open `/`
   - Open `/sign-in`
   - Open `/vendor-claim`
   - Confirm no blank screen or immediate redirect loop

2. Couple vendor invite draft flow
   - Sign in as a couple or planner with a wedding workspace
   - Go to `/vendors`
   - Create or open a vendor entry
   - Add invite contact email
   - Send workspace vendor invite
   - Confirm success UI and no function invoke error

3. Invite email link flow
   - Open the emailed `/vendor-claim?...claim_type=workspace_invite` link
   - Confirm the claim page renders the expected state
   - If signed out, confirm the app preserves claim context through auth

4. Claim through auth
   - From the claim flow, sign in with an existing vendor account
   - Repeat with sign-up if that path is enabled for testing
   - Confirm auth returns the user to the claim continuation path rather than a generic dashboard

5. Claimed vendor dashboard flow
   - Open `/vendor-dashboard`
   - Confirm workspace invite data appears
   - Update relationship status
   - Update payment state
   - Complete or reopen an allowed linked task
   - Confirm no RPC permission or shape errors

6. Profile settings recovery path
   - Open `/settings` as a vendor with pending or recent claim context
   - Confirm vendor claim continuation does not get lost

7. Regression checks
   - Normal couple sign-in still works
   - Normal vendor sign-in still works
   - Normal planner sign-in still works
   - Auth callback completes without looping

## Production Smoke Test

After production deploy:

1. Open `/vendor-claim` directly
2. Send one real workspace vendor invite
3. Open the invite link
4. Complete one vendor claim
5. Confirm one vendor dashboard update reaches the database

## Suggested Deployment Order

1. Confirm Supabase function env vars remain valid.
2. Create the narrow frontend deploy branch.
3. Build locally.
4. Deploy preview.
5. Run the preview QA script.
6. Promote to production.
