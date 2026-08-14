ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS use_lovable_ai BOOLEAN NOT NULL DEFAULT true;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;