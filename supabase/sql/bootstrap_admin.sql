-- Replace the email before running this file.

alter table public.profiles
disable trigger prevent_profile_role_change_unless_admin;

insert into public.profiles (user_id, full_name, role)
select id, 'Owner User', 'couple'::public.app_role
from auth.users
where email = 'owner@example.com'
on conflict (user_id) do nothing;

update public.profiles
set role = 'admin'::public.app_role
where user_id = (
  select id
  from auth.users
  where email = 'owner@example.com'
  limit 1
);

insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from auth.users
where email = 'owner@example.com'
on conflict (user_id, role) do nothing;

delete from public.user_roles
where user_id = (
  select id
  from auth.users
  where email = 'owner@example.com'
  limit 1
)
and role <> 'admin'::public.app_role;

alter table public.profiles
enable trigger prevent_profile_role_change_unless_admin;

select p.user_id, p.role, ur.role as user_role
from public.profiles p
left join public.user_roles ur on ur.user_id = p.user_id
where p.user_id = (
  select id
  from auth.users
  where email = 'owner@example.com'
  limit 1
);
