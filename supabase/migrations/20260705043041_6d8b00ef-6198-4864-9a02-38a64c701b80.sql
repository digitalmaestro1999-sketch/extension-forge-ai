
-- intel_reports
CREATE TABLE public.intel_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  input_type text NOT NULL CHECK (input_type IN ('keyword','category','url','chrome_id')),
  input_value text NOT NULL,
  title text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intel_reports TO authenticated;
GRANT ALL ON public.intel_reports TO service_role;
ALTER TABLE public.intel_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reports" ON public.intel_reports FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER intel_reports_updated BEFORE UPDATE ON public.intel_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- intel_competitors
CREATE TABLE public.intel_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.intel_reports(id) ON DELETE CASCADE,
  chrome_id text,
  name text NOT NULL,
  developer text,
  rating numeric,
  review_count integer,
  users_count text,
  category text,
  url text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  rank integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intel_competitors TO authenticated;
GRANT ALL ON public.intel_competitors TO service_role;
ALTER TABLE public.intel_competitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own competitors" ON public.intel_competitors FOR ALL
  USING (EXISTS (SELECT 1 FROM public.intel_reports r WHERE r.id = report_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.intel_reports r WHERE r.id = report_id AND r.user_id = auth.uid()));
CREATE INDEX intel_competitors_report_idx ON public.intel_competitors(report_id);

-- intel_analyses
CREATE TABLE public.intel_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.intel_reports(id) ON DELETE CASCADE,
  competitor_id uuid REFERENCES public.intel_competitors(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intel_analyses TO authenticated;
GRANT ALL ON public.intel_analyses TO service_role;
ALTER TABLE public.intel_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own analyses" ON public.intel_analyses FOR ALL
  USING (EXISTS (SELECT 1 FROM public.intel_reports r WHERE r.id = report_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.intel_reports r WHERE r.id = report_id AND r.user_id = auth.uid()));
CREATE INDEX intel_analyses_report_module_idx ON public.intel_analyses(report_id, module_key);
