-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Extension projects table
CREATE TABLE public.extension_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  spec JSONB NOT NULL DEFAULT '{}',
  files JSONB NOT NULL DEFAULT '{}',
  security_audit JSONB,
  compliance_report JSONB,
  store_assets JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'tested', 'packaged', 'published')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.extension_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own projects" ON public.extension_projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own projects" ON public.extension_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own projects" ON public.extension_projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own projects" ON public.extension_projects FOR DELETE USING (auth.uid() = user_id);

-- Trend discoveries table
CREATE TABLE public.trend_discoveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity TEXT NOT NULL,
  description TEXT,
  demand_score INTEGER NOT NULL DEFAULT 0 CHECK (demand_score >= 0 AND demand_score <= 100),
  competition_score INTEGER NOT NULL DEFAULT 0 CHECK (competition_score >= 0 AND competition_score <= 100),
  revenue_potential TEXT NOT NULL DEFAULT 'medium' CHECK (revenue_potential IN ('low', 'medium', 'high')),
  category TEXT,
  sources JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN ('discovered', 'validated', 'building', 'completed', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trend_discoveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own discoveries" ON public.trend_discoveries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create discoveries" ON public.trend_discoveries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own discoveries" ON public.trend_discoveries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own discoveries" ON public.trend_discoveries FOR DELETE USING (auth.uid() = user_id);

-- Batch queue table
CREATE TABLE public.batch_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idea TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  project_id UUID REFERENCES public.extension_projects(id),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.batch_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own queue" ON public.batch_queue FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create queue items" ON public.batch_queue FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own queue items" ON public.batch_queue FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own queue items" ON public.batch_queue FOR DELETE USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.extension_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();