
-- Revoke EXECUTE on SECURITY DEFINER functions from public/anon/authenticated.
-- Trigger functions don't need any direct EXECUTE grants.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_default_user_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_superadmin_for_known_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- has_role is used inside RLS policies (runs as definer there); no need for direct API access.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
-- Keep authenticated EXECUTE so RLS-side use is unaffected and client may call if needed.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- admin_list_users: only signed-in superadmins (the function itself gates with has_role).
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- Revoke anon SELECT on all public tables so they're not exposed via GraphQL/PostgREST
-- to unauthenticated callers. All app reads happen as authenticated.
REVOKE SELECT ON public.user_roles FROM anon;
REVOKE SELECT ON public.extension_installs FROM anon;
REVOKE SELECT ON public.extension_events FROM anon;
REVOKE SELECT ON public.extension_usage_daily FROM anon;
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.trend_discoveries FROM anon;
REVOKE SELECT ON public.extension_projects FROM anon;
REVOKE SELECT ON public.batch_queue FROM anon;
