import { useCallback, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import {
  Brain, Upload, Loader2, ShieldAlert, Timer, Package as PackageIcon,
  FolderTree, FileCode2, Sparkles, Wand2, Download, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  scanZip, scanFileList, planRename, applyRename, exportScan, renderMarkdownReport,
  type ProjectScan, type FolderNode, type RenamePlan, type ScanProgress,
} from "@/lib/project-intel";

function ScoreRing({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? "text-emerald-400" : value >= 60 ? "text-amber-400" : "text-rose-400";
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card/50 p-3">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <Progress value={value} className="h-1 w-full" />
    </div>
  );
}

function FolderTreeView({ node, depth = 0 }: { node: FolderNode; depth?: number }) {
  const children = Object.values(node.children).sort((a, b) => b.files - a.files);
  return (
    <div style={{ marginLeft: depth * 12 }}>
      {node.name !== "root" && (
        <div className="flex items-center gap-2 py-0.5 text-xs">
          <FolderTree className="h-3 w-3 text-primary" />
          <span className="font-medium">{node.name}</span>
          <span className="text-muted-foreground">({node.files})</span>
          {node.empty && <Badge variant="outline" className="h-4 text-[9px]">empty</Badge>}
          {node.purpose && <span className="ml-auto text-[10px] text-muted-foreground">{node.purpose}</span>}
        </div>
      )}
      {children.map((c) => <FolderTreeView key={c.path} node={c} depth={depth + 1} />)}
    </div>
  );
}

type LogEntry = { t: number; phase: ScanProgress["phase"]; msg: string };

export default function SoftwareIntelligence() {
  const [scan, setScan] = useState<ProjectScan | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [renameFrom, setRenameFrom] = useState("");
  const [renameTo, setRenameTo] = useState("");
  const [plan, setPlan] = useState<RenamePlan | null>(null);
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const logStartRef = useRef<number>(0);
  const logScrollRef = useRef<HTMLDivElement>(null);

  const onProgress = useCallback((p: ScanProgress) => {
    setProgress(p);
    setLogs((prev) => {
      const msg = `${p.currentFile ?? "—"}${p.detail ? "  " + p.detail : ""}`;
      const next = [...prev, { t: Date.now() - logStartRef.current, phase: p.phase, msg }];
      return next.length > 500 ? next.slice(-500) : next;
    });
    queueMicrotask(() => {
      const el = logScrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const handleZip = useCallback(async (f: File) => {
    setBusy(true); setLogs([]); logStartRef.current = Date.now();
    setProgress({ phase: "read", processed: 0, total: 1, percent: 0, currentFile: f.name });
    try {
      const res = await scanZip(f, undefined, onProgress);
      setScan(res);
      toast.success(`Scanned ${res.totalFiles} files in ${res.stack.join(" + ") || "unknown stack"}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(null), 800);
    }
  }, [onProgress]);

  const handleFolder = useCallback(async (list: FileList) => {
    setBusy(true); setLogs([]); logStartRef.current = Date.now();
    setProgress({ phase: "read", processed: 0, total: list.length, percent: 0 });
    try {
      const first = list[0] as (File & { webkitRelativePath?: string }) | undefined;
      const name = first?.webkitRelativePath?.split("/")[0] ?? "project";
      const res = await scanFileList(name, list, onProgress);
      setScan(res);
      toast.success(`Scanned ${res.totalFiles} files`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(null), 800);
    }
  }, [onProgress]);

  const summary = useMemo(() => {
    if (!scan) return null;
    return {
      name: scan.name,
      stack: scan.stack,
      totals: { files: scan.totalFiles, lines: scan.totalLines, deps: scan.dependencies.length },
      scores: scan.scores,
      topSecurity: scan.security.slice(0, 15),
      topComplex: scan.files.filter((f) => f.complexity > 15).slice(0, 20).map((f) => ({ path: f.path, complexity: f.complexity })),
      duplicates: scan.duplicates.slice(0, 10),
      unused: scan.unused.slice(0, 20),
      timers: scan.timers.length,
      naming: scan.naming.inconsistencies.slice(0, 20),
    };
  }, [scan]);

  const runAI = async (stage: "recommendations" | "refactor" | "modernize" | "documentation") => {
    if (!summary) return;
    setAiBusy(stage);
    try {
      const { data, error } = await supabase.functions.invoke("software-intel", {
        body: { summary, stage },
      });
      if (error) throw error;
      setAiResult({ stage, ...(data as { result: Record<string, unknown> }).result });
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setAiBusy(null); }
  };

  const doPlanRename = () => {
    if (!scan || !renameFrom) return;
    setPlan(planRename(scan, renameFrom, renameTo));
  };
  const doApplyRename = () => {
    if (!scan || !plan) return;
    setScan(applyRename(scan, plan));
    setPlan(null);
    toast.success(`Applied rename across ${plan.filesAffected} files (in-memory).`);
  };

  const downloadReport = async () => {
    if (!scan) return;
    const md = renderMarkdownReport(scan);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${scan.name}-intelligence-report.md`; a.click();
    URL.revokeObjectURL(url);
  };
  const downloadZip = async () => {
    if (!scan) return;
    const blob = await exportScan(scan);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${scan.name}-modernized.zip`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" /> Software Intelligence Center
          </h1>
          <p className="text-muted-foreground text-sm">
            Scan, analyze, refactor and modernize any project. ZIPs, folders, or repositories.
          </p>
        </div>
        {scan && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadReport}><Download className="h-4 w-4" />Report</Button>
            <Button size="sm" onClick={downloadZip}><Download className="h-4 w-4" />Modernized ZIP</Button>
          </div>
        )}
      </div>

      {!scan && (
        <Card>
          <CardHeader>
            <CardTitle>Import a Project</CardTitle>
            <CardDescription>Upload a ZIP archive or select a folder to begin.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div
              className="rounded-lg border-2 border-dashed border-border hover:border-primary/60 p-8 text-center cursor-pointer"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleZip(f); }}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="font-medium">Drop or select a ZIP</div>
              <div className="text-xs text-muted-foreground">Any codebase — .zip archive</div>
              <input ref={fileRef} type="file" accept=".zip,.crx" className="hidden" onChange={(e) => e.target.files?.[0] && handleZip(e.target.files[0])} />
            </div>
            <div
              className="rounded-lg border-2 border-dashed border-border hover:border-primary/60 p-8 text-center cursor-pointer"
              onClick={() => folderRef.current?.click()}
            >
              <FolderTree className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="font-medium">Select a folder</div>
              <div className="text-xs text-muted-foreground">Scans every file recursively</div>
              <input
                ref={folderRef}
                type="file"
                className="hidden"
                onChange={(e) => e.target.files && handleFolder(e.target.files)}
                {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
              />
            </div>
          </CardContent>
          {(busy || progress) && (
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="uppercase tracking-wider text-muted-foreground">
                  {progress?.phase ?? "read"} · {progress?.processed ?? 0}/{progress?.total ?? 0}
                </span>
                <span className="font-mono">{progress?.percent ?? 0}%</span>
              </div>
              <Progress value={progress?.percent ?? 0} />
              {progress?.currentFile && (
                <div className="text-[11px] font-mono text-muted-foreground truncate">
                  {progress.currentFile}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {scan && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{scan.name}</CardTitle>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {scan.stack.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
                    {!scan.stack.length && <Badge variant="outline">Unknown stack</Badge>}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setScan(null)}>New Scan</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-2">
                <ScoreRing label="Overall" value={scan.scores.overall} />
                <ScoreRing label="Arch" value={scan.scores.architecture} />
                <ScoreRing label="Security" value={scan.scores.security} />
                <ScoreRing label="Perf" value={scan.scores.performance} />
                <ScoreRing label="Maint" value={scan.scores.maintainability} />
                <ScoreRing label="Docs" value={scan.scores.documentation} />
                <ScoreRing label="Naming" value={scan.scores.naming} />
                <ScoreRing label="Deps" value={scan.scores.dependencies} />
                <ScoreRing label="Tests" value={scan.scores.testing} />
                <ScoreRing label="Debt" value={scan.scores.technicalDebt} />
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="files">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="files"><FileCode2 className="h-4 w-4" />Files</TabsTrigger>
              <TabsTrigger value="folders"><FolderTree className="h-4 w-4" />Folders</TabsTrigger>
              <TabsTrigger value="deps"><PackageIcon className="h-4 w-4" />Dependencies</TabsTrigger>
              <TabsTrigger value="timers"><Timer className="h-4 w-4" />Timers</TabsTrigger>
              <TabsTrigger value="security"><ShieldAlert className="h-4 w-4" />Security</TabsTrigger>
              <TabsTrigger value="naming">Naming</TabsTrigger>
              <TabsTrigger value="rename"><Wand2 className="h-4 w-4" />Rename Studio</TabsTrigger>
              <TabsTrigger value="ai"><Sparkles className="h-4 w-4" />AI Insights</TabsTrigger>
            </TabsList>

            <TabsContent value="files">
              <Card><CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card border-b border-border">
                      <tr className="text-left">
                        <th className="p-2">Path</th><th>Purpose</th>
                        <th>Lines</th><th>Complexity</th><th>Risk</th><th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scan.files.slice().sort((a, b) => b.complexity - a.complexity).map((f) => (
                        <tr key={f.path} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="p-2 font-mono truncate max-w-[300px]">{f.path}</td>
                          <td>{f.purpose}</td>
                          <td>{f.lines}</td>
                          <td>{f.complexity}</td>
                          <td>
                            <Badge variant={f.risk === "high" ? "destructive" : f.risk === "medium" ? "outline" : "secondary"} className="text-[9px]">{f.risk}</Badge>
                          </td>
                          <td>{f.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="folders">
              <Card><CardContent className="p-4">
                <ScrollArea className="h-[500px]"><FolderTreeView node={scan.folders} /></ScrollArea>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="deps">
              <Card><CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card border-b border-border">
                      <tr className="text-left"><th className="p-2">Package</th><th>Version</th><th>Type</th><th>Used in</th></tr>
                    </thead>
                    <tbody>
                      {scan.dependencies.map((d) => (
                        <tr key={d.name + d.type} className="border-b border-border/50">
                          <td className="p-2 font-mono">{d.name}</td>
                          <td>{d.version}</td>
                          <td><Badge variant="outline" className="text-[9px]">{d.type}</Badge></td>
                          <td>
                            {d.usedIn === 0
                              ? <Badge variant="destructive" className="text-[9px]">unused</Badge>
                              : `${d.usedIn} files`}
                          </td>
                        </tr>
                      ))}
                      {!scan.dependencies.length && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No package.json found</td></tr>}
                    </tbody>
                  </table>
                </ScrollArea>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="timers">
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-2">Discovered {scan.timers.length} timing constructs.</p>
                <ScrollArea className="h-[460px]">
                  <div className="space-y-1">
                    {scan.timers.map((t, i) => (
                      <div key={i} className="rounded border border-border/50 p-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px]">{t.kind}</Badge>
                          <span className="font-mono text-muted-foreground">{t.file}:{t.line}</span>
                        </div>
                        <code className="text-[11px] block mt-1 text-primary">{t.snippet}</code>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="security">
              <Card><CardContent className="p-4">
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {scan.security.map((s, i) => (
                      <div key={i} className="rounded border border-border/50 p-2 text-xs">
                        <div className="flex items-center gap-2">
                          {s.severity === "critical" || s.severity === "high"
                            ? <AlertTriangle className="h-3 w-3 text-rose-400" />
                            : <ShieldAlert className="h-3 w-3 text-amber-400" />}
                          <Badge variant={s.severity === "critical" ? "destructive" : "outline"} className="text-[9px]">{s.severity}</Badge>
                          <span className="font-medium">{s.message}</span>
                          <span className="font-mono text-muted-foreground ml-auto">{s.file}:{s.line}</span>
                        </div>
                        <code className="text-[11px] block mt-1 text-primary">{s.snippet}</code>
                      </div>
                    ))}
                    {!scan.security.length && (
                      <div className="p-8 text-center text-emerald-400 flex flex-col items-center gap-2">
                        <CheckCircle2 className="h-8 w-8" /> No security findings
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="naming">
              <Card><CardContent className="p-4">
                <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                  {Object.entries(scan.naming.conventions).map(([k, v]) => (
                    <div key={k} className="rounded border border-border/50 p-2 text-xs">
                      <div className="text-muted-foreground uppercase text-[10px]">{k}</div>
                      <div className="font-mono">{v}</div>
                    </div>
                  ))}
                </div>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-1">
                    {scan.naming.inconsistencies.map((n, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border-b border-border/40 py-1">
                        <span className="font-mono">{n.name}</span>
                        <Badge variant="outline" className="text-[9px]">{n.kind}</Badge>
                        <span className="text-muted-foreground">→ {n.suggestion}</span>
                      </div>
                    ))}
                    {!scan.naming.inconsistencies.length && (
                      <div className="p-8 text-center text-emerald-400">Naming looks consistent</div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="rename">
              <Card><CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Find (e.g. OldBrand)" value={renameFrom} onChange={(e) => setRenameFrom(e.target.value)} />
                  <Input placeholder="Replace with (e.g. NewBrand)" value={renameTo} onChange={(e) => setRenameTo(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={doPlanRename} disabled={!renameFrom}>Preview</Button>
                  <Button size="sm" onClick={doApplyRename} disabled={!plan || !plan.totalOccurrences}>Apply</Button>
                </div>
                {plan && (
                  <div className="rounded border border-border/50 p-3 text-xs">
                    <p className="mb-2">
                      <b>{plan.totalOccurrences}</b> occurrences in <b>{plan.filesAffected}</b> files.
                    </p>
                    <ScrollArea className="h-[340px]">
                      {plan.changes.map((c) => (
                        <div key={c.path} className="mb-2 border-b border-border/40 pb-2">
                          <div className="font-mono">{c.path} <Badge variant="outline" className="text-[9px]">{c.occurrences}</Badge></div>
                          {c.preview.map((p, i) => <code key={i} className="block text-[11px] text-muted-foreground">{p}</code>)}
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Rename is applied in-memory to the loaded scan. Export the Modernized ZIP to persist changes.
                </p>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="ai">
              <Card><CardContent className="p-4 space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {(["recommendations", "refactor", "modernize", "documentation"] as const).map((s) => (
                    <Button key={s} size="sm" variant="outline" disabled={!!aiBusy} onClick={() => runAI(s)}>
                      {aiBusy === s ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      {s}
                    </Button>
                  ))}
                </div>
                <Separator />
                <ScrollArea className="h-[440px]">
                  {aiResult ? (
                    <pre className="text-[11px] whitespace-pre-wrap font-mono bg-muted/30 rounded p-3">
                      {JSON.stringify(aiResult, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Run any AI stage to get prioritized recommendations, refactor plans,
                      modernization upgrades, or auto-generated documentation.
                    </p>
                  )}
                </ScrollArea>
              </CardContent></Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

// Silence unused import — JSZip is only used transitively via project-intel.
void JSZip;
