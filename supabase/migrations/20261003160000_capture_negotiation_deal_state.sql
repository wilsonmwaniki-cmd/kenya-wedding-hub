alter table public.vendor_negotiation_profiles
  add column if not exists deal_state text not null default 'quoted'
    check (deal_state in ('quoted', 'negotiating', 'agreed', 'contract_received', 'reviewed', 'signed', 'active')),
  add column if not exists agreed_total_kes numeric(14,2)
    check (agreed_total_kes is null or agreed_total_kes > 0),
  add column if not exists agreement_document_id uuid references public.commercial_documents(id) on delete set null,
  add column if not exists agreed_at timestamptz;

alter table public.vendor_negotiation_proposals
  add column if not exists evidence_response_id uuid references public.commercial_quote_responses(id) on delete set null,
  add column if not exists evidence_document_id uuid references public.commercial_documents(id) on delete set null;

create unique index if not exists vendor_negotiation_proposals_evidence_response_idx
  on public.vendor_negotiation_proposals (evidence_response_id)
  where evidence_response_id is not null;

create or replace function public.capture_negotiation_quote_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_profile public.vendor_negotiation_profiles%rowtype;
  next_round integer;
  target_total numeric;
begin
  select * into target_profile
  from public.vendor_negotiation_profiles profile
  where profile.quote_document_id = new.document_id
    and profile.status = 'active'
  limit 1
  for update;

  if target_profile.id is null then return new; end if;

  if new.response = 'changes_requested' then
    select coalesce(max(proposal.round_number), 0) + 1 into next_round
    from public.vendor_negotiation_proposals proposal
    where proposal.profile_id = target_profile.id;

    insert into public.vendor_negotiation_proposals (
      profile_id, wedding_id, quote_request_id, quote_document_id, created_by,
      round_number, direction, status, contact_status, message, proposed_total_kes,
      scope_changes, source, evidence_response_id, evidence_document_id
    ) values (
      target_profile.id, target_profile.wedding_id, target_profile.quote_request_id,
      target_profile.quote_document_id, new.responder_user_id, next_round,
      'outbound', 'sent', 'contacted', new.message, target_profile.target_budget_kes,
      '[]'::jsonb, 'intelligence_gateway', new.id, new.document_id
    ) on conflict (evidence_response_id) where evidence_response_id is not null do nothing;

    update public.vendor_negotiation_profiles
    set deal_state = 'negotiating', last_updated_by = new.responder_user_id, updated_at = now()
    where id = target_profile.id and deal_state = 'quoted';
  elsif new.response = 'accepted' then
    select document.total_amount into target_total
    from public.commercial_documents document where document.id = new.document_id;

    update public.vendor_negotiation_profiles
    set deal_state = 'agreed', agreed_total_kes = target_total,
      agreement_document_id = new.document_id, agreed_at = new.created_at,
      last_updated_by = new.responder_user_id, updated_at = now()
    where id = target_profile.id;
  end if;

  return new;
end;
$$;

drop trigger if exists capture_negotiation_quote_response_trigger on public.commercial_quote_responses;
create trigger capture_negotiation_quote_response_trigger
after insert on public.commercial_quote_responses
for each row execute function public.capture_negotiation_quote_response();

create or replace function public.capture_negotiation_revised_quote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_profile public.vendor_negotiation_profiles%rowtype;
  next_round integer;
begin
  if old.document_type <> 'quote' or old.status <> 'changes_requested' or new.status <> 'sent' then
    return new;
  end if;

  select * into target_profile
  from public.vendor_negotiation_profiles profile
  where profile.quote_document_id = new.id and profile.status = 'active'
  limit 1
  for update;
  if target_profile.id is null then return new; end if;

  select coalesce(max(proposal.round_number), 0) + 1 into next_round
  from public.vendor_negotiation_proposals proposal
  where proposal.profile_id = target_profile.id;

  insert into public.vendor_negotiation_proposals (
    profile_id, wedding_id, quote_request_id, quote_document_id, created_by,
    round_number, direction, status, contact_status, message, proposed_total_kes,
    scope_changes, source, evidence_document_id
  ) values (
    target_profile.id, target_profile.wedding_id, target_profile.quote_request_id,
    target_profile.quote_document_id, new.user_id, next_round,
    'inbound', 'countered', 'contacted',
    'Vendor returned revised formal quote ' || new.document_number || '.',
    case when upper(new.currency) = 'KES' then new.total_amount else null end,
    '[]'::jsonb, 'vendor_response', new.id
  );

  update public.vendor_negotiation_profiles
  set deal_state = 'negotiating', last_updated_by = new.user_id, updated_at = now()
  where id = target_profile.id and deal_state <> 'agreed';

  return new;
end;
$$;

drop trigger if exists capture_negotiation_revised_quote_trigger on public.commercial_documents;
create trigger capture_negotiation_revised_quote_trigger
after update of status on public.commercial_documents
for each row execute function public.capture_negotiation_revised_quote();

create or replace function public.get_negotiation_state(_wedding_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if _wedding_id is null or not public.is_wedding_member(_wedding_id) then raise exception 'Wedding access required'; end if;

  return jsonb_build_object(
    'profiles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', profile.id,
        'vendorName', coalesce(vendor.name, 'Vendor'),
        'documentNumber', document.document_number,
        'quotedTotalKes', case when upper(document.currency) = 'KES' then document.total_amount else null end,
        'targetBudgetKes', profile.target_budget_kes,
        'absoluteCeilingKes', profile.absolute_ceiling_kes,
        'mustHave', profile.must_have,
        'willingToTrade', profile.willing_to_trade,
        'tone', profile.tone,
        'dealState', profile.deal_state,
        'agreedTotalKes', profile.agreed_total_kes,
        'agreedAt', profile.agreed_at,
        'rounds', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', proposal.id,
            'roundNumber', proposal.round_number,
            'direction', proposal.direction,
            'status', proposal.status,
            'contactStatus', proposal.contact_status,
            'message', proposal.message,
            'proposedTotalKes', proposal.proposed_total_kes,
            'source', proposal.source,
            'createdAt', proposal.created_at
          ) order by proposal.round_number)
          from public.vendor_negotiation_proposals proposal
          where proposal.profile_id = profile.id
        ), '[]'::jsonb)
      ) order by profile.updated_at desc)
      from public.vendor_negotiation_profiles profile
      join public.commercial_documents document on document.id = profile.quote_document_id
      left join public.vendors vendor on vendor.id = profile.vendor_id
      where profile.wedding_id = _wedding_id and profile.status = 'active'
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.capture_negotiation_quote_response() from public, anon, authenticated;
revoke all on function public.capture_negotiation_revised_quote() from public, anon, authenticated;
revoke all on function public.get_negotiation_state(uuid) from public, anon;
grant execute on function public.get_negotiation_state(uuid) to authenticated;

comment on function public.get_negotiation_state(uuid) is
  'Returns wedding-scoped negotiation profiles, evidence-backed rounds and derived Deal State. Conversation text alone cannot change Deal State.';

notify pgrst, 'reload schema';
