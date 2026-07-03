import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Volume2, VolumeX, X, ChevronLeft, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "efai_voice_onboarded_v1";

type Step = {
  title: string;
  route?: string;
  narration: string;
};

const STEPS: Step[] = [
  {
    title: "Welcome to Extension Forge AI",
    narration:
      "Welcome to Extension Forge AI, your autonomous factory for Chrome extensions. In the next minute, I will walk you through every core module so you know exactly where to go.",
  },
  {
    title: "Dashboard",
    route: "/dashboard",
    narration:
      "This is your Dashboard. It shows live activity, quick actions, and the Getting Started guide. Every module is one click away from the sidebar.",
  },
  {
    title: "Create Extension",
    route: "/create",
    narration:
      "Create Extension is the fast path. Describe what you want, pick a preset in the Prompt Studio, and the autonomous agent pipeline generates a production-ready Manifest V3 extension.",
  },
  {
    title: "Wizard",
    route: "/wizard",
    narration:
      "The Wizard is the guided path. Configure your extension step by step and preview the live rendered popup on the right before you export.",
  },
  {
    title: "Templates & Themes",
    route: "/templates",
    narration:
      "Templates give you battle-tested starting points. Combined with the Theme Studio you can apply eight neon themes and six logo styles in seconds.",
  },
  {
    title: "Manage Extension",
    route: "/manage",
    narration:
      "Manage lets you import any third-party extension as a ZIP or CRX, analyze it, chat-edit it, and clone it — without ever publishing to the store.",
  },
  {
    title: "Software Intelligence",
    route: "/intelligence",
    narration:
      "Software Intelligence performs a real-time code scan of any project, surfaces AI insights, offers auto-fix, and includes a Naming Studio for rebranding.",
  },
  {
    title: "Live Control Center",
    route: "/control",
    narration:
      "Live Control gives you HMAC-secured remote control over your deployed extensions, including usage limits and live telemetry.",
  },
  {
    title: "Package & Publish",
    route: "/package",
    narration:
      "Package runs the quality suite: permission risk analysis, CSP hardening, message and storage shields, and Chrome Web Store policy checks — then zips a certified build.",
  },
  {
    title: "Trends & Batch",
    route: "/trends",
    narration:
      "Trends discovers profitable niches across thirty plus categories. Batch queues up to one hundred extensions per day for autonomous mass generation.",
  },
  {
    title: "Revenue & Portfolio",
    route: "/portfolio",
    narration:
      "Portfolio tracks every extension you own. Revenue Tracker aggregates real telemetry so you can see what is earning and what to double down on.",
  },
  {
    title: "API Manager",
    route: "/api-manager",
    narration:
      "The API Manager is your encrypted vault. Store keys for OpenAI, Gemini, NVIDIA NIM, and Deepgram — the last one powers this very voice assistant.",
  },
  {
    title: "You're all set",
    narration:
      "You are ready to build. Anytime you need help, tap the microphone button in the bottom right for live voice support. Happy forging!",
  },
];

async function fetchTts(text: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke("voice-support", {
      body: { mode: "tts", text },
    });
    if (error) throw error;
    const d = data as { audio_b64?: string | null; error?: string };
    if (d?.error) throw new Error(d.error);
    return d?.audio_b64 ?? null;
  } catch (e) {
    console.warn("TTS unavailable:", (e as Error).message);
    return null;
  }
}

export function VoiceOnboarding() {
  const [visible, setVisible] = useState(false);
  const [i, setI] = useState(0);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<number, string>>(new Map());
  const abortRef = useRef<number>(0);
  const navigate = useNavigate();

  const step = useMemo(() => STEPS[i], [i]);
  const total = STEPS.length;

  useEffect(() => {
    // Only show if this user (in this browser) hasn't seen it yet.
    if (typeof window === "undefined") return;
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch (_) { /* ignore storage errors */ }
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (step.route) navigate(step.route);
    const token = ++abortRef.current;
    if (muted) return;

    (async () => {
      setLoading(true);
      let b64 = cacheRef.current.get(i) ?? null;
      if (!b64) {
        b64 = await fetchTts(step.narration);
        if (b64) cacheRef.current.set(i, b64);
      }
      if (token !== abortRef.current) return;
      setLoading(false);
      if (!b64 || !audioRef.current) return;
      try {
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
        const url = URL.createObjectURL(new Blob([arr], { type: "audio/mpeg" }));
        audioRef.current.src = url;
        void audioRef.current.play().catch(() => { /* autoplay blocked */ });
      } catch (_) { /* noop */ }
    })();

    return () => { abortRef.current++; };
  }, [i, visible, muted, step, navigate]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, i]);

  function stopAudio() {
    try {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
    } catch (_) { /* noop */ }
  }
  function next() {
    stopAudio();
    if (i >= total - 1) finish();
    else setI(i + 1);
  }
  function prev() {
    stopAudio();
    if (i > 0) setI(i - 1);
  }
  function finish() {
    stopAudio();
    try { window.localStorage.setItem(STORAGE_KEY, new Date().toISOString()); } catch (_) { /* noop */ }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <>
      <audio ref={audioRef} className="hidden" onEnded={() => { /* stay on step */ }} />
      <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-primary/30 bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/15 via-accent/10 to-transparent">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-xs font-mono text-muted-foreground">Voice Tour · {i + 1}/{total}</div>
                <div className="text-sm font-semibold">{step.title}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setMuted((m) => !m); stopAudio(); }}
                aria-label={muted ? "Unmute narration" : "Mute narration"}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={finish} aria-label="Skip tour">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="p-5 text-sm leading-relaxed text-foreground/90 min-h-[120px]">
            {step.narration}
            {loading && !muted && (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Generating voice…
              </div>
            )}
          </div>

          <div className="h-1 bg-muted">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent transition-all"
              style={{ width: `${((i + 1) / total) * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between p-3 border-t border-border">
            <Button variant="ghost" size="sm" onClick={finish}>Skip</Button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={prev} disabled={i === 0}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button size="sm" onClick={next}>
                {i === total - 1 ? "Finish" : "Next"}
                {i < total - 1 && <ChevronRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
