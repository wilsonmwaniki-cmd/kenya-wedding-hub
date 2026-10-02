create or replace function public.save_commercial_document_items(
  _document_id uuid,
  _items jsonb
)
returns public.commercial_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  _document public.commercial_documents%rowtype;
  _item jsonb;
  _description text;
  _quantity numeric(12,2);
  _unit_price numeric(12,2);
  _line_total numeric(12,2);
  _sort_order integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
    into _document
  from public.commercial_documents
  where id = _document_id
    and user_id = auth.uid()
  limit 1;

  if _document.id is null then
    raise exception 'Commercial document not found';
  end if;

  delete from public.commercial_document_items
  where document_id = _document_id;

  if jsonb_typeof(coalesce(_items, '[]'::jsonb)) = 'array' then
    for _item in
      select value
      from jsonb_array_elements(coalesce(_items, '[]'::jsonb))
    loop
      _description := trim(coalesce(_item->>'description', ''));

      -- Drafts preserve incomplete rows so autosave can restore work in progress.
      -- Published documents continue to ignore blank commercial lines.
      if _description = '' and _document.status <> 'draft' then
        continue;
      end if;

      _quantity := greatest(coalesce((_item->>'quantity')::numeric, 1), 0);
      _unit_price := greatest(coalesce((_item->>'unit_price')::numeric, 0), 0);
      _line_total := coalesce((_item->>'line_total')::numeric, _quantity * _unit_price);
      _sort_order := coalesce((_item->>'sort_order')::integer, 0);

      insert into public.commercial_document_items (
        document_id,
        sort_order,
        description,
        quantity,
        unit_price,
        line_total,
        metadata
      )
      values (
        _document_id,
        _sort_order,
        _description,
        _quantity,
        _unit_price,
        greatest(_line_total, 0),
        coalesce(_item->'metadata', '{}'::jsonb)
      );
    end loop;
  end if;

  return public.recalculate_commercial_document_totals(_document_id);
end;
$$;

revoke all on function public.save_commercial_document_items(uuid, jsonb) from public;
grant execute on function public.save_commercial_document_items(uuid, jsonb) to authenticated;
