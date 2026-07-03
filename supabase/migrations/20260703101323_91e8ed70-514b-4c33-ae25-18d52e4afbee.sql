
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_status(uuid, user_status) FROM anon, PUBLIC;
REVOKE SELECT ON public.user_api_keys FROM anon;
REVOKE SELECT ON public.support_conversations FROM anon;
