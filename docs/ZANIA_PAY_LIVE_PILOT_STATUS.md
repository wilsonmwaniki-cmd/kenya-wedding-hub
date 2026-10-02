# Zania Pay live pilot status

## Current status — 28 September 2026

The live payment and payout pilot is complete. The owner supplied the Paystack payout record and confirmed receipt of KES 1,000 in the vendor's M-Pesa account. The verified flow is:

Payment → Paystack split → vendor payout → vendor M-Pesa received.

The successful pilot payment remained unrefunded. This is evidence for a small controlled rollout to selected paying vendors; the next intended participant is the owner's second paying vendor. It does not mean general access has already been enabled.

Evidence was reviewed in the Codex chat **“Simplify application usability”** on 28 September 2026 (chat ID `01a0044e-72c2-7e11-80a8-6a60599d1bb9`), including the payout dated 26 September and the owner's receipt confirmation. This supersedes the incomplete-pilot statements in the historical preparation notes below. Do not reopen collection or payout verification as unfinished pilot work.

## Historical preparation notes — 9 September 2026

Production preparation performed 9 September 2026; staging deferred by owner request.

## Deployed

- Exact account allowlists for live payers and receiving professionals; empty lists deny access.
- Live Paystack key validation in collection and payout onboarding.
- Live collection requires a provider-verified live payout destination. The test main-account fallback is sandbox-only.
- Reused payment orders must match requested invoice, amount and payment method.
- Shared and Zania Pay webhooks route refund events by the original transaction reference.
- Eleven focused fee, account, pilot access and event-routing tests passed.

## Configuration

- Payment mode is now live and live collection is enabled for the allowlisted pair, after the owner confirmed the live webhook was saved and the live payout destination was verified.
- Live payout onboarding enabled only for the existing Mwaniki Weddings pilot professional.
- Live payer allowlist contains the existing Gmail qualification payer and, with explicit owner approval on 9 September, the verified `wilson.mwaniki@me.com` account. The saved configuration digest was checked against exactly those two account IDs.
- Professional allowlist remains limited to Mwaniki Weddings. General rollout is not enabled.
- No live payment or refund submitted during preparation.

## Preparation checklist at that time (superseded by the completion above)

1. Completed: Zania and Paystack report the live destination verified.
2. Owner confirmed the shared production paystack-webhook URL was saved in Paystack live settings. Actual live event delivery still needs the first payment.
3. Prepare and explicitly approve a live invoice payment of KES 1,000 plus KES 50 Zania fee and KES 16 processing fee (KES 1,066 total).
4. Live collection is enabled for the allowlisted pair. Complete checkout and verify provider event delivery, invoice ledger and receipt. No real payment has been initiated by the agent.
5. Verify actual settlement separately from successful collection, then qualify refund with the provider. Existing sandbox settlements are not evidence of live payout.
6. Expand access only after pilot evidence is reviewed. Current allowlists intentionally have no broad-release bypass.
