create table if not exists public.subscription_renewal_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  audience text not null check (audience in ('vendor', 'planner')),
  reminder_stage text not null check (reminder_stage in ('14_days', '7_days', '3_days', '1_day', 'expired')),
  subscription_expires_at timestamptz not null,
  recipient_email text not null,
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  attempts integer not null default 1 check (attempts between 1 and 5),
  provider_message_id text null,
  last_error text null,
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, audience, subscription_expires_at, reminder_stage)
);

create index if not exists subscription_renewal_deliveries_status_idx
  on public.subscription_renewal_deliveries (status, updated_at);

create index if not exists subscription_renewal_deliveries_user_idx
  on public.subscription_renewal_deliveries (user_id, created_at desc);

drop trigger if exists update_subscription_renewal_deliveries_updated_at
  on public.subscription_renewal_deliveries;
create trigger update_subscription_renewal_deliveries_updated_at
before update on public.subscription_renewal_deliveries
for each row execute function public.update_updated_at_column();

alter table public.subscription_renewal_deliveries enable row level security;
revoke all on table public.subscription_renewal_deliveries from anon, authenticated;

comment on table public.subscription_renewal_deliveries is
  'Internal idempotency and delivery audit ledger for professional subscription renewal emails.';

do $$
begin
  if exists (select 1 from cron.job where jobname = 'send-subscription-renewal-reminders') then
    perform cron.unschedule('send-subscription-renewal-reminders');
  end if;

  if exists (select 1 from vault.decrypted_secrets where name = 'zania_project_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'zania_anon_key')
    and exists (select 1 from vault.decrypted_secrets where name = 'zania_pay_reconciliation_token') then
    perform cron.schedule(
      'send-subscription-renewal-reminders',
      '0 6 * * *',
      $job$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'zania_project_url')
            || '/functions/v1/send-subscription-renewal-reminders',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'zania_anon_key'),
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'zania_anon_key'),
            'x-zania-reconcile-token', (select decrypted_secret from vault.decrypted_secrets where name = 'zania_pay_reconciliation_token')
          ),
          body := jsonb_build_object('source', 'cron', 'requested_at', now()),
          timeout_milliseconds := 30000
        );
      $job$
    );
  end if;
end;
$$;
