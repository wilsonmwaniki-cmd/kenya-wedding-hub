-- Professional document tools are paid business operations. Enforce the same
-- entitlement in Postgres so a hidden route or direct API call cannot bypass it.

create or replace function public.has_active_professional_entitlement(
  _user_id uuid,
  _audience text,
  _feature_key text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.professional_entitlements pe
    where pe.user_id = _user_id
      and pe.audience = _audience
      and pe.feature_key = _feature_key
      and pe.status = 'active'
      and pe.effective_from <= now()
      and (pe.effective_to is null or pe.effective_to > now())
  );
$$;

create or replace function public.can_manage_own_commercial_document(
  _user_id uuid,
  _role text
)
returns boolean
language sql
stable
as $$
  select auth.uid() = _user_id
    and _role in ('vendor', 'planner')
    and public.has_active_professional_entitlement(_user_id, _role, 'invoicing');
$$;

create or replace function public.enforce_commercial_document_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid;
  _role text;
begin
  if tg_op = 'DELETE' then
    _user_id := old.user_id;
    _role := old.role;
  else
    _user_id := new.user_id;
    _role := new.role;
  end if;

  if not public.can_manage_own_commercial_document(_user_id, _role) then
    raise exception 'Professional plan required for client documents';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists enforce_commercial_document_entitlement_trigger on public.commercial_documents;
create trigger enforce_commercial_document_entitlement_trigger
before insert or update or delete on public.commercial_documents
for each row execute function public.enforce_commercial_document_entitlement();

create or replace function public.enforce_commercial_document_child_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _document_id uuid;
  _document public.commercial_documents%rowtype;
begin
  if tg_op = 'DELETE' then
    _document_id := old.document_id;
  else
    _document_id := new.document_id;
  end if;

  select * into _document
  from public.commercial_documents
  where id = _document_id;

  if _document.id is null
    or not public.can_manage_own_commercial_document(_document.user_id, _document.role)
  then
    raise exception 'Professional plan required for client documents';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists enforce_commercial_document_item_entitlement_trigger on public.commercial_document_items;
create trigger enforce_commercial_document_item_entitlement_trigger
before insert or update or delete on public.commercial_document_items
for each row execute function public.enforce_commercial_document_child_entitlement();

drop trigger if exists enforce_commercial_document_payment_entitlement_trigger on public.commercial_document_payments;
create trigger enforce_commercial_document_payment_entitlement_trigger
before insert or update or delete on public.commercial_document_payments
for each row execute function public.enforce_commercial_document_child_entitlement();

drop policy if exists "Users can manage own commercial document shares" on public.commercial_document_shares;
create policy "Users can manage own commercial document shares"
on public.commercial_document_shares
for all
using (auth.uid() = user_id and public.can_access_own_commercial_document(document_id))
with check (auth.uid() = user_id and public.can_access_own_commercial_document(document_id));

drop policy if exists "Users can view own professional contracts" on public.professional_contracts;
create policy "Users can view own professional contracts"
on public.professional_contracts for select
using (auth.uid() = user_id and public.has_active_professional_entitlement(user_id, role, 'contract_management'));

drop policy if exists "Users can insert own professional contracts" on public.professional_contracts;
create policy "Users can insert own professional contracts"
on public.professional_contracts for insert
with check (
  auth.uid() = user_id
  and role in ('vendor', 'planner')
  and public.has_active_professional_entitlement(user_id, role, 'contract_management')
);

drop policy if exists "Users can update own professional contracts" on public.professional_contracts;
create policy "Users can update own professional contracts"
on public.professional_contracts for update
using (auth.uid() = user_id and public.has_active_professional_entitlement(user_id, role, 'contract_management'))
with check (
  auth.uid() = user_id
  and role in ('vendor', 'planner')
  and public.has_active_professional_entitlement(user_id, role, 'contract_management')
);

drop policy if exists "Users can delete own professional contracts" on public.professional_contracts;
create policy "Users can delete own professional contracts"
on public.professional_contracts for delete
using (auth.uid() = user_id and public.has_active_professional_entitlement(user_id, role, 'contract_management'));

drop policy if exists "Users can view own document templates" on public.professional_document_templates;
create policy "Users can view own document templates"
on public.professional_document_templates for select
using (auth.uid() = user_id and public.has_active_professional_entitlement(user_id, role, 'invoicing'));

drop policy if exists "Users can insert own document templates" on public.professional_document_templates;
create policy "Users can insert own document templates"
on public.professional_document_templates for insert
with check (
  auth.uid() = user_id
  and role in ('vendor', 'planner')
  and public.has_active_professional_entitlement(user_id, role, 'invoicing')
);

drop policy if exists "Users can update own document templates" on public.professional_document_templates;
create policy "Users can update own document templates"
on public.professional_document_templates for update
using (auth.uid() = user_id and public.has_active_professional_entitlement(user_id, role, 'invoicing'))
with check (
  auth.uid() = user_id
  and role in ('vendor', 'planner')
  and public.has_active_professional_entitlement(user_id, role, 'invoicing')
);

drop policy if exists "Users can delete own document templates" on public.professional_document_templates;
create policy "Users can delete own document templates"
on public.professional_document_templates for delete
using (auth.uid() = user_id and public.has_active_professional_entitlement(user_id, role, 'invoicing'));

grant execute on function public.has_active_professional_entitlement(uuid, text, text) to authenticated;
