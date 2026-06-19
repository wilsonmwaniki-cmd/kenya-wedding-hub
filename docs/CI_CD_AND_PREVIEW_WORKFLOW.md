# CI/CD And Preview Workflow

This document describes the current safe release path for Zania, how preview deployments work, and what branch protection rules should be enabled in GitHub.

## Current state

Zania already has:

- Vercel preview deployments for non-production builds
- Vercel production deployments
- a GitHub Actions CI workflow in [.github/workflows/ci.yml](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/.github/workflows/ci.yml)
- a release sync workflow in [.github/workflows/sync-release-to-main.yml](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/.github/workflows/sync-release-to-main.yml)

The CI workflow currently runs:

- `npm test`
- `npm run build`

It does **not** currently block on `npm run lint`, because the repository still has a large legacy lint backlog that would fail unrelated work.

## How preview deployments work

Every non-production Vercel deploy produces a preview URL.

Example format:

- `https://kenya-wedding-<hash>-mwaniki.vercel.app`

These are the right place to review:

- pricing changes
- unfinished features
- copy changes
- design passes
- experimental flows

## Why a preview may ask for Vercel login

If a preview URL opens on a Vercel login page, the preview is protected by Vercel deployment protection.

That means:

- the deployment exists and is healthy
- the project is configured so only authorized viewers can access that preview

This is useful for private review before shipping.

If public previews are needed later, change that in Vercel project settings rather than working around it in code.

## Recommended release flow

Use this path for normal product work:

1. Create or update the feature branch.
2. Push changes and let Vercel generate a preview deployment.
3. Review the preview deployment.
4. Let GitHub Actions run `test` and `build`.
5. Merge only after preview review and CI pass.
6. Promote or deploy production only after approval.

## Recommended GitHub branch protection

Apply these rules to `main`:

- require pull requests before merging
- require at least one approval
- require status checks to pass before merging
- include `CI / Build and Test` as a required status check
- restrict direct pushes to `main`
- require branches to be up to date before merging

If you keep using release branches, apply the same protection to important release branches too.

## What CI enforces today

The current CI workflow is intentionally pragmatic:

- tests must pass
- production build must pass

This catches:

- broken imports
- TypeScript/runtime-level build failures
- failing unit tests
- many accidental regressions

## What CI does not enforce yet

These are still recommended, but not ready to be blocking:

- `npm run lint`
- stricter type cleanup around `any`
- hook dependency cleanup
- repo-wide React refresh warnings

Those should be added once the current lint backlog is reduced enough that the signal becomes trustworthy.

## Recommended next maturity steps

1. Keep `build` and `test` as required checks now.
2. Do a dedicated lint-hardening pass.
3. After lint is healthy, add `npm run lint` to CI.
4. Optionally add deployment promotion rules so production deploys happen only from approved merges.

## Preview-only feature development

For unfinished features, continue using the pattern in [preview-feature-workflow.md](/Users/Mwaniki1/Documents/Projects/weddingplan-kenya/kenya-wedding-hub/docs/preview-feature-workflow.md):

- gate the feature with a Vite flag
- turn the flag on in Preview only
- keep Production off until ready

That lets Zania test boldly without polluting the live product.
