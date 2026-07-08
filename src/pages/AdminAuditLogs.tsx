import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FileClock, Download, RefreshCw, ShieldCheck, AlertTriangle, XCircle, Info, Search, FileText, FileDown } from "lucide-react";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { saveAs } from "file-saver";

interface AuditLog {
  id: string;
  user_id: string | null;
  event_type: string;
  severity: string;
  extension_name: string | null;
  project_id: string | null;
  passed: boolean | null;
  blockers: number;
  warnings: number;
  details: Record<string, unknown>;
  user_agent: string | null;
  created_at: string;
}

const EVENT_TYPES = [
  "all", "preflight_pass", "preflight_block", "preflight_override",
  "download", "cws_upload", "cws_upload_failed", "autofix_applied",
  "certify", "manifest_edit",
] as const;

function severityIcon(sev: string) {
  if (sev === "error") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  if (sev === "warning") return <AlertTriangle className="h-3.5 w-3.5 text-warning" />;
  return <Info className="h-3.5 w-3.5 text-muted-foreground" />;
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: AuditLog[]): string {
  const cols: (keyof AuditLog)[] = [
    "created_at", "event_type", "severity", "passed", "blockers", "warnings",
    "extension_name", "user_id", "project_id", "details", "user_agent", "id",
  ];
  const header = cols.join(",");
  const body = rows.map(r => cols.map(c => csvEscape(r[c])).join(",")).join("\n");
  return header + "\n" + body;
}

function buildComplianceReport(rows: AuditLog[]): string {
  const total = rows.length;
  const byEvent: Record<string, number> = {};
  const bySeverity: Record<string, number> = { info: 0, warning: 0, error: 0 };
  let blocks = 0, overrides = 0, downloads = 0, uploads = 0, uploadFails = 0;
  let totalBlockers = 0, totalWarnings = 0;
  const extensions = new Set<string>();
  const users = new Set<string>();

  for (const r of rows) {
    byEvent[r.event_type] = (byEvent[r.event_type] ?? 0) + 1;
    bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1;
    if (r.event_type === "preflight_block") blocks++;
    if (r.event_type === "preflight_override") overrides++;
    if (r.event_type === "download") downloads++;
    if (r.event_type === "cws_upload") uploads++;
    if (r.event_type === "cws_upload_failed") uploadFails++;
    totalBlockers += r.blockers ?? 0;
    totalWarnings += r.warnings ?? 0;
    if (r.extension_name) extensions.add(r.extension_name);
    if (r.user_id) users.add(r.user_id);
  }

  const first = rows[rows.length - 1]?.created_at;
  const last = rows[0]?.created_at;

  const lines: string[] = [];
  lines.push("# Security Compliance Report");
  lines.push(`Generated: ${new Date().toISOString()}`);
  if (first && last) lines.push(`Window: ${first} → ${last}`);
  lines.push("");
  lines.push("## Executive Summary");
  lines.push(`- Total audit events: **${total}**`);
  lines.push(`- Unique extensions: **${extensions.size}**`);
  lines.push(`- Unique users: **${users.size}**`);
  lines.push(`- Preflight blocks: **${blocks}**`);
  lines.push(`- Manual overrides: **${overrides}**`);
  lines.push(`- Successful downloads: **${downloads}**`);
  lines.push(`- CWS uploads: **${uploads}** (failures: ${uploadFails})`);
  lines.push(`- Aggregate blockers logged: **${totalBlockers}**`);
  lines.push(`- Aggregate warnings logged: **${totalWarnings}**`);
  lines.push("");
  lines.push("## Severity Breakdown");
  for (const s of ["error", "warning", "info"]) {
    lines.push(`- ${s}: ${bySeverity[s] ?? 0}`);
  }
  lines.push("");
  lines.push("## Events by Type");
  for (const [k, v] of Object.entries(byEvent).sort((a, b) => b[1] - a[1])) {
    lines.push(`- \`${k}\`: ${v}`);
  }
  lines.push("");
  lines.push("## Compliance Posture");
  const gatePassRate = total > 0
    ? Math.round(((total - blocks - overrides) / Math.max(1, total)) * 100)
    : 100;
  lines.push(`- Gate pass rate: **${gatePassRate}%**`);
  lines.push(`- Override rate: **${total > 0 ? Math.round((overrides / total) * 100) : 0}%**`);
  lines.push(`- Upload success rate: **${uploads + uploadFails > 0 ? Math.round((uploads / (uploads + uploadFails)) * 100) : 100}%**`);
  lines.push("");
  lines.push("## Recent Blocking Events (last 20)");
  const recentBlocks = rows.filter(r => r.event_type === "preflight_block").slice(0, 20);
  if (recentBlocks.length === 0) {
    lines.push("_No blocking events in the selected window._");
  } else {
    for (const r of recentBlocks) {
      const ids = (r.details as { blockers?: string[] })?.blockers?.join(", ") ?? "";
      lines.push(`- ${r.created_at} · ${r.extension_name ?? "(unnamed)"} · ${r.blockers} blocker(s) · ${ids}`);
    }
  }
  return lines.join("\n");
}

export default function AdminAuditLogs() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState<(typeof EVENT_TYPES)[number]>("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | "info" | "warning" | "error">("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("security_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      setRows((data ?? []) as AuditLog[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (eventFilter !== "all" && r.event_type !== eventFilter) return false;
      if (severityFilter !== "all" && r.severity !== severityFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = `${r.event_type} ${r.extension_name ?? ""} ${JSON.stringify(r.details)}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, eventFilter, severityFilter, search]);

  const stats = useMemo(() => {
    const errors = filtered.filter(r => r.severity === "error").length;
    const warnings = filtered.filter(r => r.severity === "warning").length;
    const blocks = filtered.filter(r => r.event_type === "preflight_block").length;
    const overrides = filtered.filter(r => r.event_type === "preflight_override").length;
    return { total: filtered.length, errors, warnings, blocks, overrides };
  }, [filtered]);

  const exportCsv = () => {
    if (filtered.length === 0) { toast.info("No rows to export"); return; }
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    saveAs(blob, `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success(`Exported ${filtered.length} rows`);
  };

  const exportReport = () => {
    if (filtered.length === 0) { toast.info("No data for report"); return; }
    const md = buildComplianceReport(filtered);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    saveAs(blob, `compliance-report-${new Date().toISOString().slice(0, 10)}.md`);
    toast.success("Compliance report exported");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileClock className="h-6 w-6 text-primary" />
          Security Audit Logs
        </h1>
        <p className="text-muted-foreground mt-1">
          Preflight gates, downloads, uploads and auto-fix events. Superadmins see all users; users see their own.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Events" value={stats.total} tone="primary" icon={<FileClock className="h-4 w-4" />} />
        <StatCard label="Errors" value={stats.errors} tone="destructive" icon={<XCircle className="h-4 w-4" />} />
        <StatCard label="Warnings" value={stats.warnings} tone="warning" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Blocks" value={stats.blocks} tone="destructive" icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard label="Overrides" value={stats.overrides} tone="warning" icon={<AlertTriangle className="h-4 w-4" />} />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search event / extension / details…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <select
          value={eventFilter}
          onChange={e => setEventFilter(e.target.value as typeof eventFilter)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value as typeof severityFilter)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="all">all severities</option>
          <option value="error">error</option>
          <option value="warning">warning</option>
          <option value="info">info</option>
        </select>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
        </Button>
        <Button size="sm" onClick={exportReport} className="bg-gradient-cyber text-primary-foreground">
          <FileText className="h-3.5 w-3.5 mr-1.5" /> Compliance Report
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>{loading ? "Loading…" : `${filtered.length} of ${rows.length} rows`}</span>
          <span className="font-mono">latest 1,000</span>
        </div>
        <div className="divide-y divide-border max-h-[640px] overflow-y-auto">
          {filtered.map(r => (
            <div key={r.id} className="px-4 py-2.5 flex items-start gap-3 hover:bg-muted/30">
              {severityIcon(r.severity)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium font-mono">{r.event_type}</span>
                  {r.extension_name && <Badge variant="secondary" className="text-[10px]">{r.extension_name}</Badge>}
                  {r.blockers > 0 && <Badge variant="destructive" className="text-[10px]">{r.blockers} blocker(s)</Badge>}
                  {r.warnings > 0 && <Badge className="bg-warning/20 text-warning text-[10px]">{r.warnings} warn</Badge>}
                </div>
                {Object.keys(r.details ?? {}).length > 0 && (
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5 break-all line-clamp-2">
                    {JSON.stringify(r.details)}
                  </p>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground text-right shrink-0 font-mono">
                <div>{new Date(r.created_at).toLocaleString()}</div>
                {r.user_id && <div className="truncate max-w-[120px]">{r.user_id.slice(0, 8)}…</div>}
              </div>
            </div>
          ))}
          {!loading && filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No audit events match the current filters.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone, icon }: { label: string; value: number; tone: "primary" | "destructive" | "warning"; icon: React.ReactNode }) {
  const toneCls =
    tone === "destructive" ? "text-destructive" :
    tone === "warning" ? "text-warning" : "text-primary";
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className={`flex items-center gap-1.5 text-xs ${toneCls}`}>{icon}<span>{label}</span></div>
      <div className="text-xl font-bold font-mono mt-1">{value}</div>
    </div>
  );
}
