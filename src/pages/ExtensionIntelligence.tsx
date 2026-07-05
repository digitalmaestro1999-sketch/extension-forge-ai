import { useEffect, useState } from "react";
import {
  Brain, Search, Sparkles, Loader2, ExternalLink, Star, Users, ShieldAlert,
  Layers, Target, Lightbulb, Building2, Wand2, DollarSign, Palette, ListChecks,
  FileText, Rocket, BarChart3, Trophy, Flame, Terminal, Download, Code2, Package, Megaphone, TrendingUp, Scale, CreditCard, Globe,
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

  async function generateLaunchKit() {
    if (!reportId || !selected?.id) { toast.error("Select a competitor first"); return; }
    setAnalyzing("launch");
    try {
      const input = {
        competitor: { name: selected.name, description: selected.raw?.description, category: selected.raw?.category },
        blueprint: a("blueprint") ?? null,
        buildBetter: a("buildBetter") ?? null,
        listing: a("storekit")?.listing ?? a("listing") ?? null,
        monetization: a("monetization") ?? null,
      };
      const { data, error } = await supabase.functions.invoke("ext-intel-analyze", {
        body: { stage: "launch", input, report_id: reportId, competitor_id: selected.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const kit = data.result;

      const zip = new JSZip();
      const p = kit.positioning ?? {};
      zip.file("00-README.md",
`# Launch & Marketing Kit
Generated ${new Date().toISOString()}

- positioning.md — tagline, one-liner, personas, UVPs
- product-hunt.md — full PH launch post + first comment
- tweets.md — launch thread + single tweets + reply hooks
- reddit.md — subreddit-specific posts
- hacker-news.md — Show HN post
- linkedin.md — founder + company posts + long-form article
- cold-emails.md — persona-tailored outreach
- blog-post.md — SEO-optimized launch blog post
- press-release.md — traditional PR
- landing-page.html — self-contained landing page
- launch-checklist.md — day-by-day launch plan
- influencer-outreach.md — channel-tailored pitches
- raw-kit.json — full JSON

All copy is original and IP-safe.`);

      zip.file("positioning.md",
`# Positioning

**Tagline:** ${p.tagline ?? ""}
**One-liner:** ${p.oneLiner ?? ""}

## Elevator Pitch
${p.elevatorPitch ?? ""}

## Target Personas
${(p.targetPersonas ?? []).map((x: string) => `- ${x}`).join("\n")}

## Unique Value Props
${(p.uniqueValueProps ?? []).map((x: string) => `- ${x}`).join("\n")}`);

      const ph = kit.productHunt ?? {};
      zip.file("product-hunt.md",
`# Product Hunt Launch

**Name:** ${ph.name ?? ""}
**Tagline:** ${ph.tagline ?? ""}
**Topics:** ${(ph.topics ?? []).join(", ")}

## Description
${ph.description ?? ""}

## First Comment (Maker)
${ph.firstComment ?? ""}

## Maker Comment
${ph.makerComment ?? ""}

## Gallery Briefs
${(ph.gallery ?? []).map((g: string, i: number) => `${i + 1}. ${g}`).join("\n")}`);

      const tw = kit.tweets ?? {};
      zip.file("tweets.md",
`# X / Twitter

## Launch Thread
${(tw.launchThread ?? []).map((t: string, i: number) => `${i + 1}/ ${t}`).join("\n\n")}

## Single Tweets
${(tw.singleTweets ?? []).map((t: string) => `- ${t}`).join("\n")}

## Reply Hooks
${(tw.replyHooks ?? []).map((t: string) => `- ${t}`).join("\n")}`);

      zip.file("reddit.md",
`# Reddit Posts\n\n${(kit.reddit ?? []).map((r: any) =>
`## r/${r.subreddit}  ·  flair: ${r.flair ?? "—"}
**Title:** ${r.title}

${r.body}`).join("\n\n---\n\n")}`);

      const hn = kit.hackerNews ?? {};
      zip.file("hacker-news.md",
`# Hacker News

**Title:** ${hn.title ?? ""}

## Show HN Body
${hn.showHnBody ?? ""}`);

      const li = kit.linkedin ?? {};
      zip.file("linkedin.md",
`# LinkedIn

## Founder Post
${li.founderPost ?? ""}

## Company Post
${li.companyPost ?? ""}

## Long-form Article: ${li.articleTitle ?? ""}
${li.articleBody ?? ""}`);

      zip.file("cold-emails.md",
`# Cold Outreach Emails\n\n${(kit.coldEmails ?? []).map((e: any) =>
`## To: ${e.persona}
**Subject:** ${e.subject}

${e.body}`).join("\n\n---\n\n")}`);

      const bp = kit.blogPost ?? {};
      zip.file("blog-post.md",
`---
title: "${bp.title ?? ""}"
description: "${bp.metaDescription ?? ""}"
slug: "${bp.slug ?? ""}"
---

${bp.markdown ?? ""}`);

      const pr = kit.pressRelease ?? {};
      zip.file("press-release.md",
`# ${pr.headline ?? ""}
### ${pr.subheadline ?? ""}

${pr.body ?? ""}

---
${pr.boilerplate ?? ""}`);

      zip.file("landing-page.html", kit.landingPageHtml ?? "<!doctype html><html><body>Landing page not generated.</body></html>");

      zip.file("launch-checklist.md",
`# Launch Checklist\n\n${(kit.launchChecklist ?? []).map((c: string) => `- [ ] ${c}`).join("\n")}`);

      zip.file("influencer-outreach.md",
`# Influencer Outreach\n\n${(kit.influencerOutreach ?? []).map((o: any) =>
`## ${o.channel}\n${o.pitch}`).join("\n\n---\n\n")}`);

      zip.file("raw-kit.json", JSON.stringify(kit, null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      const safe = (selected.name ?? "extension").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      el.href = url; el.download = `${safe}-launch-kit.zip`; el.click();
      URL.revokeObjectURL(url);

      setAnalyses((prev) => ({ ...prev, [`launch:${selected.id}`]: kit }));
      toast.success("Launch kit ready");
    } catch (e: any) {
      toast.error(e.message ?? "Launch kit failed");
    } finally { setAnalyzing(null); }
  }

  async function generateLocalizationKit() {
    if (!reportId || !selected?.id) { toast.error("Select a competitor first"); return; }
    setAnalyzing("localize");
    try {
      const listing = a("storekit")?.listing ?? a("listing") ?? null;
      const launch = a("launch") ?? null;
      const targetLocales = ["es", "pt-BR", "de", "fr", "ja", "ko", "zh-CN", "hi", "ru", "it"];
      const input = {
        sourceLocale: "en",
        targetLocales,
        source: {
          name: selected.name,
          title: listing?.title,
          shortDescription: listing?.shortDescription,
          detailedDescription: listing?.detailedDescription,
          keywords: listing?.keywords,
          tagline: launch?.positioning?.tagline,
          oneLiner: launch?.positioning?.oneLiner,
          uniqueValueProps: launch?.positioning?.uniqueValueProps,
        },
      };
      const { data, error } = await supabase.functions.invoke("ext-intel-analyze", {
        body: { stage: "localize", input, report_id: reportId, competitor_id: selected.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const kit = data.result;

      const zip = new JSZip();
      zip.file("00-README.md",
`# Global Localization Kit
Generated ${new Date().toISOString()}

Locales included: ${(kit.locales ?? []).map((l: any) => l.locale).join(", ")}

Each locale folder contains:
- listing.md — CWS listing translated & culturally adapted
- landing-page.html — self-contained landing page
- keywords.txt — locale-native SEO keywords (not raw translation)
- cultural-notes.md — tone, idioms, cultural considerations

Chrome Web Store supports per-locale listings. Add each locale in the CWS
developer dashboard under "Store listing" → "Add translation".`);

      (kit.locales ?? []).forEach((loc: any) => {
        const folder = zip.folder(loc.locale) ?? zip;
        folder.file("listing.md",
`# ${loc.title ?? ""}

**Locale:** ${loc.locale} (${loc.languageName ?? ""})
**CTA:** ${loc.cta ?? ""}

## Short description
${loc.shortDescription ?? ""}

## Detailed description
${loc.detailedDescription ?? ""}

## Keywords
${(loc.keywords ?? []).join(", ")}`);
        folder.file("keywords.txt", (loc.keywords ?? []).join("\n"));
        folder.file("cultural-notes.md", `# Cultural Notes — ${loc.languageName ?? loc.locale}\n\n${loc.culturalNotes ?? ""}`);
        folder.file("landing-page.html", loc.landingPageHtml ?? `<!doctype html><html lang="${loc.locale}"><body>Landing page not generated.</body></html>`);
      });

      zip.file("raw-kit.json", JSON.stringify(kit, null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      const safe = (selected.name ?? "extension").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      el.href = url; el.download = `${safe}-localization-kit.zip`; el.click();
      URL.revokeObjectURL(url);

      setAnalyses((prev) => ({ ...prev, [`localize:${selected.id}`]: kit }));
      toast.success(`Localized into ${(kit.locales ?? []).length} locales`);
    } catch (e: any) {
      toast.error(e.message ?? "Localization failed");
    } finally { setAnalyzing(null); }
  }

  async function generateGrowthKit() {
    if (!reportId || !selected?.id) { toast.error("Select a competitor first"); return; }
    setAnalyzing("growth");
    try {
      const listing = a("storekit")?.listing ?? a("listing") ?? null;
      const launch = a("launch") ?? null;
      const reviews = a("reviews") ?? null;
      const sentiment = a("sentiment") ?? null;
      const input = {
        product: {
          name: selected.name,
          category: selected.raw?.category ?? null,
          tagline: launch?.positioning?.tagline,
          oneLiner: launch?.positioning?.oneLiner,
          uniqueValueProps: launch?.positioning?.uniqueValueProps,
        },
        listing: listing ? { title: listing.title, shortDescription: listing.shortDescription, keywords: listing.keywords } : null,
        reviewsSignal: reviews,
        sentimentSignal: sentiment,
      };
      const { data, error } = await supabase.functions.invoke("ext-intel-analyze", {
        body: { stage: "growth", input, report_id: reportId, competitor_id: selected.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const kit = data.result;

      const zip = new JSZip();
      zip.file("00-README.md",
`# Post-Launch Growth OS
Generated ${new Date().toISOString()}

## Contents
- review-responses/ — Copy-paste replies for every rating tier and complaint type
- ratings-recovery.md — Playbook + outreach templates to lift a struggling rating
- ab-listing-variants.md — Ready-to-test CWS listing variants with hypotheses
- roadmap-90d.md — 3-month feature roadmap prioritized by user impact
- changelog-templates.md — Version bump templates (feature/fix/perf/security)
- support-macros.md — Support inbox macros
- retention-emails.md — Onboarding & retention email flows
- reactivation-emails.md — Win-back sequences for dormant users
- uninstall-survey.md — Exit survey + follow-up
- aso-refresh.md — ASO refresh cadence (weekly/monthly/quarterly)
- upgrade-ctas.md — In-product upgrade CTA library
- community-kit.md — Discord/Slack/changelog announcement templates
- kpis.md — Target metrics + instrumentation
- raw-kit.json`);

      const rr = kit.reviewResponses ?? {};
      const rrFolder = zip.folder("review-responses") ?? zip;
      Object.entries(rr).forEach(([bucket, items]: any) => {
        const md = `# ${bucket} responses\n\n` + (items ?? []).map((i: any, idx: number) =>
          `## ${idx + 1}. Trigger: ${i.trigger}\n\n${i.response}\n`).join("\n");
        rrFolder.file(`${bucket}.md`, md);
      });

      zip.file("ratings-recovery.md",
`# Ratings Recovery Playbook

${kit.ratingsRecovery?.playbook ?? ""}

## Outreach templates
${(kit.ratingsRecovery?.outreachTemplates ?? []).map((t: any) => `### ${t.channel}\n**Subject:** ${t.subject}\n\n${t.body}\n`).join("\n")}

## Incentive ideas
${(kit.ratingsRecovery?.incentiveIdeas ?? []).map((i: string) => `- ${i}`).join("\n")}`);

      zip.file("ab-listing-variants.md",
`# A/B Listing Variants
${(kit.abListingVariants ?? []).map((v: any, i: number) =>
`## Variant ${i + 1}
**Hypothesis:** ${v.hypothesis}
**Title:** ${v.title}
**Short description:** ${v.shortDescription}
**Screenshot brief:** ${v.screenshotBrief}
**Success metric:** ${v.successMetric}
`).join("\n")}`);

      zip.file("roadmap-90d.md",
`# 90-Day Roadmap
${(["month1","month2","month3"] as const).map((m, i) =>
`## Month ${i + 1}
${(kit.roadmap90d?.[m] ?? []).map((f: any) => `- **${f.feature}** — ${f.why}`).join("\n")}`).join("\n\n")}`);

      zip.file("changelog-templates.md",
`# Changelog Templates
${(kit.changelogTemplates ?? []).map((c: any) => `## v${c.version} (${c.type})\n\n${c.markdown}\n`).join("\n")}`);

      zip.file("support-macros.md",
`# Support Macros
${(kit.supportMacros ?? []).map((m: any) => `## ${m.topic}\n\n${m.macro}\n`).join("\n")}`);

      zip.file("retention-emails.md",
`# Retention Emails
${(kit.retentionEmails ?? []).map((e: any) => `## ${e.trigger} — send ${e.sendAfter}\n**Subject:** ${e.subject}\n\n${e.body}\n`).join("\n")}`);

      zip.file("reactivation-emails.md",
`# Reactivation Emails
${(kit.reactivationEmails ?? []).map((e: any) => `## ${e.trigger}\n**Subject:** ${e.subject}\n\n${e.body}\n`).join("\n")}`);

      zip.file("uninstall-survey.md",
`# Uninstall Survey
${(kit.uninstallSurvey?.questions ?? []).map((q: any, i: number) =>
`## Q${i + 1}. ${q.q}\n${(q.options ?? []).map((o: string) => `- ${o}`).join("\n")}`).join("\n\n")}

## Follow-up email
${kit.uninstallSurvey?.followUpEmail ?? ""}`);

      zip.file("aso-refresh.md",
`# ASO Refresh Cadence
## Weekly
${(kit.asoRefreshCadence?.weekly ?? []).map((s: string) => `- ${s}`).join("\n")}
## Monthly
${(kit.asoRefreshCadence?.monthly ?? []).map((s: string) => `- ${s}`).join("\n")}
## Quarterly
${(kit.asoRefreshCadence?.quarterly ?? []).map((s: string) => `- ${s}`).join("\n")}`);

      zip.file("upgrade-ctas.md",
`# Upgrade CTAs
${(kit.upgradeCtas ?? []).map((c: any) => `## ${c.surface}\n${c.copy}\n\n**CTA:** ${c.cta}\n`).join("\n")}`);

      zip.file("community-kit.md",
`# Community Kit
## Discord
${kit.communityKit?.discordAnnouncement ?? ""}

## Slack
${kit.communityKit?.slackAnnouncement ?? ""}

## Changelog post
${kit.communityKit?.changelogPost ?? ""}`);

      zip.file("kpis.md",
`# KPIs
${(kit.kpis ?? []).map((k: any) => `- **${k.name}** → target ${k.target} · instrumentation: ${k.instrumentation}`).join("\n")}`);

      zip.file("raw-kit.json", JSON.stringify(kit, null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      const safe = (selected.name ?? "extension").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      el.href = url; el.download = `${safe}-growth-os.zip`; el.click();
      URL.revokeObjectURL(url);

      setAnalyses((prev) => ({ ...prev, [`growth:${selected.id}`]: kit }));
      toast.success("Growth OS ready");
    } catch (e: any) {
      toast.error(e.message ?? "Growth OS failed");
    } finally { setAnalyzing(null); }
  }

  async function generateLegalVault() {
    if (!reportId || !selected?.id) { toast.error("Select a competitor first"); return; }
    setAnalyzing("legal");
    try {
      const listing = a("storekit")?.listing ?? a("listing") ?? null;
      const architecture = a("architecture") ?? null;
      const security = a("security") ?? null;
      const manifest = a("storekit")?.manifest ?? architecture?.manifest ?? null;
      const permissions = manifest?.permissions ?? architecture?.permissions ?? [];
      const hostPermissions = manifest?.host_permissions ?? [];
      const input = {
        product: {
          name: selected.name,
          category: selected.raw?.category ?? null,
          shortDescription: listing?.shortDescription,
          description: listing?.detailedDescription ?? selected.raw?.description,
        },
        manifest,
        permissions,
        hostPermissions,
        securitySignals: security,
      };
      const { data, error } = await supabase.functions.invoke("ext-intel-analyze", {
        body: { stage: "legal", input, report_id: reportId, competitor_id: selected.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const kit = data.result;

      const zip = new JSZip();
      const ph = kit.companyPlaceholders ?? {};
      zip.file("00-README.md",
`# Legal & Compliance Vault
Generated ${new Date().toISOString()}

## Before you publish
Search-and-replace these placeholders across every file:
- {{companyName}} → ${ph.companyName ?? "your legal entity"}
- {{contactEmail}} → ${ph.contactEmail ?? "privacy@yourdomain.com"}
- {{jurisdiction}} → ${ph.jurisdiction ?? "your governing jurisdiction"}
- {{effectiveDate}} → ${ph.effectiveDate ?? new Date().toISOString().slice(0, 10)}

## Contents
- policies/ — privacy, ToS, cookie, DPA, DMCA, AUP
- regional/ — GDPR + CCPA specific notices
- cws/ — Chrome Web Store submission-ready statements (single purpose, permission justifications, data usage disclosure)
- security/ — whitepaper, SOC2-lite checklist, incident response plan, subprocessor list, breach template
- widgets/ — cookie banner + consent modal HTML snippets
- data-handling.md — data categories, purposes, retention, sharing
- raw-vault.json

## Disclaimer
These are production-ready templates, not legal advice. Have counsel review before publishing.`);

      const policies = zip.folder("policies") ?? zip;
      policies.file("privacy-policy.md", `# ${kit.privacyPolicy?.title ?? "Privacy Policy"}\n\n${kit.privacyPolicy?.markdown ?? ""}`);
      policies.file("terms-of-service.md", `# ${kit.termsOfService?.title ?? "Terms of Service"}\n\n${kit.termsOfService?.markdown ?? ""}`);
      policies.file("cookie-policy.md", `# ${kit.cookiePolicy?.title ?? "Cookie Policy"}\n\nUses cookies: ${kit.cookiePolicy?.usesCookies ? "yes" : "no"}\n\n${kit.cookiePolicy?.markdown ?? ""}`);
      policies.file("dpa.md", `# ${kit.dataProcessingAgreement?.title ?? "Data Processing Agreement"}\n\n${kit.dataProcessingAgreement?.markdown ?? ""}`);
      policies.file("dmca-policy.md", `# ${kit.dmcaPolicy?.title ?? "DMCA Policy"}\n\n${kit.dmcaPolicy?.markdown ?? ""}`);
      policies.file("acceptable-use-policy.md", `# ${kit.acceptableUsePolicy?.title ?? "Acceptable Use Policy"}\n\n${kit.acceptableUsePolicy?.markdown ?? ""}`);

      const regional = zip.folder("regional") ?? zip;
      regional.file("gdpr.md",
`# ${kit.gdprNotice?.title ?? "GDPR Notice"}

## Lawful basis
${(kit.gdprNotice?.lawfulBasis ?? []).map((l: string) => `- ${l}`).join("\n")}

## Data subject rights
${(kit.gdprNotice?.dataSubjectRights ?? []).map((l: string) => `- ${l}`).join("\n")}

${kit.gdprNotice?.markdown ?? ""}`);
      regional.file("ccpa.md",
`# ${kit.ccpaNotice?.title ?? "CCPA Notice"}

## Consumer rights
${(kit.ccpaNotice?.consumerRights ?? []).map((l: string) => `- ${l}`).join("\n")}

${kit.ccpaNotice?.markdown ?? ""}`);

      const cws = zip.folder("cws") ?? zip;
      cws.file("single-purpose.md",
`# Single Purpose Statement (paste into CWS listing)

${kit.cwsSinglePurpose?.statement ?? ""}

## Justification
${kit.cwsSinglePurpose?.justification ?? ""}`);
      cws.file("permission-justifications.md",
`# Permission Justifications (paste each into the CWS Privacy Practices tab)

${(kit.cwsPermissionJustifications ?? []).map((p: any) =>
`## ${p.permission}
**Justification:** ${p.justification}
**User benefit:** ${p.userBenefit}
**Minimal alternative considered:** ${p.minimalAlternative}
`).join("\n")}`);
      cws.file("host-permission-justifications.md",
`# Host Permission Justifications

${(kit.cwsHostPermissionJustifications ?? []).map((h: any) =>
`## ${h.host}
${h.justification}
`).join("\n")}`);
      cws.file("remote-code.md", `# Remote Code Use\n\n${kit.cwsRemoteCodeStatement ?? "This extension does NOT execute remote code. All logic is packaged in the extension."}`);
      cws.file("data-usage-disclosure.md",
`# Data Usage Disclosure (CWS Privacy Practices form)

**Collects PII:** ${kit.cwsDataUsageDisclosure?.collectsPii ? "Yes" : "No"}
**Sells user data:** ${kit.cwsDataUsageDisclosure?.sellsData ? "Yes" : "No"}

## Categories collected
${(kit.cwsDataUsageDisclosure?.categories ?? []).map((c: string) => `- ${c}`).join("\n")}

## Usage declarations (check each)
${(kit.cwsDataUsageDisclosure?.usageDeclarations ?? []).map((c: string) => `- [ ] ${c}`).join("\n")}

## Sharing declarations
${(kit.cwsDataUsageDisclosure?.shareDeclarations ?? []).map((c: string) => `- [ ] ${c}`).join("\n")}`);

      const sec = zip.folder("security") ?? zip;
      sec.file("security-whitepaper.md",
`# ${kit.securityWhitepaper?.title ?? "Security Whitepaper"}

## Controls
${(kit.securityWhitepaper?.controls ?? []).map((c: string) => `- ${c}`).join("\n")}

${kit.securityWhitepaper?.markdown ?? ""}`);
      sec.file("soc2-checklist.md",
`# SOC2-Lite Readiness Checklist

| Category | Control | Status | Action |
|---|---|---|---|
${(kit.soc2Checklist ?? []).map((c: any) => `| ${c.category} | ${c.control} | ${c.status} | ${c.action} |`).join("\n")}`);
      sec.file("incident-response-plan.md",
`# ${kit.incidentResponsePlan?.title ?? "Incident Response Plan"}

## Severity levels
${(kit.incidentResponsePlan?.severityLevels ?? []).map((s: any) => `- **${s.level}** — ${s.definition} (SLA: ${s.sla})`).join("\n")}

${kit.incidentResponsePlan?.markdown ?? ""}`);
      sec.file("subprocessors.md",
`# Subprocessors

| Name | Purpose | Location | Data access |
|---|---|---|---|
${(kit.subprocessorList ?? []).map((s: any) => `| ${s.name} | ${s.purpose} | ${s.location} | ${s.dataAccess} |`).join("\n")}`);
      sec.file("data-breach-template.md",
`# Data Breach Notification Templates

## User email
**Subject:** ${kit.dataBreachTemplate?.userEmailSubject ?? ""}

${kit.dataBreachTemplate?.userEmailBody ?? ""}

## Regulator notice
${kit.dataBreachTemplate?.regulatorNotice ?? ""}`);

      const widgets = zip.folder("widgets") ?? zip;
      widgets.file("cookie-banner.html", kit.cookieBannerHtml ?? "<!-- cookie banner not generated -->");
      widgets.file("consent-modal.html", kit.consentModalHtml ?? "<!-- consent modal not generated -->");

      zip.file("data-handling.md",
`# ${kit.dataHandlingDoc?.title ?? "Data Handling Document"}

| Category | Purpose | Retention | Shared with |
|---|---|---|---|
${(kit.dataHandlingDoc?.dataCategories ?? []).map((d: any) => `| ${d.category} | ${d.purpose} | ${d.retention} | ${(d.sharedWith ?? []).join(", ")} |`).join("\n")}

${kit.dataHandlingDoc?.markdown ?? ""}`);

      zip.file("raw-vault.json", JSON.stringify(kit, null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      const safe = (selected.name ?? "extension").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      el.href = url; el.download = `${safe}-legal-vault.zip`; el.click();
      URL.revokeObjectURL(url);

      setAnalyses((prev) => ({ ...prev, [`legal:${selected.id}`]: kit }));
      toast.success("Legal vault ready");
    } catch (e: any) {
      toast.error(e.message ?? "Legal vault failed");
    } finally { setAnalyzing(null); }
  }

  async function generateRevenueEngine() {
    if (!reportId || !selected?.id) { toast.error("Select a competitor first"); return; }
    setAnalyzing("revenue");
    try {
      const listing = a("storekit")?.listing ?? a("listing") ?? null;
      const launch = a("launch") ?? null;
      const monetization = a("monetization") ?? null;
      const buildBetter = a("buildBetter") ?? null;
      const scorecard = a("scorecard") ?? null;
      const input = {
        product: {
          name: selected.name,
          category: selected.raw?.category ?? null,
          description: listing?.detailedDescription ?? selected.raw?.description,
          tagline: launch?.positioning?.tagline,
          uniqueValueProps: launch?.positioning?.uniqueValueProps,
          personas: launch?.positioning?.targetPersonas,
        },
        currentMonetization: monetization,
        competitivePricingContext: scorecard?.scores ? { popularity: scorecard.scores.popularity, monetization: scorecard.scores.monetization } : null,
        betterPricing: buildBetter?.betterPricing,
      };
      const { data, error } = await supabase.functions.invoke("ext-intel-analyze", {
        body: { stage: "revenue", input, report_id: reportId, competitor_id: selected.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const kit = data.result;

      const zip = new JSZip();
      zip.file("00-README.md",
`# Monetization & Revenue Engine
Generated ${new Date().toISOString()}

## Recommended model
**${kit.strategy?.recommendedModel ?? "n/a"}** — ARPU ${kit.strategy?.expectedArpu ?? "?"}, conversion ${kit.strategy?.expectedConversion ?? "?"}, LTV ${kit.strategy?.expectedLtv ?? "?"}, churn ${kit.strategy?.expectedChurn ?? "?"}

${kit.strategy?.rationale ?? ""}

## Contents
- strategy.md — recommended model + KPIs
- pricing/ — tiers, self-contained pricing-page.html
- paywalls.md — trigger-specific paywall copy
- flows/ — upsell, downsell, trial-conversion, cancellation
- checkout/ — page copy, receipt, dunning, renewal emails
- referral/ — program mechanics + share copy + landing page
- affiliate/ — program + recruitment email + asset list
- enterprise/ — one-pager + sales email + objection responses
- roi-calculator.html — self-contained calculator
- integrations/stripe/ — products, webhook events, checkout + portal + webhook handler code
- integrations/paddle/ — products, webhook events, checkout + webhook handler code
- integrations/license-keys/ — schema + activation/validation/revocation code
- billing-faq.md
- raw-engine.json`);

      zip.file("strategy.md",
`# Monetization Strategy

- **Model:** ${kit.strategy?.recommendedModel ?? ""}
- **Expected ARPU:** ${kit.strategy?.expectedArpu ?? ""}
- **Expected conversion:** ${kit.strategy?.expectedConversion ?? ""}
- **Expected LTV:** ${kit.strategy?.expectedLtv ?? ""}
- **Expected churn:** ${kit.strategy?.expectedChurn ?? ""}

${kit.strategy?.rationale ?? ""}

## KPIs
${(kit.kpis ?? []).map((k: any) => `- **${k.name}** → ${k.target} (\`${k.formula}\`)`).join("\n")}`);

      const pricing = zip.folder("pricing") ?? zip;
      pricing.file("tiers.md",
`# Pricing Tiers
${(kit.pricingTiers ?? []).map((t: any) =>
`## ${t.name} — $${t.monthlyPrice}/mo · $${t.yearlyPrice}/yr${t.highlight ? " ⭐" : ""}
**Persona:** ${t.targetPersona}
**Positioning:** ${t.positioning}
**CTA:** ${t.cta}

### Features
${(t.features ?? []).map((f: string) => `- ${f}`).join("\n")}

### Limits
${Object.entries(t.limits ?? {}).map(([k, v]) => `- ${k}: ${v}`).join("\n")}
`).join("\n")}`);
      pricing.file("pricing-page.html", kit.pricingPageHtml ?? "<!-- pricing page not generated -->");

      zip.file("paywalls.md",
`# Paywall Copy Library
${(kit.paywallCopy ?? []).map((p: any) =>
`## ${p.trigger}
### ${p.headline}
${p.subhead}

${(p.bullets ?? []).map((b: string) => `- ${b}`).join("\n")}

**Primary CTA:** ${p.primaryCta}
**Secondary CTA:** ${p.secondaryCta}
**Social proof:** ${p.socialProof}
`).join("\n")}`);

      const flows = zip.folder("flows") ?? zip;
      flows.file("upsells.md",
`# Upsell Flows
${(kit.upsellFlows ?? []).map((u: any) => `## ${u.trigger} (+${u.expectedLiftPct}% expected)\n${u.flow}\n\n**Copy:** ${u.copy}\n`).join("\n")}`);
      flows.file("downsells.md",
`# Downsell Flows
${(kit.downsellFlows ?? []).map((d: any) => `## ${d.trigger}\n**Offer:** ${d.offer}\n\n${d.copy}\n`).join("\n")}`);
      flows.file("trial-conversion.md",
`# Trial Conversion Sequence
${(kit.trialConversion ?? []).map((t: any) => `## Day ${t.day} · ${t.channel}\n**Subject:** ${t.subject}\n\n${t.body}\n`).join("\n")}`);
      flows.file("cancellation.md",
`# Cancellation Flow

## Exit survey
${(kit.cancellationFlow?.surveyQuestions ?? []).map((q: any, i: number) => `### Q${i + 1}. ${q.q}\n${(q.options ?? []).map((o: string) => `- ${o}`).join("\n")}`).join("\n\n")}

## Save offer
${kit.cancellationFlow?.saveOffer ?? ""}

## Confirmation email
**Subject:** ${kit.cancellationFlow?.confirmationEmail?.subject ?? ""}

${kit.cancellationFlow?.confirmationEmail?.body ?? ""}`);

      const checkout = zip.folder("checkout") ?? zip;
      checkout.file("checkout-copy.md",
`# Checkout Page

**Title:** ${kit.checkoutCopy?.pageTitle ?? ""}

## Trust badges
${(kit.checkoutCopy?.trustBadges ?? []).map((b: string) => `- ${b}`).join("\n")}

## Guarantees
${(kit.checkoutCopy?.guarantees ?? []).map((g: string) => `- ${g}`).join("\n")}

## FAQs
${(kit.checkoutCopy?.faqs ?? []).map((f: any) => `### ${f.q}\n${f.a}`).join("\n\n")}`);
      checkout.file("receipt-email.md",
`# Receipt Email
**Subject:** ${kit.receiptEmail?.subject ?? ""}

${kit.receiptEmail?.body ?? ""}`);
      checkout.file("dunning-emails.md",
`# Dunning Emails (failed payment recovery)
${(kit.dunningEmails ?? []).map((d: any) => `## Attempt ${d.attempt} · day ${d.sendDay}\n**Subject:** ${d.subject}\n\n${d.body}\n`).join("\n")}`);
      checkout.file("renewal-emails.md",
`# Renewal Emails
${(kit.renewalEmails ?? []).map((r: any) => `## ${r.trigger}\n**Subject:** ${r.subject}\n\n${r.body}\n`).join("\n")}`);

      const referral = zip.folder("referral") ?? zip;
      referral.file("program.md",
`# Referral Program

- **User reward:** ${kit.referralProgram?.userReward ?? ""}
- **Friend reward:** ${kit.referralProgram?.friendReward ?? ""}

## Mechanics
${kit.referralProgram?.mechanics ?? ""}

## Share copy
### Email
${kit.referralProgram?.shareCopy?.email ?? ""}

### Twitter
${kit.referralProgram?.shareCopy?.twitter ?? ""}

### LinkedIn
${kit.referralProgram?.shareCopy?.linkedin ?? ""}

### WhatsApp
${kit.referralProgram?.shareCopy?.whatsapp ?? ""}`);
      referral.file("referral-page.html", kit.referralProgram?.referralPageHtml ?? "<!-- referral page not generated -->");

      const affiliate = zip.folder("affiliate") ?? zip;
      affiliate.file("program.md",
`# Affiliate Program

- **Commission:** ${kit.affiliateProgram?.commission ?? ""}
- **Cookie window:** ${kit.affiliateProgram?.cookieWindow ?? ""}
- **Payout terms:** ${kit.affiliateProgram?.payoutTerms ?? ""}

## Assets
${(kit.affiliateProgram?.assets ?? []).map((a: string) => `- ${a}`).join("\n")}`);
      affiliate.file("recruitment-email.md",
`# Affiliate Recruitment Email
**Subject:** ${kit.affiliateProgram?.recruitmentEmail?.subject ?? ""}

${kit.affiliateProgram?.recruitmentEmail?.body ?? ""}`);

      const enterprise = zip.folder("enterprise") ?? zip;
      enterprise.file("one-pager.md", kit.enterprisePitch?.onePagerMarkdown ?? "");
      enterprise.file("pricing-model.md", `# Enterprise Pricing Model\n\n${kit.enterprisePitch?.pricingModel ?? ""}`);
      enterprise.file("sales-email.md",
`# Enterprise Sales Email
**Subject:** ${kit.enterprisePitch?.salesEmail?.subject ?? ""}

${kit.enterprisePitch?.salesEmail?.body ?? ""}`);
      enterprise.file("objection-responses.md",
`# Objection Responses
${(kit.enterprisePitch?.objectionResponses ?? []).map((o: any) => `## "${o.objection}"\n${o.response}`).join("\n\n")}`);

      zip.file("roi-calculator.html", kit.roiCalculator?.html ?? "<!-- roi calculator not generated -->");
      zip.file("roi-calculator.md",
`# ROI Calculator

**Formula:** \`${kit.roiCalculator?.formula ?? ""}\`

## Inputs
${(kit.roiCalculator?.inputs ?? []).map((i: any) => `- **${i.label}** (${i.type}, default \`${i.defaultValue}\`)${(i.options ?? []).length ? ` — options: ${i.options.join(", ")}` : ""}`).join("\n")}`);

      const stripe = zip.folder("integrations/stripe") ?? zip;
      stripe.file("README.md",
`# Stripe Integration

## Products
${(kit.stripeBlueprint?.products ?? []).map((p: any) => `- **${p.name}** — $${p.amount} / ${p.interval} · price id: \`${p.priceId}\``).join("\n")}

## Webhook events
${(kit.stripeBlueprint?.webhookEvents ?? []).map((e: string) => `- \`${e}\``).join("\n")}

## Env vars
${(kit.stripeBlueprint?.envVars ?? []).map((e: string) => `- \`${e}\``).join("\n")}`);
      stripe.file("checkout-session.ts", kit.stripeBlueprint?.checkoutSessionCode ?? "// not generated");
      stripe.file("portal-session.ts", kit.stripeBlueprint?.portalSessionCode ?? "// not generated");
      stripe.file("webhook-handler.ts", kit.stripeBlueprint?.webhookHandlerCode ?? "// not generated");

      const paddle = zip.folder("integrations/paddle") ?? zip;
      paddle.file("README.md",
`# Paddle Integration

## Products
${(kit.paddleBlueprint?.products ?? []).map((p: any) => `- **${p.name}** — $${p.amount} / ${p.billingCycle} · price id: \`${p.priceId}\``).join("\n")}

## Webhook events
${(kit.paddleBlueprint?.webhookEvents ?? []).map((e: string) => `- \`${e}\``).join("\n")}

## Env vars
${(kit.paddleBlueprint?.envVars ?? []).map((e: string) => `- \`${e}\``).join("\n")}`);
      paddle.file("checkout.ts", kit.paddleBlueprint?.checkoutCode ?? "// not generated");
      paddle.file("webhook-handler.ts", kit.paddleBlueprint?.webhookHandlerCode ?? "// not generated");

      const lic = zip.folder("integrations/license-keys") ?? zip;
      lic.file("schema.sql", kit.licenseKeySystem?.schema ?? "-- not generated");
      lic.file("activation.ts", kit.licenseKeySystem?.activationFlowCode ?? "// not generated");
      lic.file("validation.ts", kit.licenseKeySystem?.validationFlowCode ?? "// not generated");
      lic.file("revocation.ts", kit.licenseKeySystem?.revocationFlowCode ?? "// not generated");

      zip.file("billing-faq.md",
`# Billing FAQ
${(kit.billingFaq ?? []).map((f: any) => `## ${f.q}\n${f.a}`).join("\n\n")}`);

      zip.file("raw-engine.json", JSON.stringify(kit, null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      const safe = (selected.name ?? "extension").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      el.href = url; el.download = `${safe}-revenue-engine.zip`; el.click();
      URL.revokeObjectURL(url);

      setAnalyses((prev) => ({ ...prev, [`revenue:${selected.id}`]: kit }));
      toast.success("Revenue engine ready");
    } catch (e: any) {
      toast.error(e.message ?? "Revenue engine failed");
    } finally { setAnalyzing(null); }
  }

  async function generateMarketingSite() {
    if (!reportId || !selected?.id) { toast.error("Select a competitor first"); return; }
    setAnalyzing("marketingSite");
    try {
      const listing = a("storekit")?.listing ?? a("listing") ?? null;
      const launch = a("launch") ?? null;
      const revenue = a("revenue") ?? null;
      const buildBetter = a("buildBetter") ?? null;
      const otherCompetitors = competitors.filter((c) => c.id !== selected.id).slice(0, 4).map((c) => c.name);
      const input = {
        product: {
          name: selected.name,
          category: selected.raw?.category ?? null,
          tagline: launch?.positioning?.tagline,
          oneLiner: launch?.positioning?.oneLiner,
          uniqueValueProps: launch?.positioning?.uniqueValueProps,
          targetPersonas: launch?.positioning?.targetPersonas,
        },
        listingContext: listing ? { title: listing.title, keywords: listing.keywords, shortDescription: listing.shortDescription } : null,
        pricingTiers: revenue?.pricingTiers?.map((t: any) => ({ name: t.name, monthlyPrice: t.monthlyPrice, yearlyPrice: t.yearlyPrice, features: t.features })) ?? null,
        featureAdvantages: buildBetter?.missingFeatures ?? null,
        competitorsToCompareAgainst: otherCompetitors,
      };
      const { data, error } = await supabase.functions.invoke("ext-intel-analyze", {
        body: { stage: "marketingSite", input, report_id: reportId, competitor_id: selected.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const kit = data.result;

      const zip = new JSZip();
      const meta = kit.siteMeta ?? {};
      zip.file("00-README.md",
`# Marketing Site & SEO Pack
Generated ${new Date().toISOString()}

**Brand:** ${meta.brandName ?? ""}
**Domain:** ${meta.domain ?? "yourdomain.com"}
**Tagline:** ${meta.tagline ?? ""}
**Primary keyword:** ${meta.primaryKeyword ?? ""}
**Secondary keywords:** ${(meta.secondaryKeywords ?? []).join(", ")}

## Contents
- site/ — static site (index, features, pricing, about, contact, blog, changelog, install, 404)
- site/blog/ — 10 SEO-seeded blog posts as ready-to-publish HTML
- site/compare/ — head-to-head comparison pages
- site/sitemap.xml, site/robots.txt
- schema/ — JSON-LD structured data (Organization, SoftwareApplication, FAQ, Breadcrumb)
- outreach/ — backlink outreach emails + directory submission list
- seo/ — keyword clusters, internal link plan, checklist
- opengraph.md — OG image + card spec
- favicon.md — favicon brief
- raw-pack.json

## Deploy
Drop \`site/\` into any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages).
Search-and-replace \`yourdomain.com\` if the placeholder is present.`);

      const site = zip.folder("site") ?? zip;
      const pages = kit.pages ?? {};
      const write = (name: string, html: string | undefined) => site.file(name, html ?? `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${name}</title></head><body>Not generated.</body></html>`);
      write("index.html", pages.indexHtml);
      write("features.html", pages.featuresHtml);
      write("pricing.html", pages.pricingHtml);
      write("about.html", pages.aboutHtml);
      write("contact.html", pages.contactHtml);
      write("blog.html", pages.blogIndexHtml);
      write("changelog.html", pages.changelogHtml);
      write("install.html", pages.installHtml);
      write("404.html", pages.notFoundHtml);
      site.file("sitemap.xml", kit.sitemapXml ?? "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"></urlset>");
      site.file("robots.txt", kit.robotsTxt ?? "User-agent: *\nAllow: /\n");

      const blog = site.folder("blog") ?? site;
      (kit.blogPosts ?? []).forEach((post: any) => {
        blog.file(`${post.slug ?? "post"}.html`, post.html ?? "<!-- not generated -->");
      });
      blog.file("_index.md",
`# Blog Posts (${(kit.blogPosts ?? []).length})
${(kit.blogPosts ?? []).map((p: any) =>
`- **${p.title}** — ${p.slug}.html · ${p.wordCount} words · ${p.readingTimeMinutes} min · keyword: \`${p.keyword}\` · publish ${p.publishAt}
  ${p.metaDescription ?? ""}`).join("\n")}`);

      const compare = site.folder("compare") ?? site;
      (kit.comparisonPages ?? []).forEach((c: any) => {
        compare.file(`${c.slug ?? "vs"}.html`, c.html ?? "<!-- not generated -->");
      });
      compare.file("_index.md",
`# Comparison Pages
${(kit.comparisonPages ?? []).map((c: any) => `- **vs ${c.vsName}** — ${c.slug}.html\n  ${c.metaDescription ?? ""}`).join("\n")}`);

      const schema = zip.folder("schema") ?? zip;
      schema.file("organization.jsonld", JSON.stringify(kit.jsonLd?.organization ?? {}, null, 2));
      schema.file("software-application.jsonld", JSON.stringify(kit.jsonLd?.softwareApplication ?? {}, null, 2));
      schema.file("faq.jsonld", JSON.stringify(kit.jsonLd?.faqPage ?? {}, null, 2));
      schema.file("breadcrumb.jsonld", JSON.stringify(kit.jsonLd?.breadcrumb ?? {}, null, 2));

      const outreach = zip.folder("outreach") ?? zip;
      outreach.file("backlink-emails.md",
`# Backlink Outreach
${(kit.backlinkOutreach ?? []).map((o: any) =>
`## ${o.targetType} · ${o.targetName} (DA ${o.domainAuthorityBucket})
**Subject:** ${o.subject}

${o.body}
`).join("\n")}`);
      outreach.file("directories.md",
`# Directories to Submit
| Priority | Name | Category | URL |
|---|---|---|---|
${(kit.directoriesToSubmit ?? []).map((d: any) => `| ${d.priority} | ${d.name} | ${d.category} | ${d.url} |`).join("\n")}`);

      const seo = zip.folder("seo") ?? zip;
      seo.file("keyword-clusters.md",
`# Keyword Clusters
${(kit.keywordClusters ?? []).map((c: any) =>
`## ${c.cluster} (${c.intent})
- **Primary:** \`${c.primary}\`
- **Supporting:** ${(c.supporting ?? []).map((s: string) => `\`${s}\``).join(", ")}
`).join("\n")}`);
      seo.file("internal-links.md",
`# Internal Link Plan
${(kit.internalLinkPlan ?? []).map((l: any) => `- \`${l.fromPage}\` → \`${l.toPage}\` (anchor: "${l.anchor}")`).join("\n")}`);
      seo.file("checklist.md",
`# SEO Checklist
${(kit.seoChecklist ?? []).map((c: any) => `- [${c.status === "ready" ? "x" : " "}] (${c.priority}) ${c.item}`).join("\n")}`);

      zip.file("opengraph.md",
`# Open Graph / Twitter Card
- **Title:** ${kit.opengraphSpec?.title ?? ""}
- **Description:** ${kit.opengraphSpec?.description ?? ""}
- **Twitter card:** ${kit.opengraphSpec?.twitterCard ?? ""}

## Image brief
${kit.opengraphSpec?.imageBrief ?? ""}`);
      zip.file("favicon.md", `# Favicon Brief\n\n${kit.faviconBrief ?? ""}`);

      zip.file("raw-pack.json", JSON.stringify(kit, null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      const safe = (selected.name ?? "extension").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      el.href = url; el.download = `${safe}-marketing-site.zip`; el.click();
      URL.revokeObjectURL(url);

      setAnalyses((prev) => ({ ...prev, [`marketingSite:${selected.id}`]: kit }));
      toast.success("Marketing site ready");
    } catch (e: any) {
      toast.error(e.message ?? "Marketing site failed");
    } finally { setAnalyzing(null); }
  }









  async function oneClickShip() {
    if (!reportId || !selected?.id) { toast.error("Select a competitor first"); return; }
    const blueprint = a("blueprint");
    const buildBetter = a("buildBetter");
    const architecture = a("architecture");
    if (!blueprint && !buildBetter && !architecture) {
      toast.error("Generate Blueprint, Build Better, or Architecture first (Build tab)");
      return;
    }
    setAnalyzing("ship");
    try {
      toast.info("Step 1/3 · Building extension…");
      const genRes = await supabase.functions.invoke("ext-intel-generate", {
        body: { blueprint, buildBetter, architecture, competitor_name: selected.name, category: selected.raw?.category ?? null },
      });
      if (genRes.error) throw genRes.error;
      if (genRes.data?.error) throw new Error(genRes.data.error);
      const ext = genRes.data.result;
      const extFiles: Record<string, string> = ext.files ?? {};
      if (!extFiles["manifest.json"]) throw new Error("Generator did not return manifest.json");

      toast.info("Step 2/3 · Generating Publish Kit…");
      const kitRes = await supabase.functions.invoke("ext-intel-store-kit", {
        body: { blueprint, buildBetter, listing: a("listing"), competitor_name: selected.name, category: selected.raw?.category ?? null },
      });
      if (kitRes.error) throw kitRes.error;
      if (kitRes.data?.error) throw new Error(kitRes.data.error);
      const kit = kitRes.data.result;

      toast.info("Step 3/3 · Generating icons…");
      const iconRes = await supabase.functions.invoke("ext-intel-icon", {
        body: { prompt: kit?.iconPrompt, extension_name: kit?.listing?.title ?? ext.name ?? selected.name },
      });
      if (iconRes.error) throw iconRes.error;
      if (iconRes.data?.error) throw new Error(iconRes.data.error);
      const b64 = iconRes.data.image_base64 as string;
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to decode icon"));
        img.src = `data:image/png;base64,${b64}`;
      });
      const resize = async (size: number): Promise<ArrayBuffer> => {
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, size, size);
        const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
        return await blob.arrayBuffer();
      };
      const [i16, i48, i128, i512] = await Promise.all([resize(16), resize(48), resize(128), resize(512)]);

      // Merge real icons into the manifest and repoint paths to icons/*
      try {
        const manifest = JSON.parse(extFiles["manifest.json"]);
        manifest.icons = { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" };
        if (manifest.action) manifest.action.default_icon = { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" };
        extFiles["manifest.json"] = JSON.stringify(manifest, null, 2);
      } catch { /* leave as-is */ }

      const zip = new JSZip();
      const extFolder = zip.folder("extension")!;
      Object.entries(extFiles).forEach(([p, c]) => extFolder.file(p, c));
      const iconFolder = extFolder.folder("icons")!;
      iconFolder.file("icon16.png", i16);
      iconFolder.file("icon48.png", i48);
      iconFolder.file("icon128.png", i128);

      const kitFolder = zip.folder("store-kit")!;
      const l = kit.listing ?? {};
      kitFolder.file("listing.md",
`# ${l.title ?? ""}

**Category:** ${l.category ?? ""}
**Language:** ${l.language ?? "en"}

## Short description
${l.shortDescription ?? ""}

## Detailed description
${l.detailedDescription ?? ""}

## Keywords
${(l.keywords ?? []).join(", ")}`);
      kitFolder.file("privacy-policy.md", kit.privacyPolicy ?? "");
      kitFolder.file("single-purpose.txt", kit.singlePurpose ?? "");
      const perms = (kit.permissionsJustification ?? []).map((p: any) =>
        `## ${p.permission}\n**Why:** ${p.why}\n**Minimal alternative:** ${p.minimalAlternative}\n`).join("\n");
      kitFolder.file("permissions.md", `# Permissions Justification\n\n${perms}`);
      kitFolder.file("data-usage.json", JSON.stringify(kit.dataUsageDisclosure ?? {}, null, 2));
      const tiles = (kit.promoTileConcepts ?? []).map((t: any) => `## ${t.size}\n${t.concept}\n`).join("\n");
      kitFolder.file("promo-tiles.md", `# Promotional Tile Concepts\n\n${tiles}`);
      const shots = (kit.screenshots ?? []).map((s: any, i: number) =>
        `## ${i + 1}. ${s.filename}\n**Size:** ${s.size}\n**Caption:** ${s.caption}\n**Content:** ${s.content}\n`).join("\n");
      kitFolder.file("screenshots.md", `# Screenshot Brief\n\n${shots}`);
      kitFolder.file("raw-kit.json", JSON.stringify(kit, null, 2));

      const assets = zip.folder("assets")!;
      assets.file("icon512.png", i512);

      zip.file("SHIP.md",
`# Ship-Ready Bundle — ${l.title ?? ext.name ?? selected.name}
Generated ${new Date().toISOString()}

## Contents
- \`extension/\` — Load-unpacked-ready MV3 extension with real 16/48/128 icons merged in
- \`store-kit/\` — CWS listing, privacy policy, permissions justification, data-usage form, promo tile & screenshot briefs
- \`assets/icon512.png\` — Source-quality icon for store artwork

## Local test
1. Unzip this file.
2. Open \`chrome://extensions\`.
3. Toggle **Developer mode**.
4. Click **Load unpacked** → select the \`extension/\` folder.

## Chrome Web Store submission checklist
- [ ] Host \`store-kit/privacy-policy.md\` at a public URL, paste URL in CWS listing.
- [ ] Paste listing.md content into store listing fields.
- [ ] Paste \`single-purpose.txt\` into single-purpose description.
- [ ] Paste per-permission justifications from \`permissions.md\` into review notes.
- [ ] Answer data disclosure form using \`data-usage.json\`.
- [ ] Produce screenshots per \`screenshots.md\` (1280×800 or 640×400).
- [ ] Produce at least the 440×280 promo tile per \`promo-tiles.md\`.
- [ ] Upload \`assets/icon512.png\` as store icon.

All copy is original and IP-safe.`);

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      const safe = (l.title ?? ext.name ?? "extension").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      el.href = url; el.download = `${safe}-ship-ready.zip`; el.click();
      URL.revokeObjectURL(url);

      setAnalyses((prev) => ({
        ...prev,
        [`generated:${selected.id}`]: ext,
        [`storekit:${selected.id}`]: kit,
        [`icons:${selected.id}`]: { preview: `data:image/png;base64,${b64}` },
        [`ship:${selected.id}`]: { name: l.title ?? ext.name, at: new Date().toISOString() },
      }));
      toast.success(`Ship-ready bundle downloaded: ${safe}-ship-ready.zip`);
    } catch (e: any) {
      toast.error(e.message ?? "Ship bundle failed");
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
                <Card className="border-fuchsia-400/50 bg-gradient-to-br from-fuchsia-500/10 via-primary/10 to-emerald-400/10">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2"><Rocket className="h-4 w-4 text-fuchsia-400" />One-Click Ship-Ready Bundle</CardTitle>
                        <CardDescription className="text-[10px]">Runs Auto-Build → Publish Kit → AI Icons and merges everything into a single submission-ready ZIP. Real icons embedded, listing/privacy/permissions written, checklist included.</CardDescription>
                      </div>
                      <Button size="sm" onClick={oneClickShip} disabled={analyzing === "ship" || !selected} className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white">
                        {analyzing === "ship" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trophy className="h-3 w-3 mr-1" />}
                        Ship It
                      </Button>
                    </div>
                  </CardHeader>
                  {a("ship") && (
                    <CardContent className="text-xs space-y-1">
                      <div>✅ <strong>{a("ship").name}</strong> bundled at {new Date(a("ship").at).toLocaleTimeString()}</div>
                      <div className="text-[10px] text-muted-foreground">Structure: <code>extension/</code> (with real icons) · <code>store-kit/</code> · <code>assets/icon512.png</code> · <code>SHIP.md</code></div>
                    </CardContent>
                  )}
                </Card>
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

                <Card className="border-sky-400/40 bg-sky-400/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2"><Megaphone className="h-4 w-4 text-sky-400" />Launch & Marketing Kit</CardTitle>
                        <CardDescription className="text-[10px]">Product Hunt post, X launch thread, Reddit / HN / LinkedIn posts, cold emails, blog post, press release, self-contained landing page, day-by-day checklist. All original copy.</CardDescription>
                      </div>
                      <Button size="sm" onClick={generateLaunchKit} disabled={analyzing === "launch" || !selected}>
                        {analyzing === "launch" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
                        Generate Kit
                      </Button>
                    </div>
                  </CardHeader>
                  {a("launch") && (
                    <CardContent className="text-xs space-y-2">
                      <div><strong>{a("launch").positioning?.tagline}</strong></div>
                      <div className="text-muted-foreground">{a("launch").positioning?.oneLiner}</div>
                      <div className="flex flex-wrap gap-1">
                        {(a("launch").positioning?.uniqueValueProps ?? []).slice(0, 6).map((k: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-[9px]">{k}</Badge>
                        ))}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        PH · {(a("launch").tweets?.launchThread ?? []).length} tweets · {(a("launch").reddit ?? []).length} subreddits · {(a("launch").coldEmails ?? []).length} cold emails · landing page
                      </div>
                    </CardContent>
                  )}
                </Card>

                <Card className="border-violet-400/40 bg-violet-400/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4 text-violet-400" />Global Localization Kit</CardTitle>
                        <CardDescription className="text-[10px]">Culturally-adapted CWS listing + landing page in 10 locales (ES, PT-BR, DE, FR, JA, KO, ZH-CN, HI, RU, IT). Locale-native keywords, not raw translation. Uses Publish Kit + Launch Kit as source when present.</CardDescription>
                      </div>
                      <Button size="sm" onClick={generateLocalizationKit} disabled={analyzing === "localize" || !selected}>
                        {analyzing === "localize" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
                        Localize
                      </Button>
                    </div>
                  </CardHeader>
                  {a("localize") && (
                    <CardContent className="text-xs space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {(a("localize").locales ?? []).map((l: any, i: number) => (
                          <Badge key={i} variant="outline" className="text-[9px]">{l.locale} · {l.title?.slice(0, 24)}</Badge>
                        ))}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {(a("localize").locales ?? []).length} locales · listing + landing page per locale
                      </div>
                    </CardContent>
                  )}
                </Card>

                <Card className="border-emerald-400/40 bg-emerald-400/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-400" />Post-Launch Growth OS</CardTitle>
                        <CardDescription className="text-[10px]">Review-response library (5★→1★, bugs, feature reqs, permissions, pricing), ratings-recovery playbook, A/B listing variants, 90-day roadmap, changelog templates, support macros, retention & reactivation emails, uninstall survey, ASO refresh cadence, upgrade CTAs, community kit, and KPI targets.</CardDescription>
                      </div>
                      <Button size="sm" onClick={generateGrowthKit} disabled={analyzing === "growth" || !selected}>
                        {analyzing === "growth" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
                        Generate OS
                      </Button>
                    </div>
                  </CardHeader>
                  {a("growth") && (
                    <CardContent className="text-xs space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {Object.keys(a("growth").reviewResponses ?? {}).map((k) => (
                          <Badge key={k} variant="outline" className="text-[9px]">{k}</Badge>
                        ))}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {(a("growth").abListingVariants ?? []).length} A/B variants · {(a("growth").retentionEmails ?? []).length} retention · {(a("growth").supportMacros ?? []).length} macros · {(a("growth").kpis ?? []).length} KPIs
                      </div>
                    </CardContent>
                  )}
                </Card>

                <Card className="border-amber-400/40 bg-amber-400/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2"><Scale className="h-4 w-4 text-amber-400" />Legal & Compliance Vault</CardTitle>
                        <CardDescription className="text-[10px]">Privacy policy, ToS, DPA, cookie policy, DMCA, AUP, GDPR + CCPA notices, CWS single-purpose statement, per-permission & per-host justifications, remote-code statement, data-usage disclosure, security whitepaper, SOC2-lite checklist, incident response, subprocessors, breach templates, cookie banner + consent modal HTML.</CardDescription>
                      </div>
                      <Button size="sm" onClick={generateLegalVault} disabled={analyzing === "legal" || !selected}>
                        {analyzing === "legal" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
                        Generate Vault
                      </Button>
                    </div>
                  </CardHeader>
                  {a("legal") && (
                    <CardContent className="text-xs space-y-2">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[9px]">Privacy · {a("legal").privacyPolicy?.wordCount ?? 0} words</Badge>
                        <Badge variant="outline" className="text-[9px]">ToS</Badge>
                        <Badge variant="outline" className="text-[9px]">GDPR</Badge>
                        <Badge variant="outline" className="text-[9px]">CCPA</Badge>
                        <Badge variant="outline" className="text-[9px]">DPA</Badge>
                        <Badge variant="outline" className="text-[9px]">CWS single-purpose</Badge>
                        <Badge variant="outline" className="text-[9px]">{(a("legal").cwsPermissionJustifications ?? []).length} permission justifications</Badge>
                        <Badge variant="outline" className="text-[9px]">{(a("legal").soc2Checklist ?? []).length} SOC2 controls</Badge>
                        <Badge variant="outline" className="text-[9px]">{(a("legal").subprocessorList ?? []).length} subprocessors</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Sells data: {a("legal").cwsDataUsageDisclosure?.sellsData ? "yes" : "no"} · Collects PII: {a("legal").cwsDataUsageDisclosure?.collectsPii ? "yes" : "no"}
                      </div>
                    </CardContent>
                  )}
                </Card>

                <Card className="border-green-400/40 bg-green-400/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4 text-green-400" />Monetization & Revenue Engine</CardTitle>
                        <CardDescription className="text-[10px]">Recommended model (ARPU/LTV/churn), pricing tiers + self-contained pricing page, trigger-based paywalls, upsell/downsell/trial/cancellation flows, checkout + receipt + dunning + renewal emails, referral & affiliate programs, enterprise pitch + objection responses, ROI calculator, Stripe & Paddle blueprints with real code, license-key system, KPIs.</CardDescription>
                      </div>
                      <Button size="sm" onClick={generateRevenueEngine} disabled={analyzing === "revenue" || !selected}>
                        {analyzing === "revenue" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
                        Generate Engine
                      </Button>
                    </div>
                  </CardHeader>
                  {a("revenue") && (
                    <CardContent className="text-xs space-y-2">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[9px]">{a("revenue").strategy?.recommendedModel}</Badge>
                        <Badge variant="outline" className="text-[9px]">ARPU {a("revenue").strategy?.expectedArpu}</Badge>
                        <Badge variant="outline" className="text-[9px]">LTV {a("revenue").strategy?.expectedLtv}</Badge>
                        {(a("revenue").pricingTiers ?? []).map((t: any, i: number) => (
                          <Badge key={i} variant="outline" className="text-[9px]">{t.name} ${t.monthlyPrice}/mo</Badge>
                        ))}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {(a("revenue").paywallCopy ?? []).length} paywalls · {(a("revenue").upsellFlows ?? []).length} upsells · {(a("revenue").dunningEmails ?? []).length} dunning · Stripe + Paddle blueprints
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
