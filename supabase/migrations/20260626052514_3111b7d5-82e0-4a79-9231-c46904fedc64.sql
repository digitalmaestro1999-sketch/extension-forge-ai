-- 1. Revoke EXECUTE on SECURITY DEFINER trigger-only functions from anon + authenticated.
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 2. Hide app tables from anonymous GraphQL introspection / queries.
-- RLS already prevents data leakage; this removes them from the anon-visible schema entirely.
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.extension_projects FROM anon;
REVOKE SELECT ON public.batch_queue FROM anon;
REVOKE SELECT ON public.trend_discoveries FROM anon;