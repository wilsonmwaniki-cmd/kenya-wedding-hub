-- PostgREST upserts must be able to infer the conflict target directly.
-- UUID NULL values remain non-conflicting, so manual candidates can continue
-- to omit the Gateway idempotency key.
drop index if exists public.vendor_candidates_gateway_idempotency_key_unique;

create unique index vendor_candidates_gateway_idempotency_key_unique
  on public.vendor_candidates (gateway_idempotency_key);
