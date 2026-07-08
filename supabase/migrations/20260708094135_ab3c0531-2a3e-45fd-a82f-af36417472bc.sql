
CREATE TABLE public.security_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  project_id UUID,
  extension_name TEXT,
  passed BOOLEAN,
  blockers INTEGER NOT NULL DEFAULT 0,
  warnings INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX security_audit_logs_user_created_idx ON public.security_audit_logs(user_id, created_at DESC);
CREATE INDEX security_audit_logs_event_type_idx ON public.security_audit_logs(event_type, created_at DESC);

GRANT SELECT, INSERT ON public.security_audit_logs TO authenticated;
GRANT ALL ON public.security_audit_logs TO service_role;

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own audit logs"
  ON public.security_audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users read own audit logs"
  ON public.security_audit_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "superadmins read all audit logs"
  ON public.security_audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));
