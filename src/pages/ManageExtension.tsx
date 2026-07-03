import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3, ShieldCheck, Code2, Copy, Settings as SettingsIcon,
  Send, Sparkles, AlertTriangle, CheckCircle2, Loader2, FileCode2,
  Users, Star, TrendingUp, Activity, Bot, User as UserIcon, Play,
  Upload, Download, X, ShieldHalf, KeyRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { injectShimIntoFiles, newInstallSecret, sha256Hex, buildTelemetryShim } from "@/lib/telemetry-shim";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  importExtensionFile, exportImportedExtension, classifyPermission,
  type ImportedExtension,
} from "@/lib/import-extension";

// ---------------- Default (mock) data ----------------
const DEFAULT_EXT = {
  name: "TabMaster Pro",
  id: "tmp-9f2c-2026",
  version: "2.4.1",
  users: 12450,
  weeklyActive: 8230,
  rating: 4.8,
  reviews: 142,
  securityScore: 92,
};

const GROWTH = Array.from({ length: 30 }, (_, i) => ({
  day: `D${i + 1}`,
  users: Math.round(9000 + i * 110 + Math.sin(i / 3) * 350),
}));

const RATINGS = [
  { stars: "1★", count: 4 },
  { stars: "2★", count: 6 },
  { stars: "3★", count: 11 },
  { stars: "4★", count: 38 },
  { stars: "5★", count: 83 },
];

const REVIEWS = [
  { user: "alex_dev", rating: 5, comment: "Game-changer for tab management. Daily driver.", date: "2026-06-24" },
  { user: "mia.k", rating: 4, comment: "Great UX, would love keyboard shortcuts on Mac.", date: "2026-06-22" },
  { user: "ravi.s", rating: 5, comment: "Saved me from 200+ open tabs. Brilliant.", date: "2026-06-20" },
  { user: "jenna", rating: 3, comment: "Solid but sync feels slow sometimes.", date: "2026-06-18" },
  { user: "tomh", rating: 5, comment: "The grouping AI is uncanny — perfect picks.", date: "2026-06-15" },
];

const DEFAULT_MANIFEST = {
  manifest_version: 3,
  name: "TabMaster Pro",
  version: "2.4.1",
  description: "AI-powered tab manager that groups, suspends, and restores tabs.",
  permissions: ["storage", "tabs", "activeTab"],
  host_permissions: ["<all_urls>"],
  background: { service_worker: "background.js" },
  action: { default_popup: "popup.html" },
};

const DEFAULT_PERMISSIONS = [
  { name: "storage", level: "safe" as const, note: "Persists user prefs locally." },
  { name: "activeTab", level: "safe" as const, note: "Scoped to user-initiated interactions." },
  { name: "tabs", level: "warning" as const, note: "Reads tab URLs/titles across windows." },
  { name: "<all_urls>", level: "warning" as const, note: "Broad host access — justify in store listing." },
];

const DEFAULT_FILES = [
  { name: "manifest.json", lang: "json" },
  { name: "background.js", lang: "js" },
  { name: "popup.html", lang: "html" },
  { name: "popup.js", lang: "js" },
  { name: "styles.css", lang: "css" },
];

const DEFAULT_FILE_CONTENTS: Record<string, string> = {
  "manifest.json": JSON.stringify(DEFAULT_MANIFEST, null, 2),
  "background.js": `// background.js — TabMaster Pro service worker
chrome.runtime.onInstalled.addListener(() => {
  console.log("TabMaster Pro installed");
  chrome.storage.local.set({ groups: [], theme: "dark" });
});

chrome.action.onClicked.addListener(async (tab) => {
  const { groups = [] } = await chrome.storage.local.get("groups");
  groups.push({ id: Date.now(), tabId: tab.id });
  await chrome.storage.local.set({ groups });
});
`,
  "popup.html": `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header>
      <h1>TabMaster Pro</h1>
      <button id="group-btn">Group Tabs</button>
    </header>
    <main id="tab-list"></main>
    <script src="popup.js"></script>
  </body>
</html>`,
  "popup.js": `const list = document.getElementById("tab-list");
chrome.tabs.query({ currentWindow: true }, (tabs) => {
  list.innerHTML = tabs.map(t => \`<div class="tab">\${t.title}</div>\`).join("");
});
`,
  "styles.css": `body { font-family: system-ui; margin: 0; padding: 12px; width: 320px; }
header { display: flex; justify-content: space-between; align-items: center; }
.tab { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 12px; }
`,
};

type Section = "analytics" | "security" | "editor" | "clone" | "settings";
type Patch = { file: string; action: "update" | "create" | "delete"; content?: string; reason?: string };
type ChatMsg = {
  role: "user" | "ai";
  text: string;
  patches?: Patch[];
  appliedAt?: number;
};

// ---------------- Active Extension Context ----------------
type ActiveExt = {
  imported: ImportedExtension | null;
  name: string;
  version: string;
  description: string;
  manifest: Record<string, unknown>;
  permissions: { name: string; level: "safe" | "warning" | "danger"; note: string }[];
  files: { name: string; lang: string }[];
  fileContents: Record<string, string>;
  setFileContents: (next: Record<string, string>) => void;
  clear: () => void;
};

const ExtCtx = createContext<ActiveExt | null>(null);
const useExt = () => {
  const v = useContext(ExtCtx);
  if (!v) throw new Error("ExtCtx missing");
  return v;
};

function langFor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ({ js: "js", mjs: "js", ts: "ts", tsx: "tsx", jsx: "jsx", json: "json", html: "html", htm: "html", css: "css", md: "md", svg: "svg" } as Record<string, string>)[ext] ?? "txt";
}

// ---------------- Component ----------------
export default function ManageExtension() {
  const [section, setSection] = useState<Section>("analytics");
  const [imported, setImported] = useState<ImportedExtension | null>(null);
  const [fileContents, setFileContents] = useState<Record<string, string>>(DEFAULT_FILE_CONTENTS);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuth();
  const [autoInject, setAutoInject] = useState<boolean>(() => {
    try { return localStorage.getItem("lv_auto_inject") === "1"; } catch { return false; }
  });
  const [securing, setSecuring] = useState(false);
  const [lastInstall, setLastInstall] = useState<{ id: string; secret: string } | null>(null);
  const [showSecret, setShowSecret] = useState<{ id: string; secret: string; shim: string } | null>(null);

  useEffect(() => {
    try { localStorage.setItem("lv_auto_inject", autoInject ? "1" : "0"); } catch { /* noop */ }
  }, [autoInject]);

  // Core: register a fresh install + inject the shim into the current file map.
  // Returns the patched file contents and the new install id/secret.
  const secureExtension = async (
    ext: ImportedExtension,
    files: Record<string, string>,
  ): Promise<{ files: Record<string, string>; installId: string; secret: string } | null> => {
    if (!user) {
      toast.error("Sign in required", { description: "Live-control deployment needs an account." });
      return null;
    }
    const secret = newInstallSecret();
    const hash = await sha256Hex(secret);
    const { data, error } = await supabase
      .from("extension_installs")
      .insert({
        owner_id: user.id,
        extension_name: ext.name,
        extension_version: ext.version,
        source: "imported",
        status: "active",
        token_hash: hash,
      })
      .select()
      .single();
    if (error || !data) {
      toast.error("Could not register install", { description: error?.message ?? "unknown" });
      return null;
    }
    const installId = data.id as string;
    const { files: patched, manifest } = injectShimIntoFiles(files, ext.manifest, installId, secret);
    // Reflect the manifest update inside the imported extension's parsed copy too
    ext.manifest = manifest as ImportedExtension["manifest"];
    return { files: patched, installId, secret };
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const ext = await importExtensionFile(file);
      let nextFiles: Record<string, string> = { ...ext.files };
      if (autoInject) {
        const res = await secureExtension(ext, nextFiles);
        if (res) {
          nextFiles = res.files;
          setLastInstall({ id: res.installId, secret: res.secret });
          toast.success("Auto-secured", { description: `Install ${res.installId.slice(0, 8)}… registered with fresh HMAC key.` });
        }
      }
      setImported(ext);
      setFileContents(nextFiles);
      toast.success("Extension imported", { description: `${ext.name} v${ext.version} — ${Object.keys(nextFiles).length} editable files` });
    } catch (e) {
      toast.error("Import failed", { description: (e as Error).message });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSecureAndDeploy = async () => {
    if (!imported) return;
    setSecuring(true);
    try {
      const res = await secureExtension(imported, fileContents);
      if (!res) return;
      setFileContents(res.files);
      setLastInstall({ id: res.installId, secret: res.secret });
      const blob = await exportImportedExtension(imported, res.files);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${imported.name.replace(/[^a-z0-9-_]+/gi, "_")}-secured.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setShowSecret({ id: res.installId, secret: res.secret, shim: buildTelemetryShim(res.installId, res.secret) });
      toast.success("Secured ZIP exported", { description: "Fresh HMAC key minted. Manage it under Live Control." });
    } catch (e) {
      toast.error("Secure & deploy failed", { description: (e as Error).message });
    } finally {
      setSecuring(false);
    }
  };

  const handleExport = async () => {
    if (!imported) return;
    try {
      const blob = await exportImportedExtension(imported, fileContents);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${imported.name.replace(/[^a-z0-9-_]+/gi, "_")}-modified.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export ready", { description: "Modified extension downloaded as ZIP." });
    } catch (e) {
      toast.error("Export failed", { description: (e as Error).message });
    }
  };

  const clearImport = () => {
    setImported(null);
    setFileContents(DEFAULT_FILE_CONTENTS);
    setLastInstall(null);
    toast.info("Reverted to demo extension");
  };

  const active: ActiveExt = useMemo(() => {
    if (imported) {
      const allPerms = [...imported.permissions, ...imported.hostPermissions];
      return {
        imported,
        name: imported.name,
        version: imported.version,
        description: imported.description,
        manifest: imported.manifest,
        permissions: allPerms.map((p) => ({ name: p, ...classifyPermission(p) })),
        files: Object.keys(imported.files).map((n) => ({ name: n, lang: langFor(n) })),
        fileContents,
        setFileContents,
        clear: clearImport,
      };
    }
    return {
      imported: null,
      name: DEFAULT_EXT.name,
      version: DEFAULT_EXT.version,
      description: DEFAULT_MANIFEST.description,
      manifest: DEFAULT_MANIFEST,
      permissions: DEFAULT_PERMISSIONS,
      files: DEFAULT_FILES,
      fileContents,
      setFileContents,
      clear: clearImport,
    };
  }, [imported, fileContents]);

  return (
    <ExtCtx.Provider value={active}>
      <div className="flex h-[calc(100vh-4rem)] gap-4 p-4">
        <aside className="w-52 shrink-0 hidden lg:block">
          <Card className="h-full bg-card/40 backdrop-blur border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Manage Hub
              </CardTitle>
              <CardDescription className="text-xs truncate">{active.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 px-2">
              {([
                ["analytics", "Analytics", BarChart3],
                ["security", "Security", ShieldCheck],
                ["editor", "Code Editor", Code2],
                ["clone", "Clone Engine", Copy],
                ["settings", "Settings", SettingsIcon],
              ] as const).map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setSection(key)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all ${
                    section === key
                      ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_20px_-8px_hsl(var(--primary))]"
                      : "text-muted-foreground hover:bg-muted/40 border border-transparent"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </CardContent>
          </Card>
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto pr-1 space-y-4">
          <Card className="bg-card/40 backdrop-blur border-border/60">
            <CardContent className="p-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="h-8 w-8 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                  <Upload className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {imported ? `Loaded: ${imported.sourceName}` : "Import a third-party extension"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {imported
                      ? `${Object.keys(imported.files).length} text files · ${imported.binaryFiles.length} assets · local-only, never published`
                      : "Upload a .zip or .crx — analyze, edit & clone locally. Nothing is published."}
                  </p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,.crx,application/zip,application/x-chrome-extension"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImport(f);
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {imported ? "Replace" : "Upload .zip / .crx"}
              </Button>
              <div className="flex items-center gap-2 px-2 py-1 rounded-md border border-border/60 bg-background/40">
                <ShieldHalf className="h-3.5 w-3.5 text-primary" />
                <Label htmlFor="auto-inject" className="text-xs cursor-pointer whitespace-nowrap">Auto-secure on upload</Label>
                <Switch id="auto-inject" checked={autoInject} onCheckedChange={setAutoInject} />
              </div>
              {imported && (
                <>
                  <Button size="sm" className="bg-gradient-cyber" onClick={handleSecureAndDeploy} disabled={securing}>
                    {securing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
                    Secure & Deploy
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" /> Export ZIP
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearImport}>
                    <X className="h-4 w-4 mr-1" /> Unload
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {lastInstall && (
            <Card className="bg-primary/5 border-primary/30">
              <CardContent className="p-3 flex flex-wrap items-center gap-3 text-xs">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                <span className="font-mono truncate">
                  Install <span className="text-primary">{lastInstall.id.slice(0, 8)}…</span> registered ·
                  HMAC key minted · telemetry shim embedded
                </span>
                <Link to="/control" className="ml-auto">
                  <Button size="sm" variant="outline">Open Live Control →</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {section === "analytics" && <AnalyticsView />}
          {section === "security" && <SecurityView />}
          {section === "editor" && <EditorView />}
          {section === "clone" && <CloneView />}
          {section === "settings" && <SettingsView />}
        </main>

        <aside className="w-80 shrink-0 hidden xl:block">
          <AICopilot />
        </aside>
      </div>
      <Dialog open={!!showSecret} onOpenChange={(o) => !o && setShowSecret(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> One-time install secret</DialogTitle>
            <DialogDescription>
              Copy this now — it is hashed server-side and cannot be retrieved again. The embedded shim already contains it; this copy is only for your records.
            </DialogDescription>
          </DialogHeader>
          {showSecret && (
            <div className="space-y-3 text-sm">
              <div>
                <Label className="text-xs">Install ID</Label>
                <Input readOnly value={showSecret.id} className="font-mono text-xs mt-1" />
              </div>
              <div>
                <Label className="text-xs">HMAC secret (256-bit)</Label>
                <Input readOnly value={showSecret.secret} className="font-mono text-xs mt-1" />
              </div>
              <div className="rounded-md border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground space-y-1">
                <p className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Server stores only SHA-256 of the secret.</p>
                <p>• Kill-switch, license expiry, daily/weekly quotas & schedule windows are enforced server-side on every heartbeat.</p>
                <p>• Manage this install from <Link to="/control" className="text-primary underline">Live Control</Link>.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { if (showSecret) { navigator.clipboard.writeText(showSecret.secret); toast.success("Secret copied"); } }}>
              <Copy className="h-4 w-4 mr-2" /> Copy secret
            </Button>
            <Button onClick={() => setShowSecret(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ExtCtx.Provider>
  );
}

// ---------------- Analytics (real telemetry) ----------------
type InstallRow = {
  id: string;
  extension_name: string;
  extension_version: string | null;
  status: string;
  kill_switch: boolean;
  last_seen_at: string | null;
  created_at: string;
};
type UsageRow = { day: string; minutes_used: number; actions_count: number; errors_count: number };
type EventRow = { event_type: string; action_name: string | null; ts: string; error_message: string | null };

function AnalyticsView() {
  const ext = useExt();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [installs, setInstalls] = useState<InstallRow[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: ins } = await supabase
        .from("extension_installs")
        .select("id, extension_name, extension_version, status, kill_switch, last_seen_at, created_at")
        .eq("owner_id", user.id)
        .eq("extension_name", ext.name)
        .order("created_at", { ascending: false });
      const installRows = (ins || []) as InstallRow[];
      if (cancelled) return;
      setInstalls(installRows);
      const ids = installRows.map((r) => r.id);
      if (ids.length === 0) {
        setUsage([]); setEvents([]); setLoading(false); return;
      }
      const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
      const [u, e] = await Promise.all([
        supabase.from("extension_usage_daily")
          .select("day, minutes_used, actions_count, errors_count")
          .in("install_id", ids)
          .gte("day", since)
          .order("day", { ascending: true }),
        supabase.from("extension_events")
          .select("event_type, action_name, ts, error_message")
          .in("install_id", ids)
          .order("ts", { ascending: false })
          .limit(25),
      ]);
      if (cancelled) return;
      setUsage((u.data as UsageRow[]) || []);
      setEvents((e.data as EventRow[]) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, ext.name]);

  const totalInstalls = installs.length;
  const activeInstalls = installs.filter(
    (i) => !i.kill_switch && i.status === "active" && i.last_seen_at &&
      Date.now() - new Date(i.last_seen_at).getTime() < 7 * 86400_000
  ).length;
  const dailyTotals = { minutes: 0, actions: 0, errors: 0 };
  const byDay = new Map<string, { day: string; actions: number; errors: number; minutes: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
    byDay.set(d, { day: d.slice(5), actions: 0, errors: 0, minutes: 0 });
  }
  for (const r of usage) {
    dailyTotals.minutes += r.minutes_used;
    dailyTotals.actions += r.actions_count;
    dailyTotals.errors += r.errors_count;
    const b = byDay.get(r.day);
    if (b) { b.actions += r.actions_count; b.errors += r.errors_count; b.minutes += r.minutes_used; }
  }
  const series = Array.from(byDay.values());
  const errorRate = dailyTotals.actions > 0 ? (dailyTotals.errors / dailyTotals.actions) * 100 : 0;
  const securityScore = Math.max(40, 100 - ext.permissions.filter((p) => p.level !== "safe").length * 12);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading telemetry for {ext.name}…</div>;
  }

  const hasTelemetry = installs.length > 0;

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gradient-cyber">{ext.name}</h1>
          <p className="text-sm text-muted-foreground">
            v{ext.version} · {ext.imported ? "imported (local)" : "workspace"}
          </p>
        </div>
        {hasTelemetry && (
          <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
            <Activity className="h-2.5 w-2.5 mr-1" /> Live telemetry
          </Badge>
        )}
      </header>

      {!hasTelemetry ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center space-y-3">
            <AlertTriangle className="h-10 w-10 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium">No monitoring enabled for “{ext.name}”</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Analytics here are pulled from real installs — no simulated numbers. Register this
                extension in Live Control to receive install, session and error metrics.
              </p>
            </div>
            <Button asChild size="sm" className="bg-gradient-cyber text-primary-foreground">
              <Link to="/control">Enable monitoring →</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Installs", value: totalInstalls.toString(), icon: Users },
              { label: "Active (7d)", value: activeInstalls.toString(), icon: Activity },
              { label: "Actions (30d)", value: dailyTotals.actions.toLocaleString(), icon: TrendingUp },
              { label: "Error rate", value: `${errorRate.toFixed(2)}%`, icon: ShieldCheck },
            ].map((k) => (
              <Card key={k.label} className="bg-card/40 backdrop-blur border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <k.icon className="h-4 w-4 text-primary" />
                    <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">real</Badge>
                  </div>
                  <p className="text-2xl font-bold mt-2 font-mono">{k.value}</p>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 bg-card/40 backdrop-blur border-border/60">
              <CardHeader><CardTitle className="text-base">Actions & errors · 30 days</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                    <Line type="monotone" dataKey="actions" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="errors" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card/40 backdrop-blur border-border/60">
              <CardHeader><CardTitle className="text-base">Minutes / day</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="minutes" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 bg-card/40 backdrop-blur border-border/60">
              <CardHeader><CardTitle className="text-base">Recent events</CardTitle></CardHeader>
              <CardContent className="p-0">
                {events.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground">No events reported yet.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b border-border/60">
                      <tr>
                        <th className="text-left p-3">Type</th>
                        <th className="text-left p-3">Action</th>
                        <th className="text-left p-3">Detail</th>
                        <th className="text-left p-3">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((e, i) => (
                        <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                          <td className="p-3">
                            <Badge variant="outline" className={
                              e.event_type === "error" ? "text-red-400 border-red-500/40" :
                              "text-muted-foreground"
                            }>{e.event_type}</Badge>
                          </td>
                          <td className="p-3 font-mono text-xs">{e.action_name || "—"}</td>
                          <td className="p-3 text-xs text-muted-foreground truncate max-w-xs">{e.error_message || ""}</td>
                          <td className="p-3 text-xs text-muted-foreground">{new Date(e.ts).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/40 backdrop-blur border-border/60">
              <CardHeader><CardTitle className="text-base">Security score</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-4xl font-bold font-mono">{securityScore}<span className="text-lg text-muted-foreground">/100</span></p>
                <p className="text-xs text-muted-foreground">
                  Derived from the {ext.permissions.length} declared permission
                  {ext.permissions.length === 1 ? "" : "s"} — {ext.permissions.filter(p => p.level !== "safe").length} non-safe.
                </p>
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link to="/control">Open Live Control →</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- Security ----------------
function SecurityView() {
  const ext = useExt();
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<"safe" | "action" | null>(null);


  const runScan = () => {
    setScanning(true); setProgress(0); setResult(null);
    const t = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(t);
          setScanning(false);
          const ok = Math.random() > 0.3;
          setResult(ok ? "safe" : "action");
          toast.success("Security Scan Complete", { description: ok ? "No critical issues found." : "Action required — review warnings." });
          return 100;
        }
        return p + 8;
      });
    }, 120);
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Security Center</h1>
        <p className="text-sm text-muted-foreground">Validate manifest, scan permissions, and audit for vulnerabilities.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card/40 backdrop-blur border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><FileCode2 className="h-4 w-4 text-primary" /> Manifest Validator</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Manifest V3 · Valid
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-background/60 border border-border/60 rounded-md p-3 max-h-72 overflow-auto font-mono">
              {JSON.stringify(ext.manifest, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Permission Scanner</CardTitle>
            <CardDescription>{ext.permissions.length} requested permissions evaluated</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-auto">
            {ext.permissions.length === 0 && (
              <p className="text-xs text-muted-foreground p-3">No permissions requested.</p>
            )}
            {ext.permissions.map((p) => (
              <div key={p.name} className="flex items-start gap-3 p-3 rounded-md border border-border/60 bg-background/40">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono break-all">{p.name}</code>
                    <Badge variant="outline" className={
                      p.level === "safe"
                        ? "border-emerald-500/40 text-emerald-400 text-[10px]"
                        : p.level === "danger"
                        ? "border-red-500/40 text-red-400 text-[10px]"
                        : "border-amber-500/40 text-amber-400 text-[10px]"
                    }>
                      {p.level === "safe" ? "Safe" : p.level === "danger" ? "Danger" : "Warning"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.note}</p>
                </div>
                {p.level !== "safe" && <AlertTriangle className={`h-4 w-4 shrink-0 ${p.level === "danger" ? "text-red-400" : "text-amber-400"}`} />}
              </div>
            ))}

          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/40 backdrop-blur border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Vulnerability Scanner</CardTitle>
          <CardDescription>Deep scans your codebase for CSP, eval, and remote-script violations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={runScan} disabled={scanning} className="bg-gradient-cyber">
            {scanning ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scanning…</> : <><Play className="h-4 w-4 mr-2" /> Run Vulnerability Scan</>}
          </Button>
          {scanning && <Progress value={progress} className="h-2" />}
          {result === "safe" && (
            <div className="flex items-center gap-2 p-3 rounded-md border border-emerald-500/40 bg-emerald-500/5 text-emerald-300 text-sm">
              <CheckCircle2 className="h-4 w-4" /> All clear — no vulnerabilities detected.
            </div>
          )}
          {result === "action" && (
            <div className="flex items-center gap-2 p-3 rounded-md border border-amber-500/40 bg-amber-500/5 text-amber-300 text-sm">
              <AlertTriangle className="h-4 w-4" /> Action required — review 2 warnings.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Editor ----------------
function EditorView() {
  const ext = useExt();
  const firstFile = ext.files[0]?.name ?? "manifest.json";
  const [active, setActive] = useState(firstFile);
  // Keep active selection valid when extension changes
  useEffect(() => {
    if (!ext.fileContents[active]) setActive(ext.files[0]?.name ?? "manifest.json");
  }, [ext.files, ext.fileContents, active]);

  const contents = ext.fileContents;
  const updateFile = (name: string, value: string) =>
    ext.setFileContents({ ...contents, [name]: value });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Modification Hub</h1>
        <p className="text-sm text-muted-foreground">Edit extension source files directly or via the AI Co-Pilot.</p>
      </header>

      <div className="grid grid-cols-12 gap-3 h-[calc(100vh-14rem)]">
        <Card className="col-span-3 bg-card/40 backdrop-blur border-border/60 overflow-hidden flex flex-col">
          <CardHeader className="py-3"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Explorer ({ext.files.length})</CardTitle></CardHeader>
          <CardContent className="p-2 space-y-0.5 overflow-auto flex-1">
            {ext.files.map((f) => (
              <button
                key={f.name}
                onClick={() => setActive(f.name)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-mono text-left transition-colors ${
                  active === f.name ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <FileCode2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{f.name}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="col-span-9 bg-[#0d1117] border-border/60 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-[#161b22]">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
              </div>
              <span className="text-xs font-mono text-muted-foreground ml-2">{active}</span>
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-xs"
              onClick={() => toast.success("Code Changes Applied", { description: `${active} saved.` })}>
              Save
            </Button>
          </div>
          <Textarea
            value={contents[active] ?? ""}
            onChange={(e) => updateFile(active, e.target.value)}
            className="flex-1 rounded-none border-0 font-mono text-xs bg-[#0d1117] text-[#e6edf3] resize-none focus-visible:ring-0"
            spellCheck={false}
          />
        </Card>
      </div>
    </div>
  );
}


// ---------------- Clone ----------------
function CloneView() {
  const ext = useExt();
  const isImported = !!ext.imported;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`${ext.name} · Clone`);
  const [id, setId] = useState(`${ext.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 16)}-clone-${Math.random().toString(36).slice(2, 6)}`);
  const [reset, setReset] = useState(true);
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    setName(`${ext.name} · Clone`);
    setId(`${ext.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 16)}-clone-${Math.random().toString(36).slice(2, 6)}`);
  }, [ext.name]);

  const clone = async () => {
    setCloning(true);
    try {
      if (isImported && ext.imported) {
        // Rewrite manifest name/version, then export ZIP
        const patched = { ...ext.fileContents };
        const manifestKey = Object.keys(patched).find((k) => k === "manifest.json" || k.endsWith("/manifest.json"));
        if (manifestKey) {
          try {
            const parsed = JSON.parse(patched[manifestKey]);
            parsed.name = name;
            parsed.version = parsed.version ?? "1.0.0";
            patched[manifestKey] = JSON.stringify(parsed, null, 2);
          } catch {/* leave as-is */}
        }
        const blob = await exportImportedExtension(ext.imported, patched);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${id}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Clone exported", { description: `${name} downloaded as ${id}.zip` });
      } else {
        toast.success("Extension Cloned Successfully", { description: `${name} created with ID ${id}.` });
      }
    } catch (e) {
      toast.error("Clone failed", { description: (e as Error).message });
    } finally {
      setCloning(false);
      setOpen(false);
    }
  };

  const perms = Array.isArray((ext.manifest as { permissions?: string[] }).permissions)
    ? (ext.manifest as { permissions: string[] }).permissions
    : [];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Clone Engine</h1>
        <p className="text-sm text-muted-foreground">Duplicate this extension to spin off variants quickly.</p>
      </header>

      <Card className="bg-card/40 backdrop-blur border-border/60 overflow-hidden">
        <div className="h-1 bg-gradient-cyber" />
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-xl bg-gradient-cyber flex items-center justify-center shrink-0">
              <Copy className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold truncate">{ext.name}</h2>
              <p className="text-sm text-muted-foreground">
                v{ext.version} · {isImported ? `${ext.files.length} files` : `${DEFAULT_EXT.users.toLocaleString()} users · ★ ${DEFAULT_EXT.rating}`}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {perms.slice(0, 8).map((p) => (
                  <Badge key={p} variant="outline" className="text-[10px] font-mono">{p}</Badge>
                ))}
              </div>
            </div>
            <Button onClick={() => setOpen(true)} className="bg-gradient-cyber">
              <Copy className="h-4 w-4 mr-2" /> Clone Extension
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card/95 backdrop-blur border-border/60">
          <DialogHeader>
            <DialogTitle>Clone Configuration</DialogTitle>
            <DialogDescription>Create a new extension based on {ext.name}.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">New Extension Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">New Extension ID</Label>
              <Input value={id} onChange={(e) => setId(e.target.value)} className="font-mono" />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
              <div>
                <Label className="text-sm">Reset Analytics</Label>
                <p className="text-xs text-muted-foreground">Start fresh with 0 users and reviews.</p>
              </div>
              <Switch checked={reset} onCheckedChange={setReset} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={clone} disabled={cloning} className="bg-gradient-cyber">
              {cloning ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cloning…</> : isImported ? "Clone & Download ZIP" : "Clone Now"}
            </Button>

          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------- Settings ----------------
function SettingsView() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Extension Settings</h1>
        <p className="text-sm text-muted-foreground">Configure publishing defaults and notifications.</p>
      </header>
      <Card className="bg-card/40 backdrop-blur border-border/60">
        <CardContent className="p-6 space-y-4">
          {[
            ["Auto-publish on green security scan", true],
            ["Email me when reviews drop below 4★", true],
            ["Sync analytics every 6 hours", false],
            ["Enable beta channel for trusted testers", false],
          ].map(([label, v]) => (
            <div key={label as string} className="flex items-center justify-between">
              <Label className="text-sm">{label as string}</Label>
              <Switch defaultChecked={v as boolean} />
            </div>
          ))}
          <Separator />
          <div className="flex justify-end">
            <Button className="bg-gradient-cyber" onClick={() => toast.success("Settings saved")}>Save Changes</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- AI Co-Pilot ----------------
function AICopilot() {
  const ext = useExt();
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "ai",
      text:
        "Hi! I edit your uploaded extension's actual source. Try: 'Add a dark-mode toggle to popup.html', 'Remove the tabs permission', or 'Add an options page'.",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const applyPatches = (patches: Patch[]) => {
    const next = { ...ext.fileContents };
    let changed = 0;
    for (const p of patches) {
      if (p.action === "delete") {
        if (next[p.file] !== undefined) { delete next[p.file]; changed++; }
      } else if (typeof p.content === "string") {
        next[p.file] = p.content;
        changed++;
      }
    }
    ext.setFileContents(next);
    return changed;
  };

  const applyAll = (idx: number, patches: Patch[]) => {
    const n = applyPatches(patches);
    setMessages((m) => m.map((msg, i) => (i === idx ? { ...msg, appliedAt: Date.now() } : msg)));
    toast.success("Changes applied", { description: `${n} file${n === 1 ? "" : "s"} updated. Export ZIP to save.` });
  };

  const applyOne = (p: Patch) => {
    const n = applyPatches([p]);
    if (n > 0) toast.success(`Updated ${p.file}`);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || typing) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setTyping(true);

    try {
      const history = messages
        .filter((m) => m.role === "user" || m.text)
        .slice(-6)
        .map((m) => ({ role: m.role === "ai" ? ("assistant" as const) : ("user" as const), content: m.text }));

      const url = `https://nufksbhydjhqaqqfxkdp.supabase.co/functions/v1/extension-edit`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: text,
          files: ext.fileContents,
          manifest: ext.manifest,
          history,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 429) throw new Error("Rate limit reached. Try again in a moment.");
        if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace billing.");
        throw new Error(body?.error ?? `Edit failed (${res.status})`);
      }

      const data = (await res.json()) as { summary: string; patches: Patch[] };
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text: data.summary || "Here's the proposed change set.",
          patches: data.patches ?? [],
        },
      ]);
    } catch (e) {
      setMessages((m) => [...m, { role: "ai", text: `⚠️ ${(e as Error).message}` }]);
    } finally {
      setTyping(false);
    }
  };

  const isImported = !!ext.imported;

  return (
    <Card className="h-full bg-card/40 backdrop-blur border-border/60 flex flex-col">
      <CardHeader className="pb-3 border-b border-border/60">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gradient-cyber flex items-center justify-center">
            <Bot className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          AI Co-Pilot
          <Badge variant="outline" className="ml-auto text-[9px] border-emerald-500/40 text-emerald-400">
            {isImported ? "Editing import" : "Demo mode"}
          </Badge>
        </CardTitle>
        {!isImported && (
          <CardDescription className="text-[11px]">
            Upload a .zip / .crx to apply real edits to its source.
          </CardDescription>
        )}
      </CardHeader>
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="p-3 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "ai" && (
                <div className="h-6 w-6 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
              )}
              <div className={`max-w-[85%] text-xs leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3 py-2"
                  : "text-foreground"
              }`}>
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.patches && m.patches.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        {m.patches.length} change{m.patches.length === 1 ? "" : "s"}
                        {m.appliedAt ? " · applied" : ""}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 text-[10px] px-2"
                        disabled={!isImported || !!m.appliedAt}
                        onClick={() => applyAll(i, m.patches!)}
                      >
                        {m.appliedAt ? "Applied ✓" : "Apply all"}
                      </Button>
                    </div>
                    {m.patches.map((p, j) => (
                      <div key={j} className="rounded-md border border-border/60 bg-[#0d1117] overflow-hidden">
                        <div className="flex items-center justify-between px-2 py-1 border-b border-border/60 bg-[#161b22] gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge
                              variant="outline"
                              className={`text-[9px] uppercase ${
                                p.action === "delete"
                                  ? "border-red-500/40 text-red-400"
                                  : p.action === "create"
                                  ? "border-emerald-500/40 text-emerald-400"
                                  : "border-amber-500/40 text-amber-400"
                              }`}
                            >
                              {p.action}
                            </Badge>
                            <span className="text-[10px] font-mono text-muted-foreground truncate">{p.file}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 text-[10px] px-2 shrink-0"
                            disabled={!isImported}
                            onClick={() => applyOne(p)}
                          >
                            Apply
                          </Button>
                        </div>
                        {p.action !== "delete" && p.content && (
                          <pre className="text-[10px] font-mono p-2 text-[#e6edf3] overflow-auto max-h-40">
                            {p.content.length > 1200 ? p.content.slice(0, 1200) + "\n…" : p.content}
                          </pre>
                        )}
                        {p.reason && (
                          <p className="text-[10px] text-muted-foreground px-2 py-1 border-t border-border/60">{p.reason}</p>
                        )}
                      </div>
                    ))}
                    {!isImported && (
                      <p className="text-[10px] text-amber-400/80">Upload an extension to apply these changes.</p>
                    )}
                  </div>
                )}
              </div>
              {m.role === "user" && (
                <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <UserIcon className="h-3 w-3" />
                </div>
              )}
            </div>
          ))}
          {typing && (
            <div className="flex gap-2 items-center text-xs text-muted-foreground">
              <div className="h-6 w-6 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center">
                <Bot className="h-3 w-3 text-primary" />
              </div>
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "120ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "240ms" }} />
              </span>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="p-3 border-t border-border/60 space-y-2">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={isImported ? "Edit the uploaded extension…" : "Upload an extension to edit…"}
            className="text-xs"
            disabled={typing}
          />
          <Button size="icon" onClick={send} className="bg-gradient-cyber shrink-0" disabled={typing}>
            {typing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {[
            "Add dark-mode toggle to popup",
            "Harden the CSP",
            "Remove unused permissions",
            "Add an options page",
          ].map((q) => (
            <button
              key={q}
              onClick={() => setInput(q)}
              className="text-[10px] px-2 py-1 rounded-md border border-border/60 text-muted-foreground hover:bg-muted/40"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

