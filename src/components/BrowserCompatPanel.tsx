import { useMemo, useState } from "react";
import { Globe, CheckCircle2, AlertTriangle, XCircle, Download, Info, Wand2, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import {
  analyzeBrowserCompatibility,
  applyCompatFix,
  compatReportMarkdown,
  type BrowserId,
  type CompatFinding,
  type CompatReport,
  type CompatSeverity,
  type CompatStatus,
} from "@/lib/browser-compat";

interface Props {
  manifest: Record<string, unknown> | null;
  files: Record<string, string>;
  onFilesChange?: (files: Record<string, string>) => void;
  compact?: boolean; // if true, render only the score badge
}

const STATUS_STYLES: Record<CompatStatus, string> = {
  supported: "text-success",
  partial: "text-warning",
  unsupported: "text-destructive",
  unknown: "text-muted-foreground",
};

const STATUS_ICON: Record<CompatStatus, string> = {
  supported: "✓",
  partial: "◐",
  unsupported: "✗",
  unknown: "?",
};

const SEVERITY_ORDER: CompatSeverity[] = ["error", "warning", "info"];

export function CompatScoreBadge({ manifest, files }: { manifest: Record<string, unknown> | null; files: Record<string, string> }) {
  const report = useMemo(() => analyzeBrowserCompatibility(manifest, files), [manifest, files]);
  const tone = report.overallVerdict === "ready" ? "text-success border-success/40 bg-success/10"
    : report.overallVerdict === "review" ? "text-warning border-warning/40 bg-warning/10"
    : "text-destructive border-destructive/40 bg-destructive/10";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-mono ${tone}`} title={`${report.summary.errors} errors · ${report.summary.warnings} warnings`}>
      <Globe className="h-3.5 w-3.5" />
      <span className="font-semibold">{report.overallScore}</span>
      <span className="opacity-70">/100</span>
      <span className="opacity-80">· {report.overallVerdict}</span>
    </span>
  );
}

export function BrowserCompatPanel({ manifest, files, onFilesChange, compact }: Props) {
  const report: CompatReport = useMemo(
    () => analyzeBrowserCompatibility(manifest, files),
    [manifest, files]
  );

  const [severityFilter, setSeverityFilter] = useState<CompatSeverity | "all">("all");
  const [browserFilter, setBrowserFilter] = useState<BrowserId | "all">("all");
  const [autoFixOnly, setAutoFixOnly] = useState(false);

  const filtered: CompatFinding[] = useMemo(() => {
    return report.findings.filter((f) => {
      if (severityFilter !== "all" && f.severity !== severityFilter) return false;
      if (autoFixOnly && !f.autoFix) return false;
      if (browserFilter !== "all") {
        const s = f.support.find((x) => x.browser === browserFilter);
        if (!s || s.status === "supported") return false;
      }
      return true;
    }).sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
  }, [report, severityFilter, browserFilter, autoFixOnly]);

  const fixableCount = report.findings.filter((f) => f.autoFix).length;

  const applyFix = (f: CompatFinding) => {
    if (!f.autoFix || !onFilesChange) return;
    const result = applyCompatFix(f.autoFix.id, files);
    onFilesChange(result.files);
    if (result.changed.length) toast.success(result.message);
    else toast.info(result.message);
  };

  const applyAllFixes = () => {
    if (!onFilesChange) return;
    let current = files;
    const applied: string[] = [];
    for (const f of report.findings) {
      if (!f.autoFix) continue;
      const r = applyCompatFix(f.autoFix.id, current);
      if (r.changed.length) { current = r.files; applied.push(f.autoFix.label); }
    }
    if (applied.length) {
      onFilesChange(current);
      toast.success(`Applied ${applied.length} browser compat fix${applied.length === 1 ? "" : "es"}.`);
    } else toast.info("No auto-fixes to apply.");
  };

  const exportMd = () => {
    saveAs(new Blob([compatReportMarkdown(report)], { type: "text/markdown" }), "BROWSER_COMPAT_REPORT.md");
  };
  const exportJson = () => {
    saveAs(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }), "BROWSER_COMPAT_REPORT.json");
  };

  if (compact) {
    return <CompatScoreBadge manifest={manifest} files={files} />;
  }

  const overallTone = report.overallVerdict === "ready" ? "text-success" : report.overallVerdict === "review" ? "text-warning" : "text-destructive";

  return (
    <div className="rounded-xl border border-primary/20 bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Browser Compatibility
              <span className={`text-lg font-bold ${overallTone}`}>{report.overallScore}</span>
              <span className="text-[10px] text-muted-foreground">/100</span>
              <Badge variant="secondary" className="text-[10px]">{report.overallVerdict}</Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              {report.summary.errors} errors · {report.summary.warnings} warnings · {report.summary.infos} info · {report.summary.checkedFiles} files scanned
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {fixableCount > 0 && onFilesChange && (
            <Button size="sm" variant="default" onClick={applyAllFixes}>
              <Wand2 className="h-3.5 w-3.5 mr-1" /> Auto-fix all ({fixableCount})
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={exportMd}>
            <Download className="h-3.5 w-3.5 mr-1" /> MD
          </Button>
          <Button size="sm" variant="outline" onClick={exportJson}>
            <Download className="h-3.5 w-3.5 mr-1" /> JSON
          </Button>
        </div>
      </div>

      {/* Per-browser scorecards — clickable filters */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 p-4 bg-muted/20">
        {report.browsers.map((b) => {
          const tone = b.verdict === "ready" ? "text-success" : b.verdict === "review" ? "text-warning" : "text-destructive";
          const Icon = b.verdict === "ready" ? CheckCircle2 : b.verdict === "review" ? AlertTriangle : XCircle;
          const active = browserFilter === b.browser;
          return (
            <button
              key={b.browser}
              type="button"
              onClick={() => setBrowserFilter(active ? "all" : b.browser)}
              className={`text-left rounded-lg border p-3 transition ${active ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/40"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">{b.label}</span>
                <Icon className={`h-4 w-4 ${tone}`} />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`text-lg font-bold ${tone}`}>{b.score}</span>
                <span className="text-[10px] text-muted-foreground">/100</span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {b.errors}E · {b.warnings}W · {b.verdict}
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-5 py-3 border-y border-border bg-muted/10 flex-wrap">
        <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Severity</span>
        {(["all", "error", "warning", "info"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSeverityFilter(s)}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition ${severityFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}
          >
            {s}
          </button>
        ))}
        <span className="mx-2 h-4 w-px bg-border" />
        <button
          type="button"
          onClick={() => setAutoFixOnly((v) => !v)}
          className={`text-[11px] px-2 py-0.5 rounded-full border transition ${autoFixOnly ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}
        >
          Auto-fixable only
        </button>
        {browserFilter !== "all" && (
          <button
            type="button"
            onClick={() => setBrowserFilter("all")}
            className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
          >
            Clear browser filter ({browserFilter}) ✕
          </button>
        )}
      </div>

      {/* Findings */}
      <div className="divide-y divide-border">
        {filtered.length === 0 && (
          <div className="px-5 py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            {report.findings.length === 0
              ? "No cross-browser compatibility issues detected."
              : "No findings match the current filter."}
          </div>
        )}
        {filtered.map((f) => (
          <div key={f.id} className="px-5 py-4 space-y-2">
            <div className="flex items-start gap-2">
              {f.severity === "error" ? (
                <XCircle className="h-4 w-4 text-destructive mt-0.5" />
              ) : f.severity === "warning" ? (
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
              ) : (
                <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{f.title}</p>
                  <Badge variant="secondary" className="text-[10px]">{f.category}</Badge>
                  {f.location && (
                    <code className="text-[10px] font-mono text-muted-foreground">{f.location}</code>
                  )}
                  {f.autoFix && (
                    <Badge className="text-[10px] bg-primary/20 text-primary border border-primary/40">
                      auto-fix available
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{f.detail}</p>
                {f.suggestion && (
                  <p className="text-xs text-primary mt-1">💡 {f.suggestion}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {f.support.map((s) => (
                    <span
                      key={s.browser}
                      className="text-[11px] font-mono px-2 py-0.5 rounded border border-border bg-muted/40"
                      title={s.note}
                    >
                      <span className={STATUS_STYLES[s.status]}>{STATUS_ICON[s.status]}</span>{" "}
                      {s.browser}
                    </span>
                  ))}
                </div>
                {f.autoFix && onFilesChange && (
                  <div className="mt-3 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                    <Wand2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{f.autoFix.label}</p>
                      <p className="text-[11px] text-muted-foreground">{f.autoFix.description}</p>
                    </div>
                    <Button size="sm" variant="default" onClick={() => applyFix(f)}>
                      Apply fix
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
