REVOKE EXECUTE ON FUNCTION public.ops_batch_queue_all(integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ops_cost_summary(integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ops_user_usage_list() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.ops_batch_queue_all(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ops_cost_summary(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ops_user_usage_list() TO authenticated;

REVOKE SELECT ON public.intel_reports FROM anon;
REVOKE SELECT ON public.intel_competitors FROM anon;
REVOKE SELECT ON public.intel_analyses FROM anon;
REVOKE SELECT ON public.ops_model_routes FROM anon;
REVOKE SELECT ON public.ops_generation_costs FROM anon;
REVOKE SELECT ON public.ops_user_quotas FROM anon;