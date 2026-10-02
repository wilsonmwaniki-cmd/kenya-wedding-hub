drop trigger if exists z_sync_contract_counterparty_attention_trigger on public.professional_contracts;
drop function if exists public.sync_contract_counterparty_attention();

create or replace function public.resolve_professional_contract_attention_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status
    and new.status in ('completed', 'cancelled') then
    update public.attention_items
    set
      status = 'completed',
      read_at = coalesce(read_at, now()),
      completed_at = coalesce(completed_at, now())
    where recipient_user_id = new.user_id
      and source_type = 'professional_contract'
      and source_id = new.id
      and dedupe_key = 'professional_contract:' || new.id::text || ':issuer:countersigned'
      and status not in ('completed', 'dismissed');
  end if;

  return new;
end;
$$;

drop trigger if exists zz_resolve_professional_contract_attention_lifecycle on public.professional_contracts;
create trigger zz_resolve_professional_contract_attention_lifecycle
after update of status on public.professional_contracts
for each row execute function public.resolve_professional_contract_attention_lifecycle();

revoke all on function public.resolve_professional_contract_attention_lifecycle() from public, anon, authenticated;
grant execute on function public.resolve_professional_contract_attention_lifecycle() to service_role;

update public.attention_items attention
set
  status = 'completed',
  read_at = coalesce(attention.read_at, now()),
  completed_at = coalesce(attention.completed_at, now())
from public.professional_contracts contract
where attention.recipient_user_id = contract.user_id
  and attention.source_type = 'professional_contract'
  and attention.source_id = contract.id
  and attention.dedupe_key = 'professional_contract:' || contract.id::text || ':issuer:countersigned'
  and attention.status not in ('completed', 'dismissed')
  and contract.status in ('completed', 'cancelled');
