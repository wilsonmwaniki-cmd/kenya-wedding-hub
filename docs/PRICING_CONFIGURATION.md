# Pricing Configuration

Zania pricing now boots from Supabase first.

The active runtime source of truth is:

- `public.pricing_catalog`

The frontend reads the active catalog at app startup, and the Stripe checkout functions read the same catalog server-side for lookup-key validation and checkout activation mapping.

## What lives in Supabase now

The active `pricing_catalog.config` JSON can drive:

- couple plan names, copy, prices, CTA labels, and included features
- couple add-on copy and Stripe lookup keys
- planner and vendor plan prices, copy, and lookup keys
- planner and vendor add-on copy, lookup keys, and seat limits
- audience pricing card copy
- displayed one-time, monthly, and annual prices for audience-level pricing cards
- Stripe checkout allowlisted lookup keys
- checkout activation mappings for couple plans/add-ons and professional add-ons

That means you can now change the live pricing catalog in Supabase without touching application code for normal pricing edits.

## Runtime precedence

Pricing resolves in this order:

1. local in-code defaults
2. active Supabase `pricing_catalog` row
3. optional `VITE_PRICING_CONFIG_JSON` override

This keeps the app resilient:

- if Supabase is unavailable, Zania falls back to the in-code defaults
- if you need an emergency preview override, `VITE_PRICING_CONFIG_JSON` still wins

## Expected table shape

The app expects one active row in:

- `public.pricing_catalog`

Suggested record:

- `catalog_key`: `default_live`
- `display_name`: `Default Live Pricing Catalog`
- `is_active`: `true`

## Important scope

This setup makes existing pricing structures data-driven.

You can safely change:

- plan titles
- prices
- Stripe lookup keys
- feature lists shown in pricing
- checkout activation mappings
- seat limits for add-ons

You would still need code changes if you want to:

- invent entirely new pricing families the UI does not know how to render
- add a totally new account audience beyond `couple`, `committee`, `planner`, or `vendor`
- redesign the pricing page layout itself

## Optional env overrides

### Frontend emergency override

- `VITE_PRICING_CONFIG_JSON`

Example:

```env
VITE_PRICING_CONFIG_JSON={"couplePlans":{"basic":{"annualPriceKes":6500,"monthlyPriceKes":900,"title":"Plus"}}}
```

### Server emergency lookup-key override

- `STRIPE_ALLOWED_LOOKUP_KEYS`

This is still supported as a last-resort server override, but the preferred source is now the Supabase catalog.

Examples:

```env
STRIPE_ALLOWED_LOOKUP_KEYS=couple_basic_monthly,couple_basic_annual,vendor_premium_monthly
```

or

```env
STRIPE_ALLOWED_LOOKUP_KEYS=["couple_basic_monthly","couple_basic_annual","vendor_premium_monthly"]
```

## Recommended operational workflow

1. Update the active `pricing_catalog.config` row in Supabase.
2. Confirm the Stripe lookup keys in the catalog match real active Stripe prices.
3. Refresh the frontend to confirm pricing copy and amounts changed correctly.
4. Test one checkout path in preview or staging before pushing major catalog changes live.
