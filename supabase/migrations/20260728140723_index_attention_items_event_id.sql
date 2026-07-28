create index if not exists idx_attention_items_event_id
  on public.attention_items (event_id)
  where event_id is not null;
