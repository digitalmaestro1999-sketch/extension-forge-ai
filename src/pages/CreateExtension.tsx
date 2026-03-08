import { useState } from "react";
import { motion } from "framer-motion";
import { Wand2, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ExtensionSpec } from "@/lib/generate-extension";

const permissionOptions = [
  "activeTab", "tabs", "storage", "alarms", "bookmarks",
  "clipboardRead", "clipboardWrite", "downloads", "history",
  "notifications", "scripting", "webRequest",
];

export default function CreateExtension() {
  const navigate = useNavigate();
  const [idea, setIdea] = useState("");
  const [audience, setAudience] = useState("");
  const [functionality, setFunctionality] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ExtensionSpec | null>(null);

  const handleGenerate = async () => {
    if (!idea.trim()) {
      toast.error("Please describe your extension idea");
      return;
    }
    setIsGenerating(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-extension", {
        body: {
          idea: idea.trim(),
          audience: audience.trim(),
          functionality: functionality.trim(),
        },
      });

      if (error) throw error;
      if (!data?.spec) throw new Error("Invalid response");

      setResult(data.spec as ExtensionSpec);
      toast.success("Extension spec generated!");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to generate extension");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBuild = () => {
    if (result) {
      // Store in sessionStorage for the editor
      sessionStorage.setItem("extension-spec", JSON.stringify(result));
      navigate("/editor");
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wand2 className="h-6 w-6 text-primary" />
          Create Extension
        </h1>
        <p className="text-muted-foreground mt-1">Describe your idea and AI generates the full spec</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-border bg-card p-6 space-y-5"
      >
        <div className="space-y-2">
          <Label>Extension Idea *</Label>
          <Textarea
            placeholder="e.g., A Chrome extension that summarizes YouTube videos using AI..."
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            className="bg-secondary border-border min-h-[100px]"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Target Audience</Label>
            <Input
              placeholder="e.g., Students, developers, marketers"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>
          <div className="space-y-2">
            <Label>Core Functionality</Label>
            <Input
              placeholder="e.g., Video summarization, tab management"
              value={functionality}
              onChange={(e) => setFunctionality(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>
        </div>
        <Button onClick={handleGenerate} disabled={isGenerating} className="w-full bg-gradient-cyber hover:opacity-90 text-primary-foreground">
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4 mr-2" />
              Generate Extension Spec
            </>
          )}
        </Button>
      </motion.div>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-primary/30 bg-card p-6 space-y-4 glow-primary"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              {result.name}
            </h2>
            <Button onClick={handleBuild} className="bg-gradient-cyber text-primary-foreground">
              Build Extension <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
          <p className="text-muted-foreground">{result.description}</p>

          <div>
            <h3 className="text-sm font-semibold mb-2">Features</h3>
            <ul className="space-y-1">
              {result.features.map((f, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {f}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">Permissions</h3>
            <div className="flex flex-wrap gap-2">
              {result.permissions.map((p) => (
                <Badge key={p} variant="secondary" className="font-mono text-xs">{p}</Badge>
              ))}
            </div>
          </div>

          {result.apis && result.apis.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">APIs</h3>
              <div className="flex flex-wrap gap-2">
                {result.apis.map((a) => (
                  <Badge key={a} variant="outline" className="text-xs">{a}</Badge>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
