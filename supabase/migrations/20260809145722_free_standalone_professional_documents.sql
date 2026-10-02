-- Standalone professional documents are free. The Professional subscription is
-- required only when a planner or vendor connects a document to a Zania client
-- relationship or answers an in-app document request.

alter table public.professional_entitlements
  drop constraint if exists professional_entitlements_feature_key_check;

alter table public.professional_entitlements
  add constraint professional_entitlements_feature_key_check
  check (
    feature_key in (
      'directory_listing',
      'verified_listing',
      'booking_management',
      'document_collaboration',
      'invoicing',
      'contract_management',
      'public_reputation',
      'media_portfolio',
      'advertising',
      'team_workspace'
    )
  );

insert into public.professional_entitlements (
  user_id,
  audience,
  feature_key,
  status,
  source_lookup_key,
  source_bundle_code,
  seat_limit,
  effective_from,
  effective_to,
  metadata
)
select
  entitlement.user_id,
  entitlement.audience,
  'document_collaboration',
  entitlement.status,
  entitlement.source_lookup_key,
  entitlement.source_bundle_code,
  entitlement.seat_limit,
  entitlement.effective_from,
  entitlement.effective_to,
  entitlement.metadata || jsonb_build_object('source_feature_key', entitlement.feature_key)
from public.professional_entitlements entitlement
where entitlement.feature_key = 'invoicing'
on conflict (user_id, audience, feature_key) do nothing;

update public.pricing_catalog
set config = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        config,
        '{checkout,professionalCheckoutMap,planner_premium_monthly,features}',
        '["booking_management", "document_collaboration", "media_portfolio"]'::jsonb,
        true
      ),
      '{checkout,professionalCheckoutMap,planner_premium_annual,features}',
      '["booking_management", "document_collaboration", "media_portfolio"]'::jsonb,
      true
    ),
    '{checkout,professionalCheckoutMap,vendor_premium_monthly,features}',
    '["booking_management", "document_collaboration", "media_portfolio"]'::jsonb,
    true
  ),
  '{checkout,professionalCheckoutMap,vendor_premium_annual,features}',
  '["booking_management", "document_collaboration", "media_portfolio"]'::jsonb,
  true
),
updated_at = now()
where is_active = true;

create or replace function public.can_manage_own_commercial_document(
  _user_id uuid,
  _role text
)
returns boolean
language sql
stable
set search_path = public
as $$
  select (select auth.uid()) = _user_id
    and _role in ('vendor', 'planner');
$$;

create or replace function public.can_connect_professional_document(
  _user_id uuid,
  _role text,
  _client_id uuid default null,
  _vendor_id uuid default null
)
returns boolean
language sql
stable
set search_path = public
as $$
  select (
    _client_id is null
    and _vendor_id is null
  )
  or public.has_active_professional_entitlement(_user_id, _role, 'document_collaboration')
  or public.has_active_professional_entitlement(_user_id, _role, 'invoicing');
$$;

revoke all on function public.can_connect_professional_document(uuid, text, uuid, uuid) from public, anon;
grant execute on function public.can_connect_professional_document(uuid, text, uuid, uuid) to authenticated;

create or replace function public.enforce_commercial_document_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_own_commercial_document(new.user_id, new.role) then
    raise exception 'You can only manage documents owned by your professional account';
  end if;

  if not public.can_connect_professional_document(
    new.user_id,
    new.role,
    new.client_id,
    new.vendor_id
  ) then
    raise exception 'Professional plan required to connect documents to Zania clients';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_commercial_document_entitlement_trigger on public.commercial_documents;
create trigger enforce_commercial_document_entitlement_trigger
before insert or update on public.commercial_documents
for each row execute function public.enforce_commercial_document_entitlement();

-- Items and payment records are part of the free standalone document manager.
-- The parent trigger prevents a free account from creating a connected parent.
drop trigger if exists enforce_commercial_document_item_entitlement_trigger on public.commercial_document_items;
drop trigger if exists enforce_commercial_document_payment_entitlement_trigger on public.commercial_document_payments;

drop policy if exists "Users can view own professional contracts" on public.professional_contracts;
create policy "Users can view own professional contracts"
on public.professional_contracts for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own professional contracts" on public.professional_contracts;
create policy "Users can insert own professional contracts"
on public.professional_contracts for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and role in ('vendor', 'planner')
  and public.can_connect_professional_document(user_id, role, client_id, vendor_id)
);

drop policy if exists "Users can update own professional contracts" on public.professional_contracts;
create policy "Users can update own professional contracts"
on public.professional_contracts for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and role in ('vendor', 'planner')
  and public.can_connect_professional_document(user_id, role, client_id, vendor_id)
);

drop policy if exists "Users can delete own professional contracts" on public.professional_contracts;
create policy "Users can delete own professional contracts"
on public.professional_contracts for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own document templates" on public.professional_document_templates;
create policy "Users can view own document templates"
on public.professional_document_templates for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own document templates" on public.professional_document_templates;
create policy "Users can insert own document templates"
on public.professional_document_templates for insert
to authenticated
with check ((select auth.uid()) = user_id and role in ('vendor', 'planner'));

drop policy if exists "Users can update own document templates" on public.professional_document_templates;
create policy "Users can update own document templates"
on public.professional_document_templates for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and role in ('vendor', 'planner'));

drop policy if exists "Users can delete own document templates" on public.professional_document_templates;
create policy "Users can delete own document templates"
on public.professional_document_templates for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.enforce_document_request_response_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'responded'
    and old.status is distinct from 'responded'
    and not (
      public.has_active_professional_entitlement(
        new.recipient_user_id,
        new.recipient_role,
        'document_collaboration'
      )
      or public.has_active_professional_entitlement(
        new.recipient_user_id,
        new.recipient_role,
        'invoicing'
      )
    )
  then
    raise exception 'Professional plan required to connect a response to a Zania client';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_document_request_response_entitlement_trigger on public.document_requests;
create trigger enforce_document_request_response_entitlement_trigger
before update of status, response_document_id, response_contract_id on public.document_requests
for each row execute function public.enforce_document_request_response_entitlement();

revoke all on function public.enforce_commercial_document_entitlement() from public, anon, authenticated;
revoke all on function public.enforce_commercial_document_child_entitlement() from public, anon, authenticated;
revoke all on function public.enforce_document_request_response_entitlement() from public, anon, authenticated;
;
