// Preflight manifest compliance gate.
// Combines packaging QA (MV3 structural checks) with the Chrome Web Store
// manifest policy checks and returns a single pass/blockers/warnings result
// suitable for gating downloads and uploads. Pure function, no side effects.

import { runPackageQA, type QACheck } from "./package-qa";
import { runPolicyCheck, type PolicyCheck } from "./cws-policy-check";

export interface PreflightBlocker {
  id: string;
  label: string;
  detail?: string;
  source: "qa" | "policy";
  fix?: string;
}

export interface PreflightResult {
  passed: boolean;             // true when 0 blockers
  blockers: PreflightBlocker[];
  warnings: PreflightBlocker[];
  checksRun: number;
  summary: string;
}

// Manifest-scoped policy check IDs (skip listing/metadata gates that live on
// the store listing page — those get their own gate in PublishAssistant).
const MANIFEST_POLICY_IDS = new Set([
  "mv3", "name-length", "desc-length", "version-format",
  "icons-complete", "csp-hardened", "no-update-url",
  "mv3-banned-perms", "default-locale", "no-remote-code",
]);

function fromQA(c: QACheck): PreflightBlocker {
  return { id: `qa:${c.id}`, label: c.label, detail: c.detail, source: "qa" };
}

function fromPolicy(c: PolicyCheck): PreflightBlocker {
  return { id: `policy:${c.id}`, label: c.label, detail: c.detail, source: "policy", fix: c.fix };
}

export function runPreflight(files: Record<string, string>): PreflightResult {
  const qa = runPackageQA(files);
  const policy = runPolicyCheck({ files });

  const blockers: PreflightBlocker[] = [];
  const warnings: PreflightBlocker[] = [];

  for (const c of qa.checks) {
    if (c.passed) continue;
    if (c.severity === "error") blockers.push(fromQA(c));
    else if (c.severity === "warning") warnings.push(fromQA(c));
  }

  for (const c of policy.checks) {
    if (!MANIFEST_POLICY_IDS.has(c.id)) continue;
    if (c.passed) continue;
    if (c.severity === "error") blockers.push(fromPolicy(c));
    else if (c.severity === "warning") warnings.push(fromPolicy(c));
  }

  // De-duplicate identical labels across the two sources
  const seen = new Set<string>();
  const dedup = (arr: PreflightBlocker[]) => arr.filter(b => {
    const key = b.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const uniqueBlockers = dedup(blockers);
  const uniqueWarnings = dedup(warnings);

  const passed = uniqueBlockers.length === 0;
  return {
    passed,
    blockers: uniqueBlockers,
    warnings: uniqueWarnings,
    checksRun: qa.checks.length + [...MANIFEST_POLICY_IDS].length,
    summary: passed
      ? `Preflight passed · ${uniqueWarnings.length} warning${uniqueWarnings.length === 1 ? "" : "s"}`
      : `Preflight blocked · ${uniqueBlockers.length} critical issue${uniqueBlockers.length === 1 ? "" : "s"}`,
  };
}
