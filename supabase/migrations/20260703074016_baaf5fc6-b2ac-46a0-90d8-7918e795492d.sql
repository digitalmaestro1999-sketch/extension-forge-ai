CREATE TABLE public.support_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  audio_ms integer,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.support_conversations TO authenticated;
GRANT ALL ON public.support_conversations TO service_role;

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own support conversations"
  ON public.support_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own support conversations"
  ON public.support_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own support conversations"
  ON public.support_conversations FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX support_conversations_user_created_idx
  ON public.support_conversations (user_id, created_at DESC);