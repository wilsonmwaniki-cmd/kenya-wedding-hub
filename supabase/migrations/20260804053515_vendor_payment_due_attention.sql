create or replace function public.sync_vendor_payment_due_attention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_wedding_id uuid;
  event_id_value uuid;
  event_key text;
  outstanding_amount numeric;
  reminder_priority text;
  recipient record;
begin
  if tg_op = 'UPDATE'
    and new.payment_due_date is not distinct from old.payment_due_date
    and new.payment_status is not distinct from old.payment_status
    and new.price is not distinct from old.price
    and new.amount_paid is not distinct from old.amount_paid
    and new.name is not distinct from old.name then
    return new;
  end if;

  select coalesce(new.wedding_id, client.wedding_id)
  into resolved_wedding_id
  from (select 1) seed
  left join public.planner_clients client on client.id = new.client_id;

  outstanding_amount := greatest(coalesce(new.price, 0) - coalesce(new.amount_paid, 0), 0);
  event_key := 'vendor:' || new.id::text || ':payment_due';

  if new.payment_due_date is null or new.payment_status = 'paid_full' or outstanding_amount <= 0 then
    update public.attention_items
    set
      status = 'completed',
      read_at = coalesce(read_at, now()),
      completed_at = coalesce(completed_at, now())
    where source_type = 'vendor_payment_due'
      and source_id = new.id
      and status not in ('completed', 'dismissed');

    return new;
  end if;

  reminder_priority := case
    when new.payment_due_date <= current_date then 'urgent'
    when new.payment_due_date <= current_date + 14 then 'action'
    else 'info'
  end;

  event_id_value := public.record_workspace_event(
    resolved_wedding_id,
    'vendor.payment_due_scheduled',
    'vendor',
    new.id,
    'Vendor payment scheduled',
    new.name || ' · due ' || to_char(new.payment_due_date, 'DD Mon YYYY'),
    event_key,
    jsonb_build_object(
      'vendor_id', new.id,
      'vendor_name', new.name,
      'payment_due_date', new.payment_due_date,
      'outstanding_amount', outstanding_amount
    )
  );

  for recipient in
    select distinct candidate.user_id, candidate.recipient_role
    from (
      select
        new.user_id as user_id,
        case when profile.role in ('planner', 'vendor') then profile.role::text else 'couple' end as recipient_role
      from (select 1) seed
      left join public.profiles profile on profile.user_id = new.user_id

      union all

      select
        membership.user_id,
        case when profile.role in ('planner', 'vendor') then profile.role::text else 'couple' end
      from public.wedding_memberships membership
      left join public.profiles profile on profile.user_id = membership.user_id
      where membership.wedding_id = resolved_wedding_id
        and membership.membership_status = 'active'
        and membership.role in ('bride', 'groom', 'planner')
    ) candidate
    where candidate.user_id is not null
  loop
    insert into public.attention_items (
      recipient_user_id,
      recipient_role,
      wedding_id,
      event_id,
      source_type,
      source_id,
      attention_kind,
      priority,
      status,
      title,
      summary,
      action_label,
      action_path,
      due_at,
      dedupe_key,
      metadata
    )
    values (
      recipient.user_id,
      recipient.recipient_role,
      resolved_wedding_id,
      event_id_value,
      'vendor_payment_due',
      new.id,
      'action',
      reminder_priority,
      'unread',
      'Payment due for ' || new.name,
      'KES ' || trim(to_char(outstanding_amount, 'FM999G999G999G990')) || ' remains to be paid by ' || to_char(new.payment_due_date, 'DD Mon YYYY') || '.',
      'Review payment plan',
      '/vendors',
      new.payment_due_date::timestamp at time zone 'Africa/Nairobi',
      event_key || ':recipient:' || recipient.user_id::text,
      jsonb_build_object(
        'vendor_id', new.id,
        'vendor_name', new.name,
        'payment_due_date', new.payment_due_date,
        'outstanding_amount', outstanding_amount
      )
    )
    on conflict (recipient_user_id, dedupe_key) do update set
      event_id = excluded.event_id,
      priority = excluded.priority,
      status = 'unread',
      title = excluded.title,
      summary = excluded.summary,
      action_label = excluded.action_label,
      action_path = excluded.action_path,
      due_at = excluded.due_at,
      read_at = null,
      completed_at = null,
      dismissed_at = null,
      metadata = excluded.metadata;
  end loop;

  return new;
end;
$$;

drop trigger if exists sync_vendor_payment_due_attention_trigger on public.vendors;
create trigger sync_vendor_payment_due_attention_trigger
after insert or update of payment_due_date, payment_status, price, amount_paid, name
on public.vendors
for each row execute function public.sync_vendor_payment_due_attention();

revoke all on function public.sync_vendor_payment_due_attention() from public, anon, authenticated;
