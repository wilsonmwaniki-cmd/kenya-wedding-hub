# Zania Feature Work Guide

Before designing, changing, or shipping a Zania feature, read:

1. `docs/ZANIA_PROFESSIONAL_CLIENTFLOW_STRATEGY.md`
2. `docs/ZANIA_PRODUCT_SIMPLICITY_STANDARD.md`
3. `docs/ZANIA_DESIGN_BIBLE.md`

For work on Zania's conversational planner, Intelligence Gateway, AI capabilities,
MCP or other assistant clients, also read and follow:

4. `docs/ZANIA_INTELLIGENCE_GATEWAY_ARCHITECTURE.md`

Treat the Intelligence Gateway document as the architectural reference for this
product direction. Keep identity, authorization, validation, domain execution,
structured results and audit inside Zania. Keep client adapters thin, and do not
expose unrestricted database access or move permission decisions into prompts.

The clientflow strategy defines what Zania is building for Kenyan wedding professionals. The simplicity standard and design bible define how it must feel and behave. When guidance conflicts, prioritize user safety, clear payment and document records, and the simplest path to a completed real-world task.

## Staging deployment guardrail

The repository's existing Vercel link targets the production project. Never use
that link for a staging release. Deploy staging through the dedicated
`kenya-wedding-hub-staging` project (`prj_pRQWlAH7nygVKcjKbiiU1zGk2Ym8`) and
verify that the deployed browser bundle references the staging Supabase project
`wqnykfoyakuxqyeicboy` before assigning or accepting the
`staging.planwithzania.com` alias. Production must remain unchanged unless the
user explicitly authorizes a production release.
