create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if _role = 'admin'::public.app_role
     and auth.uid() is not null
     and _user_id = auth.uid() then
    perform public.assert_current_auth_session_active();
  end if;

  return exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
end;
$$;
