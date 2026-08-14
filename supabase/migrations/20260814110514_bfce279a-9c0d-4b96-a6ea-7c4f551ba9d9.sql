-- Grant superadmin role to canvakimberley@gmail.com
insert into public.user_roles (user_id, role)
select id, 'superadmin'::public.app_role
from auth.users
where lower(email) = 'canvakimberley@gmail.com'
on conflict (user_id, role) do nothing;
