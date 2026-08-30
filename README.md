# Zania Wedding Hub

Wedding planning workspace for couples, planners, committees, vendors, and admins. The app combines wedding setup, budget tracking, tasks, guests, vendors, timelines, documents, portfolio sharing, subscriptions, and an AI planning assistant.

## Stack

- Vite + React + TypeScript
- Tailwind + shadcn/ui
- Supabase Auth, Postgres, RPCs, and Edge Functions
- Stripe for paid plans and add-ons
- Resend for invite and reminder email delivery

## Local setup

1. Install dependencies:

```sh
npm install
```

2. Copy [.env.example](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/.env.example) to `.env`.

3. Set the required client env vars:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

4. Start the app:

```sh
npm run dev
```

5. Run the current test suite:

```sh
npm test
```

## Launch-critical backend pieces

The frontend depends on Supabase schema and edge functions from this repo.

Core function groups:

- Billing: `create-stripe-checkout`, `sync-couple-checkout`, `sync-professional-checkout`
- Migration scaffolding: `create-pesapal-checkout`, `sync-pesapal-couple-checkout`, `sync-pesapal-professional-checkout`
- Pesapal webhook endpoint: `pesapal-ipn`
- Messaging: `send-wedding-invite`, `send-guest-invite`, `send-connection-notification`, `send-timeline-reminders`
- AI: `wedding-ai-chat`

Required server-side secrets live in Supabase, not the frontend `.env`:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` such as `Zania Weddings <invites@planwithzania.com>`
- `OPENAI_API_KEY`

The AI assistant routes requests by complexity with these defaults:

- Routine actions and lookups: `OPENAI_ROUTINE_MODEL=gpt-5.6-luna`
- Standard planning assistance: `OPENAI_BALANCED_MODEL=gpt-5.6-terra`
- Complex strategy and multi-constraint analysis: `OPENAI_COMPLEX_MODEL=gpt-5.6-sol`

Each model can be overridden with the corresponding secret above. Routed requests use a stable explicit prompt-cache prefix and record cache reads, cache writes, token usage, the selected model, and estimated cost. If a custom model has different pricing, set `OPENAI_<TIER>_INPUT_COST_PER_MILLION_USD`, `OPENAI_<TIER>_CACHED_INPUT_COST_PER_MILLION_USD`, `OPENAI_<TIER>_CACHE_WRITE_COST_PER_MILLION_USD`, and `OPENAI_<TIER>_OUTPUT_COST_PER_MILLION_USD`, where `<TIER>` is `ROUTINE`, `BALANCED`, or `COMPLEX`.

Optional client/server billing provider switch while migrating:

- `VITE_BILLING_PROVIDER=pesapal|paystack`

Pesapal server configuration:

- `PESAPAL_ENVIRONMENT=sandbox|production`
- `PESAPAL_CONSUMER_KEY`
- `PESAPAL_CONSUMER_SECRET`
- `PESAPAL_AUTH_URL`
- `PESAPAL_NOTIFICATION_ID`
- `PESAPAL_SUBMIT_ORDER_URL` optional override
- `PESAPAL_TRANSACTION_STATUS_URL` optional override
- `PESAPAL_IPN_URL` optional

## Production launch

Use the controlled-production path rather than the locked prototype backend.

- [Production cutover guide](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/docs/PRODUCTION_CUTOVER.md)
- [CI/CD and preview workflow](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/docs/CI_CD_AND_PREVIEW_WORKFLOW.md)
- [Preview feature workflow](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/docs/preview-feature-workflow.md)
- [Pricing configuration](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/docs/PRICING_CONFIGURATION.md)
- [Pesapal cutover runbook](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/docs/PESAPAL_CUTOVER_RUNBOOK.md)
- [Admin bootstrap SQL](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/supabase/sql/bootstrap_admin.sql)
- [Supabase setup script](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/scripts/supabase_prod_setup.sh)

Recommended launch order:

1. Provision the Supabase project you control.
2. Push migrations and deploy the edge functions in this repo.
3. Configure Stripe, Resend, and AI secrets.
4. Bootstrap the first admin user.
5. Verify auth, dashboard CRUD, billing activation, invite sending, and AI chat before onboarding real users.
