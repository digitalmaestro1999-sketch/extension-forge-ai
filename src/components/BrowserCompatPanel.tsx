import { useMemo } from "react";
import { Globe, CheckCircle2, AlertTriangle, XCircle, Download, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { saveAs } from "file-saver";
import {
  analyzeBrowserCompatibility,
  compatReportMarkdown,
  type CompatReport,
  type CompatStatus,
} from "@/lib/browser-compat";

interface Props {
  manifest: Record<string, unknown> | null;
  files: Record<string, string>;
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

export function BrowserCompatPanel({ manifest, files }: Props) {
  const report: CompatReport = useMemo(
    () => analyzeBrowserCompatibility(manifest, files),
    [manifest, files]
  );

  const exportMd = () => {
    const md = compatReportMarkdown(report);
    saveAs(new Blob([md], { type: "text/markdown" }), "BROWSER_COMPAT_REPORT.md");
  };
  const exportJson = () => {
    saveAs(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }), "BROWSER_COMPAT_REPORT.json");
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-semibold">Browser Compatibility</h3>
            <p className="text-xs text-muted-foreground">
              {report.summary.errors} errors · {report.summary.warnings} warnings · {report.summary.infos} info · {report.summary.checkedFiles} files scanned
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportMd}>
            <Download className="h-3.5 w-3.5 mr-1" /> MD
          </Button>
          <Button size="sm" variant="outline" onClick={exportJson}>
            <Download className="h-3.5 w-3.5 mr-1" /> JSON
          </Button>
        </div>
      </div>

      {/* Per-browser scorecards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 p-4 bg-muted/20">
        {report.browsers.map((b) => {
          const tone = b.verdict === "ready" ? "text-success" : b.verdict === "review" ? "text-warning" : "text-destructive";
          const Icon = b.verdict === "ready" ? CheckCircle2 : b.verdict === "review" ? AlertTriangle : XCircle;
          return (
            <div key={b.browser} className="rounded-lg border border-border bg-background p-3">
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
            </div>
          );
        })}
      </div>

      {/* Findings */}
      <div className="divide-y divide-border">
        {report.findings.length === 0 && (
          <div className="px-5 py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            No cross-browser compatibility issues detected.
          </div>
        )}
        {report.findings.map((f) => (
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
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
