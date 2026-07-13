# Free-Tier Abuse Prevention

This change set adds the first backend-enforced guardrails for the Intimate free couple plan.

## Included

- Soft deletion for wedding workspaces via `soft_delete_wedding_workspace`.
- Archive flow via `archive_wedding_workspace`.
- Lifecycle history in `wedding_lifecycle_history`.
- Account-purpose capture on signup and in profile settings.
- Free-plan wedding creation enforcement inside `create_wedding_workspace`.
- One-time low-activity replacement allowance for mistaken free weddings.
- Meaningful-wedding detection helpers.
- Professional-use risk scoring on `profiles`.
- New-device OTP verification with device-session trust enforcement.
- Device session management UI with sign-out-other-devices support.
- Backend collaboration checks for:
  - planner link requests
  - vendor connection requests
  - workspace vendor invites
  - committee invites
  - shared task assignment attempts
- Configurable enforcement flags in `zania_feature_flags`.
- Device/session audit and verification data:
  - `device_sessions`
  - `device_verification_challenges`
  - `otp_audit_events`
  - `account_audit_events`
- Admin review operations:
  - risk queue and account-level evidence
  - lifecycle and audit history
  - manual approval, restriction, and trusted-device reset actions
  - automatic pending-review queueing for unverified high-risk accounts
  - human decisions preserved for approved, restricted, and verified-couple accounts

## Enforcement boundary

High-risk scoring does not automatically restrict, delete, or suspend an account. It moves an unreviewed, unverified account to `pending`, records why it happened, and leaves the current workspace usable while an administrator reviews the evidence.

## Recommended next steps

1. Validate automatic queueing with a controlled high-risk test account.
2. Confirm approved and verified-couple accounts remain unchanged after risk recalculation.
3. Add configurable reviewer notification delivery if queue volume warrants it.
4. Extend trusted-device enforcement deeper into non-RPC read paths if hard blocking beyond app-level gating plus guarded RPCs/Edge Functions becomes necessary.
