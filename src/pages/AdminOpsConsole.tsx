import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, Save, Server, DollarSign, Route, Users, Activity } from "lucide-react";
import { toast } from "sonner";

type QueueRow = {
  id: string; user_id: string; user_email: string | null; idea: string;
  status: string; created_at: string; completed_at: string | null; error_message: string | null;
};
type Route = {
  id: string; task_key: string; label: string; primary_provider: string; primary_model: string;
  fallback_chain: Array<{ provider: string; model: string }>;
  max_retries: number; timeout_ms: number; temperature: number; enabled: boolean; notes: string | null;
};
type QuotaRow = {
  user_id: string; email: string; display_name: string | null;
  monthly_generation_cap: number; monthly_token_cap: number; monthly_usd_cap: number;
  hard_block: boolean; mtd_generations: number; mtd_tokens: number; mtd_cost_usd: number;
};

const fmtUsd = (n: number) => `$${Number(n ?? 0).toFixed(2)}`;
const fmtInt = (n: number) => Number(n ?? 0).toLocaleString();
const pct = (used: number, cap: number) => cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;

export default function AdminOpsConsole() {
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [costs, setCosts] = useState<any>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [quotas, setQuotas] = useState<QuotaRow[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [q, c, r, u] = await Promise.all([
        supabase.rpc("ops_batch_queue_all", { _limit: 200 }),
        supabase.rpc("ops_cost_summary", { _days: days }),
        supabase.from("ops_model_routes").select("*").order("task_key"),
        supabase.rpc("ops_user_usage_list"),
      ]);
      if (q.error) throw q.error;
      if (c.error) throw c.error;
      if (r.error) throw r.error;
      if (u.error) throw u.error;
      setQueue((q.data ?? []) as QueueRow[]);
      setCosts(c.data ?? null);
      setRoutes((r.data ?? []) as Route[]);
      setQuotas((u.data ?? []) as QuotaRow[]);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load ops data");
    } finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, [days]);

  async function saveRoute(r: Route) {
    setSavingId(r.id);
    try {
      const { error } = await supabase.from("ops_model_routes").update({
        label: r.label,
        primary_provider: r.primary_provider,
        primary_model: r.primary_model,
        fallback_chain: r.fallback_chain,
        max_retries: r.max_retries,
        timeout_ms: r.timeout_ms,
        temperature: r.temperature,
        enabled: r.enabled,
        notes: r.notes,
      }).eq("id", r.id);
      if (error) throw error;
      toast.success(`Saved ${r.task_key}`);
    } catch (e: any) { toast.error(e.message); } finally { setSavingId(null); }
  }

  async function saveQuota(row: QuotaRow) {
    setSavingId(row.user_id);
    try {
      const { error } = await supabase.from("ops_user_quotas").upsert({
        user_id: row.user_id,
        monthly_generation_cap: row.monthly_generation_cap,
        monthly_token_cap: row.monthly_token_cap,
        monthly_usd_cap: row.monthly_usd_cap,
        hard_block: row.hard_block,
      }, { onConflict: "user_id" });
      if (error) throw error;
      toast.success(`Saved quota for ${row.email}`);
    } catch (e: any) { toast.error(e.message); } finally { setSavingId(null); }
  }

  const totals = costs?.totals ?? {};

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Server className="h-6 w-6 text-amber-400" /> Admin / Ops Console
          </h1>
          <p className="text-sm text-muted-foreground">Platform-level job queue, cost analytics, model routing, and per-user quotas.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Window</Label>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="text-xs bg-background border border-border rounded px-2 py-1">
            <option value={7}>7d</option><option value={30}>30d</option><option value={90}>90d</option>
          </select>
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Activity className="h-4 w-4 text-cyan-400" />} label="Generations" value={fmtInt(totals.generations)} sub={`${totals.failures ?? 0} failures · ${totals.fallbacks ?? 0} fallbacks`} />
        <StatCard icon={<DollarSign className="h-4 w-4 text-emerald-400" />} label="Spend" value={fmtUsd(totals.cost_usd)} sub={`${fmtInt(totals.credits)} credits`} />
        <StatCard icon={<Server className="h-4 w-4 text-purple-400" />} label="Tokens" value={fmtInt(totals.tokens)} sub={`avg ${totals.avg_latency_ms ?? 0}ms latency`} />
        <StatCard icon={<Users className="h-4 w-4 text-orange-400" />} label="Active users" value={fmtInt((costs?.by_user ?? []).length)} sub={`over last ${days}d`} />
      </div>

      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue">Job Queue</TabsTrigger>
          <TabsTrigger value="costs">Cost Analytics</TabsTrigger>
          <TabsTrigger value="routing">Model Routing</TabsTrigger>
          <TabsTrigger value="quotas">User Quotas</TabsTrigger>
        </TabsList>

        {/* Queue */}
        <TabsContent value="queue">
          <Card>
            <CardHeader><CardTitle className="text-sm">Batch queue (all users, last 200)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead><TableHead>User</TableHead>
                    <TableHead>Idea</TableHead><TableHead>Created</TableHead>
                    <TableHead>Duration</TableHead><TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.map((r) => {
                    const start = new Date(r.created_at).getTime();
                    const end = r.completed_at ? new Date(r.completed_at).getTime() : Date.now();
                    const dur = Math.round((end - start) / 1000);
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Badge variant={r.status === "completed" ? "default" : r.status === "failed" ? "destructive" : "outline"} className="text-[9px]">{r.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{r.user_email ?? r.user_id.slice(0, 8)}</TableCell>
                        <TableCell className="text-xs max-w-[360px] truncate" title={r.idea}>{r.idea}</TableCell>
                        <TableCell className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-[10px]">{dur}s</TableCell>
                        <TableCell className="text-[10px] text-destructive max-w-[200px] truncate" title={r.error_message ?? ""}>{r.error_message ?? ""}</TableCell>
                      </TableRow>
                    );
                  })}
                  {queue.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground">No jobs</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Costs */}
        <TabsContent value="costs" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Cost per task ({days}d)</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Runs</TableHead><TableHead>Tokens</TableHead><TableHead>Cost</TableHead><TableHead>Avg ms</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(costs?.by_task ?? []).map((t: any) => (
                      <TableRow key={t.task_key}>
                        <TableCell className="text-xs font-mono">{t.task_key}</TableCell>
                        <TableCell className="text-xs">{fmtInt(t.runs)}</TableCell>
                        <TableCell className="text-xs">{fmtInt(t.tokens)}</TableCell>
                        <TableCell className="text-xs">{fmtUsd(t.cost_usd)}</TableCell>
                        <TableCell className="text-xs">{t.avg_latency_ms ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Cost per model ({days}d)</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Provider</TableHead><TableHead>Model</TableHead><TableHead>Runs</TableHead><TableHead>Tokens</TableHead><TableHead>Cost</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(costs?.by_model ?? []).map((m: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{m.provider}</TableCell>
                        <TableCell className="text-xs font-mono truncate max-w-[180px]" title={m.model}>{m.model}</TableCell>
                        <TableCell className="text-xs">{fmtInt(m.runs)}</TableCell>
                        <TableCell className="text-xs">{fmtInt(m.tokens)}</TableCell>
                        <TableCell className="text-xs">{fmtUsd(m.cost_usd)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-sm">Spend by user ({days}d)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Runs</TableHead><TableHead>Tokens</TableHead><TableHead>Cost</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(costs?.by_user ?? []).map((u: any) => (
                    <TableRow key={u.user_id ?? u.email ?? Math.random()}>
                      <TableCell className="text-xs">{u.email ?? u.user_id?.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs">{fmtInt(u.runs)}</TableCell>
                      <TableCell className="text-xs">{fmtInt(u.tokens)}</TableCell>
                      <TableCell className="text-xs">{fmtUsd(u.cost_usd)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Routing */}
        <TabsContent value="routing" className="space-y-3">
          {routes.map((r, idx) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Route className="h-4 w-4 text-cyan-400" />
                      <span className="font-mono">{r.task_key}</span>
                      <span className="text-muted-foreground font-normal">· {r.label}</span>
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={r.enabled} onCheckedChange={(v) => setRoutes(prev => prev.map((x, i) => i === idx ? { ...x, enabled: v } : x))} />
                    <Button size="sm" onClick={() => saveRoute(r)} disabled={savingId === r.id}>
                      {savingId === r.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}Save
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div><Label className="text-[10px]">Primary provider</Label>
                    <Input value={r.primary_provider} onChange={(e) => setRoutes(prev => prev.map((x, i) => i === idx ? { ...x, primary_provider: e.target.value } : x))} className="h-8 text-xs" /></div>
                  <div><Label className="text-[10px]">Primary model</Label>
                    <Input value={r.primary_model} onChange={(e) => setRoutes(prev => prev.map((x, i) => i === idx ? { ...x, primary_model: e.target.value } : x))} className="h-8 text-xs font-mono" /></div>
                  <div><Label className="text-[10px]">Max retries</Label>
                    <Input type="number" value={r.max_retries} onChange={(e) => setRoutes(prev => prev.map((x, i) => i === idx ? { ...x, max_retries: Number(e.target.value) } : x))} className="h-8 text-xs" /></div>
                  <div><Label className="text-[10px]">Timeout (ms)</Label>
                    <Input type="number" value={r.timeout_ms} onChange={(e) => setRoutes(prev => prev.map((x, i) => i === idx ? { ...x, timeout_ms: Number(e.target.value) } : x))} className="h-8 text-xs" /></div>
                </div>
                <div>
                  <Label className="text-[10px]">Fallback chain (JSON — array of {"{provider,model}"})</Label>
                  <Textarea rows={3} className="text-xs font-mono"
                    value={JSON.stringify(r.fallback_chain, null, 0)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        setRoutes(prev => prev.map((x, i) => i === idx ? { ...x, fallback_chain: parsed } : x));
                      } catch { /* ignore parse errors while typing */ }
                    }} />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(r.fallback_chain ?? []).map((f, i) => (
                      <Badge key={i} variant="outline" className="text-[9px]">{i + 1}. {f.provider}/{f.model}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-[10px]">Notes</Label>
                  <Input value={r.notes ?? ""} onChange={(e) => setRoutes(prev => prev.map((x, i) => i === idx ? { ...x, notes: e.target.value } : x))} className="h-8 text-xs" />
                </div>
              </CardContent>
            </Card>
          ))}
          {routes.length === 0 && <p className="text-xs text-muted-foreground">No routes configured.</p>}
        </TabsContent>

        {/* Quotas */}
        <TabsContent value="quotas">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Per-user quotas & month-to-date usage</CardTitle>
              <CardDescription className="text-[10px]">Caps apply to platform generations, tokens, and USD spend in the current month. Toggle <b>hard block</b> to reject requests when the user exceeds a cap.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Gens (MTD / cap)</TableHead>
                  <TableHead>Tokens (MTD / cap)</TableHead>
                  <TableHead>Spend (MTD / cap)</TableHead>
                  <TableHead>Block</TableHead>
                  <TableHead />
                </TableRow></TableHeader>
                <TableBody>
                  {quotas.map((row, idx) => (
                    <TableRow key={row.user_id}>
                      <TableCell className="text-xs">
                        <div className="font-medium">{row.email}</div>
                        <div className="text-[10px] text-muted-foreground">{row.display_name ?? ""}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] w-16">{fmtInt(row.mtd_generations)}</span>
                          <Input type="number" value={row.monthly_generation_cap} className="h-7 text-xs w-24"
                            onChange={(e) => setQuotas(prev => prev.map((x, i) => i === idx ? { ...x, monthly_generation_cap: Number(e.target.value) } : x))} />
                          <span className="text-[10px] text-muted-foreground">{pct(row.mtd_generations, row.monthly_generation_cap)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] w-20">{fmtInt(row.mtd_tokens)}</span>
                          <Input type="number" value={row.monthly_token_cap} className="h-7 text-xs w-28"
                            onChange={(e) => setQuotas(prev => prev.map((x, i) => i === idx ? { ...x, monthly_token_cap: Number(e.target.value) } : x))} />
                          <span className="text-[10px] text-muted-foreground">{pct(row.mtd_tokens, row.monthly_token_cap)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] w-14">{fmtUsd(row.mtd_cost_usd)}</span>
                          <Input type="number" step="0.01" value={row.monthly_usd_cap} className="h-7 text-xs w-24"
                            onChange={(e) => setQuotas(prev => prev.map((x, i) => i === idx ? { ...x, monthly_usd_cap: Number(e.target.value) } : x))} />
                          <span className="text-[10px] text-muted-foreground">{pct(row.mtd_cost_usd, row.monthly_usd_cap)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch checked={row.hard_block} onCheckedChange={(v) => setQuotas(prev => prev.map((x, i) => i === idx ? { ...x, hard_block: v } : x))} />
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => saveQuota(row)} disabled={savingId === row.user_id}>
                          {savingId === row.user_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {quotas.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground">No users yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-[10px] uppercase text-muted-foreground">{icon} {label}</div>
        <div className="text-xl font-semibold mt-1">{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
