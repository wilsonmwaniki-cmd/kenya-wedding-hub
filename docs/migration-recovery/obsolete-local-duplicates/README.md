# Archived duplicate migrations

These files were removed from `supabase/migrations` during the 2026-08-21 linked-history reconciliation because equivalent migrations had already been applied to production under different versions.

| Archived local version | Applied production version | Notes |
| --- | --- | --- |
| `20260809090000_free_standalone_professional_documents.sql` | `20260809145722_free_standalone_professional_documents.sql` | Same migration; the fetched production statement includes only a trailing statement terminator difference. |
| `20260815020000_canonical_budget_categories.sql` | `20260815005716_canonical_budget_categories.sql` | Same feature; production contains the safer `greatest(existing spend, ledger spend)` calculation. |
| `20260815021500_reconcile_budget_spend_to_ledger.sql` | `20260815005851_reconcile_budget_spend_to_ledger.sql` | Same migration; the fetched production statement includes only a trailing statement terminator difference. |

They are retained here for audit and recovery only. Do not move them back into `supabase/migrations`, because the CLI would treat them as unapplied migrations and attempt to execute them again.
