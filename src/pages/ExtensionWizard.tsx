import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2, Image as ImageIcon, AppWindow, PanelRight, FileCode2, Cog,
  ShieldCheck, Check, Eye, Code2, Download, Lock, Globe, X, Plus, Package, Loader2,
  ShieldAlert, AlertTriangle, Info, Activity, ArrowRight,
} from "lucide-react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { buildAllFiles, buildManifest, type WizardSpec } from "@/lib/wizard-codegen";
import { generateExtensionIcons } from "@/lib/generate-icons";
import { runHealthScan, type HealthFinding, type HealthReport } from "@/lib/wizard-health";

type ExtensionType = "popup" | "sidepanel" | "content" | "background";

const PERMISSIONS = [
  { id: "tabs", label: "tabs", desc: "Read and modify browser tabs" },
  { id: "storage", label: "storage", desc: "Persist user data locally" },
  { id: "activeTab", label: "activeTab", desc: "Temporary access to the current tab" },
  { id: "scripting", label: "scripting", desc: "Inject scripts at runtime" },
  { id: "notifications", label: "notifications", desc: "Show desktop notifications" },
  { id: "alarms", label: "alarms", desc: "Schedule background work" },
] as const;

const TYPE_META: Record<ExtensionType, { label: string; icon: typeof AppWindow; desc: string }> = {
  popup: { label: "Popup Action", icon: AppWindow, desc: "Click the toolbar icon to open a small UI" },
  sidepanel: { label: "Side Panel", icon: PanelRight, desc: "Persistent panel docked to the browser side" },
  content: { label: "Content Script", icon: FileCode2, desc: "Inject UI/logic into web pages" },
  background: { label: "Service Worker", icon: Cog, desc: "Pure background logic, no visible UI" },
};

const STEPS = [
  { id: 1, label: "Basic Info" },
  { id: 2, label: "Extension Type" },
  { id: 3, label: "Permissions" },
];

const STEP_HINTS: Record<number, string> = {
  1: "Identity",
  2: "Surface",
  3: "Capabilities",
};

const ACCENTS = ["from-primary to-accent", "from-accent to-primary"];

export default function ExtensionWizard() {
  const [step, setStep] = useState(1);

  // Step 1
  const [name, setName] = useState("My Awesome Tool");
  const [version, setVersion] = useState("1.0.0");
  const [description, setDescription] = useState("A delightfully focused Chrome extension built with Extension Forge.");
  const [iconDataUrl, setIconDataUrl] = useState<string | null>(null);

  // Step 2
  const [extType, setExtType] = useState<ExtensionType>("popup");

  // Step 3
  const [perms, setPerms] = useState<Record<string, boolean>>({
    activeTab: true,
    storage: true,
    tabs: false,
    scripting: false,
    notifications: false,
    alarms: false,
  });
  const [hostInput, setHostInput] = useState("");
  const [hosts, setHosts] = useState<string[]>(["https://*.example.com/*"]);
  const [matchInput, setMatchInput] = useState("");
  const [matches, setMatches] = useState<string[]>(["https://*.example.com/*"]);
  const [compiling, setCompiling] = useState(false);

  // Preview tab
  const [previewTab, setPreviewTab] = useState<"ui" | "manifest">("ui");

  const spec = useMemo<WizardSpec>(() => ({
    name,
    version,
    description,
    extType,
    permissions: Object.entries(perms).filter(([, v]) => v).map(([k]) => k),
    hosts,
    matches,
  }), [name, version, description, extType, perms, hosts, matches]);

  const manifest = useMemo(() => buildManifest(spec), [spec]);
  const manifestJson = useMemo(() => JSON.stringify(manifest, null, 2), [manifest]);

  const handleIconUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setIconDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const addHost = () => {
    const v = hostInput.trim();
    if (!v) return;
    if (hosts.includes(v)) {
      toast.info("That host pattern is already added");
      return;
    }
    setHosts(h => [...h, v]);
    setHostInput("");
  };

  const addMatch = () => {
    const v = matchInput.trim();
    if (!v) return;
    if (matches.includes(v)) {
      toast.info("That match pattern is already added");
      return;
    }
    setMatches(m => [...m, v]);
    setMatchInput("");
  };

  const downloadManifest = () => {
    const blob = new Blob([manifestJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "manifest.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Rasterize the uploaded icon to a given size; falls back to placeholder.
  const rasterIconFromDataUrl = (dataUrl: string, size: number): Promise<Uint8Array> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.drawImage(img, 0, 0, size, size);
        canvas.toBlob(async (blob) => {
          if (!blob) return reject(new Error("Encode failed"));
          resolve(new Uint8Array(await blob.arrayBuffer()));
        }, "image/png");
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = dataUrl;
    });

  const compileAndDownload = async () => {
    if (compiling) return;
    setCompiling(true);
    const toastId = toast.loading("Compiling Manifest...");
    try {
      const files = buildAllFiles(spec);
      toast.loading("Structuring Assets...", { id: toastId });

      const zip = new JSZip();
      for (const [path, content] of Object.entries(files)) {
        zip.file(path, content);
      }

      // Icons
      if (iconDataUrl) {
        try {
          const [i16, i48, i128] = await Promise.all([
            rasterIconFromDataUrl(iconDataUrl, 16),
            rasterIconFromDataUrl(iconDataUrl, 48),
            rasterIconFromDataUrl(iconDataUrl, 128),
          ]);
          zip.file("icons/icon16.png", i16);
          zip.file("icons/icon48.png", i48);
          zip.file("icons/icon128.png", i128);
        } catch {
          const icons = generateExtensionIcons();
          Object.entries(icons).forEach(([p, b]) => zip.file(p, b));
        }
      } else {
        const icons = generateExtensionIcons();
        Object.entries(icons).forEach(([p, b]) => zip.file(p, b));
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(spec.name || "extension").toLowerCase().replace(/\s+/g, "-")}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Ready to Download!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Compile failed: " + (err instanceof Error ? err.message : "Unknown error"), { id: toastId });
    } finally {
      setCompiling(false);
    }
  };

  const stepValid = step === 1 ? !!name.trim() && /^\d+(\.\d+){0,3}$/.test(version) : true;

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/40 backdrop-blur">
        <div className="px-6 py-5 max-w-[1600px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wand2 className="h-6 w-6 text-primary" />
              Extension Workspace
            </h1>
            <p className="text-sm text-muted-foreground">Configure on the left — watch your extension assemble in real time on the right.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px] border-primary/30 text-primary">
              MV3
            </Badge>
            <Badge variant="secondary" className="font-mono text-[10px]">
              {Object.values(perms).filter(Boolean).length + hosts.length} perms
            </Badge>
            <Button size="sm" variant="outline" onClick={downloadManifest}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> manifest.json
            </Button>
            <Button
              size="sm"
              onClick={compileAndDownload}
              disabled={compiling}
              className="bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90"
            >
              {compiling ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Compiling…</>
              ) : (
                <><Package className="h-3.5 w-3.5 mr-1.5" /> Compile & Download (.zip)</>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] gap-6">
        {/* ============ LEFT: WIZARD ============ */}
        <div className="space-y-4">
          {/* Step rail */}
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              {STEPS.map((s, i) => {
                const isActive = step === s.id;
                const isDone = step > s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setStep(s.id)}
                    className="flex-1 flex items-center gap-2 px-2"
                  >
                    <div
                      className={`relative h-8 w-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0 transition ${
                        isActive
                          ? `bg-gradient-to-br ${ACCENTS[0]} text-primary-foreground shadow-md`
                          : isDone
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isDone ? <Check className="h-4 w-4" /> : s.id}
                    </div>
                    <div className="text-left min-w-0 hidden sm:block">
                      <p className={`text-xs font-medium truncate ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                        {s.label}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 truncate">{STEP_HINTS[s.id]}</p>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`flex-1 h-px ${step > s.id ? "bg-primary/40" : "bg-border"}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="rounded-xl border border-border bg-card p-5 space-y-5"
            >
              {step === 1 && (
                <>
                  <div>
                    <h2 className="text-sm font-semibold">Basic Info</h2>
                    <p className="text-xs text-muted-foreground">How your extension introduces itself.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ext-name" className="text-xs">Name</Label>
                    <Input id="ext-name" value={name} onChange={e => setName(e.target.value)} placeholder="My Awesome Tool" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="ext-version" className="text-xs">Version</Label>
                      <Input id="ext-version" value={version} onChange={e => setVersion(e.target.value)} placeholder="1.0.0" className="font-mono" />
                      {!/^\d+(\.\d+){0,3}$/.test(version) && (
                        <p className="text-[10px] text-destructive">Use semver: 1, 1.0, 1.0.0, or 1.0.0.0</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Icon</Label>
                      <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-dashed border-border bg-muted/30 hover:bg-muted/50 transition cursor-pointer text-xs">
                        {iconDataUrl ? (
                          <>
                            <img src={iconDataUrl} alt="" className="h-5 w-5 rounded" />
                            <span className="truncate">Replace</span>
                          </>
                        ) : (
                          <>
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Upload PNG</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => e.target.files?.[0] && handleIconUpload(e.target.files[0])}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ext-desc" className="text-xs">Description</Label>
                    <Textarea
                      id="ext-desc"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      rows={3}
                      maxLength={132}
                      placeholder="A short, scannable description (max 132 chars)"
                    />
                    <p className="text-[10px] text-muted-foreground text-right font-mono">{description.length}/132</p>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <h2 className="text-sm font-semibold">Extension Type</h2>
                    <p className="text-xs text-muted-foreground">Pick the primary surface — the preview adapts instantly.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(Object.keys(TYPE_META) as ExtensionType[]).map(t => {
                      const meta = TYPE_META[t];
                      const Icon = meta.icon;
                      const active = extType === t;
                      return (
                        <button
                          key={t}
                          onClick={() => setExtType(t)}
                          className={`text-left p-3 rounded-lg border transition ${
                            active
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border bg-muted/20 hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className={`h-8 w-8 rounded-md flex items-center justify-center ${active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            {active && <Check className="h-4 w-4 text-primary" />}
                          </div>
                          <p className="text-sm font-medium mt-2">{meta.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{meta.desc}</p>
                        </button>
                      );
                    })}
                  </div>

                  {extType === "content" && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <Label className="text-xs flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5" /> Target matches (URLs)
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Pages where <span className="font-mono">content.js</span> will be injected.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          value={matchInput}
                          onChange={e => setMatchInput(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addMatch())}
                          placeholder="https://*.example.com/*"
                          className="font-mono text-xs"
                        />
                        <Button size="sm" variant="outline" onClick={addMatch}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {matches.length === 0 && (
                          <p className="text-[11px] text-muted-foreground italic">Defaults to &lt;all_urls&gt;.</p>
                        )}
                        {matches.map(h => (
                          <Badge key={h} variant="secondary" className="font-mono text-[10px] gap-1 pl-2 pr-1 py-0.5">
                            {h}
                            <button
                              onClick={() => setMatches(list => list.filter(x => x !== h))}
                              className="ml-0.5 hover:text-destructive"
                              aria-label={`Remove ${h}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {step === 3 && (
                <>
                  <div>
                    <h2 className="text-sm font-semibold">Permissions</h2>
                    <p className="text-xs text-muted-foreground">Request only what you need — Chrome reviewers care.</p>
                  </div>

                  <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                    {PERMISSIONS.map(p => (
                      <div key={p.id} className="px-3 py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-mono">{p.label}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{p.desc}</p>
                        </div>
                        <Switch
                          checked={!!perms[p.id]}
                          onCheckedChange={v => setPerms(s => ({ ...s, [p.id]: v }))}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5" /> Host permissions
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={hostInput}
                        onChange={e => setHostInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addHost())}
                        placeholder="https://*.example.com/*"
                        className="font-mono text-xs"
                      />
                      <Button size="sm" variant="outline" onClick={addHost}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {hosts.length === 0 && (
                        <p className="text-[11px] text-muted-foreground italic">No host patterns yet.</p>
                      )}
                      {hosts.map(h => (
                        <Badge key={h} variant="secondary" className="font-mono text-[10px] gap-1 pl-2 pr-1 py-0.5">
                          {h}
                          <button
                            onClick={() => setHosts(list => list.filter(x => x !== h))}
                            className="ml-0.5 hover:text-destructive"
                            aria-label={`Remove ${h}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Nav */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}>
              ← Back
            </Button>
            <p className="text-[11px] text-muted-foreground font-mono">Step {step} / {STEPS.length}</p>
            {step < STEPS.length ? (
              <Button size="sm" onClick={() => setStep(s => Math.min(STEPS.length, s + 1))} disabled={!stepValid}>
                Next →
              </Button>
            ) : (
              <Button size="sm" onClick={() => toast.success("Spec ready — download manifest from the header.")}>
                <Check className="h-3.5 w-3.5 mr-1.5" /> Finish
              </Button>
            )}
          </div>
        </div>

        {/* ============ RIGHT: PREVIEW ============ */}
        <div className="space-y-4">
          <Tabs value={previewTab} onValueChange={v => setPreviewTab(v as "ui" | "manifest")}>
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="ui" className="gap-1.5"><Eye className="h-3.5 w-3.5" /> Live UI</TabsTrigger>
                <TabsTrigger value="manifest" className="gap-1.5"><Code2 className="h-3.5 w-3.5" /> manifest.json</TabsTrigger>
              </TabsList>
              <p className="text-[11px] text-muted-foreground font-mono hidden sm:block">
                {TYPE_META[extType].label}
              </p>
            </div>

            <TabsContent value="ui" className="mt-3">
              <BrowserChrome
                extType={extType}
                name={name}
                description={description}
                iconDataUrl={iconDataUrl}
                perms={Object.entries(perms).filter(([, v]) => v).map(([k]) => k)}
                hosts={hosts}
              />
            </TabsContent>

            <TabsContent value="manifest" className="mt-3">
              <ManifestPreview json={manifestJson} />
            </TabsContent>
          </Tabs>

          {/* Spec snapshot */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" /> Spec snapshot
              </h3>
              <Badge variant="outline" className="text-[10px] font-mono">live</Badge>
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <SpecCell label="Surface" value={TYPE_META[extType].label} />
              <SpecCell label="Permissions" value={String(Object.values(perms).filter(Boolean).length)} />
              <SpecCell label="Host patterns" value={String(hosts.length)} />
              <SpecCell label="Version" value={version} mono />
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Browser chrome mockup
 * ============================================================ */
function BrowserChrome({
  extType, name, description, iconDataUrl, perms, hosts,
}: {
  extType: ExtensionType;
  name: string;
  description: string;
  iconDataUrl: string | null;
  perms: string[];
  hosts: string[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xl">
      {/* Title bar */}
      <div className="bg-muted/60 px-3 py-2 flex items-center gap-2 border-b border-border">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="ml-2 flex-1 max-w-xs px-3 py-1 rounded-md bg-background/60 text-[11px] text-muted-foreground font-mono flex items-center gap-1.5">
          <Lock className="h-3 w-3" />
          chrome.com
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {/* Extension toolbar icon */}
          <div className="relative h-6 w-6 rounded-md border border-border bg-background flex items-center justify-center">
            {iconDataUrl ? (
              <img src={iconDataUrl} alt="" className="h-4 w-4 rounded-sm object-cover" />
            ) : (
              <div className="h-4 w-4 rounded-sm bg-gradient-to-br from-primary to-accent" />
            )}
            <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-success border border-card" />
          </div>
        </div>
      </div>

      {/* Page area */}
      <div className="relative bg-gradient-to-br from-background to-muted/40 min-h-[460px]">
        {/* Faux page */}
        <div className="absolute inset-0 p-6 opacity-40 pointer-events-none">
          <div className="h-4 w-1/3 rounded bg-muted mb-3" />
          <div className="h-2 w-2/3 rounded bg-muted mb-1.5" />
          <div className="h-2 w-1/2 rounded bg-muted mb-6" />
          <div className="grid grid-cols-3 gap-3">
            <div className="h-20 rounded-lg bg-muted" />
            <div className="h-20 rounded-lg bg-muted" />
            <div className="h-20 rounded-lg bg-muted" />
          </div>
        </div>

        {/* Surface */}
        {extType === "popup" && (
          <motion.div
            key="popup"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-3 right-3 w-[320px] rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
          >
            <ExtensionUIBody name={name} description={description} iconDataUrl={iconDataUrl} perms={perms} />
            <div className="absolute -top-1.5 right-4 h-3 w-3 rotate-45 bg-card border-l border-t border-border" />
          </motion.div>
        )}

        {extType === "sidepanel" && (
          <motion.div
            key="sidepanel"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute top-0 right-0 bottom-0 w-[300px] border-l border-border bg-card shadow-2xl overflow-y-auto"
          >
            <ExtensionUIBody name={name} description={description} iconDataUrl={iconDataUrl} perms={perms} />
          </motion.div>
        )}

        {extType === "content" && (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[80%] max-w-md rounded-2xl border border-primary/30 bg-card shadow-2xl px-4 py-3 flex items-center gap-3"
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 overflow-hidden">
              {iconDataUrl ? <img src={iconDataUrl} alt="" className="h-full w-full object-cover" /> : <Wand2 className="h-4 w-4 text-primary-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{name || "Injected widget"}</p>
              <p className="text-xs text-muted-foreground truncate">Injected on {hosts[0] ?? "all sites"}</p>
            </div>
            <Badge variant="secondary" className="text-[10px] font-mono">CONTENT</Badge>
          </motion.div>
        )}

        {extType === "background" && (
          <motion.div
            key="bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="text-center max-w-sm px-6">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center mx-auto mb-3">
                <Cog className="h-7 w-7 text-primary animate-spin-slow" />
              </div>
              <p className="text-sm font-semibold">{name} runs in the background</p>
              <p className="text-xs text-muted-foreground mt-1">No visible UI — listens to events, alarms, and messages from other surfaces.</p>
              <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-card text-[10px] font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                service_worker: background.js
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function ExtensionUIBody({
  name, description, iconDataUrl, perms,
}: { name: string; description: string; iconDataUrl: string | null; perms: string[] }) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden shrink-0">
          {iconDataUrl ? <img src={iconDataUrl} alt="" className="h-full w-full object-cover" /> : <Wand2 className="h-4 w-4 text-primary-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{name || "Untitled"}</p>
          <p className="text-[10px] text-muted-foreground font-mono">v1.0.0</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
        {description || "Add a description in step 1 to see it rendered here."}
      </p>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button className="px-2.5 py-2 rounded-md bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-medium">
          Run
        </button>
        <button className="px-2.5 py-2 rounded-md bg-muted text-xs font-medium border border-border">
          Settings
        </button>
      </div>
      {perms.length > 0 && (
        <div className="pt-2 border-t border-border">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Active permissions</p>
          <div className="flex flex-wrap gap-1">
            {perms.slice(0, 6).map(p => (
              <span key={p} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * Manifest preview with light syntax highlighting
 * ============================================================ */
function ManifestPreview({ json }: { json: string }) {
  const copy = async () => {
    await navigator.clipboard.writeText(json);
    toast.success("Copied manifest.json");
  };
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <FileCode2 className="h-4 w-4 text-primary" />
          <span className="text-xs font-mono">manifest.json</span>
        </div>
        <Button size="sm" variant="ghost" onClick={copy}>Copy</Button>
      </div>
      <pre className="p-4 text-xs font-mono leading-relaxed overflow-auto max-h-[520px]">
        <code dangerouslySetInnerHTML={{ __html: highlightJson(json) }} />
      </pre>
    </div>
  );
}

function highlightJson(src: string): string {
  // Escape first
  const escaped = src.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.replace(
    /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g,
    (_m, key, str, lit, num) => {
      if (key) return `<span class="text-primary">${key}</span>`;
      if (str) return `<span class="text-accent">${str}</span>`;
      if (lit) return `<span class="text-warning">${lit}</span>`;
      if (num) return `<span class="text-success">${num}</span>`;
      return _m;
    },
  );
}

function SpecCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
      <p className={`text-sm font-semibold ${mono ? "font-mono" : ""}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
