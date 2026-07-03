
DO $$ BEGIN
  CREATE TYPE public.user_status AS ENUM ('pending','active','declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status public.user_status NOT NULL DEFAULT 'pending';

-- Grandfather existing profiles as active
UPDATE public.profiles SET status = 'active' WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN lower(NEW.email) = 'digitalmaestro1999@gmail.com' THEN 'active'::public.user_status ELSE 'pending'::public.user_status END
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_status(_user_id uuid, _status public.user_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.profiles SET status = _status, updated_at = now() WHERE user_id = _user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(uuid, public.user_status) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_list_users();
CREATE FUNCTION public.admin_list_users()
RETURNS TABLE(user_id uuid, email text, display_name text, status public.user_status, created_at timestamptz, last_sign_in_at timestamptz, roles app_role[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select
    u.id, u.email::text,
    coalesce(p.display_name, split_part(u.email, '@', 1)),
    coalesce(p.status, 'pending'::public.user_status),
    u.created_at, u.last_sign_in_at,
    coalesce(array_agg(ur.role) filter (where ur.role is not null), '{}')::public.app_role[]
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  left join public.user_roles ur on ur.user_id = u.id
  where public.has_role(auth.uid(), 'superadmin')
  group by u.id, u.email, p.display_name, p.status, u.created_at, u.last_sign_in_at
  order by u.created_at desc;
$$;
