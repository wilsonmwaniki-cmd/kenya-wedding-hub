create index if not exists zania_pay_accounts_vendor_listing_idx
  on public.zania_pay_accounts (vendor_listing_id)
  where vendor_listing_id is not null;

create index if not exists zania_pay_disputes_order_idx
  on public.zania_pay_disputes (order_id);

create index if not exists zania_pay_orders_professional_account_idx
  on public.zania_pay_orders (professional_account_id);

create index if not exists zania_pay_orders_wedding_idx
  on public.zania_pay_orders (wedding_id);

create index if not exists zania_pay_refunds_order_idx
  on public.zania_pay_refunds (order_id);

create index if not exists zania_pay_refunds_requested_by_idx
  on public.zania_pay_refunds (requested_by);

create index if not exists zania_pay_settlements_professional_user_idx
  on public.zania_pay_settlements (professional_user_id);
