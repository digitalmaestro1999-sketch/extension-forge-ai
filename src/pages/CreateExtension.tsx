import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Loader2, CheckCircle2, XCircle, ArrowRight,
  Brain, Code2, Shield, FileCheck, Package, ChevronDown,
  ChevronRight, Sparkles, AlertTriangle, Eye, Copy, Pencil,
  RotateCcw, ListChecks, Layers, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import type { ExtensionSpec } from "@/lib/generate-extension";
import {
  PROMPT_PRESETS, QUALITY_BOOSTERS, DESIGN_STYLES, AUDIENCE_TONES, PROMPT_VARIATIONS,
  composePrompt, scorePrompt, getPresetTemplate, setPresetOverride, resetPresetOverride,
} from "@/lib/prompt-presets";

async function invokeWithRetry(
  fnName: string,
  body: any,
  maxRetries = 3,
  baseDelay = 5000
): Promise<any> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { data, error } = await supabase.functions.invoke(fnName, { body });

    const isRateLimit =
      error?.message?.includes("429") ||
      error?.message?.toLowerCase?.().includes("rate limit") ||
      data?.error?.toLowerCase?.().includes("rate limit");

    if (isRateLimit && attempt < maxRetries) {
      const delay = baseDelay * Math.pow(2, attempt);
      toast.info(`Rate limited — retrying in ${Math.round(delay / 1000)}s...`, { duration: delay });
      await new Promise(r => setTimeout(r, delay));
      continue;
    }

    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }
  throw new Error("Rate limit exceeded after retries. Please wait a moment and try again.");
}

type StageStatus = "idle" | "running" | "done" | "error";

interface AgentStage {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  status: StageStatus;
  result?: any;
  error?: string;
  duration?: number;
}

const initialStages: AgentStage[] = [
  { id: "intent", label: "Intent Analysis", description: "Analyzing idea, extracting requirements", icon: Brain, status: "idle" },
  { id: "architecture", label: "Architecture Design", description: "Designing extension structure & permissions", icon: Sparkles, status: "idle" },
  { id: "codegen", label: "Code Generation", description: "Generating production-ready extension code", icon: Code2, status: "idle" },
  { id: "security", label: "Security Audit", description: "Auditing permissions, CSP, data handling", icon: Shield, status: "idle" },
  { id: "compliance", label: "Store Compliance", description: "Validating Chrome Web Store policies", icon: FileCheck, status: "idle" },
  { id: "package", label: "Package Ready", description: "Preparing downloadable extension package", icon: Package, status: "idle" },
];

export default function CreateExtension() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [idea, setIdea] = useState(() => {
    const pending = sessionStorage.getItem("pending-idea");
    if (pending) { sessionStorage.removeItem("pending-idea"); return pending; }
    return "";
  });
  const [stages, setStages] = useState<AgentStage[]>(initialStages);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [spec, setSpec] = useState<ExtensionSpec | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<Record<string, string> | null>(null);
  const [progress, setProgress] = useState(0);

  // Prompt Studio state
  const [presetId, setPresetId] = useState<string | null>(null);
  const [styleId, setStyleId] = useState<string | null>("cyber-dark");
  const [toneId, setToneId] = useState<string | null>("prosumer");
  const [boosterIds, setBoosterIds] = useState<string[]>(
    QUALITY_BOOSTERS.filter((b) => b.default).map((b) => b.id),
  );
  const [showStudio, setShowStudio] = useState(true);

  // NEW: preview / customizer / variations / checklist state
  const [showPreview, setShowPreview] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [customizingPreset, setCustomizingPreset] = useState<string | null>(null);
  const [presetDraft, setPresetDraft] = useState("");
  const [selectedVariants, setSelectedVariants] = useState<string[]>([]); // empty = single default run
  const [variantResults, setVariantResults] = useState<
    Array<{ variantId: string | null; label: string; specName: string; ok: boolean; error?: string }>
  >([]);

  const toggleBooster = (id: string) =>
    setBoosterIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleVariant = (id: string) =>
    setSelectedVariants((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const applyPreset = (id: string) => {
    setPresetId(id);
    const p = PROMPT_PRESETS.find((x) => x.id === id);
    if (p && !idea.trim()) setIdea(p.short);
  };

  const openCustomizer = (id: string) => {
    setCustomizingPreset(id);
    setPresetDraft(getPresetTemplate(id));
  };
  const saveCustomizer = () => {
    if (!customizingPreset) return;
    setPresetOverride(customizingPreset, presetDraft);
    toast.success("Preset updated");
    setCustomizingPreset(null);
  };
  const resetCustomizer = () => {
    if (!customizingPreset) return;
    resetPresetOverride(customizingPreset);
    setPresetDraft(PROMPT_PRESETS.find((p) => p.id === customizingPreset)?.template || "");
    toast.info("Preset reset to default");
  };

  // Live composed prompt (for Preview + Checklist)
  const livePreview = useMemo(
    () => composePrompt({ idea, presetId, styleId, toneId, boosterIds }),
    [idea, presetId, styleId, toneId, boosterIds],
  );
  const qualityReport = useMemo(() => scorePrompt(livePreview, idea), [livePreview, idea]);

  const updateStage = useCallback((id: string, update: Partial<AgentStage>) => {
    setStages(prev => prev.map(s => s.id === id ? { ...s, ...update } : s));
  }, []);

  const runOnce = async (variantId: string | null) => {
    // Compose the enriched prompt from Prompt Studio choices (+ variant)
    const composed = composePrompt({ idea, presetId, styleId, toneId, boosterIds, variantId });
    const variantLabel = PROMPT_VARIATIONS.find(v => v.id === variantId)?.label;

      // STAGE 1: Intent Analysis (uses existing generate-extension function)
      updateStage("intent", { status: "running" });
      const startIntent = Date.now();

      const specData = await invokeWithRetry("generate-extension", { idea: composed.idea, audience: toneId ?? "", functionality: "" });
      const extSpec = { ...(specData.spec as ExtensionSpec), profile: composed.profile } as ExtensionSpec & { profile: typeof composed.profile };
      setSpec(extSpec);

      updateStage("intent", {
        status: "done",
        duration: Date.now() - startIntent,
        result: { name: extSpec.name, features: extSpec.features.length, permissions: extSpec.permissions.length },
      });
      setProgress(16);

      // STAGE 2: Architecture Design (derived from spec)
      updateStage("architecture", { status: "running" });
      const startArch = Date.now();
      await new Promise(r => setTimeout(r, 800)); // Brief pause for UX

      const fileStructure = [
        "manifest.json", "background.js", "content.js",
        "popup.html", "popup.js", "popup.css",
        "options.html", "options.js", "styles.css",
        "utils/api.js", "utils/storage.js"
      ];

      updateStage("architecture", {
        status: "done",
        duration: Date.now() - startArch,
        result: { files: fileStructure.length, structure: fileStructure },
      });
      setProgress(33);

      // STAGE 3: AI Code Generation
      updateStage("codegen", { status: "running" });
      const startCode = Date.now();

      const codeData = await invokeWithRetry("agent-pipeline", { spec: extSpec, stage: "code" });

      const aiFiles = codeData.result as Record<string, string>;
      
      // Merge AI-generated files with local high-quality templates as fallbacks
      const { generateAllFiles } = await import("@/lib/generate-extension");
      const localFiles = generateAllFiles(extSpec);
      
      // AI files take priority, but fall back to local templates for missing files
      const files: Record<string, string> = { ...localFiles };
      for (const [name, content] of Object.entries(aiFiles)) {
        // Only use AI file if it has substantial content (not just comments/empty)
        if (content && content.trim().length > 50) {
          files[name] = content;
        }
      }
      
      // Always use local manifest to ensure correct icon paths and structure
      files["manifest.json"] = localFiles["manifest.json"];
      
      // Ensure no Tailwind CDN references snuck through from AI
      for (const [name, content] of Object.entries(files)) {
        if (content.includes("cdn.tailwindcss.com") || content.includes("cdn.tailwind")) {
          files[name] = content
            .replace(/<script[^>]*cdn\.tailwindcss\.com[^>]*><\/script>/g, '')
            .replace(/<script[^>]*cdn\.tailwind[^>]*><\/script>/g, '');
        }
      }
      
      setGeneratedFiles(files);

      updateStage("codegen", {
        status: "done",
        duration: Date.now() - startCode,
        result: { filesGenerated: Object.keys(files).length, totalLines: Object.values(files).reduce((acc, f) => acc + f.split("\n").length, 0) },
      });
      setProgress(55);

      // STAGE 4: Security Audit
      updateStage("security", { status: "running" });
      const startSec = Date.now();

      let secData: any = null;
      let secError: any = null;
      try {
        secData = await invokeWithRetry("agent-pipeline", { spec: extSpec, stage: "security" });
      } catch (e: any) {
        secError = e;
      }

      if (secError) {
        updateStage("security", { status: "error", error: "Security audit skipped", duration: Date.now() - startSec });
      } else {
        updateStage("security", {
          status: "done",
          duration: Date.now() - startSec,
          result: secData.result,
        });
      }
      setProgress(72);

      // STAGE 5: Compliance Check
      updateStage("compliance", { status: "running" });
      const startComp = Date.now();

      let compData: any = null;
      let compError: any = null;
      try {
        compData = await invokeWithRetry("agent-pipeline", { spec: extSpec, stage: "compliance" });
      } catch (e: any) {
        compError = e;
      }

      if (compError) {
        updateStage("compliance", { status: "error", error: "Compliance check skipped", duration: Date.now() - startComp });
      } else {
        updateStage("compliance", {
          status: "done",
          duration: Date.now() - startComp,
          result: compData.result,
        });
      }
      setProgress(88);

      // STAGE 6: Package Ready
      updateStage("package", { status: "running" });
      await new Promise(r => setTimeout(r, 500));
      updateStage("package", { status: "done", duration: 500, result: { ready: true } });
      setProgress(100);

      // Store everything for the editor
      sessionStorage.setItem("extension-spec", JSON.stringify(extSpec));
      sessionStorage.setItem("extension-files", JSON.stringify(files));

      // Save to DB if logged in
      if (user) {
        await supabase.from("extension_projects").insert({
          user_id: user.id,
          name: extSpec.name,
          description: extSpec.description,
          spec: extSpec as any,
          files: files as any,
          security_audit: secData?.result || null,
          compliance_report: compData?.result || null,
          status: "generated",
        });
      }
      if (secData?.result) sessionStorage.setItem("security-audit", JSON.stringify(secData.result));
      if (compData?.result) sessionStorage.setItem("compliance-report", JSON.stringify(compData.result));

      toast.success(`${extSpec.name}${variantLabel ? ` (${variantLabel})` : ""} generated!`);
      return { ok: true as const, specName: extSpec.name };
  };

  const runPipeline = async () => {
    if (!idea.trim()) {
      toast.error("Please describe your extension idea");
      return;
    }
    setIsRunning(true);
    setVariantResults([]);

    const runs: (string | null)[] = selectedVariants.length ? selectedVariants : [null];

    for (let i = 0; i < runs.length; i++) {
      const variantId = runs[i];
      const label = variantId
        ? PROMPT_VARIATIONS.find(v => v.id === variantId)?.label || variantId
        : "Default";
      if (runs.length > 1) toast.info(`Variation ${i + 1}/${runs.length}: ${label}`);
      // reset for each run
      setStages(initialStages);
      setSpec(null);
      setGeneratedFiles(null);
      setProgress(0);
      try {
        const res = await runOnce(variantId);
        setVariantResults(prev => [...prev, { variantId, label, specName: res.specName, ok: true }]);
      } catch (e: any) {
        console.error("Pipeline error:", e);
        toast.error(`${label}: ${e.message || "Pipeline failed"}`);
        setStages(prev => prev.map(s => s.status === "running" ? { ...s, status: "error", error: e.message } : s));
        setVariantResults(prev => [...prev, { variantId, label, specName: "—", ok: false, error: e.message }]);
      }
    }
    setIsRunning(false);
  };

  const goToEditor = () => navigate("/editor");
  const goToTest = () => navigate("/test");
  const goToPublish = () => navigate("/publish");

  const completedStages = stages.filter(s => s.status === "done").length;
  const statusIcon = (status: StageStatus) => {
    switch (status) {
      case "running": return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case "done": return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case "error": return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default: return <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-lg bg-gradient-cyber flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Autonomous Extension Agent</h1>
            <p className="text-sm text-muted-foreground">One prompt → Full extension. AI handles everything.</p>
          </div>
        </div>
      </motion.div>

      {/* Input */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-border bg-card p-5"
      >
        <Textarea
          placeholder="Describe your Chrome extension idea... e.g., 'Build an extension that summarizes YouTube videos using AI and saves notes'"
          value={idea}
          onChange={e => setIdea(e.target.value)}
          className="bg-secondary border-border min-h-[80px] mb-4 text-sm"
          disabled={isRunning}
        />

        {/* Prompt Studio */}
        <div className="mb-4 rounded-lg border border-border/60 bg-secondary/40">
          <button
            type="button"
            onClick={() => setShowStudio(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-left"
          >
            <span className="flex items-center gap-2 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Prompt Studio
              <Badge variant="secondary" className="text-[10px]">
                {(presetId ? 1 : 0) + boosterIds.length + (styleId ? 1 : 0) + (toneId ? 1 : 0)} active
              </Badge>
            </span>
            {showStudio ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </button>

          {showStudio && (
            <div className="px-3 pb-3 space-y-4 border-t border-border/60 pt-3">
              {/* Presets */}
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Category preset (optional)</p>
                <div className="flex flex-wrap gap-1.5">
                  {PROMPT_PRESETS.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isRunning}
                      onClick={() => (presetId === p.id ? setPresetId(null) : applyPreset(p.id))}
                      className={`text-[11px] px-2.5 py-1.5 rounded-md border transition-all ${
                        presetId === p.id
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-card hover:border-primary/40 text-muted-foreground"
                      }`}
                      title={p.short}
                    >
                      <span className="mr-1">{p.emoji}</span>{p.label}
                    </button>
                  ))}
                </div>
                {presetId && (
                  <div className="mt-2 flex items-start justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground flex-1">
                      {PROMPT_PRESETS.find(p => p.id === presetId)?.short}
                    </p>
                    <button
                      type="button"
                      onClick={() => openCustomizer(presetId)}
                      className="text-[10px] flex items-center gap-1 text-primary hover:underline shrink-0"
                    >
                      <Pencil className="h-3 w-3" /> Customize brief
                    </button>
                  </div>
                )}
              </div>

              {/* Design style + audience */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Design style</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DESIGN_STYLES.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        disabled={isRunning}
                        onClick={() => setStyleId(styleId === s.id ? null : s.id)}
                        className={`text-[11px] px-2 py-1 rounded-md border ${
                          styleId === s.id ? "border-primary bg-primary/10" : "border-border bg-card text-muted-foreground hover:border-primary/40"
                        }`}
                        title={s.description}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Audience tone</p>
                  <div className="flex flex-wrap gap-1.5">
                    {AUDIENCE_TONES.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        disabled={isRunning}
                        onClick={() => setToneId(toneId === t.id ? null : t.id)}
                        className={`text-[11px] px-2 py-1 rounded-md border ${
                          toneId === t.id ? "border-primary bg-primary/10" : "border-border bg-card text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quality boosters */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Quality boosters</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => setBoosterIds(QUALITY_BOOSTERS.map(b => b.id))}
                    >Select all</button>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => setBoosterIds([])}
                    >Clear</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {QUALITY_BOOSTERS.map(b => {
                    const active = boosterIds.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        disabled={isRunning}
                        onClick={() => toggleBooster(b.id)}
                        className={`text-left px-2.5 py-1.5 rounded-md border transition-all ${
                          active ? "border-primary/60 bg-primary/5" : "border-border bg-card hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <div className={`h-3 w-3 rounded-sm border flex items-center justify-center ${active ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                            {active && <CheckCircle2 className="h-2.5 w-2.5 text-primary-foreground" />}
                          </div>
                          <span className="text-[11px] font-medium">{b.label}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 pl-4">{b.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

                </div>
              </div>

              {/* Multiple Variations */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Layers className="h-3 w-3" /> Multiple variations
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {selectedVariants.length === 0 ? "Single default run" : `${selectedVariants.length} variation runs`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PROMPT_VARIATIONS.map(v => {
                    const active = selectedVariants.includes(v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={isRunning}
                        onClick={() => toggleVariant(v.id)}
                        className={`text-[11px] px-2 py-1 rounded-md border ${
                          active ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40"
                        }`}
                        title={v.description}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Runs the pipeline once per selected variation, back-to-back. Leave empty for a single default run.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Preview + Checklist toggles */}
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowPreview(v => !v)}
            className="text-[11px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-card hover:border-primary/40"
          >
            <Eye className="h-3 w-3" /> {showPreview ? "Hide" : "Preview"} composed prompt
            <Badge variant="secondary" className="text-[10px] font-mono">
              {livePreview.idea.trim().split(/\s+/).filter(Boolean).length}w
            </Badge>
          </button>
          <button
            type="button"
            onClick={() => setShowChecklist(v => !v)}
            className="text-[11px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-card hover:border-primary/40"
          >
            <ListChecks className="h-3 w-3" /> Quality checklist
            <Badge
              variant="secondary"
              className={`text-[10px] font-mono ${
                qualityReport.score >= 75 ? "text-primary" : qualityReport.score >= 50 ? "" : "text-destructive"
              }`}
            >
              {qualityReport.score}/100 · {qualityReport.grade}
            </Badge>
          </button>
        </div>

        {showPreview && (
          <div className="mb-3 rounded-lg border border-border/60 bg-secondary/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Composed prompt preview</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(livePreview.idea);
                  toast.success("Copied composed prompt");
                }}
                className="text-[10px] flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-[11px] text-muted-foreground max-h-64 overflow-auto">
              {livePreview.idea}
            </pre>
          </div>
        )}

        {showChecklist && (
          <div className="mb-3 rounded-lg border border-border/60 bg-secondary/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Prompt quality checklist</span>
              <span className="text-[11px] font-mono">
                Grade <span className={qualityReport.grade === "A" || qualityReport.grade === "B" ? "text-primary" : "text-destructive"}>{qualityReport.grade}</span> · {qualityReport.score}/100
              </span>
            </div>
            <Progress value={qualityReport.score} className="h-1.5 mb-3" />
            <ul className="space-y-1">
              {qualityReport.items.map(item => (
                <li key={item.id} className="flex items-start gap-2 text-[11px]">
                  {item.passed ? (
                    <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <span className={item.passed ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                    {!item.passed && item.hint && (
                      <p className="text-[10px] text-muted-foreground/80 italic">{item.hint}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">+{item.weight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            The AI agent will analyze → design → code → audit → package your extension
          </p>
          <Button
            onClick={runPipeline}
            disabled={isRunning || !idea.trim()}
            className="bg-gradient-cyber text-primary-foreground"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Agent Running...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Launch Agent
              </>
            )}
          </Button>
        </div>
      </motion.div>

      {/* Progress */}
      {(isRunning || completedStages > 0) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Pipeline Progress</span>
            <span className="text-xs text-muted-foreground font-mono">{completedStages}/{stages.length} stages</span>
          </div>
          <Progress value={progress} className="h-2" />
        </motion.div>
      )}

      {/* Agent Stages */}
      <div className="space-y-2">
        {stages.map((stage, i) => (
          <motion.div
            key={stage.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`rounded-xl border transition-all ${
              stage.status === "running"
                ? "border-primary/50 bg-primary/5 glow-primary"
                : stage.status === "done"
                ? "border-primary/20 bg-card"
                : stage.status === "error"
                ? "border-destructive/30 bg-destructive/5"
                : "border-border bg-card/50"
            }`}
          >
            <button
              className="w-full flex items-center gap-3 p-4 text-left"
              onClick={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
            >
              {statusIcon(stage.status)}
              <stage.icon className={`h-4 w-4 shrink-0 ${stage.status === "done" ? "text-primary" : "text-muted-foreground"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${stage.status === "idle" ? "text-muted-foreground" : ""}`}>
                    {stage.label}
                  </span>
                  {stage.duration && (
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {(stage.duration / 1000).toFixed(1)}s
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{stage.description}</p>
              </div>
              {stage.result && (
                expandedStage === stage.id
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </button>

            <AnimatePresence>
              {expandedStage === stage.id && stage.result && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 pt-0">
                    <div className="rounded-lg bg-secondary/50 p-3 font-mono text-xs overflow-auto max-h-60">
                      <pre className="whitespace-pre-wrap text-muted-foreground">
                        {JSON.stringify(stage.result, null, 2)}
                      </pre>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {stage.error && (
              <div className="px-4 pb-3">
                <p className="text-xs text-destructive">{stage.error}</p>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Actions when done */}
      {completedStages >= 5 && !isRunning && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-primary/30 bg-card p-5 glow-primary"
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-lg">{spec?.name || "Extension"} — Ready!</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{spec?.description}</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {spec?.permissions.map(p => (
              <Badge key={p} variant="secondary" className="font-mono text-[10px]">{p}</Badge>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={goToEditor} className="bg-gradient-cyber text-primary-foreground">
              <Code2 className="h-4 w-4 mr-2" /> Open in Editor
            </Button>
            <Button onClick={goToTest} variant="outline">
              <Shield className="h-4 w-4 mr-2" /> Test & Validate
            </Button>
            <Button onClick={goToPublish} variant="outline">
              <Package className="h-4 w-4 mr-2" /> Publish Assets
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
