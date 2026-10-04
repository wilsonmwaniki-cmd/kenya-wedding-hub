# Planner Network Ingestion — Deferred Product Direction

Status: **DEFERRED until the production role-validation and initial proactive-monitoring exit criteria pass.**

Recorded 4 October 2026.

## Product promise

> Bring the network you already have. Zania will organize it for you.

A professional planner should receive value from Zania without first persuading
their vendors or former clients to create Zania accounts. Vendor signup may
improve the experience later, but it must not be required for the planner to use
their existing network.

This is a productivity capability inside the Intelligence Gateway, not a social
feed or a public directory expansion. It should let the conversational planner
understand requests such as:

- “Add my usual florist to the Kamau wedding.”
- “Which photographers in my network work in Naivasha?”
- “Who was the DJ I used last December?”

## Architectural boundary

Keep identity separate from relationship:

- A vendor identity may eventually resolve to one Zania business.
- Each planner's relationship with that vendor remains a separate private
  record containing notes, preferences, pricing context and work history.
- Importing a contact never publishes a profile or exposes one planner's
  network to another planner or to the vendor.

Build from the existing `professional_contacts`, private vendor candidates,
Vendor Discovery, vendor tracker, workspace invite and vendor-claim foundations.
Do not introduce a second parallel contacts system.

## Recommended delivery sequence

1. Private **My Network** foundation: manual entry, pasted lists and CSV import;
   vendor/client/unknown classification; categories, service areas, preferred
   status and private notes; bulk review; use an imported vendor on a planner
   client's wedding without vendor signup.
2. Planner-local normalization and duplicate detection using phone, email and
   business-name evidence. Ambiguous matches require review.
3. Optional, source-backed enrichment through Vendor Discovery. Planner-supplied
   private data and public business evidence remain distinguishable.
4. Planner-controlled invitations and claiming through the existing workspace
   invite infrastructure. Zania never emails imported contacts automatically.
5. Cross-planner entity resolution and the broader industry relationship graph
   only after real planner usage proves the need and privacy model.

The first milestone is complete when a planner can import a real vendor list,
review it in minutes, and immediately use the correct private vendor in a client
wedding without that vendor joining Zania.

## Revisit gate

Revisit implementation after:

- the production couple, planner and vendor role journeys pass;
- unrelated same-role isolation passes;
- the linked planner-to-couple approval journey passes;
- one consenting vendor completes the enquiry, formal quote and contract path;
- the first confirmed agreement-deadline monitoring signal is verified; and
- no unresolved severity-one or severity-two defect remains.

When work resumes, start with three active planners who currently manage vendor
networks in spreadsheets, phone contacts or WhatsApp. Their real export formats
should shape the import schema and review experience before broader enrichment
or network-growth mechanisms are built.
