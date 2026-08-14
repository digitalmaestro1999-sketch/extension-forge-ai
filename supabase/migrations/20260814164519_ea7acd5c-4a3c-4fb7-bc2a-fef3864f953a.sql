-- AI Model Registry and Enhanced Audit Logging
CREATE TABLE IF NOT EXISTS public.ai_model_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id TEXT NOT NULL UNIQUE,
    provider_id TEXT NOT NULL,
    model_display_name TEXT NOT NULL,
    capabilities TEXT[] DEFAULT '{}',
    context_window INTEGER,
    input_types TEXT[] DEFAULT '{"text"}',
    output_types TEXT[] DEFAULT '{"text"}',
    reasoning_support BOOLEAN DEFAULT FALSE,
    vision_support BOOLEAN DEFAULT FALSE,
    audio_support BOOLEAN DEFAULT FALSE,
    image_generation BOOLEAN DEFAULT FALSE,
    structured_output BOOLEAN DEFAULT FALSE,
    tool_calling BOOLEAN DEFAULT FALSE,
    streaming BOOLEAN DEFAULT TRUE,
    enabled BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    health_status TEXT DEFAULT 'UNKNOWN',
    latency_average_ms INTEGER,
    cost_per_1k_tokens_input NUMERIC,
    cost_per_1k_tokens_output NUMERIC,
    discovery_source TEXT DEFAULT 'manual',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enhanced Security Audit Logs with performance metrics
ALTER TABLE public.security_audit_logs 
ADD COLUMN IF NOT EXISTS latency_ms INTEGER,
ADD COLUMN IF NOT EXISTS token_usage JSONB,
ADD COLUMN IF NOT EXISTS model_id TEXT,
ADD COLUMN IF NOT EXISTS provider_id TEXT;

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.ai_model_registry TO authenticated;
GRANT ALL ON public.ai_model_registry TO service_role;

-- RLS
ALTER TABLE public.ai_model_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public models are viewable by everyone" 
ON public.ai_model_registry FOR SELECT TO authenticated USING (enabled = true);

-- Add initial standard models
INSERT INTO public.ai_model_registry (model_id, provider_id, model_display_name, capabilities, reasoning_support, vision_support, structured_output, discovery_source)
VALUES 
('google/gemini-2.5-flash', 'google', 'Gemini 2.5 Flash', '{"text_generation", "vision", "summarization"}', false, true, true, 'system'),
('google/gemini-2.5-pro', 'google', 'Gemini 2.5 Pro', '{"text_generation", "vision", "reasoning", "summarization"}', true, true, true, 'system'),
('gpt-4o', 'openai', 'GPT-4o', '{"text_generation", "vision", "reasoning"}', true, true, true, 'system'),
('gpt-4o-mini', 'openai', 'GPT-4o Mini', '{"text_generation", "vision"}', false, true, true, 'system')
ON CONFLICT (model_id) DO NOTHING;
