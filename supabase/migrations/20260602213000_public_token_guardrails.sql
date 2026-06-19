create table if not exists public.public_token_access_logs (
  id uuid primary key default gen_random_uuid(),
  token_kind text not null,
  token_value uuid not null,
  event_type text not null,
  status text not null check (status in ('success', 'failure')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint public_token_access_logs_token_kind_check
    check (
      token_kind in (
        'guest_rsvp',
        'timeline_full',
        'timeline_assignee',
        'contribution_summary',
        'commercial_document'
      )
    )
);

create index if not exists public_token_access_logs_token_kind_value_created_idx
  on public.public_token_access_logs (token_kind, token_value, created_at desc);

alter table public.guests
  add column if not exists rsvp_token_expires_at timestamptz null,
  add column if not exists rsvp_token_revoked_at timestamptz null,
  add column if not exists rsvp_last_viewed_at timestamptz null,
  add column if not exists rsvp_last_responded_at timestamptz null;

alter table public.timelines
  add column if not exists share_expires_at timestamptz null,
  add column if not exists share_revoked_at timestamptz null,
  add column if not exists share_last_accessed_at timestamptz null,
  add column if not exists share_access_count integer not null default 0;

alter table public.timeline_share_links
  add column if not exists expires_at timestamptz not null default (now() + interval '45 days'),
  add column if not exists revoked_at timestamptz null,
  add column if not exists last_accessed_at timestamptz null,
  add column if not exists access_count integer not null default 0;

alter table public.contribution_summary_shares
  add column if not exists expires_at timestamptz not null default (now() + interval '180 days'),
  add column if not exists revoked_at timestamptz null,
  add column if not exists last_accessed_at timestamptz null,
  add column if not exists access_count integer not null default 0;

alter table public.commercial_document_shares
  add column if not exists expires_at timestamptz not null default (now() + interval '90 days'),
  add column if not exists revoked_at timestamptz null,
  add column if not exists last_accessed_at timestamptz null,
  add column if not exists access_count integer not null default 0;

create or replace function public.log_public_token_access(
  _token_kind text,
  _token_value uuid,
  _event_type text,
  _status text,
  _details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.public_token_access_logs (
    token_kind,
    token_value,
    event_type,
    status,
    details
  )
  values (
    _token_kind,
    _token_value,
    _event_type,
    _status,
    coalesce(_details, '{}'::jsonb)
  );
end;
$$;

create or replace function public.is_public_token_active(
  _expires_at timestamptz,
  _revoked_at timestamptz
)
returns boolean
language sql
stable
set search_path = public
as $$
  select _revoked_at is null
    and (_expires_at is null or _expires_at > now());
$$;

create or replace function public.public_rsvp_respond(_token uuid, _status text)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  _guest record;
begin
  if _status not in ('confirmed', 'declined') then
    perform public.log_public_token_access(
      'guest_rsvp',
      _token,
      'respond',
      'failure',
      jsonb_build_object('reason', 'invalid_status', 'status', _status)
    );
    return json_build_object('error', 'Invalid status');
  end if;

  select
    id,
    name,
    rsvp_status,
    rsvp_token_expires_at,
    rsvp_token_revoked_at,
    rsvp_last_responded_at
  into _guest
  from public.guests
  where rsvp_token = _token;

  if _guest.id is null then
    perform public.log_public_token_access(
      'guest_rsvp',
      _token,
      'respond',
      'failure',
      jsonb_build_object('reason', 'not_found')
    );
    return json_build_object('error', 'Invalid link');
  end if;

  if not public.is_public_token_active(_guest.rsvp_token_expires_at, _guest.rsvp_token_revoked_at) then
    perform public.log_public_token_access(
      'guest_rsvp',
      _token,
      'respond',
      'failure',
      jsonb_build_object('reason', 'inactive_token')
    );
    return json_build_object('error', 'This RSVP link is no longer active');
  end if;

  if _guest.rsvp_last_responded_at is not null
    and _guest.rsvp_last_responded_at > now() - interval '15 seconds'
  then
    perform public.log_public_token_access(
      'guest_rsvp',
      _token,
      'respond',
      'failure',
      jsonb_build_object('reason', 'cooldown')
    );
    return json_build_object('error', 'Please wait a moment before updating your RSVP again');
  end if;

  update public.guests
  set
    rsvp_status = _status,
    rsvp_last_responded_at = now()
  where id = _guest.id;

  perform public.log_public_token_access(
    'guest_rsvp',
    _token,
    'respond',
    'success',
    jsonb_build_object('status', _status)
  );

  return json_build_object('success', true, 'name', _guest.name, 'status', _status);
end;
$$;

create or replace function public.public_rsvp_lookup(_token uuid)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  _guest record;
  _profile record;
begin
  select
    g.id,
    g.name,
    g.rsvp_status,
    g.user_id,
    g.rsvp_token_expires_at,
    g.rsvp_token_revoked_at
  into _guest
  from public.guests g
  where g.rsvp_token = _token;

  if _guest.id is null then
    perform public.log_public_token_access(
      'guest_rsvp',
      _token,
      'lookup',
      'failure',
      jsonb_build_object('reason', 'not_found')
    );
    return json_build_object('error', 'Invalid link');
  end if;

  if not public.is_public_token_active(_guest.rsvp_token_expires_at, _guest.rsvp_token_revoked_at) then
    perform public.log_public_token_access(
      'guest_rsvp',
      _token,
      'lookup',
      'failure',
      jsonb_build_object('reason', 'inactive_token')
    );
    return json_build_object('error', 'This RSVP link is no longer active');
  end if;

  update public.guests
  set rsvp_last_viewed_at = now()
  where id = _guest.id;

  select p.full_name, p.partner_name, p.wedding_date, p.wedding_location
  into _profile
  from public.profiles p
  where p.user_id = _guest.user_id;

  perform public.log_public_token_access(
    'guest_rsvp',
    _token,
    'lookup',
    'success',
    jsonb_build_object('guest_id', _guest.id)
  );

  return json_build_object(
    'guest_name', _guest.name,
    'rsvp_status', _guest.rsvp_status,
    'couple_name', case when _profile.full_name is not null and _profile.partner_name is not null
      then _profile.full_name || ' & ' || _profile.partner_name
      else _profile.full_name end,
    'wedding_date', _profile.wedding_date,
    'wedding_location', _profile.wedding_location
  );
end;
$$;

create or replace function public.get_shared_timeline(_share_token uuid)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  _timeline record;
  result json;
begin
  select
    t.id,
    t.title,
    t.timeline_date,
    t.share_expires_at,
    t.share_revoked_at
  into _timeline
  from public.timelines t
  where t.share_token = _share_token;

  if _timeline.id is null then
    perform public.log_public_token_access(
      'timeline_full',
      _share_token,
      'lookup',
      'failure',
      jsonb_build_object('reason', 'not_found')
    );
    return null;
  end if;

  if not public.is_public_token_active(_timeline.share_expires_at, _timeline.share_revoked_at) then
    perform public.log_public_token_access(
      'timeline_full',
      _share_token,
      'lookup',
      'failure',
      jsonb_build_object('reason', 'inactive_token', 'timeline_id', _timeline.id)
    );
    return null;
  end if;

  update public.timelines
  set
    share_last_accessed_at = now(),
    share_access_count = share_access_count + 1
  where id = _timeline.id;

  select json_build_object(
    'id', t.id,
    'title', t.title,
    'timeline_date', t.timeline_date,
    'events', coalesce((
      select json_agg(
        json_build_object(
          'id', e.id,
          'event_time', e.event_time,
          'title', e.title,
          'description', e.description,
          'assigned_people', e.assigned_people,
          'sort_order', e.sort_order,
          'category', e.category
        ) order by e.event_time, e.sort_order
      )
      from public.timeline_events e where e.timeline_id = t.id
    ), '[]'::json)
  ) into result
  from public.timelines t
  where t.id = _timeline.id;

  perform public.log_public_token_access(
    'timeline_full',
    _share_token,
    'lookup',
    'success',
    jsonb_build_object('timeline_id', _timeline.id)
  );

  return result;
end;
$$;

create or replace function public.get_assignee_timeline(_share_token uuid)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  result json;
  _share record;
begin
  select
    sl.timeline_id,
    sl.assignee_name,
    sl.vendor_role,
    sl.expires_at,
    sl.revoked_at
  into _share
  from public.timeline_share_links sl
  where sl.share_token = _share_token;

  if _share.timeline_id is null then
    perform public.log_public_token_access(
      'timeline_assignee',
      _share_token,
      'lookup',
      'failure',
      jsonb_build_object('reason', 'not_found')
    );
    return null;
  end if;

  if not public.is_public_token_active(_share.expires_at, _share.revoked_at) then
    perform public.log_public_token_access(
      'timeline_assignee',
      _share_token,
      'lookup',
      'failure',
      jsonb_build_object('reason', 'inactive_token', 'timeline_id', _share.timeline_id)
    );
    return null;
  end if;

  update public.timeline_share_links
  set
    last_accessed_at = now(),
    access_count = access_count + 1
  where share_token = _share_token;

  select json_build_object(
    'id', t.id,
    'title', t.title,
    'timeline_date', t.timeline_date,
    'assignee_name', _share.assignee_name,
    'vendor_role', _share.vendor_role,
    'events', coalesce((
      select json_agg(
        json_build_object(
          'id', e.id,
          'event_time', e.event_time,
          'title', e.title,
          'description', e.description,
          'assigned_people', e.assigned_people,
          'sort_order', e.sort_order,
          'category', e.category
        ) order by e.event_time, e.sort_order
      )
      from public.timeline_events e
      where e.timeline_id = t.id and _share.assignee_name = any(e.assigned_people)
    ), '[]'::json)
  ) into result
  from public.timelines t
  where t.id = _share.timeline_id;

  perform public.log_public_token_access(
    'timeline_assignee',
    _share_token,
    'lookup',
    'success',
    jsonb_build_object('timeline_id', _share.timeline_id, 'assignee_name', _share.assignee_name)
  );

  return result;
end;
$$;

create or replace function public.ensure_contribution_share_token(_client_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _effective_user_id uuid;
  _share record;
  _share_token uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if _client_id is null then
    if not exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'couple'
    ) then
      raise exception 'Couple access required';
    end if;

    _effective_user_id := auth.uid();
  else
    select pc.planner_user_id
      into _effective_user_id
    from public.planner_clients pc
    where pc.id = _client_id
      and public.can_access_contribution_record(pc.planner_user_id, pc.id)
    limit 1;

    if _effective_user_id is null then
      raise exception 'Access denied';
    end if;
  end if;

  select
    css.id,
    css.share_token,
    css.expires_at,
    css.revoked_at
  into _share
  from public.contribution_summary_shares css
  where css.user_id = _effective_user_id
    and css.client_id is not distinct from _client_id
  limit 1;

  if _share.id is null then
    insert into public.contribution_summary_shares (user_id, client_id)
    values (_effective_user_id, _client_id)
    returning share_token into _share_token;
    return _share_token;
  end if;

  if not public.is_public_token_active(_share.expires_at, _share.revoked_at) then
    update public.contribution_summary_shares
    set
      share_token = gen_random_uuid(),
      expires_at = now() + interval '180 days',
      revoked_at = null,
      last_accessed_at = null,
      access_count = 0,
      updated_at = now()
    where id = _share.id
    returning share_token into _share_token;

    return _share_token;
  end if;

  return _share.share_token;
end;
$$;

create or replace function public.get_shared_contributions_summary(_share_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _share record;
  _workspace_title text;
  _workspace_subtitle text;
  _budget_target numeric(12,2);
  _pledged_cash numeric(12,2);
  _collected_cash numeric(12,2);
  _in_kind_value numeric(12,2);
  _outstanding_pledges numeric(12,2);
  _pending_count integer;
  _contributor_count integer;
  _rounds jsonb;
begin
  select
    css.id,
    css.user_id,
    css.client_id,
    css.expires_at,
    css.revoked_at,
    pc.client_name,
    pc.partner_name,
    p.wedding_name,
    p.full_name
  into _share
  from public.contribution_summary_shares css
  left join public.planner_clients pc on pc.id = css.client_id
  left join public.profiles p on p.id = css.user_id
  where css.share_token = _share_token
  limit 1;

  if _share.user_id is null then
    perform public.log_public_token_access(
      'contribution_summary',
      _share_token,
      'lookup',
      'failure',
      jsonb_build_object('reason', 'not_found')
    );
    return null;
  end if;

  if not public.is_public_token_active(_share.expires_at, _share.revoked_at) then
    perform public.log_public_token_access(
      'contribution_summary',
      _share_token,
      'lookup',
      'failure',
      jsonb_build_object('reason', 'inactive_token', 'share_id', _share.id)
    );
    return null;
  end if;

  update public.contribution_summary_shares
  set
    last_accessed_at = now(),
    access_count = access_count + 1
  where id = _share.id;

  _workspace_title := coalesce(
    nullif(_share.client_name, ''),
    nullif(_share.wedding_name, ''),
    case
      when nullif(_share.full_name, '') is not null then _share.full_name || ' Wedding'
      else 'Wedding Contributions'
    end
  );

  _workspace_subtitle := coalesce(
    case
      when _share.client_id is not null and nullif(_share.partner_name, '') is not null
        then 'Shared contribution summary for ' || _share.client_name || ' & ' || _share.partner_name
      when _share.client_id is not null
        then 'Shared contribution summary for ' || _share.client_name
      else 'Shared contribution summary'
    end,
    'Shared contribution summary'
  );

  select coalesce(sum(bc.allocated), 0)
    into _budget_target
  from public.budget_categories bc
  where bc.user_id = _share.user_id
    and bc.client_id is not distinct from _share.client_id
    and bc.budget_scope = 'wedding';

  select
    coalesce(sum(wc.pledged_amount), 0),
    coalesce(sum(wc.paid_amount), 0),
    coalesce(sum(wc.in_kind_value), 0),
    coalesce(sum(
      case
        when wc.status = 'cancelled' or wc.contribution_type = 'in_kind' then 0
        else greatest(wc.pledged_amount - wc.paid_amount, 0)
      end
    ), 0),
    count(*) filter (where wc.status in ('pledged', 'partial')),
    count(distinct nullif(trim(wc.contributor_name), ''))
  into
    _pledged_cash,
    _collected_cash,
    _in_kind_value,
    _outstanding_pledges,
    _pending_count,
    _contributor_count
  from public.wedding_contributions wc
  where wc.user_id = _share.user_id
    and wc.client_id is not distinct from _share.client_id;

  select coalesce(
    jsonb_agg(round_data order by (round_data->>'starts_on') desc nulls last, (round_data->>'title')),
    '[]'::jsonb
  )
  into _rounds
  from (
    select jsonb_build_object(
      'title', cr.title,
      'goal_amount', cr.goal_amount,
      'starts_on', cr.starts_on,
      'ends_on', cr.ends_on,
      'is_active', cr.is_active,
      'notes', cr.notes,
      'pledged_cash', coalesce(sum(wc.pledged_amount), 0),
      'collected_cash', coalesce(sum(wc.paid_amount), 0),
      'in_kind_value', coalesce(sum(wc.in_kind_value), 0)
    ) as round_data
    from public.contribution_rounds cr
    left join public.wedding_contributions wc on wc.round_id = cr.id
    where cr.user_id = _share.user_id
      and cr.client_id is not distinct from _share.client_id
    group by cr.id, cr.title, cr.goal_amount, cr.starts_on, cr.ends_on, cr.is_active, cr.notes
  ) rounds_source;

  perform public.log_public_token_access(
    'contribution_summary',
    _share_token,
    'lookup',
    'success',
    jsonb_build_object('share_id', _share.id)
  );

  return jsonb_build_object(
    'workspace_title', _workspace_title,
    'workspace_subtitle', _workspace_subtitle,
    'budget_target', coalesce(_budget_target, 0),
    'pledged_cash', coalesce(_pledged_cash, 0),
    'collected_cash', coalesce(_collected_cash, 0),
    'in_kind_value', coalesce(_in_kind_value, 0),
    'total_support', coalesce(_collected_cash, 0) + coalesce(_in_kind_value, 0),
    'outstanding_pledges', coalesce(_outstanding_pledges, 0),
    'pending_count', coalesce(_pending_count, 0),
    'contributor_count', coalesce(_contributor_count, 0),
    'rounds', coalesce(_rounds, '[]'::jsonb)
  );
end;
$$;

create or replace function public.ensure_commercial_document_share_token(_document_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _document public.commercial_documents%rowtype;
  _share record;
  _share_token uuid;
begin
  if _uid is null then
    raise exception 'Authentication required';
  end if;

  select *
    into _document
  from public.commercial_documents
  where id = _document_id
    and user_id = _uid;

  if not found then
    raise exception 'Document not found';
  end if;

  select
    id,
    share_token,
    expires_at,
    revoked_at
  into _share
  from public.commercial_document_shares
  where document_id = _document.id;

  if _share.id is null then
    insert into public.commercial_document_shares (user_id, document_id)
    values (_uid, _document.id)
    returning share_token into _share_token;

    return _share_token;
  end if;

  if not public.is_public_token_active(_share.expires_at, _share.revoked_at) then
    update public.commercial_document_shares
    set
      share_token = gen_random_uuid(),
      expires_at = now() + interval '90 days',
      revoked_at = null,
      last_accessed_at = null,
      access_count = 0,
      updated_at = now()
    where id = _share.id
    returning share_token into _share_token;

    return _share_token;
  end if;

  return _share.share_token;
end;
$$;

create or replace function public.get_shared_commercial_document(_share_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _share record;
  _document public.commercial_documents%rowtype;
  _profile public.profiles%rowtype;
  _vendor_listing record;
  _issuer_name text;
  _issuer_email text;
  _issuer_phone text;
  _issuer_website text;
  _issuer_location text;
  _items jsonb;
  _payments jsonb;
begin
  select
    cds.id,
    cds.user_id,
    cds.document_id,
    cds.expires_at,
    cds.revoked_at
  into _share
  from public.commercial_document_shares cds
  where cds.share_token = _share_token;

  if not found then
    perform public.log_public_token_access(
      'commercial_document',
      _share_token,
      'lookup',
      'failure',
      jsonb_build_object('reason', 'not_found')
    );
    return null;
  end if;

  if not public.is_public_token_active(_share.expires_at, _share.revoked_at) then
    perform public.log_public_token_access(
      'commercial_document',
      _share_token,
      'lookup',
      'failure',
      jsonb_build_object('reason', 'inactive_token', 'share_id', _share.id)
    );
    return null;
  end if;

  update public.commercial_document_shares
  set
    last_accessed_at = now(),
    access_count = access_count + 1
  where id = _share.id;

  select *
    into _document
  from public.commercial_documents
  where id = _share.document_id;

  if not found then
    perform public.log_public_token_access(
      'commercial_document',
      _share_token,
      'lookup',
      'failure',
      jsonb_build_object('reason', 'missing_document', 'share_id', _share.id)
    );
    return null;
  end if;

  select *
    into _profile
  from public.profiles
  where user_id = _share.user_id;

  if _document.vendor_listing_id is not null then
    select
      vl.business_name,
      vl.email,
      vl.phone,
      vl.website,
      vl.primary_county,
      vl.primary_town
    into _vendor_listing
    from public.vendor_listings vl
    where vl.id = _document.vendor_listing_id;
  end if;

  if _document.role = 'planner' then
    _issuer_name := coalesce(_profile.company_name, _profile.full_name, 'Zania Planner');
    _issuer_email := coalesce(_profile.company_email, _profile.company_email, _profile.company_email);
    _issuer_phone := _profile.company_phone;
    _issuer_website := _profile.company_website;
    _issuer_location := trim(
      both ', ' from concat_ws(', ', _profile.primary_town, _profile.primary_county)
    );
  else
    _issuer_name := coalesce(_vendor_listing.business_name, _profile.company_name, _profile.full_name, 'Zania Vendor');
    _issuer_email := coalesce(_vendor_listing.email, _profile.company_email);
    _issuer_phone := coalesce(_vendor_listing.phone, _profile.company_phone);
    _issuer_website := coalesce(_vendor_listing.website, _profile.company_website);
    _issuer_location := trim(
      both ', ' from concat_ws(', ', _vendor_listing.primary_town, _vendor_listing.primary_county)
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cdi.id,
        'description', cdi.description,
        'quantity', cdi.quantity,
        'unitPrice', cdi.unit_price,
        'lineTotal', cdi.line_total,
        'sortOrder', cdi.sort_order
      )
      order by cdi.sort_order asc, cdi.created_at asc
    ),
    '[]'::jsonb
  )
  into _items
  from public.commercial_document_items cdi
  where cdi.document_id = _document.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cdp.id,
        'amount', cdp.amount,
        'paymentDate', cdp.payment_date,
        'paymentMethod', cdp.payment_method,
        'reference', cdp.reference,
        'notes', cdp.notes
      )
      order by cdp.payment_date asc, cdp.created_at asc
    ),
    '[]'::jsonb
  )
  into _payments
  from public.commercial_document_payments cdp
  where cdp.document_id = _document.id;

  perform public.log_public_token_access(
    'commercial_document',
    _share_token,
    'lookup',
    'success',
    jsonb_build_object('share_id', _share.id, 'document_id', _document.id)
  );

  return jsonb_build_object(
    'id', _document.id,
    'role', _document.role,
    'documentType', _document.document_type,
    'documentNumber', _document.document_number,
    'title', _document.title,
    'status', _document.status,
    'currency', _document.currency,
    'recipientName', _document.recipient_name,
    'recipientEmail', _document.recipient_email,
    'recipientPhone', _document.recipient_phone,
    'weddingName', _document.wedding_name,
    'issueDate', _document.issue_date,
    'dueDate', _document.due_date,
    'paidDate', _document.paid_date,
    'notes', _document.notes,
    'terms', _document.terms,
    'subtotal', _document.subtotal,
    'discountAmount', _document.discount_amount,
    'taxAmount', _document.tax_amount,
    'totalAmount', _document.total_amount,
    'amountPaid', _document.amount_paid,
    'balanceDue', _document.balance_due,
    'issuerName', _issuer_name,
    'issuerEmail', _issuer_email,
    'issuerPhone', _issuer_phone,
    'issuerWebsite', _issuer_website,
    'issuerLocation', nullif(_issuer_location, ''),
    'items', _items,
    'payments', _payments
  );
end;
$$;
