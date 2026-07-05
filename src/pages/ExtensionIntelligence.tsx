import { useEffect, useState } from "react";
import {
  Brain, Search, Sparkles, Loader2, ExternalLink, Star, Users, ShieldAlert,
  Layers, Target, Lightbulb, Building2, Wand2, DollarSign, Palette, ListChecks,
  FileText, Rocket, BarChart3, Trophy, Flame, Terminal, Download, Code2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import SoftwareIntelligence from "./SoftwareIntelligence";

type InputType = "keyword" | "category" | "url" | "chrome_id";
interface Competitor {
  id?: string;
  chrome_id: string | null;
  name: string;
  developer?: string | null;
  rating?: number | null;
  review_count?: number | null;
  users_count?: string | null;
  url: string;
  rank?: number;
  raw?: any;
}

const CATEGORIES = [
  "Productivity", "Developer Tools", "Accessibility", "Communication",
  "Education", "Entertainment", "News & Weather", "Photos", "Search Tools",
  "Shopping", "Social & Networking", "Sports", "Travel", "Well-being",
];

const PHASE2 = ["Screenshot Intel", "Review Intel", "Sentiment AI", "SWOT", "Security Intel", "Scorecard"];
const PHASE3 = ["Innovation Engine", "Architecture", "Monetization", "UX Redesign", "Prioritizer", "Blueprint", "Build Better", "Heatmap"];
const PHASE4 = ["Dev Prompts", "Export Center"];

function ScorePill({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? "text-emerald-400" : value >= 60 ? "text-amber-400" : "text-rose-400";
  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-card/50 p-2">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

export default function ExtensionIntelligence() {
  const { user } = useAuth();
  const [inputType, setInputType] = useState<InputType>("keyword");
  const [inputValue, setInputValue] = useState("");
  const [limit, setLimit] = useState(10);
  const [busy, setBusy] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selected, setSelected] = useState<Competitor | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, any>>({});
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("intel_reports")
      .select("id,input_type,input_value,title,created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setHistory(data ?? []));
  }, [user, reportId]);

  async function loadReport(id: string) {
    setReportId(id);
    setAnalyses({});
    const { data: comps } = await supabase
      .from("intel_competitors").select("*").eq("report_id", id).order("rank");
    setCompetitors((comps as any) ?? []);
    setSelected(((comps as any) ?? [])[0] ?? null);
    const { data: an } = await supabase
      .from("intel_analyses").select("module_key,payload,competitor_id").eq("report_id", id);
    const map: Record<string, any> = {};
    (an ?? []).forEach((a: any) => { map[a.module_key + (a.competitor_id ? `:${a.competitor_id}` : "")] = a.payload; });
    setAnalyses(map);
  }

  async function runDiscovery() {
    if (!user) { toast.error("Please sign in"); return; }
    if (!inputValue.trim()) { toast.error("Enter a keyword, URL, category, or Chrome ID"); return; }
    setBusy(true);
    try {
      const { data: report, error } = await supabase.from("intel_reports").insert({
        user_id: user.id, input_type: inputType, input_value: inputValue,
        title: `${inputType}: ${inputValue}`, status: "discovering",
      }).select().single();
      if (error) throw error;
      setReportId(report.id);

      const { data, error: fnErr } = await supabase.functions.invoke("ext-intel-discover", {
        body: { input_type: inputType, input_value: inputValue, limit, report_id: report.id },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);

      toast.success(`Found ${data.competitors?.length ?? 0} competitors`);
      await loadReport(report.id);
    } catch (e: any) {
      toast.error(e.message ?? "Discovery failed");
    } finally { setBusy(false); }
  }

  async function scrapeCompetitor(c: Competitor) {
    if (!c.id) return;
    setAnalyzing(`scrape:${c.id}`);
    try {
      const { data, error } = await supabase.functions.invoke("ext-intel-scrape", {
        body: { competitor_id: c.id, url: c.url },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Scraped ${c.name}`);
      await loadReport(reportId!);
    } catch (e: any) {
      toast.error(e.message ?? "Scrape failed");
    } finally { setAnalyzing(null); }
  }

  async function runAnalysis(stage: string, ctx: "report" | "competitor" = "competitor") {
    if (!reportId) return;
    const comp = ctx === "competitor" ? selected : null;
    if (ctx === "competitor" && !comp) { toast.error("Select a competitor first"); return; }
    setAnalyzing(stage);
    try {
      const input = ctx === "competitor"
        ? { name: comp!.name, description: comp!.raw?.description, url: comp!.url, developer: comp!.developer }
        : { competitors: competitors.map(c => ({ name: c.name, description: c.raw?.description, rating: c.rating, users: c.users_count })) };
      const { data, error } = await supabase.functions.invoke("ext-intel-analyze", {
        body: { stage, input, report_id: reportId, competitor_id: comp?.id ?? null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const key = stage + (comp?.id ? `:${comp.id}` : "");
      setAnalyses((a) => ({ ...a, [key]: data.result }));
      toast.success(`${stage} complete`);
    } catch (e: any) {
      toast.error(e.message ?? `${stage} failed`);
    } finally { setAnalyzing(null); }
  }

  const key = (stage: string, forReport = false) =>
    stage + (!forReport && selected?.id ? `:${selected.id}` : "");
  const a = (stage: string, forReport = false) => analyses[key(stage, forReport)];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-gradient-cyber flex items-center justify-center">
            <Brain className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gradient-cyber">Extension Intelligence Engine</h1>
            <p className="text-xs text-muted-foreground">
              Reverse-engineer top Chrome extensions into original, IP-safe blueprints. Powered by Firecrawl + Lovable AI.
            </p>
          </div>
        </div>
      </header>

      {/* Input bar */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_140px_140px_auto] gap-2">
            <Select value={inputType} onValueChange={(v) => setInputType(v as InputType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="keyword">Keyword</SelectItem>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="url">Store URL</SelectItem>
                <SelectItem value="chrome_id">Chrome ID</SelectItem>
              </SelectContent>
            </Select>
            {inputType === "category" ? (
              <Select value={inputValue} onValueChange={setInputValue}>
                <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder={inputType === "url" ? "https://chromewebstore.google.com/detail/..." : inputType === "chrome_id" ? "32-char extension ID" : "e.g. ai writing assistant"}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
            )}
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">Top 10</SelectItem>
                <SelectItem value="25">Top 25</SelectItem>
                <SelectItem value="50">Top 50</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={runDiscovery} disabled={busy} className="col-span-1">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Discover
            </Button>
          </div>
          {history.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2 border-t border-border">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-2 self-center">Recent:</span>
              {history.slice(0, 8).map((h) => (
                <Badge key={h.id} variant="outline" className="cursor-pointer" onClick={() => loadReport(h.id)}>
                  {h.title?.slice(0, 40) ?? h.input_value?.slice(0, 40)}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {competitors.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-10 pb-10 text-center text-muted-foreground text-sm">
            <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
            Enter a keyword, category, Chrome Web Store URL, or extension ID to discover competitors.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Competitor list */}
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Competitors ({competitors.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="divide-y divide-border">
                  {competitors.map((c) => (
                    <button
                      key={c.id ?? c.url}
                      onClick={() => setSelected(c)}
                      className={`w-full text-left px-3 py-2 hover:bg-accent/40 ${selected?.id === c.id ? "bg-accent/60" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] px-1 py-0">#{c.rank}</Badge>
                        <span className="text-xs font-medium truncate flex-1">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        {c.rating && <span className="flex items-center gap-0.5"><Star className="h-2.5 w-2.5" />{c.rating}</span>}
                        {c.users_count && <span className="flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{c.users_count}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Main analysis area */}
          <div>
            {selected && (
              <Card className="mb-4">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {selected.name}
                        <a href={selected.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {selected.developer ?? "Unknown developer"} · {selected.chrome_id ?? "no id"}
                      </CardDescription>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => scrapeCompetitor(selected)} disabled={analyzing === `scrape:${selected.id}`}>
                      {analyzing === `scrape:${selected.id}` ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      Scrape metadata
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            )}

            <Tabs defaultValue="discover">
              <TabsList className="flex flex-wrap h-auto justify-start gap-1">
                <TabsTrigger value="discover"><Search className="h-3 w-3 mr-1" />Discover</TabsTrigger>
                <TabsTrigger value="features"><Layers className="h-3 w-3 mr-1" />Features</TabsTrigger>
                <TabsTrigger value="listing"><FileText className="h-3 w-3 mr-1" />Listing SEO</TabsTrigger>
                <TabsTrigger value="analyze"><BarChart3 className="h-3 w-3 mr-1" />Analyze</TabsTrigger>
                <TabsTrigger value="compete"><Target className="h-3 w-3 mr-1" />Compete</TabsTrigger>
                <TabsTrigger value="build"><Wand2 className="h-3 w-3 mr-1" />Build</TabsTrigger>
                <TabsTrigger value="ship"><Rocket className="h-3 w-3 mr-1" />Ship</TabsTrigger>
                <TabsTrigger value="codebase"><Code2 className="h-3 w-3 mr-1" />Codebase</TabsTrigger>
              </TabsList>

              <TabsContent value="discover" className="mt-4">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Competitor metadata</CardTitle></CardHeader>
                  <CardContent className="text-xs space-y-2">
                    {selected?.raw?.description ? (
                      <ScrollArea className="h-[400px] pr-3">
                        <pre className="whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">{selected.raw.description}</pre>
                      </ScrollArea>
                    ) : (
                      <p className="text-muted-foreground">Click "Scrape metadata" to fetch details.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="features" className="mt-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm">AI Feature Extractor</CardTitle>
                    <Button size="sm" onClick={() => runAnalysis("features")} disabled={analyzing === "features" || !selected?.raw?.description}>
                      {analyzing === "features" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      Extract
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {a("features") ? (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {Object.entries(a("features")).filter(([k]) => k !== "tree").map(([k, v]) => (
                          <div key={k} className="rounded-md border border-border p-2">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{k}</div>
                            <ul className="space-y-0.5">
                              {Array.isArray(v) && v.slice(0, 8).map((f: string, i: number) => (
                                <li key={i} className="text-[11px]">• {f}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Scrape metadata first, then extract features.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="listing" className="mt-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm">Store Listing Analyzer</CardTitle>
                    <Button size="sm" onClick={() => runAnalysis("listing")} disabled={analyzing === "listing" || !selected?.raw?.description}>
                      {analyzing === "listing" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      Analyze
                    </Button>
                  </CardHeader>
                  <CardContent className="text-xs space-y-3">
                    {a("listing") ? (
                      <>
                        <div className="grid grid-cols-5 gap-2">
                          <ScorePill label="Title" value={a("listing").titleScore ?? 0} />
                          <ScorePill label="Description" value={a("listing").descriptionScore ?? 0} />
                          <ScorePill label="SEO" value={a("listing").seoScore ?? 0} />
                          <ScorePill label="Conversion" value={a("listing").conversionScore ?? 0} />
                          <ScorePill label="Visibility" value={a("listing").visibilityScore ?? 0} />
                        </div>
                        <div><strong>Keywords:</strong> {(a("listing").keywords ?? []).join(", ")}</div>
                        <div><strong>CTA:</strong> {a("listing").cta}</div>
                        <div><strong>Improvements:</strong>
                          <ul className="list-disc pl-4 mt-1 space-y-0.5">
                            {(a("listing").improvements ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Scrape metadata first, then analyze the listing.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analyze" className="mt-4 space-y-3">
                {PHASE2.map((m) => (
                  <Card key={m}>
                    <CardHeader className="flex flex-row items-center justify-between py-3">
                      <CardTitle className="text-sm">{m}</CardTitle>
                      <Badge variant="secondary" className="text-[10px]">Phase 2</Badge>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground pb-4">
                      Coming next — click to enable once Phase 1 is validated.
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="compete" className="mt-4 space-y-3">
                {["SWOT", "Feature Gap Finder", "Opportunity Heatmap"].map((m) => (
                  <Card key={m}>
                    <CardHeader className="flex flex-row items-center justify-between py-3">
                      <CardTitle className="text-sm">{m}</CardTitle>
                      <Badge variant="secondary" className="text-[10px]">Phase 2–3</Badge>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground pb-4">Coming after Phase 1 validation.</CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="build" className="mt-4 space-y-3">
                {PHASE3.map((m) => (
                  <Card key={m}>
                    <CardHeader className="flex flex-row items-center justify-between py-3">
                      <CardTitle className="text-sm">{m}</CardTitle>
                      <Badge variant="secondary" className="text-[10px]">Phase 3</Badge>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground pb-4">
                      Original, IP-safe strategy generators. Ships in Phase 3.
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="ship" className="mt-4 space-y-3">
                {PHASE4.map((m) => (
                  <Card key={m}>
                    <CardHeader className="flex flex-row items-center justify-between py-3">
                      <CardTitle className="text-sm">{m}</CardTitle>
                      <Badge variant="secondary" className="text-[10px]">Phase 4</Badge>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground pb-4">
                      Dev prompts (Lovable / Cursor / Windsurf / Claude Code / Gemini CLI / Copilot / Bolt / Replit) + PDF/Excel/CSV/Markdown/JSON exports.
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="codebase" className="mt-4">
                <div className="rounded-lg border border-border">
                  <SoftwareIntelligence />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  );
}
