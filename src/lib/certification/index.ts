// Composite Certification & CWS Readiness engine (Phase 1).
// Runs all pure-TS validators against a bundle and produces a weighted
// readiness score, category breakdown, and unified issues list.

import { validateManifest, type ManifestIssue } from "./manifestValidator";
import { scanPolicy, type PolicyIssue } from "./policyScanner";
import { validateSyntax, type SyntaxIssue } from "./syntaxValidator";
import { scanSecurity, type SecurityIssue } from "./securityScanner";
import { checkAccessibility, type A11yIssue } from "./a11y";
import { simulateRuntime, type RuntimeResult } from "./runtime-simulator";
import { runPackageQA } from "@/lib/package-qa";

export { simulateRuntime } from "./runtime-simulator";
export type { RuntimeResult, RuntimeIssue } from "./runtime-simulator";
export { checkAccessibility } from "./a11y";
export type { A11yIssue } from "./a11y";

export type Category =
  | "manifest" | "policy" | "security" | "syntax" | "packaging" | "perfA11y";

export type IssueSeverity = "critical" | "warning" | "info";

export interface CertIssue {
  category: Category;
  id: string;
  severity: IssueSeverity;
  file: string;
  line?: number;
  message: string;
  fix: string;
}

export interface CategoryScore {
  key: Category;
  label: string;
  score: number;       // 0-100
  weight: number;      // contribution to overall
  critical: number;
  warning: number;
  info: number;
}

export type PassBand = "Low" | "Medium" | "High";

export interface CertReport {
  generatedAt: string;
  overall: number;           // 0-100
  passProbability: PassBand;
  criticals: number;
  warnings: number;
  categories: CategoryScore[];
  issues: CertIssue[];
}

const WEIGHTS: Record<Category, { label: string; weight: number }> = {
  manifest:  { label: "Manifest V3",       weight: 20 },
  policy:    { label: "CWS Policy",        weight: 20 },
  security:  { label: "Security",          weight: 20 },
  syntax:    { label: "Syntax",            weight: 15 },
  packaging: { label: "Packaging",         weight: 10 },
  perfA11y:  { label: "Perf & A11y",       weight: 15 },
};

function categoryScore(issues: CertIssue[], key: Category): CategoryScore {
  const filt = issues.filter(i => i.category === key);
  const critical = filt.filter(i => i.severity === "critical").length;
  const warning = filt.filter(i => i.severity === "warning").length;
  const info = filt.filter(i => i.severity === "info").length;
  const score = Math.max(0, 100 - (critical * 25 + warning * 8 + info * 2));
  return { key, label: WEIGHTS[key].label, weight: WEIGHTS[key].weight, score, critical, warning, info };
}

function toCertIssues<T extends { id: string; severity: IssueSeverity; file: string; line?: number; message: string; fix: string }>(
  category: Category, arr: T[]): CertIssue[] {
  return arr.map(i => ({ category, ...i }));
}

export function runCertification(files: Record<string, string>): CertReport {
  const issues: CertIssue[] = [];

  const manifestIssues: ManifestIssue[] = validateManifest(files);
  const policyIssues: PolicyIssue[] = scanPolicy(files);
  const syntaxIssues: SyntaxIssue[] = validateSyntax(files);
  const securityIssues: SecurityIssue[] = scanSecurity(files);

  issues.push(...toCertIssues("manifest", manifestIssues));
  issues.push(...toCertIssues("policy", policyIssues));
  issues.push(...toCertIssues("syntax", syntaxIssues));
  issues.push(...toCertIssues("security", securityIssues));

  // Packaging via existing package-qa (map its checks in).
  const qa = runPackageQA(files);
  for (const c of qa.checks) {
    if (c.passed) continue;
    const sev: IssueSeverity = c.severity === "error" ? "critical" : c.severity === "warning" ? "warning" : "info";
    issues.push({
      category: "packaging", id: `qa-${c.id}`, severity: sev,
      file: "bundle", message: c.label,
      fix: c.detail || "See packaging QA for details.",
    });
  }

  const cats: Category[] = ["manifest", "policy", "security", "syntax", "packaging", "perfA11y"];
  const categories = cats.map(k => categoryScore(issues, k));

  const totalW = categories.reduce((a, c) => a + c.weight, 0);
  const overall = Math.round(categories.reduce((a, c) => a + c.score * c.weight, 0) / totalW);

  const criticals = issues.filter(i => i.severity === "critical").length;
  const warnings = issues.filter(i => i.severity === "warning").length;

  const passProbability: PassBand =
    criticals === 0 && overall >= 90 ? "High" :
    criticals <= 1 && overall >= 75 ? "Medium" : "Low";

  // Sort issues: critical → warning → info, then by category
  issues.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 } as const;
    return order[a.severity] - order[b.severity] || a.category.localeCompare(b.category);
  });

  return {
    generatedAt: new Date().toISOString(),
    overall,
    passProbability,
    criticals,
    warnings,
    categories,
    issues,
  };
}

export function renderCertMarkdown(r: CertReport): string {
  const l: string[] = [];
  l.push(`# Extension Certification Report`);
  l.push(``);
  l.push(`- **Overall Readiness:** ${r.overall}/100`);
  l.push(`- **Pass Probability:** ${r.passProbability}`);
  l.push(`- **Critical:** ${r.criticals} · **Warnings:** ${r.warnings}`);
  l.push(`- **Generated:** ${r.generatedAt}`);
  l.push(``);
  l.push(`## Categories`);
  for (const c of r.categories) {
    l.push(`- **${c.label}** — ${c.score}/100 (weight ${c.weight}) · crit ${c.critical} · warn ${c.warning}`);
  }
  l.push(``);
  l.push(`## Issues (${r.issues.length})`);
  for (const i of r.issues) {
    const icon = i.severity === "critical" ? "🛑" : i.severity === "warning" ? "⚠️" : "ℹ️";
    l.push(`- ${icon} [${i.category}] \`${i.file}${i.line ? `:${i.line}` : ""}\` — ${i.message}`);
    l.push(`    ↳ Fix: ${i.fix}`);
  }
  l.push(``);
  l.push(`> This is an automated readiness estimate. Google's review includes human`);
  l.push(`> judgment on branding, description accuracy, and policy interpretation,`);
  l.push(`> so 100% approval cannot be guaranteed by any tool.`);
  return l.join("\n");
}
