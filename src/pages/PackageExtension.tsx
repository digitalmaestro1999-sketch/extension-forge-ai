import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Download, FileArchive, CheckCircle2, FolderTree, Sparkles, Loader2,
  Image, ShieldCheck, AlertTriangle, XCircle, Info, Wand2, Store, Upload,
  Lock, Trash2, History, ChevronDown,
} from "lucide-react";
import { runPackageQA, type QASeverity } from "@/lib/package-qa";
import { autoFixAndValidate, type AutoFix } from "@/lib/package-autofix";
import { certifyExtension, type CertificationReport } from "@/lib/quality-suite";
import { analyzePermissionRisk, applyAutoFix, applyAllAutoFixes, checkAutoFixSafety, type PermissionRiskReport, type RiskLevel, type PermissionFinding } from "@/lib/permission-risk";
import { BrowserCompatPanel, CompatScoreBadge } from "@/components/BrowserCompatPanel";
import { analyzeBrowserCompatibility, compatReportMarkdown } from "@/lib/browser-compat";
import { runPreflight, type PreflightResult } from "@/lib/preflight-manifest";
import { logSecurityEvent } from "@/lib/security-audit-log";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { ExtensionSpec } from "@/lib/generate-extension";
import { generateExtensionIcons } from "@/lib/generate-icons";
import { supabase } from "@/integrations/supabase/client";

// Session-only storage key for OAuth creds. NEVER use localStorage — credentials
// would persist after the tab closes and survive across users on shared machines.
const CWS_SESSION_KEY = "cws-oauth-session-v1";

interface CwsSessionCreds {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  extensionId: string;
}

type UploadStage =
  | { step: "idle"; pct: 0 }
  | { step: "building"; pct: number; label: string }
  | { step: "encoding"; pct: number; label: string }
  | { step: "authenticating"; pct: number; label: string }
  | { step: "uploading"; pct: number; label: string }
  | { step: "publishing"; pct: number; label: string }
  | { step: "done"; pct: 100; label: string }
  | { step: "error"; pct: number; label: string };

interface LastAutoFix {
  ranAt: number;
  fixes: AutoFix[];
  before: { errors: number; warnings: number };
  after: { errors: number; warnings: number };
}

export default function PackageExtension() {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [spec, setSpec] = useState<ExtensionSpec | null>(null);
  const [aiIconBase64, setAiIconBase64] = useState<string | null>(null);
  const [generatingIcons, setGeneratingIcons] = useState(false);
  const [autoFixing, setAutoFixing] = useState(false);
  const [lastFix, setLastFix] = useState<LastAutoFix | null>(null);
  const [fixReportOpen, setFixReportOpen] = useState(true);
  const [cert, setCert] = useState<CertificationReport | null>(null);
  const [certifying, setCertifying] = useState(false);
  const [ackWarnings, setAckWarnings] = useState(false);

  // Chrome Web Store upload state
  const [cwsOpen, setCwsOpen] = useState(false);
  const [cwsUploading, setCwsUploading] = useState(false);
  const [cwsClientId, setCwsClientId] = useState("");
  const [cwsClientSecret, setCwsClientSecret] = useState("");
  const [cwsRefreshToken, setCwsRefreshToken] = useState("");
  const [cwsExtensionId, setCwsExtensionId] = useState("");
  const [cwsPublish, setCwsPublish] = useState(false);
  const [cwsRemember, setCwsRemember] = useState(false);
  const [cwsLoadedFromSession, setCwsLoadedFromSession] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>({ step: "idle", pct: 0 });

  useEffect(() => {
    const storedFiles = sessionStorage.getItem("extension-files");
    const storedSpec = sessionStorage.getItem("extension-spec");
    if (storedFiles) try { setFiles(JSON.parse(storedFiles)); } catch { /* ignore */ }
    if (storedSpec) try { setSpec(JSON.parse(storedSpec)); } catch { /* ignore */ }

    // Restore OAuth creds only from sessionStorage (cleared on tab close).
    const raw = sessionStorage.getItem(CWS_SESSION_KEY);
    if (raw) {
      try {
        const c = JSON.parse(raw) as CwsSessionCreds;
        setCwsClientId(c.clientId ?? "");
        setCwsClientSecret(c.clientSecret ?? "");
        setCwsRefreshToken(c.refreshToken ?? "");
        setCwsExtensionId(c.extensionId ?? "");
        setCwsRemember(true);
        setCwsLoadedFromSession(true);
      } catch { /* ignore */ }
    }
  }, []);

  // Persist OAuth creds to sessionStorage only while the user opts in. Cleared
  // immediately when the toggle is turned off so creds don't linger in memory storage.
  useEffect(() => {
    if (!cwsRemember) {
      sessionStorage.removeItem(CWS_SESSION_KEY);
      return;
    }
    const payload: CwsSessionCreds = {
      clientId: cwsClientId,
      clientSecret: cwsClientSecret,
      refreshToken: cwsRefreshToken,
      extensionId: cwsExtensionId,
    };
    sessionStorage.setItem(CWS_SESSION_KEY, JSON.stringify(payload));
  }, [cwsRemember, cwsClientId, cwsClientSecret, cwsRefreshToken, cwsExtensionId]);

  const clearCwsCreds = useCallback(() => {
    setCwsClientId("");
    setCwsClientSecret("");
    setCwsRefreshToken("");
    setCwsExtensionId("");
    setCwsRemember(false);
    setCwsLoadedFromSession(false);
    sessionStorage.removeItem(CWS_SESSION_KEY);
    toast.success("Cleared stored OAuth credentials");
  }, []);

  const generateAIIcons = async () => {
    if (!spec) return;
    setGeneratingIcons(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-icons", {
        body: { name: spec.name, description: spec.description },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.imageBase64) {
        setAiIconBase64(data.imageBase64);
        toast.success("AI icons generated! They'll be included in your download.");
      } else {
        throw new Error("No image returned");
      }
    } catch (e: unknown) {
      console.error("Icon generation error:", e);
      toast.error(e instanceof Error ? e.message : "Failed to generate icons");
    } finally {
      setGeneratingIcons(false);
    }
  };

  const base64ToUint8Array = (base64DataUrl: string): Uint8Array => {
    const base64 = base64DataUrl.split(",")[1] || base64DataUrl;
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  };

  const resizeIcon = async (base64DataUrl: string, size: number): Promise<Uint8Array> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, size, size);
        canvas.toBlob((blob) => {
          if (blob) blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
          else resolve(base64ToUint8Array(base64DataUrl));
        }, "image/png");
      };
      img.src = base64DataUrl;
    });
  };

  const buildZipBlob = async (): Promise<Blob> => {
    const zip = new JSZip();
    Object.entries(files).forEach(([name, content]) => {
      if (name.includes("/")) {
        const parts = name.split("/");
        const folder = zip.folder(parts[0]);
        folder?.file(parts.slice(1).join("/"), content);
      } else {
        zip.file(name, content);
      }
    });

    const iconsFolder = zip.folder("icons")!;
    if (aiIconBase64) {
      const [icon16, icon48, icon128] = await Promise.all([
        resizeIcon(aiIconBase64, 16),
        resizeIcon(aiIconBase64, 48),
        resizeIcon(aiIconBase64, 128),
      ]);
      iconsFolder.file("icon16.png", icon16);
      iconsFolder.file("icon48.png", icon48);
      iconsFolder.file("icon128.png", icon128);
    } else {
      // Prefer theme-aware SVG-rendered PNGs when a theme/logoStyle is on the spec
      try {
        const { renderExtensionIcons } = await import("@/lib/extension-themes");
        const icons = await renderExtensionIcons(spec?.name || "Extension", (spec as any)?.theme, (spec as any)?.logoStyle);
        iconsFolder.file("icon16.png", icons["icons/icon16.png"]);
        iconsFolder.file("icon48.png", icons["icons/icon48.png"]);
        iconsFolder.file("icon128.png", icons["icons/icon128.png"]);
      } catch {
        const icons = generateExtensionIcons();
        iconsFolder.file("icon16.png", icons["icons/icon16.png"]);
        iconsFolder.file("icon48.png", icons["icons/icon48.png"]);
        iconsFolder.file("icon128.png", icons["icons/icon128.png"]);
      }
    }

    // Bundle browser compatibility report inside the ZIP for QA archives
    try {
      const manifest = files["manifest.json"] ? JSON.parse(files["manifest.json"]) : null;
      const compat = analyzeBrowserCompatibility(manifest, files);
      zip.file("BROWSER_COMPAT_REPORT.md", compatReportMarkdown(compat));
      zip.file("BROWSER_COMPAT_REPORT.json", JSON.stringify(compat, null, 2));
    } catch { /* non-fatal */ }

    return zip.generateAsync({ type: "blob" });
  };

  const handleDownload = async () => {
    // Preflight gate — block the download if the manifest fails compliance,
    // unless the user has ticked "Download anyway".
    const pre = preflight;
    if (pre && !pre.passed && !ackWarnings) {
      toast.error(`Preflight blocked · ${pre.blockers.length} issue${pre.blockers.length === 1 ? "" : "s"}`, {
        description: "Fix critical manifest issues or acknowledge to download anyway.",
      });
      void logSecurityEvent({
        eventType: "preflight_block",
        severity: "error",
        extensionName: spec?.name ?? null,
        passed: false,
        blockers: pre.blockers.length,
        warnings: pre.warnings.length,
        details: { blockers: pre.blockers.map(b => b.id), stage: "download" },
      });
      return;
    }
    const blob = await buildZipBlob();
    const zipName = spec?.name?.toLowerCase().replace(/\s+/g, "-") || "extension";
    saveAs(blob, `${zipName}.zip`);
    toast.success(cert?.productionReady ? "Production-ready package downloaded ✓" : "Extension package downloaded");
    void logSecurityEvent({
      eventType: pre?.passed ? "download" : "preflight_override",
      severity: pre?.passed ? "info" : "warning",
      extensionName: spec?.name ?? null,
      passed: pre?.passed ?? true,
      blockers: pre?.blockers.length ?? 0,
      warnings: pre?.warnings.length ?? 0,
      details: { sizeBytes: blob.size },
    });
  };

  const handleCertify = () => {
    if (Object.keys(files).length === 0) return;
    setCertifying(true);
    try {
      const { files: hardened, report } = certifyExtension(files);
      setFiles(hardened);
      sessionStorage.setItem("extension-files", JSON.stringify(hardened));
      setCert(report);
      toast.success(
        `Certified · Grade ${report.grade} (${report.score}/100) · ${report.hardening.autoFixesApplied.length} fixes, shield in ${report.hardening.errorShieldInjected.length} files`,
      );
      void logSecurityEvent({
        eventType: "certify",
        severity: report.productionReady ? "info" : "warning",
        extensionName: spec?.name ?? null,
        passed: report.productionReady,
        details: {
          grade: report.grade,
          score: report.score,
          autoFixes: report.hardening.autoFixesApplied.length,
          errorShields: report.hardening.errorShieldInjected.length,
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Certification failed");
    } finally {
      setCertifying(false);
    }
  };

  const handleAutoFix = () => {
    if (Object.keys(files).length === 0) return;
    setAutoFixing(true);
    try {
      const before = qaReport ? { errors: qaReport.errors, warnings: qaReport.warnings } : { errors: 0, warnings: 0 };
      const { files: fixed, fixes, report } = autoFixAndValidate(files);
      if (fixes.length === 0) {
        toast.info("Nothing to fix — bundle is already clean.");
        return;
      }
      setFiles(fixed);
      sessionStorage.setItem("extension-files", JSON.stringify(fixed));
      setLastFix({
        ranAt: Date.now(),
        fixes,
        before,
        after: { errors: report.errors, warnings: report.warnings },
      });
      setFixReportOpen(true);
      toast.success(
        `Applied ${fixes.length} fix${fixes.length === 1 ? "" : "es"} · ${report.errors} errors remaining`,
      );
      void logSecurityEvent({
        eventType: "autofix_applied",
        severity: "info",
        extensionName: spec?.name ?? null,
        blockers: report.errors,
        warnings: report.warnings,
        details: {
          fixesApplied: fixes.length,
          fixIds: Array.from(new Set(fixes.map(f => f.id))),
          before,
          after: { errors: report.errors, warnings: report.warnings },
        },
      });
    } finally {
      setAutoFixing(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1] ?? result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

  const handleCwsUpload = async () => {
    if (!cwsClientId || !cwsClientSecret || !cwsRefreshToken) {
      toast.error("Client ID, secret and refresh token are required");
      return;
    }
    // Preflight is mandatory for CWS uploads — the store will reject a
    // non-compliant manifest anyway, so block early and log the attempt.
    if (preflight && !preflight.passed) {
      toast.error(`Preflight blocked upload · ${preflight.blockers.length} manifest issue${preflight.blockers.length === 1 ? "" : "s"}`, {
        description: "Fix critical compliance issues before uploading to the Chrome Web Store.",
      });
      void logSecurityEvent({
        eventType: "preflight_block",
        severity: "error",
        extensionName: spec?.name ?? null,
        passed: false,
        blockers: preflight.blockers.length,
        warnings: preflight.warnings.length,
        details: { blockers: preflight.blockers.map(b => b.id), stage: "cws_upload" },
      });
      return;
    }
    setCwsUploading(true);
    setUploadStage({ step: "building", pct: 10, label: "Building extension package…" });
    try {
      const blob = await buildZipBlob();
      setUploadStage({ step: "encoding", pct: 30, label: `Encoding ${(blob.size / 1024).toFixed(1)} KB…` });
      const zipBase64 = await blobToBase64(blob);

      setUploadStage({ step: "authenticating", pct: 50, label: "Exchanging refresh token…" });
      // Small visual pause so the step is readable even on fast networks
      await new Promise(r => setTimeout(r, 150));

      setUploadStage({ step: "uploading", pct: 70, label: "Uploading to Chrome Web Store…" });
      const { data, error } = await supabase.functions.invoke("chrome-store-upload", {
        body: {
          zipBase64,
          clientId: cwsClientId,
          clientSecret: cwsClientSecret,
          refreshToken: cwsRefreshToken,
          extensionId: cwsExtensionId || undefined,
          publish: cwsPublish,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (cwsPublish) {
        setUploadStage({ step: "publishing", pct: 90, label: "Submitting for review…" });
        await new Promise(r => setTimeout(r, 200));
      }

      setUploadStage({ step: "done", pct: 100, label: cwsPublish ? "Submitted for review" : "Draft uploaded" });
      toast.success(
        cwsPublish
          ? "Uploaded and submitted to the Chrome Web Store!"
          : "Uploaded to the Chrome Web Store as a draft.",
      );
      if (data?.dashboardUrl) window.open(data.dashboardUrl, "_blank", "noopener");
      void logSecurityEvent({
        eventType: "cws_upload",
        severity: "info",
        extensionName: spec?.name ?? null,
        passed: true,
        warnings: preflight?.warnings.length ?? 0,
        details: { publish: cwsPublish, hasExtensionId: !!cwsExtensionId },
      });
    } catch (e: unknown) {
      console.error("CWS upload error:", e);
      const msg = e instanceof Error ? e.message : "Chrome Web Store upload failed";
      setUploadStage({ step: "error", pct: 0, label: msg });
      toast.error(msg);
      void logSecurityEvent({
        eventType: "cws_upload_failed",
        severity: "error",
        extensionName: spec?.name ?? null,
        passed: false,
        details: { message: msg, publish: cwsPublish },
      });
    } finally {
      setCwsUploading(false);
      // Auto-hide the bar a few seconds after completion
      setTimeout(() => setUploadStage(s => (s.step === "done" ? { step: "idle", pct: 0 } : s)), 4000);
    }
  };

  const fileList = Object.keys(files);
  const totalSize = Object.values(files).reduce((acc, f) => acc + new Blob([f]).size, 0);
  const totalLines = Object.values(files).reduce((acc, f) => acc + f.split("\n").length, 0);

  const qaReport = useMemo(() => {
    if (fileList.length === 0) return null;
    const withIcons: Record<string, string> = {
      ...files,
      "icons/icon16.png": files["icons/icon16.png"] ?? "<binary>",
      "icons/icon48.png": files["icons/icon48.png"] ?? "<binary>",
      "icons/icon128.png": files["icons/icon128.png"] ?? "<binary>",
    };
    return runPackageQA(withIcons);
  }, [files, fileList.length]);

  // Combined preflight compliance gate (structural QA + CWS manifest policy)
  const preflight = useMemo<PreflightResult | null>(() => {
    if (fileList.length === 0) return null;
    const withIcons: Record<string, string> = {
      ...files,
      "icons/icon16.png": files["icons/icon16.png"] ?? "<binary>",
      "icons/icon48.png": files["icons/icon48.png"] ?? "<binary>",
      "icons/icon128.png": files["icons/icon128.png"] ?? "<binary>",
    };
    return runPreflight(withIcons);
  }, [files, fileList.length]);

  const permissionRisk = useMemo<PermissionRiskReport | null>(() => {
    if (!files["manifest.json"]) return null;
    try { return analyzePermissionRisk(JSON.parse(files["manifest.json"])); }
    catch { return null; }
  }, [files]);

  // Group repeated fixes by id for a tidier report
  const groupedFixes = useMemo(() => {
    if (!lastFix) return [];
    const map = new Map<string, { id: string; label: string; details: string[]; count: number }>();
    for (const f of lastFix.fixes) {
      const existing = map.get(f.id);
      if (existing) {
        existing.count += 1;
        if (f.detail) existing.details.push(f.detail);
        else existing.details.push(f.label);
      } else {
        map.set(f.id, {
          id: f.id,
          label: f.label.replace(/ in [^ ]+$|from [^ ]+$/, "").trim() || f.label,
          details: [f.detail ?? f.label],
          count: 1,
        });
      }
    }
    return Array.from(map.values());
  }, [lastFix]);

  const sevIcon = (sev: QASeverity, passed: boolean) => {
    if (passed) return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (sev === "error") return <XCircle className="h-4 w-4 text-destructive" />;
    if (sev === "warning") return <AlertTriangle className="h-4 w-4 text-warning" />;
    return <Info className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              Package Extension
            </h1>
            <p className="text-muted-foreground mt-1">Build and download your extension as a .zip package</p>
          </div>
          {files["manifest.json"] && (() => {
            let m: Record<string, unknown> | null = null;
            try { m = JSON.parse(files["manifest.json"]); } catch { m = null; }
            return <CompatScoreBadge manifest={m} files={files} />;
          })()}
        </div>
      </motion.div>

      {fileList.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-semibold mb-1">No Extension To Package</h2>
          <p className="text-sm text-muted-foreground">Generate an extension first</p>
        </div>
      ) : (
        <>
          {spec && (
            <div className="rounded-xl border border-primary/20 bg-card p-5 glow-primary">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold text-lg truncate">{spec.name}</h2>
                    {cert && (
                      <Badge
                        variant={cert.productionReady ? "default" : "destructive"}
                        className={`font-mono text-[10px] ${cert.productionReady ? "bg-success/20 text-success border-success/40" : ""}`}
                      >
                        {cert.productionReady ? `✓ PRODUCTION READY · ${cert.grade}` : `${cert.grade} · needs review`}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{spec.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={generateAIIcons}
                    disabled={generatingIcons}
                    className="border-primary/30"
                  >
                    {generatingIcons ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    {generatingIcons ? "Generating..." : "AI Icons"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCertify}
                    disabled={certifying}
                    className="border-success/30 text-success hover:bg-success/10"
                  >
                    {certifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                    Certify &amp; Harden
                  </Button>
                  <Button
                    onClick={handleDownload}
                    disabled={(!!qaReport && qaReport.errors > 0 && !ackWarnings) || (!!preflight && !preflight.passed && !ackWarnings)}
                    className="bg-gradient-cyber text-primary-foreground"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download .zip
                  </Button>
                </div>
              </div>
              {qaReport && qaReport.errors > 0 && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                  <p className="text-xs text-warning flex-1">
                    {qaReport.errors} critical issue{qaReport.errors === 1 ? "" : "s"} detected. Run <b>Certify &amp; Harden</b> to auto-fix, or acknowledge to download anyway.
                  </p>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ackWarnings}
                      onChange={e => setAckWarnings(e.target.checked)}
                      className="h-3.5 w-3.5"
                    />
                    Download anyway
                  </label>
                </div>
              )}
            </div>
          )}

          {qaReport && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`h-5 w-5 ${qaReport.chromeReady ? "text-success" : "text-warning"}`} />
                  <div>
                    <h3 className="text-sm font-semibold">Packaging QA — Chrome MV3 Validation</h3>
                    <p className="text-xs text-muted-foreground">
                      {qaReport.checks.length} checks · {qaReport.errors} errors · {qaReport.warnings} warnings
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(qaReport.errors > 0 || qaReport.warnings > 0) && (
                    <Button size="sm" variant="outline" onClick={handleAutoFix} disabled={autoFixing}>
                      {autoFixing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1.5" />}
                      Auto-Fix
                    </Button>
                  )}
                  <Badge variant={qaReport.chromeReady ? "default" : "destructive"} className="font-mono text-[10px]">
                    {qaReport.chromeReady ? "CHROME READY" : "NOT READY"}
                  </Badge>
                </div>
              </div>
              <div className="divide-y divide-border">
                {qaReport.checks.map(c => (
                  <div key={c.id} className="px-5 py-2.5 flex items-start gap-3">
                    {sevIcon(c.severity, c.passed)}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${c.passed ? "text-foreground" : "font-medium"}`}>{c.label}</p>
                      {!c.passed && c.detail && (
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono break-all">{c.detail}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-mono uppercase">{c.severity}</Badge>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Permission & Host-Origin Risk */}
          {permissionRisk && (
            <PermissionRiskPanel
              report={permissionRisk}
              onApplyFix={(finding) => {
                try {
                  const m = JSON.parse(files["manifest.json"]);
                  const safety = checkAutoFixSafety(m, finding.autoFix!.action, files);
                  if (!safety.safe) {
                    toast.error(`Safety check blocked: ${safety.issues[0]?.message ?? "unsafe fix"}`);
                    return;
                  }
                  if (safety.issues.length) {
                    toast.warning(safety.issues.map((i) => i.message).join(" • "));
                  }
                  const next = applyAutoFix(m, finding.autoFix!.action);
                  setFiles({ ...files, "manifest.json": JSON.stringify(next, null, 2) });
                  toast.success(finding.autoFix!.label);
                } catch (e) {
                  toast.error("Could not apply fix — manifest.json is invalid JSON.");
                }
              }}
              onApplyAll={() => {
                try {
                  const m = JSON.parse(files["manifest.json"]);
                  const { manifest: next, applied, skipped } = applyAllAutoFixes(m, permissionRisk, { files });
                  if (applied.length === 0 && skipped.length === 0) { toast.info("No auto-fixable findings."); return; }
                  if (applied.length) {
                    setFiles({ ...files, "manifest.json": JSON.stringify(next, null, 2) });
                    toast.success(`Applied ${applied.length} auto-fix${applied.length === 1 ? "" : "es"}.`);
                  }
                  if (skipped.length) {
                    toast.warning(`Skipped ${skipped.length} unsafe fix${skipped.length === 1 ? "" : "es"}: ${skipped.map(s => s.label).join(", ")}`);
                  }
                } catch {
                  toast.error("Could not auto-fix — manifest.json is invalid JSON.");
                }
              }}
            />
          )}

          {/* Browser Compatibility */}
          {files["manifest.json"] && (() => {
            let m: Record<string, unknown> | null = null;
            try { m = JSON.parse(files["manifest.json"]); } catch { m = null; }
            return <BrowserCompatPanel manifest={m} files={files} onFilesChange={setFiles} />;
          })()}





          {/* Auto-Fix Report */}
          <AnimatePresence>
            {lastFix && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-primary/20 bg-card overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setFixReportOpen(o => !o)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition"
                >
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <h3 className="text-sm font-semibold">Auto-Fix Report</h3>
                      <p className="text-xs text-muted-foreground">
                        {lastFix.fixes.length} fix{lastFix.fixes.length === 1 ? "" : "es"} applied ·
                        {" "}errors {lastFix.before.errors} → <span className="text-success">{lastFix.after.errors}</span> ·
                        {" "}warnings {lastFix.before.warnings} → <span className="text-success">{lastFix.after.warnings}</span>
                      </p>
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${fixReportOpen ? "rotate-180" : ""}`} />
                </button>
                {fixReportOpen && (
                  <div className="px-5 py-4 border-t border-border space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Stat label="Fixes" value={lastFix.fixes.length} tone="primary" />
                      <Stat label="Errors fixed" value={Math.max(0, lastFix.before.errors - lastFix.after.errors)} tone="success" />
                      <Stat label="Warnings fixed" value={Math.max(0, lastFix.before.warnings - lastFix.after.warnings)} tone="success" />
                      <Stat label="Remaining" value={lastFix.after.errors + lastFix.after.warnings} tone={lastFix.after.errors > 0 ? "danger" : "muted"} />
                    </div>
                    <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
                      {groupedFixes.map(g => (
                        <div key={g.id} className="px-4 py-2.5 flex items-start gap-3">
                          <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{g.label}</p>
                              {g.count > 1 && (
                                <Badge variant="secondary" className="text-[10px] font-mono">×{g.count}</Badge>
                              )}
                            </div>
                            {g.details.length > 0 && (
                              <ul className="mt-1 space-y-0.5">
                                {g.details.slice(0, 5).map((d, i) => (
                                  <li key={i} className="text-xs text-muted-foreground font-mono break-all">• {d}</li>
                                ))}
                                {g.details.length > 5 && (
                                  <li className="text-xs text-muted-foreground italic">…and {g.details.length - 5} more</li>
                                )}
                              </ul>
                            )}
                          </div>
                          <Badge variant="outline" className="text-[10px] font-mono uppercase">{g.id}</Badge>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <p className="text-xs text-muted-foreground">
                        Ran {new Date(lastFix.ranAt).toLocaleTimeString()}
                      </p>
                      <Button variant="ghost" size="sm" onClick={() => setLastFix(null)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Dismiss
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chrome Web Store Upload */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setCwsOpen(o => !o)}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition"
            >
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <h3 className="text-sm font-semibold">Publish to Chrome Web Store</h3>
                  <p className="text-xs text-muted-foreground">Upload via the official CWS API using your OAuth credentials</p>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px] font-mono">
                {cwsOpen ? "HIDE" : "SETUP"}
              </Badge>
            </button>

            {cwsOpen && (
              <div className="px-5 py-4 border-t border-border space-y-4">
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">One-time Google Cloud setup:</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Pay the $5 Chrome Web Store developer fee.</li>
                    <li>Create an OAuth 2.0 Client (type: Desktop) in Google Cloud Console.</li>
                    <li>Enable the <span className="font-mono">Chrome Web Store API</span>.</li>
                    <li>Generate a refresh token (scope <span className="font-mono">https://www.googleapis.com/auth/chromewebstore</span>).</li>
                  </ol>
                </div>

                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs space-y-1.5">
                  <p className="font-medium text-foreground flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-primary" /> Credential handling
                  </p>
                  <ul className="space-y-0.5 text-muted-foreground list-disc list-inside">
                    <li>Credentials are sent <strong>only</strong> to the upload edge function over HTTPS — they are never logged or persisted server-side.</li>
                    <li>In the browser they live in <strong>sessionStorage</strong> (cleared when this tab closes) and only when "Remember for this session" is on.</li>
                    <li>We never write your refresh token to localStorage, cookies, or the URL.</li>
                    {cwsLoadedFromSession && (
                      <li className="text-primary">Loaded from this tab's session. Clear at any time.</li>
                    )}
                  </ul>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cws-client-id" className="text-xs">Client ID</Label>
                    <Input id="cws-client-id" autoComplete="off" value={cwsClientId} onChange={e => setCwsClientId(e.target.value)} placeholder="xxxx.apps.googleusercontent.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cws-client-secret" className="text-xs">Client Secret</Label>
                    <Input id="cws-client-secret" type="password" autoComplete="new-password" value={cwsClientSecret} onChange={e => setCwsClientSecret(e.target.value)} placeholder="GOCSPX-…" />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="cws-refresh" className="text-xs">Refresh Token</Label>
                    <Input id="cws-refresh" type="password" autoComplete="new-password" value={cwsRefreshToken} onChange={e => setCwsRefreshToken(e.target.value)} placeholder="1//0g…" />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="cws-ext-id" className="text-xs">Extension ID <span className="text-muted-foreground">(leave blank to create a new draft)</span></Label>
                    <Input id="cws-ext-id" autoComplete="off" value={cwsExtensionId} onChange={e => setCwsExtensionId(e.target.value)} placeholder="32-character item id" />
                  </div>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Switch id="cws-remember" checked={cwsRemember} onCheckedChange={setCwsRemember} />
                      <Label htmlFor="cws-remember" className="text-sm cursor-pointer">
                        Remember for this session
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="cws-publish" checked={cwsPublish} onCheckedChange={setCwsPublish} />
                      <Label htmlFor="cws-publish" className="text-sm cursor-pointer">
                        Submit for review after upload
                      </Label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(cwsClientId || cwsClientSecret || cwsRefreshToken || cwsExtensionId) && (
                      <Button variant="ghost" size="sm" onClick={clearCwsCreds} disabled={cwsUploading}>
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear
                      </Button>
                    )}
                    <Button
                      onClick={handleCwsUpload}
                      disabled={cwsUploading || (!!qaReport && !qaReport.chromeReady)}
                      className="bg-gradient-cyber text-primary-foreground"
                    >
                      {cwsUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      {cwsUploading ? "Uploading…" : cwsPublish ? "Upload & Submit" : "Upload Draft"}
                    </Button>
                  </div>
                </div>

                {/* Upload progress */}
                <AnimatePresence>
                  {uploadStage.step !== "idle" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2 mt-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium flex items-center gap-1.5">
                            {uploadStage.step === "done" ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                            ) : uploadStage.step === "error" ? (
                              <XCircle className="h-3.5 w-3.5 text-destructive" />
                            ) : (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                            )}
                            {"label" in uploadStage ? uploadStage.label : ""}
                          </span>
                          <span className="font-mono text-muted-foreground">{uploadStage.pct}%</span>
                        </div>
                        <Progress
                          value={uploadStage.pct}
                          className={uploadStage.step === "error" ? "[&>div]:bg-destructive" : ""}
                        />
                        <div className="flex justify-between text-[10px] font-mono uppercase text-muted-foreground">
                          {(["building", "encoding", "authenticating", "uploading", cwsPublish ? "publishing" : "done"] as const).map(step => {
                            const order = ["building", "encoding", "authenticating", "uploading", "publishing", "done"];
                            const currentIdx = order.indexOf(uploadStage.step);
                            const stepIdx = order.indexOf(step);
                            const reached = currentIdx >= stepIdx || uploadStage.step === "done";
                            return (
                              <span key={step} className={reached ? "text-primary" : ""}>
                                {step === "done" ? "complete" : step}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {qaReport && !qaReport.chromeReady && (
                  <p className="text-xs text-warning flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Resolve QA errors before uploading — Chrome will reject the package.
                  </p>
                )}
              </div>
            )}
          </motion.div>

          {/* AI Icon Preview */}
          {aiIconBase64 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl border border-primary/20 bg-card p-5"
            >
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Image className="h-4 w-4 text-primary" />
                AI-Generated Icons
              </h3>
              <div className="flex items-end gap-6">
                <div className="text-center">
                  <div className="rounded-lg border border-border bg-muted/50 p-2 inline-block mb-1">
                    <img src={aiIconBase64} alt="Icon 128" className="w-32 h-32 object-contain" />
                  </div>
                  <p className="text-xs text-muted-foreground">128×128</p>
                </div>
                <div className="text-center">
                  <div className="rounded-lg border border-border bg-muted/50 p-2 inline-block mb-1">
                    <img src={aiIconBase64} alt="Icon 48" className="w-12 h-12 object-contain" />
                  </div>
                  <p className="text-xs text-muted-foreground">48×48</p>
                </div>
                <div className="text-center">
                  <div className="rounded-lg border border-border bg-muted/50 p-2 inline-block mb-1">
                    <img src={aiIconBase64} alt="Icon 16" className="w-4 h-4 object-contain" />
                  </div>
                  <p className="text-xs text-muted-foreground">16×16</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="ghost" size="sm" onClick={generateAIIcons} disabled={generatingIcons}>
                  {generatingIcons ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  Regenerate
                </Button>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <FileArchive className="h-5 w-5 text-primary mb-2" />
              <p className="text-2xl font-bold font-mono">{fileList.length}</p>
              <p className="text-sm text-muted-foreground">Files</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <FolderTree className="h-5 w-5 text-primary mb-2" />
              <p className="text-2xl font-bold font-mono">{totalLines}</p>
              <p className="text-sm text-muted-foreground">Lines of code</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <Package className="h-5 w-5 text-primary mb-2" />
              <p className="text-2xl font-bold font-mono">{(totalSize / 1024).toFixed(1)} KB</p>
              <p className="text-sm text-muted-foreground">Package size</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">Package Contents</h3>
            </div>
            <div className="divide-y divide-border">
              {fileList.map(name => (
                <div key={name} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-mono">{name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {files[name].split("\n").length} lines
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {(new Blob([files[name]]).size / 1024).toFixed(1)} KB
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "primary" | "success" | "danger" | "muted" }) {
  const toneClass = {
    primary: "text-primary",
    success: "text-success",
    danger: "text-destructive",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <div className="rounded-md border border-border bg-muted/20 p-2.5">
      <p className={`text-xl font-bold font-mono ${toneClass}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Permission & Host-Origin Risk Panel ────────────────────────────────────
const RISK_STYLES: Record<RiskLevel, { badge: string; icon: string; label: string }> = {
  critical: { badge: "bg-destructive/20 text-destructive border-destructive/40", icon: "🛑", label: "CRITICAL" },
  high:     { badge: "bg-destructive/10 text-destructive border-destructive/30", icon: "❌", label: "HIGH" },
  medium:   { badge: "bg-warning/15 text-warning border-warning/30",             icon: "⚠️", label: "MEDIUM" },
  low:      { badge: "bg-muted text-muted-foreground border-border",             icon: "ℹ️", label: "LOW" },
};

function PermissionRiskPanel({
  report,
  onApplyFix,
  onApplyAll,
}: {
  report: PermissionRiskReport;
  onApplyFix: (finding: PermissionFinding) => void;
  onApplyAll: () => void;
}) {
  const clean = report.findings.length === 0;
  const headline = RISK_STYLES[report.highestRisk];
  const fixableCount = report.findings.filter((f) => f.autoFix).length;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Lock className={`h-5 w-5 ${clean ? "text-success" : "text-warning"}`} />
          <div>
            <h3 className="text-sm font-semibold">Permission &amp; Host-Origin Risk</h3>
            <p className="text-xs text-muted-foreground">{report.summary}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-[10px]">
            Safety {report.score}/100
          </Badge>
          <Badge className={`font-mono text-[10px] border ${headline.badge}`}>
            {clean ? "✓ CLEAN" : headline.label}
          </Badge>
          {fixableCount > 0 && (
            <Button size="sm" variant="secondary" onClick={onApplyAll} className="h-7 gap-1.5">
              <Wand2 className="h-3.5 w-3.5" />
              Auto-Fix All ({fixableCount})
            </Button>
          )}
        </div>
      </div>

      {clean ? (
        <div className="px-5 py-6 flex items-center gap-3 text-sm text-muted-foreground">
          <CheckCircle2 className="h-5 w-5 text-success" />
          No excessive permissions or overly broad host patterns detected.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {report.findings.map((f, i) => {
            const s = RISK_STYLES[f.risk];
            return (
              <div key={`${f.permission}-${i}`} className="px-5 py-3 flex items-start gap-3">
                <span className="text-lg leading-none pt-0.5" aria-hidden>{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs font-mono px-1.5 py-0.5 rounded bg-muted break-all">{f.permission}</code>
                    <Badge className={`text-[10px] font-mono border ${s.badge}`}>{s.label}</Badge>
                    <Badge variant="outline" className="text-[10px] font-mono uppercase">{f.kind}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{f.reason}</p>
                  <p className="text-xs mt-1">
                    <span className="text-success font-semibold">Suggestion:</span>{" "}
                    <span className="text-foreground">{f.suggestion}</span>
                  </p>
                  {f.autoFix && (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => onApplyFix(f)}
                      >
                        <Wand2 className="h-3 w-3" />
                        {f.autoFix.label}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
