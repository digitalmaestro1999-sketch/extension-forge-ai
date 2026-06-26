
-- 1. Role enum
do $$ begin
  create type public.app_role as enum ('superadmin', 'admin', 'user');
exception when duplicate_object then null; end $$;

-- 2. user_roles table
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

-- 3. has_role security-definer function (prevents recursive RLS)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

revoke execute on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

-- 4. Policies
drop policy if exists "Users view own roles" on public.user_roles;
create policy "Users view own roles"
on public.user_roles for select
to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'superadmin'));

drop policy if exists "Superadmin inserts roles" on public.user_roles;
create policy "Superadmin inserts roles"
on public.user_roles for insert
to authenticated
with check (public.has_role(auth.uid(), 'superadmin'));

drop policy if exists "Superadmin updates roles" on public.user_roles;
create policy "Superadmin updates roles"
on public.user_roles for update
to authenticated
using (public.has_role(auth.uid(), 'superadmin'));

drop policy if exists "Superadmin deletes roles" on public.user_roles;
create policy "Superadmin deletes roles"
on public.user_roles for delete
to authenticated
using (public.has_role(auth.uid(), 'superadmin'));

-- 5. Auto-grant superadmin to the designated email (only when verified)
create or replace function public.grant_superadmin_for_known_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null
     and lower(new.email) = 'digitalmaestro1999@gmail.com' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'superadmin')
    on conflict (user_id, role) do nothing;

    -- default 'user' role too, so listings work uniformly
    insert into public.user_roles (user_id, role)
    values (new.id, 'user')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function public.grant_superadmin_for_known_email() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_grant_superadmin on auth.users;
create trigger on_auth_user_created_grant_superadmin
after insert on auth.users
for each row execute function public.grant_superadmin_for_known_email();

drop trigger if exists on_auth_user_confirmed_grant_superadmin on auth.users;
create trigger on_auth_user_confirmed_grant_superadmin
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.grant_superadmin_for_known_email();

-- 6. Default 'user' role for every new signup (kept separate so superadmin keeps both)
create or replace function public.grant_default_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;

revoke execute on function public.grant_default_user_role() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_default_role on auth.users;
create trigger on_auth_user_created_default_role
after insert on auth.users
for each row execute function public.grant_default_user_role();

-- 7. Backfill: if the superadmin email already exists & is verified, grant now
insert into public.user_roles (user_id, role)
select u.id, 'superadmin'::public.app_role
from auth.users u
where lower(u.email) = 'digitalmaestro1999@gmail.com'
  and u.email_confirmed_at is not null
on conflict (user_id, role) do nothing;

insert into public.user_roles (user_id, role)
select u.id, 'user'::public.app_role
from auth.users u
on conflict (user_id, role) do nothing;

-- 8. Admin-only view of users, gated by has_role inside an RPC
create or replace function public.admin_list_users()
returns table (
  user_id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  roles public.app_role[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id as user_id,
    u.email::text,
    coalesce(p.display_name, split_part(u.email, '@', 1)) as display_name,
    u.created_at,
    u.last_sign_in_at,
    coalesce(array_agg(ur.role) filter (where ur.role is not null), '{}')::public.app_role[] as roles
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  left join public.user_roles ur on ur.user_id = u.id
  where public.has_role(auth.uid(), 'superadmin')
  group by u.id, u.email, p.display_name, u.created_at, u.last_sign_in_at
  order by u.created_at desc;
$$;

revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;
