import { useEffect, useState } from "react";
import {
  Brain, Search, Sparkles, Loader2, ExternalLink, Star, Users, ShieldAlert,
  Layers, Target, Lightbulb, Building2, Wand2, DollarSign, Palette, ListChecks,
  FileText, Rocket, BarChart3, Trophy, Flame, Terminal, Download, Code2, Package,
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
import jsPDF from "jspdf";
import JSZip from "jszip";

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
  const [fullRun, setFullRun] = useState<{ stage: string; done: number; total: number } | null>(null);

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
        ? {
            name: comp!.name,
            description: comp!.raw?.description,
            url: comp!.url,
            developer: comp!.developer,
            rating: comp!.rating,
            users: comp!.users_count,
            reviews_raw: comp!.raw?.reviews_raw ?? [],
          }
        : { competitors: competitors.map(c => ({ name: c.name, description: c.raw?.description, rating: c.rating, users: c.users_count })) };
      const { data, error } = await supabase.functions.invoke("ext-intel-analyze", {
        body: { stage, input, report_id: reportId, competitor_id: comp?.id ?? null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const k = stage + (comp?.id ? `:${comp.id}` : "");
      setAnalyses((prev) => ({ ...prev, [k]: data.result }));
      toast.success(`${stage} complete`);
    } catch (e: any) {
      toast.error(e.message ?? `${stage} failed`);
    } finally { setAnalyzing(null); }
  }

  async function runVision() {
    if (!reportId || !selected?.id) { toast.error("Select a competitor first"); return; }
    const shot = selected.raw?.screenshot_url;
    if (!shot) { toast.error("Scrape metadata first to capture the screenshot"); return; }
    setAnalyzing("screenshots");
    try {
      const { data, error } = await supabase.functions.invoke("ext-intel-vision", {
        body: { screenshot_url: shot, competitor_name: selected.name, report_id: reportId, competitor_id: selected.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnalyses((prev) => ({ ...prev, [`screenshots:${selected.id}`]: data.result }));
      toast.success("Screenshot analysis complete");
    } catch (e: any) {
      toast.error(e.message ?? "Vision failed");
    } finally { setAnalyzing(null); }
  }



  async function runFullReport() {
    if (!reportId || !selected?.id) { toast.error("Select a competitor first"); return; }
    const compStages = ["features","listing","reviews","sentiment","security","swot","scorecard","innovation","architecture","monetization","ux","prioritizer","blueprint","buildBetter","prompts"];
    const reportStages: Array<[string, "report"]> = [["gaps","report"], ["heatmap","report"]];
    const total = 1 /*scrape*/ + 1 /*vision*/ + compStages.length + reportStages.length;
    let done = 0;
    setFullRun({ stage: "starting", done, total });
    try {
      // 1. scrape if needed
      if (!selected.raw?.description) {
        setFullRun({ stage: "scrape metadata", done, total });
        await scrapeCompetitor(selected);
      }
      done++;
      // reload to get freshly scraped raw
      const { data: comps } = await supabase.from("intel_competitors").select("*").eq("id", selected.id).single();
      const fresh = comps as any;
      // 2. vision if screenshot present
      if (fresh?.raw?.screenshot_url) {
        setFullRun({ stage: "screenshot vision", done, total });
        try {
          const { data } = await supabase.functions.invoke("ext-intel-vision", {
            body: { screenshot_url: fresh.raw.screenshot_url, competitor_name: fresh.name, report_id: reportId, competitor_id: fresh.id },
          });
          if (data?.result) setAnalyses((p) => ({ ...p, [`screenshots:${fresh.id}`]: data.result }));
        } catch { /* keep going */ }
      }
      done++; setFullRun({ stage: "screenshot vision", done, total });

      const input = {
        name: fresh.name, description: fresh.raw?.description, url: fresh.url,
        developer: fresh.developer, rating: fresh.rating, users: fresh.users_count,
        reviews_raw: fresh.raw?.reviews_raw ?? [],
      };
      for (const stage of compStages) {
        setFullRun({ stage, done, total });
        try {
          const { data } = await supabase.functions.invoke("ext-intel-analyze", {
            body: { stage, input, report_id: reportId, competitor_id: fresh.id },
          });
          if (data?.result) setAnalyses((p) => ({ ...p, [`${stage}:${fresh.id}`]: data.result }));
        } catch { /* continue */ }
        done++;
      }
      const reportInput = { competitors: competitors.map(c => ({ name: c.name, description: c.raw?.description, rating: c.rating, users: c.users_count })) };
      for (const [stage] of reportStages) {
        setFullRun({ stage, done, total });
        try {
          const { data } = await supabase.functions.invoke("ext-intel-analyze", {
            body: { stage, input: reportInput, report_id: reportId, competitor_id: null },
          });
          if (data?.result) setAnalyses((p) => ({ ...p, [stage]: data.result }));
        } catch { /* continue */ }
        done++;
      }
      setFullRun({ stage: "complete", done: total, total });
      toast.success("Full report complete");
    } catch (e: any) {
      toast.error(e.message ?? "Full report failed");
    } finally {
      setTimeout(() => setFullRun(null), 2000);
    }
  }

  function exportMarkdown() {
    if (!reportId) return;
    const lines: string[] = [];
    lines.push(`# Extension Intelligence Report`);
    lines.push(`\nGenerated: ${new Date().toISOString()}\n`);
    lines.push(`## Competitors (${competitors.length})\n`);
    competitors.forEach((c, i) => {
      lines.push(`${i + 1}. **${c.name}** — ${c.developer ?? "?"} · ★${c.rating ?? "?"} · ${c.users_count ?? "?"} users\n   ${c.url}`);
    });
    Object.entries(analyses).forEach(([k, v]) => {
      const [mod, cid] = k.split(":");
      const label = cid ? competitors.find(c => c.id === cid)?.name ?? cid : "Report";
      lines.push(`\n## ${mod} — ${label}\n`);
      lines.push("```json\n" + JSON.stringify(v, null, 2) + "\n```");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url; el.download = `intel-report-${reportId}.md`; el.click();
    URL.revokeObjectURL(url);
    toast.success("Markdown exported");
  }

  function exportPDF() {
    if (!reportId) return;
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    let y = 48;
    const write = (text: string, size = 10, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(text, pageW - 96);
      for (const ln of lines) {
        if (y > pageH - 48) { doc.addPage(); y = 48; }
        doc.text(ln, 48, y); y += size + 4;
      }
    };
    write("Extension Intelligence Report", 18, true);
    write(new Date().toLocaleString(), 9);
    y += 6;
    write(`Competitors (${competitors.length})`, 13, true);
    competitors.forEach((c, i) => write(`${i + 1}. ${c.name} — ${c.developer ?? "?"} · ★${c.rating ?? "?"} · ${c.users_count ?? "?"} users`, 10));
    Object.entries(analyses).forEach(([k, v]) => {
      const [mod, cid] = k.split(":");
      const label = cid ? competitors.find(c => c.id === cid)?.name ?? cid : "Report";
      y += 10;
      write(`${mod} — ${label}`, 13, true);
      write(JSON.stringify(v, null, 2).slice(0, 4000), 8);
    });
    doc.save(`intel-report-${reportId}.pdf`);
    toast.success("PDF exported");
  }

  // Tiny 1x1 transparent PNG (base64) — placeholder icons users can replace
  const PLACEHOLDER_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

  async function generateExtension() {
    if (!reportId || !selected?.id) { toast.error("Select a competitor first"); return; }
    const blueprint = a("blueprint");
    const buildBetter = a("buildBetter");
    const architecture = a("architecture");
    if (!blueprint && !buildBetter && !architecture) {
      toast.error("Generate Blueprint, Build Better, or Architecture first (Build tab)");
      return;
    }
    setAnalyzing("generate");
    try {
      const { data, error } = await supabase.functions.invoke("ext-intel-generate", {
        body: {
          blueprint, buildBetter, architecture,
          competitor_name: selected.name,
          category: selected.raw?.category ?? null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const result = data.result;
      const files: Record<string, string> = result.files ?? {};
      if (!files["manifest.json"]) throw new Error("Generator did not return manifest.json");

      const zip = new JSZip();
      Object.entries(files).forEach(([path, content]) => zip.file(path, content));
      // Add placeholder icons (binary)
      const iconBinary = Uint8Array.from(atob(PLACEHOLDER_PNG), c => c.charCodeAt(0));
      zip.file("icon16.png", iconBinary);
      zip.file("icon48.png", iconBinary);
      zip.file("icon128.png", iconBinary);
      zip.file("INSTALL.txt",
        `Install unpacked:\n1. Unzip this folder.\n2. Open chrome://extensions\n3. Toggle Developer mode (top-right).\n4. Click "Load unpacked" and select the unzipped folder.\n\nReplace icon16/48/128.png with real icons before publishing.`);

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      const safeName = (result.name ?? "extension").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      el.href = url; el.download = `${safeName}.zip`; el.click();
      URL.revokeObjectURL(url);

      setAnalyses((prev) => ({ ...prev, [`generated:${selected.id}`]: result }));
      toast.success(`Generated "${result.name}" — ready to load unpacked`);
    } catch (e: any) {
      toast.error(e.message ?? "Generation failed");
    } finally { setAnalyzing(null); }
  }

  async function generateIcons() {
    if (!reportId || !selected?.id) { toast.error("Select a competitor first"); return; }
    const kit = a("storekit");
    const iconPrompt = kit?.iconPrompt;
    const extName = kit?.listing?.title ?? selected.name;
    setAnalyzing("icons");
    try {
      const { data, error } = await supabase.functions.invoke("ext-intel-icon", {
        body: { prompt: iconPrompt, extension_name: extName },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const b64 = data.image_base64 as string;
      const src = `data:image/png;base64,${b64}`;
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to decode icon"));
        img.src = src;
      });

      async function resize(size: number): Promise<Blob> {
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, size, size);
        return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
      }

      const zip = new JSZip();
      const [i16, i48, i128, i512] = await Promise.all([resize(16), resize(48), resize(128), resize(512)]);
      zip.file("icon16.png", await i16.arrayBuffer());
      zip.file("icon48.png", await i48.arrayBuffer());
      zip.file("icon128.png", await i128.arrayBuffer());
      zip.file("icon512.png", await i512.arrayBuffer());
      zip.file("README.txt", `AI-generated icons for "${extName}".\nReplace the placeholder icon*.png files in your extension folder with these before publishing.\nAlso use icon512.png as a source for CWS store artwork.`);

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      const safe = (extName ?? "extension").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      el.href = url; el.download = `${safe}-icons.zip`; el.click();
      URL.revokeObjectURL(url);

      setAnalyses((prev) => ({ ...prev, [`icons:${selected.id}`]: { preview: src } }));
      toast.success("Icons generated (16/48/128/512)");
    } catch (e: any) {
      toast.error(e.message ?? "Icon generation failed");
    } finally { setAnalyzing(null); }
  }

  async function generateStoreKit() {
    if (!reportId || !selected?.id) { toast.error("Select a competitor first"); return; }
    setAnalyzing("storekit");
    try {
      const { data, error } = await supabase.functions.invoke("ext-intel-store-kit", {
        body: {
          blueprint: a("blueprint"),
          buildBetter: a("buildBetter"),
          listing: a("listing"),
          competitor_name: selected.name,
          category: selected.raw?.category ?? null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const kit = data.result;

      const zip = new JSZip();
      const l = kit.listing ?? {};
      zip.file("00-README.md",
`# Chrome Web Store Publish Kit
Generated ${new Date().toISOString()}

Contents:
- listing.md — title, descriptions, category, keywords
- privacy-policy.md — host this at a public URL and link it in the CWS listing
- permissions.md — justification for every permission (paste into CWS review notes)
- single-purpose.txt — required single-purpose statement
- data-usage.json — data disclosure form answers
- icon-brief.md — icon generation prompt
- promo-tiles.md — 440x280 / 920x680 / 1400x560 concepts
- screenshots.md — screenshot brief (1280x800 or 640x400)

All copy is original and IP-safe.`);

      zip.file("listing.md",
`# ${l.title ?? ""}

**Category:** ${l.category ?? ""}
**Language:** ${l.language ?? "en"}

## Short description
${l.shortDescription ?? ""}

## Detailed description
${l.detailedDescription ?? ""}

## Keywords
${(l.keywords ?? []).join(", ")}`);

      zip.file("privacy-policy.md", kit.privacyPolicy ?? "");
      zip.file("single-purpose.txt", kit.singlePurpose ?? "");

      const perms = (kit.permissionsJustification ?? []).map((p: any) =>
        `## ${p.permission}\n**Why:** ${p.why}\n**Minimal alternative:** ${p.minimalAlternative}\n`).join("\n");
      zip.file("permissions.md", `# Permissions Justification\n\n${perms}`);

      zip.file("data-usage.json", JSON.stringify(kit.dataUsageDisclosure ?? {}, null, 2));
      zip.file("icon-brief.md", `# Icon Brief (128×128)\n\n${kit.iconPrompt ?? ""}`);

      const tiles = (kit.promoTileConcepts ?? []).map((t: any) =>
        `## ${t.size}\n${t.concept}\n`).join("\n");
      zip.file("promo-tiles.md", `# Promotional Tile Concepts\n\n${tiles}`);

      const shots = (kit.screenshots ?? []).map((s: any, i: number) =>
        `## ${i + 1}. ${s.filename}\n**Size:** ${s.size}\n**Caption:** ${s.caption}\n**Content:** ${s.content}\n`).join("\n");
      zip.file("screenshots.md", `# Screenshot Brief\n\n${shots}`);

      zip.file("raw-kit.json", JSON.stringify(kit, null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      const safe = (l.title ?? "extension").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      el.href = url; el.download = `${safe}-cws-kit.zip`; el.click();
      URL.revokeObjectURL(url);

      setAnalyses((prev) => ({ ...prev, [`storekit:${selected.id}`]: kit }));
      toast.success("Publish kit ready");
    } catch (e: any) {
      toast.error(e.message ?? "Store kit failed");
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
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => scrapeCompetitor(selected)} disabled={analyzing === `scrape:${selected.id}`}>
                        {analyzing === `scrape:${selected.id}` ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                        Scrape metadata
                      </Button>
                      <Button size="sm" onClick={runFullReport} disabled={!!fullRun}>
                        {fullRun ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Rocket className="h-3 w-3 mr-1" />}
                        Run Full Report
                      </Button>
                    </div>
                  </div>
                  {fullRun && (
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{fullRun.stage}</span>
                        <span>{fullRun.done}/{fullRun.total}</span>
                      </div>
                      <Progress value={(fullRun.done / fullRun.total) * 100} className="h-1.5" />
                    </div>
                  )}
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
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm flex items-center gap-2"><Palette className="h-4 w-4" />Screenshot Intelligence</CardTitle>
                    <Button size="sm" onClick={runVision} disabled={analyzing === "screenshots" || !selected?.raw?.screenshot_url}>
                      {analyzing === "screenshots" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      Analyze UI
                    </Button>
                  </CardHeader>
                  <CardContent className="text-xs space-y-3">
                    {selected?.raw?.screenshot_url && (
                      <img src={selected.raw.screenshot_url} alt="listing screenshot" className="w-full max-h-64 object-contain rounded border border-border bg-black/20" />
                    )}
                    {a("screenshots") ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div><strong>Layout:</strong> {a("screenshots").uiLayout}</div>
                          <div><strong>Navigation:</strong> {a("screenshots").navigation}</div>
                          <div><strong>Typography:</strong> {a("screenshots").typography}</div>
                          <div><strong>Dark mode:</strong> {String(a("screenshots").darkMode)}</div>
                        </div>
                        {a("screenshots").colorPalette?.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <strong>Palette:</strong>
                            {a("screenshots").colorPalette.map((c: string, i: number) => (
                              <div key={i} className="flex items-center gap-1">
                                <div className="h-4 w-4 rounded border border-border" style={{ background: c }} />
                                <span className="text-[10px] font-mono">{c}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div><strong>Wireframe:</strong> {a("screenshots").wireframeDescription}</div>
                        <div>
                          <strong>Modernization ideas:</strong>
                          <ul className="list-disc pl-4 mt-1">
                            {(a("screenshots").modernizationIdeas ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                      </div>
                    ) : <p className="text-muted-foreground">Scrape metadata (captures screenshot) then click Analyze UI.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm flex items-center gap-2"><ListChecks className="h-4 w-4" />Review Intelligence</CardTitle>
                    <Button size="sm" onClick={() => runAnalysis("reviews")} disabled={analyzing === "reviews" || !selected?.raw?.description}>
                      {analyzing === "reviews" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      Cluster
                    </Button>
                  </CardHeader>
                  <CardContent className="text-xs space-y-2">
                    <p className="text-muted-foreground text-[10px]">
                      {selected?.raw?.reviews_raw?.length
                        ? `${selected.raw.reviews_raw.length} review fragments captured.`
                        : "Captures publicly visible review fragments from the listing page."}
                    </p>
                    {a("reviews") ? (
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(a("reviews")).map(([k, v]) => (
                          <div key={k} className="rounded border border-border p-2">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{k}</div>
                            <ul className="space-y-0.5">
                              {Array.isArray(v) && v.slice(0, 6).map((s: string, i: number) => <li key={i}>• {s}</li>)}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm flex items-center gap-2"><Flame className="h-4 w-4" />Sentiment AI</CardTitle>
                    <Button size="sm" onClick={() => runAnalysis("sentiment")} disabled={analyzing === "sentiment" || !selected?.raw?.description}>
                      {analyzing === "sentiment" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      Score
                    </Button>
                  </CardHeader>
                  <CardContent className="text-xs">
                    {a("sentiment") ? (
                      <div className="grid grid-cols-5 gap-2">
                        <ScorePill label="Satisfaction" value={a("sentiment").satisfaction ?? 0} />
                        <ScorePill label="Frustration" value={a("sentiment").frustrationIndex ?? 0} />
                        <ScorePill label="Demand" value={a("sentiment").featureDemandIndex ?? 0} />
                        <ScorePill label="Bug severity" value={a("sentiment").bugSeverity ?? 0} />
                        <ScorePill label="Market happy" value={a("sentiment").marketHappiness ?? 0} />
                      </div>
                    ) : <p className="text-muted-foreground">Emotion, satisfaction, frustration, demand — from review fragments.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm flex items-center gap-2"><ShieldAlert className="h-4 w-4" />Security Intelligence</CardTitle>
                    <Button size="sm" onClick={() => runAnalysis("security")} disabled={analyzing === "security" || !selected?.raw?.description}>
                      {analyzing === "security" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      Audit
                    </Button>
                  </CardHeader>
                  <CardContent className="text-xs space-y-2">
                    {a("security") ? (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <ScorePill label="Security" value={a("security").securityScore ?? 0} />
                          <ScorePill label="Privacy" value={a("security").privacyScore ?? 0} />
                          <ScorePill label="Trust" value={a("security").trustScore ?? 0} />
                        </div>
                        {(a("security").riskyPermissions ?? []).map((p: any, i: number) => (
                          <div key={i} className="rounded border border-border p-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={p.risk === "high" ? "destructive" : "secondary"} className="text-[9px]">{p.risk}</Badge>
                              <span className="font-mono">{p.name}</span>
                            </div>
                            <div className="mt-1">{p.reason}</div>
                            <div className="text-muted-foreground mt-0.5">→ {p.alternative}</div>
                          </div>
                        ))}
                      </>
                    ) : <p className="text-muted-foreground">Audit permissions, CSP posture, and privacy risk.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4" />Competitive Scorecard</CardTitle>
                    <Button size="sm" onClick={() => runAnalysis("scorecard")} disabled={analyzing === "scorecard" || !selected?.raw?.description}>
                      {analyzing === "scorecard" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      Score
                    </Button>
                  </CardHeader>
                  <CardContent className="text-xs">
                    {a("scorecard")?.scores ? (
                      <div className="grid grid-cols-5 gap-2">
                        {Object.entries(a("scorecard").scores).map(([k, v]) => (
                          <ScorePill key={k} label={k} value={Number(v) || 0} />
                        ))}
                      </div>
                    ) : <p className="text-muted-foreground">Rank across 20 dimensions.</p>}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="compete" className="mt-4 space-y-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" />SWOT Analysis</CardTitle>
                    <Button size="sm" onClick={() => runAnalysis("swot")} disabled={analyzing === "swot" || !selected?.raw?.description}>
                      {analyzing === "swot" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      Generate
                    </Button>
                  </CardHeader>
                  <CardContent className="text-xs">
                    {a("swot") ? (
                      <div className="grid grid-cols-2 gap-2">
                        {(["strengths","weaknesses","opportunities","threats"] as const).map((k) => (
                          <div key={k} className={`rounded border p-2 ${
                            k === "strengths" ? "border-emerald-400/40 bg-emerald-400/5" :
                            k === "weaknesses" ? "border-rose-400/40 bg-rose-400/5" :
                            k === "opportunities" ? "border-sky-400/40 bg-sky-400/5" :
                            "border-amber-400/40 bg-amber-400/5"
                          }`}>
                            <div className="text-[10px] uppercase tracking-wider mb-1 font-semibold">{k}</div>
                            <ul className="space-y-0.5">
                              {(a("swot")[k] ?? []).map((s: string, i: number) => <li key={i}>• {s}</li>)}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-muted-foreground">Strengths, weaknesses, opportunities, threats.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div>
                      <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" />Feature Gap Finder</CardTitle>
                      <CardDescription className="text-[10px]">Cross-competitor diff across the whole report.</CardDescription>
                    </div>
                    <Button size="sm" onClick={() => runAnalysis("gaps", "report")} disabled={analyzing === "gaps" || competitors.length === 0}>
                      {analyzing === "gaps" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      Find gaps
                    </Button>
                  </CardHeader>
                  <CardContent className="text-xs">
                    {analyses["gaps"] ? (
                      <div className="space-y-2">
                        <div className="rounded border border-primary/30 bg-primary/5 p-2">
                          <strong>Summary:</strong> {analyses["gaps"].summary}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(analyses["gaps"]).filter(([k]) => k !== "summary").map(([k, v]) => (
                            <div key={k} className="rounded border border-border p-2">
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{k}</div>
                              <ul className="space-y-0.5">
                                {Array.isArray(v) && v.slice(0, 8).map((s: string, i: number) => <li key={i}>• {s}</li>)}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : <p className="text-muted-foreground">Identify what all competitors are missing — your differentiation opportunities.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm flex items-center gap-2"><Flame className="h-4 w-4" />Opportunity Heatmap</CardTitle>
                    <Button size="sm" onClick={() => runAnalysis("heatmap", "report")} disabled={analyzing === "heatmap" || competitors.length === 0}>
                      {analyzing === "heatmap" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      Build
                    </Button>
                  </CardHeader>
                  <CardContent className="text-xs">
                    {analyses["heatmap"]?.cells ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-left text-muted-foreground border-b border-border">
                              <th className="py-1 pr-2">Niche</th>
                              <th className="py-1 px-1">AI ready</th>
                              <th className="py-1 px-1">Demand</th>
                              <th className="py-1 px-1">Competition</th>
                              <th className="py-1 px-1">Revenue</th>
                              <th className="py-1 px-1">Complexity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analyses["heatmap"].cells.map((c: any, i: number) => (
                              <tr key={i} className="border-b border-border/50">
                                <td className="py-1 pr-2 font-medium">{c.niche}</td>
                                {["aiReadiness","userDemand","competitionLevel","revenuePotential","complexity"].map((k) => {
                                  const v = Number(c[k]) || 0;
                                  const bg = v >= 75 ? "bg-emerald-500/30" : v >= 50 ? "bg-amber-500/30" : v >= 25 ? "bg-orange-500/30" : "bg-rose-500/30";
                                  return <td key={k} className={`py-1 px-1 text-center ${bg}`}>{v}</td>;
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <p className="text-muted-foreground">Map niche opportunities across AI readiness, demand, competition, revenue, complexity.</p>}
                  </CardContent>
                </Card>
              </TabsContent>


              <TabsContent value="build" className="mt-4 space-y-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="h-4 w-4" />Innovation Engine</CardTitle>
                    <Button size="sm" onClick={() => runAnalysis("innovation")} disabled={analyzing === "innovation" || !selected?.raw?.description}>
                      {analyzing === "innovation" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      Ideate
                    </Button>
                  </CardHeader>
                  <CardContent className="text-xs">
                    {a("innovation")?.ideas ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {a("innovation").ideas.map((idea: any, i: number) => (
                          <div key={i} className="rounded border border-border p-2 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold">{idea.title}</span>
                              <Badge variant="outline" className="text-[9px]">{idea.category}</Badge>
                            </div>
                            <p className="text-muted-foreground">{idea.description}</p>
                            <div className="flex gap-3 text-[10px]">
                              <span>Novelty <strong className="text-primary">{idea.novelty}</strong></span>
                              <span>Impact <strong className="text-primary">{idea.impact}</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-muted-foreground">Generate brand-new, IP-safe feature ideas nobody in the category has shipped.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" />Architecture</CardTitle>
                    <Button size="sm" onClick={() => runAnalysis("architecture")} disabled={analyzing === "architecture" || !selected?.raw?.description}>
                      {analyzing === "architecture" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      Design
                    </Button>
                  </CardHeader>
                  <CardContent className="text-xs">
                    {a("architecture") ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {Object.entries(a("architecture")).map(([k, v]) => (
                          <div key={k} className="rounded border border-border p-2">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{k}</div>
                            <pre className="whitespace-pre-wrap font-mono text-[10px]">{typeof v === "string" ? v : JSON.stringify(v, null, 2)}</pre>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-muted-foreground">Original Manifest V3 architecture blueprint — folders, messaging, permissions, storage.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" />Monetization</CardTitle>
                    <Button size="sm" onClick={() => runAnalysis("monetization")} disabled={analyzing === "monetization" || !selected?.raw?.description}>
                      {analyzing === "monetization" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      Model
                    </Button>
                  </CardHeader>
                  <CardContent className="text-xs space-y-2">
                    {a("monetization") ? (
                      <>
                        <div><strong>Current:</strong> {(a("monetization").current ?? []).join(", ")}</div>
                        <div className="rounded border border-primary/30 bg-primary/5 p-2">
                          <div><strong>Recommended:</strong> {a("monetization").recommended?.model}</div>
                          <div><strong>Pricing:</strong> {a("monetization").recommended?.pricing}</div>
                          <div className="text-muted-foreground mt-1">{a("monetization").recommended?.rationale}</div>
                        </div>
                        <div><strong>Revenue projection:</strong> {a("monetization").revenueProjection}</div>
                      </>
                    ) : <p className="text-muted-foreground">Detect current model, recommend superior pricing structure.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm flex items-center gap-2"><Palette className="h-4 w-4" />UX Redesign</CardTitle>
                    <Button size="sm" onClick={() => runAnalysis("ux")} disabled={analyzing === "ux" || !selected?.raw?.description}>
                      {analyzing === "ux" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      Redesign
                    </Button>
                  </CardHeader>
                  <CardContent className="text-xs">
                    {a("ux") ? (
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(a("ux")).map(([k, v]) => (
                          <div key={k} className="rounded border border-border p-2">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{k}</div>
                            <ul className="space-y-0.5">
                              {Array.isArray(v) && v.slice(0, 8).map((s: string, i: number) => <li key={i}>• {s}</li>)}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-muted-foreground">Original modern UI directions — no visual copying.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm flex items-center gap-2"><ListChecks className="h-4 w-4" />Feature Prioritizer</CardTitle>
                    <Button size="sm" onClick={() => runAnalysis("prioritizer")} disabled={analyzing === "prioritizer" || !selected?.raw?.description}>
                      {analyzing === "prioritizer" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      Prioritize
                    </Button>
                  </CardHeader>
                  <CardContent className="text-xs space-y-2">
                    {a("prioritizer") ? (
                      <>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">RICE</div>
                          <table className="w-full text-[10px]">
                            <thead><tr className="text-left text-muted-foreground"><th>Feature</th><th>R</th><th>I</th><th>C</th><th>E</th><th>Score</th></tr></thead>
                            <tbody>
                              {(a("prioritizer").rice ?? []).slice(0, 10).map((r: any, i: number) => (
                                <tr key={i} className="border-t border-border/50">
                                  <td className="py-0.5 pr-2">{r.feature}</td>
                                  <td>{r.reach}</td><td>{r.impact}</td><td>{r.confidence}</td><td>{r.effort}</td>
                                  <td className="text-primary font-semibold">{r.score}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="grid grid-cols-4 gap-2 pt-2">
                          {(["must","should","could","wont"] as const).map((k) => (
                            <div key={k} className="rounded border border-border p-2">
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{k}</div>
                              <ul className="space-y-0.5">
                                {(a("prioritizer").moscow?.[k] ?? []).map((s: string, i: number) => <li key={i}>• {s}</li>)}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : <p className="text-muted-foreground">RICE + MoSCoW + ICE scoring for your feature backlog.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" />Blueprint / PRD</CardTitle>
                    <Button size="sm" onClick={() => runAnalysis("blueprint")} disabled={analyzing === "blueprint" || !selected?.raw?.description}>
                      {analyzing === "blueprint" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      Draft
                    </Button>
                  </CardHeader>
                  <CardContent className="text-xs">
                    {a("blueprint") ? (
                      <div className="space-y-2">
                        {Object.entries(a("blueprint")).map(([k, v]) => (
                          <div key={k} className="rounded border border-border p-2">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{k}</div>
                            <pre className="whitespace-pre-wrap font-sans">{String(v)}</pre>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-muted-foreground">PRD, technical design, roadmap, sprint plan, marketing + launch plan.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm flex items-center gap-2"><Wand2 className="h-4 w-4" />Build Better Plan</CardTitle>
                    <Button size="sm" onClick={() => runAnalysis("buildBetter")} disabled={analyzing === "buildBetter" || !selected?.raw?.description}>
                      {analyzing === "buildBetter" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      Generate
                    </Button>
                  </CardHeader>
                  <CardContent className="text-xs">
                    {a("buildBetter") ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {Object.entries(a("buildBetter")).map(([k, v]) => (
                          <div key={k} className="rounded border border-border p-2">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{k}</div>
                            {Array.isArray(v) ? (
                              <ul className="space-y-0.5">
                                {v.slice(0, 8).map((s: string, i: number) => <li key={i}>• {s}</li>)}
                              </ul>
                            ) : (
                              <p>{String(v)}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-muted-foreground">Original 'better than this' plan — differentiation across every axis.</p>}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ship" className="mt-4 space-y-3">
                <Card className="border-primary/40 bg-primary/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" />Auto-Build Extension (MV3 ZIP)</CardTitle>
                        <CardDescription className="text-[10px]">Compiles Blueprint + Build Better + Architecture into a working, IP-safe Chrome extension you can Load Unpacked.</CardDescription>
                      </div>
                      <Button size="sm" onClick={generateExtension} disabled={analyzing === "generate" || !selected}>
                        {analyzing === "generate" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Rocket className="h-3 w-3 mr-1" />}
                        Generate & Download ZIP
                      </Button>
                    </div>
                  </CardHeader>
                  {a("generated") && (
                    <CardContent className="text-xs space-y-2">
                      <div><strong>{a("generated").name}</strong> — {a("generated").description}</div>
                      <div className="text-[10px] text-muted-foreground">Files: {Object.keys(a("generated").files ?? {}).join(", ")}</div>
                      <div className="text-[10px] text-muted-foreground">Install: unzip → chrome://extensions → Developer mode → Load unpacked → select folder.</div>
                    </CardContent>
                  )}
                </Card>

                <Card className="border-emerald-400/40 bg-emerald-400/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4" />Chrome Web Store Publish Kit</CardTitle>
                        <CardDescription className="text-[10px]">Store listing, privacy policy, permissions justification, promo tile briefs, screenshot briefs — everything needed to pass CWS review.</CardDescription>
                      </div>
                      <Button size="sm" onClick={generateStoreKit} disabled={analyzing === "storekit" || !selected}>
                        {analyzing === "storekit" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
                        Generate Kit
                      </Button>
                    </div>
                  </CardHeader>
                  {a("storekit") && (
                    <CardContent className="text-xs space-y-2">
                      <div><strong>{a("storekit").listing?.title}</strong> — {a("storekit").listing?.category}</div>
                      <div className="text-muted-foreground">{a("storekit").listing?.shortDescription}</div>
                      <div className="flex flex-wrap gap-1">
                        {(a("storekit").listing?.keywords ?? []).slice(0, 12).map((k: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-[9px]">{k}</Badge>
                        ))}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {(a("storekit").permissionsJustification ?? []).length} permissions justified · privacy policy generated · {(a("storekit").screenshots ?? []).length} screenshots briefed
                      </div>
                    </CardContent>
                  )}
                </Card>

                <Card className="border-amber-400/40 bg-amber-400/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2"><Palette className="h-4 w-4" />AI Icon Generator</CardTitle>
                        <CardDescription className="text-[10px]">Generates a real icon via Lovable AI, auto-resizes to 16/48/128/512 PNGs. Uses the icon brief from the Publish Kit when available.</CardDescription>
                      </div>
                      <Button size="sm" onClick={generateIcons} disabled={analyzing === "icons" || !selected}>
                        {analyzing === "icons" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                        Generate Icons
                      </Button>
                    </div>
                  </CardHeader>
                  {a("icons")?.preview && (
                    <CardContent className="text-xs">
                      <div className="flex items-end gap-4">
                        {[128, 48, 16].map((s) => (
                          <div key={s} className="flex flex-col items-center gap-1">
                            <img src={a("icons").preview} alt={`icon ${s}`} style={{ width: s, height: s, imageRendering: s <= 48 ? "pixelated" : "auto" }} className="rounded border border-border bg-black/20" />
                            <span className="text-[9px] text-muted-foreground">{s}px</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>





                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm flex items-center gap-2"><Terminal className="h-4 w-4" />Dev Prompts</CardTitle>
                    <Button size="sm" onClick={() => runAnalysis("prompts")} disabled={analyzing === "prompts" || !selected?.raw?.description}>
                      {analyzing === "prompts" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      Generate
                    </Button>
                  </CardHeader>
                  <CardContent className="text-xs">
                    {a("prompts") ? (
                      <div className="space-y-2">
                        {Object.entries(a("prompts")).map(([tool, prompt]) => (
                          <div key={tool} className="rounded border border-border">
                            <div className="flex items-center justify-between px-2 py-1 border-b border-border bg-muted/40">
                              <span className="text-[10px] uppercase tracking-wider font-semibold">{tool}</span>
                              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => { navigator.clipboard.writeText(String(prompt)); toast.success(`${tool} prompt copied`); }}>
                                Copy
                              </Button>
                            </div>
                            <pre className="whitespace-pre-wrap p-2 text-[10px] font-mono max-h-48 overflow-auto">{String(prompt)}</pre>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-muted-foreground">Production-ready prompts for Lovable, Cursor, Windsurf, Claude Code, Gemini CLI, Copilot, Bolt, Replit.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm flex items-center gap-2"><Download className="h-4 w-4" />Export Center</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-2">
                    <p className="text-muted-foreground">Download the complete report bundle (all modules, all competitors) as JSON.</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        const bundle = { report_id: reportId, competitors, analyses };
                        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url; a.download = `intel-report-${reportId ?? "export"}.json`; a.click();
                        URL.revokeObjectURL(url);
                        toast.success("Report exported");
                      }} disabled={!reportId}>
                        <Download className="h-3 w-3 mr-1" /> Export JSON
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        const rows = [["module","competitor","key","value"]];
                        Object.entries(analyses).forEach(([k, v]) => {
                          const [mod, cid] = k.split(":");
                          rows.push([mod, cid ?? "report", "payload", JSON.stringify(v).replace(/"/g, '""')]);
                        });
                        const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url; a.download = `intel-report-${reportId ?? "export"}.csv`; a.click();
                        URL.revokeObjectURL(url);
                        toast.success("CSV exported");
                      }} disabled={!reportId}>
                        <Download className="h-3 w-3 mr-1" /> Export CSV
                      </Button>
                      <Button size="sm" variant="outline" onClick={exportMarkdown} disabled={!reportId}>
                        <Download className="h-3 w-3 mr-1" /> Export Markdown
                      </Button>
                      <Button size="sm" variant="outline" onClick={exportPDF} disabled={!reportId}>
                        <Download className="h-3 w-3 mr-1" /> Export PDF
                      </Button>
                    </div>
                  </CardContent>
                </Card>
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
