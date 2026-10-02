begin;

with ledger_totals as (
  select
    payment.budget_category_id,
    sum(payment.amount) as amount
  from public.budget_payments payment
  where payment.budget_category_id is not null
  group by payment.budget_category_id
)
update public.budget_categories category
set spent = ledger.amount
from ledger_totals ledger
where category.id = ledger.budget_category_id
  and category.spent is distinct from ledger.amount;

commit;
