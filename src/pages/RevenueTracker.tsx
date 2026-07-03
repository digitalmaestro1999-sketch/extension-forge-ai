import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Users, Activity, Package, AlertCircle, Radio, Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import { Link } from "react-router-dom";

type Install = {
  id: string;
  extension_name: string;
  extension_version: string | null;
  status: string;
  kill_switch: boolean;
  last_seen_at: string | null;
  created_at: string;
};

type DailyRow = {
  install_id: string;
  day: string;
  minutes_used: number;
  actions_count: number;
  errors_count: number;
};

const DAYS = 30;

export default function RevenueTracker() {
  const { user } = useAuth();
  const [installs, setInstalls] = useState<Install[] | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - DAYS * 86400_000).toISOString().slice(0, 10);
      const [ins, dl] = await Promise.all([
        supabase
          .from("extension_installs")
          .select("id, extension_name, extension_version, status, kill_switch, last_seen_at, created_at")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("extension_usage_daily")
          .select("install_id, day, minutes_used, actions_count, errors_count")
          .eq("owner_id", user.id)
          .gte("day", since)
          .order("day", { ascending: true }),
      ]);
      setInstalls(ins.data || []);
      setDaily((dl.data as DailyRow[]) || []);
      setLoading(false);
    })();
  }, [user]);

  if (loading || installs === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading telemetry…</div>;
  }

  const hasTelemetry = installs.length > 0;

  // -------- Aggregates --------
  const totalInstalls = installs.length;
  const activeInstalls = installs.filter(
    (i) => !i.kill_switch && i.status === "active" && i.last_seen_at &&
      Date.now() - new Date(i.last_seen_at).getTime() < 7 * 86400_000
  ).length;
  const totalMinutes = daily.reduce((s, r) => s + r.minutes_used, 0);
  const totalActions = daily.reduce((s, r) => s + r.actions_count, 0);
  const totalErrors = daily.reduce((s, r) => s + r.errors_count, 0);
  const errorRate = totalActions > 0 ? (totalErrors / totalActions) * 100 : 0;

  // -------- Time series (last 30 days) --------
  const byDay = new Map<string, { day: string; minutes: number; actions: number; errors: number }>();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
    byDay.set(d, { day: d.slice(5), minutes: 0, actions: 0, errors: 0 });
  }
  for (const r of daily) {
    const key = r.day.slice(5);
    const bucket = byDay.get(r.day) || byDay.get(r.day.slice(0, 10));
    if (bucket) {
      bucket.minutes += r.minutes_used;
      bucket.actions += r.actions_count;
      bucket.errors += r.errors_count;
    } else {
      byDay.set(r.day, { day: key, minutes: r.minutes_used, actions: r.actions_count, errors: r.errors_count });
    }
  }
  const series = Array.from(byDay.values());

  // -------- Per-extension rollup --------
  const dailyByInstall = new Map<string, { minutes: number; actions: number; errors: number; days: Set<string> }>();
  for (const r of daily) {
    const b = dailyByInstall.get(r.install_id) || { minutes: 0, actions: 0, errors: 0, days: new Set<string>() };
    b.minutes += r.minutes_used;
    b.actions += r.actions_count;
    b.errors += r.errors_count;
    if (r.minutes_used > 0 || r.actions_count > 0) b.days.add(r.day);
    dailyByInstall.set(r.install_id, b);
  }

  const perExtension = installs.map((i) => {
    const s = dailyByInstall.get(i.id) || { minutes: 0, actions: 0, errors: 0, days: new Set<string>() };
    const lastSeen = i.last_seen_at ? new Date(i.last_seen_at) : null;
    const isLive = !i.kill_switch && lastSeen && Date.now() - lastSeen.getTime() < 24 * 3600_000;
    return {
      id: i.id,
      name: i.extension_name,
      version: i.extension_version || "—",
      status: i.kill_switch ? "killed" : i.status,
      minutes: s.minutes,
      actions: s.actions,
      errors: s.errors,
      activeDays: s.days.size,
      lastSeen,
      isLive,
    };
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Usage Telemetry
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live metrics from deployed extensions · last {DAYS} days
            <Badge variant="outline" className="ml-2 text-[10px] border-emerald-500/40 text-emerald-400">
              <Radio className="h-2.5 w-2.5 mr-1" /> Real data
            </Badge>
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/control">Manage installs →</Link>
        </Button>
      </div>

      {!hasTelemetry && (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center space-y-3">
            <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium">No telemetry yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Deploy an extension via <span className="text-foreground font-mono">Live Control</span> to
                receive real install, session and error metrics here. Nothing on this page is simulated.
              </p>
            </div>
            <Button asChild size="sm" className="bg-gradient-cyber text-primary-foreground">
              <Link to="/control">Open Live Control</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {hasTelemetry && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Installs", value: totalInstalls, icon: Package, fmt: String },
              { label: "Active (7d)", value: activeInstalls, icon: Users, fmt: String },
              { label: "Minutes Used", value: totalMinutes, icon: Clock, fmt: (v: number) => v.toLocaleString() },
              { label: "Actions", value: totalActions, icon: Activity, fmt: (v: number) => v.toLocaleString() },
              { label: "Error Rate", value: errorRate, icon: TrendingUp, fmt: (v: number) => `${v.toFixed(2)}%` },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <s.icon className="h-3.5 w-3.5" />
                      <span className="text-[11px]">{s.label}</span>
                    </div>
                    <p className="text-xl font-bold font-mono">{s.fmt(s.value)}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-sm">Actions per day</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="actions" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="errors" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Minutes used</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="minutes" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm">Per-extension usage (last {DAYS} days)</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Extension</th>
                      <th className="py-2 pr-4 font-medium">Version</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium text-right">Minutes</th>
                      <th className="py-2 pr-4 font-medium text-right">Actions</th>
                      <th className="py-2 pr-4 font-medium text-right">Errors</th>
                      <th className="py-2 pr-4 font-medium text-right">Active days</th>
                      <th className="py-2 font-medium text-right">Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perExtension.map((e) => (
                      <tr key={e.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2.5 pr-4 font-medium">{e.name}</td>
                        <td className="py-2.5 pr-4 text-xs font-mono text-muted-foreground">{e.version}</td>
                        <td className="py-2.5 pr-4">
                          <Badge
                            variant="outline"
                            className={
                              e.status === "killed" ? "text-red-400 border-red-500/40" :
                              e.isLive ? "text-emerald-400 border-emerald-500/40" :
                              "text-muted-foreground"
                            }
                          >
                            {e.status === "killed" ? "killed" : e.isLive ? "live" : "idle"}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono text-xs">{e.minutes.toLocaleString()}</td>
                        <td className="py-2.5 pr-4 text-right font-mono text-xs">{e.actions.toLocaleString()}</td>
                        <td className="py-2.5 pr-4 text-right font-mono text-xs">
                          <span className={e.errors > 0 ? "text-red-400" : ""}>{e.errors}</span>
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono text-xs">{e.activeDays}</td>
                        <td className="py-2.5 text-right text-xs text-muted-foreground">
                          {e.lastSeen ? e.lastSeen.toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
