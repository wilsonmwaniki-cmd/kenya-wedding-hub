-- Track Paystack split-payment payouts independently from charge completion.

alter table public.zania_pay_settlements
  add column if not exists reconciliation_attempts integer not null default 0,
  add column if not exists next_reconciliation_at timestamptz null,
  add column if not exists last_reconciled_at timestamptz null,
  add column if not exists last_reconciliation_error text null;

create index if not exists zania_pay_settlements_reconciliation_due_idx
  on public.zania_pay_settlements(next_reconciliation_at)
  where status in ('pending', 'scheduled');

create or replace function public.claim_zania_pay_settlement_reconciliation_batch(_limit integer default 20)
returns table (
  settlement_id uuid,
  order_id uuid,
  provider_reference text,
  provider_account_reference text,
  mode text,
  payment_paid_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select settlement.id
    from public.zania_pay_settlements settlement
    join public.zania_pay_orders payment_order on payment_order.id = settlement.order_id
    where settlement.status in ('pending', 'scheduled')
      and payment_order.status in ('paid', 'part_refunded')
      and payment_order.provider_reference is not null
      and payment_order.paid_at is not null
      and settlement.created_at <= now() - interval '1 hour'
      and coalesce(settlement.next_reconciliation_at, '-infinity'::timestamptz) <= now()
    order by settlement.created_at
    for update of settlement skip locked
    limit least(greatest(coalesce(_limit, 20), 1), 100)
  )
  update public.zania_pay_settlements settlement
  set reconciliation_attempts = settlement.reconciliation_attempts + 1,
      last_reconciled_at = now(),
      next_reconciliation_at = now() + interval '6 hours',
      updated_at = now()
  from candidates,
       public.zania_pay_orders payment_order,
       public.zania_pay_accounts payout_account
  where settlement.id = candidates.id
    and payment_order.id = settlement.order_id
    and payout_account.id = payment_order.professional_account_id
  returning settlement.id,
    payment_order.id,
    payment_order.provider_reference,
    payout_account.provider_account_reference,
    payment_order.mode,
    payment_order.paid_at;
end;
$$;

create or replace function public.finish_zania_pay_settlement_reconciliation(
  _settlement_id uuid,
  _status text,
  _provider_settlement_reference text default null,
  _expected_at timestamptz default null,
  _paid_at timestamptz default null,
  _error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _status not in ('pending', 'scheduled', 'paid', 'failed') then
    raise exception 'Invalid settlement reconciliation status';
  end if;

  update public.zania_pay_settlements settlement
  set status = _status,
      provider_settlement_reference = coalesce(nullif(trim(_provider_settlement_reference), ''), settlement.provider_settlement_reference),
      expected_at = coalesce(_expected_at, settlement.expected_at),
      paid_at = case when _status = 'paid' then coalesce(_paid_at, settlement.paid_at, now()) else settlement.paid_at end,
      last_reconciled_at = now(),
      last_reconciliation_error = nullif(trim(_error), ''),
      next_reconciliation_at = case
        when _status in ('paid', 'failed') then null
        else now() + interval '6 hours'
      end,
      updated_at = now()
  where settlement.id = _settlement_id;
end;
$$;

revoke execute on function public.claim_zania_pay_settlement_reconciliation_batch(integer)
  from public, anon, authenticated;
revoke execute on function public.finish_zania_pay_settlement_reconciliation(uuid, text, text, timestamptz, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.claim_zania_pay_settlement_reconciliation_batch(integer) to service_role;
grant execute on function public.finish_zania_pay_settlement_reconciliation(uuid, text, text, timestamptz, timestamptz, text) to service_role;

comment on function public.claim_zania_pay_settlement_reconciliation_batch(integer) is
  'Claims due Paystack settlement checks for Zania Pay orders. Service role only.';
comment on function public.finish_zania_pay_settlement_reconciliation(uuid, text, text, timestamptz, timestamptz, text) is
  'Stores the Paystack payout state matched to a Zania Pay transaction. Service role only.';
