import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Upload, ShieldCheck, KeyRound, ExternalLink, Loader2, CheckCircle2,
  AlertTriangle, RefreshCw, Rocket, FileArchive, Eye, EyeOff,
  Trash2, ClipboardCopy, Wand2, FileSearch,
} from "lucide-react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { runPackageQA, type QAReport } from "@/lib/package-qa";
import { autoFixAndValidate } from "@/lib/package-autofix";

const STORAGE_KEY = "cws-credentials";
const REQUIRED_SCOPE = "https://www.googleapis.com/auth/chromewebstore";

type Credentials = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  extensionId: string;
};

type LogEntry = { ts: number; level: "info" | "ok" | "warn" | "err"; msg: string };

const emptyCreds: Credentials = {
  clientId: "",
  clientSecret: "",
  refreshToken: "",
  extensionId: "",
};

function loadCreds(): Credentials {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyCreds;
    return { ...emptyCreds, ...JSON.parse(raw) };
  } catch {
    return emptyCreds;
  }
}

function loadExtensionFiles(): Record<string, string> | null {
  try {
    const raw = sessionStorage.getItem("extension-files");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function filesToZipBase64(files: Record<string, string>): Promise<string> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  return await blobToBase64(blob);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.split(",")[1] ?? result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function PublishAssistant() {
  const [creds, setCreds] = useState<Credentials>(loadCreds);
  const [showSecrets, setShowSecrets] = useState(false);
  const [authCode, setAuthCode] = useState("");
  const [exchanging, setExchanging] = useState(false);

  const [files, setFiles] = useState<Record<string, string> | null>(loadExtensionFiles);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipBase64Override, setZipBase64Override] = useState<string | null>(null);

  const [qa, setQA] = useState<QAReport | null>(null);
  const [autoFixApplied, setAutoFixApplied] = useState<string[]>([]);

  const [publishTarget, setPublishTarget] =
    useState<"default" | "trustedTesters">("trustedTesters");
  const [autoPublish, setAutoPublish] = useState(false);

  const [stage, setStage] = useState<
    "idle" | "qa" | "uploading" | "publishing" | "done" | "error"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsRef = useRef<HTMLDivElement>(null);

  // Persist credentials to sessionStorage only (cleared on tab close).
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
  }, [creds]);

  // Auto-scroll log
  useEffect(() => {
    logsRef.current?.scrollTo({ top: logsRef.current.scrollHeight });
  }, [logs]);

  const log = (level: LogEntry["level"], msg: string) =>
    setLogs((l) => [...l, { ts: Date.now(), level, msg }]);

  // Run QA whenever files change
  useEffect(() => {
    if (!files) {
      setQA(null);
      return;
    }
    try {
      setQA(runPackageQA(files));
    } catch {
      setQA(null);
    }
  }, [files]);

  const credsComplete = useMemo(
    () => !!(creds.clientId && creds.clientSecret && creds.refreshToken),
    [creds],
  );

  const oauthAuthUrl = useMemo(() => {
    if (!creds.clientId) return null;
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.searchParams.set("client_id", creds.clientId);
    u.searchParams.set("redirect_uri", "urn:ietf:wg:oauth:2.0:oob");
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", REQUIRED_SCOPE);
    u.searchParams.set("access_type", "offline");
    u.searchParams.set("prompt", "consent");
    return u.toString();
  }, [creds.clientId]);

  const handleExchangeCode = async () => {
    if (!creds.clientId || !creds.clientSecret || !authCode.trim()) {
      toast.error("Enter Client ID, Secret and the one-time code");
      return;
    }
    setExchanging(true);
    log("info", "Exchanging authorization code for refresh token…");
    try {
      const { data, error } = await supabase.functions.invoke("chrome-store-upload", {
        body: {
          op: "exchange-code",
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
          code: authCode.trim(),
          redirectUri: "urn:ietf:wg:oauth:2.0:oob",
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Exchange failed");
      setCreds((c) => ({ ...c, refreshToken: data.refreshToken }));
      setAuthCode("");
      log("ok", "Refresh token saved (kept in this browser tab only).");
      toast.success("Connected to Chrome Web Store");
    } catch (e: any) {
      log("err", `Exchange failed: ${e.message}`);
      toast.error(e.message || "Code exchange failed");
    } finally {
      setExchanging(false);
    }
  };

  const handleAutoFix = () => {
    if (!files) return;
    const { files: fixed, fixes } = autoFixAndValidate(files);
    setFiles(fixed);
    sessionStorage.setItem("extension-files", JSON.stringify(fixed));
    setAutoFixApplied(fixes.map((f) => f.description));
    toast.success(`Applied ${fixes.length} auto-fixes`);
    log("ok", `Auto-fixed ${fixes.length} issue(s)`);
  };

  const handleZipUpload = async (file: File) => {
    setZipFile(file);
    setZipBase64Override(await blobToBase64(file));
    setFiles(null);
    setQA(null);
    log("info", `Loaded ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
  };

  const canPublish =
    credsComplete &&
    (zipBase64Override || (files && (!qa || qa.errors === 0))) &&
    stage !== "uploading" &&
    stage !== "publishing";

  const runPipeline = async () => {
    if (!credsComplete) {
      toast.error("Connect your Chrome Web Store account first");
      return;
    }
    setStage("qa");
    setProgress(5);
    setResultUrl(null);
    setLogs([]);

    let zipBase64 = zipBase64Override;

    if (!zipBase64) {
      if (!files) {
        toast.error("Load extension files or upload a .zip");
        setStage("idle");
        return;
      }
      const report = runPackageQA(files);
      setQA(report);
      log("info", `QA: ${report.errors} errors, ${report.warnings} warnings`);
      if (report.errors > 0) {
        log("err", "Critical errors found — auto-fixing before upload…");
        const fixed = autoFixAndValidate(files);
        setFiles(fixed.files);
        sessionStorage.setItem("extension-files", JSON.stringify(fixed.files));
        const after = runPackageQA(fixed.files);
        setQA(after);
        if (after.errors > 0) {
          log("err", `Cannot auto-fix all errors (${after.errors} remain). Aborting.`);
          toast.error("Fix remaining errors before publishing");
          setStage("error");
          return;
        }
        log("ok", "Auto-fix succeeded.");
        zipBase64 = await filesToZipBase64(fixed.files);
      } else {
        zipBase64 = await filesToZipBase64(files);
      }
    }

    setStage("uploading");
    setProgress(35);
    log("info", creds.extensionId
      ? `Updating existing item ${creds.extensionId}…`
      : "Creating new draft listing…");

    try {
      const op = autoPublish ? "full" : "upload";
      const { data, error } = await supabase.functions.invoke("chrome-store-upload", {
        body: {
          op,
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
          refreshToken: creds.refreshToken,
          extensionId: creds.extensionId || undefined,
          zipBase64,
          publishTarget,
        },
      });

      if (error) throw error;
      if (data?.error) {
        log("err", `${data.error}${data.hint ? ` — ${data.hint}` : ""}`);
        if (data.code) log("warn", `CWS code: ${data.code}`);
        setStage("error");
        toast.error(data.hint || data.error);
        return;
      }

      const itemId = data.itemId ?? creds.extensionId;
      if (itemId && itemId !== creds.extensionId) {
        setCreds((c) => ({ ...c, extensionId: itemId }));
        log("ok", `New item id: ${itemId}`);
      }

      setProgress(80);
      if (autoPublish) {
        setStage("publishing");
        log("ok", `Submitted to "${publishTarget}" track.`);
      }

      setProgress(100);
      setStage("done");
      setResultUrl(data.dashboardUrl ?? null);
      log("ok", autoPublish
        ? "Upload + publish complete. Track review in the developer dashboard."
        : "Upload complete. Open the dashboard to review & submit.");
      toast.success(autoPublish ? "Published to Chrome Web Store" : "Uploaded successfully");
    } catch (e: any) {
      log("err", `Pipeline failed: ${e.message}`);
      setStage("error");
      toast.error(e.message || "Publishing failed");
    }
  };

  const clearCreds = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setCreds(emptyCreds);
    toast.success("Credentials cleared");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Rocket className="h-6 w-6 text-accent" />
          Chrome Web Store · Auto-Publish
        </h1>
        <p className="text-muted-foreground mt-1">
          End-to-end registration, compliance check, upload and publish. Credentials live in this browser tab only.
        </p>
      </motion.div>

      <Tabs defaultValue="connect" className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="connect">
            <KeyRound className="h-3.5 w-3.5 mr-1.5" />
            1. Connect
          </TabsTrigger>
          <TabsTrigger value="package">
            <FileArchive className="h-3.5 w-3.5 mr-1.5" />
            2. Package
          </TabsTrigger>
          <TabsTrigger value="publish">
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            3. Publish
          </TabsTrigger>
        </TabsList>

        {/* CONNECT ------------------------------------------------------- */}
        <TabsContent value="connect" className="space-y-4 mt-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">Google OAuth Credentials</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Stored only in <code className="font-mono">sessionStorage</code>. Cleared when you close this tab.
                </p>
              </div>
              <Badge variant={credsComplete ? "default" : "outline"} className="shrink-0">
                {credsComplete ? (
                  <><CheckCircle2 className="h-3 w-3 mr-1" /> Connected</>
                ) : (
                  <><AlertTriangle className="h-3 w-3 mr-1" /> Not connected</>
                )}
              </Badge>
            </div>

            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">One-time setup (≈3 minutes):</p>
              <ol className="space-y-1 list-decimal pl-4">
                <li>
                  Register as a CWS developer ($5):{" "}
                  <a className="text-primary hover:underline" target="_blank" rel="noopener"
                    href="https://chrome.google.com/webstore/devconsole">
                    chrome.google.com/webstore/devconsole
                  </a>
                </li>
                <li>
                  Enable the Chrome Web Store API in Google Cloud:{" "}
                  <a className="text-primary hover:underline" target="_blank" rel="noopener"
                    href="https://console.cloud.google.com/apis/library/chromewebstore.googleapis.com">
                    enable API
                  </a>
                </li>
                <li>
                  Create an OAuth Client ID (type: <b>Desktop App</b>) in{" "}
                  <a className="text-primary hover:underline" target="_blank" rel="noopener"
                    href="https://console.cloud.google.com/apis/credentials">
                    APIs & Credentials
                  </a>{" "}— copy the Client ID + Secret below.
                </li>
                <li>Click <b>Get one-time code</b>, sign in with your developer account, paste the code, click <b>Exchange</b>.</li>
              </ol>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Client ID</Label>
                <Input
                  value={creds.clientId}
                  onChange={(e) => setCreds({ ...creds, clientId: e.target.value })}
                  placeholder="xxxxx.apps.googleusercontent.com"
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Client Secret</Label>
                <div className="relative">
                  <Input
                    type={showSecrets ? "text" : "password"}
                    value={creds.clientSecret}
                    onChange={(e) => setCreds({ ...creds, clientSecret: e.target.value })}
                    placeholder="GOCSPX-…"
                    className="font-mono text-xs pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Toggle secret visibility"
                  >
                    {showSecrets ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border bg-secondary/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Refresh Token</span>
                {creds.refreshToken && (
                  <Badge variant="outline" className="text-[10px]">
                    <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> obtained
                  </Badge>
                )}
              </div>
              {creds.refreshToken ? (
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[10px] font-mono truncate bg-background rounded px-2 py-1">
                    {showSecrets ? creds.refreshToken : "•".repeat(40)}
                  </code>
                  <Button size="sm" variant="ghost" onClick={() =>
                    setCreds({ ...creds, refreshToken: "" })}>
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!oauthAuthUrl}
                      onClick={() => oauthAuthUrl && window.open(oauthAuthUrl, "_blank", "noopener")}
                    >
                      <ExternalLink className="h-3 w-3 mr-1.5" />
                      Get one-time code
                    </Button>
                    <Input
                      value={authCode}
                      onChange={(e) => setAuthCode(e.target.value)}
                      placeholder="4/0Ad…"
                      className="font-mono text-xs"
                    />
                    <Button size="sm" onClick={handleExchangeCode} disabled={exchanging}>
                      {exchanging
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : "Exchange"}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Code is one-time use. If exchange fails, click "Get one-time code" again for a fresh code.
                  </p>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <div>
                <Label className="text-xs">Extension ID (optional)</Label>
                <Input
                  value={creds.extensionId}
                  onChange={(e) => setCreds({ ...creds, extensionId: e.target.value })}
                  placeholder="Leave blank to create a new draft"
                  className="font-mono text-xs"
                />
              </div>
              <div className="flex justify-end">
                <Button size="sm" variant="ghost" onClick={clearCreds}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear all credentials
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* PACKAGE ------------------------------------------------------- */}
        <TabsContent value="package" className="space-y-4 mt-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <h3 className="font-semibold">Package Source</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Use the extension currently loaded from /create, /wizard or /editor — or upload an existing .zip.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-md border border-border bg-secondary/30 p-3">
                <div className="text-xs font-medium mb-1">From current session</div>
                {files ? (
                  <div className="text-xs text-muted-foreground">
                    {Object.keys(files).length} files loaded
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No extension in session</div>
                )}
              </div>

              <div className="rounded-md border border-border bg-secondary/30 p-3">
                <Label className="text-xs">Upload a .zip</Label>
                <Input
                  type="file"
                  accept=".zip,application/zip"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleZipUpload(f);
                  }}
                  className="text-xs mt-1"
                />
                {zipFile && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {zipFile.name} · {(zipFile.size / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* QA report */}
          {files && qa && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Compliance Scan
                </h3>
                <div className="flex items-center gap-2">
                  <Badge variant={qa.errors === 0 ? "default" : "destructive"}>
                    {qa.errors} errors
                  </Badge>
                  <Badge variant="outline">{qa.warnings} warnings</Badge>
                  {qa.errors > 0 && (
                    <Button size="sm" onClick={handleAutoFix}>
                      <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Auto-Fix
                    </Button>
                  )}
                </div>
              </div>

              {autoFixApplied.length > 0 && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs space-y-1">
                  <p className="font-medium">Auto-fixes applied:</p>
                  <ul className="list-disc pl-4 text-muted-foreground">
                    {autoFixApplied.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}

              <div className="max-h-60 overflow-auto space-y-1">
                {qa.checks
                  .filter((c) => !c.passed)
                  .map((c) => (
                    <div key={c.id} className="flex items-start gap-2 text-xs rounded-md bg-secondary/40 p-2">
                      {c.severity === "error" ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                      ) : (
                        <FileSearch className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-medium">{c.title}</p>
                        <p className="text-muted-foreground">{c.detail}</p>
                      </div>
                    </div>
                  ))}
                {qa.checks.every((c) => c.passed) && (
                  <p className="text-xs text-primary flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> All checks pass — Chrome-ready.
                  </p>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* PUBLISH ------------------------------------------------------- */}
        <TabsContent value="publish" className="space-y-4 mt-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="font-semibold">Submission Options</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Publish Track</Label>
                <Select value={publishTarget} onValueChange={(v: any) => setPublishTarget(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trustedTesters">Trusted Testers (recommended first)</SelectItem>
                    <SelectItem value="default">Public (default)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Trusted Testers lets you verify the listing before going public.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 p-3">
                <div>
                  <p className="text-sm font-medium">Auto-Publish after Upload</p>
                  <p className="text-[10px] text-muted-foreground">
                    Off = upload draft only. On = upload then submit for review.
                  </p>
                </div>
                <Switch checked={autoPublish} onCheckedChange={setAutoPublish} />
              </div>
            </div>

            <Button
              size="lg"
              disabled={!canPublish}
              onClick={runPipeline}
              className="w-full bg-gradient-cyber text-primary-foreground"
            >
              {stage === "uploading" || stage === "publishing"
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {stage}…</>
                : <><Rocket className="h-4 w-4 mr-2" /> Run Full Publish Pipeline</>}
            </Button>

            {stage !== "idle" && (
              <div className="space-y-1">
                <Progress value={progress} />
                <p className="text-[10px] text-muted-foreground capitalize">{stage}</p>
              </div>
            )}

            {resultUrl && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Submission complete</p>
                  <p className="text-xs text-muted-foreground">
                    Track review status in the Chrome Web Store developer console.
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <a href={resultUrl} target="_blank" rel="noopener">
                    Open dashboard <ExternalLink className="h-3 w-3 ml-1.5" />
                  </a>
                </Button>
              </div>
            )}
          </div>

          {/* Logs */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Activity Log</h3>
              {logs.length > 0 && (
                <Button size="sm" variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      logs.map((l) => `[${new Date(l.ts).toISOString()}] ${l.level.toUpperCase()} ${l.msg}`).join("\n")
                    );
                    toast.success("Log copied");
                  }}>
                  <ClipboardCopy className="h-3 w-3 mr-1" /> Copy
                </Button>
              )}
            </div>
            <ScrollArea className="h-48">
              <div ref={logsRef} className="font-mono text-[11px] space-y-0.5">
                {logs.length === 0 ? (
                  <p className="text-muted-foreground">No activity yet.</p>
                ) : logs.map((l, i) => (
                  <div key={i} className={
                    l.level === "err" ? "text-destructive"
                    : l.level === "warn" ? "text-amber-400"
                    : l.level === "ok" ? "text-primary"
                    : "text-muted-foreground"
                  }>
                    [{new Date(l.ts).toLocaleTimeString()}] {l.msg}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
