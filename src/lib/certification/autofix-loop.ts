// Client-side AI Auto-Fix loop.
// Iterates: pick files with critical/warning issues → call certify-autofix
// edge function → apply rewrite → re-run cert → stop when clean or maxIters.

import { supabase } from "@/integrations/supabase/client";
import { runCertification, type CertReport, type CertIssue } from ".";

export interface AutoFixStep {
  iteration: number;
  file: string;
  beforeIssues: number;
  afterIssues: number;
  changed: boolean;
  error?: string;
}

export interface AutoFixResult {
  steps: AutoFixStep[];
  files: Record<string, string>;
  before: CertReport;
  after: CertReport;
}

export interface AutoFixOptions {
  maxIterations?: number;      // default 3
  targetScore?: number;        // default 95 — stop when overall >= target and 0 criticals
  onProgress?: (step: AutoFixStep) => void;
  issueFilter?: (issue: CertIssue) => boolean;
  provider?: string | null;
}

async function callAutofix(file: string, content: string, issues: CertIssue[], provider: string | null = "lovable_gateway"): Promise<{ content: string; changed: boolean } | { error: string }> {
  const { data, error } = await supabase.functions.invoke("certify-autofix", {
    body: {
      file,
      content,
      provider,
      issues: issues.map(i => ({
        id: i.id, severity: i.severity, message: i.message, fix: i.fix, line: i.line, category: i.category,
      })),
    },
  });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { content: String(data.content), changed: Boolean(data.changed) };
}

function groupByFile(issues: CertIssue[], filter?: (i: CertIssue) => boolean): Map<string, CertIssue[]> {
  const map = new Map<string, CertIssue[]>();
  for (const i of issues) {
    if (filter && !filter(i)) continue;
    // Skip issues whose "file" is a virtual bucket (e.g. packaging "bundle")
    if (!i.file || i.file === "bundle") continue;
    if (i.severity === "info") continue;
    const arr = map.get(i.file) ?? [];
    arr.push(i);
    map.set(i.file, arr);
  }
  return map;
}

export async function runAutoFixLoop(
  inputFiles: Record<string, string>,
  opts: AutoFixOptions = {},
): Promise<AutoFixResult> {
  const maxIterations = opts.maxIterations ?? 3;
  const targetScore = opts.targetScore ?? 95;

  let files = { ...inputFiles };
  const before = runCertification(files);
  const steps: AutoFixStep[] = [];
  let current = before;

  for (let iter = 1; iter <= maxIterations; iter++) {
    if (current.criticals === 0 && current.overall >= targetScore) break;

    const buckets = groupByFile(current.issues, opts.issueFilter);
    if (buckets.size === 0) break;

    // Fix each file in this iteration
    for (const [file, issues] of buckets) {
      const content = files[file];
      if (typeof content !== "string") continue;
      const beforeCount = issues.length;
      const res = await callAutofix(file, content, issues);
      const step: AutoFixStep = {
        iteration: iter, file, beforeIssues: beforeCount, afterIssues: beforeCount, changed: false,
      };
      if ("error" in res) {
        step.error = res.error;
      } else if (res.changed && res.content.trim().length > 0) {
        // Sanity: don't accept an obviously truncated JS/JSON (avoid data loss)
        const shrunk = res.content.length < content.length * 0.4;
        if (shrunk) {
          step.error = "AI response too short — skipped to protect original file.";
        } else {
          files = { ...files, [file]: res.content };
          step.changed = true;
        }
      }
      steps.push(step);
      opts.onProgress?.(step);
    }

    // Re-run certification after this iteration
    const next = runCertification(files);
    // Update afterIssues on the steps recorded in this iteration
    const iterSteps = steps.filter(s => s.iteration === iter);
    for (const s of iterSteps) {
      s.afterIssues = next.issues.filter(i => i.file === s.file).length;
    }
    current = next;
    if (current.criticals === 0 && current.overall >= targetScore) break;
  }

  return { steps, files, before, after: current };
}
