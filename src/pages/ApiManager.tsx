import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plug, Plus, Trash2, Eye, EyeOff, ExternalLink, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";

interface StoredKey {
  id: string;
  service: string;
  label: string;
  hint: string | null;
  created_at: string;
}

const apiServices = [
  { name: "OpenAI", description: "GPT models for AI features", docsUrl: "https://platform.openai.com/api-keys" },
  { name: "Google", description: "YouTube, Maps, and other Google APIs", docsUrl: "https://console.cloud.google.com/" },
  { name: "NVIDIA NIM", description: "NVIDIA inference microservices", docsUrl: "https://build.nvidia.com/" },
  { name: "Deepgram", description: "Voice STT + TTS for the support agent", docsUrl: "https://console.deepgram.com/" },
  { name: "Twitter/X", description: "Twitter API for social features", docsUrl: "https://developer.twitter.com/" },
  { name: "Custom REST API", description: "Any REST API endpoint", docsUrl: "" },
];

export default function ApiManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [keys, setKeys] = useState<StoredKey[]>([]);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newService, setNewService] = useState("OpenAI");

  const invoke = useCallback(async <T = unknown>(action: string, extra: Record<string, unknown> = {}): Promise<T> => {
    const { data, error } = await supabase.functions.invoke("user-api-keys", {
      body: { action, ...extra },
    });
    if (error) throw error;
    return data as T;
  }, []);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const { keys } = await invoke<{ keys: StoredKey[] }>("list");
      setKeys(keys ?? []);
    } catch (e) {
      toast.error("Failed to load keys", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [user, invoke]);

  useEffect(() => { void load(); }, [load]);

  const addKey = async () => {
    if (!newLabel.trim() || !newValue.trim()) {
      toast.error("Please fill in label and key");
      return;
    }
    if (newValue.length > 4096) {
      toast.error("Key too long (max 4096 chars)");
      return;
    }
    setBusy("create");
    try {
      const { key } = await invoke<{ key: StoredKey }>("create", {
        service: newService, label: newLabel.trim(), value: newValue.trim(),
      });
      setKeys((prev) => [key, ...prev]);
      setNewLabel(""); setNewValue("");
      toast.success("API key encrypted & saved");
    } catch (e) {
      toast.error("Save failed", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const removeKey = async (id: string) => {
    setBusy(id);
    try {
      await invoke("delete", { id });
      setKeys((prev) => prev.filter((k) => k.id !== id));
      setRevealed((prev) => { const n = { ...prev }; delete n[id]; return n; });
      toast.success("Key removed");
    } catch (e) {
      toast.error("Delete failed", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const toggleReveal = async (id: string) => {
    if (revealed[id]) {
      setRevealed((prev) => { const n = { ...prev }; delete n[id]; return n; });
      return;
    }
    setBusy(id);
    try {
      const { value } = await invoke<{ value: string }>("reveal", { id });
      setRevealed((prev) => ({ ...prev, [id]: value }));
    } catch (e) {
      toast.error("Reveal failed", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  if (!user) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Plug className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-semibold mb-1">Sign in to manage API keys</h2>
          <p className="text-sm text-muted-foreground mb-3">Keys are encrypted at rest and tied to your account.</p>
          <Button onClick={() => navigate("/auth")} className="bg-gradient-cyber text-primary-foreground">Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Plug className="h-6 w-6 text-accent" />
          API Manager
        </h1>
        <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Keys are encrypted with AES-GCM server-side and only decrypted on your request.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {apiServices.map((svc) => (
          <div key={svc.name} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold">{svc.name}</h3>
              {svc.docsUrl && (
                <a href={svc.docsUrl} target="_blank" rel="noopener" className="text-muted-foreground hover:text-primary">
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{svc.description}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-semibold">Add API Key</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Service</Label>
            <select
              value={newService}
              onChange={(e) => setNewService(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-secondary px-3 text-sm"
            >
              {apiServices.map((s) => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Label</Label>
            <Input
              placeholder="e.g., My OpenAI Key"
              value={newLabel}
              maxLength={120}
              onChange={(e) => setNewLabel(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">API Key</Label>
            <Input
              placeholder="sk-..."
              type="password"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="bg-secondary border-border font-mono"
            />
          </div>
        </div>
        <Button onClick={addKey} variant="outline" size="sm" disabled={busy === "create"}>
          {busy === "create" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
          Encrypt & Save
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold">Stored Keys ({keys.length})</h3>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        {keys.length === 0 && !loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No keys yet — add one above.</div>
        ) : (
          <div className="divide-y divide-border">
            {keys.map((k) => (
              <div key={k.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{k.label}</span>
                    <Badge variant="secondary" className="text-[10px]">{k.service}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5 break-all">
                    {revealed[k.id] ?? (k.hint ? `${k.hint}` : "•".repeat(24))}
                  </p>
                </div>
                <Button
                  size="sm" variant="ghost"
                  disabled={busy === k.id}
                  onClick={() => toggleReveal(k.id)}
                >
                  {busy === k.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
                    revealed[k.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  size="sm" variant="ghost"
                  disabled={busy === k.id}
                  onClick={() => removeKey(k.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
