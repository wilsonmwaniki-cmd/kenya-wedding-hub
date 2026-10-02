create or replace function public.refresh_vendor_agreement_record(_agreement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  agreement public.vendor_agreement_records%rowtype;
  quote public.commercial_documents%rowtype;
  contract public.professional_contracts%rowtype;
  request public.document_requests%rowtype;
  wedding public.weddings%rowtype;
  quote_items jsonb := '[]'::jsonb;
  contract_evidence jsonb;
  findings jsonb := '[]'::jsonb;
  scope_item record;
  contract_summary text;
  contract_terms text;
  contract_event_date date;
  expected_event_date date;
  contract_amount numeric;
  contract_currency text;
  amount_text text;
  found_discrepancies integer := 0;
  found_unknowns integer := 0;
  next_state text;
  next_review_status text;
begin
  select * into agreement
  from public.vendor_agreement_records
  where id = _agreement_id
  for update;
  if agreement.id is null then return; end if;

  select * into quote from public.commercial_documents where id = agreement.accepted_quote_document_id;
  if quote.id is null then return; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'description', doc_item.description,
    'quantity', doc_item.quantity,
    'unitPrice', doc_item.unit_price,
    'lineTotal', doc_item.line_total
  ) order by doc_item.sort_order, doc_item.created_at), '[]'::jsonb)
  into quote_items
  from public.commercial_document_items doc_item
  where doc_item.document_id = quote.id;

  if agreement.contract_request_id is not null then
    select * into request from public.document_requests where id = agreement.contract_request_id;
  end if;
  select * into wedding from public.weddings where id = agreement.wedding_id;
  expected_event_date := coalesce(request.event_date, wedding.wedding_date);

  if agreement.contract_id is null then
    update public.vendor_agreement_records set
      state = 'agreed', review_status = 'pending_contract',
      accepted_quote_snapshot = jsonb_build_object(
        'id', quote.id, 'documentNumber', quote.document_number, 'title', quote.title,
        'currency', quote.currency, 'totalAmount', quote.total_amount,
        'notes', quote.notes, 'terms', quote.terms, 'eventDate', expected_event_date,
        'items', quote_items
      ),
      contract_snapshot = null, comparison = '[]'::jsonb,
      discrepancy_count = 0, unknown_count = 0, compared_at = null, updated_at = now()
    where id = agreement.id;
    return;
  end if;

  select * into contract from public.professional_contracts where id = agreement.contract_id;
  if contract.id is null then return; end if;

  contract_evidence := coalesce(contract.locked_snapshot, jsonb_build_object(
    'id', contract.id, 'title', contract.title, 'recipientName', contract.recipient_name,
    'weddingName', contract.wedding_name, 'eventDate', contract.event_date,
    'summary', contract.summary, 'terms', contract.terms,
    'contentVersion', contract.content_version
  ));
  contract_summary := coalesce(contract_evidence ->> 'summary', contract.summary, '');
  contract_terms := coalesce(contract_evidence ->> 'terms', contract.terms);
  contract_event_date := coalesce(nullif(contract_evidence ->> 'eventDate', '')::date, contract.event_date);
  amount_text := coalesce(
    contract.metadata ->> 'totalAmount', contract.metadata ->> 'total_amount',
    contract.metadata ->> 'contractAmount', contract.metadata ->> 'amount'
  );
  if amount_text ~ '^\s*[0-9]+(?:\.[0-9]+)?\s*$' then contract_amount := btrim(amount_text)::numeric; end if;
  contract_currency := upper(coalesce(nullif(contract.metadata ->> 'currency', ''), quote.currency));

  if contract_amount is null then
    findings := findings || jsonb_build_array(jsonb_build_object(
      'code', 'contract_amount_unrecorded', 'field', 'amount', 'severity', 'unknown',
      'message', 'The contract does not store a structured total, so Zania cannot verify its price against the accepted quote.',
      'agreedValue', quote.total_amount, 'contractValue', null
    ));
    found_unknowns := found_unknowns + 1;
  elsif contract_currency <> upper(quote.currency) or contract_amount <> quote.total_amount then
    findings := findings || jsonb_build_array(jsonb_build_object(
      'code', 'contract_amount_changed', 'field', 'amount', 'severity', 'high',
      'message', 'The structured contract amount or currency differs from the accepted quote.',
      'agreedValue', jsonb_build_object('currency', quote.currency, 'amount', quote.total_amount),
      'contractValue', jsonb_build_object('currency', contract_currency, 'amount', contract_amount)
    ));
    found_discrepancies := found_discrepancies + 1;
  end if;

  if expected_event_date is not null and contract_event_date is null then
    findings := findings || jsonb_build_array(jsonb_build_object(
      'code', 'contract_event_date_unrecorded', 'field', 'event_date', 'severity', 'unknown',
      'message', 'The contract does not store an event date.',
      'agreedValue', expected_event_date, 'contractValue', null
    ));
    found_unknowns := found_unknowns + 1;
  elsif expected_event_date is not null and contract_event_date <> expected_event_date then
    findings := findings || jsonb_build_array(jsonb_build_object(
      'code', 'contract_event_date_changed', 'field', 'event_date', 'severity', 'high',
      'message', 'The contract event date differs from the wedding or request date.',
      'agreedValue', expected_event_date, 'contractValue', contract_event_date
    ));
    found_discrepancies := found_discrepancies + 1;
  end if;

  for scope_item in
    select description from public.commercial_document_items
    where document_id = quote.id and nullif(btrim(description), '') is not null
    order by sort_order, created_at
  loop
    if position(lower(btrim(scope_item.description)) in lower(contract_summary)) = 0 then
      findings := findings || jsonb_build_array(jsonb_build_object(
        'code', 'quote_scope_item_not_found', 'field', 'scope', 'severity', 'review',
        'message', 'An accepted quote line item was not found verbatim in the contract service summary.',
        'agreedValue', scope_item.description, 'contractValue', contract_summary
      ));
      found_discrepancies := found_discrepancies + 1;
    end if;
  end loop;

  if nullif(btrim(quote.terms), '') is null then
    findings := findings || jsonb_build_array(jsonb_build_object(
      'code', 'accepted_quote_terms_unrecorded', 'field', 'terms', 'severity', 'unknown',
      'message', 'The accepted quote has no structured terms to compare with the contract.',
      'agreedValue', null, 'contractValue', contract_terms
    ));
    found_unknowns := found_unknowns + 1;
  elsif lower(regexp_replace(btrim(quote.terms), '\s+', ' ', 'g'))
      is distinct from lower(regexp_replace(btrim(coalesce(contract_terms, '')), '\s+', ' ', 'g')) then
    findings := findings || jsonb_build_array(jsonb_build_object(
      'code', 'contract_terms_changed', 'field', 'terms', 'severity', 'review',
      'message', 'The contract terms differ from the terms stored on the accepted quote.',
      'agreedValue', quote.terms, 'contractValue', contract_terms
    ));
    found_discrepancies := found_discrepancies + 1;
  end if;

  next_state := case when contract.status in ('countersigned', 'completed') or contract.signed_at is not null then 'signed' else 'reviewed' end;
  next_review_status := case
    when next_state = 'signed' then 'signed'
    when found_discrepancies > 0 or found_unknowns > 0 then 'needs_review'
    else 'aligned'
  end;

  update public.vendor_agreement_records set
    state = next_state,
    review_status = next_review_status,
    accepted_quote_snapshot = jsonb_build_object(
      'id', quote.id, 'documentNumber', quote.document_number, 'title', quote.title,
      'currency', quote.currency, 'totalAmount', quote.total_amount,
      'notes', quote.notes, 'terms', quote.terms, 'eventDate', expected_event_date,
      'items', quote_items
    ),
    contract_snapshot = contract_evidence,
    comparison = findings,
    discrepancy_count = found_discrepancies,
    unknown_count = found_unknowns,
    compared_at = now(), updated_at = now()
  where id = agreement.id;

  update public.vendor_negotiation_profiles
  set deal_state = next_state, updated_at = now()
  where id = agreement.negotiation_profile_id
    and deal_state in ('agreed', 'contract_received', 'reviewed', 'signed')
    and deal_state is distinct from next_state;
end;
$$;

notify pgrst, 'reload schema';
