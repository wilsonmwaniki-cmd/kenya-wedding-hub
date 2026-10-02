-- Isolated, role-based interactive demos.
-- Each visitor is an authenticated anonymous Supabase user with private seed data.
-- Demo users can exercise normal product CRUD, while external side effects are
-- blocked separately at the Edge Function boundary.

alter table public.profiles
  add column if not exists is_demo boolean not null default false;

create table if not exists public.demo_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  demo_role text not null check (demo_role in ('couple', 'vendor', 'planner')),
  status text not null default 'active' check (status in ('active', 'ended', 'expired')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  last_reset_at timestamptz null,
  reset_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.demo_sessions enable row level security;

revoke all on table public.demo_sessions from anon, authenticated;
grant select on table public.demo_sessions to authenticated;

drop policy if exists "Demo users can view own session" on public.demo_sessions;
create policy "Demo users can view own session"
  on public.demo_sessions for select
  to authenticated
  using (auth.uid() = user_id);

create index if not exists demo_sessions_expiry_idx
  on public.demo_sessions (expires_at)
  where status = 'active';

create schema if not exists private;
revoke all on schema private from public, anon;

create or replace function private.clear_demo_workspace(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.commercial_documents where user_id = target_user_id;
  delete from public.professional_contracts where user_id = target_user_id;
  delete from public.professional_document_templates where user_id = target_user_id;
  delete from public.budget_payments where user_id = target_user_id;
  delete from public.tasks where user_id = target_user_id;
  delete from public.budget_categories where user_id = target_user_id;
  delete from public.vendors where user_id = target_user_id;
  delete from public.guests where user_id = target_user_id;
  delete from public.planner_clients where planner_user_id = target_user_id;
  delete from public.vendor_listings where user_id = target_user_id;
  delete from public.wedding_memberships where user_id = target_user_id;
  delete from public.weddings where created_by_user_id = target_user_id;
end;
$$;

create or replace function private.seed_demo_workspace(target_user_id uuid, target_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  demo_email text := 'demo+' || replace(target_user_id::text, '-', '') || '@example.invalid';
  primary_wedding_id uuid := gen_random_uuid();
  secondary_wedding_id uuid := gen_random_uuid();
  tertiary_wedding_id uuid := gen_random_uuid();
  primary_client_id uuid;
  secondary_client_id uuid;
  tertiary_client_id uuid;
  listing_id uuid;
  vendor_id uuid;
  quote_id uuid;
  invoice_id uuid;
  receipt_id uuid;
  contract_id uuid;
  code_prefix text := upper(substr(replace(target_user_id::text, '-', ''), 1, 8));
begin
  if target_role not in ('couple', 'vendor', 'planner') then
    raise exception 'Unsupported demo role';
  end if;

  perform private.clear_demo_workspace(target_user_id);

  delete from public.user_roles where user_id = target_user_id;
  insert into public.user_roles (user_id, role)
  values (target_user_id, target_role::public.app_role)
  on conflict (user_id, role) do nothing;

  update public.profiles
  set role = target_role::public.app_role,
      is_demo = true,
      full_name = case target_role
        when 'couple' then 'Amina & Kamau'
        when 'vendor' then 'Nia Wanjiku'
        else 'Grace Njeri'
      end,
      partner_name = case when target_role = 'couple' then 'Kamau' else null end,
      company_name = case target_role
        when 'vendor' then 'Golden Hour Stories'
        when 'planner' then 'Tulia Weddings'
        else null
      end,
      company_email = case when target_role in ('vendor', 'planner') then demo_email else null end,
      company_phone = case when target_role in ('vendor', 'planner') then '+254700000000' else null end,
      planner_type = case when target_role = 'planner' then 'professional' else null end,
      planner_verified = (target_role = 'planner'),
      planner_subscription_status = case when target_role = 'planner' then 'active' else 'inactive' end,
      planner_subscription_started_at = case when target_role = 'planner' then now() else null end,
      planner_subscription_expires_at = case when target_role = 'planner' then now() + interval '24 hours' else null end,
      planning_pass_status = case when target_role = 'couple' then 'active' else 'inactive' end,
      planning_pass_started_at = case when target_role = 'couple' then now() else null end,
      planning_pass_expires_at = case when target_role = 'couple' then now() + interval '24 hours' else null end,
      beta_trial_status = case when target_role in ('vendor', 'planner') then 'active' else 'inactive' end,
      beta_trial_started_at = case when target_role in ('vendor', 'planner') then now() else null end,
      beta_trial_expires_at = case when target_role in ('vendor', 'planner') then now() + interval '24 hours' else null end,
      directory_opt_out = true,
      directory_opt_out_at = now(),
      wedding_date = case when target_role = 'couple' then current_date + 210 else null end,
      wedding_location = case when target_role = 'couple' then 'Naivasha, Kenya' else null end,
      wedding_county = case when target_role = 'couple' then 'Nakuru' else null end,
      wedding_town = case when target_role = 'couple' then 'Naivasha' else null end,
      wedding_budget_goal = case when target_role = 'couple' then 1800000 else null end,
      expected_guest_count = case when target_role = 'couple' then 140 else null end,
      updated_at = now()
  where user_id = target_user_id;

  if target_role = 'couple' then
    insert into public.weddings (
      id, name, wedding_code, status, wedding_date, location_county,
      location_town, created_by_user_id, is_meaningful, metadata
    ) values (
      primary_wedding_id, 'Amina & Kamau', 'DEMO-' || code_prefix || '-1', 'active',
      current_date + 210, 'Nakuru', 'Naivasha', target_user_id, true,
      jsonb_build_object('demo', true)
    );

    insert into public.wedding_memberships (
      wedding_id, user_id, email, role, membership_status, is_owner,
      accepted_at, metadata
    ) values (
      primary_wedding_id, target_user_id, demo_email, 'bride', 'active', true,
      now(), jsonb_build_object('demo', true)
    );

    insert into public.budget_categories (user_id, wedding_id, name, allocated, spent, budget_scope)
    values
      (target_user_id, primary_wedding_id, 'Venue', 420000, 120000, 'wedding'),
      (target_user_id, primary_wedding_id, 'Catering', 510000, 175000, 'wedding'),
      (target_user_id, primary_wedding_id, 'Photography', 190000, 95000, 'wedding'),
      (target_user_id, primary_wedding_id, 'Décor', 260000, 60000, 'wedding'),
      (target_user_id, primary_wedding_id, 'Entertainment', 140000, 0, 'wedding'),
      (target_user_id, primary_wedding_id, 'Attire & beauty', 180000, 45000, 'wedding'),
      (target_user_id, primary_wedding_id, 'Transport', 100000, 0, 'wedding');

    insert into public.tasks (user_id, wedding_id, title, description, due_date, completed, category, phase, priority_level)
    values
      (target_user_id, primary_wedding_id, 'Review the photographer contract', 'Confirm the cancellation and delivery terms.', current_date + 4, false, 'Photography', 'selection_booking', 3),
      (target_user_id, primary_wedding_id, 'Confirm final guest estimate', 'Share the latest count with the caterer.', current_date + 12, false, 'Guests', 'foundation', 2),
      (target_user_id, primary_wedding_id, 'Choose the reception playlist', 'Add your first-dance song and family requests.', current_date + 32, false, 'Entertainment', 'closure_final_payment', 1),
      (target_user_id, primary_wedding_id, 'Book the venue', 'Deposit paid and date confirmed.', current_date - 20, true, 'Venue', 'selection_booking', 3),
      (target_user_id, primary_wedding_id, 'Shortlist photographers', 'Compared three packages.', current_date - 9, true, 'Photography', 'research', 2);

    insert into public.vendors (
      id, user_id, wedding_id, name, category, phone, email, price,
      selection_status, status, contract_status, payment_status,
      deposit_amount, amount_paid, payment_due_date, notes
    ) values
      (gen_random_uuid(), target_user_id, primary_wedding_id, 'Lakeview Gardens', 'Venue', '+254711000001', 'hello@lakeview.example', 420000, 'final', 'booked', 'signed', 'part_paid', 120000, 120000, current_date + 60, 'Ceremony lawn and reception hall.'),
      (gen_random_uuid(), target_user_id, primary_wedding_id, 'Golden Hour Stories', 'Photography', '+254711000002', 'studio@goldenhour.example', 190000, 'final', 'booked', 'sent', 'part_paid', 95000, 95000, current_date + 45, 'Natural-light photo and film package.'),
      (gen_random_uuid(), target_user_id, primary_wedding_id, 'Savanna Table', 'Catering', '+254711000003', 'events@savannatable.example', 510000, 'shortlisted', 'contacted', 'not_started', 'unpaid', 0, 0, current_date + 30, 'Menu tasting is scheduled.');

    select id into vendor_id from public.vendors
      where user_id = target_user_id and wedding_id = primary_wedding_id and category = 'Photography'
      limit 1;

    quote_id := gen_random_uuid();
    invoice_id := gen_random_uuid();
    contract_id := gen_random_uuid();

    insert into public.commercial_documents (
      id, user_id, role, document_number, document_type, status, title,
      recipient_name, recipient_email, issue_date, due_date, subtotal,
      total_amount, balance_due, currency, vendor_id, wedding_name, metadata
    ) values
      (quote_id, target_user_id, 'vendor', 'QT-DEMO-0001', 'quote', 'accepted', 'Photography package quote', 'Amina & Kamau', demo_email, current_date - 18, current_date - 11, 190000, 190000, 190000, 'KES', vendor_id, 'Amina & Kamau', jsonb_build_object('demo', true, 'demo_received', true, 'sender_name', 'Golden Hour Stories')),
      (invoice_id, target_user_id, 'vendor', 'INV-DEMO-0001', 'invoice', 'sent', 'Photography deposit invoice', 'Amina & Kamau', demo_email, current_date - 7, current_date + 7, 95000, 95000, 95000, 'KES', vendor_id, 'Amina & Kamau', jsonb_build_object('demo', true, 'demo_received', true, 'sender_name', 'Golden Hour Stories'));

    insert into public.commercial_document_items (document_id, description, quantity, unit_price, line_total, sort_order, metadata)
    values
      (quote_id, 'Wedding photography and highlight film', 1, 190000, 190000, 0, jsonb_build_object('demo', true)),
      (invoice_id, 'Booking deposit', 1, 95000, 95000, 0, jsonb_build_object('demo', true));

    insert into public.commercial_document_shares (document_id, user_id, expires_at)
    values
      (quote_id, target_user_id, now() + interval '24 hours'),
      (invoice_id, target_user_id, now() + interval '24 hours');

    insert into public.professional_contracts (
      id, user_id, role, title, recipient_name, recipient_email, event_date,
      status, summary, terms, vendor_id, wedding_name, metadata
    ) values (
      contract_id, target_user_id, 'vendor', 'Wedding photography agreement',
      'Amina & Kamau', demo_email, current_date + 210, 'sent',
      'Photography coverage, deliverables and payment schedule.',
      'This sample agreement is for demonstration only and creates no legal obligation.',
      vendor_id, 'Amina & Kamau', jsonb_build_object('demo', true, 'demo_received', true, 'sender_name', 'Golden Hour Stories')
    );

    insert into public.professional_contract_shares (contract_id, user_id, expires_at)
    values (contract_id, target_user_id, now() + interval '24 hours');

  elsif target_role = 'vendor' then
    listing_id := gen_random_uuid();
    insert into public.vendor_listings (
      id, user_id, business_name, category, description, email, phone, website,
      location, location_county, location_town, is_approved, is_verified,
      subscription_status, subscription_started_at, subscription_expires_at,
      directory_opt_out, directory_opt_out_at, services, service_areas, travel_scope
    ) values (
      listing_id, target_user_id, 'Golden Hour Stories', 'Photographer · Wedding',
      'Natural, warm wedding photography and short films across Kenya.', demo_email,
      '+254700000000', 'https://example.invalid', 'Nairobi, Kenya', 'Nairobi', 'Nairobi',
      true, true, 'active', now(), now() + interval '24 hours', true, now(),
      array['Wedding photography', 'Engagement sessions', 'Highlight films'],
      array['Nairobi', 'Kiambu', 'Nakuru'], 'selected_counties'
    );

    insert into public.vendors (
      id, user_id, vendor_listing_id, name, category, phone, email, price,
      selection_status, status, contract_status, payment_status, deposit_amount,
      amount_paid, payment_due_date, vendor_internal_notes
    ) values
      (gen_random_uuid(), target_user_id, listing_id, 'Amina & Kamau', 'Photography', '+254711100001', 'amina@example.invalid', 190000, 'final', 'booked', 'signed', 'part_paid', 95000, 95000, current_date + 45, 'Golden-hour portraits are important to this couple.'),
      (gen_random_uuid(), target_user_id, listing_id, 'Lina & David', 'Photography', '+254711100002', 'lina@example.invalid', 240000, 'shortlisted', 'contacted', 'sent', 'unpaid', 0, 0, current_date + 80, 'Awaiting a response to the custom quote.'),
      (gen_random_uuid(), target_user_id, listing_id, 'Wanjiru & Mark', 'Photography', '+254711100003', 'wanjiru@example.invalid', 165000, 'final', 'booked', 'signed', 'paid_full', 65000, 165000, current_date - 5, 'Final gallery delivery is due next week.');

    select id into vendor_id from public.vendors
      where user_id = target_user_id and vendor_listing_id = listing_id and name = 'Amina & Kamau'
      limit 1;

    quote_id := gen_random_uuid();
    invoice_id := gen_random_uuid();
    receipt_id := gen_random_uuid();
    insert into public.commercial_documents (
      id, user_id, role, document_number, document_type, status, title,
      recipient_name, recipient_email, issue_date, due_date, subtotal,
      amount_paid, total_amount, balance_due, currency, vendor_id,
      vendor_listing_id, wedding_name, metadata
    ) values
      (quote_id, target_user_id, 'vendor', 'QT-DEMO-0001', 'quote', 'sent', 'Wedding photography package', 'Lina & David', 'lina@example.invalid', current_date - 2, current_date + 5, 240000, 0, 240000, 240000, 'KES', null, listing_id, 'Lina & David', jsonb_build_object('demo', true)),
      (invoice_id, target_user_id, 'vendor', 'INV-DEMO-0001', 'invoice', 'part_paid', 'Photography booking invoice', 'Amina & Kamau', 'amina@example.invalid', current_date - 14, current_date + 7, 190000, 95000, 190000, 95000, 'KES', vendor_id, listing_id, 'Amina & Kamau', jsonb_build_object('demo', true)),
      (receipt_id, target_user_id, 'vendor', 'RCT-DEMO-0001', 'receipt', 'issued', 'Receipt for booking deposit', 'Amina & Kamau', 'amina@example.invalid', current_date - 7, null, 95000, 95000, 95000, 0, 'KES', vendor_id, listing_id, 'Amina & Kamau', jsonb_build_object('demo', true));

    insert into public.commercial_document_items (document_id, description, quantity, unit_price, line_total, sort_order, metadata)
    values
      (quote_id, 'Full-day photo and film package', 1, 240000, 240000, 0, jsonb_build_object('demo', true)),
      (invoice_id, 'Wedding photography package', 1, 190000, 190000, 0, jsonb_build_object('demo', true)),
      (receipt_id, 'Booking deposit received', 1, 95000, 95000, 0, jsonb_build_object('demo', true));

    insert into public.professional_document_templates (
      user_id, role, template_type, name, description, default_title,
      default_items, default_notes, default_terms, metadata
    ) values (
      target_user_id, 'vendor', 'quote', 'Wedding photography package',
      'A reusable sample package.', 'Wedding photography package',
      '[{"description":"Full-day photography","quantity":1,"unit_price":190000}]'::jsonb,
      'Thank you for considering Golden Hour Stories.',
      'A 50% booking deposit confirms the date.', jsonb_build_object('demo', true)
    );

  else
    insert into public.weddings (id, name, wedding_code, status, wedding_date, location_county, location_town, created_by_user_id, is_meaningful, metadata)
    values
      (primary_wedding_id, 'Amina & Kamau', 'DEMO-' || code_prefix || '-1', 'active', current_date + 210, 'Nakuru', 'Naivasha', target_user_id, true, jsonb_build_object('demo', true)),
      (secondary_wedding_id, 'Lina & David', 'DEMO-' || code_prefix || '-2', 'active', current_date + 120, 'Nairobi', 'Karen', target_user_id, true, jsonb_build_object('demo', true)),
      (tertiary_wedding_id, 'Wanjiru & Mark', 'DEMO-' || code_prefix || '-3', 'active', current_date + 330, 'Kiambu', 'Tigoni', target_user_id, true, jsonb_build_object('demo', true));

    insert into public.planner_clients (
      id, planner_user_id, client_name, partner_name, wedding_date,
      wedding_location, wedding_budget_goal, expected_guest_count, email,
      phone, notes, wedding_id, workspace_status
    ) values
      (gen_random_uuid(), target_user_id, 'Amina', 'Kamau', current_date + 210, 'Naivasha, Kenya', 1800000, 140, 'amina@example.invalid', '+254711100001', 'Venue confirmed; photography contract needs review.', primary_wedding_id, 'active'),
      (gen_random_uuid(), target_user_id, 'Lina', 'David', current_date + 120, 'Karen, Nairobi', 2500000, 190, 'lina@example.invalid', '+254711100002', 'Catering tasting is the next milestone.', secondary_wedding_id, 'active'),
      (gen_random_uuid(), target_user_id, 'Wanjiru', 'Mark', current_date + 330, 'Tigoni, Kiambu', 1350000, 110, 'wanjiru@example.invalid', '+254711100003', 'Early-stage planning workspace.', tertiary_wedding_id, 'active');

    select id into primary_client_id from public.planner_clients where planner_user_id = target_user_id and wedding_id = primary_wedding_id;
    select id into secondary_client_id from public.planner_clients where planner_user_id = target_user_id and wedding_id = secondary_wedding_id;
    select id into tertiary_client_id from public.planner_clients where planner_user_id = target_user_id and wedding_id = tertiary_wedding_id;

    insert into public.budget_categories (user_id, client_id, wedding_id, name, allocated, spent, budget_scope)
    values
      (target_user_id, primary_client_id, primary_wedding_id, 'Venue', 420000, 120000, 'wedding'),
      (target_user_id, primary_client_id, primary_wedding_id, 'Catering', 510000, 175000, 'wedding'),
      (target_user_id, secondary_client_id, secondary_wedding_id, 'Venue', 650000, 325000, 'wedding'),
      (target_user_id, secondary_client_id, secondary_wedding_id, 'Décor', 380000, 0, 'wedding'),
      (target_user_id, tertiary_client_id, tertiary_wedding_id, 'Venue', 350000, 0, 'wedding');

    insert into public.tasks (user_id, client_id, wedding_id, title, description, due_date, completed, category, phase, priority_level)
    values
      (target_user_id, primary_client_id, primary_wedding_id, 'Review photography contract', 'Check delivery dates and cancellation terms.', current_date + 4, false, 'Photography', 'selection_booking', 3),
      (target_user_id, primary_client_id, primary_wedding_id, 'Confirm guest estimate', 'Update caterer before tasting.', current_date + 12, false, 'Guests', 'foundation', 2),
      (target_user_id, secondary_client_id, secondary_wedding_id, 'Approve catering menu', 'Collect dietary restrictions first.', current_date + 8, false, 'Catering', 'selection_booking', 3),
      (target_user_id, tertiary_client_id, tertiary_wedding_id, 'Build vendor shortlist', 'Start with venue and photography.', current_date + 25, false, 'Vendors', 'research', 2);

    insert into public.vendors (user_id, client_id, wedding_id, name, category, email, phone, price, selection_status, status, contract_status, payment_status, amount_paid)
    values
      (target_user_id, primary_client_id, primary_wedding_id, 'Lakeview Gardens', 'Venue', 'hello@lakeview.example', '+254711200001', 420000, 'final', 'booked', 'signed', 'part_paid', 120000),
      (target_user_id, primary_client_id, primary_wedding_id, 'Golden Hour Stories', 'Photography', 'studio@goldenhour.example', '+254711200002', 190000, 'final', 'booked', 'sent', 'part_paid', 95000),
      (target_user_id, secondary_client_id, secondary_wedding_id, 'Savanna Table', 'Catering', 'events@savannatable.example', '+254711200003', 640000, 'shortlisted', 'contacted', 'not_started', 'unpaid', 0);

    quote_id := gen_random_uuid();
    invoice_id := gen_random_uuid();
    insert into public.commercial_documents (
      id, user_id, role, document_number, document_type, status, title,
      recipient_name, recipient_email, issue_date, due_date, subtotal,
      total_amount, balance_due, currency, client_id, wedding_name, metadata
    ) values
      (quote_id, target_user_id, 'planner', 'QT-DEMO-0001', 'quote', 'sent', 'Full planning service', 'Amina & Kamau', 'amina@example.invalid', current_date - 5, current_date + 2, 280000, 280000, 280000, 'KES', primary_client_id, 'Amina & Kamau', jsonb_build_object('demo', true)),
      (invoice_id, target_user_id, 'planner', 'INV-DEMO-0001', 'invoice', 'sent', 'Planning retainer', 'Lina & David', 'lina@example.invalid', current_date - 3, current_date + 7, 125000, 125000, 125000, 'KES', secondary_client_id, 'Lina & David', jsonb_build_object('demo', true));

    insert into public.commercial_document_items (document_id, description, quantity, unit_price, line_total, sort_order, metadata)
    values
      (quote_id, 'Full wedding planning and coordination', 1, 280000, 280000, 0, jsonb_build_object('demo', true)),
      (invoice_id, 'Planning retainer', 1, 125000, 125000, 0, jsonb_build_object('demo', true));
  end if;
end;
$$;

revoke all on function private.clear_demo_workspace(uuid) from public, anon, authenticated;
revoke all on function private.seed_demo_workspace(uuid, text) from public, anon, authenticated;

create or replace function private.purge_expired_demo_users()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  with deleted as (
    delete from auth.users u
    using public.demo_sessions ds
    where u.id = ds.user_id
      and (
        ds.expires_at < now() - interval '1 hour'
        or (ds.status = 'ended' and ds.started_at < now() - interval '1 hour')
      )
    returning u.id
  )
  select count(*)::integer into deleted_count from deleted;
  return deleted_count;
end;
$$;

revoke all on function private.purge_expired_demo_users() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-expired-zania-demo-users') then
    perform cron.unschedule('purge-expired-zania-demo-users');
  end if;
  perform cron.schedule(
    'purge-expired-zania-demo-users',
    '17 * * * *',
    $job$select private.purge_expired_demo_users();$job$
  );
end;
$$;

create or replace function public.start_demo_session(target_role text)
returns table (demo_role text, destination_path text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  anonymous_claim boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if not anonymous_claim then raise exception 'Demo sessions require a temporary anonymous account'; end if;
  if target_role not in ('couple', 'vendor', 'planner') then raise exception 'Choose couple, vendor or planner'; end if;

  insert into public.demo_sessions (user_id, demo_role, status, started_at, expires_at, metadata)
  values (current_user_id, target_role, 'active', now(), now() + interval '24 hours', jsonb_build_object('version', 1))
  on conflict (user_id) do update
    set demo_role = excluded.demo_role,
        status = 'active',
        started_at = now(),
        expires_at = now() + interval '24 hours',
        last_reset_at = null,
        reset_count = 0,
        metadata = excluded.metadata;

  perform private.seed_demo_workspace(current_user_id, target_role);

  return query select target_role,
    case target_role when 'couple' then '/dashboard' when 'vendor' then '/vendor-dashboard' else '/clients' end,
    now() + interval '24 hours';
end;
$$;

create or replace function public.get_current_demo_session()
returns table (demo_role text, destination_path text, status text, expires_at timestamptz, reset_count integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select ds.demo_role,
    case ds.demo_role when 'couple' then '/dashboard' when 'vendor' then '/vendor-dashboard' else '/clients' end,
    case when ds.expires_at <= now() then 'expired' else ds.status end,
    ds.expires_at,
    ds.reset_count
  from public.demo_sessions ds
  where ds.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.reset_demo_session()
returns table (demo_role text, destination_path text, expires_at timestamptz, reset_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_role text;
  next_expiry timestamptz := now() + interval '24 hours';
  next_reset_count integer;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  select ds.demo_role into selected_role from public.demo_sessions ds
    where ds.user_id = current_user_id and ds.status = 'active' for update;
  if selected_role is null then raise exception 'Active demo session not found'; end if;

  perform private.seed_demo_workspace(current_user_id, selected_role);
  update public.demo_sessions
    set expires_at = next_expiry, last_reset_at = now(), reset_count = reset_count + 1
    where user_id = current_user_id
    returning reset_count into next_reset_count;

  return query select selected_role,
    case selected_role when 'couple' then '/dashboard' when 'vendor' then '/vendor-dashboard' else '/clients' end,
    next_expiry, next_reset_count;
end;
$$;

create or replace function public.end_demo_session()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.demo_sessions set status = 'ended' where user_id = auth.uid();
end;
$$;

revoke all on function public.start_demo_session(text) from public, anon;
revoke all on function public.get_current_demo_session() from public, anon;
revoke all on function public.reset_demo_session() from public, anon;
revoke all on function public.end_demo_session() from public, anon;
grant execute on function public.start_demo_session(text) to authenticated;
grant execute on function public.get_current_demo_session() to authenticated;
grant execute on function public.reset_demo_session() to authenticated;
grant execute on function public.end_demo_session() to authenticated;

-- Anonymous demo couples do not have a verified email. Their sample documents
-- are intentionally listed from their own isolated workspace instead.
create or replace function private.list_received_documents()
returns table (
  id uuid, document_type text, document_number text, title text,
  status text, currency text, total_amount numeric, updated_at timestamptz,
  share_token uuid
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  recipient_id uuid := auth.uid();
  verified_email text;
  is_demo_account boolean := false;
begin
  if recipient_id is null then raise exception 'Authentication required'; end if;

  select exists (
    select 1 from public.demo_sessions ds
    where ds.user_id = recipient_id and ds.status = 'active' and ds.expires_at > now()
  ) into is_demo_account;

  if is_demo_account then
    return query
      select d.id, d.document_type, d.document_number, d.title,
        d.status, d.currency, d.total_amount, d.updated_at, s.share_token
      from public.commercial_documents d
      join public.commercial_document_shares s on s.document_id = d.id
      where d.user_id = recipient_id and d.metadata ->> 'demo_received' = 'true'
        and d.status <> 'draft' and s.revoked_at is null
        and (s.expires_at is null or s.expires_at > now())
      union all
      select c.id, 'contract'::text, null::text, c.title,
        c.status, null::text, null::numeric, c.updated_at, s.share_token
      from public.professional_contracts c
      join public.professional_contract_shares s on s.contract_id = c.id
      where c.user_id = recipient_id and c.metadata ->> 'demo_received' = 'true'
        and c.status <> 'draft' and s.revoked_at is null
        and (s.expires_at is null or s.expires_at > now())
      order by 8 desc, 1;
    return;
  end if;

  select lower(btrim(u.email)) into verified_email
    from auth.users u where u.id = recipient_id and u.email_confirmed_at is not null;
  if nullif(verified_email, '') is null then return; end if;

  return query
    select d.id, d.document_type, d.document_number, d.title,
      d.status, d.currency, d.total_amount, d.updated_at, s.share_token
    from public.commercial_documents d
    join public.commercial_document_shares s on s.document_id = d.id
    where lower(btrim(d.recipient_email)) = verified_email
      and d.user_id <> recipient_id and d.status <> 'draft'
      and s.revoked_at is null and (s.expires_at is null or s.expires_at > now())
    union all
    select c.id, 'contract'::text, null::text, c.title,
      c.status, null::text, null::numeric, c.updated_at, s.share_token
    from public.professional_contracts c
    join public.professional_contract_shares s on s.contract_id = c.id
    where lower(btrim(c.recipient_email)) = verified_email
      and c.user_id <> recipient_id and c.status <> 'draft'
      and s.revoked_at is null and (s.expires_at is null or s.expires_at > now())
    order by 8 desc, 1;
end;
$$;

revoke all on function private.list_received_documents() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.list_received_documents() to authenticated;
