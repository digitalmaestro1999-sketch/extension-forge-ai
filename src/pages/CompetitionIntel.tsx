import { useEffect, useMemo, useState } from "react";
import { Radar, Loader2, Search, Trash2, Plus, RefreshCw, Sparkles, Download, ExternalLink, TrendingUp, AlertTriangle, Target, Star, FileText, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { exportGapReportPdf } from "@/lib/store-assets/gap-report-pdf";

interface Listing {
  id: string;
  cws_url: string;
  name: string | null;
  developer: string | null;
  category: string | null;
  short_description: string | null;
  rating: number | null;
  rating_count: number | null;
  user_count: string | null;
  version: string | null;
  last_updated: string | null;
  permissions: string[];
  features: string[];
  reviews: string[];
  review_sentiment: { sentiment?: string; themes?: string[]; painPoints?: string[]; praised?: string[] } | null;
  update_cadence: { daysSinceUpdate?: number; freshness?: string } | null;
  scraped_at: string;
}

interface GapReport {
  id: string;
  extension_name: string | null;
  category: string | null;
  competitor_ids: string[];
  summary: string | null;
  missing_features: { feature: string; presentIn?: string[]; impact?: string; effort?: string }[];
  differentiators: { feature: string; why: string }[];
  opportunities: { title: string; rationale: string; action: string; priority: string }[];
  threats: { title: string; detail: string; mitigation: string }[];
  keywords: { keyword: string; usedByCompetitors?: number; recommend?: boolean }[];
  overall_score: number | null;
  created_at: string;
}

function loadFiles(): Record<string, string> {
  try { return JSON.parse(sessionStorage.getItem("extension-files") ?? "{}"); } catch { return {}; }
}
function parseManifest(files: Record<string, string>): any {
  try { return JSON.parse(files["manifest.json"] ?? "{}"); } catch { return {}; }
}

const CATEGORIES = [
  "productivity", "developer-tools", "accessibility", "communication", "education",
  "entertainment", "news-weather", "photos", "search-tools", "shopping",
  "social-networking", "sports", "travel", "well-being",
];

export default function CompetitionIntel() {
  const [category, setCategory] = useState("productivity");
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
  const [singleUrl, setSingleUrl] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [reports, setReports] = useState<GapReport[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [activeReport, setActiveReport] = useState<GapReport | null>(null);

  const [discovering, setDiscovering] = useState(false);
  const [scrapingUrl, setScrapingUrl] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);

  const files = useMemo(loadFiles, []);
  const manifest = useMemo(() => parseManifest(files), [files]);
  const extName = manifest?.name ?? "My Extension";

  useEffect(() => { refresh(); }, []);

  const refresh = async () => {
    const [{ data: l }, { data: r }] = await Promise.all([
      supabase.from("intel_cws_listings").select("*").order("scraped_at", { ascending: false }).limit(100),
      supabase.from("intel_gap_reports").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    setListings((l as unknown as Listing[]) ?? []);
    setReports((r as unknown as GapReport[]) ?? []);
    if (r && r.length && !activeReport) setActiveReport(r[0] as unknown as GapReport);
  };

  const discover = async () => {
    setDiscovering(true);
    setDiscoveredUrls([]);
    try {
      const { data, error } = await supabase.functions.invoke("intel-cws-scrape", { body: { mode: "category", category, limit: 25 } });
      if (error) throw error;
      setDiscoveredUrls(data.listingUrls ?? []);
      toast.success(`Found ${data.listingUrls?.length ?? 0} listings in ${category}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Discovery failed");
    } finally { setDiscovering(false); }
  };

  const scrapeOne = async (url: string) => {
    setScrapingUrl(url);
    try {
      const { data, error } = await supabase.functions.invoke("intel-cws-scrape", { body: { mode: "listing", url, category, provider: "lovable_gateway" } });
      if (error) throw error;
      toast.success(`Scraped: ${data.listing?.name ?? "listing"}`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scrape failed");
    } finally { setScrapingUrl(null); }
  };

  const removeListing = async (id: string) => {
    const { error } = await supabase.from("intel_cws_listings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setListings((l) => l.filter((x) => x.id !== id));
    setSelected(({ [id]: _drop, ...rest }) => rest);
  };

  const runGapAnalysis = async () => {
    const competitorIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (!competitorIds.length) return toast.error("Select at least one competitor");
    setAnalysing(true);
    try {
      const { data, error } = await supabase.functions.invoke("intel-cws-gap-analysis", {
        body: { extensionName: extName, description: manifest?.description, manifest, category, competitorIds },
      });
      if (error) throw error;
      toast.success("Gap analysis ready");
      setActiveReport(data.report);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally { setAnalysing(false); }
  };

  const exportReport = () => {
    if (!activeReport) return;
    const md = renderReportMarkdown(activeReport, listings);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gap-report-${activeReport.id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    if (!activeReport) return;
    try {
      exportGapReportPdf(activeReport, listings);
      toast.success("PDF exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF export failed");
    }
  };

  const cadenceStats = useMemo(() => {
    const buckets = { fresh: 0, aging: 0, stale: 0, unknown: 0 };
    const days: number[] = [];
    for (const l of listings) {
      const f = l.update_cadence?.freshness;
      if (f === "fresh") buckets.fresh++;
      else if (f === "aging") buckets.aging++;
      else if (f === "stale") buckets.stale++;
      else buckets.unknown++;
      const d = l.update_cadence?.daysSinceUpdate;
      if (typeof d === "number") days.push(d);
    }
    const sorted = [...days].sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
    const avg = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null;
    const chartData = [
      { bucket: "Fresh (<90d)", count: buckets.fresh, fill: "hsl(142 71% 45%)" },
      { bucket: "Aging (90-180d)", count: buckets.aging, fill: "hsl(38 92% 50%)" },
      { bucket: "Stale (>180d)", count: buckets.stale, fill: "hsl(0 84% 60%)" },
      { bucket: "Unknown", count: buckets.unknown, fill: "hsl(240 5% 50%)" },
    ];
    return { buckets, median, avg, chartData, total: listings.length };
  }, [listings]);

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Radar className="h-8 w-8 text-primary" />
            Competition Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">Scrape Chrome Web Store listings, analyse competitors, and get a shippable gap report for <span className="font-medium text-foreground">{extName}</span>.</p>
        </div>
        <Button variant="outline" onClick={refresh}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
      </div>

      <Tabs defaultValue="discover" className="space-y-4">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="discover"><Search className="h-4 w-4 mr-2" />Discover & Scrape</TabsTrigger>
          <TabsTrigger value="competitors"><Star className="h-4 w-4 mr-2" />Competitors ({listings.length})</TabsTrigger>
          <TabsTrigger value="report"><Target className="h-4 w-4 mr-2" />Gap Report</TabsTrigger>
        </TabsList>

        {/* DISCOVER */}
        <TabsContent value="discover" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Discover CWS category</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[200px] space-y-1.5">
                  <Label>Category</Label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <Button onClick={discover} disabled={discovering}>
                  {discovering ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Discover
                </Button>
              </div>
              {discoveredUrls.length > 0 && (
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                  <p className="text-sm text-muted-foreground">{discoveredUrls.length} listings — click to scrape.</p>
                  {discoveredUrls.map((u) => (
                    <div key={u} className="flex items-center gap-2 p-2 rounded border border-border bg-card/50">
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <a href={u} target="_blank" rel="noreferrer" className="text-xs truncate flex-1 hover:text-primary">{u}</a>
                      <Button size="sm" variant="outline" onClick={() => scrapeOne(u)} disabled={scrapingUrl === u}>
                        {scrapingUrl === u ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Scrape a specific listing</CardTitle></CardHeader>
            <CardContent className="flex gap-2">
              <Input placeholder="https://chromewebstore.google.com/detail/…" value={singleUrl} onChange={(e) => setSingleUrl(e.target.value)} />
              <Button onClick={() => singleUrl && scrapeOne(singleUrl)} disabled={!singleUrl || scrapingUrl === singleUrl}>
                {scrapingUrl === singleUrl ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Scrape
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COMPETITORS */}
        <TabsContent value="competitors" className="space-y-4">
          {listings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-primary" />
                  Update Cadence Trends
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <div className="p-2 rounded bg-card/50 border border-border">
                    <p className="text-xs text-muted-foreground">Tracked</p>
                    <p className="text-lg font-semibold">{cadenceStats.total}</p>
                  </div>
                  <div className="p-2 rounded bg-emerald-500/5 border border-emerald-500/30">
                    <p className="text-xs text-muted-foreground">Fresh</p>
                    <p className="text-lg font-semibold text-emerald-500">{cadenceStats.buckets.fresh}</p>
                  </div>
                  <div className="p-2 rounded bg-amber-500/5 border border-amber-500/30">
                    <p className="text-xs text-muted-foreground">Aging</p>
                    <p className="text-lg font-semibold text-amber-500">{cadenceStats.buckets.aging}</p>
                  </div>
                  <div className="p-2 rounded bg-red-500/5 border border-red-500/30">
                    <p className="text-xs text-muted-foreground">Stale</p>
                    <p className="text-lg font-semibold text-red-500">{cadenceStats.buckets.stale}</p>
                  </div>
                  <div className="p-2 rounded bg-card/50 border border-border">
                    <p className="text-xs text-muted-foreground">Median / Avg days</p>
                    <p className="text-lg font-semibold">
                      {cadenceStats.median ?? "—"} <span className="text-xs text-muted-foreground">/ {cadenceStats.avg ?? "—"}</span>
                    </p>
                  </div>
                </div>
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cadenceStats.chartData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
                      <XAxis dataKey="bucket" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                        cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {cadenceStats.chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground">
                  Extensions updated within 90 days signal active maintenance — a Google review positive. Stale competitors ({">"}180d) are opportunities to out-ship.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle>Scraped competitors</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{selectedCount} selected</span>
                <Button size="sm" onClick={runGapAnalysis} disabled={!selectedCount || analysing}>
                  {analysing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Run Gap Analysis <Badge variant="secondary" className="ml-2 text-[10px] py-0 h-4">Lovable AI Routed</Badge>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {!listings.length && <p className="text-sm text-muted-foreground text-center py-8">No competitors scraped yet. Head to Discover.</p>}
              {listings.map((l) => (
                <div key={l.id} className="flex items-start gap-3 p-3 rounded border border-border bg-card/50">
                  <Checkbox checked={!!selected[l.id]} onCheckedChange={(v) => setSelected((s) => ({ ...s, [l.id]: !!v }))} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{l.name ?? "(unknown)"}</p>
                      {l.developer && <span className="text-xs text-muted-foreground">by {l.developer}</span>}
                      {l.rating && (
                        <Badge variant="outline" className="text-xs">
                          <Star className="h-3 w-3 mr-1 fill-amber-400 text-amber-400" />
                          {l.rating} {l.rating_count ? `(${l.rating_count.toLocaleString()})` : ""}
                        </Badge>
                      )}
                      {l.user_count && <Badge variant="outline" className="text-xs">{l.user_count} users</Badge>}
                      {l.update_cadence?.freshness && (
                        <Badge variant="outline" className={`text-xs ${l.update_cadence.freshness === "stale" ? "text-red-500" : l.update_cadence.freshness === "aging" ? "text-amber-500" : "text-emerald-500"}`}>
                          {l.update_cadence.freshness}
                        </Badge>
                      )}
                      {l.review_sentiment?.sentiment && (
                        <Badge variant="outline" className={`text-xs ${l.review_sentiment.sentiment === "positive" ? "text-emerald-500" : l.review_sentiment.sentiment === "negative" ? "text-red-500" : "text-amber-500"}`}>
                          {l.review_sentiment.sentiment}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{l.short_description ?? "—"}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {l.permissions.slice(0, 6).map((p, i) => <Badge key={i} variant="secondary" className="text-[10px]">{p}</Badge>)}
                      {l.permissions.length > 6 && <span className="text-[10px] text-muted-foreground">+{l.permissions.length - 6}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" asChild><a href={l.cws_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a></Button>
                    <Button size="sm" variant="ghost" onClick={() => removeListing(l.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* REPORT */}
        <TabsContent value="report" className="space-y-4">
          {reports.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-sm">Report:</Label>
              <select
                value={activeReport?.id ?? ""}
                onChange={(e) => setActiveReport(reports.find((r) => r.id === e.target.value) ?? null)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>{new Date(r.created_at).toLocaleString()} · {r.competitor_ids.length} competitors</option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={exportReport} disabled={!activeReport}><Download className="h-4 w-4 mr-2" />Export MD</Button>
              <Button size="sm" onClick={exportPdf} disabled={!activeReport}><FileText className="h-4 w-4 mr-2" />Export PDF</Button>
            </div>
          )}

          {!activeReport && (
            <Card><CardContent className="p-10 text-center text-muted-foreground">No gap report yet. Select competitors and run analysis.</CardContent></Card>
          )}

          {activeReport && (
            <>
              <Card>
                <CardHeader><CardTitle>Positioning</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {typeof activeReport.overall_score === "number" && (
                    <div>
                      <div className="flex justify-between text-sm mb-1"><span>Competitive score</span><span className="font-semibold">{activeReport.overall_score}/100</span></div>
                      <Progress value={activeReport.overall_score} />
                    </div>
                  )}
                  <p className="text-sm">{activeReport.summary ?? "—"}</p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" />Missing Features</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {activeReport.missing_features.length === 0 && <p className="text-sm text-muted-foreground">None identified.</p>}
                    {activeReport.missing_features.map((f, i) => (
                      <div key={i} className="p-2 rounded border border-border bg-card/50">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{f.feature}</p>
                          {f.impact && <Badge variant="outline" className={`text-[10px] ${f.impact === "high" ? "text-red-500" : f.impact === "medium" ? "text-amber-500" : ""}`}>impact {f.impact}</Badge>}
                          {f.effort && <Badge variant="outline" className="text-[10px]">effort {f.effort}</Badge>}
                        </div>
                        {f.presentIn?.length ? <p className="text-xs text-muted-foreground mt-1">Seen in: {f.presentIn.join(", ")}</p> : null}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" />Differentiators</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {activeReport.differentiators.length === 0 && <p className="text-sm text-muted-foreground">None identified.</p>}
                    {activeReport.differentiators.map((d, i) => (
                      <div key={i} className="p-2 rounded border border-border bg-card/50">
                        <p className="text-sm font-medium">{d.feature}</p>
                        <p className="text-xs text-muted-foreground mt-1">{d.why}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-500" />Opportunities</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {activeReport.opportunities.map((o, i) => (
                      <div key={i} className="p-2 rounded border border-border bg-card/50">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{o.priority}</Badge>
                          <p className="text-sm font-medium">{o.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{o.rationale}</p>
                        <p className="text-xs mt-1"><span className="font-medium">Action:</span> {o.action}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" />Threats</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {activeReport.threats.map((t, i) => (
                      <div key={i} className="p-2 rounded border border-border bg-card/50">
                        <p className="text-sm font-medium">{t.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t.detail}</p>
                        <p className="text-xs mt-1"><span className="font-medium">Mitigation:</span> {t.mitigation}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {activeReport.keywords.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Keyword gaps</CardTitle></CardHeader>
                  <CardContent className="flex flex-wrap gap-1.5">
                    {activeReport.keywords.map((k, i) => (
                      <Badge key={i} variant={k.recommend ? "default" : "secondary"} className="text-xs">
                        {k.keyword}{typeof k.usedByCompetitors === "number" ? ` · ${k.usedByCompetitors}` : ""}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function renderReportMarkdown(r: GapReport, listings: Listing[]): string {
  const comps = listings.filter((l) => r.competitor_ids.includes(l.id));
  const lines: string[] = [];
  lines.push(`# Competitive Gap Report — ${r.extension_name ?? "extension"}`);
  lines.push(`_Generated ${new Date(r.created_at).toISOString()}_`);
  if (typeof r.overall_score === "number") lines.push(`\n**Competitive score:** ${r.overall_score}/100`);
  if (r.summary) lines.push(`\n${r.summary}`);
  lines.push(`\n## Competitors (${comps.length})`);
  comps.forEach((c) => lines.push(`- [${c.name ?? "unknown"}](${c.cws_url}) — ${c.rating ?? "?"}★ (${c.rating_count ?? 0}), ${c.user_count ?? "?"} users`));
  const sec = (title: string, items: unknown[]) => {
    if (!items?.length) return;
    lines.push(`\n## ${title}`);
    lines.push("```json"); lines.push(JSON.stringify(items, null, 2)); lines.push("```");
  };
  sec("Missing features", r.missing_features);
  sec("Differentiators", r.differentiators);
  sec("Opportunities", r.opportunities);
  sec("Threats", r.threats);
  sec("Keywords", r.keywords);
  return lines.join("\n");
}
