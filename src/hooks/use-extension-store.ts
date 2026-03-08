import { useState, useCallback } from "react";
import type { ExtensionSpec, GeneratedFiles } from "@/lib/generate-extension";
import { generateAllFiles } from "@/lib/generate-extension";

export function useExtensionStore() {
  const [spec, setSpec] = useState<ExtensionSpec | null>(null);
  const [files, setFiles] = useState<GeneratedFiles>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeFile, setActiveFile] = useState("manifest.json");

  const generateFromSpec = useCallback((newSpec: ExtensionSpec) => {
    setSpec(newSpec);
    const generated = generateAllFiles(newSpec);
    setFiles(generated);
    setActiveFile("manifest.json");
  }, []);

  const updateFile = useCallback((filename: string, content: string) => {
    setFiles((prev) => ({ ...prev, [filename]: content }));
  }, []);

  return {
    spec,
    setSpec,
    files,
    setFiles,
    isGenerating,
    setIsGenerating,
    activeFile,
    setActiveFile,
    generateFromSpec,
    updateFile,
  };
}
