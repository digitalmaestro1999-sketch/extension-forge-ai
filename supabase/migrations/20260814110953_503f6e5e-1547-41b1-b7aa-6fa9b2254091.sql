ALTER TABLE public.user_api_keys ADD COLUMN base_url text;
ALTER TABLE public.user_api_keys ADD COLUMN model_id text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_api_keys TO authenticated;
GRANT ALL ON public.user_api_keys TO service_role;
