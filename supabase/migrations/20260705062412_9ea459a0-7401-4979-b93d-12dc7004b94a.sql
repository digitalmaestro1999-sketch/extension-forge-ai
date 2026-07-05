
-- Generation cost log
CREATE TABLE public.ops_generation_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.extension_projects(id) ON DELETE SET NULL,
  task_key text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  credits numeric(12,4) NOT NULL DEFAULT 0,
  latency_ms integer,
  success boolean NOT NULL DEFAULT true,
  fallback_used boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ops_gc_user_created ON public.ops_generation_costs (user_id, created_at DESC);
CREATE INDEX ops_gc_task_created ON public.ops_generation_costs (task_key, created_at DESC);
CREATE INDEX ops_gc_created ON public.ops_generation_costs (created_at DESC);
GRANT SELECT, INSERT ON public.ops_generation_costs TO authenticated;
GRANT ALL ON public.ops_generation_costs TO service_role;
ALTER TABLE public.ops_generation_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own cost rows" ON public.ops_generation_costs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own cost rows" ON public.ops_generation_costs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Superadmin views all cost rows" ON public.ops_generation_costs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));

-- Model routing rules
CREATE TABLE public.ops_model_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key text NOT NULL UNIQUE,
  label text NOT NULL,
  primary_provider text NOT NULL,
  primary_model text NOT NULL,
  fallback_chain jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_retries integer NOT NULL DEFAULT 2,
  timeout_ms integer NOT NULL DEFAULT 60000,
  temperature numeric(3,2) NOT NULL DEFAULT 0.5,
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ops_model_routes TO authenticated;
GRANT ALL ON public.ops_model_routes TO service_role;
ALTER TABLE public.ops_model_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Any signed-in can read model routes" ON public.ops_model_routes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Superadmin manages model routes" ON public.ops_model_routes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE TRIGGER trg_ops_model_routes_updated
  BEFORE UPDATE ON public.ops_model_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-user quotas
CREATE TABLE public.ops_user_quotas (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_generation_cap integer NOT NULL DEFAULT 500,
  monthly_token_cap integer NOT NULL DEFAULT 5000000,
  monthly_usd_cap numeric(12,2) NOT NULL DEFAULT 50.00,
  hard_block boolean NOT NULL DEFAULT false,
  notes text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ops_user_quotas TO authenticated;
GRANT ALL ON public.ops_user_quotas TO service_role;
ALTER TABLE public.ops_user_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own quota" ON public.ops_user_quotas
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Superadmin manages quotas" ON public.ops_user_quotas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE TRIGGER trg_ops_user_quotas_updated
  BEFORE UPDATE ON public.ops_user_quotas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Superadmin: full batch queue view
CREATE OR REPLACE FUNCTION public.ops_batch_queue_all(_limit int DEFAULT 200)
RETURNS TABLE (
  id uuid, user_id uuid, user_email text, idea text, status text,
  project_id uuid, error_message text, created_at timestamptz, completed_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT bq.id, bq.user_id, u.email::text, bq.idea, bq.status,
         bq.project_id, bq.error_message, bq.created_at, bq.completed_at
  FROM public.batch_queue bq
  LEFT JOIN auth.users u ON u.id = bq.user_id
  WHERE public.has_role(auth.uid(), 'superadmin')
  ORDER BY bq.created_at DESC
  LIMIT _limit;
$$;

-- Superadmin: cost summary (by task, by user, by day)
CREATE OR REPLACE FUNCTION public.ops_cost_summary(_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'generations', count(*),
        'tokens', COALESCE(sum(total_tokens),0),
        'cost_usd', COALESCE(sum(cost_usd),0),
        'credits', COALESCE(sum(credits),0),
        'failures', COALESCE(sum(CASE WHEN success THEN 0 ELSE 1 END),0),
        'fallbacks', COALESCE(sum(CASE WHEN fallback_used THEN 1 ELSE 0 END),0),
        'avg_latency_ms', COALESCE(avg(latency_ms),0)::int
      )
      FROM public.ops_generation_costs
      WHERE created_at >= now() - (_days || ' days')::interval
    ),
    'by_task', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT task_key, count(*) AS runs, sum(cost_usd) AS cost_usd,
               sum(total_tokens) AS tokens, avg(latency_ms)::int AS avg_latency_ms
        FROM public.ops_generation_costs
        WHERE created_at >= now() - (_days || ' days')::interval
        GROUP BY task_key ORDER BY sum(cost_usd) DESC NULLS LAST LIMIT 20
      ) t
    ),
    'by_model', (
      SELECT COALESCE(jsonb_agg(row_to_json(m)), '[]'::jsonb) FROM (
        SELECT provider, model, count(*) AS runs, sum(cost_usd) AS cost_usd,
               sum(total_tokens) AS tokens
        FROM public.ops_generation_costs
        WHERE created_at >= now() - (_days || ' days')::interval
        GROUP BY provider, model ORDER BY sum(cost_usd) DESC NULLS LAST LIMIT 20
      ) m
    ),
    'by_user', (
      SELECT COALESCE(jsonb_agg(row_to_json(u)), '[]'::jsonb) FROM (
        SELECT c.user_id, au.email::text AS email,
               count(*) AS runs, sum(c.cost_usd) AS cost_usd, sum(c.total_tokens) AS tokens
        FROM public.ops_generation_costs c
        LEFT JOIN auth.users au ON au.id = c.user_id
        WHERE c.created_at >= now() - (_days || ' days')::interval
        GROUP BY c.user_id, au.email ORDER BY sum(c.cost_usd) DESC NULLS LAST LIMIT 20
      ) u
    ),
    'daily', (
      SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.day), '[]'::jsonb) FROM (
        SELECT date_trunc('day', created_at)::date AS day,
               count(*) AS runs, sum(cost_usd) AS cost_usd, sum(total_tokens) AS tokens
        FROM public.ops_generation_costs
        WHERE created_at >= now() - (_days || ' days')::interval
        GROUP BY 1
      ) d
    )
  ) INTO result;
  RETURN result;
END;
$$;

-- Superadmin: list users with quotas + month-to-date usage
CREATE OR REPLACE FUNCTION public.ops_user_usage_list()
RETURNS TABLE (
  user_id uuid, email text, display_name text,
  monthly_generation_cap int, monthly_token_cap int, monthly_usd_cap numeric,
  hard_block boolean,
  mtd_generations bigint, mtd_tokens bigint, mtd_cost_usd numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH mtd AS (
    SELECT user_id,
           count(*) AS generations,
           COALESCE(sum(total_tokens),0) AS tokens,
           COALESCE(sum(cost_usd),0) AS cost_usd
    FROM public.ops_generation_costs
    WHERE created_at >= date_trunc('month', now())
    GROUP BY user_id
  )
  SELECT u.id, u.email::text, p.display_name,
         COALESCE(q.monthly_generation_cap, 500),
         COALESCE(q.monthly_token_cap, 5000000),
         COALESCE(q.monthly_usd_cap, 50.00),
         COALESCE(q.hard_block, false),
         COALESCE(m.generations, 0),
         COALESCE(m.tokens, 0),
         COALESCE(m.cost_usd, 0)
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN public.ops_user_quotas q ON q.user_id = u.id
  LEFT JOIN mtd m ON m.user_id = u.id
  WHERE public.has_role(auth.uid(), 'superadmin')
  ORDER BY COALESCE(m.cost_usd, 0) DESC, u.created_at DESC;
$$;

-- Seed default routing rules
INSERT INTO public.ops_model_routes (task_key, label, primary_provider, primary_model, fallback_chain, notes) VALUES
  ('intent',       'Intent extraction',      'google', 'google/gemini-2.5-flash-lite', '[{"provider":"google","model":"google/gemini-2.5-flash"},{"provider":"openai","model":"openai/gpt-5-nano"}]'::jsonb, 'Cheap classification of the user idea.'),
  ('architecture', 'Architecture planning',  'google', 'google/gemini-2.5-flash',      '[{"provider":"openai","model":"openai/gpt-5-mini"}]'::jsonb, 'MV3 architecture design.'),
  ('codegen',      'Code generation',        'openai', 'openai/gpt-5-mini',            '[{"provider":"google","model":"google/gemini-2.5-flash"},{"provider":"openai","model":"openai/gpt-5-nano"}]'::jsonb, 'Primary extension codegen path.'),
  ('security',    'Security review',         'google', 'google/gemini-2.5-flash',      '[{"provider":"openai","model":"openai/gpt-5-mini"}]'::jsonb, 'Static + policy review before packaging.'),
  ('icon',        'Icon generation',         'google', 'google/gemini-2.5-flash-image', '[]'::jsonb, 'Image model for extension icons.'),
  ('intel',       'Extension intelligence',  'google', 'google/gemini-2.5-flash',      '[{"provider":"openai","model":"openai/gpt-5-mini"}]'::jsonb, 'Deep intelligence + kit generation.')
ON CONFLICT (task_key) DO NOTHING;
