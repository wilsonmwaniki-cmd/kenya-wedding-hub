# Zania Conversational Planner — Pilot Recruitment Guide

Updated 3 October 2026.

This guide turns the production validation plan into a small, manageable group
of real testers. The objective is to prove that Zania keeps the correct person,
wedding, client, vendor, document and approval context while users work in
ordinary language.

## Who to recruit

Start with five people or businesses. One person may fill more than one test
role only when the isolation test still uses a genuinely unrelated account.

| Tester | Best candidate | What they prove | Time needed |
| --- | --- | --- | --- |
| Lead planner | The current owner/planner account | Planner workspace, client selection, assistant accuracy and reviewed actions | Two 45-minute sessions |
| Linked couple | A cooperative current client with an active wedding | Couple view, planner approvals, document access and shared context | One 45-minute session plus two short approvals |
| Connected vendor | A vendor already working with that couple, preferably one who can return a realistic quote | Enquiry, response, formal quote, requested changes and contract journey | Two 30-minute sessions |
| Independent planner | A planner who is not connected to the pilot wedding and has their own client data | Same-role isolation and first-time usability | One 45-minute session |
| Independent vendor | A vendor who is not connected to the pilot wedding | Vendor isolation, business briefing and premium boundary | One 30-minute session |

A separate free account can test the premium boundary without recruiting another
person. Do not use an administrator account as an isolation tester.

## Good candidates

Choose people who:

- are comfortable trying unfinished software and describing what confused them;
- can use a phone during the session;
- can set aside 30–45 uninterrupted minutes;
- have a real but non-urgent wedding workflow to compare against Zania;
- will permit clearly labelled test records in their account;
- understand that no payment, booking or vendor selection will happen automatically.

For the first couple/vendor journey, prefer a wedding that is at least several
weeks away. Avoid a wedding in crisis, an active payment dispute, or documents
containing unusually sensitive information. A redacted or purpose-made contract
is enough for the first contract test.

## Who to approach first

1. A couple already comfortable working with the lead planner.
2. One of that couple's cooperative vendors who already supplies formal quotes.
3. A planner colleague who has never used this Zania build.
4. A vendor outside the pilot wedding who can test from a clean account.

The linked couple and connected vendor are the most important participants.
They unlock the approval, enquiry, formal quote and contract journeys that
cannot be proven with the planner account alone.

## What to ask before adding anyone

Record these answers privately in the pilot register:

- name or business name;
- intended role: couple, professional planner or vendor;
- Zania account email;
- whether the account already exists;
- wedding/client they may access;
- whether they consent to receiving one clearly labelled test enquiry or quote request;
- whether a redacted document may be used;
- phone or desktop availability;
- preferred testing window;
- permission to retain screenshots that omit unnecessary personal information.

Never ask a tester to share a password, verification code or payment credential.

## Suggested invitation messages

### Couple

> I am testing a new Zania planning assistant that lets couples tell Zania what
> they need instead of learning every screen. I would like your help with one
> 45-minute guided session using your wedding workspace. We will test summaries,
> planner approvals and documents. Nothing will be paid, booked or sent without
> showing you the exact action first. Are you comfortable participating?

### Vendor

> I am testing a new Zania workflow for wedding enquiries, formal quotes and
> contract guidance. I would like your help with two short guided sessions. You
> would receive one clearly labelled test request, return a realistic quote and
> review how Zania presents it. The test will not confirm a booking or move any
> money. Are you willing to participate?

### Independent planner

> I am testing whether a planner can use Zania by simply describing what they
> need. I need a planner who has not learned this build to try a 45-minute guided
> session. We will verify that your clients remain private and that the assistant
> keeps each client's work separate. Are you interested in helping?

### Independent vendor

> I am testing Zania's vendor assistant and account isolation. The session takes
> about 30 minutes and uses your own test workspace. We will not contact clients,
> create a booking or process money. Are you willing to try it and describe what
> feels unclear?

These are drafts for the owner to send personally. Participation must be
voluntary; no Zania action should send these invitations automatically.

## Seven-day pilot sequence

| Day | Participants | Work |
| --- | --- | --- |
| 1 | Lead planner | Recheck identity, selected client, persistent chat, tasks, budget, vendors and documents |
| 2 | Linked couple | Verify couple role, shared wedding data, premium boundary and planner approval cards |
| 3 | Independent planner and vendor | Prove unrelated same-role isolation and first-time comprehension |
| 4 | Lead planner + linked couple | Preview, reject and approve clearly labelled low-impact actions; prove replay creates no duplicate |
| 5 | Connected vendor | Deliver one reviewed enquiry and response, then one formal quote request and quote |
| 6 | Planner + couple + vendor | Compare the quote, request exact changes and verify no implicit acceptance or booking |
| 7 | Planner + couple | Review one internal or redacted external contract and verify proactive obligation signals |

Run MCP/OAuth revoke-and-reconnect after the role journeys pass. Stop immediately
for cross-account data, an unconfirmed write, duplicate records, premature
external contact, or any payment side effect.

## Session format

1. Confirm the tester's role and the wedding/client they expect to see.
2. Ask them to use their own words; do not teach them the application first.
3. Give one goal at a time, such as “find what needs attention this week.”
4. Compare Zania's answer with the relevant screen or source document.
5. For a write, inspect the preview together before the tester confirms or rejects it.
6. Ask: “What did you expect to happen next?”
7. Record the result, confusion, screenshot, IDs and cleanup in the production evidence log.

## Pilot register

Keep participant details out of the repository. The private register needs these
columns:

| Field | Purpose |
| --- | --- |
| Pilot code | Use `C1`, `V1`, `P2` in shared evidence instead of personal details |
| Role and account | Confirms the identity being tested |
| Connected wedding/client | Defines the only expected data boundary |
| Consent scope | Read-only, internal writes, email, quote or redacted document |
| Test window | Prevents unexpected messages outside the agreed session |
| Completed checks | Shows what evidence is still missing |
| Defects and retests | Links failures to their verified correction |
| Withdrawal/cleanup | Records revoked consent and removed test data |

The owner should recruit the linked couple and connected vendor first. Codex can
then guide each session, inspect the application and record technical evidence,
while the human participant controls sign-in, verification codes and the final
confirmation of any external message.
