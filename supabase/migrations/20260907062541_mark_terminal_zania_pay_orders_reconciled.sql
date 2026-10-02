update public.zania_pay_orders
set reconciliation_status = 'verified',
    last_reconciled_at = coalesce(last_reconciled_at, paid_at, updated_at),
    next_reconciliation_at = null,
    last_reconciliation_error = null,
    updated_at = now()
where status in ('paid', 'failed', 'cancelled', 'expired', 'part_refunded', 'refunded')
  and reconciliation_status <> 'verified';
