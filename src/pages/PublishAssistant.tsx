import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Upload, FileText, Shield, Copy, CheckCircle2,
  Loader2, Download, ExternalLink, Image
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ExtensionSpec } from "@/lib/generate-extension";

export default function PublishAssistant() {
  const [spec, setSpec] = useState<ExtensionSpec | null>(null);
  const [complianceReport, setComplianceReport] = useState<any>(null);
  const [storeAssets, setStoreAssets] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [privacyPolicy, setPrivacyPolicy] = useState("");
  const [storeDescription, setStoreDescription] = useState("");

  useEffect(() => {
    const storedSpec = sessionStorage.getItem("extension-spec");
    const storedComp = sessionStorage.getItem("compliance-report");

    if (storedSpec) try {
      const s = JSON.parse(storedSpec);
      setSpec(s);
    } catch {}

    if (storedComp) try {
      const c = JSON.parse(storedComp);
      setComplianceReport(c);
      if (c.privacyPolicy) setPrivacyPolicy(c.privacyPolicy);
      if (c.storeDescription) setStoreDescription(c.storeDescription);
    } catch {}
  }, []);

  const generateAssets = async () => {
    if (!spec) return;
    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("agent-pipeline", {
        body: { spec, stage: "store-assets" },
      });

      if (error) throw error;

      setStoreAssets(data.result);
      if (data.result.privacyPolicy) setPrivacyPolicy(data.result.privacyPolicy);
      if (data.result.description) setStoreDescription(data.result.description);
      toast.success("Store assets generated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate assets");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Upload className="h-6 w-6 text-accent" />
          Chrome Store Publish Assistant
        </h1>
        <p className="text-muted-foreground mt-1">Generate store listing, privacy policy, and publishing assets</p>
      </motion.div>

      {!spec ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-semibold mb-1">No Extension Loaded</h2>
          <p className="text-sm text-muted-foreground">Generate an extension first</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{spec.name}</h2>
                <p className="text-sm text-muted-foreground">{spec.description}</p>
              </div>
              <Button
                onClick={generateAssets}
                disabled={isGenerating}
                className="bg-gradient-cyber text-primary-foreground"
              >
                {isGenerating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><FileText className="h-4 w-4 mr-2" /> Generate Store Assets</>
                )}
              </Button>
            </div>
          </div>

          {/* Publishing checklist */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card p-5"
          >
            <h3 className="font-semibold mb-3">Publishing Checklist</h3>
            <div className="space-y-2">
              {[
                { label: "Extension package (.zip)", done: true },
                { label: "Store listing description", done: !!storeDescription },
                { label: "Privacy policy", done: !!privacyPolicy },
                { label: "Extension icons (16, 48, 128px)", done: false },
                { label: "Screenshots (1280x800)", done: false },
                { label: "SEO keywords", done: !!storeAssets?.keywords },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  {item.done ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />
                  )}
                  <span className={`text-sm ${item.done ? "" : "text-muted-foreground"}`}>{item.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Store title & summary */}
          {storeAssets && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-card p-5 space-y-4"
            >
              <h3 className="font-semibold">Store Listing</h3>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">Title</span>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(storeAssets.title, "Title")}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-sm font-medium bg-secondary rounded-md px-3 py-2">{storeAssets.title}</p>
              </div>

              {storeAssets.summary && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Summary</span>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(storeAssets.summary, "Summary")}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-sm bg-secondary rounded-md px-3 py-2">{storeAssets.summary}</p>
                </div>
              )}

              {storeAssets.category && (
                <div>
                  <span className="text-sm text-muted-foreground">Category: </span>
                  <Badge variant="secondary">{storeAssets.category}</Badge>
                </div>
              )}

              {storeAssets.keywords && (
                <div>
                  <span className="text-sm text-muted-foreground block mb-1">SEO Keywords</span>
                  <div className="flex flex-wrap gap-1">
                    {storeAssets.keywords.map((k: string) => (
                      <Badge key={k} variant="outline" className="text-xs">{k}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Store description */}
          {storeDescription && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Store Description</h3>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(storeDescription, "Description")}>
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
              <Textarea
                value={storeDescription}
                onChange={e => setStoreDescription(e.target.value)}
                className="bg-secondary border-border min-h-[200px] text-sm font-mono"
              />
            </motion.div>
          )}

          {/* Privacy policy */}
          {privacyPolicy && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Privacy Policy
                </h3>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(privacyPolicy, "Privacy policy")}>
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
              <Textarea
                value={privacyPolicy}
                onChange={e => setPrivacyPolicy(e.target.value)}
                className="bg-secondary border-border min-h-[200px] text-sm"
              />
            </motion.div>
          )}

          {/* Terms of use */}
          {storeAssets?.termsOfUse && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Terms of Use</h3>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(storeAssets.termsOfUse, "Terms")}>
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
              <Textarea
                value={storeAssets.termsOfUse}
                readOnly
                className="bg-secondary border-border min-h-[150px] text-sm"
              />
            </motion.div>
          )}

          {/* Publishing guide */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-primary/20 bg-card p-5"
          >
            <h3 className="font-semibold mb-3">How to Publish</h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><Badge variant="secondary" className="shrink-0">1</Badge> Download your extension .zip from the Code Editor</li>
              <li className="flex gap-2"><Badge variant="secondary" className="shrink-0">2</Badge> Go to <a href="https://chrome.google.com/webstore/devconsole" target="_blank" rel="noopener" className="text-primary hover:underline">Chrome Developer Dashboard</a></li>
              <li className="flex gap-2"><Badge variant="secondary" className="shrink-0">3</Badge> Pay $5 one-time developer registration fee</li>
              <li className="flex gap-2"><Badge variant="secondary" className="shrink-0">4</Badge> Click "New Item" and upload your .zip</li>
              <li className="flex gap-2"><Badge variant="secondary" className="shrink-0">5</Badge> Fill in store listing using the generated assets above</li>
              <li className="flex gap-2"><Badge variant="secondary" className="shrink-0">6</Badge> Add privacy policy URL and submit for review</li>
            </ol>
          </motion.div>
        </>
      )}
    </div>
  );
}
