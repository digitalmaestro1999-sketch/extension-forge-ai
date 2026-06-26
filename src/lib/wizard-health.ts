// Pre-flight Extension Health & Compliance scanner.
// Pure client-side validation that runs over the generated wizard state.

import { buildAllFiles, buildManifest, type WizardSpec } from "./wizard-codegen";

export type HealthSeverity = "error" | "warning" | "info";

export interface HealthFinding {
  id: string;
  severity: HealthSeverity;
  title: string;
  detail: string;
  /** Wizard step (1..3) the user should jump to in order to fix it. */
  step?: 1 | 2 | 3;
}

export interface HealthReport {
  score: number; // 0..100
  status: "ready" | "warnings" | "blocked";
  label: string;
  findings: HealthFinding[];
  counts: { errors: number; warnings: number; infos: number };
}

const DANGEROUS_PERMISSIONS = new Set([
  "webRequestBlocking",
  "debugger",
  "proxy",
  "privacy",
  "management",
  "declarativeNetRequestFeedback",
]);

const UNSAFE_HOSTS = new Set(["<all_urls>", "*://*/*", "http://*/*", "https://*/*"]);

// Patterns that flag CSP / Web Store rejections inside generated source files.
const UNSAFE_SOURCE_PATTERNS: { id: string; pattern: RegExp; reason: string }[] = [
  { id: "eval", pattern: /\beval\s*\(/, reason: "Uses eval() — banned under Manifest V3 CSP." },
  { id: "new-function", pattern: /\bnew\s+Function\s*\(/, reason: "Uses new Function() — banned under MV3 CSP." },
  { id: "inner-html", pattern: /\.innerHTML\s*=/, reason: "Assigning to innerHTML can enable XSS in extension contexts." },
  { id: "remote-script", pattern: /<script[^>]+src\s*=\s*["']https?:\/\//i, reason: "Loads a remote script — MV3 forbids remote code." },
  { id: "inline-handler", pattern: /\son\w+\s*=\s*["']/i, reason: "Inline event handler (onclick=…) violates MV3 CSP." },
  { id: "inline-script-tag", pattern: /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i, reason: "Inline <script> blocks violate MV3 CSP." },
];

export function runHealthScan(spec: WizardSpec): HealthReport {
  const findings: HealthFinding[] = [];
  const manifest = buildManifest(spec) as Record<string, unknown>;
  const files = buildAllFiles(spec);

  // --- ERRORS -----------------------------------------------------------
  if (manifest.manifest_version !== 3) {
    findings.push({
      id: "mv3-missing",
      severity: "error",
      title: "manifest_version must be 3",
      detail: "Chrome Web Store rejects MV2 submissions. The manifest must declare manifest_version: 3.",
      step: 1,
    });
  }

  if (!spec.name?.trim()) {
    findings.push({
      id: "name-missing",
      severity: "error",
      title: "Extension name is required",
      detail: "Give your extension a recognizable name so users can identify it in chrome://extensions.",
      step: 1,
    });
  } else if (spec.name.trim().length > 75) {
    findings.push({
      id: "name-too-long",
      severity: "warning",
      title: "Name exceeds 75 characters",
      detail: "Chrome Web Store truncates names longer than 75 characters.",
      step: 1,
    });
  }

  if (!/^\d+(\.\d+){0,3}$/.test(spec.version)) {
    findings.push({
      id: "version-invalid",
      severity: "error",
      title: "Invalid version string",
      detail: "Use semver-ish numbers: 1, 1.0, 1.0.0, or 1.0.0.0 — letters and pre-release tags are rejected.",
      step: 1,
    });
  }

  if (spec.extType === "content" && !manifest.content_scripts) {
    findings.push({
      id: "content-scripts-missing",
      severity: "error",
      title: "Content script declared but not registered",
      detail: "Add at least one match pattern so content.js actually gets injected.",
      step: 2,
    });
  }

  // --- WARNINGS ---------------------------------------------------------
  const allHosts = [...spec.hosts, ...spec.matches];
  const broadHosts = allHosts.filter(h => UNSAFE_HOSTS.has(h));
  if (broadHosts.length) {
    findings.push({
      id: "host-broad",
      severity: "warning",
      title: `Broad host access (${broadHosts.join(", ")})`,
      detail: "Requesting <all_urls> or *://*/* may delay Chrome Web Store approval — request only the hosts you need.",
      step: 3,
    });
  }

  const dangerous = spec.permissions.filter(p => DANGEROUS_PERMISSIONS.has(p));
  if (dangerous.length) {
    findings.push({
      id: "perm-dangerous",
      severity: "warning",
      title: `Sensitive permission${dangerous.length > 1 ? "s" : ""}: ${dangerous.join(", ")}`,
      detail: "These permissions trigger extra review by the Chrome Web Store team and may delay approval.",
      step: 3,
    });
  }

  if (!spec.description?.trim()) {
    findings.push({
      id: "description-missing",
      severity: "warning",
      title: "Description is empty",
      detail: "A clear description improves store conversion and is required for Web Store publication.",
      step: 1,
    });
  } else if (spec.description.length > 132) {
    findings.push({
      id: "description-long",
      severity: "warning",
      title: "Description exceeds 132 characters",
      detail: "Manifest descriptions are capped at 132 characters — extra text will be truncated.",
      step: 1,
    });
  }

  if (spec.permissions.length === 0 && spec.hosts.length === 0 && spec.extType !== "popup") {
    findings.push({
      id: "perms-empty",
      severity: "info",
      title: "No permissions selected",
      detail: "Your extension will work, but most non-popup surfaces need at least `storage` or `activeTab`.",
      step: 3,
    });
  }

  // --- SECURITY: scan generated source files ----------------------------
  for (const [path, raw] of Object.entries(files)) {
    if (typeof raw !== "string") continue;
    if (!/\.(html?|js|mjs|css)$/.test(path)) continue;
    for (const rule of UNSAFE_SOURCE_PATTERNS) {
      if (rule.pattern.test(raw)) {
        findings.push({
          id: `src-${rule.id}-${path}`,
          severity: rule.id === "inner-html" ? "warning" : "error",
          title: `Unsafe pattern in ${path}`,
          detail: rule.reason,
        });
      }
    }
  }

  // --- Score ------------------------------------------------------------
  const errors = findings.filter(f => f.severity === "error").length;
  const warnings = findings.filter(f => f.severity === "warning").length;
  const infos = findings.filter(f => f.severity === "info").length;

  let score = 100 - errors * 25 - warnings * 8 - infos * 2;
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  const status: HealthReport["status"] =
    errors > 0 ? "blocked" : warnings > 0 ? "warnings" : "ready";

  const label =
    status === "blocked"
      ? "Fix blocking errors to enable download"
      : status === "warnings"
      ? "Ships, but may slow store approval"
      : "Ready for Chrome Web Store";

  return { score, status, label, findings, counts: { errors, warnings, infos } };
}
