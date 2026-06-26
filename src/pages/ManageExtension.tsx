import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3, ShieldCheck, Code2, Copy, Settings as SettingsIcon,
  Send, Sparkles, AlertTriangle, CheckCircle2, Loader2, FileCode2,
  Users, Star, TrendingUp, Activity, Bot, User as UserIcon, Play,
  Upload, Download, X,
} from "lucide-react";
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

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const ext = await importExtensionFile(file);
      setImported(ext);
      setFileContents({ ...ext.files });
      toast.success("Extension imported", { description: `${ext.name} v${ext.version} — ${Object.keys(ext.files).length} editable files` });
    } catch (e) {
      toast.error("Import failed", { description: (e as Error).message });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
              {imported && (
                <>
                  <Button size="sm" className="bg-gradient-cyber" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" /> Export Modified ZIP
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearImport}>
                    <X className="h-4 w-4 mr-1" /> Unload
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

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
    </ExtCtx.Provider>
  );
}

// ---------------- Analytics ----------------
function AnalyticsView() {
  const ext = useExt();
  const isImported = !!ext.imported;
  const kpis = [
    { label: "Active Installs", value: isImported ? "—" : DEFAULT_EXT.users.toLocaleString(), trend: isImported ? "n/a" : "+12%", icon: Users },
    { label: "Weekly Active", value: isImported ? "—" : DEFAULT_EXT.weeklyActive.toLocaleString(), trend: isImported ? "n/a" : "+4.3%", icon: Activity },
    { label: "Avg Rating", value: isImported ? "—" : DEFAULT_EXT.rating.toFixed(1), trend: isImported ? "n/a" : "+0.2", icon: Star },
    { label: "Security Score", value: isImported ? `${Math.max(40, 100 - ext.permissions.filter(p => p.level !== "safe").length * 12)}/100` : `${DEFAULT_EXT.securityScore}/100`, trend: "live", icon: ShieldCheck },
  ];
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-gradient-cyber">{ext.name}</h1>
        <p className="text-sm text-muted-foreground">v{ext.version} · {isImported ? "imported (local)" : DEFAULT_EXT.id}</p>
      </header>


      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="bg-card/40 backdrop-blur border-border/60 hover:border-primary/40 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <k.icon className="h-4 w-4 text-primary" />
                <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
                  <TrendingUp className="h-2.5 w-2.5 mr-1" />{k.trend}
                </Badge>
              </div>
              <p className="text-2xl font-bold mt-2">{k.value}</p>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-card/40 backdrop-blur border-border/60">
          <CardHeader><CardTitle className="text-base">User Growth · 30 days</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={GROWTH}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                <Line type="monotone" dataKey="users" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur border-border/60">
          <CardHeader><CardTitle className="text-base">Rating Distribution</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={RATINGS}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="stars" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/40 backdrop-blur border-border/60">
        <CardHeader><CardTitle className="text-base">Recent Reviews</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border/60">
              <tr><th className="text-left p-3">User</th><th className="text-left p-3">Rating</th><th className="text-left p-3">Comment</th><th className="text-left p-3">Date</th></tr>
            </thead>
            <tbody>
              {REVIEWS.map((r) => (
                <tr key={r.user} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="p-3 font-medium">{r.user}</td>
                  <td className="p-3 text-amber-400">{"★".repeat(r.rating)}<span className="text-muted-foreground">{"★".repeat(5 - r.rating)}</span></td>
                  <td className="p-3 text-muted-foreground">{r.comment}</td>
                  <td className="p-3 text-xs text-muted-foreground">{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
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
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "ai", text: "Hi! I'm your extension co-pilot. Try: 'Add a dark mode toggle to popup.html' or 'Update manifest to V3'." },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text: `Done — here's a patch for \`popup.html\` that implements: "${text}".`,
          code: {
            file: "popup.html",
            content: `<!-- AI Patch: ${text} -->\n<button id="theme-toggle">🌓 Toggle Theme</button>\n<script>\n  document.getElementById("theme-toggle").onclick = () => {\n    document.body.classList.toggle("dark");\n  };\n<\/script>`,
          },
        },
      ]);
    }, 1100);
  };

  return (
    <Card className="h-full bg-card/40 backdrop-blur border-border/60 flex flex-col">
      <CardHeader className="pb-3 border-b border-border/60">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gradient-cyber flex items-center justify-center">
            <Bot className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          AI Co-Pilot
          <Badge variant="outline" className="ml-auto text-[9px] border-emerald-500/40 text-emerald-400">Online</Badge>
        </CardTitle>
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
              <div className={`max-w-[80%] text-xs leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3 py-2"
                  : "text-foreground"
              }`}>
                <p>{m.text}</p>
                {m.code && (
                  <div className="mt-2 rounded-md border border-border/60 bg-[#0d1117] overflow-hidden">
                    <div className="flex items-center justify-between px-2 py-1 border-b border-border/60 bg-[#161b22]">
                      <span className="text-[10px] font-mono text-muted-foreground">{m.code.file}</span>
                      <Button size="sm" variant="ghost" className="h-5 text-[10px] px-2"
                        onClick={() => toast.success("Code Changes Applied", { description: `Patched ${m.code!.file}` })}>
                        Apply to File
                      </Button>
                    </div>
                    <pre className="text-[10px] font-mono p-2 text-[#e6edf3] overflow-auto max-h-40">{m.code.content}</pre>
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
      <div className="p-3 border-t border-border/60">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask the co-pilot…"
            className="text-xs"
          />
          <Button size="icon" onClick={send} className="bg-gradient-cyber shrink-0">
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
