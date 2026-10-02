alter table public.intelligence_gateway_confirmations
  drop constraint if exists intelligence_gateway_confirmations_capability_check;

alter table public.intelligence_gateway_confirmations
  add constraint intelligence_gateway_confirmations_capability_check
  check (capability in (
    'create_task', 'update_task', 'add_guest', 'record_expense',
    'create_vendor_follow_up_reminder', 'record_payment', 'save_vendor_candidate',
    'assign_vendor_candidate', 'promote_vendor_candidate', 'send_vendor_enquiry',
    'apply_vendor_response', 'request_formal_vendor_quote', 'request_formal_quote_changes',
    'save_negotiation_plan'
  ));

create table if not exists public.vendor_negotiation_profiles (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  quote_request_id uuid not null references public.document_requests(id) on delete restrict,
  quote_document_id uuid not null references public.commercial_documents(id) on delete restrict,
  vendor_id uuid references public.vendors(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  last_updated_by uuid not null references auth.users(id) on delete restrict,
  target_budget_kes numeric(14,2) not null check (target_budget_kes > 0),
  absolute_ceiling_kes numeric(14,2) check (absolute_ceiling_kes is null or absolute_ceiling_kes >= target_budget_kes),
  must_have jsonb not null default '[]'::jsonb check (jsonb_typeof(must_have) = 'array'),
  willing_to_trade jsonb not null default '[]'::jsonb check (jsonb_typeof(willing_to_trade) = 'array'),
  tone text not null default 'gentle' check (tone in ('gentle', 'commercial', 'planner')),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wedding_id, quote_document_id)
);

create table if not exists public.vendor_negotiation_proposals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.vendor_negotiation_profiles(id) on delete cascade,
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  quote_request_id uuid not null references public.document_requests(id) on delete restrict,
  quote_document_id uuid not null references public.commercial_documents(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  round_number integer not null check (round_number > 0),
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  status text not null default 'draft' check (status in ('draft', 'sent', 'countered', 'accepted', 'rejected', 'withdrawn')),
  contact_status text not null default 'not_contacted' check (contact_status in ('not_contacted', 'contacted')),
  message text not null check (char_length(message) between 3 and 2000),
  proposed_total_kes numeric(14,2) check (proposed_total_kes is null or proposed_total_kes > 0),
  scope_changes jsonb not null default '[]'::jsonb check (jsonb_typeof(scope_changes) = 'array'),
  source text not null default 'intelligence_gateway' check (source in ('intelligence_gateway', 'manual', 'vendor_response')),
  gateway_idempotency_key uuid,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (profile_id, round_number)
);

create unique index if not exists vendor_negotiation_proposals_gateway_idempotency_idx
  on public.vendor_negotiation_proposals (gateway_idempotency_key)
  where gateway_idempotency_key is not null;

create index if not exists vendor_negotiation_profiles_wedding_idx
  on public.vendor_negotiation_profiles (wedding_id, status, updated_at desc);

create index if not exists vendor_negotiation_proposals_wedding_idx
  on public.vendor_negotiation_proposals (wedding_id, created_at desc);

alter table public.vendor_negotiation_profiles enable row level security;
alter table public.vendor_negotiation_proposals enable row level security;

create policy "Wedding members can view negotiation profiles"
  on public.vendor_negotiation_profiles for select to authenticated
  using (public.is_wedding_member(wedding_id));

create policy "Wedding members can create negotiation profiles"
  on public.vendor_negotiation_profiles for insert to authenticated
  with check (public.is_wedding_member(wedding_id) and created_by = (select auth.uid()) and last_updated_by = (select auth.uid()));

create policy "Wedding members can update negotiation profiles"
  on public.vendor_negotiation_profiles for update to authenticated
  using (public.is_wedding_member(wedding_id))
  with check (public.is_wedding_member(wedding_id) and last_updated_by = (select auth.uid()));

create policy "Wedding members can view negotiation proposals"
  on public.vendor_negotiation_proposals for select to authenticated
  using (public.is_wedding_member(wedding_id));

create policy "Wedding members can create negotiation proposals"
  on public.vendor_negotiation_proposals for insert to authenticated
  with check (public.is_wedding_member(wedding_id) and created_by = (select auth.uid()));

revoke all on table public.vendor_negotiation_profiles from anon;
revoke all on table public.vendor_negotiation_proposals from anon;
grant select, insert, update on table public.vendor_negotiation_profiles to authenticated;
grant select, insert on table public.vendor_negotiation_proposals to authenticated;

create or replace function public.save_negotiation_plan(
  wedding_id_input uuid,
  quote_request_id_input uuid,
  quote_document_id_input uuid,
  target_budget_kes_input numeric,
  absolute_ceiling_kes_input numeric,
  must_have_input text[],
  willing_to_trade_input text[],
  tone_input text,
  draft_message_input text,
  proposed_total_kes_input numeric,
  gateway_idempotency_key_input uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  acting_user_id uuid := auth.uid();
  target_request public.document_requests%rowtype;
  target_document public.commercial_documents%rowtype;
  saved_profile public.vendor_negotiation_profiles%rowtype;
  saved_proposal public.vendor_negotiation_proposals%rowtype;
  next_round integer;
  clean_message text := nullif(btrim(draft_message_input), '');
begin
  if acting_user_id is null then raise exception 'Authentication required'; end if;
  if wedding_id_input is null or not public.is_wedding_member(wedding_id_input) then raise exception 'Wedding access required'; end if;
  if gateway_idempotency_key_input is null then raise exception 'Idempotency key required'; end if;
  if target_budget_kes_input is null or target_budget_kes_input <= 0 then raise exception 'Target budget must be positive'; end if;
  if absolute_ceiling_kes_input is not null and absolute_ceiling_kes_input < target_budget_kes_input then raise exception 'Ceiling cannot be below target'; end if;
  if tone_input not in ('gentle', 'commercial', 'planner') then raise exception 'Invalid negotiation tone'; end if;
  if clean_message is null or char_length(clean_message) not between 3 and 2000 then raise exception 'Draft message must contain 3 to 2000 characters'; end if;
  if coalesce(array_length(must_have_input, 1), 0) > 10 or coalesce(array_length(willing_to_trade_input, 1), 0) > 10 then
    raise exception 'Negotiation priority lists are too long';
  end if;

  select * into saved_proposal
  from public.vendor_negotiation_proposals proposal
  where proposal.gateway_idempotency_key = gateway_idempotency_key_input;
  if saved_proposal.id is not null then
    select * into saved_profile from public.vendor_negotiation_profiles where id = saved_proposal.profile_id;
    return jsonb_build_object('profileId', saved_profile.id, 'proposalId', saved_proposal.id, 'roundNumber', saved_proposal.round_number);
  end if;

  select * into target_request
  from public.document_requests request
  where request.id = quote_request_id_input
    and request.wedding_id = wedding_id_input
    and request.request_type = 'quote'
    and request.response_document_id = quote_document_id_input
    and request.status = 'responded'
  limit 1;
  if target_request.id is null then raise exception 'Active returned formal quote not found'; end if;

  select * into target_document
  from public.commercial_documents document
  where document.id = quote_document_id_input
    and document.document_type = 'quote'
    and document.status = 'sent'
    and upper(document.currency) = 'KES'
  limit 1;
  if target_document.id is null then raise exception 'Active KES formal quote not found'; end if;

  insert into public.vendor_negotiation_profiles (
    wedding_id, quote_request_id, quote_document_id, vendor_id, created_by, last_updated_by,
    target_budget_kes, absolute_ceiling_kes, must_have, willing_to_trade, tone, status
  ) values (
    wedding_id_input, target_request.id, target_document.id, target_request.vendor_id, acting_user_id, acting_user_id,
    target_budget_kes_input, absolute_ceiling_kes_input,
    to_jsonb(coalesce(must_have_input, array[]::text[])),
    to_jsonb(coalesce(willing_to_trade_input, array[]::text[])),
    tone_input, 'active'
  )
  on conflict (wedding_id, quote_document_id) do update set
    quote_request_id = excluded.quote_request_id,
    vendor_id = excluded.vendor_id,
    last_updated_by = excluded.last_updated_by,
    target_budget_kes = excluded.target_budget_kes,
    absolute_ceiling_kes = excluded.absolute_ceiling_kes,
    must_have = excluded.must_have,
    willing_to_trade = excluded.willing_to_trade,
    tone = excluded.tone,
    status = 'active',
    updated_at = now()
  returning * into saved_profile;

  perform 1 from public.vendor_negotiation_profiles where id = saved_profile.id for update;
  select coalesce(max(proposal.round_number), 0) + 1 into next_round
  from public.vendor_negotiation_proposals proposal
  where proposal.profile_id = saved_profile.id;

  insert into public.vendor_negotiation_proposals (
    profile_id, wedding_id, quote_request_id, quote_document_id, created_by,
    round_number, direction, status, contact_status, message, proposed_total_kes, scope_changes,
    source, gateway_idempotency_key
  ) values (
    saved_profile.id, wedding_id_input, target_request.id, target_document.id, acting_user_id,
    next_round, 'outbound', 'draft', 'not_contacted', clean_message, proposed_total_kes_input,
    to_jsonb(coalesce(willing_to_trade_input, array[]::text[])),
    'intelligence_gateway', gateway_idempotency_key_input
  ) returning * into saved_proposal;

  return jsonb_build_object('profileId', saved_profile.id, 'proposalId', saved_proposal.id, 'roundNumber', saved_proposal.round_number);
end;
$$;

revoke all on function public.save_negotiation_plan(uuid, uuid, uuid, numeric, numeric, text[], text[], text, text, numeric, uuid) from public, anon;
grant execute on function public.save_negotiation_plan(uuid, uuid, uuid, numeric, numeric, text[], text[], text, text, numeric, uuid) to authenticated;

comment on function public.save_negotiation_plan(uuid, uuid, uuid, numeric, numeric, text[], text[], text, text, numeric, uuid) is
  'Persists an authorized negotiation profile and one unsent draft proposal from an active returned KES formal quote. It never contacts the vendor or records agreement.';

notify pgrst, 'reload schema';
