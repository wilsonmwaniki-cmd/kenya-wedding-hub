# Received documents and free couple invoice payments

Released to production 9 September 2026.

- Production deployment: `dpl_4jnqm2ehmRDYrynpRZBXLGwTFpAR` (READY).
- Route: `/received-documents`, linked as Documents in the couple sidebar.
- Lists non-draft quotes, invoices, receipts and contracts shared with the signed-in account's verified email. Expired/revoked links are excluded. It is an account inbox, not a wedding-wide document feed.
- Narrow authenticated RPC returns display fields and existing share links; no additional owner-table SELECT/UPDATE privileges were granted. The definer implementation is in the private schema behind an invoker wrapper.
- Invoice payment eligibility no longer requires a paid couple subscription. Existing wedding connection, professional entitlement and verified payout checks remain.
- No live-pilot allowlist, Paystack key, fee or payment-mode settings changed in this release. The original Gmail payer remains the only pilot payer; the invoice's current @me.com recipient is not added automatically.
- No charge, payout, refund or invoice-recipient change was initiated.

## Verification

- Production build passed; all 227 tests passed (54 files).
- Authenticated recipient RPC returns INV-2026-0005 for its saved @me.com recipient.
- Eligibility for that free recipient changes from `couple_upgrade` to `available`; actual live initiation remains independently gated by the Edge Function.
- Gmail account cannot list this other recipient's invoice or read its owner-table row.
- Anonymous role cannot execute either received-documents function.
- Security advisor was reviewed. Existing project-wide findings remain, including mutable search paths on other functions and disabled leaked-password protection; no finding targets the new inbox functions.

Existing security findings: https://supabase.com/docs/guides/database/database-linter and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Staging was not changed, as requested.

Subsequent live-test configuration update (9 September): the owner explicitly approved adding the verified @me.com recipient to the payer allowlist. Both approved payer IDs were verified against the saved configuration digest. This does not change the inbox release or enable general rollout. No payment was initiated.
