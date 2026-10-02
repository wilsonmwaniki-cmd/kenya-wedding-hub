# Paystack Cutover Runbook

Paystack is Zania's only provider for new subscription checkouts. Legacy Pesapal
callback and sync functions remain solely for historical transaction
reconciliation and must not initiate new payments.

## Configuration

Set this server-only Supabase Edge Function secret:

- `PAYSTACK_SECRET_KEY`

Optional server-only settings:

- `PAYSTACK_CURRENCY=KES`
- `PAYSTACK_API_BASE_URL=https://api.paystack.co`

Never expose the Paystack secret as a `VITE_` variable or commit it to the repository.

The frontend has no provider switch: it always initiates Paystack checkout.

## Paystack Dashboard

Configure the webhook URL as:

`https://csrrnirpgkqjhvqcyxjp.supabase.co/functions/v1/paystack-webhook`

Enable the payment channels approved for the business, including cards for overseas clients and Mobile Money/M-PESA for Kenyan clients. The application uses Paystack's hosted checkout, so channel availability is controlled in Paystack rather than trusted from the browser.

## Deployment

1. Apply the migration that adds `paystack` to `payment_transactions.provider`.
2. Deploy `create-paystack-checkout`.
3. Deploy `sync-paystack-couple-checkout`.
4. Deploy `sync-paystack-professional-checkout`.
5. Deploy `paystack-webhook` with JWT verification disabled in `supabase/config.toml`.
6. Add `PAYSTACK_SECRET_KEY` to Supabase secrets.
7. Register the webhook URL in Paystack.
8. Test in Paystack test mode before enabling production checkout.

## Verification

Run at least one successful and one failed/cancelled checkout. Confirm that:

- Paystack receives KES in subunits (for example, KES 1,500 is sent as `150000`).
- the callback includes `reference`, `trxref`, and `payment_provider=paystack`.
- the server verifies the reference, amount, currency, and Paystack status.
- `payment_transactions` changes to `completed` only after server verification.
- couple and professional entitlements activate once and remain idempotent on refresh.
- a forged callback or webhook signature does not activate access.

## Historical Pesapal payments

Do not route new checkout attempts to Pesapal. Existing callback URLs carry
their provider, so historical or in-flight Pesapal payments can still be
reconciled through the legacy sync functions without reopening Pesapal for new
sales.
