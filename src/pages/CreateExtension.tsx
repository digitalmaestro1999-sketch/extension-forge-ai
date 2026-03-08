import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Loader2, CheckCircle2, XCircle, ArrowRight,
  Brain, Code2, Shield, FileCheck, Package, ChevronDown,
  ChevronRight, Sparkles, AlertTriangle
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

  const updateStage = useCallback((id: string, update: Partial<AgentStage>) => {
    setStages(prev => prev.map(s => s.id === id ? { ...s, ...update } : s));
  }, []);

  const runPipeline = async () => {
    if (!idea.trim()) {
      toast.error("Please describe your extension idea");
      return;
    }

    setIsRunning(true);
    setStages(initialStages);
    setSpec(null);
    setGeneratedFiles(null);
    setProgress(0);

    try {
      // STAGE 1: Intent Analysis (uses existing generate-extension function)
      updateStage("intent", { status: "running" });
      const startIntent = Date.now();

      const { data: specData, error: specError } = await supabase.functions.invoke("generate-extension", {
        body: { idea: idea.trim(), audience: "", functionality: "" },
      });

      if (specError) throw new Error("Intent analysis failed: " + specError.message);
      const extSpec = specData.spec as ExtensionSpec;
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

      const { data: codeData, error: codeError } = await supabase.functions.invoke("agent-pipeline", {
        body: { spec: extSpec, stage: "code" },
      });

      if (codeError) throw new Error("Code generation failed: " + codeError.message);

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

      const { data: secData, error: secError } = await supabase.functions.invoke("agent-pipeline", {
        body: { spec: extSpec, stage: "security" },
      });

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

      const { data: compData, error: compError } = await supabase.functions.invoke("agent-pipeline", {
        body: { spec: extSpec, stage: "compliance" },
      });

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

      toast.success(`${extSpec.name} generated successfully!`);
    } catch (e: any) {
      console.error("Pipeline error:", e);
      toast.error(e.message || "Pipeline failed");
      // Mark remaining stages as idle
      setStages(prev => prev.map(s => s.status === "running" ? { ...s, status: "error", error: e.message } : s));
    } finally {
      setIsRunning(false);
    }
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
