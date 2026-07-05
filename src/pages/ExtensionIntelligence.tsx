import { useEffect, useState } from "react";
import {
  Brain, Search, Sparkles, Loader2, ExternalLink, Star, Users, ShieldAlert,
  Layers, Target, Lightbulb, Building2, Wand2, DollarSign, Palette, ListChecks,
  FileText, Rocket, BarChart3, Trophy, Flame, Terminal, Download, Code2, Package, Megaphone, TrendingUp, Scale, CreditCard, Globe, Activity, GitBranch, LifeBuoy, TestTube2,
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

  async function generateAnalyticsKit() {
    if (!reportId || !selected?.id) { toast.error("Select a competitor first"); return; }
    setAnalyzing("analytics");
    try {
      const architecture = a("architecture") ?? null;
      const launch = a("launch") ?? null;
      const revenue = a("revenue") ?? null;
      const growth = a("growth") ?? null;
      const manifest = a("storekit")?.manifest ?? architecture?.manifest ?? null;
      const input = {
        product: {
          name: selected.name,
          category: selected.raw?.category ?? null,
          personas: launch?.positioning?.targetPersonas,
          tagline: launch?.positioning?.tagline,
        },
        pricingTiers: revenue?.pricingTiers?.map((t: any) => ({ name: t.name, monthlyPrice: t.monthlyPrice })),
        growthKpis: growth?.kpis,
        manifestPermissions: manifest?.permissions,
        surfaces: {
          hasPopup: !!manifest?.action?.default_popup,
          hasBackground: !!manifest?.background,
          hasContentScripts: !!manifest?.content_scripts?.length,
          hasOptions: !!manifest?.options_page || !!manifest?.options_ui,
        },
      };
      const { data, error } = await supabase.functions.invoke("ext-intel-analyze", {
        body: { stage: "analytics", input, report_id: reportId, competitor_id: selected.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const kit = data.result;

      const zip = new JSZip();
      zip.file("00-README.md",
`# Analytics & Instrumentation Kit
Generated ${new Date().toISOString()}

Privacy-safe by default: consent gated, no PII, hashed anon ids.

## Contents
- philosophy.md — principles, PII rules, retention, opt-in flow
- events/schema.md + events.json — full event schema with sampling
- identity/ — anon/user id strategy + code
- consent/ — banner HTML + storage key + gate code
- extension/ — MV3 tracker core + surface hooks (background, popup, content, onboarding, uninstall)
- adapters/ — GA4, PostHog, Plausible, Mixpanel, self-hosted (Edge Function + SQL schema)
- funnels.md, cohorts.md, dashboards.md
- sql-kpis/ — one file per KPI
- ab-testing/ — assignment code, experiment schema, guardrails, example experiments
- alerting.md — metric alerts + severity
- data-dictionary.md — event × property lookup
- privacy/ — CWS form answers + user-facing disclosure
- checklist.md
- raw-kit.json

## Install order
1. Add \`extension/tracker.ts\` to your extension source
2. Import it from \`background.ts\`, \`popup.ts\`, and any content script (see the ready-made files in extension/)
3. Add the consent banner to first-run/onboarding
4. Pick ONE adapter under \`adapters/\` and wire the env vars
5. Deploy the self-hosted edge function (optional) using \`adapters/self-hosted/edge.ts\` + \`schema.sql\`
6. Import the SQL KPIs into your BI tool of choice`);

      zip.file("philosophy.md",
`# Analytics Philosophy

## Principles
${(kit.philosophy?.principles ?? []).map((p: string) => `- ${p}`).join("\n")}

## PII rules
${(kit.philosophy?.piiRules ?? []).map((p: string) => `- ${p}`).join("\n")}

## Retention
${kit.philosophy?.retention ?? ""}

## Opt-in flow
${kit.philosophy?.optInFlow ?? ""}`);

      const events = zip.folder("events") ?? zip;
      events.file("schema.md",
`# Event Schema
${(kit.eventSchema ?? []).map((e: any) =>
`## \`${e.name}\` (${e.surface}) · sampling ${e.sampling ?? 1}
**Trigger:** ${e.trigger}

| Property | Type | Required | PII | Example |
|---|---|---|---|---|
${(e.properties ?? []).map((p: any) => `| \`${p.key}\` | ${p.type} | ${p.required ? "✓" : ""} | ${p.pii ? "⚠️" : ""} | ${p.example} |`).join("\n")}
`).join("\n")}`);
      events.file("events.json", JSON.stringify(kit.eventSchema ?? [], null, 2));

      const identity = zip.folder("identity") ?? zip;
      identity.file("README.md",
`# Identity

- **Anon id:** ${kit.identity?.anonIdStrategy ?? ""}
- **User id:** ${kit.identity?.userIdStrategy ?? ""}
- **Sessions:** ${kit.identity?.sessionRules ?? ""}`);
      identity.file("identity.ts", kit.identity?.code ?? "// not generated");

      const consent = zip.folder("consent") ?? zip;
      consent.file("banner.html", kit.consentBanner?.html ?? "<!-- not generated -->");
      consent.file("gate.ts", kit.consentBanner?.gateCode ?? "// not generated");
      consent.file("README.md", `# Consent\n\nStorage key: \`${kit.consentBanner?.storageKey ?? "analytics_consent"}\`\n\nCall the gate BEFORE any tracker call.`);

      const ext = zip.folder("extension") ?? zip;
      const snip = kit.extensionSnippets ?? {};
      ext.file("tracker.ts", snip.trackerCoreTs ?? "// not generated");
      ext.file("background.ts", snip.backgroundTs ?? "// not generated");
      ext.file("popup.ts", snip.popupTs ?? "// not generated");
      ext.file("content.ts", snip.contentTs ?? "// not generated");
      ext.file("onboarding.ts", snip.onboardingTs ?? "// not generated");
      ext.file("uninstall-hook.ts", snip.uninstallHookTs ?? "// not generated");

      const ad = kit.adapters ?? {};
      const adapters = zip.folder("adapters") ?? zip;
      const writeAdapter = (name: string, folderName: string, obj: any, extra?: (f: JSZip) => void) => {
        const f = adapters.folder(folderName) ?? adapters;
        f.file("README.md",
`# ${name}

## Env vars
${(obj?.envVars ?? []).map((e: string) => `- \`${e}\``).join("\n")}

${obj?.measurementProtocolNotes ? `## Notes\n${obj.measurementProtocolNotes}` : ""}`);
        f.file("adapter.ts", obj?.code ?? "// not generated");
        extra?.(f);
      };
      writeAdapter("GA4", "ga4", ad.ga4);
      writeAdapter("PostHog", "posthog", ad.posthog);
      writeAdapter("Plausible", "plausible", ad.plausible);
      writeAdapter("Mixpanel", "mixpanel", ad.mixpanel);
      if (ad.selfHosted) {
        const f = adapters.folder("self-hosted") ?? adapters;
        f.file("README.md", `# Self-hosted\n\n**Endpoint:** \`${ad.selfHosted.endpoint ?? ""}\``);
        f.file("adapter.ts", ad.selfHosted.code ?? "// not generated");
        f.file("edge.ts", ad.selfHosted.edgeFunctionCode ?? "// not generated");
        f.file("schema.sql", ad.selfHosted.sqlSchema ?? "-- not generated");
      }

      zip.file("funnels.md",
`# Funnels
${(kit.funnels ?? []).map((f: any) =>
`## ${f.name}
${f.steps?.map((s: any, i: number) => `${i + 1}. \`${s.event}\` (within ${s.windowMinutes} min)`).join("\n")}

**Success:** ${f.successCriterion}
`).join("\n")}`);

      zip.file("cohorts.md",
`# Cohorts
${(kit.cohorts ?? []).map((c: any) => `## ${c.name}\n**Purpose:** ${c.purpose}\n\n\`\`\`\n${c.definition}\n\`\`\``).join("\n\n")}`);

      zip.file("dashboards.md",
`# Dashboards
${(kit.dashboards ?? []).map((d: any) =>
`## ${d.name} (${d.tool})
| Widget | Metric | Viz |
|---|---|---|
${(d.widgets ?? []).map((w: any) => `| ${w.title} | ${w.metric} | ${w.viz} |`).join("\n")}
`).join("\n")}`);

      const kpis = zip.folder("sql-kpis") ?? zip;
      (kit.sqlKpis ?? []).forEach((k: any) => {
        const slug = String(k.name ?? "kpi").toLowerCase().replace(/[^a-z0-9]+/g, "-");
        kpis.file(`${slug}.${k.dialect ?? "sql"}.sql`, `-- ${k.name}\n-- dialect: ${k.dialect}\n\n${k.sql ?? ""}`);
      });

      const ab = kit.abTestFramework ?? {};
      const abFolder = zip.folder("ab-testing") ?? zip;
      abFolder.file("assignment.ts", ab.assignmentCode ?? "// not generated");
      abFolder.file("schema.sql", ab.experimentSchemaSql ?? "-- not generated");
      abFolder.file("README.md",
`# A/B Testing

## Guardrail metrics
${(ab.guardrailMetrics ?? []).map((g: string) => `- ${g}`).join("\n")}

## Sample size
${ab.sampleSizeGuidance ?? ""}

## Example experiments
${(ab.exampleExperiments ?? []).map((e: any) =>
`### ${e.name}
- **Hypothesis:** ${e.hypothesis}
- **Variants:** ${(e.variants ?? []).join(", ")}
- **Primary metric:** ${e.primaryMetric}
- **Guardrails:** ${(e.guardrails ?? []).join(", ")}
`).join("\n")}`);

      zip.file("alerting.md",
`# Alerting
| Severity | Metric | Condition | Channel |
|---|---|---|---|
${(kit.alerting ?? []).map((a: any) => `| ${a.severity} | ${a.metric} | ${a.condition} | ${a.channel} |`).join("\n")}`);

      zip.file("data-dictionary.md",
`# Data Dictionary
| Event | Property | Description | Example |
|---|---|---|---|
${(kit.dataDictionary ?? []).map((d: any) => `| \`${d.event}\` | \`${d.property}\` | ${d.description} | ${d.example} |`).join("\n")}`);

      const priv = zip.folder("privacy") ?? zip;
      priv.file("cws-form-answers.md",
`# CWS Privacy Practices — Answers
${(kit.privacyDisclosure?.cwsFormAnswers ?? []).map((f: any) => `## ${f.field}\n${f.answer}\n`).join("\n")}`);
      priv.file("user-facing.md", kit.privacyDisclosure?.userFacingMarkdown ?? "");

      zip.file("checklist.md",
`# Instrumentation Checklist
${(kit.instrumentationChecklist ?? []).map((c: any) => `- [${c.status === "ready" ? "x" : " "}] (${c.priority}) [${c.surface}] ${c.item}`).join("\n")}`);

      zip.file("raw-kit.json", JSON.stringify(kit, null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      const safe = (selected.name ?? "extension").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      el.href = url; el.download = `${safe}-analytics-kit.zip`; el.click();
      URL.revokeObjectURL(url);

      setAnalyses((prev) => ({ ...prev, [`analytics:${selected.id}`]: kit }));
      toast.success("Analytics kit ready");
    } catch (e: any) {
      toast.error(e.message ?? "Analytics kit failed");
    } finally { setAnalyzing(null); }
  }

  async function generateCicdPipeline() {
    if (!reportId || !selected?.id) { toast.error("Select a competitor first"); return; }
    setAnalyzing("cicd");
    try {
      const architecture = a("architecture") ?? null;
      const manifest = a("storekit")?.manifest ?? architecture?.manifest ?? null;
      const input = {
        product: {
          name: selected.name,
          category: selected.raw?.category ?? null,
        },
        manifest,
        hasTests: true,
        packageManager: "npm",
      };
      const { data, error } = await supabase.functions.invoke("ext-intel-analyze", {
        body: { stage: "cicd", input, report_id: reportId, competitor_id: selected.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const kit = data.result;

      const zip = new JSZip();
      zip.file("00-README.md",
`# CI/CD & Auto-Publish Pipeline
Generated ${new Date().toISOString()}

## Philosophy
${kit.overview?.philosophy ?? ""}

- **Branches:** ${kit.overview?.branchStrategy ?? ""}
- **Environments:** ${(kit.overview?.environments ?? []).join(", ")}
- **Release cadence:** ${kit.overview?.releaseCadence ?? ""}

## Layout (drop into your repo root)
- .github/workflows/ — CI, release, publish, nightly, PR preview, dep review
- .github/ — dependabot.yml, PR + issue templates, CODEOWNERS
- scripts/ — build/package/upload/publish/version/changelog/screenshots/preflight
- config files — eslint, prettier, gitignore, changesets, release-please, commitlint, husky, size-budget
- docs/ — CONTRIBUTING, RELEASING, TROUBLESHOOTING, SECURITY
- CHANGELOG.md seed + release notes template
- rollback/, monitoring/, matrix-testing.md, smoke-tests/

## Prereqs
1. Set the GitHub secrets listed in prerequisites/
2. Set up Chrome Web Store API credentials (see prerequisites/cws-api.md)
3. Run \`npm install\` after merging package.json scripts
4. Tag \`v1.0.0\` and push to trigger the first publish`);

      // Prereqs
      const pre = zip.folder("prerequisites") ?? zip;
      pre.file("cws-api.md",
`# Chrome Web Store API Setup

## Steps
${(kit.prerequisites?.chromeWebStoreApi?.steps ?? []).map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}

## Required secrets
${(kit.prerequisites?.chromeWebStoreApi?.requiredSecrets ?? []).map((s: any) => `### \`${s.name}\`\n**Purpose:** ${s.purpose}\n**How to obtain:** ${s.howToObtain}\n`).join("\n")}`);
      pre.file("github-secrets.md",
`# GitHub Secrets
${(kit.prerequisites?.githubSecrets ?? []).map((s: any) => `- \`${s.name}\` — ${s.purpose}`).join("\n")}`);

      // Workflows
      const wf = zip.folder(".github/workflows") ?? zip;
      const w = kit.workflows ?? {};
      wf.file("ci.yml", w.ciYaml ?? "# not generated");
      wf.file("release.yml", w.releaseYaml ?? "# not generated");
      wf.file("publish.yml", w.publishYaml ?? "# not generated");
      wf.file("nightly.yml", w.nightlyYaml ?? "# not generated");
      wf.file("pr-preview.yml", w.prPreviewYaml ?? "# not generated");
      wf.file("dependency-review.yml", w.dependencyReviewYaml ?? "# not generated");

      // Scripts
      const scripts = zip.folder("scripts") ?? zip;
      const s = kit.scripts ?? {};
      scripts.file("build.ts", s.buildTs ?? "// not generated");
      scripts.file("package.ts", s.packageTs ?? "// not generated");
      scripts.file("upload-to-cws.ts", s.uploadToCwsTs ?? "// not generated");
      scripts.file("publish-on-cws.ts", s.publishOnCwsTs ?? "// not generated");
      scripts.file("bump-version.ts", s.bumpVersionTs ?? "// not generated");
      scripts.file("generate-changelog.ts", s.generateChangelogTs ?? "// not generated");
      scripts.file("generate-release-notes.ts", s.generateReleaseNotesTs ?? "// not generated");
      scripts.file("regenerate-screenshots.ts", s.regenerateScreenshotsTs ?? "// not generated");
      scripts.file("preflight-checks.ts", s.preflightChecksTs ?? "// not generated");
      scripts.file("manifest-validator.ts", s.manifestValidatorTs ?? "// not generated");
      scripts.file("size-budget-check.ts", s.sizeBudgetCheckTs ?? "// not generated");

      // Configs
      const c = kit.configs ?? {};
      zip.file("package.json.scripts.json",
`# Merge these into your package.json "scripts" block
${JSON.stringify(c.packageJsonScripts ?? {}, null, 2)}`);
      zip.file(".github/dependabot.yml", c.dependabotYml ?? "# not generated");
      zip.file("eslint.config.mjs", c.eslintConfig ?? "// not generated");
      zip.file(".prettierrc.json", c.prettierConfig ?? "{}");
      zip.file(".gitignore", c.gitignore ?? "node_modules\ndist\n*.zip\n");
      zip.file(".changeset/config.json", c.changesetsConfig ?? "{}");
      zip.file("release-please-config.json", c.releasePleaseConfig ?? "{}");
      zip.file(".commitlintrc.json", c.commitlintConfig ?? "{}");
      zip.file(".husky/pre-commit", c.huskyPreCommit ?? "#!/usr/bin/env sh\nnpm run lint\n");
      zip.file("size-budget.json", c.sizeBudgetJson ?? "{}");

      // Docs
      const d = kit.docs ?? {};
      const docs = zip.folder("docs") ?? zip;
      docs.file("CONTRIBUTING.md", d.contributingMd ?? "");
      docs.file("RELEASING.md", d.releasingMd ?? "");
      docs.file("TROUBLESHOOTING.md", d.troubleshootingMd ?? "");
      docs.file("SECURITY.md", d.securityMd ?? "");
      zip.file(".github/PULL_REQUEST_TEMPLATE.md", d.prTemplateMd ?? "");
      zip.file(".github/ISSUE_TEMPLATE/bug_report.md", d.issueTemplateBug ?? "");
      zip.file(".github/ISSUE_TEMPLATE/feature_request.md", d.issueTemplateFeature ?? "");
      zip.file(".github/CODEOWNERS", d.codeownersFile ?? "");

      // Release notes + changelog
      zip.file("RELEASE_NOTES_TEMPLATE.md", kit.releaseNotesTemplate ?? "");
      zip.file("CHANGELOG.md", kit.changelogSeed ?? "# Changelog\n\nAll notable changes to this project will be documented in this file.\n");

      // Versioning
      zip.file("versioning.md",
`# Versioning Strategy

- **Scheme:** ${kit.versioningStrategy?.scheme ?? ""}
- **Prerelease channels:** ${(kit.versioningStrategy?.prereleaseChannels ?? []).join(", ")}

## Rules
${kit.versioningStrategy?.rules ?? ""}`);

      // Smoke tests
      const smoke = zip.folder("smoke-tests") ?? zip;
      (kit.smokeTests ?? []).forEach((t: any) => {
        const slug = String(t.name ?? "test").toLowerCase().replace(/[^a-z0-9]+/g, "-");
        smoke.file(`${slug}.spec.ts`, `// ${t.name}\n// ${t.description}\n\n${t.code ?? ""}`);
      });

      // Puppeteer preflight
      const pf = zip.folder("preflight") ?? zip;
      pf.file("README.md", kit.puppeteerPreflight?.description ?? "");
      pf.file("puppeteer-preflight.ts", kit.puppeteerPreflight?.code ?? "// not generated");

      // CWS API notes
      zip.file("cws-api-notes.md",
`# Chrome Web Store API Notes

## Endpoints
${(kit.cwsApiNotes?.endpoints ?? []).map((e: any) => `- **${e.method}** \`${e.url}\` — ${e.purpose}`).join("\n")}

## Quota
${kit.cwsApiNotes?.quotaGuidance ?? ""}

## Common errors
| Code | Cause | Fix |
|---|---|---|
${(kit.cwsApiNotes?.commonErrors ?? []).map((e: any) => `| ${e.code} | ${e.cause} | ${e.fix} |`).join("\n")}`);

      // Rollback
      const rb = zip.folder("rollback") ?? zip;
      rb.file("README.md", kit.rollbackPlan?.markdown ?? "");
      rb.file("rollback.ts", kit.rollbackPlan?.scriptTs ?? "// not generated");

      // Matrix testing
      zip.file("matrix-testing.md",
`# Matrix Testing

- **Browsers:** ${(kit.matrixTesting?.browsers ?? []).join(", ")}
- **Chrome channels:** ${(kit.matrixTesting?.chromeChannels ?? []).join(", ")}

${kit.matrixTesting?.notes ?? ""}`);

      // Monitoring
      const mon = zip.folder("monitoring") ?? zip;
      mon.file("badges.md", kit.monitoring?.buildStatusBadgesMd ?? "");
      mon.file("slack-notifier.ts", kit.monitoring?.slackNotifierCode ?? "// not generated");

      // Checklist
      zip.file("checklist.md",
`# CI/CD Setup Checklist
${(kit.checklist ?? []).map((c: any) => `- [${c.status === "ready" ? "x" : " "}] (${c.priority}) ${c.item}`).join("\n")}`);

      zip.file("raw-pipeline.json", JSON.stringify(kit, null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      const safe = (selected.name ?? "extension").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      el.href = url; el.download = `${safe}-cicd-pipeline.zip`; el.click();
      URL.revokeObjectURL(url);

      setAnalyses((prev) => ({ ...prev, [`cicd:${selected.id}`]: kit }));
      toast.success("CI/CD pipeline ready");
    } catch (e: any) {
      toast.error(e.message ?? "CI/CD pipeline failed");
    } finally { setAnalyzing(null); }
  }

  async function generateSupportHub() {
    if (!reportId || !selected?.id) { toast.error("Select a competitor first"); return; }
    setAnalyzing("supportHub");
    try {
      const architecture = a("architecture") ?? null;
      const listing = a("storekit")?.listing ?? null;
      const input = {
        product: {
          name: selected.name,
          category: selected.raw?.category ?? null,
          description: selected.raw?.description ?? null,
        },
        architecture,
        listing,
      };
      const { data, error } = await supabase.functions.invoke("ext-intel-analyze", {
        body: { stage: "supportHub", input, report_id: reportId, competitor_id: selected.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const kit = data.result;

      const zip = new JSZip();
      zip.file("00-README.md",
`# Support & Help Center Kit
Generated ${new Date().toISOString()}

## Philosophy
${kit.overview?.philosophy ?? ""}

- **Channels:** ${(kit.overview?.supportChannels ?? []).join(", ")}
- **Target response:** ${kit.overview?.targetResponseTime ?? ""}
- **Target resolution:** ${kit.overview?.targetResolutionTime ?? ""}
- **Tone:** ${kit.overview?.tone ?? ""}

## Layout
- help-center/ — index, categories, ${(kit.helpCenter?.articles ?? []).length} articles, sitemap, search index
- faq/ — page + JSON-LD
- in-app-help/ — widget (html/css/js) + tooltips + onboarding
- canned-responses/ — ${(kit.cannedResponses ?? []).length} macros
- ticket-templates/ — bug, feature, refund, account, permissions, data-deletion
- sla/ — policy + tiers
- escalation/ — ${(kit.escalationPlaybooks ?? []).length} playbooks
- contact/ — page + form
- status/ — status page + incident template
- chatbot/ — KB + intents + handoff
- review-responses/ — CWS review reply templates
- metrics/ — support KPIs`);

      // Help center
      const hc = zip.folder("help-center") ?? zip;
      hc.file("index.html", kit.helpCenter?.indexHtml ?? "");
      hc.file("sitemap.xml", kit.helpCenter?.sitemapXml ?? "");
      hc.file("search-index.json", kit.helpCenter?.searchIndexJson ?? "{}");
      hc.file("categories.json", JSON.stringify(kit.helpCenter?.categories ?? [], null, 2));
      const articles = hc.folder("articles") ?? hc;
      (kit.helpCenter?.articles ?? []).forEach((art: any) => {
        articles.file(`${art.slug ?? "article"}.html`, art.html ?? "");
      });
      hc.file("articles-index.md",
`# Articles
${(kit.helpCenter?.articles ?? []).map((a: any) => `- [${a.title}](./articles/${a.slug}.html) — ${a.estReadMinutes ?? "?"} min — _${a.categorySlug}_`).join("\n")}`);

      // FAQ
      const faq = zip.folder("faq") ?? zip;
      faq.file("index.html", kit.faq?.pageHtml ?? "");
      faq.file("faq.json", JSON.stringify(kit.faq?.items ?? [], null, 2));
      faq.file("faq-jsonld.json", kit.faq?.jsonLd ?? "{}");

      // In-app help
      const iah = zip.folder("in-app-help") ?? zip;
      iah.file("widget.html", kit.inAppHelp?.widgetHtml ?? "");
      iah.file("widget.css", kit.inAppHelp?.widgetCss ?? "");
      iah.file("widget.js", kit.inAppHelp?.widgetJs ?? "");
      iah.file("tooltips.json", JSON.stringify(kit.inAppHelp?.contextualTooltips ?? [], null, 2));
      iah.file("onboarding.json", JSON.stringify(kit.inAppHelp?.onboardingChecklist ?? [], null, 2));

      // Canned responses
      const cr = zip.folder("canned-responses") ?? zip;
      (kit.cannedResponses ?? []).forEach((c: any) => {
        const slug = String(c.id ?? c.title ?? "macro").toLowerCase().replace(/[^a-z0-9]+/g, "-");
        cr.file(`${slug}.md`,
`# ${c.title}

**Channel:** ${c.channel}
**Trigger:** ${c.trigger}
**Tags:** ${(c.tags ?? []).join(", ")}

---

${c.body ?? ""}`);
      });

      // Ticket templates
      const tt = zip.folder("ticket-templates") ?? zip;
      const t = kit.ticketTemplates ?? {};
      tt.file("bug-report.md", t.bugReport ?? "");
      tt.file("feature-request.md", t.featureRequest ?? "");
      tt.file("refund-request.md", t.refundRequest ?? "");
      tt.file("account-issue.md", t.accountIssue ?? "");
      tt.file("permissions-concern.md", t.permissionsConcern ?? "");
      tt.file("data-deletion-request.md", t.dataDeletionRequest ?? "");

      // SLA
      const sla = zip.folder("sla") ?? zip;
      sla.file("policy.md", kit.slaPolicy?.markdown ?? "");
      sla.file("tiers.json", JSON.stringify(kit.slaPolicy?.tiers ?? [], null, 2));

      // Escalation
      const esc = zip.folder("escalation") ?? zip;
      (kit.escalationPlaybooks ?? []).forEach((p: any, i: number) => {
        const slug = String(p.scenario ?? `playbook-${i}`).toLowerCase().replace(/[^a-z0-9]+/g, "-");
        esc.file(`${p.severity ?? "p2"}-${slug}.md`,
`# ${p.scenario} (${p.severity})

**Owner:** ${p.owner}

## Steps
${(p.steps ?? []).map((s: string, idx: number) => `${idx + 1}. ${s}`).join("\n")}

## Comms template
${p.commsTemplate ?? ""}`);
      });

      // Contact
      const contact = zip.folder("contact") ?? zip;
      contact.file("index.html", kit.contactPage?.html ?? "");
      contact.file("form-fields.json", JSON.stringify(kit.contactPage?.formFields ?? [], null, 2));

      // Status
      const status = zip.folder("status") ?? zip;
      status.file("index.html", kit.statusPage?.html ?? "");
      status.file("components.json", JSON.stringify(kit.statusPage?.componentsToMonitor ?? [], null, 2));
      status.file("incident-template.md", kit.statusPage?.incidentTemplateMd ?? "");

      // Chatbot
      const bot = zip.folder("chatbot") ?? zip;
      bot.file("system-prompt.md", kit.chatbotKnowledgeBase?.systemPrompt ?? "");
      bot.file("intents.json", JSON.stringify(kit.chatbotKnowledgeBase?.intents ?? [], null, 2));
      bot.file("handoff-rules.md", (kit.chatbotKnowledgeBase?.handoffRules ?? []).map((r: string) => `- ${r}`).join("\n"));

      // Review responses
      const rr = zip.folder("review-responses") ?? zip;
      (kit.reviewResponseTemplates ?? []).forEach((r: any, i: number) => {
        rr.file(`${r.starRating ?? "x"}-star-${String(r.sentiment ?? i).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`,
`# ${r.starRating}★ — ${r.sentiment}

${r.template ?? ""}`);
      });

      // Metrics
      zip.file("metrics.md",
`# Support Metrics
${(kit.supportMetrics ?? []).map((m: any) => `## ${m.name}\n- **Definition:** ${m.definition}\n- **Target:** ${m.target}\n\n\`\`\`\n${m.sqlOrFormula ?? ""}\n\`\`\`\n`).join("\n")}`);

      // Checklist
      zip.file("checklist.md",
`# Support Launch Checklist
${(kit.checklist ?? []).map((c: any) => `- [${c.status === "ready" ? "x" : " "}] (${c.priority}) ${c.item}`).join("\n")}`);

      zip.file("raw-support-kit.json", JSON.stringify(kit, null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      const safe = (selected.name ?? "extension").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      el.href = url; el.download = `${safe}-support-hub.zip`; el.click();
      URL.revokeObjectURL(url);

      setAnalyses((prev) => ({ ...prev, [`supportHub:${selected.id}`]: kit }));
      toast.success("Support & help center kit ready");
    } catch (e: any) {
      toast.error(e.message ?? "Support hub generation failed");
    } finally { setAnalyzing(null); }
  }


  async function generateQaHarness() {
    if (!reportId || !selected?.id) { toast.error("Select a competitor first"); return; }
    setAnalyzing("qaHarness");
    try {
      const architecture = a("architecture") ?? null;
      const manifest = a("storekit")?.manifest ?? architecture?.manifest ?? null;
      const input = {
        product: {
          name: selected.name,
          category: selected.raw?.category ?? null,
        },
        manifest,
        surfaces: ["popup", "options", "background", "content", "onboarding"],
        packageManager: "npm",
      };
      const { data, error } = await supabase.functions.invoke("ext-intel-analyze", {
        body: { stage: "qaHarness", input, report_id: reportId, competitor_id: selected.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const kit = data.result;

      const zip = new JSZip();
      zip.file("00-README.md",
`# QA & Test Harness
Generated ${new Date().toISOString()}

## Philosophy
${kit.overview?.philosophy ?? ""}

## Test pyramid
- **Unit:** ${kit.overview?.testPyramid?.unit ?? ""}
- **Integration:** ${kit.overview?.testPyramid?.integration ?? ""}
- **E2E:** ${kit.overview?.testPyramid?.e2e ?? ""}

## Coverage targets
- Statements: ${kit.overview?.coverageTargets?.statements ?? "?"}%
- Branches: ${kit.overview?.coverageTargets?.branches ?? "?"}%
- Functions: ${kit.overview?.coverageTargets?.functions ?? "?"}%
- Lines: ${kit.overview?.coverageTargets?.lines ?? "?"}%

## Layout
- unit/ — vitest config, setup, chrome mocks, sample specs
- integration/ — cross-surface harness
- e2e/playwright/ — extension loader + specs + fixtures
- e2e/puppeteer/ — alternative launcher + specs
- permission-fuzzer/ — manifest / CSP / messaging fuzzers
- a11y/ — axe audits per surface
- cross-browser/ — matrix runner + aggregator
- visual-regression/ — screenshot diffing
- performance/ — budgets, lighthouse, TTI, memory leak detector
- load-stress/ — storage/messaging/tabs stress
- validators/ — manifest, CWS policy, privacy leak, permission minimizer
- mocks/ — reusable chrome API factories
- smoke/ + regression/ — curated suites
- reports/ — HTML + dashboard + Slack digest
- ci/ — GitHub workflow + PR comment bot`);

      // Tooling
      zip.file("tooling.md",
`# Tooling choices
${(kit.toolingChoices ?? []).map((t: any) => `- **${t.layer}** → ${t.tool} — ${t.why}`).join("\n")}`);

      // Unit
      const u = kit.unit ?? {};
      const unit = zip.folder("unit") ?? zip;
      unit.file(u.configFile ?? "vitest.config.ts", u.configContent ?? "");
      unit.file(u.setupFile ?? "test-setup.ts", u.setupContent ?? "");
      unit.file("chrome-api-mock.ts", u.chromeApiMockCode ?? "");
      unit.file("coverage-notes.md", u.coverageConfigNotes ?? "");
      const unitSamples = unit.folder("samples") ?? unit;
      (u.sampleTests ?? []).forEach((t: any) => {
        unitSamples.file(t.path ?? `${(t.description ?? "test").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.test.ts`, `// ${t.description}\n\n${t.code ?? ""}`);
      });

      // Integration
      const integ = kit.integration ?? {};
      const integration = zip.folder("integration") ?? zip;
      integration.file("README.md", `# Integration (${integ.framework ?? ""})\n\n${integ.notes ?? ""}`);
      integration.file("harness.ts", integ.harnessCode ?? "");
      const integSamples = integration.folder("samples") ?? integration;
      (integ.sampleTests ?? []).forEach((t: any) => {
        integSamples.file(t.path ?? `${(t.description ?? "test").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.test.ts`, `// ${t.description}\n\n${t.code ?? ""}`);
      });

      // Playwright
      const pw = kit.e2ePlaywright ?? {};
      const playwright = zip.folder("e2e/playwright") ?? zip;
      playwright.file(pw.configFile ?? "playwright.config.ts", pw.configContent ?? "");
      playwright.file("global-setup.ts", pw.globalSetupCode ?? "");
      playwright.file("extension-loader.ts", pw.extensionLoaderCode ?? "");
      playwright.file("fixtures.ts", pw.fixturesCode ?? "");
      playwright.file("NOTES.md", pw.notes ?? "");
      const pwSpecs = playwright.folder("specs") ?? playwright;
      (pw.sampleSpecs ?? []).forEach((s: any) => {
        pwSpecs.file(s.path ?? `${(s.description ?? "spec").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.spec.ts`, `// ${s.description}\n\n${s.code ?? ""}`);
      });

      // Puppeteer
      const pp = kit.e2ePuppeteer ?? {};
      const puppeteer = zip.folder("e2e/puppeteer") ?? zip;
      puppeteer.file("NOTES.md", pp.configNotes ?? "");
      puppeteer.file("extension-launcher.ts", pp.extensionLauncherCode ?? "");
      const ppSpecs = puppeteer.folder("specs") ?? puppeteer;
      (pp.sampleSpecs ?? []).forEach((s: any) => {
        ppSpecs.file(s.path ?? `${(s.description ?? "spec").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.spec.ts`, `// ${s.description}\n\n${s.code ?? ""}`);
      });

      // Permission fuzzer
      const pf = kit.permissionFuzzer ?? {};
      const fuzz = zip.folder("permission-fuzzer") ?? zip;
      fuzz.file("README.md", pf.philosophy ?? "");
      fuzz.file("permission-fuzzer.ts", pf.fuzzerCode ?? "");
      fuzz.file("permission-matrix.json", pf.permissionMatrixJson ?? "{}");
      fuzz.file("csp-fuzzer.ts", pf.cspFuzzerCode ?? "");
      fuzz.file("messaging-fuzzer.ts", pf.messagingFuzzerCode ?? "");
      fuzz.file("scenarios.md",
`# Scenarios
${(pf.sampleScenarios ?? []).map((s: any) => `## ${s.name}\n\n**Manifest patch:**\n\`\`\`json\n${s.manifestPatch}\n\`\`\`\n\n**Expected:** ${s.expectedOutcome}\n`).join("\n")}`);

      // Accessibility
      const ax = kit.accessibility ?? {};
      const a11yF = zip.folder("a11y") ?? zip;
      a11yF.file("axe-config.ts", ax.axeConfigCode ?? "");
      a11yF.file("popup.audit.ts", ax.popupAuditCode ?? "");
      a11yF.file("options.audit.ts", ax.optionsAuditCode ?? "");
      a11yF.file("onboarding.audit.ts", ax.onboardingAuditCode ?? "");
      a11yF.file("report-renderer.ts", ax.reportRendererCode ?? "");
      a11yF.file("README.md",
`# Accessibility (${ax.wcagLevel ?? "AA"})
Surfaces audited: ${(ax.surfacesToAudit ?? []).join(", ")}`);

      // Cross-browser
      const cb = kit.crossBrowserMatrix ?? {};
      const cross = zip.folder("cross-browser") ?? zip;
      cross.file("targets.json", JSON.stringify(cb.targets ?? [], null, 2));
      cross.file("runner.ts", cb.runnerCode ?? "");
      cross.file("matrix.yml", cb.githubMatrixYaml ?? "");
      cross.file("aggregator.ts", cb.resultsAggregatorCode ?? "");

      // Visual regression
      const vr = kit.visualRegression ?? {};
      const visual = zip.folder("visual-regression") ?? zip;
      visual.file("README.md", `# Visual regression (${vr.tool ?? ""})\n\n**Baseline strategy:** ${vr.baselineStrategy ?? ""}`);
      visual.file("config.ts", vr.configCode ?? "");
      const vrSpecs = visual.folder("specs") ?? visual;
      (vr.sampleSpecs ?? []).forEach((s: any) => {
        vrSpecs.file(s.path ?? `${(s.description ?? "spec").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.spec.ts`, `// ${s.description}\n\n${s.code ?? ""}`);
      });

      // Performance
      const perf = kit.performance ?? {};
      const perfF = zip.folder("performance") ?? zip;
      perfF.file("budgets.json", perf.budgetsJson ?? "{}");
      perfF.file("lighthouserc.json", perf.lighthouseCiConfig ?? "{}");
      perfF.file("popup-tti.test.ts", perf.popupTtiTestCode ?? "");
      perfF.file("sw-bench.test.ts", perf.backgroundServiceWorkerBenchCode ?? "");
      perfF.file("memory-leak-detector.ts", perf.memoryLeakDetectorCode ?? "");

      // Load & stress
      const ls = kit.loadAndStress ?? {};
      const load = zip.folder("load-stress") ?? zip;
      load.file("README.md", ls.notes ?? "");
      load.file("storage-stress.test.ts", ls.storageStressTestCode ?? "");
      load.file("messaging-storm.test.ts", ls.messagingStormTestCode ?? "");
      load.file("tabs-burst.test.ts", ls.tabsBurstTestCode ?? "");

      // Validators
      const v = kit.manifestAndCwsValidators ?? {};
      const val = zip.folder("validators") ?? zip;
      val.file("manifest-validator.ts", v.manifestValidatorCode ?? "");
      val.file("cws-policy-checker.ts", v.cwsPolicyCheckerCode ?? "");
      val.file("permission-minimizer.ts", v.permissionMinimizerCode ?? "");
      val.file("privacy-leak-scanner.ts", v.privacyLeakScannerCode ?? "");

      // Mocks
      const m = kit.mockFactories ?? {};
      const mocks = zip.folder("mocks") ?? zip;
      mocks.file("chrome.storage.ts", m.chromeStorageMockCode ?? "");
      mocks.file("chrome.tabs.ts", m.chromeTabsMockCode ?? "");
      mocks.file("chrome.runtime.ts", m.chromeRuntimeMockCode ?? "");
      mocks.file("chrome.action.ts", m.chromeActionMockCode ?? "");
      mocks.file("fetch.ts", m.fetchMockCode ?? "");

      // Smoke
      const smoke = zip.folder("smoke") ?? zip;
      (kit.smokeSuite ?? []).forEach((s: any) => {
        const slug = String(s.name ?? "smoke").toLowerCase().replace(/[^a-z0-9]+/g, "-");
        smoke.file(`${slug}.spec.ts`, `// ${s.name} — ${s.surface}\n// ${s.description}\n\n${s.code ?? ""}`);
      });

      // Regression
      const reg = zip.folder("regression") ?? zip;
      (kit.regressionSuite ?? []).forEach((r: any) => {
        const slug = String(r.name ?? "regression").toLowerCase().replace(/[^a-z0-9]+/g, "-");
        reg.file(`${slug}.spec.ts`, `// ${r.name}\n// ${r.description}\n\n${r.code ?? ""}`);
      });

      // Flaky policy
      const flaky = kit.flakyTestPolicy ?? {};
      zip.file("flaky-tests.md",
`${flaky.markdown ?? ""}

## Retry strategy
${flaky.retryStrategy ?? ""}

## Quarantine workflow
${flaky.quarantineWorkflow ?? ""}`);

      // Reports
      const rep = kit.reportGeneration ?? {};
      const reports = zip.folder("reports") ?? zip;
      reports.file("html-reporter.ts", rep.htmlReporterCode ?? "");
      reports.file("junit-notes.md", rep.junitReporterNotes ?? "");
      reports.file("dashboard.html", rep.dashboardHtml ?? "");
      reports.file("slack-digest.ts", rep.slackDigestCode ?? "");

      // CI
      const ci = kit.ciIntegration ?? {};
      const ciF = zip.folder("ci") ?? zip;
      ciF.file("qa.yml", ci.githubWorkflowYaml ?? "");
      ciF.file("required-secrets.md", (ci.requiredSecrets ?? []).map((s: any) => `- \`${s.name}\` — ${s.purpose}`).join("\n"));
      ciF.file("pr-comment-bot.ts", ci.prCommentBotCode ?? "");
      ciF.file("artifact-retention.md", ci.artifactRetentionNotes ?? "");

      // package.json scripts
      zip.file("package.json.scripts.json",
`# Merge these into your package.json "scripts" block
${JSON.stringify(kit.packageJsonScripts ?? {}, null, 2)}`);

      // Checklist
      zip.file("checklist.md",
`# QA Setup Checklist
${(kit.checklist ?? []).map((c: any) => `- [${c.status === "ready" ? "x" : " "}] (${c.priority}) ${c.item}`).join("\n")}`);

      zip.file("raw-qa-harness.json", JSON.stringify(kit, null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      const safe = (selected.name ?? "extension").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      el.href = url; el.download = `${safe}-qa-harness.zip`; el.click();
      URL.revokeObjectURL(url);

      setAnalyses((prev) => ({ ...prev, [`qaHarness:${selected.id}`]: kit }));
      toast.success("QA & test harness ready");
    } catch (e: any) {
      toast.error(e.message ?? "QA harness generation failed");
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

                <Card className="border-cyan-400/40 bg-cyan-400/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4 text-cyan-400" />Marketing Site & SEO Pack</CardTitle>
                        <CardDescription className="text-[10px]">Full static marketing site (home, features, pricing, about, contact, blog, changelog, install, 404), 10 SEO-seeded blog posts, 3+ head-to-head comparison pages, sitemap.xml, robots.txt, JSON-LD (Organization/App/FAQ/Breadcrumb), backlink outreach emails, directory submission list, keyword clusters, internal link plan, OG spec, favicon brief.</CardDescription>
                      </div>
                      <Button size="sm" onClick={generateMarketingSite} disabled={analyzing === "marketingSite" || !selected}>
                        {analyzing === "marketingSite" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
                        Generate Site
                      </Button>
                    </div>
                  </CardHeader>
                  {a("marketingSite") && (
                    <CardContent className="text-xs space-y-2">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[9px]">{Object.keys(a("marketingSite").pages ?? {}).length} pages</Badge>
                        <Badge variant="outline" className="text-[9px]">{(a("marketingSite").blogPosts ?? []).length} blog posts</Badge>
                        <Badge variant="outline" className="text-[9px]">{(a("marketingSite").comparisonPages ?? []).length} vs pages</Badge>
                        <Badge variant="outline" className="text-[9px]">{(a("marketingSite").backlinkOutreach ?? []).length} outreach emails</Badge>
                        <Badge variant="outline" className="text-[9px]">{(a("marketingSite").directoriesToSubmit ?? []).length} directories</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Primary keyword: <span className="font-mono">{a("marketingSite").siteMeta?.primaryKeyword}</span>
                      </div>
                    </CardContent>
                  )}
                </Card>

                <Card className="border-pink-400/40 bg-pink-400/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-pink-400" />Analytics & Instrumentation Kit</CardTitle>
                        <CardDescription className="text-[10px]">Privacy-safe telemetry: event schema, anon-id + session logic, consent banner, MV3 tracker code (background/popup/content/onboarding/uninstall), GA4/PostHog/Plausible/Mixpanel/self-hosted adapters (with Edge Function + SQL), funnels, cohorts, dashboards, SQL KPI library, A/B test framework, alerting, data dictionary, CWS privacy answers.</CardDescription>
                      </div>
                      <Button size="sm" onClick={generateAnalyticsKit} disabled={analyzing === "analytics" || !selected}>
                        {analyzing === "analytics" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
                        Generate Kit
                      </Button>
                    </div>
                  </CardHeader>
                  {a("analytics") && (
                    <CardContent className="text-xs space-y-2">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[9px]">{(a("analytics").eventSchema ?? []).length} events</Badge>
                        <Badge variant="outline" className="text-[9px]">{(a("analytics").funnels ?? []).length} funnels</Badge>
                        <Badge variant="outline" className="text-[9px]">{(a("analytics").cohorts ?? []).length} cohorts</Badge>
                        <Badge variant="outline" className="text-[9px]">{(a("analytics").sqlKpis ?? []).length} SQL KPIs</Badge>
                        <Badge variant="outline" className="text-[9px]">{(a("analytics").abTestFramework?.exampleExperiments ?? []).length} A/B examples</Badge>
                        <Badge variant="outline" className="text-[9px]">5 adapters</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Consent-gated · anon-id: {a("analytics").identity?.anonIdStrategy?.slice(0, 60)}
                      </div>
                    </CardContent>
                  )}
                </Card>

                <Card className="border-orange-400/40 bg-orange-400/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2"><GitBranch className="h-4 w-4 text-orange-400" />CI/CD & Auto-Publish Pipeline</CardTitle>
                        <CardDescription className="text-[10px]">GitHub Actions: CI, release, publish, nightly, PR preview, dependency review. Real scripts for build/package/upload/publish to Chrome Web Store API, version bump, changelog + release notes, screenshot regen, preflight, manifest validator, size budget. Dependabot, ESLint, Prettier, changesets, release-please, commitlint, husky. Docs, PR/issue templates, CODEOWNERS, rollback, matrix testing, monitoring.</CardDescription>
                      </div>
                      <Button size="sm" onClick={generateCicdPipeline} disabled={analyzing === "cicd" || !selected}>
                        {analyzing === "cicd" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
                        Generate Pipeline
                      </Button>
                    </div>
                  </CardHeader>
                  {a("cicd") && (
                    <CardContent className="text-xs space-y-2">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[9px]">{Object.keys(a("cicd").workflows ?? {}).length} workflows</Badge>
                        <Badge variant="outline" className="text-[9px]">{Object.keys(a("cicd").scripts ?? {}).length} scripts</Badge>
                        <Badge variant="outline" className="text-[9px]">{(a("cicd").smokeTests ?? []).length} smoke tests</Badge>
                        <Badge variant="outline" className="text-[9px]">{a("cicd").versioningStrategy?.scheme}</Badge>
                        <Badge variant="outline" className="text-[9px]">{(a("cicd").prerequisites?.githubSecrets ?? []).length} GH secrets</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Branch strategy: {a("cicd").overview?.branchStrategy?.slice(0, 80)}
                      </div>
                    </CardContent>
                  )}
                </Card>


                <Card className="border-emerald-400/40 bg-emerald-400/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2"><LifeBuoy className="h-4 w-4 text-emerald-400" />Support & Help Center Kit</CardTitle>
                        <CardDescription className="text-[10px]">Complete help center (index + long-form articles + search index + sitemap), FAQ page with JSON-LD, in-app help widget (HTML/CSS/JS + contextual tooltips + onboarding), canned responses, ticket templates, SLA policy, escalation playbooks, contact + status pages, chatbot KB with intents, CWS review reply templates, and support KPIs.</CardDescription>
                      </div>
                      <Button size="sm" onClick={generateSupportHub} disabled={analyzing === "supportHub" || !selected}>
                        {analyzing === "supportHub" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
                        Generate Support Kit
                      </Button>
                    </div>
                  </CardHeader>
                  {a("supportHub") && (
                    <CardContent className="text-xs space-y-2">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[9px]">{(a("supportHub").helpCenter?.articles ?? []).length} articles</Badge>
                        <Badge variant="outline" className="text-[9px]">{(a("supportHub").faq?.items ?? []).length} FAQs</Badge>
                        <Badge variant="outline" className="text-[9px]">{(a("supportHub").cannedResponses ?? []).length} macros</Badge>
                        <Badge variant="outline" className="text-[9px]">{(a("supportHub").escalationPlaybooks ?? []).length} playbooks</Badge>
                        <Badge variant="outline" className="text-[9px]">{(a("supportHub").chatbotKnowledgeBase?.intents ?? []).length} intents</Badge>
                        <Badge variant="outline" className="text-[9px]">{(a("supportHub").reviewResponseTemplates ?? []).length} review replies</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Response SLA: {a("supportHub").overview?.targetResponseTime} · Resolution: {a("supportHub").overview?.targetResolutionTime}
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
