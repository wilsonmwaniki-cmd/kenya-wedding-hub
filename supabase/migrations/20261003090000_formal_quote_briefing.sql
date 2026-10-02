create or replace function public.get_formal_quote_briefing(_wedding_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  acting_user_id uuid := auth.uid();
  request_rows jsonb;
begin
  if acting_user_id is null then
    raise exception 'Authentication required';
  end if;

  if _wedding_id is null or not public.is_wedding_member(_wedding_id) then
    raise exception 'Wedding access required';
  end if;

  with scoped_requests as (
    select request.*
    from public.document_requests request
    where request.wedding_id = _wedding_id
      and request.request_type = 'quote'
      and (
        request.requester_user_id = acting_user_id
        or request.recipient_user_id = acting_user_id
        or exists (
          select 1
          from public.planner_clients client
          where client.id = request.client_id
            and client.planner_user_id = acting_user_id
            and client.is_archived = false
        )
      )
    order by request.created_at desc, request.id
    limit 500
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', request.id,
      'vendorId', request.vendor_id,
      'vendorName', coalesce(nullif(btrim(vendor.name), ''), nullif(btrim(request.recipient_name), ''), 'Vendor'),
      'serviceCategory', request.service_category,
      'status', request.status,
      'message', request.message,
      'createdAt', request.created_at,
      'dueAt', request.due_at,
      'viewedAt', request.viewed_at,
      'respondedAt', request.responded_at,
      'isOverdue', request.status in ('new', 'viewed', 'changes_requested')
        and request.due_at is not null and request.due_at < now(),
      'formalQuote', case when document.id is null then null else jsonb_build_object(
        'id', document.id,
        'documentNumber', document.document_number,
        'title', document.title,
        'status', document.status,
        'currency', document.currency,
        'subtotal', document.subtotal,
        'discountAmount', document.discount_amount,
        'taxAmount', document.tax_amount,
        'totalAmount', document.total_amount,
        'issueDate', document.issue_date,
        'validUntil', document.due_date,
        'notes', document.notes,
        'terms', document.terms,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'description', item.description,
            'quantity', item.quantity,
            'unitPrice', item.unit_price,
            'lineTotal', item.line_total
          ) order by item.sort_order, item.id)
          from public.commercial_document_items item
          where item.document_id = document.id
        ), '[]'::jsonb)
      ) end
    ) order by request.created_at desc, request.id), '[]'::jsonb)
  into request_rows
  from scoped_requests request
  left join public.vendors vendor on vendor.id = request.vendor_id
  left join public.commercial_documents document
    on document.id = request.response_document_id
   and document.document_type = 'quote'
  ;

  return jsonb_build_object('requests', request_rows);
end;
$$;

revoke all on function public.get_formal_quote_briefing(uuid) from public, anon;
grant execute on function public.get_formal_quote_briefing(uuid) to authenticated;

comment on function public.get_formal_quote_briefing(uuid) is
  'Returns participant-scoped formal quote request status and response document evidence for conversational comparison. Indicative enquiry replies are intentionally excluded.';
