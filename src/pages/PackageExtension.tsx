import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Package, Download, FileArchive, CheckCircle2, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { ExtensionSpec } from "@/lib/generate-extension";

export default function PackageExtension() {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [spec, setSpec] = useState<ExtensionSpec | null>(null);

  useEffect(() => {
    const storedFiles = sessionStorage.getItem("extension-files");
    const storedSpec = sessionStorage.getItem("extension-spec");
    if (storedFiles) try { setFiles(JSON.parse(storedFiles)); } catch {}
    if (storedSpec) try { setSpec(JSON.parse(storedSpec)); } catch {}
  }, []);

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
    zip.folder("icons");
    const blob = await zip.generateAsync({ type: "blob" });
    const zipName = spec?.name?.toLowerCase().replace(/\s+/g, "-") || "extension";
    saveAs(blob, `${zipName}.zip`);
    toast.success("Extension package downloaded!");
  };

  const fileList = Object.keys(files);
  const totalSize = Object.values(files).reduce((acc, f) => acc + new Blob([f]).size, 0);
  const totalLines = Object.values(files).reduce((acc, f) => acc + f.split("\n").length, 0);

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
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-lg">{spec.name}</h2>
                  <p className="text-sm text-muted-foreground">{spec.description}</p>
                </div>
                <Button onClick={handleDownload} className="bg-gradient-cyber text-primary-foreground">
                  <Download className="h-4 w-4 mr-2" /> Download .zip
                </Button>
              </div>
            </div>
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
