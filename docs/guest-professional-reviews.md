# Guest professional reviews

Zania supports verified guest reviews for approved vendor listings and verified planner profiles. A vendor or planner sends an invitation from `/reviews`; the couple receives a private `/review/:token` link and can submit one review without creating an account.

## Trust and privacy controls

- Review tokens contain 256 bits of randomness. Only a SHA-256 hash is stored.
- Invitations expire after 30 days, are single-use, and can be revoked by their owner.
- One active or completed invitation is allowed per email address and professional listing.
- Couple email addresses remain in the protected invitation table and are not exposed with public reviews.
- Anonymous clients cannot insert reviews directly. Submission is handled by the `professional-reviews` Edge Function and an atomic service-role-only database function.
- Vendors and planners can create invitations only for their own approved or verified listing.
- Invitation creation is limited to 20 successful sends per account in a rolling 24-hour window.
- Published reviews are publicly readable; hidden and flagged reviews are visible only to the listing owner and administrators.

## Rollout order

1. Reconcile the local migration directory with the linked Supabase migration history.
2. Apply `20260821083939_guest_professional_reviews.sql`.
3. Deploy the `professional-reviews` Edge Function with JWT verification disabled in `supabase/config.toml`. The function performs its own authentication for professional actions and token validation for public actions.
4. Confirm `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `PUBLIC_APP_URL` are configured for the function.
5. Deploy the frontend.
6. Test one vendor invitation and one planner invitation end to end, including expiry/reuse rejection and public rating aggregation.

Do not deploy the frontend before the migration and Edge Function; the Reviews workspace depends on both.
