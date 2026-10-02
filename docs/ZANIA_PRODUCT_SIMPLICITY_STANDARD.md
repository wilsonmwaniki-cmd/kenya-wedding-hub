# Zania Product Simplicity Standard

Zania must be child-usable and adult-respectful. A first-time user aged nine or older should be able to complete the main task on a screen without coaching, understand whether it worked, and explain what happens next.

This standard complements `ZANIA_DESIGN_BIBLE.md` and `ZANIA_UI_SYSTEM.md`. The design bible controls visual character; this document controls cognitive load and action clarity.

## 1. One screen, one job

- State the page purpose in one short sentence.
- Show one dominant primary action.
- Keep supporting actions visually secondary.
- Do not repeat the primary action in multiple cards or sections.
- Reveal history, advanced controls, and full records only when opened.

## 2. Content limits

- Prefer button labels of two or three words.
- Use one idea per heading and one idea per sentence.
- Keep help text to two short lines or less.
- Prefer sentences below 15 words.
- Do not repeat information already visible nearby.
- Replace internal terminology with familiar verbs: Add, Choose, Pay, Send, Save, Remove, Review.

## 3. Forms and onboarding

- Never ask for information Zania already knows or can safely infer.
- Never ask the user to choose the same role or workspace twice.
- Ask for one related group of answers at a time.
- Mark optional fields clearly and defer them when possible.
- Preserve answers through signup, authentication, Back, and refresh.
- Show progress for multi-step flows.
- Use safe defaults and explain only unusual consequences.

## 4. Action and state model

Every open item must expose:

1. What happened.
2. Who acts next.
3. What that person should do.
4. What completion looks like.

Record state and attention state are different. The database may preserve a detailed workflow state, while each role sees a plain-language action state.

Do not show `Pending` by itself. Use labels such as `Waiting for vendor to sign` or `Review and approve`.

## 5. Interaction and mobile rules

- Buttons must look clickable; a primary action cannot look like plain text.
- Interactive targets must be at least 44 by 44 CSS pixels on mobile.
- Never rely on colour alone to communicate status.
- Do not use decorative icons.
- Do not use an icon-only action when a short label is clearer.
- Keep mobile working lists as compact rows, not tall cards.
- Keep important amounts and status labels on one line when practical.
- Destructive changes require confirmation or a recoverable Undo action.
- Respect reduced-motion preferences and keep transitions subtle.

## 6. Empty, loading, success, and error states

- Empty states show one useful next action.
- Loading states preserve the page shape and identify the work in progress.
- Success states confirm what changed and what happens next.
- Error states explain the recovery action in plain language.
- User-entered information must remain available after a recoverable error.

## 7. Release-aware navigation

- Production navigation shows only features available in production.
- Unreleased features do not compete with active work.
- A single quiet `Coming soon` destination may describe future features.
- Staging may expose all features for testing.

## 8. Wedding Home standard

Wedding Home shows, in order:

1. Wedding identity and date.
2. One `Do this next` action.
3. Compact Budget, Tasks, and Vendors summaries.
4. Up to three meaningful upcoming actions.
5. A quiet route to settings and the planning team.

It must not repeat the next action, display decorative metrics, or reproduce every workspace module.

## 9. Child-usability release test

Before release, a first-time user should complete at least four of these five tasks without coaching:

1. Change the wedding budget.
2. Change the guest count.
3. Remove an unnecessary budget category.
4. Find the next wedding task.
5. Save the plan.

The user must also be able to say what happens next within five seconds of opening each tested screen.

## 10. Seven-question release gate

1. Who is this page for?
2. What is its one job?
3. What should the user do next?
4. Is that action obvious without coaching?
5. What information was deliberately hidden?
6. Can the main task be completed clearly on mobile?
7. Are permissions, ownership, and recovery states correct?

When more information does not improve understanding of what matters or what to do next, remove it.
