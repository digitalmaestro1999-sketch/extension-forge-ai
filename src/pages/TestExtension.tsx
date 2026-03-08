import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  TestTube2, CheckCircle2, XCircle, AlertTriangle,
  Shield, FileCheck, Loader2, Play, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import type { ExtensionSpec } from "@/lib/generate-extension";

interface TestResult {
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
  category: "manifest" | "permissions" | "security" | "compliance" | "code";
}

function runManifestTests(files: Record<string, string>): TestResult[] {
  const results: TestResult[] = [];
  const manifestStr = files["manifest.json"];

  if (!manifestStr) {
    results.push({ name: "Manifest exists", status: "fail", message: "manifest.json not found", category: "manifest" });
    return results;
  }

  try {
    const manifest = JSON.parse(manifestStr);

    results.push({
      name: "Valid JSON",
      status: "pass",
      message: "manifest.json is valid JSON",
      category: "manifest",
    });

    results.push({
      name: "Manifest V3",
      status: manifest.manifest_version === 3 ? "pass" : "fail",
      message: manifest.manifest_version === 3 ? "Using Manifest V3" : `Using Manifest V${manifest.manifest_version}`,
      category: "manifest",
    });

    results.push({
      name: "Extension name",
      status: manifest.name ? "pass" : "fail",
      message: manifest.name ? `Name: "${manifest.name}"` : "Missing name field",
      category: "manifest",
    });

    results.push({
      name: "Version field",
      status: manifest.version ? "pass" : "fail",
      message: manifest.version ? `Version: ${manifest.version}` : "Missing version",
      category: "manifest",
    });

    results.push({
      name: "Description",
      status: manifest.description ? "pass" : "warn",
      message: manifest.description ? `Description set (${manifest.description.length} chars)` : "No description",
      category: "manifest",
    });

    results.push({
      name: "Service worker",
      status: manifest.background?.service_worker ? "pass" : "warn",
      message: manifest.background?.service_worker ? "Background service worker configured" : "No service worker",
      category: "manifest",
    });

    results.push({
      name: "Popup action",
      status: manifest.action?.default_popup ? "pass" : "warn",
      message: manifest.action?.default_popup ? "Popup configured" : "No popup configured",
      category: "manifest",
    });

    // Permission checks
    const perms = manifest.permissions || [];
    const dangerousPerms = ["webRequestBlocking", "debugger", "proxy"];
    const hasDangerous = perms.filter((p: string) => dangerousPerms.includes(p));

    results.push({
      name: "Permission count",
      status: perms.length <= 5 ? "pass" : perms.length <= 10 ? "warn" : "fail",
      message: `${perms.length} permissions declared`,
      category: "permissions",
    });

    if (hasDangerous.length > 0) {
      results.push({
        name: "Dangerous permissions",
        status: "warn",
        message: `Potentially problematic: ${hasDangerous.join(", ")}`,
        category: "permissions",
      });
    } else {
      results.push({
        name: "No dangerous permissions",
        status: "pass",
        message: "No high-risk permissions detected",
        category: "permissions",
      });
    }

    const hostPerms = manifest.host_permissions || [];
    results.push({
      name: "Host permissions",
      status: hostPerms.includes("<all_urls>") ? "warn" : "pass",
      message: hostPerms.includes("<all_urls>")
        ? "Using <all_urls> — consider narrowing scope"
        : `${hostPerms.length} host permission(s)`,
      category: "permissions",
    });

    // CSP check
    results.push({
      name: "CSP policy",
      status: manifest.content_security_policy ? "pass" : "warn",
      message: manifest.content_security_policy ? "Custom CSP defined" : "Using default CSP (acceptable)",
      category: "security",
    });

    // Store compliance
    results.push({
      name: "Description length",
      status: (manifest.description?.length || 0) >= 10 ? "pass" : "fail",
      message: "Store requires meaningful description",
      category: "compliance",
    });

    results.push({
      name: "Name length",
      status: (manifest.name?.length || 0) <= 45 ? "pass" : "fail",
      message: manifest.name?.length <= 45 ? "Name within limit" : "Name exceeds 45 char limit",
      category: "compliance",
    });

  } catch {
    results.push({
      name: "Valid JSON",
      status: "fail",
      message: "manifest.json contains invalid JSON",
      category: "manifest",
    });
  }

  // Check required files
  const requiredFiles = ["background.js", "popup.html"];
  requiredFiles.forEach(f => {
    results.push({
      name: `${f} exists`,
      status: files[f] ? "pass" : "warn",
      message: files[f] ? `${f} found (${files[f].split("\n").length} lines)` : `${f} not found`,
      category: "code",
    });
  });

  return results;
}

export default function TestExtension() {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [securityAudit, setSecurityAudit] = useState<any>(null);
  const [spec, setSpec] = useState<ExtensionSpec | null>(null);

  useEffect(() => {
    const storedFiles = sessionStorage.getItem("extension-files");
    const storedSpec = sessionStorage.getItem("extension-spec");
    const storedSec = sessionStorage.getItem("security-audit");

    if (storedFiles) try { setFiles(JSON.parse(storedFiles)); } catch {}
    if (storedSpec) try { setSpec(JSON.parse(storedSpec)); } catch {}
    if (storedSec) try { setSecurityAudit(JSON.parse(storedSec)); } catch {}
  }, []);

  const runTests = () => {
    setIsRunning(true);
    setResults([]);

    setTimeout(() => {
      const testResults = runManifestTests(files);
      setResults(testResults);
      setIsRunning(false);

      const passes = testResults.filter(r => r.status === "pass").length;
      const fails = testResults.filter(r => r.status === "fail").length;
      toast.success(`Tests complete: ${passes} passed, ${fails} failed`);
    }, 1000);
  };

  const passes = results.filter(r => r.status === "pass").length;
  const fails = results.filter(r => r.status === "fail").length;
  const warns = results.filter(r => r.status === "warn").length;
  const total = results.length;
  const score = total > 0 ? Math.round((passes / total) * 100) : 0;
  const categories = ["manifest", "permissions", "security", "compliance", "code"] as const;

  const statusIcon = (status: string) => {
    switch (status) {
      case "pass": return <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />;
      case "fail": return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
      case "warn": return <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />;
      default: return null;
    }
  };

  const hasFiles = Object.keys(files).length > 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TestTube2 className="h-6 w-6 text-primary" />
          Testing Engine
        </h1>
        <p className="text-muted-foreground mt-1">Validate manifest, permissions, security, and store compliance</p>
      </motion.div>

      {!hasFiles ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <TestTube2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-semibold mb-1">No Extension Loaded</h2>
          <p className="text-sm text-muted-foreground">Generate an extension first using the Create Extension page</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Button onClick={runTests} disabled={isRunning} className="bg-gradient-cyber text-primary-foreground">
              {isRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              {isRunning ? "Running Tests..." : "Run All Tests"}
            </Button>
            {spec && <Badge variant="secondary">{spec.name}</Badge>}
            {total > 0 && (
              <div className="flex gap-2 ml-auto">
                <Badge className="bg-primary/20 text-primary">{passes} passed</Badge>
                {warns > 0 && <Badge className="bg-warning/20 text-warning">{warns} warnings</Badge>}
                {fails > 0 && <Badge className="bg-destructive/20 text-destructive">{fails} failed</Badge>}
              </div>
            )}
          </div>

          {total > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold">Test Score</span>
                <span className="text-2xl font-bold font-mono text-primary">{score}%</span>
              </div>
              <Progress value={score} className="h-2" />
            </div>
          )}

          {results.length > 0 && categories.map(cat => {
            const catResults = results.filter(r => r.category === cat);
            if (catResults.length === 0) return null;
            return (
              <motion.div
                key={cat}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border bg-card"
              >
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-sm font-semibold capitalize">{cat}</h3>
                </div>
                <div className="divide-y divide-border">
                  {catResults.map((r, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                      {statusIcon(r.status)}
                      <span className="text-sm font-medium flex-1">{r.name}</span>
                      <span className="text-xs text-muted-foreground">{r.message}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}

          {securityAudit && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  AI Security Audit
                </h3>
                {securityAudit.grade && (
                  <Badge className={`font-mono ${securityAudit.grade === "A" ? "bg-primary/20 text-primary" : "bg-amber-500/20 text-amber-400"}`}>
                    Grade: {securityAudit.grade}
                  </Badge>
                )}
              </div>
              {securityAudit.findings?.map((f: any, i: number) => (
                <div key={i} className="flex items-start gap-2 py-2 border-t border-border first:border-0">
                  <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">{f.severity}</Badge>
                  <div>
                    <p className="text-sm font-medium">{f.title}</p>
                    <p className="text-xs text-muted-foreground">{f.description}</p>
                    {f.recommendation && <p className="text-xs text-primary mt-1">↳ {f.recommendation}</p>}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
