import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Package, Download, FileArchive, CheckCircle2, FolderTree, Sparkles, Loader2, Image, ShieldCheck, AlertTriangle, XCircle, Info } from "lucide-react";
import { runPackageQA, type QASeverity } from "@/lib/package-qa";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { ExtensionSpec } from "@/lib/generate-extension";
import { generateExtensionIcons } from "@/lib/generate-icons";
import { supabase } from "@/integrations/supabase/client";

export default function PackageExtension() {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [spec, setSpec] = useState<ExtensionSpec | null>(null);
  const [aiIconBase64, setAiIconBase64] = useState<string | null>(null);
  const [generatingIcons, setGeneratingIcons] = useState(false);

  useEffect(() => {
    const storedFiles = sessionStorage.getItem("extension-files");
    const storedSpec = sessionStorage.getItem("extension-spec");
    if (storedFiles) try { setFiles(JSON.parse(storedFiles)); } catch {}
    if (storedSpec) try { setSpec(JSON.parse(storedSpec)); } catch {}
  }, []);

  const generateAIIcons = async () => {
    if (!spec) return;
    setGeneratingIcons(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-icons", {
        body: { name: spec.name, description: spec.description },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.imageBase64) {
        setAiIconBase64(data.imageBase64);
        toast.success("AI icons generated! They'll be included in your download.");
      } else {
        throw new Error("No image returned");
      }
    } catch (e: any) {
      console.error("Icon generation error:", e);
      toast.error(e.message || "Failed to generate icons");
    } finally {
      setGeneratingIcons(false);
    }
  };

  const base64ToUint8Array = (base64DataUrl: string): Uint8Array => {
    const base64 = base64DataUrl.split(",")[1] || base64DataUrl;
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const resizeIcon = async (base64DataUrl: string, size: number): Promise<Uint8Array> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, size, size);
        canvas.toBlob((blob) => {
          if (blob) {
            blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
          } else {
            resolve(base64ToUint8Array(base64DataUrl));
          }
        }, "image/png");
      };
      img.src = base64DataUrl;
    });
  };

  const handleDownload = async () => {
    const zip = new JSZip();
    Object.entries(files).forEach(([name, content]) => {
      if (name.includes("/")) {
        const parts = name.split("/");
        const folder = zip.folder(parts[0]);
        folder?.file(parts.slice(1).join("/"), content);
      } else {
        zip.file(name, content);
      }
    });

    const iconsFolder = zip.folder("icons")!;

    if (aiIconBase64) {
      // Use AI-generated icons, resized to each required dimension
      const [icon16, icon48, icon128] = await Promise.all([
        resizeIcon(aiIconBase64, 16),
        resizeIcon(aiIconBase64, 48),
        resizeIcon(aiIconBase64, 128),
      ]);
      iconsFolder.file("icon16.png", icon16);
      iconsFolder.file("icon48.png", icon48);
      iconsFolder.file("icon128.png", icon128);
    } else {
      // Fallback to solid-color placeholder icons
      const icons = generateExtensionIcons();
      iconsFolder.file("icon16.png", icons["icons/icon16.png"]);
      iconsFolder.file("icon48.png", icons["icons/icon48.png"]);
      iconsFolder.file("icon128.png", icons["icons/icon128.png"]);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const zipName = spec?.name?.toLowerCase().replace(/\s+/g, "-") || "extension";
    saveAs(blob, `${zipName}.zip`);
    toast.success("Extension package downloaded!");
  };

  const fileList = Object.keys(files);
  const totalSize = Object.values(files).reduce((acc, f) => acc + new Blob([f]).size, 0);
  const totalLines = Object.values(files).reduce((acc, f) => acc + f.split("\n").length, 0);

  // QA runs against the *final* bundle, so include the icons we'll inject at zip time.
  const qaReport = useMemo(() => {
    if (fileList.length === 0) return null;
    const withIcons: Record<string, string> = {
      ...files,
      "icons/icon16.png": files["icons/icon16.png"] ?? "<binary>",
      "icons/icon48.png": files["icons/icon48.png"] ?? "<binary>",
      "icons/icon128.png": files["icons/icon128.png"] ?? "<binary>",
    };
    return runPackageQA(withIcons);
  }, [files, fileList.length]);

  const sevIcon = (sev: QASeverity, passed: boolean) => {
    if (passed) return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (sev === "error") return <XCircle className="h-4 w-4 text-destructive" />;
    if (sev === "warning") return <AlertTriangle className="h-4 w-4 text-warning" />;
    return <Info className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          Package Extension
        </h1>
        <p className="text-muted-foreground mt-1">Build and download your extension as a .zip package</p>
      </motion.div>

      {fileList.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-semibold mb-1">No Extension To Package</h2>
          <p className="text-sm text-muted-foreground">Generate an extension first</p>
        </div>
      ) : (
        <>
          {spec && (
            <div className="rounded-xl border border-primary/20 bg-card p-5 glow-primary">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-bold text-lg">{spec.name}</h2>
                  <p className="text-sm text-muted-foreground">{spec.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={generateAIIcons}
                    disabled={generatingIcons}
                    className="border-primary/30"
                  >
                    {generatingIcons ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    {generatingIcons ? "Generating..." : "AI Icons"}
                  </Button>
                  <Button
                    onClick={handleDownload}
                    disabled={!!qaReport && !qaReport.chromeReady}
                    className="bg-gradient-cyber text-primary-foreground"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {qaReport && !qaReport.chromeReady ? "Fix QA errors to download" : "Download .zip"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {qaReport && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`h-5 w-5 ${qaReport.chromeReady ? "text-success" : "text-warning"}`} />
                  <div>
                    <h3 className="text-sm font-semibold">Packaging QA — Chrome MV3 Validation</h3>
                    <p className="text-xs text-muted-foreground">
                      {qaReport.checks.length} checks · {qaReport.errors} errors · {qaReport.warnings} warnings
                    </p>
                  </div>
                </div>
                <Badge
                  variant={qaReport.chromeReady ? "default" : "destructive"}
                  className="font-mono text-[10px]"
                >
                  {qaReport.chromeReady ? "CHROME READY" : "NOT READY"}
                </Badge>
              </div>
              <div className="divide-y divide-border">
                {qaReport.checks.map(c => (
                  <div key={c.id} className="px-5 py-2.5 flex items-start gap-3">
                    {sevIcon(c.severity, c.passed)}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${c.passed ? "text-foreground" : "font-medium"}`}>{c.label}</p>
                      {!c.passed && c.detail && (
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono break-all">{c.detail}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-mono uppercase">
                      {c.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* AI Icon Preview */}
          {aiIconBase64 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl border border-primary/20 bg-card p-5"
            >
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Image className="h-4 w-4 text-primary" />
                AI-Generated Icons
              </h3>
              <div className="flex items-end gap-6">
                <div className="text-center">
                  <div className="rounded-lg border border-border bg-muted/50 p-2 inline-block mb-1">
                    <img src={aiIconBase64} alt="Icon 128" className="w-32 h-32 object-contain" />
                  </div>
                  <p className="text-xs text-muted-foreground">128×128</p>
                </div>
                <div className="text-center">
                  <div className="rounded-lg border border-border bg-muted/50 p-2 inline-block mb-1">
                    <img src={aiIconBase64} alt="Icon 48" className="w-12 h-12 object-contain" />
                  </div>
                  <p className="text-xs text-muted-foreground">48×48</p>
                </div>
                <div className="text-center">
                  <div className="rounded-lg border border-border bg-muted/50 p-2 inline-block mb-1">
                    <img src={aiIconBase64} alt="Icon 16" className="w-4 h-4 object-contain" />
                  </div>
                  <p className="text-xs text-muted-foreground">16×16</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="ghost" size="sm" onClick={generateAIIcons} disabled={generatingIcons}>
                  {generatingIcons ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  Regenerate
                </Button>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <FileArchive className="h-5 w-5 text-primary mb-2" />
              <p className="text-2xl font-bold font-mono">{fileList.length}</p>
              <p className="text-sm text-muted-foreground">Files</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <FolderTree className="h-5 w-5 text-primary mb-2" />
              <p className="text-2xl font-bold font-mono">{totalLines}</p>
              <p className="text-sm text-muted-foreground">Lines of code</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <Package className="h-5 w-5 text-primary mb-2" />
              <p className="text-2xl font-bold font-mono">{(totalSize / 1024).toFixed(1)} KB</p>
              <p className="text-sm text-muted-foreground">Package size</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">Package Contents</h3>
            </div>
            <div className="divide-y divide-border">
              {fileList.map(name => (
                <div key={name} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-mono">{name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {files[name].split("\n").length} lines
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {(new Blob([files[name]]).size / 1024).toFixed(1)} KB
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
