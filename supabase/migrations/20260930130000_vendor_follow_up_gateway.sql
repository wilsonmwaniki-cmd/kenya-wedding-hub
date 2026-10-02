alter table public.vendor_follow_up_reminders
  add column if not exists gateway_idempotency_key uuid;

create unique index if not exists vendor_follow_up_reminders_gateway_idempotency_key_unique
  on public.vendor_follow_up_reminders (gateway_idempotency_key);

alter table public.intelligence_gateway_confirmations
  add column if not exists result_vendor_follow_up_id uuid
  references public.vendor_follow_up_reminders(id) on delete set null;

alter table public.intelligence_gateway_confirmations
  drop constraint if exists intelligence_gateway_confirmations_capability_check;

alter table public.intelligence_gateway_confirmations
  add constraint intelligence_gateway_confirmations_capability_check
  check (capability in (
    'create_task',
    'update_task',
    'add_guest',
    'record_expense',
    'create_vendor_follow_up_reminder'
  ));

create or replace function public.create_vendor_follow_up_reminder_gateway(
  target_vendor_id uuid,
  title_input text,
  notes_input text default null,
  due_date_input date default null,
  gateway_idempotency_key_input uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_vendor record;
  existing_reminder record;
  reminder_id uuid;
  normalized_title text := nullif(trim(title_input), '');
  normalized_notes text := nullif(trim(notes_input), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if gateway_idempotency_key_input is null then
    raise exception 'Gateway idempotency key is required.';
  end if;

  if normalized_title is null then
    raise exception 'Reminder title is required.';
  end if;

  select v.id, v.vendor_listing_id
  into target_vendor
  from public.vendors v
  join public.vendor_listings vl on vl.id = v.vendor_listing_id
  where v.id = target_vendor_id
    and vl.user_id = auth.uid()
    and public.vendor_listing_has_full_access(vl.id);

  if not found then
    raise exception 'You do not have access to create reminders for this booking.'
      using errcode = '42501';
  end if;

  select *
  into existing_reminder
  from public.vendor_follow_up_reminders
  where gateway_idempotency_key = gateway_idempotency_key_input
    and created_by_user_id = auth.uid();

  if found then
    if existing_reminder.vendor_id <> target_vendor.id
      or existing_reminder.title <> normalized_title
      or existing_reminder.notes is distinct from normalized_notes
      or existing_reminder.due_date is distinct from due_date_input then
      raise exception 'Gateway idempotency key is already attached to a different reminder.';
    end if;
    return existing_reminder.id;
  end if;

  insert into public.vendor_follow_up_reminders (
    vendor_id,
    vendor_listing_id,
    created_by_user_id,
    title,
    notes,
    due_date,
    gateway_idempotency_key
  )
  values (
    target_vendor.id,
    target_vendor.vendor_listing_id,
    auth.uid(),
    normalized_title,
    normalized_notes,
    due_date_input,
    gateway_idempotency_key_input
  )
  returning id into reminder_id;

  return reminder_id;
end;
$$;

revoke all on function public.create_vendor_follow_up_reminder_gateway(uuid, text, text, date, uuid) from public;
revoke all on function public.create_vendor_follow_up_reminder_gateway(uuid, text, text, date, uuid) from anon;
grant execute on function public.create_vendor_follow_up_reminder_gateway(uuid, text, text, date, uuid) to authenticated;
