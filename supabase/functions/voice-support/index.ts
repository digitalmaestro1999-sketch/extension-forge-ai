// Voice Support Agent: Deepgram STT → Lovable AI (Gemini) answer → Deepgram TTS.
// Auth: verifies Supabase JWT. Deepgram key sourced from the user's encrypted
// vault (service='deepgram'); falls back to project-level DEEPGRAM_API_KEY.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENC_SECRET = Deno.env.get("API_KEY_ENCRYPTION_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const FALLBACK_DEEPGRAM = Deno.env.get("DEEPGRAM_API_KEY") ?? "";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB
const RATE_LIMIT_PER_MIN = 20;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
function b64encode(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

let cachedKey: CryptoKey | null = null;
async function getEncKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  if (!ENC_SECRET || ENC_SECRET.length < 16) {
    throw new Error("API_KEY_ENCRYPTION_KEY not configured");
  }
  const raw = new TextEncoder().encode(ENC_SECRET);
  const digest = await crypto.subtle.digest("SHA-256", raw);
  cachedKey = await crypto.subtle.importKey(
    "raw", digest, { name: "AES-GCM" }, false, ["decrypt"],
  );
  return cachedKey;
}
async function decrypt(ciphertext: string, iv: string): Promise<string> {
  const key = await getEncKey();
  const buf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(iv) }, key, b64decode(ciphertext),
  );
  return new TextDecoder().decode(buf);
}

const KNOWLEDGE = `You are the Extension Forge AI support agent. Answer concisely and professionally.

Platform capabilities:
- AI-powered Chrome Extension (Manifest V3) generator with Wizard, Prompt Studio, and Autonomous Agent Pipeline.
- Modules: Trend Discovery, Batch Queue, Portfolio & Revenue analytics, Theme Studio, Browser Compatibility, Permission & Host-Origin Risk analyzer with safety-checked auto-fix, CSP hardening, Message/Storage shields, CWS Program Policy scanner, Publish Assistant.
- Manage Extension: import third-party ZIP/CRX, analyze, chat-edit, clone (no store upload required).
- Live Control Center: HMAC-secured remote usage control & telemetry.
- Software Intelligence Center: real-time code scan with AI insights, auto-fix, Naming Studio.
- API Manager: encrypted vault for user API keys (OpenAI, Gemini, NVIDIA NIM, Deepgram…).
- Auth: Google/Email with superadmin approval gating (new users start 'pending').
- Voice Support (this feature): Deepgram Nova STT + Gemini + Deepgram Aura TTS.

Rules:
- If you don't know, say so and suggest opening the /manual page.
- Keep answers under 90 words unless the user asked for detail.
- Never expose internal secrets, tokens, or database IDs.`;

async function getDeepgramKey(sb: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await sb
    .from("user_api_keys")
    .select("ciphertext, iv")
    .eq("service", "deepgram")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data?.ciphertext && data?.iv) {
    try { return await decrypt(data.ciphertext, data.iv); } catch (_) { /* fall through */ }
  }
  if (FALLBACK_DEEPGRAM) return FALLBACK_DEEPGRAM;
  throw new Error("No Deepgram key configured. Add one in the API Manager.");
}

async function transcribe(audio: Uint8Array, mime: string, dgKey: string): Promise<string> {
  const url = "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Token ${dgKey}`,
      "Content-Type": mime || "audio/webm",
    },
    body: audio,
  });
  if (!res.ok) throw new Error(`Deepgram STT ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const t = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  return String(t).trim();
}

async function answer(question: string): Promise<string> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: KNOWLEDGE },
        { role: "user", content: question },
      ],
    }),
  });
  if (res.status === 429) throw new Error("Rate limited by AI provider. Try again shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings.");
  if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return String(data?.choices?.[0]?.message?.content ?? "").trim();
}

async function synthesize(text: string, dgKey: string): Promise<{ b64: string; mime: string }> {
  // Cap TTS input to avoid runaway audio.
  const clipped = text.slice(0, 1800);
  const res = await fetch("https://api.deepgram.com/v1/speak?model=aura-asteria-en", {
    method: "POST",
    headers: {
      "Authorization": `Token ${dgKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: clipped }),
  });
  if (!res.ok) throw new Error(`Deepgram TTS ${res.status}: ${await res.text()}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const mime = res.headers.get("content-type") ?? "audio/mpeg";
  return { b64: b64encode(buf), mime };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json(401, { error: "Not authenticated" });

    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user }, error: userErr } = await sb.auth.getUser();
    if (userErr || !user) return json(401, { error: "Not authenticated" });

    // Rate limit
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await sb
      .from("support_conversations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    if ((count ?? 0) >= RATE_LIMIT_PER_MIN) {
      return json(429, { error: "Too many requests. Try again in a minute." });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const mode = String(body?.mode ?? "voice"); // "voice" | "text" | "tts"
    const mime = String(body?.mime ?? "audio/webm");
    const audioB64 = typeof body?.audio_b64 === "string" ? body.audio_b64 : "";
    const textQuery = typeof body?.text === "string" ? body.text : "";

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // TTS-only path (used by voice onboarding tour). Skips STT + LLM + history.
    if (mode === "tts") {
      const t = textQuery.trim().slice(0, 1800);
      if (!t) return json(400, { error: "Missing text" });
      const dgKey = await getDeepgramKey(admin);
      const out = await synthesize(t, dgKey);
      return json(200, { audio_b64: out.b64, audio_mime: out.mime });
    }


    let question = "";
    let audioMs: number | null = null;

    if (mode === "voice") {
      if (!audioB64) return json(400, { error: "Missing audio" });
      const audio = b64decode(audioB64);
      if (audio.byteLength === 0) return json(400, { error: "Empty recording" });
      if (audio.byteLength > MAX_AUDIO_BYTES) return json(413, { error: "Audio too large" });
      audioMs = typeof body?.duration_ms === "number" ? Math.round(body.duration_ms) : null;
      const dgKey = await getDeepgramKey(admin);
      question = await transcribe(audio, mime, dgKey);
      if (!question) return json(400, { error: "Could not understand audio. Please try again." });
    } else {
      question = textQuery.trim().slice(0, 2000);
      if (!question) return json(400, { error: "Missing text" });
    }

    const reply = await answer(question);

    // Best-effort TTS (only if a Deepgram key is available).
    let audioOut: { b64: string; mime: string } | null = null;
    try {
      const dgKey = await getDeepgramKey(admin);
      audioOut = await synthesize(reply, dgKey);
    } catch (e) {
      console.warn("TTS skipped:", (e as Error).message);
    }

    await sb.from("support_conversations").insert({
      user_id: user.id,
      question,
      answer: reply,
      audio_ms: audioMs,
      model: "google/gemini-2.5-flash",
    });

    return json(200, {
      transcript: question,
      answer: reply,
      audio_b64: audioOut?.b64 ?? null,
      audio_mime: audioOut?.mime ?? null,
    });
  } catch (err) {
    console.error("voice-support error", err);
    return json(500, { error: (err as Error).message });
  }
});
