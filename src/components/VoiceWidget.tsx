import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, X, Loader2, Volume2, MessageSquare, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Turn = { role: "user" | "assistant"; text: string; audio?: string | null; mime?: string | null };

// Encode captured PCM (Float32) to a mono 16-bit WAV Blob at 16 kHz.
function encodeWav(chunks: Float32Array[], srcRate: number): Blob {
  const flat = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let off = 0;
  for (const c of chunks) { flat.set(c, off); off += c.length; }
  const targetRate = 16000;
  const ratio = srcRate / targetRate;
  const outLen = Math.floor(flat.length / ratio);
  const pcm = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const s = flat[Math.floor(i * ratio)] ?? 0;
    const v = Math.max(-1, Math.min(1, s));
    pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  const buf = new ArrayBuffer(44 + pcm.byteLength);
  const view = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  w(8, "WAVE"); w(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  w(36, "data");
  view.setUint32(40, pcm.byteLength, true);
  new Int16Array(buf, 44).set(pcm);
  return new Blob([buf], { type: "audio/wav" });
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    s += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(s);
}

export function VoiceWidget() {
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const startedAtRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => cleanup(), []);

  function cleanup() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try { nodeRef.current?.disconnect(); } catch (_) { /* noop */ }
    try { srcRef.current?.disconnect(); } catch (_) { /* noop */ }
    try { ctxRef.current?.close(); } catch (_) { /* noop */ }
    streamRef.current = null;
    nodeRef.current = null;
    srcRef.current = null;
    ctxRef.current = null;
    chunksRef.current = [];
  }

  async function startRecording() {
    if (recording || busy) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      srcRef.current = src;
      const node = ctx.createScriptProcessor(4096, 1, 1);
      nodeRef.current = node;
      chunksRef.current = [];
      node.onaudioprocess = (e) => {
        chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      src.connect(node);
      node.connect(ctx.destination);
      startedAtRef.current = Date.now();
      setRecording(true);
    } catch (e) {
      console.error(e);
      toast.error("Microphone access denied");
    }
  }

  async function stopAndSend() {
    if (!recording) return;
    setRecording(false);
    const rate = ctxRef.current?.sampleRate ?? 48000;
    const chunks = chunksRef.current;
    const duration = Date.now() - startedAtRef.current;
    cleanup();
    if (chunks.length === 0) {
      toast.error("No audio captured");
      return;
    }
    const blob = encodeWav(chunks, rate);
    if (blob.size < 2048) {
      toast.error("Recording was empty — please try again");
      return;
    }
    await send({ audio: blob, duration_ms: duration });
  }

  async function send(payload: { audio?: Blob; duration_ms?: number; text?: string }) {
    setBusy(true);
    try {
      const body: Record<string, unknown> = payload.audio
        ? {
            mode: "voice",
            mime: "audio/wav",
            audio_b64: await blobToBase64(payload.audio),
            duration_ms: payload.duration_ms ?? null,
          }
        : { mode: "text", text: payload.text ?? "" };

      const { data, error } = await supabase.functions.invoke("voice-support", { body });
      if (error) throw error;
      const d = data as { transcript?: string; answer?: string; audio_b64?: string | null; audio_mime?: string | null; error?: string };
      if (d.error) throw new Error(d.error);
      setTurns((t) => [
        ...t,
        { role: "user", text: d.transcript ?? (payload.text ?? "") },
        { role: "assistant", text: d.answer ?? "", audio: d.audio_b64 ?? null, mime: d.audio_mime ?? null },
      ]);
      if (d.audio_b64) playAudio(d.audio_b64, d.audio_mime ?? "audio/mpeg");
    } catch (e) {
      const msg = (e as Error).message || "Voice support failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  function playAudio(b64: string, mime: string) {
    try {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: mime }));
      if (audioRef.current) {
        audioRef.current.src = url;
        void audioRef.current.play().catch(() => { /* autoplay blocked */ });
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function submitText(e: React.FormEvent) {
    e.preventDefault();
    const q = text.trim();
    if (!q || busy) return;
    setText("");
    await send({ text: q });
  }

  return (
    <>
      <audio ref={audioRef} className="hidden" />

      {!open && (
        <Button
          onClick={() => setOpen(true)}
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-primary hover:bg-primary/90"
          aria-label="Open voice support"
        >
          <Mic className="h-6 w-6" />
        </Button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-border bg-gradient-to-r from-primary/10 to-accent/10">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Volume2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold">Voice Support</div>
                <div className="text-[10px] text-muted-foreground font-mono">Deepgram · Gemini</div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 max-h-[360px] min-h-[160px] overflow-y-auto p-3 space-y-2 text-sm">
            {turns.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-6">
                <MessageSquare className="h-5 w-5 mx-auto mb-2 opacity-50" />
                Ask anything about Extension Forge — tap the mic or type a question.
              </div>
            )}
            {turns.map((t, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg px-3 py-2 max-w-[85%]",
                  t.role === "user"
                    ? "bg-primary/10 ml-auto text-right"
                    : "bg-muted",
                )}
              >
                {t.text}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
              </div>
            )}
          </div>

          <form onSubmit={submitText} className="p-2 border-t border-border flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant={recording ? "destructive" : "secondary"}
              disabled={busy}
              onClick={recording ? stopAndSend : startRecording}
              aria-label={recording ? "Stop recording" : "Start recording"}
            >
              {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={recording ? "Recording… tap mic to send" : "Type a question…"}
              disabled={recording || busy}
              className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <Button type="submit" size="icon" disabled={busy || recording || !text.trim()} aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
