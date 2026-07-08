import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, AlertTriangle, XCircle, Info, Download, RefreshCw, Wand2, FileWarning, PlayCircle, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { runCertification, renderCertMarkdown, simulateRuntime, type CertReport, type CertIssue, type RuntimeResult } from "@/lib/certification";
import { runAutoFixLoop, type AutoFixStep } from "@/lib/certification/autofix-loop";
import { logSecurityEvent } from "@/lib/security-audit-log";

function loadFiles(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem("extension-files");
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function bandColor(band: CertReport["passProbability"]): string {
  return band === "High" ? "text-emerald-500" : band === "Medium" ? "text-amber-500" : "text-red-500";
}

function severityIcon(sev: CertIssue["severity"]) {
  if (sev === "critical") return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
  if (sev === "warning") return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
  return <Info className="h-4 w-4 text-blue-400 shrink-0" />;
}

export default function CertifyExtension() {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [report, setReport] = useState<CertReport | null>(null);
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [autoFixing, setAutoFixing] = useState(false);
  const [autoFixSteps, setAutoFixSteps] = useState<AutoFixStep[]>([]);
  const [runtime, setRuntime] = useState<RuntimeResult | null>(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    const f = loadFiles();
    setFiles(f);
    if (Object.keys(f).length) run(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (f: Record<string, string> = files) => {
    if (!Object.keys(f).length) {
      toast.error("No extension loaded. Generate one first.");
      return;
    }
    setRunning(true);
    try {
      const r = runCertification(f);
      setReport(r);
      await logSecurityEvent({
        eventType: r.criticals === 0 ? "preflight_pass" : "preflight_block",
        severity: r.criticals === 0 ? "info" : "warning",
        passed: r.criticals === 0,
        blockers: r.criticals,
        warnings: r.warnings,
        details: { overall: r.overall, passBand: r.passProbability, source: "certify" },
      });
    } finally {
      setRunning(false);
    }
  };

  const filtered = useMemo(() => {
    if (!report) return [];
    const q = query.toLowerCase();
    if (!q) return report.issues;
    return report.issues.filter(i =>
      i.file.toLowerCase().includes(q) ||
      i.message.toLowerCase().includes(q) ||
      i.category.includes(q) ||
      i.id.includes(q),
    );
  }, [report, query]);

  const exportMarkdown = () => {
    if (!report) return;
    const blob = new Blob([renderCertMarkdown(report)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `certification-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const autoFixStub = () => {
    toast.info("AI Auto-Fix ships in Phase 2 — it will rewrite offending files with an AI loop and re-run all checks.");
  };

  const empty = !Object.keys(files).length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Certification & CWS Readiness
          </h1>
          <p className="text-muted-foreground mt-1">
            Proves the extension is production-ready before you ship. Automated readiness estimate — Google's review still includes human judgment.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => run()} disabled={running || empty}>
            <RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />Re-run
          </Button>
          <Button variant="outline" size="sm" onClick={exportMarkdown} disabled={!report}>
            <Download className="h-4 w-4 mr-2" />Export Report
          </Button>
          <Button size="sm" onClick={autoFixStub} disabled={!report || report.criticals + report.warnings === 0}>
            <Wand2 className="h-4 w-4 mr-2" />AI Auto-Fix
          </Button>
        </div>
      </div>

      {empty && (
        <Card>
          <CardContent className="p-10 text-center space-y-2">
            <FileWarning className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-lg font-medium">No extension loaded</p>
            <p className="text-muted-foreground">Create or open an extension, then return to this page.</p>
          </CardContent>
        </Card>
      )}

      {report && (
        <>
          {/* Readiness gauge */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Overall Readiness</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-6xl font-bold tracking-tight">{report.overall}<span className="text-2xl text-muted-foreground">/100</span></div>
                <Progress value={report.overall} className="mt-3" />
                <div className="flex items-center gap-2 mt-4">
                  <span className="text-sm text-muted-foreground">CWS Pass Probability:</span>
                  <span className={`font-semibold ${bandColor(report.passProbability)}`}>{report.passProbability}</span>
                </div>
                <div className="flex gap-4 mt-3 text-sm">
                  <span className="text-red-500">{report.criticals} critical</span>
                  <span className="text-amber-500">{report.warnings} warnings</span>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.categories.map(c => (
                  <div key={c.key}>
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="font-medium">{c.label}</span>
                      <span className="text-muted-foreground">
                        {c.score}/100 · weight {c.weight}
                        {c.critical > 0 && <span className="ml-2 text-red-500">{c.critical} crit</span>}
                        {c.warning > 0 && <span className="ml-2 text-amber-500">{c.warning} warn</span>}
                      </span>
                    </div>
                    <Progress value={c.score} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Issues table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Issues ({report.issues.length})</CardTitle>
              <Input
                placeholder="Filter by file, message, category…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="max-w-xs"
              />
            </CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No issues match your filter.</p>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filtered.map((i, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-md border border-border bg-card/50">
                      {severityIcon(i.severity)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">{i.category}</Badge>
                          <code className="text-xs text-muted-foreground">
                            {i.file}{i.line ? `:${i.line}` : ""}
                          </code>
                          <span className="text-xs text-muted-foreground">· {i.id}</span>
                        </div>
                        <p className="text-sm mt-1">{i.message}</p>
                        <p className="text-xs text-muted-foreground mt-1"><strong>Fix:</strong> {i.fix}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
