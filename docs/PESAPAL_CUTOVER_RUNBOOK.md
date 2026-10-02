# Pesapal Cutover Runbook

This runbook covers the remaining operational steps after the Pesapal scaffolding was added to the repo.

## What is already in the repo

- provider-aware billing entry points
- Pesapal checkout and sync edge functions
- Pesapal IPN webhook function
- `payment_transactions` migration
- client-side success return handling for either Stripe or Pesapal references

## Current production posture

The code is ready for sandbox wiring, but not live until all of these are true:

1. the migration is pushed
2. the new edge functions are deployed
3. the Supabase secrets are set
4. the Pesapal IPN URL is registered in Pesapal
5. the active pricing catalog includes real amounts for every product that should be purchasable through Pesapal
6. `VITE_BILLING_PROVIDER` is switched to `pesapal`

## Supabase project

- project ref: `csrrnirpgkqjhvqcyxjp`
- Pesapal IPN function URL:
  - `https://csrrnirpgkqjhvqcyxjp.supabase.co/functions/v1/pesapal-ipn`

## Required Supabase secrets

Set these in the Supabase project before deploying functions:

- `PESAPAL_ENVIRONMENT`
  - `sandbox` or `production`
- `PESAPAL_CONSUMER_KEY`
- `PESAPAL_CONSUMER_SECRET`
- `PESAPAL_AUTH_URL`
- `PESAPAL_NOTIFICATION_ID`
- `PESAPAL_SUBMIT_ORDER_URL`
  - optional if using the default in code
- `PESAPAL_TRANSACTION_STATUS_URL`
  - optional if using the default in code
- `PESAPAL_IPN_URL`
  - recommended to set to the function URL above for consistency

Existing required secrets still apply:

- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `OPENAI_API_KEY`

## Required Vercel env

Set this in Vercel when you are ready to switch the app:

- `VITE_BILLING_PROVIDER=pesapal`

Keep it as `stripe` until sandbox verification passes.

## Pricing catalog warning

Pesapal checkout requires concrete amounts in KES.

Today, some add-ons in the pricing catalog still resolve to `null` amounts, which means the Pesapal checkout function will reject them as not fully priced yet.

Before cutover, confirm that the active `pricing_catalog.config` has real prices for:

- couple plans
- professional plans
- any add-on you want to sell through Pesapal

## Deployment order

1. Push the migration:
   - `20260708103000_pesapal_payment_transactions.sql`
2. Deploy these functions:
   - `create-pesapal-checkout`
   - `sync-pesapal-couple-checkout`
   - `sync-pesapal-professional-checkout`
   - `pesapal-ipn`
3. Register the IPN URL in Pesapal
4. Run a sandbox checkout
5. Switch `VITE_BILLING_PROVIDER` to `pesapal`
6. Re-test couple and professional flows

## Sandbox verification checklist

Verify these flows end-to-end:

1. Couple plan upgrade from `/pricing`
2. Gift Registry add-on purchase
3. Guest RSVP add-on purchase
4. Professional add-on purchase from `/pricing`
5. Successful redirect back with `OrderTrackingId`
6. Successful entitlement activation
7. `payment_transactions` row written and status updated
8. IPN endpoint receives and records a callback

## Rollback

If sandbox or production activation fails:

1. set `VITE_BILLING_PROVIDER=stripe`
2. redeploy the frontend
3. leave the Pesapal functions in place for debugging

No Stripe code was removed yet, so rollback should be quick.
