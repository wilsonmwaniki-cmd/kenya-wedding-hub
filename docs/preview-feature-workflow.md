# Preview Feature Workflow

Use Vercel preview deployments as the private place to test unfinished features without exposing them on the live app.

## Preview access

Some Zania preview deployments are protected by Vercel deployment protection.

If a preview URL opens on a Vercel login page, that usually means the preview is healthy but private.

Use that protected preview when:

- a feature should only be reviewed internally
- pricing or product experiments are not ready for public visibility
- the deployment should not be indexed or casually shared

If a public preview is needed later, change that in Vercel settings rather than removing product guards in code.

## Current preview-only flags

- `VITE_ENABLE_PROFESSIONAL_NETWORK=true` in `Preview`

Production should keep these flags off unless a feature is fully ready to ship.

## How this works

1. Build the feature behind a dedicated Vite flag.
2. Keep the live route and navigation hidden unless the flag is on.
3. Turn the flag on in Vercel `Preview` only.
4. Test the feature on the generated preview deployment URL.
5. When the feature is ready, either:
   - move the preview value to `Production`, or
   - remove the flag entirely and ship it normally.

## Pattern for future features

Add a new client-visible flag in:

- [.env.example](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/.env.example)
- [src/vite-env.d.ts](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/vite-env.d.ts)
- [src/lib/featureFlags.ts](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/src/lib/featureFlags.ts)

Recommended naming:

- `VITE_ENABLE_<FEATURE_NAME>`

Examples:

- `VITE_ENABLE_PROFESSIONAL_NETWORK`
- `VITE_ENABLE_VENDOR_MATCHING`
- `VITE_ENABLE_PLANNER_SCORECARDS`

## Optional branch-scoped previews

If you want a feature visible only on one preview branch, Vercel can scope preview env vars to a Git branch instead of all previews.

That is useful when:

- one feature is unstable
- multiple experiments are happening at once
- you want one clean preview branch per feature

## Local testing

For local-only verification, set the flag in `.env.local`:

```env
VITE_ENABLE_PROFESSIONAL_NETWORK=true
```

Then run the app normally and test the labs route:

```text
/labs/network
```
