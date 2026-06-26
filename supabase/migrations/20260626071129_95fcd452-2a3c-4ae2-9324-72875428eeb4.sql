
-- ============ extension_installs ============
CREATE TABLE public.extension_installs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  extension_name text NOT NULL,
  extension_version text,
  source text NOT NULL DEFAULT 'generated', -- 'generated' | 'imported'
  fingerprint text, -- optional browser/device hint
  status text NOT NULL DEFAULT 'active', -- 'active' | 'paused' | 'revoked'
  kill_switch boolean NOT NULL DEFAULT false,
  license_expires_at timestamptz,
  daily_quota_minutes integer, -- null = unlimited
  weekly_quota_minutes integer,
  schedule_json jsonb, -- {days:[1..7], start_hour:9, end_hour:17, tz:"UTC"}
  token_hash text NOT NULL, -- sha256 of install secret
  last_seen_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_installs_owner ON public.extension_installs(owner_id);
CREATE INDEX idx_installs_last_seen ON public.extension_installs(last_seen_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.extension_installs TO authenticated;
GRANT ALL ON public.extension_installs TO service_role;

ALTER TABLE public.extension_installs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read own installs" ON public.extension_installs
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "owners insert own installs" ON public.extension_installs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "owners update own installs" ON public.extension_installs
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "owners delete own installs" ON public.extension_installs
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER trg_installs_updated
  BEFORE UPDATE ON public.extension_installs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ extension_events ============
CREATE TABLE public.extension_events (
  id bigserial PRIMARY KEY,
  install_id uuid NOT NULL REFERENCES public.extension_installs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- 'heartbeat' | 'action' | 'error'
  action_name text,
  duration_ms integer,
  error_message text,
  payload jsonb,
  ts timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_install_ts ON public.extension_events(install_id, ts DESC);
CREATE INDEX idx_events_owner_ts ON public.extension_events(owner_id, ts DESC);

GRANT SELECT, INSERT ON public.extension_events TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.extension_events_id_seq TO authenticated;
GRANT ALL ON public.extension_events TO service_role;
GRANT ALL ON SEQUENCE public.extension_events_id_seq TO service_role;

ALTER TABLE public.extension_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read own events" ON public.extension_events
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'superadmin'));

-- inserts happen via service-role edge function; no INSERT policy for authenticated

-- ============ extension_usage_daily ============
CREATE TABLE public.extension_usage_daily (
  install_id uuid NOT NULL REFERENCES public.extension_installs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  minutes_used integer NOT NULL DEFAULT 0,
  actions_count integer NOT NULL DEFAULT 0,
  errors_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (install_id, day)
);
CREATE INDEX idx_usage_owner_day ON public.extension_usage_daily(owner_id, day DESC);

GRANT SELECT ON public.extension_usage_daily TO authenticated;
GRANT ALL ON public.extension_usage_daily TO service_role;

ALTER TABLE public.extension_usage_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read own usage" ON public.extension_usage_daily
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'superadmin'));

-- ============ Realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.extension_installs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.extension_events;
