import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Sparkles, Copy, Check, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type SEOResult = {
  title: string;
  summary: string;
  description: string;
  keywords: string[];
  titleScore: number;
  tips: string[];
};

export default function StoreSEO() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [features, setFeatures] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SEOResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const optimize = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-pipeline", {
        body: {
          stage: "store-seo",
          spec: {
            name,
            description,
            features: features.split(",").map((f) => f.trim()).filter(Boolean),
          },
        },
      });
      if (error) throw error;
      setResult(data.result);
      toast.success("SEO optimization complete");
    } catch (e: any) {
      toast.error(e.message || "Failed to optimize");
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Search className="h-6 w-6 text-primary" />
          Store SEO Optimizer
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-powered Chrome Web Store listing optimizer for maximum visibility
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Extension Details</CardTitle>
          <CardDescription>Provide your extension info for AI optimization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Extension Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. YouTube Summary AI" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does your extension do?" rows={3} />
          </div>
          <div>
            <Label>Key Features (comma-separated)</Label>
            <Input value={features} onChange={(e) => setFeatures(e.target.value)} placeholder="video summary, transcript export, AI analysis" />
          </div>
          <Button onClick={optimize} disabled={loading || !name.trim()} className="w-full bg-gradient-cyber text-primary-foreground">
            {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {loading ? "Optimizing..." : "Optimize for Chrome Web Store"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Optimized Title
                <Button size="sm" variant="ghost" onClick={() => copyText(result.title, "title")}>
                  {copied === "title" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-sm bg-muted p-3 rounded-lg">{result.title}</p>
              <p className="text-xs text-muted-foreground mt-2">{result.title.length}/45 characters</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Short Summary
                <Button size="sm" variant="ghost" onClick={() => copyText(result.summary, "summary")}>
                  {copied === "summary" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm bg-muted p-3 rounded-lg">{result.summary}</p>
              <p className="text-xs text-muted-foreground mt-2">{result.summary.length}/132 characters</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                SEO Keywords
                <Button size="sm" variant="ghost" onClick={() => copyText(result.keywords.join(", "), "keywords")}>
                  {copied === "keywords" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {result.keywords.map((kw) => (
                  <Badge key={kw} variant="secondary">{kw}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Full Description
                <Button size="sm" variant="ghost" onClick={() => copyText(result.description, "desc")}>
                  {copied === "desc" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-sm bg-muted p-4 rounded-lg whitespace-pre-wrap max-h-60 overflow-auto">{result.description}</pre>
            </CardContent>
          </Card>

          {result.tips && result.tips.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">💡 SEO Tips</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.tips.map((tip, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-primary font-bold">{i + 1}.</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}
    </div>
  );
}
