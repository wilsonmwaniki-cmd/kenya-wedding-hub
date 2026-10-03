-- Surface confirmed agreement payment dates through the existing Zania
-- Attention inbox. This derives read-only signals from trusted structured
-- evidence. It does not create a task, payment, invoice, reminder delivery or
-- money movement.

create or replace function public.refresh_agreement_obligation_attention(
  _agreement_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  agreement public.vendor_agreement_records%rowtype;
  contract public.professional_contracts%rowtype;
  schedule jsonb := '[]'::jsonb;
  entry jsonb;
  recipient record;
  due_date_value date;
  amount_value numeric;
  currency_value text;
  contract_title text;
  vendor_name text;
  wedding_name text;
  item_key text;
  current_keys text[] := array[]::text[];
  recipient_ids uuid[] := array[]::uuid[];
  created_count integer := 0;
begin
  select * into agreement
  from public.vendor_agreement_records
  where id = _agreement_id;

  if agreement.id is null then
    return 0;
  end if;

  select * into contract
  from public.professional_contracts
  where id = agreement.contract_id;

  select v.name into vendor_name
  from public.vendors v
  where v.id = agreement.vendor_id;

  select w.name into wedding_name
  from public.weddings w
  where w.id = agreement.wedding_id;

  if agreement.state in ('reviewed', 'signed', 'active') then
    schedule := case
      when contract.id is not null then coalesce(contract.payment_schedule, '[]'::jsonb)
      else coalesce(agreement.contract_snapshot -> 'paymentSchedule', '[]'::jsonb)
    end;
  end if;

  if jsonb_typeof(schedule) is distinct from 'array' then
    schedule := '[]'::jsonb;
  end if;

  currency_value := upper(coalesce(
    nullif(contract.currency, ''),
    nullif(agreement.contract_snapshot ->> 'currency', ''),
    'KES'
  ));
  contract_title := coalesce(
    nullif(contract.title, ''),
    nullif(agreement.contract_snapshot ->> 'title', ''),
    'Confirmed contract'
  );
  vendor_name := coalesce(nullif(vendor_name, ''), nullif(agreement.contract_snapshot ->> 'vendorName', ''), 'Vendor');

  for recipient in
    select distinct candidates.user_id, candidates.recipient_role
    from (
      select
        wm.user_id,
        case when p.role::text = 'planner' then 'planner' else 'couple' end as recipient_role
      from public.wedding_memberships wm
      join public.profiles p on p.user_id = wm.user_id
      where wm.wedding_id = agreement.wedding_id
        and wm.membership_status = 'active'
        and wm.user_id is not null
        and wm.role in ('bride', 'groom', 'planner')
        and p.role::text in ('couple', 'planner')

      union

      select
        w.created_by_user_id,
        case when p.role::text = 'planner' then 'planner' else 'couple' end
      from public.weddings w
      join public.profiles p on p.user_id = w.created_by_user_id
      where w.id = agreement.wedding_id
        and w.created_by_user_id is not null
        and p.role::text in ('couple', 'planner')
    ) candidates
  loop
    recipient_ids := array_append(recipient_ids, recipient.user_id);

    for entry in select value from jsonb_array_elements(schedule)
    loop
      if nullif(btrim(entry ->> 'title'), '') is null
        or coalesce(entry ->> 'amount', '') !~ '^\d+(\.\d{1,2})?$'
        or coalesce(entry ->> 'dueDate', '') !~ '^\d{4}-\d{2}-\d{2}$'
      then
        continue;
      end if;

      amount_value := (entry ->> 'amount')::numeric;
      due_date_value := (entry ->> 'dueDate')::date;
      item_key := 'agreement_obligation:' || agreement.id::text || ':payment:' ||
        md5(lower(btrim(entry ->> 'title')) || '|' || amount_value::text || '|' || due_date_value::text || '|' || currency_value);
      if not item_key = any(current_keys) then
        current_keys := array_append(current_keys, item_key);
      end if;

      insert into public.attention_items (
        recipient_user_id,
        recipient_role,
        wedding_id,
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
      ) values (
        recipient.user_id,
        recipient.recipient_role,
        agreement.wedding_id,
        'agreement_obligation',
        agreement.id,
        'action',
        case
          when due_date_value <= current_date then 'urgent'
          when due_date_value <= current_date + 14 then 'action'
          else 'info'
        end,
        'unread',
        'Contract payment: ' || btrim(entry ->> 'title'),
        currency_value || ' ' || trim(to_char(amount_value, 'FM999G999G999G990D00')) ||
          ' is recorded for ' || to_char(due_date_value, 'DD Mon YYYY') ||
          '. Review the confirmed contract before recording a payment.',
        'Review agreement',
        '/received-documents',
        due_date_value::timestamp at time zone 'Africa/Nairobi',
        item_key,
        jsonb_build_object(
          'agreement_id', agreement.id,
          'wedding_name', wedding_name,
          'vendor_name', vendor_name,
          'contract_title', contract_title,
          'obligation_kind', 'payment',
          'obligation_title', btrim(entry ->> 'title'),
          'amount', amount_value,
          'currency', currency_value,
          'due_date', due_date_value,
          'evidence_source', case
            when agreement.contract_snapshot ->> 'sourceType' = 'external_pdf' then 'confirmed_external_contract'
            else 'zania_contract'
          end
        )
      )
      on conflict (recipient_user_id, dedupe_key) do update set
        recipient_role = excluded.recipient_role,
        wedding_id = excluded.wedding_id,
        priority = excluded.priority,
        title = excluded.title,
        summary = excluded.summary,
        action_label = excluded.action_label,
        action_path = excluded.action_path,
        due_at = excluded.due_at,
        metadata = excluded.metadata,
        status = case
          when attention_items.status in ('completed', 'dismissed') then attention_items.status
          else 'unread'
        end,
        read_at = case
          when attention_items.status in ('completed', 'dismissed') then attention_items.read_at
          else null
        end;

      created_count := created_count + 1;
    end loop;
  end loop;

  update public.attention_items item
  set
    status = 'completed',
    read_at = coalesce(item.read_at, now()),
    completed_at = coalesce(item.completed_at, now())
  where item.source_type = 'agreement_obligation'
    and item.source_id = agreement.id
    and item.status in ('unread', 'read')
    and (
      cardinality(current_keys) = 0
      or not (item.dedupe_key = any(current_keys))
      or cardinality(recipient_ids) = 0
      or not (item.recipient_user_id = any(recipient_ids))
    );

  return created_count;
end;
$$;

create or replace function public.sync_agreement_obligation_attention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and new.contract_id is not distinct from old.contract_id
    and new.contract_snapshot is not distinct from old.contract_snapshot
    and new.state is not distinct from old.state
    and new.review_status is not distinct from old.review_status
  then
    return new;
  end if;

  perform public.refresh_agreement_obligation_attention(new.id);
  return new;
end;
$$;

drop trigger if exists sync_agreement_obligation_attention_trigger
  on public.vendor_agreement_records;
create trigger sync_agreement_obligation_attention_trigger
after insert or update of contract_id, contract_snapshot, state, review_status
on public.vendor_agreement_records
for each row execute function public.sync_agreement_obligation_attention();

revoke all on function public.refresh_agreement_obligation_attention(uuid)
  from public, anon, authenticated;
revoke all on function public.sync_agreement_obligation_attention()
  from public, anon, authenticated;

-- Backfill existing reviewed agreements. Closed attention items keep their
-- state, and the stable evidence fingerprint prevents duplicates.
do $$
declare
  agreement_id uuid;
begin
  for agreement_id in
    select id
    from public.vendor_agreement_records
    where state in ('reviewed', 'signed', 'active')
  loop
    perform public.refresh_agreement_obligation_attention(agreement_id);
  end loop;
end;
$$;

comment on function public.refresh_agreement_obligation_attention(uuid) is
  'Creates role-scoped Zania Attention signals from confirmed structured contract payment dates. It creates no tasks, payments, messages or money movement.';
