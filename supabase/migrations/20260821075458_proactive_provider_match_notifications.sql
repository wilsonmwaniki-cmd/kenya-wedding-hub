create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table if not exists public.lead_match_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  lead_request_id uuid not null references public.lead_requests(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_role text not null check (recipient_role in ('couple', 'planner')),
  category_key text not null,
  wedding_name text not null,
  action_path text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts between 0 and 5),
  available_at timestamptz not null default now(),
  last_error text null,
  resend_email_id text null,
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_request_id, recipient_user_id)
);

create index if not exists lead_match_notification_deliveries_pending_idx
  on public.lead_match_notification_deliveries (available_at, created_at)
  where status in ('pending', 'failed') and attempts < 5;

create index if not exists lead_match_notification_deliveries_recipient_idx
  on public.lead_match_notification_deliveries (recipient_user_id, created_at desc);

alter table public.lead_match_notification_deliveries enable row level security;
revoke all on table public.lead_match_notification_deliveries from public, anon, authenticated;

drop trigger if exists update_lead_match_notification_deliveries_updated_at
  on public.lead_match_notification_deliveries;
create trigger update_lead_match_notification_deliveries_updated_at
before update on public.lead_match_notification_deliveries
for each row execute function public.update_updated_at_column();

create or replace function public.set_planner_vendor_management_permission(
  target_wedding_id uuid,
  target_planner_user_id uuid,
  allowed boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to update planner access';
  end if;

  if not exists (
    select 1
    from public.wedding_memberships owner_membership
    where owner_membership.wedding_id = target_wedding_id
      and owner_membership.user_id = auth.uid()
      and owner_membership.is_owner = true
      and owner_membership.membership_status = 'active'
      and owner_membership.role in ('bride', 'groom')
  ) then
    raise exception 'Only the couple can change planner vendor access';
  end if;

  update public.wedding_memberships planner_membership
  set metadata = jsonb_set(
    coalesce(planner_membership.metadata, '{}'::jsonb),
    '{manage_vendors}',
    to_jsonb(allowed),
    true
  )
  where planner_membership.wedding_id = target_wedding_id
    and planner_membership.user_id = target_planner_user_id
    and planner_membership.role = 'planner'
    and planner_membership.membership_status = 'active';

  if not found then
    raise exception 'This planner is not attached to the wedding';
  end if;

  return allowed;
end;
$$;

revoke all on function public.set_planner_vendor_management_permission(uuid, uuid, boolean)
  from public, anon;
grant execute on function public.set_planner_vendor_management_permission(uuid, uuid, boolean)
  to authenticated;

create or replace function public.process_proactive_provider_matches(batch_limit integer default 50)
returns table(requests_matched integer, matches_created integer, deliveries_queued integer)
language plpgsql
security definer
set search_path = public, lead_marketplace_private, pg_temp
as $$
declare
  request_row record;
  recipient_row record;
  inserted_count integer;
  queued_before integer;
  queued_after integer;
  request_count integer := 0;
  match_count integer := 0;
  delivery_count integer := 0;
  action_path_value text;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'Service role required';
  end if;

  batch_limit := greatest(1, least(coalesce(batch_limit, 50), 100));

  for request_row in
    select distinct on (request.wedding_id, request.provider_type, lower(request.category_key))
      request.id,
      request.wedding_id,
      request.provider_type,
      request.category_key,
      request.max_invites,
      brief.wedding_date,
      brief.location_county,
      brief.location_town,
      brief.budget_min_kes,
      brief.budget_max_kes,
      wedding.name as wedding_name
    from public.lead_requests request
    join public.lead_briefs brief on brief.lead_request_id = request.id
    join public.weddings wedding on wedding.id = request.wedding_id
    where request.status = 'no_match'
      and request.expires_at > now()
      and wedding.status in ('draft', 'active')
      and not exists (
        select 1 from public.lead_matches existing_match
        where existing_match.lead_request_id = request.id
      )
    order by
      request.wedding_id,
      request.provider_type,
      lower(request.category_key),
      request.created_at desc
    limit batch_limit
  loop
    inserted_count := 0;

    if request_row.provider_type = 'vendor' then
      with inserted as (
        insert into public.lead_matches (
          lead_request_id,
          provider_type,
          provider_user_id,
          vendor_listing_id,
          provider_name,
          provider_category,
          match_score,
          match_reasons
        )
        select
          request_row.id,
          'vendor',
          listing.user_id,
          listing.id,
          listing.business_name,
          lead_marketplace_private.canonical_category(listing.category),
          (case
            when request_row.location_town is not null
              and lower(listing.location_town) = lower(request_row.location_town) then 6
            when request_row.location_county is not null
              and lower(listing.location_county) = lower(request_row.location_county) then 4
            when request_row.location_county is not null and exists (
              select 1 from unnest(coalesce(listing.service_areas, '{}')) area
              where lower(area) = lower(request_row.location_county)
            ) then 3
            when listing.travel_scope = 'nationwide' then 1
            else 0
          end)
          + (case when request_row.budget_min_kes is not null
            and listing.minimum_budget_kes <= request_row.budget_max_kes
            and listing.maximum_budget_kes >= request_row.budget_min_kes
            then 2 else 0 end),
          array_remove(array[
            case
              when request_row.location_town is not null
                and lower(listing.location_town) = lower(request_row.location_town) then 'Near the wedding location'
              when request_row.location_county is not null
                and lower(listing.location_county) = lower(request_row.location_county) then 'Serves the wedding county'
              when listing.travel_scope = 'nationwide' then 'Available nationwide'
              else 'Serves the wedding area'
            end,
            case when request_row.budget_min_kes is not null
              and listing.minimum_budget_kes <= request_row.budget_max_kes
              and listing.maximum_budget_kes >= request_row.budget_min_kes
              then 'Fits the budget range' end
          ], null)
        from public.vendor_listings listing
        where listing.user_id is not null
          and listing.is_approved = true
          and listing.is_verified = true
          and listing.subscription_status = 'active'
          and (listing.subscription_expires_at is null or listing.subscription_expires_at > now())
          and listing.minimum_budget_kes is not null
          and listing.maximum_budget_kes is not null
          and lead_marketplace_private.canonical_category(listing.category) = request_row.category_key
          and (
            request_row.location_county is null
            or lower(listing.location_county) = lower(request_row.location_county)
            or exists (
              select 1 from unnest(coalesce(listing.service_areas, '{}')) area
              where lower(area) = lower(request_row.location_county)
            )
            or listing.travel_scope = 'nationwide'
          )
          and (
            request_row.budget_min_kes is null
            or (
              listing.minimum_budget_kes <= request_row.budget_max_kes
              and listing.maximum_budget_kes >= request_row.budget_min_kes
            )
          )
        order by 7 desc, listing.business_name
        limit least(request_row.max_invites, 5)
        on conflict (lead_request_id, provider_user_id) do nothing
        returning id
      )
      select count(*)::integer into inserted_count from inserted;
    else
      with inserted as (
        insert into public.lead_matches (
          lead_request_id,
          provider_type,
          provider_user_id,
          provider_name,
          provider_category,
          match_score,
          match_reasons
        )
        select
          request_row.id,
          'planner',
          profile.user_id,
          coalesce(nullif(profile.company_name, ''), nullif(profile.full_name, ''), 'Wedding planner'),
          'Wedding Planner / Planning Team',
          (case
            when request_row.location_town is not null
              and lower(profile.primary_town) = lower(request_row.location_town) then 6
            when request_row.location_county is not null
              and lower(profile.primary_county) = lower(request_row.location_county) then 4
            when request_row.location_county is not null and exists (
              select 1 from unnest(coalesce(profile.service_areas, '{}')) area
              where lower(area) = lower(request_row.location_county)
            ) then 3
            when profile.travel_scope = 'nationwide' then 1
            else 0
          end)
          + (case when request_row.budget_min_kes is not null
            and profile.minimum_budget_kes <= request_row.budget_max_kes
            and profile.maximum_budget_kes >= request_row.budget_min_kes
            then 2 else 0 end),
          array_remove(array[
            case
              when request_row.location_town is not null
                and lower(profile.primary_town) = lower(request_row.location_town) then 'Near the wedding location'
              when request_row.location_county is not null
                and lower(profile.primary_county) = lower(request_row.location_county) then 'Serves the wedding county'
              when profile.travel_scope = 'nationwide' then 'Available nationwide'
              else 'Serves the wedding area'
            end,
            case when request_row.budget_min_kes is not null
              and profile.minimum_budget_kes <= request_row.budget_max_kes
              and profile.maximum_budget_kes >= request_row.budget_min_kes
              then 'Works with this wedding budget' end
          ], null)
        from public.profiles profile
        where profile.role = 'planner'
          and profile.planner_type is distinct from 'committee'
          and profile.planner_verified = true
          and profile.planner_subscription_status = 'active'
          and (profile.planner_subscription_expires_at is null or profile.planner_subscription_expires_at > now())
          and profile.minimum_budget_kes is not null
          and profile.maximum_budget_kes is not null
          and (
            request_row.location_county is null
            or lower(profile.primary_county) = lower(request_row.location_county)
            or exists (
              select 1 from unnest(coalesce(profile.service_areas, '{}')) area
              where lower(area) = lower(request_row.location_county)
            )
            or profile.travel_scope = 'nationwide'
          )
          and (
            request_row.budget_min_kes is null
            or (
              profile.minimum_budget_kes <= request_row.budget_max_kes
              and profile.maximum_budget_kes >= request_row.budget_min_kes
            )
          )
        order by 6 desc, coalesce(profile.company_name, profile.full_name)
        limit least(request_row.max_invites, 5)
        on conflict (lead_request_id, provider_user_id) do nothing
        returning id
      )
      select count(*)::integer into inserted_count from inserted;
    end if;

    if inserted_count > 0 then
      action_path_value := '/vendors?leadRequest=' || request_row.id::text || '#provider-matching';
      update public.lead_requests
      set status = 'matched', updated_at = now()
      where id = request_row.id and status = 'no_match';

      request_count := request_count + 1;
      match_count := match_count + inserted_count;

      for recipient_row in
        select
          membership.user_id,
          case when membership.role = 'planner' then 'planner' else 'couple' end as recipient_role
        from public.wedding_memberships membership
        where membership.wedding_id = request_row.wedding_id
          and membership.user_id is not null
          and membership.membership_status = 'active'
          and (
            (
              membership.is_owner = true
              and membership.role in ('bride', 'groom')
            )
            or (
              membership.role = 'planner'
              and lower(coalesce(membership.metadata ->> 'manage_vendors', 'false')) = 'true'
            )
          )
      loop
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
          dedupe_key,
          metadata
        ) values (
          recipient_row.user_id,
          recipient_row.recipient_role,
          request_row.wedding_id,
          'lead_request',
          request_row.id,
          'update',
          'action',
          'unread',
          'A suitable ' || request_row.category_key || ' is now available',
          'The match fits the wedding location and budget range.',
          'View match',
          action_path_value,
          'proactive-provider-match-' || request_row.id::text,
          jsonb_build_object(
            'lead_request_id', request_row.id,
            'category_key', request_row.category_key,
            'match_count', inserted_count
          )
        )
        on conflict (recipient_user_id, dedupe_key) do nothing;

        select count(*)::integer into queued_before
        from public.lead_match_notification_deliveries
        where lead_request_id = request_row.id
          and recipient_user_id = recipient_row.user_id;

        insert into public.lead_match_notification_deliveries (
          lead_request_id,
          recipient_user_id,
          recipient_role,
          category_key,
          wedding_name,
          action_path
        ) values (
          request_row.id,
          recipient_row.user_id,
          recipient_row.recipient_role,
          request_row.category_key,
          request_row.wedding_name,
          action_path_value
        )
        on conflict (lead_request_id, recipient_user_id) do nothing;

        select count(*)::integer into queued_after
        from public.lead_match_notification_deliveries
        where lead_request_id = request_row.id
          and recipient_user_id = recipient_row.user_id;

        delivery_count := delivery_count + greatest(0, queued_after - queued_before);
      end loop;
    end if;
  end loop;

  return query select request_count, match_count, delivery_count;
end;
$$;

revoke all on function public.process_proactive_provider_matches(integer)
  from public, anon, authenticated;
grant execute on function public.process_proactive_provider_matches(integer) to service_role;

create or replace function public.claim_lead_match_notification_deliveries(batch_limit integer default 25)
returns table(
  delivery_id uuid,
  recipient_user_id uuid,
  recipient_email text,
  recipient_name text,
  recipient_role text,
  category_key text,
  wedding_name text,
  action_path text,
  attempt_number integer
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'Service role required';
  end if;

  batch_limit := greatest(1, least(coalesce(batch_limit, 25), 50));

  return query
  with picked as (
    select delivery.id
    from public.lead_match_notification_deliveries delivery
    where delivery.status in ('pending', 'failed')
      and delivery.available_at <= now()
      and delivery.attempts < 5
    order by delivery.created_at
    limit batch_limit
    for update skip locked
  ), claimed as (
    update public.lead_match_notification_deliveries delivery
    set status = 'sending',
        attempts = delivery.attempts + 1,
        last_error = null,
        updated_at = now()
    from picked
    where delivery.id = picked.id
    returning delivery.*
  )
  select
    claimed.id,
    claimed.recipient_user_id,
    account.email::text,
    coalesce(nullif(profile.full_name, ''), split_part(account.email::text, '@', 1)),
    claimed.recipient_role,
    claimed.category_key,
    claimed.wedding_name,
    claimed.action_path,
    claimed.attempts
  from claimed
  join auth.users account on account.id = claimed.recipient_user_id
  left join public.profiles profile on profile.user_id = claimed.recipient_user_id
  where account.deleted_at is null
    and account.email is not null;
end;
$$;

revoke all on function public.claim_lead_match_notification_deliveries(integer)
  from public, anon, authenticated;
grant execute on function public.claim_lead_match_notification_deliveries(integer) to service_role;

create or replace function public.complete_lead_match_notification_delivery(
  delivery_id_input uuid,
  delivered boolean,
  resend_email_id_input text default null,
  error_message_input text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'Service role required';
  end if;

  update public.lead_match_notification_deliveries delivery
  set status = case
        when delivered then 'sent'
        when delivery.attempts >= 5 then 'failed'
        else 'pending'
      end,
      available_at = case
        when delivered then delivery.available_at
        else now() + make_interval(mins => least(60, greatest(2, delivery.attempts * 5)))
      end,
      last_error = case when delivered then null else left(error_message_input, 1000) end,
      resend_email_id = case when delivered then resend_email_id_input else delivery.resend_email_id end,
      sent_at = case when delivered then now() else delivery.sent_at end,
      updated_at = now()
  where delivery.id = delivery_id_input
    and delivery.status = 'sending';
end;
$$;

revoke all on function public.complete_lead_match_notification_delivery(uuid, boolean, text, text)
  from public, anon, authenticated;
grant execute on function public.complete_lead_match_notification_delivery(uuid, boolean, text, text)
  to service_role;

do $$
begin
  if exists (select 1 from vault.decrypted_secrets where name = 'zania_project_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'zania_anon_key') then
    perform cron.schedule(
      'send-proactive-provider-match-notifications',
      '* * * * *',
      $job$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'zania_project_url')
            || '/functions/v1/send-lead-match-notifications',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'zania_anon_key'),
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'zania_anon_key')
          ),
          body := jsonb_build_object('source', 'cron', 'requested_at', now()),
          timeout_milliseconds := 15000
        );
      $job$
    );
  end if;
end;
$$;
;
