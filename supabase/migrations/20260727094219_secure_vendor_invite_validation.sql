-- The invite trigger must call the private entitlement helper after the July
-- RPC hardening. Keep the helper private and authorize the trigger explicitly.
create or replace function public.validate_workspace_vendor_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_wedding_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to create a vendor invite'
      using errcode = '42501';
  end if;

  if not public.can_manage_wedding_memberships(new.wedding_id) then
    raise exception 'You do not have permission to create vendor invites for this wedding'
      using errcode = '42501';
  end if;

  if new.invite_contact_email is not null then
    new.invite_contact_email := lower(nullif(btrim(new.invite_contact_email), ''));
  end if;

  if new.invite_contact_phone is not null then
    new.invite_contact_phone := nullif(btrim(new.invite_contact_phone), '');
  end if;

  if new.invited_by_user_id is null then
    new.invited_by_user_id := auth.uid();
  elsif new.invited_by_user_id <> auth.uid() then
    raise exception 'Vendor invites must be created by the signed-in user'
      using errcode = '42501';
  end if;

  resolved_wedding_id := public.resolve_vendor_workspace_wedding_id(new.vendor_id);

  if resolved_wedding_id is null then
    raise exception 'Vendor must belong to a wedding workspace before invite records can be created'
      using errcode = 'P0001';
  end if;

  if new.wedding_id <> resolved_wedding_id then
    raise exception 'Vendor invite wedding does not match the vendor workspace'
      using errcode = 'P0001';
  end if;

  perform public.assert_wedding_feature_enabled(
    new.wedding_id,
    'vendor_collaboration',
    'COLLABORATOR_INVITE_ATTEMPTED'
  );

  return new;
end;
$$;

revoke all on function public.validate_workspace_vendor_invite() from public;
revoke all on function public.validate_workspace_vendor_invite() from anon;
revoke all on function public.validate_workspace_vendor_invite() from authenticated;
grant execute on function public.validate_workspace_vendor_invite() to service_role;
