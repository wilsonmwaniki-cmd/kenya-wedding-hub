-- Poll Paystack for refunds that remain pending when a webhook is delayed or lost.

alter table public.zania_pay_refunds
  add column if not exists reconciliation_attempts integer not null default 0,
  add column if not exists next_reconciliation_at timestamptz null,
  add column if not exists last_reconciled_at timestamptz null,
  add column if not exists last_reconciliation_error text null;

create index if not exists zania_pay_refunds_reconciliation_due_idx
  on public.zania_pay_refunds(next_reconciliation_at)
  where status = 'processing' and provider_refund_id is not null;

create or replace function public.claim_zania_pay_refund_reconciliation_batch(_limit integer default 20)
returns table (
  refund_id uuid,
  order_id uuid,
  transaction_reference text,
  provider_refund_id text,
  mode text,
  currency text,
  refund_amount numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select refund.id
    from public.zania_pay_refunds refund
    where refund.status = 'processing'
      and refund.provider_refund_id is not null
      and coalesce(refund.initiated_at, refund.created_at) <= now() - interval '1 minute'
      and coalesce(refund.next_reconciliation_at, '-infinity'::timestamptz) <= now()
    order by refund.created_at
    for update skip locked
    limit least(greatest(coalesce(_limit, 20), 1), 100)
  )
  update public.zania_pay_refunds refund
  set reconciliation_attempts = refund.reconciliation_attempts + 1,
      last_reconciled_at = now(),
      next_reconciliation_at = now() + interval '5 minutes',
      updated_at = now()
  from candidates, public.zania_pay_orders payment_order
  where refund.id = candidates.id and payment_order.id = refund.order_id
  returning refund.id, refund.order_id, payment_order.provider_reference,
    refund.provider_refund_id, payment_order.mode, payment_order.currency, refund.amount;
end;
$$;

create or replace function public.finish_zania_pay_refund_reconciliation(
  _refund_id uuid,
  _status text,
  _error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _status not in ('pending', 'verified', 'failed') then
    raise exception 'Invalid refund reconciliation status';
  end if;

  update public.zania_pay_refunds
  set last_reconciliation_error = nullif(trim(_error), ''),
      last_reconciled_at = now(),
      next_reconciliation_at = case
        when _status = 'verified' then null
        when _status = 'pending' then now() + interval '5 minutes'
        else now() + interval '15 minutes'
      end,
      updated_at = now()
  where id = _refund_id;
end;
$$;

revoke execute on function public.claim_zania_pay_refund_reconciliation_batch(integer)
  from public, anon, authenticated;
revoke execute on function public.finish_zania_pay_refund_reconciliation(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_zania_pay_refund_reconciliation_batch(integer) to service_role;
grant execute on function public.finish_zania_pay_refund_reconciliation(uuid, text, text) to service_role;

comment on function public.claim_zania_pay_refund_reconciliation_batch(integer) is
  'Internal worker claim for pending Paystack refunds. Callable only with the Supabase service role.';
