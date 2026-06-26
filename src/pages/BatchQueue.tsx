import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Layers, Plus, Trash2, Loader2, Play, CheckCircle2,
  XCircle, Clock, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface QueueItem {
  id: string;
  idea: string;
  status: "queued" | "processing" | "completed" | "failed";
  error_message?: string;
  project_id?: string;
  created_at: string;
}

export default function BatchQueue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);

  const loadQueue = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("batch_queue")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setQueue(data as QueueItem[]);
  }, [user]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const addToQueue = async () => {
    if (!user) {
      toast.error("Please sign in to use batch queue");
      return;
    }
    const lines = ideas.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      toast.error("Enter at least one extension idea");
      return;
    }

    const inserts = lines.map(idea => ({
      user_id: user.id,
      idea,
      status: "queued" as const,
    }));

    const { error } = await supabase.from("batch_queue").insert(inserts);
    if (error) {
      toast.error("Failed to add items");
      return;
    }

    setIdeas("");
    toast.success(`${lines.length} items added to queue`);
    loadQueue();
  };

  const processQueue = async () => {
    const queued = queue.filter(q => q.status === "queued");
    if (queued.length === 0) {
      toast.error("No items in queue to process");
      return;
    }

    setIsProcessing(true);

    for (let i = 0; i < queued.length; i++) {
      const item = queued[i];
      setCurrentIdx(i);

      // Update status to processing
      await supabase.from("batch_queue").update({ status: "processing" }).eq("id", item.id);
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "processing" as const } : q));

      try {
        // Generate spec
        const { data: specData, error: specError } = await supabase.functions.invoke("generate-extension", {
          body: { idea: item.idea, audience: "", functionality: "" },
        });
        if (specError) throw specError;

        // Generate code
        const { data: codeData, error: codeError } = await supabase.functions.invoke("agent-pipeline", {
          body: { spec: specData.spec, stage: "code" },
        });
        if (codeError) throw codeError;

        // Save project
        const { data: project, error: projError } = await supabase.from("extension_projects").insert({
          user_id: user!.id,
          name: specData.spec.name,
          description: specData.spec.description,
          spec: specData.spec,
          files: codeData.result,
          status: "generated",
        }).select().single();

        if (projError) throw projError;

        await supabase.from("batch_queue").update({
          status: "completed",
          project_id: project.id,
          completed_at: new Date().toISOString(),
        }).eq("id", item.id);

        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "completed" as const, project_id: project.id } : q));
      } catch (e: any) {
        await supabase.from("batch_queue").update({
          status: "failed",
          error_message: e.message || "Generation failed",
        }).eq("id", item.id);

        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "failed" as const, error_message: e.message } : q));
      }
    }

    setIsProcessing(false);
    setCurrentIdx(-1);
    toast.success("Batch processing complete!");
    loadQueue();
  };

  const clearCompleted = async () => {
    if (!user) return;
    await supabase.from("batch_queue").delete().eq("user_id", user.id).in("status", ["completed", "failed"]);
    loadQueue();
    toast.success("Cleared completed items");
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "queued": return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "processing": return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case "completed": return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
      default: return null;
    }
  };

  const queuedCount = queue.filter(q => q.status === "queued").length;
  const completedCount = queue.filter(q => q.status === "completed").length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Layers className="h-6 w-6 text-accent" />
          Batch Generation Queue
        </h1>
        <p className="text-muted-foreground mt-1">Queue multiple extension ideas and generate them all</p>
      </motion.div>

      {!user ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-semibold mb-1">Sign In Required</h2>
          <p className="text-sm text-muted-foreground mb-3">Batch queue requires an account to track progress</p>
          <Button onClick={() => navigate("/auth")} className="bg-gradient-cyber text-primary-foreground">Sign In</Button>
        </div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-border bg-card p-5 space-y-3"
          >
            <Textarea
              placeholder="Enter extension ideas, one per line:&#10;YouTube video summarizer&#10;Tab manager with AI grouping&#10;Website scraper with export"
              value={ideas}
              onChange={e => setIdeas(e.target.value)}
              className="bg-secondary border-border min-h-[100px] font-mono text-sm"
              disabled={isProcessing}
            />
            <div className="flex gap-2">
              <Button onClick={addToQueue} disabled={isProcessing} variant="outline">
                <Plus className="h-4 w-4 mr-1.5" /> Add to Queue
              </Button>
              <Button
                onClick={processQueue}
                disabled={isProcessing || queuedCount === 0}
                className="bg-gradient-cyber text-primary-foreground"
              >
                {isProcessing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing {currentIdx + 1}/{queuedCount}...</>
                ) : (
                  <><Play className="h-4 w-4 mr-2" /> Process Queue ({queuedCount})</>
                )}
              </Button>
              {completedCount > 0 && (
                <Button onClick={clearCompleted} variant="ghost" size="sm" className="ml-auto">
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear Done
                </Button>
              )}
            </div>
          </motion.div>

          {queue.length > 0 && (
            <div className="rounded-xl border border-border bg-card">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold">Queue ({queue.length} items)</h3>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-[10px]">{queuedCount} queued</Badge>
                  <Badge className="bg-primary/20 text-primary text-[10px]">{completedCount} done</Badge>
                </div>
              </div>
              <div className="divide-y divide-border max-h-96 overflow-y-auto">
                {queue.map(item => (
                  <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                    {statusIcon(item.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{item.idea}</p>
                      {item.error_message && (
                        <p className="text-xs text-destructive mt-0.5">{item.error_message}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{item.status}</Badge>
                    {item.project_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          const { data } = await supabase
                            .from("extension_projects")
                            .select("files, spec")
                            .eq("id", item.project_id!)
                            .maybeSingle();
                          if (data) {
                            sessionStorage.setItem("extension-files", JSON.stringify(data.files || {}));
                            sessionStorage.setItem("extension-spec", JSON.stringify(data.spec || {}));
                          }
                          navigate("/editor");
                        }}
                        className="shrink-0"
                      >
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
