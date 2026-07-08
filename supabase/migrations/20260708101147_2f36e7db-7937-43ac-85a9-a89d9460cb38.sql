-- Phase 4: Competition Intelligence tables

CREATE TABLE public.intel_cws_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  cws_url TEXT NOT NULL,
  cws_id TEXT,
  category TEXT,
  name TEXT,
  developer TEXT,
  short_description TEXT,
  detailed_description TEXT,
  rating NUMERIC,
  rating_count INTEGER,
  user_count TEXT,
  version TEXT,
  last_updated TEXT,
  permissions JSONB DEFAULT '[]'::jsonb,
  features JSONB DEFAULT '[]'::jsonb,
  reviews JSONB DEFAULT '[]'::jsonb,
  review_sentiment JSONB,
  update_cadence JSONB,
  raw_markdown TEXT,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intel_cws_listings TO authenticated;
GRANT ALL ON public.intel_cws_listings TO service_role;

ALTER TABLE public.intel_cws_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own listings"
ON public.intel_cws_listings FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER intel_cws_listings_updated_at
BEFORE UPDATE ON public.intel_cws_listings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_intel_cws_listings_user ON public.intel_cws_listings(user_id, scraped_at DESC);
CREATE INDEX idx_intel_cws_listings_category ON public.intel_cws_listings(category);


CREATE TABLE public.intel_gap_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  project_id UUID,
  extension_name TEXT,
  category TEXT,
  competitor_ids UUID[] DEFAULT '{}',
  summary TEXT,
  missing_features JSONB DEFAULT '[]'::jsonb,
  differentiators JSONB DEFAULT '[]'::jsonb,
  opportunities JSONB DEFAULT '[]'::jsonb,
  threats JSONB DEFAULT '[]'::jsonb,
  keywords JSONB DEFAULT '[]'::jsonb,
  overall_score INTEGER,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intel_gap_reports TO authenticated;
GRANT ALL ON public.intel_gap_reports TO service_role;

ALTER TABLE public.intel_gap_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own gap reports"
ON public.intel_gap_reports FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER intel_gap_reports_updated_at
BEFORE UPDATE ON public.intel_gap_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_intel_gap_reports_user ON public.intel_gap_reports(user_id, created_at DESC);