alter table public.budget_payments
  add column if not exists gateway_idempotency_key uuid,
  add column if not exists created_via text not null default 'manual';

create unique index if not exists budget_payments_gateway_idempotency_key_unique
  on public.budget_payments (gateway_idempotency_key);

alter table public.intelligence_gateway_confirmations
  add column if not exists result_payment_id uuid
  references public.budget_payments(id) on delete set null;

alter table public.intelligence_gateway_confirmations
  drop constraint if exists intelligence_gateway_confirmations_capability_check;

alter table public.intelligence_gateway_confirmations
  add constraint intelligence_gateway_confirmations_capability_check
  check (capability in (
    'create_task',
    'update_task',
    'add_guest',
    'record_expense',
    'create_vendor_follow_up_reminder',
    'record_payment'
  ));

create or replace function public.record_budget_payment_gateway(
  target_wedding_id uuid,
  target_client_id uuid,
  target_budget_category_id uuid,
  target_vendor_id uuid,
  payee_name_input text,
  amount_input numeric,
  payment_date_input date,
  reference_input text default null,
  notes_input text default null,
  gateway_idempotency_key_input uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile record;
  target_category record;
  target_vendor record;
  existing_payment record;
  payment_id uuid;
  normalized_payee text := nullif(trim(payee_name_input), '');
  normalized_reference text := nullif(trim(reference_input), '');
  normalized_notes text := nullif(trim(notes_input), '');
  vendor_total_paid numeric;
  vendor_last_payment date;
  vendor_next_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select role, planner_type into current_profile
  from public.profiles
  where user_id = auth.uid();

  if not found
    or current_profile.role not in ('couple', 'planner')
    or (current_profile.role = 'planner' and current_profile.planner_type = 'committee') then
    raise exception 'Payment recording is unavailable in this workspace.' using errcode = '42501';
  end if;

  if gateway_idempotency_key_input is null then
    raise exception 'Gateway idempotency key is required.';
  end if;
  if normalized_payee is null then
    raise exception 'Payment payee is required.';
  end if;
  if amount_input is null or amount_input <= 0 or amount_input > 1000000000 then
    raise exception 'Payment amount is outside the allowed range.';
  end if;
  if payment_date_input is null then
    raise exception 'Payment date is required.';
  end if;

  if not exists (
    select 1
    from public.wedding_memberships membership
    join public.weddings wedding on wedding.id = membership.wedding_id
    where membership.wedding_id = target_wedding_id
      and membership.user_id = auth.uid()
      and membership.membership_status = 'active'
      and membership.revoked_at is null
      and membership.role in ('bride', 'groom', 'planner')
      and wedding.status = 'active'
      and wedding.deleted_at is null
  ) then
    raise exception 'You do not have access to record payments for this wedding.' using errcode = '42501';
  end if;

  if target_client_id is not null and not exists (
    select 1 from public.planner_clients client
    where client.id = target_client_id
      and client.planner_user_id = auth.uid()
      and client.wedding_id = target_wedding_id
      and client.is_archived = false
      and client.linked_user_id is null
  ) then
    raise exception 'This planner client cannot receive a direct payment entry.' using errcode = '42501';
  end if;

  select id, name, budget_scope, spent
  into target_category
  from public.budget_categories
  where id = target_budget_category_id
    and wedding_id = target_wedding_id
    and budget_scope = 'wedding';

  if not found then
    raise exception 'The wedding budget category is no longer available.';
  end if;

  if target_vendor_id is not null then
    select id, name, price, deposit_amount
    into target_vendor
    from public.vendors
    where id = target_vendor_id
      and wedding_id = target_wedding_id;
    if not found then
      raise exception 'The linked vendor is no longer available.';
    end if;
  end if;

  select * into existing_payment
  from public.budget_payments
  where gateway_idempotency_key = gateway_idempotency_key_input
    and user_id = auth.uid();

  if found then
    if existing_payment.wedding_id <> target_wedding_id
      or existing_payment.client_id is distinct from target_client_id
      or existing_payment.budget_category_id is distinct from target_budget_category_id
      or existing_payment.vendor_id is distinct from target_vendor_id
      or existing_payment.payee_name <> normalized_payee
      or existing_payment.amount <> round(amount_input, 2)
      or existing_payment.payment_date <> payment_date_input
      or existing_payment.reference is distinct from normalized_reference
      or existing_payment.notes is distinct from normalized_notes then
      raise exception 'Gateway idempotency key is already attached to a different payment.';
    end if;
    return existing_payment.id;
  end if;

  insert into public.budget_payments (
    user_id,
    client_id,
    wedding_id,
    budget_category_id,
    vendor_id,
    budget_scope,
    category_name,
    payee_name,
    amount,
    payment_date,
    reference,
    notes,
    gateway_idempotency_key,
    created_via
  ) values (
    auth.uid(),
    target_client_id,
    target_wedding_id,
    target_category.id,
    target_vendor_id,
    'wedding',
    target_category.name,
    normalized_payee,
    round(amount_input, 2),
    payment_date_input,
    normalized_reference,
    normalized_notes,
    gateway_idempotency_key_input,
    'intelligence_gateway'
  ) returning id into payment_id;

  update public.budget_categories
  set spent = round((coalesce(spent, 0) + amount_input)::numeric, 2)
  where id = target_category.id;

  if target_vendor_id is not null then
    select coalesce(sum(amount), 0), max(payment_date)
    into vendor_total_paid, vendor_last_payment
    from public.budget_payments
    where vendor_id = target_vendor_id;

    vendor_next_status := case
      when coalesce(target_vendor.price, 0) > 0 and vendor_total_paid >= target_vendor.price then 'paid_full'
      when vendor_total_paid <= 0 and coalesce(target_vendor.deposit_amount, 0) > 0 then 'deposit_due'
      when vendor_total_paid <= 0 then 'unpaid'
      when coalesce(target_vendor.deposit_amount, 0) > 0 and vendor_total_paid = target_vendor.deposit_amount then 'deposit_paid'
      else 'part_paid'
    end;

    update public.vendors
    set amount_paid = vendor_total_paid,
        payment_status = vendor_next_status,
        last_payment_at = vendor_last_payment
    where id = target_vendor_id;
  end if;

  return payment_id;
end;
$$;

revoke all on function public.record_budget_payment_gateway(uuid, uuid, uuid, uuid, text, numeric, date, text, text, uuid) from public;
revoke all on function public.record_budget_payment_gateway(uuid, uuid, uuid, uuid, text, numeric, date, text, text, uuid) from anon;
grant execute on function public.record_budget_payment_gateway(uuid, uuid, uuid, uuid, text, numeric, date, text, text, uuid) to authenticated;
