# Role-based interactive demo — product and implementation specification

Status: Draft for implementation
Owner: Zania product and engineering
Created: 17 September 2026
Primary route: `/explore`

## 1. Decision

Replace the separate hand-built Explore workspace with role-based demo sessions that run inside Zania's real application interface.

A visitor chooses one of three entry points:

- Explore as a couple
- Explore as a professional
- Explore as a planner

Zania then creates an isolated, temporary demo identity and a seeded workspace for that visitor. The demo uses the same routes, layout, components, responsive behaviour and core data operations as the production application.

The demo must be editable and safe. Visitors can change sample data, but they cannot send real messages, charge money, pay out money, invite real people, publish a listing, or affect another visitor's demo.

## 2. Why the current approach should be replaced

The current `/explore` page is a separate approximation of the product. That creates four problems:

1. It does not feel like the application the visitor will receive after signup.
2. It duplicates interface code and will drift whenever the real application changes.
3. It demonstrates isolated screens instead of connected workflows.
4. Product improvements must be implemented twice.

The new demo must not maintain a second version of Dashboard, Budget, Tasks, Vendors or Documents. It should provide demo data to the real application surfaces.

## 3. Product goals

### Primary goal

Let a prospective customer understand Zania's value before committing to setup work or entering real wedding details.

### Supporting goals

- Demonstrate a complete, already-active workflow instead of empty states.
- Let visitors safely make changes and see connected parts of the workspace respond.
- Show the correct experience for couples, professionals and planners.
- Make the transition from exploration to account creation clear and low pressure.
- Keep all production customer data and external services protected.
- Ensure future improvements to the actual app appear in the demo automatically.

### Non-goals for the first release

- Processing real M-Pesa or card payments.
- Sending real email, SMS, WhatsApp or push notifications.
- Publishing demo professional listings publicly.
- Allowing demo users to contact real couples, professionals or planners.
- Preserving a demo indefinitely.
- Perfectly converting every demo record into a permanent account in version one.

## 4. Core experience

### 4.1 Explore landing page

`/explore` becomes a lightweight role-selection page rather than a workspace replica.

Each role card must explain the experience in one sentence:

| Role | Card title | Promise | Primary destination |
|---|---|---|---|
| Couple | Explore as a couple | Plan a sample wedding across tasks, budget, vendors and documents. | `/dashboard` |
| Professional | Explore as a professional | Manage a sample business, leads, quotes, invoices, contracts and receipts. | `/vendor-dashboard` |
| Planner | Explore as a planner | Coordinate sample clients and open a complete wedding workspace. | `/clients` |

The page must also offer `Sign in` and `Create a real account` without making signup a prerequisite for exploration.

### 4.2 Starting a demo

1. The visitor selects a role.
2. Zania explains that the session contains sample data and cannot perform real-world actions.
3. The visitor selects `Start demo`.
4. Zania creates a temporary authenticated identity.
5. A server-owned seeding operation creates the role's isolated sample records.
6. The visitor is redirected into the real application route for that role.

Target: a ready workspace within three seconds under normal production conditions.

### 4.3 Persistent demo chrome

Every protected page shown during a demo must display one compact, persistent banner:

> Demo mode · You can change this sample workspace. Payments, messages and invitations are simulated. [Reset] [Create account] [Exit]

Requirements:

- visible on desktop and mobile without obscuring primary navigation;
- uses the existing service/banner visual language;
- cannot be permanently dismissed;
- identifies the current demo role;
- offers a reset action with confirmation;
- offers a clear exit action;
- keeps the ordinary AppLayout and role navigation unchanged beneath it.

### 4.4 Session duration

- Default expiry: 24 hours after creation.
- Activity may extend the local session, but must never extend server data beyond the configured retention window without an explicit product decision.
- Warn the visitor when less than 30 minutes remain.
- Expired sessions return to `/explore` with a friendly explanation and a `Start a fresh demo` action.
- A scheduled cleanup removes expired demo users and their owned data.

## 5. Role experiences and seed data

### 5.1 Couple demo

#### Sample story

Amina and Kamau are planning a 120-person Nairobi wedding. Planning is already underway, so every key surface contains meaningful data.

#### Required pages

- Wedding Home
- Budget
- Tasks
- Vendors
- Documents
- Settings, limited to safe demo fields

#### Seed state

- wedding name, date, venue area and guest target;
- 12–18 tasks across completed, upcoming and overdue states;
- budget categories totalling KES 1,500,000 with allocated, committed and paid amounts;
- four or five workspace vendors across saved, considering, quote received and booked states;
- connected quote, contract, invoice and receipt records;
- two or three workspace activity items;
- at least one action that needs attention;
- no real recipient email addresses or phone numbers.

#### Demonstrable workflows

- complete a task and see Dashboard progress change;
- adjust a budget category and see totals recalculate;
- move a vendor through a planning status;
- accept a sample quote;
- inspect a contract;
- mark a sample invoice as paid through a simulated action and create a receipt;
- see the resulting document activity on Wedding Home.

### 5.2 Professional demo

#### Sample story

Maya Studios is an established wedding photographer managing enquiries and commercial documents.

#### Required pages

- Professional Dashboard
- Documents overview, quotes, invoices, receipts, contracts and templates
- Listing
- Reviews where enabled
- Settings, limited to safe demo fields

#### Seed state

- complete business profile and sample listing;
- dashboard totals and recent activity;
- two sample enquiries or leads;
- one draft quote and one sent quote;
- one accepted quote connected to an invoice;
- one paid invoice with receipt;
- one contract awaiting a sample countersignature;
- two verified payout destinations displayed as examples, never connected to a real provider;
- sample reviews and listing analytics where the real interface supports them.

#### Demonstrable workflows

- edit and save a draft quote;
- convert a quote to an invoice;
- record a simulated external payment;
- create or inspect a receipt;
- edit the listing preview;
- change the default sample payout destination without creating a Paystack subaccount;
- move a lead through its internal workflow without contacting a real person.

### 5.3 Planner demo

#### Sample story

Nia Events manages three weddings at different planning stages. One wedding is fully populated for detailed exploration.

#### Required pages

- Client portfolio
- Planner Dashboard where applicable
- Selected client's Wedding Home
- Budget
- Tasks
- Vendors
- Documents
- Settings, limited to safe demo fields

#### Seed state

- three planner client cards with different dates and progress;
- one selected, fully populated wedding;
- summary counts across the client portfolio;
- shared tasks, budget, vendors and documents for the selected client;
- one pending client approval or change request;
- planner-created quote, contract or invoice examples;
- no linked real couple accounts.

#### Demonstrable workflows

- switch between sample weddings;
- open a client workspace using the real planner context;
- create or complete a task for a selected client;
- adjust a client's budget;
- update a vendor record;
- create a draft document for the selected client;
- simulate submitting a change for client approval.

## 6. Technical architecture

### 6.1 Principle: real app, isolated data

The demo must use:

- the existing `AuthProvider`;
- the existing `WorkspaceProviders`;
- the existing `AppLayout`;
- the existing protected pages and role routing;
- the existing Supabase client and query/mutation code;
- production RLS policies as the baseline data-isolation boundary.

Do not create `DemoDashboard`, `DemoBudget`, `DemoTasks`, `DemoVendors` or equivalent copies of production pages.

Demo-specific code is limited to:

- role selection and session startup;
- seed creation and reset;
- demo session detection;
- persistent demo banner;
- external-action suppression or simulation;
- expiry and cleanup;
- demo analytics.

### 6.2 Temporary identity

Recommended approach: Supabase anonymous authentication, provided anonymous sign-ins are enabled and verified in the project.

The temporary user receives a normal `auth.uid()`, allowing existing ownership checks and RLS policies to isolate its rows. After anonymous sign-in, a server-controlled operation assigns the requested role and seeds the correct data.

Do not use one shared couple, professional or planner account. Shared credentials would expose visitors to one another's edits, make resets race, and weaken audit and abuse controls.

If Supabase anonymous auth cannot satisfy the existing profile-creation path, the approved fallback is a server-created disposable user per session. Shared accounts remain prohibited.

### 6.3 Demo session record

Add a private table similar to:

```sql
create table public.demo_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role public.app_role not null,
  template_version integer not null,
  status text not null check (status in ('creating', 'active', 'resetting', 'expired', 'converted')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_active_at timestamptz not null default now(),
  converted_at timestamptz
);
```

Rules:

- direct client insert/update/delete is denied;
- a demo user may read only its own session summary through a checked RPC;
- server functions own creation, reset, expiry and cleanup;
- index `expires_at` for cleanup;
- add a database helper such as `is_demo_user(auth.uid())` for policies and server checks;
- demo session records are not exposed in public analytics or directory queries.

### 6.4 Profile representation

Add an explicit demo marker rather than inferring demo status from names or email addresses.

Preferred options, in order:

1. `profiles.is_demo boolean not null default false`, backed by `demo_sessions`;
2. a checked `is_demo_user()` function used wherever profile columns should remain unchanged.

The implementation must not grant demo users paid production entitlements merely by altering ordinary subscription fields. Entitlement resolution should explicitly return a bounded demo capability set while `is_demo_user()` is true.

### 6.5 Seeding API

Create one authenticated server endpoint:

`start-demo-session`

Input:

```json
{ "role": "couple" | "vendor" | "planner" }
```

Responsibilities:

1. verify the caller is an anonymous/disposable demo-eligible user;
2. enforce rate limits;
3. reject admin role requests;
4. create the demo session record;
5. create/update the role profile;
6. call the correct versioned seed function;
7. commit all seed records atomically where practical;
8. return the destination route and expiry;
9. emit a server-side analytics event without personal data.

Seed functions:

- `seed_couple_demo_v1(user_id)`
- `seed_vendor_demo_v1(user_id)`
- `seed_planner_demo_v1(user_id)`

Seed functions must be idempotent for a session and must use stable relationships between sample records. Human-readable sample document numbers can be stable; database IDs must remain unique per visitor.

### 6.6 Reset API

Create `reset-demo-session` as a server-owned operation.

It must:

- verify ownership of the active demo session;
- delete only records owned by that demo user/session;
- preserve the authenticated temporary identity;
- reseed the same role using the current template version;
- invalidate React Query caches after success;
- redirect to the role's home route;
- never use broad client-side delete loops.

### 6.7 Demo detection in the application

Expose a small context:

```ts
type DemoSessionContextValue = {
  isDemo: boolean;
  role: 'couple' | 'vendor' | 'planner' | null;
  expiresAt: string | null;
  resetDemo: () => Promise<void>;
  exitDemo: () => Promise<void>;
};
```

`DemoSessionProvider` should sit inside authenticated workspace providers so that `AppLayout` and action components can read it.

Do not use a `?demo=true` query parameter as authority. A query parameter may affect presentation, but only the server-backed demo session may authorize simulated behaviour.

## 7. External-action safety policy

Demo users must be blocked at both the UI and server boundaries. Hiding a button is not sufficient.

### 7.1 Action matrix

| Capability | Demo behaviour | Server requirement |
|---|---|---|
| Edit tasks, budget, vendor notes | Real database mutation in isolated demo rows | Ordinary RLS plus demo ownership |
| Edit draft documents | Real database mutation in isolated demo rows | Ordinary RLS plus demo ownership |
| Accept/sign a sample document | Simulated internal state transition | Reject non-demo counterpart IDs |
| Send email/SMS/WhatsApp | Simulate success and create labelled demo activity | Never call delivery provider |
| Invite partner/client/vendor | Simulate invitation state | Never send or expose a usable token |
| M-Pesa/card payment | Simulated payment state only | Never initialize Paystack/Pesapal/Kopo Kopo |
| Payout account setup | Use clearly fake seeded destinations | Never create/update provider subaccounts |
| Refund | Simulate state transition | Never call payment provider |
| Upload | Disable in v1 or constrain to disposable private storage | Enforce path, size, MIME and expiry |
| Publish listing | Preview only | Never set production listing live |
| AI assistant | Optional, rate-limited and read-only in v1 | No tool mutations or external sends |

### 7.2 Central server guard

All Edge Functions and privileged RPCs that can cause external side effects must call a common guard before contacting a provider:

```ts
await assertExternalActionAllowed({ userId, action: 'send-commercial-document' });
```

For demo users, the guard either:

- returns a typed `DEMO_ACTION_BLOCKED` error; or
- routes to an explicitly implemented simulator that performs no external network call.

The following existing areas require an audit before release:

- Zania Pay order creation and webhooks;
- payout setup and payout operations;
- document sending;
- contract sending and signing links;
- subscription checkout;
- invitation and notification delivery;
- review invitations;
- AI actions that mutate data or contact third parties.

## 8. Entitlements and feature flags

### Demo capability rules

- Demo experiences may showcase paid features, but only through a dedicated demo entitlement result.
- A demo entitlement must never be accepted as billing proof by payment or subscription code.
- Role navigation should match the paid experience being demonstrated while clearly retaining the Demo mode banner.
- Features still hidden by the production release flag remain hidden unless a separate demo-only product decision is documented.

### Rollout flag

Add a server-controlled flag such as:

`role_based_demo`

Suggested stages:

1. internal/admin only;
2. private URL for stakeholder testing;
3. 10% of `/explore` visitors;
4. 100% after error, abuse and conversion review.

The existing Explore implementation remains available only as a rollback during rollout and must be deleted after the role-based demo is stable.

## 9. Authentication and conversion

### Logged-out visitors

Start an anonymous/disposable demo session directly.

### Already signed-in real users

Do not replace or sign out their real session automatically. Show:

- `Return to my workspace`; and
- an explanation that role demos open in a separate browser/private session until isolated secondary auth is implemented.

This avoids overwriting the application's single persisted Supabase session.

### Create account from demo

Version one:

- preserve the visitor's chosen role in the signup URL;
- explain that the real account starts clean;
- exit the demo only after signup navigation is confirmed.

Version two, after explicit testing:

- convert or link the anonymous identity to a verified permanent identity if supported safely;
- let the customer choose whether to copy selected demo structure;
- never copy fictional contact details, payment records, reviews or document signatures into a real account.

## 10. Abuse prevention and privacy

- Require a Cloudflare Turnstile token when creating a new anonymous Auth user. Pass the token to `signInAnonymously`; do not validate it only in the browser.
- Rate-limit demo creation by IP, device/session token and time window.
- Limit one active demo per role per browser where practical.
- Apply stricter rate limits to AI and write-heavy actions.
- Never seed real email addresses, phone numbers, payment tokens or bank details.
- Ensure demo profiles are excluded from public directories, search, review aggregates and marketplace supply counts.
- Add `robots: noindex` to authenticated demo routes if route metadata differs from ordinary authenticated pages.
- Do not log free-text document content or notes in analytics.
- Cleanup must remove Auth users, database rows and any disposable storage objects.
- Demo identifiers must be obvious in admin/support tooling.

### 10.1 Turnstile activation runbook

The application integration is intentionally fail-safe across environments:

- `VITE_TURNSTILE_SITE_KEY` absent: the widget is not rendered, which keeps local and preview environments usable while Supabase CAPTCHA remains disabled there.
- `VITE_TURNSTILE_SITE_KEY` present: a new visitor cannot start a demo until Turnstile returns a token; the token is passed to Supabase anonymous sign-in and reset after a failed attempt.
- Existing anonymous demo sessions do not solve another challenge because no new Auth user is created.

Production activation must be completed as one coordinated change:

1. Create a Cloudflare Turnstile widget for `planwithzania.com` and `www.planwithzania.com`.
2. Add its public site key to Vercel as `VITE_TURNSTILE_SITE_KEY` for Production (and Preview only if the preview hostname is allow-listed).
3. In Supabase Dashboard, open **Authentication → Bot and Abuse Protection**, enable CAPTCHA, choose **Cloudflare Turnstile**, and save the matching secret key.
4. Deploy the frontend containing the site key.
5. In a private browser session, verify that a couple, professional and planner demo can each be started and that an invalid or expired token is rejected.
6. Confirm Auth logs show CAPTCHA validation and monitor anonymous-user creation volume.

Do not enable Supabase CAPTCHA before the frontend site key is live. That ordering would block every new anonymous demo. Do not commit the Turnstile secret or expose it through a `VITE_` variable.

## 11. Analytics

Track the funnel without personal data:

- `demo_role_viewed`
- `demo_started`
- `demo_ready`
- `demo_start_failed`
- `demo_section_opened`
- `demo_key_action_completed`
- `demo_reset`
- `demo_signup_clicked`
- `demo_exited`
- `demo_expired`

Core measures:

- role selection rate;
- successful session creation rate;
- time to ready;
- percentage reaching two or more sections;
- percentage completing a meaningful action;
- signup click-through by role;
- completed signup attribution where consent and analytics rules allow;
- demo errors and blocked-action attempts.

## 12. Implementation phases

### Phase 0 — foundation and safety audit

- [ ] Confirm Supabase anonymous authentication availability and profile-trigger behaviour.
- [ ] Inventory every external-side-effect function and privileged RPC.
- [ ] Add `demo_sessions`, demo detection and cleanup indexes.
- [ ] Add shared server guard for external actions.
- [ ] Add rate limiting for demo creation/reset.
- [ ] Add `DemoSessionProvider` and persistent banner.
- [ ] Add internal-only feature flag.
- [ ] Add expiry handling and scheduled cleanup.

Exit criteria:

- an isolated demo identity can be created and removed;
- a demo user cannot read any real account row;
- a demo user cannot trigger any external provider in automated tests.

### Phase 1 — couple demo

- [ ] Replace `/explore` workspace replica with role selection.
- [ ] Implement `start-demo-session` for `couple`.
- [ ] Implement `seed_couple_demo_v1`.
- [ ] Route the session through real Dashboard, Budget, Tasks, Vendors and Documents pages.
- [ ] Implement sample-only payment/document transitions.
- [ ] Implement reset and exit.
- [ ] Add desktop and mobile end-to-end tests.
- [ ] Release internally, then behind a private URL.

Exit criteria:

- all couple acceptance criteria in section 13 pass;
- no separate demo copies of production workspace pages remain;
- a reset produces the exact original couple seed state.

### Phase 2 — professional demo

- [ ] Implement `seed_vendor_demo_v1`.
- [ ] Add professional role card and route.
- [ ] Seed listing, leads, documents, reviews and fake payout destinations.
- [ ] Simulate send, payment, refund and payout-related actions.
- [ ] Verify no Paystack/Pesapal/Kopo Kopo call is possible.
- [ ] Add role-specific tests and analytics.

### Phase 3 — planner demo

- [ ] Implement `seed_planner_demo_v1`.
- [ ] Add planner role card and route.
- [ ] Seed three clients and one detailed wedding.
- [ ] Ensure selected-client context works from `/clients` into real workspace routes.
- [ ] Simulate change-request and document collaboration actions.
- [ ] Add role-specific tests and analytics.

### Phase 4 — conversion and optimisation

- [ ] Measure engagement and signup by role.
- [ ] Improve seed stories based on session behaviour.
- [ ] Test anonymous-to-permanent identity conversion separately.
- [ ] Add optional structure copying only after data review.
- [ ] Remove the old Explore implementation and rollback flag after stability window.

## 13. Acceptance criteria

### Shared

- [ ] A visitor can choose couple, professional or planner without creating a permanent account.
- [ ] Every role opens in the real Zania AppLayout and real responsive navigation.
- [ ] Two concurrent visitors never see or alter each other's demo data.
- [ ] Refreshing the browser restores the active demo until expiry.
- [ ] Reset restores the role's original seed data.
- [ ] Exit signs out the temporary user and returns to `/explore`.
- [ ] Expiry removes access and offers a fresh demo.
- [ ] Demo state is obvious on every page.
- [ ] All external side effects are blocked server-side.
- [ ] Production customer data, analytics aggregates and public listings exclude demo records.

### Couple

- [ ] Dashboard, Budget, Tasks, Vendors and Documents contain connected sample data.
- [ ] Completing a task updates Dashboard counts.
- [ ] Budget edits update totals and accept zero.
- [ ] Document changes appear in the appropriate real document views.
- [ ] Simulated invoice payment creates a labelled sample receipt and activity item.

### Professional

- [ ] Dashboard, listing and document navigation match a real professional account.
- [ ] A draft quote can be edited and converted to a sample invoice.
- [ ] Sample payment and payout actions never reach a provider.
- [ ] Listing changes remain private to the demo.

### Planner

- [ ] The client portfolio displays multiple seeded weddings.
- [ ] Selecting a client populates the real planner context.
- [ ] Client Budget, Tasks, Vendors and Documents remain connected.
- [ ] Simulated approvals cannot reach a real couple.

## 14. Verification plan

### Unit tests

- demo session parsing and expiry;
- route choice by role;
- demo entitlement resolution;
- external-action guard;
- reset idempotency;
- seed relationship integrity;
- demo data exclusion helpers.

### Database tests

- anonymous demo user reads only owned rows;
- cross-demo reads and writes fail;
- demo user cannot create admin role;
- production user cannot reset another session;
- expired session loses access;
- reset deletes only its session data;
- cleanup removes expired Auth and application rows;
- public directory and aggregates exclude demos.

### Edge Function tests

- invalid role rejected;
- rate limit enforced;
- partial seed failure rolls back or is safely recoverable;
- demo external actions never invoke provider adapters;
- ordinary non-demo actions retain current behaviour.

### Browser tests

Run desktop and 390 px mobile flows for every role:

1. select role;
2. wait for ready state;
3. verify real role navigation;
4. edit at least two connected records;
5. refresh and verify persistence;
6. attempt a blocked external action;
7. reset and verify original seed;
8. exit and verify session removal;
9. confirm no console errors or horizontal overflow.

### Production release checks

- verify feature flag targeting;
- inspect function errors and latency;
- verify cleanup job execution;
- verify no demo transaction appears in payment providers;
- verify no demo message appears in delivery providers;
- verify no demo listing appears publicly;
- monitor creation volume and abuse signals during staged rollout.

## 15. Rollback

Rollback must not require a code deployment.

1. Disable `role_based_demo`.
2. Return `/explore` to a safe role-selection unavailable state or the temporary legacy preview.
3. Prevent new demo session creation.
4. Allow cleanup to remove existing sessions or expire them immediately through an admin-only operation.
5. Keep the external-action guard in place; it is defence in depth and should not be rolled back.

## 16. Required code areas

Expected additions:

- `src/pages/ExploreZania.tsx` — role selection only
- `src/contexts/DemoSessionContext.tsx`
- `src/components/DemoModeBanner.tsx`
- `src/lib/demoSessions.ts`
- `src/components/WorkspaceProviders.tsx` — include demo provider
- `src/components/AppLayout.tsx` — render demo banner and reset/exit affordances
- `src/lib/entitlements.ts` — explicit bounded demo capabilities
- `supabase/functions/start-demo-session/`
- `supabase/functions/reset-demo-session/`
- `supabase/functions/_shared/demoSafety.ts`
- versioned seed SQL/RPCs and cleanup migration
- role-specific tests under `src/test/` and database verification scripts

Expected audits or small changes:

- protected routes in `src/App.tsx`;
- Auth profile/bootstrap logic in `src/contexts/AuthContext.tsx`;
- planner selection in `src/contexts/PlannerContext.tsx`;
- all payment, payout, document-send, invitation and notification functions;
- public directory and analytics queries;
- admin/support user lists.

## 17. Definition of done

The feature is done only when:

- all three roles run through the real app interface;
- seed data is isolated per visitor;
- the documented connected workflows work;
- external-action blocking is proven with automated tests;
- reset, expiry and cleanup work in production;
- the full existing regression suite passes;
- desktop and mobile browser verification passes;
- the staged rollout has no critical security, privacy or payment findings;
- the obsolete parallel Explore workspace has been removed.
