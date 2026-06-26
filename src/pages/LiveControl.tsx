import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, Ban, Clock, Copy, Loader2, Plus, Power,
  RefreshCw, ShieldCheck, Trash2, Zap, Code2, Calendar,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { newInstallSecret, sha256Hex, buildTelemetryShim } from "@/lib/telemetry-shim";

type Install = {
  id: string;
  owner_id: string;
  extension_name: string;
  extension_version: string | null;
  source: string;
  status: "active" | "paused" | "revoked";
  kill_switch: boolean;
  license_expires_at: string | null;
  daily_quota_minutes: number | null;
  weekly_quota_minutes: number | null;
  schedule_json: { days?: number[]; start_hour?: number; end_hour?: number; tz?: string } | null;
  last_seen_at: string | null;
  notes: string | null;
  created_at: string;
};

type EventRow = {
  id: number;
  install_id: string;
  event_type: string;
  action_name: string | null;
  error_message: string | null;
  ts: string;
};

type UsageRow = { day: string; minutes_used: number; actions_count: number; errors_count: number };

const ONLINE_WINDOW_MS = 90_000;

export default function LiveControl() {
  const { user } = useAuth();
  const [installs, setInstalls] = useState<Install[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [showSecret, setShowSecret] = useState<{ id: string; secret: string; shim: string } | null>(null);
  const [tick, setTick] = useState(0);

  // Tick every 15s to keep "online" status fresh
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  // Load installs + realtime
  useEffect(() => {
    if (!user) return;
    let active = true;

    const load = async () => {
      const { data, error } = await supabase
        .from("extension_installs")
        .select("*")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) toast.error("Failed to load installs", { description: error.message });
      else setInstalls((data ?? []) as Install[]);
      setLoading(false);
    };
    load();

    const ch = supabase
      .channel("live-installs")
      .on("postgres_changes", { event: "*", schema: "public", table: "extension_installs" }, () => load())
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user]);

  // Load events + usage for selected install (with realtime on events)
  useEffect(() => {
    if (!selectedId) { setEvents([]); setUsage([]); return; }
    let active = true;

    const loadEv = async () => {
      const { data } = await supabase
        .from("extension_events")
        .select("id, install_id, event_type, action_name, error_message, ts")
        .eq("install_id", selectedId)
        .order("ts", { ascending: false })
        .limit(50);
      if (active) setEvents((data ?? []) as EventRow[]);
    };
    const loadUsage = async () => {
      const since = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("extension_usage_daily")
        .select("day, minutes_used, actions_count, errors_count")
        .eq("install_id", selectedId)
        .gte("day", since)
        .order("day", { ascending: true });
      if (active) setUsage((data ?? []) as UsageRow[]);
    };
    loadEv(); loadUsage();

    const ch = supabase
      .channel(`ev-${selectedId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "extension_events", filter: `install_id=eq.${selectedId}` }, () => { loadEv(); loadUsage(); })
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [selectedId]);

  const selected = useMemo(() => installs.find((i) => i.id === selectedId) ?? null, [installs, selectedId]);
  const onlineCount = useMemo(() => {
    void tick;
    return installs.filter((i) => i.last_seen_at && Date.now() - new Date(i.last_seen_at).getTime() < ONLINE_WINDOW_MS).length;
  }, [installs, tick]);

  const createInstall = async (name: string) => {
    if (!user) return;
    setCreating(true);
    try {
      const secret = newInstallSecret();
      const hash = await sha256Hex(secret);
      const { data, error } = await supabase.from("extension_installs").insert({
        owner_id: user.id,
        extension_name: name,
        source: "generated",
        status: "active",
        token_hash: hash,
      }).select().single();
      if (error) throw error;
      const inst = data as Install;
      setSelectedId(inst.id);
      setShowSecret({ id: inst.id, secret, shim: buildTelemetryShim(inst.id, secret) });
      toast.success("Install registered", { description: "Copy the shim into your extension's service worker." });
    } catch (e) {
      toast.error("Failed to register", { description: (e as Error).message });
    } finally {
      setCreating(false);
    }
  };

  const patch = async (id: string, fields: Partial<Install>) => {
    const { error } = await supabase.from("extension_installs").update(fields).eq("id", id);
    if (error) toast.error("Update failed", { description: error.message });
  };

  const remove = async (id: string) => {
    if (!confirm("Permanently delete this install? Its history will be wiped.")) return;
    const { error } = await supabase.from("extension_installs").delete().eq("id", id);
    if (error) toast.error("Delete failed", { description: error.message });
    else { setSelectedId(null); toast.success("Install deleted"); }
  };

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gradient-cyber">Live Control Center</h1>
          <p className="text-sm text-muted-foreground">
            Real-time telemetry, license enforcement, quotas, schedules & remote kill-switch for every install.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-400">
            <Activity className="h-3 w-3" /> {onlineCount} online
          </Badge>
          <Badge variant="outline">{installs.length} total</Badge>
          <NewInstallButton onCreate={createInstall} loading={creating} />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Installs list */}
        <Card className="bg-card/40 backdrop-blur border-border/60 lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Installs</CardTitle>
            <CardDescription className="text-xs">Live status updates over secure WebSocket.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : installs.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No installs yet. Click <b>Register Install</b> to create one and get its telemetry shim.
                </div>
              ) : installs.map((i) => {
                const online = i.last_seen_at && Date.now() - new Date(i.last_seen_at).getTime() < ONLINE_WINDOW_MS;
                const isSel = i.id === selectedId;
                return (
                  <button
                    key={i.id}
                    onClick={() => setSelectedId(i.id)}
                    className={`w-full text-left px-4 py-3 border-b border-border/40 transition-colors ${
                      isSel ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{i.extension_name}</span>
                      <span className={`h-2 w-2 rounded-full shrink-0 ${
                        i.kill_switch || i.status === "revoked" ? "bg-red-500"
                          : i.status === "paused" ? "bg-amber-500"
                          : online ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"
                      }`} />
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                      <Badge variant="outline" className="text-[9px] px-1 py-0">{i.source}</Badge>
                      <span>{i.last_seen_at ? new Date(i.last_seen_at).toLocaleTimeString() : "never seen"}</span>
                    </div>
                  </button>
                );
              })}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Detail panel */}
        <div className="lg:col-span-2 space-y-4">
          {!selected ? (
            <Card className="bg-card/40 backdrop-blur border-border/60">
              <CardContent className="p-12 text-center text-muted-foreground text-sm">
                Select an install to manage license, quotas, schedule, and view live events.
              </CardContent>
            </Card>
          ) : (
            <DetailPanel
              install={selected}
              events={events}
              usage={usage}
              onPatch={(p) => patch(selected.id, p)}
              onDelete={() => remove(selected.id)}
              onShowShim={async () => {
                const secret = prompt("Paste the original install secret to regenerate the shim.\n(For security we don't store the plaintext — only its hash.)");
                if (!secret) return;
                const hash = await sha256Hex(secret);
                if (hash !== ((await supabase.from("extension_installs").select("token_hash").eq("id", selected.id).single()).data?.token_hash)) {
                  toast.error("Secret doesn't match");
                  return;
                }
                setShowSecret({ id: selected.id, secret, shim: buildTelemetryShim(selected.id, secret) });
              }}
            />
          )}
        </div>
      </div>

      <SecretDialog payload={showSecret} onClose={() => setShowSecret(null)} />

      <Card className="bg-card/40 backdrop-blur border-border/60">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <b>Security:</b> Each install authenticates with a per-install secret; only its SHA-256 hash is stored. Enforcement runs server-side with the service role — extensions cannot bypass quotas, schedules, or kill-switch by tampering with local code.
          </p>
          <p className="flex items-center gap-2"><Activity className="h-3.5 w-3.5 text-primary" />
            <b>Live:</b> Online status, last-seen, and the event feed update over realtime; the heartbeat interval is 60s.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============== Detail ==============
function DetailPanel({ install, events, usage, onPatch, onDelete, onShowShim }: {
  install: Install;
  events: EventRow[];
  usage: UsageRow[];
  onPatch: (p: Partial<Install>) => Promise<void> | void;
  onDelete: () => void;
  onShowShim: () => void;
}) {
  const [licDate, setLicDate] = useState(install.license_expires_at ? install.license_expires_at.slice(0, 10) : "");
  const [daily, setDaily] = useState(install.daily_quota_minutes?.toString() ?? "");
  const [weekly, setWeekly] = useState(install.weekly_quota_minutes?.toString() ?? "");
  const [sh, setSh] = useState({
    start: install.schedule_json?.start_hour ?? 0,
    end: install.schedule_json?.end_hour ?? 24,
    days: new Set<number>(install.schedule_json?.days ?? [1,2,3,4,5,6,7]),
  });

  useEffect(() => {
    setLicDate(install.license_expires_at ? install.license_expires_at.slice(0, 10) : "");
    setDaily(install.daily_quota_minutes?.toString() ?? "");
    setWeekly(install.weekly_quota_minutes?.toString() ?? "");
    setSh({
      start: install.schedule_json?.start_hour ?? 0,
      end: install.schedule_json?.end_hour ?? 24,
      days: new Set(install.schedule_json?.days ?? [1,2,3,4,5,6,7]),
    });
  }, [install.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Card className="bg-card/40 backdrop-blur border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">{install.extension_name}</CardTitle>
              <CardDescription className="text-xs font-mono">{install.id}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={onShowShim}><Code2 className="h-3.5 w-3.5 mr-1" /> View shim</Button>
              <Button
                size="sm"
                variant={install.kill_switch ? "destructive" : "outline"}
                onClick={() => onPatch({ kill_switch: !install.kill_switch })}
              >
                <Power className="h-3.5 w-3.5 mr-1" /> {install.kill_switch ? "Kill ON" : "Kill switch"}
              </Button>
              <Button
                size="sm"
                variant={install.status === "paused" ? "default" : "outline"}
                onClick={() => onPatch({ status: install.status === "paused" ? "active" : "paused" })}
              >
                {install.status === "paused" ? "Resume" : "Pause"}
              </Button>
              <Button
                size="sm"
                variant={install.status === "revoked" ? "destructive" : "outline"}
                onClick={() => onPatch({ status: install.status === "revoked" ? "active" : "revoked" })}
              >
                <Ban className="h-3.5 w-3.5 mr-1" /> {install.status === "revoked" ? "Reinstate" : "Revoke"}
              </Button>
              <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* License */}
          <section className="space-y-2">
            <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> License expires</Label>
            <div className="flex gap-2">
              <Input type="date" value={licDate} onChange={(e) => setLicDate(e.target.value)} className="max-w-[200px]" />
              <Button size="sm" onClick={() => onPatch({ license_expires_at: licDate ? new Date(licDate).toISOString() : null })}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setLicDate(""); onPatch({ license_expires_at: null }); }}>Unlimited</Button>
            </div>
          </section>

          <Separator />

          {/* Quotas */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Daily quota (minutes)</Label>
              <div className="flex gap-2 mt-1">
                <Input value={daily} onChange={(e) => setDaily(e.target.value.replace(/\D/g, ""))} placeholder="∞" />
                <Button size="sm" onClick={() => onPatch({ daily_quota_minutes: daily ? Number(daily) : null })}>Save</Button>
              </div>
            </div>
            <div>
              <Label className="text-xs">Weekly quota (minutes)</Label>
              <div className="flex gap-2 mt-1">
                <Input value={weekly} onChange={(e) => setWeekly(e.target.value.replace(/\D/g, ""))} placeholder="∞" />
                <Button size="sm" onClick={() => onPatch({ weekly_quota_minutes: weekly ? Number(weekly) : null })}>Save</Button>
              </div>
            </div>
          </section>

          <Separator />

          {/* Schedule */}
          <section className="space-y-2">
            <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> Allowed schedule (UTC)</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {["Mo","Tu","We","Th","Fr","Sa","Su"].map((d, i) => {
                const dayNum = i + 1;
                const on = sh.days.has(dayNum);
                return (
                  <button
                    key={d}
                    onClick={() => {
                      const next = new Set(sh.days);
                      on ? next.delete(dayNum) : next.add(dayNum);
                      setSh((s) => ({ ...s, days: next }));
                    }}
                    className={`h-7 px-2 text-[11px] rounded-md border ${on ? "bg-primary/15 border-primary/40 text-primary" : "border-border/60 text-muted-foreground"}`}
                  >{d}</button>
                );
              })}
              <Input type="number" min={0} max={24} value={sh.start} onChange={(e) => setSh((s) => ({ ...s, start: Number(e.target.value) }))} className="w-16" />
              <span className="text-xs text-muted-foreground">→</span>
              <Input type="number" min={0} max={24} value={sh.end} onChange={(e) => setSh((s) => ({ ...s, end: Number(e.target.value) }))} className="w-16" />
              <Button size="sm" onClick={() => onPatch({ schedule_json: { days: Array.from(sh.days).sort(), start_hour: sh.start, end_hour: sh.end, tz: "UTC" } })}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => onPatch({ schedule_json: null })}>Always</Button>
            </div>
          </section>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card/40 backdrop-blur border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Minutes used · 14d</CardTitle></CardHeader>
          <CardContent className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={usage}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Line type="monotone" dataKey="minutes_used" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="bg-card/40 backdrop-blur border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Actions vs errors · 14d</CardTitle></CardHeader>
          <CardContent className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={usage}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Line type="monotone" dataKey="actions_count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="errors_count" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Event feed */}
      <Card className="bg-card/40 backdrop-blur border-border/60">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Live event feed</CardTitle>
          <Badge variant="outline" className="text-[10px]">last 50</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-64">
            {events.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">Waiting for telemetry…</div>
            ) : events.map((e) => (
              <div key={e.id} className="px-4 py-2 border-b border-border/40 flex items-center gap-2 text-xs">
                <span className="font-mono text-muted-foreground w-20 shrink-0">{new Date(e.ts).toLocaleTimeString()}</span>
                {e.event_type === "heartbeat" && <Activity className="h-3 w-3 text-emerald-400" />}
                {e.event_type === "action" && <Zap className="h-3 w-3 text-primary" />}
                {e.event_type === "error" && <AlertTriangle className="h-3 w-3 text-red-400" />}
                <Badge variant="outline" className="text-[9px] px-1 py-0">{e.event_type}</Badge>
                <span className="truncate flex-1">{e.action_name || e.error_message || ""}</span>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>
    </>
  );
}

// ============== New install button + secret dialog ==============
function NewInstallButton({ onCreate, loading }: { onCreate: (name: string) => void; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className="bg-gradient-cyber">
        <Plus className="h-4 w-4 mr-1" /> Register Install
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register a new install</DialogTitle>
            <DialogDescription>
              You'll get a one-time secret and a copy-paste telemetry shim. Inject it into the extension's background service worker, then it will phone home every 60s.
            </DialogDescription>
          </DialogHeader>
          <Input placeholder="Extension name" value={name} onChange={(e) => setName(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={!name.trim() || loading}
              onClick={() => { onCreate(name.trim()); setOpen(false); setName(""); }}
              className="bg-gradient-cyber"
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SecretDialog({ payload, onClose }: { payload: { id: string; secret: string; shim: string } | null; onClose: () => void }) {
  if (!payload) return null;
  const copy = (s: string, label: string) => { navigator.clipboard.writeText(s); toast.success(`${label} copied`); };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Install credentials</DialogTitle>
          <DialogDescription>
            Save the secret somewhere safe — we only store its hash and can't show it again.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Install ID</Label>
            <div className="flex gap-2 mt-1">
              <Input readOnly value={payload.id} className="font-mono text-xs" />
              <Button size="icon" variant="outline" onClick={() => copy(payload.id, "ID")}><Copy className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Secret (one-time)</Label>
            <div className="flex gap-2 mt-1">
              <Input readOnly value={payload.secret} className="font-mono text-xs" />
              <Button size="icon" variant="outline" onClick={() => copy(payload.secret, "Secret")}><Copy className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">telemetry-shim.js — drop into your extension</Label>
            <pre className="mt-1 text-[10px] font-mono p-3 bg-[#0d1117] text-[#e6edf3] rounded-md border border-border/60 max-h-64 overflow-auto">{payload.shim}</pre>
            <div className="flex justify-end mt-2">
              <Button size="sm" variant="outline" onClick={() => copy(payload.shim, "Shim")}><Copy className="h-3.5 w-3.5 mr-1" /> Copy shim</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            <Link to="/manage" className="text-primary underline">Manage Extension</Link> already includes the alarms+storage perms when you re-export your imported extension after pasting the shim.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>I saved it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// expose icon import to satisfy bundler (RefreshCw used inline none, dropping)
void RefreshCw;
