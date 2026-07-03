// Browser compatibility checker for Chromium-family + Firefox + Safari.
// Analyzes manifest.json and source files for APIs, manifest keys, and CSS
// features that differ across browsers. Purely static — no runtime probing.

export type BrowserId = "chrome" | "edge" | "brave" | "opera" | "firefox" | "safari";
export type CompatStatus = "supported" | "partial" | "unsupported" | "unknown";
export type CompatSeverity = "info" | "warning" | "error";

export interface BrowserSupport {
  browser: BrowserId;
  status: CompatStatus;
  note?: string;
}

export type CompatFixId =
  | "remove-webrequest-blocking"
  | "add-webkit-backdrop-filter"
  | "add-gecko-id"
  | "add-sidebar-action-mirror"
  | "inject-browser-polyfill";

export interface CompatAutoFix {
  id: CompatFixId;
  label: string;
  description: string;
  writes: Array<"manifest" | "css" | "source">;
}

export interface CompatFinding {
  id: string;
  title: string;
  severity: CompatSeverity;
  category: "manifest" | "api" | "permission" | "css" | "html";
  location?: string; // file path or manifest field
  detail: string;
  support: BrowserSupport[];
  suggestion?: string;
  autoFix?: CompatAutoFix;
}

export interface BrowserScore {
  browser: BrowserId;
  label: string;
  score: number; // 0-100
  errors: number;
  warnings: number;
  verdict: "ready" | "review" | "blocked";
}

export interface CompatReport {
  findings: CompatFinding[];
  browsers: BrowserScore[];
  overallScore: number; // 0-100, average across browsers
  overallVerdict: "ready" | "review" | "blocked";
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    checkedFiles: number;
  };
}

const BROWSER_LABEL: Record<BrowserId, string> = {
  chrome: "Chrome",
  edge: "Edge",
  brave: "Brave",
  opera: "Opera",
  firefox: "Firefox",
  safari: "Safari",
};

const ALL_BROWSERS: BrowserId[] = ["chrome", "edge", "brave", "opera", "firefox", "safari"];

// Support matrix for common manifest keys and APIs. Keep entries small and
// focused on the deltas that matter for cross-browser publishing.
interface Rule {
  id: string;
  title: string;
  category: CompatFinding["category"];
  match: (ctx: MatchCtx) => { hit: boolean; location?: string; detail?: string };
  support: BrowserSupport[];
  severity?: CompatSeverity;
  suggestion?: string;
  autoFix?: CompatAutoFix;
}

interface MatchCtx {
  manifest: Record<string, unknown> | null;
  files: Record<string, string>;
  sourceBlob: string; // concat of all JS/TS files for cheap scanning
  cssBlob: string;
  htmlBlob: string;
}

const RULES: Rule[] = [
  {
    id: "mv3-service-worker",
    title: "Manifest V3 service_worker background",
    category: "manifest",
    match: (c) => {
      const bg = (c.manifest?.background ?? {}) as Record<string, unknown>;
      return { hit: !!bg.service_worker, location: "background.service_worker" };
    },
    support: [
      { browser: "chrome", status: "supported" },
      { browser: "edge", status: "supported" },
      { browser: "brave", status: "supported" },
      { browser: "opera", status: "supported" },
      { browser: "firefox", status: "partial", note: "FF ≥121 supports service_worker; older versions need background.scripts." },
      { browser: "safari", status: "partial", note: "Safari 16.4+ supports MV3 but converts SW to persistent background page." },
    ],
    severity: "warning",
    suggestion: "Also provide `background.scripts` fallback for Firefox <121 if you target older ESRs.",
  },
  {
    id: "mv3-action",
    title: "action (toolbar) API",
    category: "manifest",
    match: (c) => ({ hit: !!c.manifest?.action, location: "action" }),
    support: [
      { browser: "chrome", status: "supported" },
      { browser: "edge", status: "supported" },
      { browser: "brave", status: "supported" },
      { browser: "opera", status: "supported" },
      { browser: "firefox", status: "supported" },
      { browser: "safari", status: "supported" },
    ],
    severity: "info",
  },
  {
    id: "side-panel",
    title: "Side Panel API",
    category: "manifest",
    match: (c) => ({
      hit: !!c.manifest?.side_panel || /chrome\.sidePanel\b/.test(c.sourceBlob),
      location: "side_panel / chrome.sidePanel",
    }),
    support: [
      { browser: "chrome", status: "supported", note: "Chrome 114+" },
      { browser: "edge", status: "supported", note: "Edge 114+" },
      { browser: "brave", status: "supported" },
      { browser: "opera", status: "unknown" },
      { browser: "firefox", status: "unsupported", note: "Use sidebar_action instead." },
      { browser: "safari", status: "unsupported" },
    ],
    severity: "warning",
    suggestion: "Provide a Firefox-specific manifest with `sidebar_action` if you need cross-browser sidebars.",
  },
  {
    id: "declarative-net-request",
    title: "declarativeNetRequest",
    category: "permission",
    match: (c) => {
      const perms = ([] as unknown[]).concat(
        (c.manifest?.permissions as unknown[]) ?? [],
        (c.manifest?.optional_permissions as unknown[]) ?? []
      );
      const used = perms.includes("declarativeNetRequest") ||
        perms.includes("declarativeNetRequestWithHostAccess") ||
        /chrome\.declarativeNetRequest\b/.test(c.sourceBlob);
      return { hit: used };
    },
    support: [
      { browser: "chrome", status: "supported" },
      { browser: "edge", status: "supported" },
      { browser: "brave", status: "supported" },
      { browser: "opera", status: "supported" },
      { browser: "firefox", status: "partial", note: "Available FF 113+ with reduced ruleset limits." },
      { browser: "safari", status: "partial", note: "Content Blocker model differs; rules may need conversion." },
    ],
    severity: "warning",
  },
  {
    id: "webRequest-blocking",
    title: "Blocking webRequest (removed in MV3 Chrome)",
    category: "permission",
    match: (c) => {
      const perms = ((c.manifest?.permissions as unknown[]) ?? []);
      const blocking = perms.includes("webRequestBlocking");
      return { hit: blocking };
    },
    support: [
      { browser: "chrome", status: "unsupported", note: "Enterprise-only in MV3." },
      { browser: "edge", status: "unsupported" },
      { browser: "brave", status: "partial" },
      { browser: "opera", status: "unsupported" },
      { browser: "firefox", status: "supported" },
      { browser: "safari", status: "unsupported" },
    ],
    severity: "error",
    suggestion: "Migrate to `declarativeNetRequest` for MV3 Chromium browsers.",
    autoFix: {
      id: "remove-webrequest-blocking",
      label: "Remove webRequestBlocking permission",
      description: "Deletes `webRequestBlocking` from manifest permissions (Chrome MV3 rejects it).",
      writes: ["manifest"],
    },
  },
  {
    id: "browser-namespace",
    title: "Uses `browser.*` namespace",
    category: "api",
    match: (c) => ({ hit: /\bbrowser\.(runtime|tabs|storage|scripting|action)\b/.test(c.sourceBlob) }),
    support: [
      { browser: "chrome", status: "unsupported", note: "Chromium exposes `chrome.*` only; polyfill required." },
      { browser: "edge", status: "unsupported" },
      { browser: "brave", status: "unsupported" },
      { browser: "opera", status: "unsupported" },
      { browser: "firefox", status: "supported" },
      { browser: "safari", status: "supported" },
    ],
    severity: "warning",
    suggestion: "Bundle Mozilla's `webextension-polyfill` or feature-detect: `const api = globalThis.browser ?? globalThis.chrome`.",
    autoFix: {
      id: "inject-browser-polyfill",
      label: "Inject browser polyfill shim",
      description: "Adds `lib/browser-polyfill.js` shim that aliases `browser` to `chrome` when missing.",
      writes: ["source"],
    },
  },
  {
    id: "promise-callbacks",
    title: "Callback-style chrome.* APIs",
    category: "api",
    match: (c) => ({ hit: /chrome\.(tabs|storage|runtime|scripting)\.\w+\([^)]*function\s*\(/.test(c.sourceBlob) }),
    support: [
      { browser: "chrome", status: "supported" },
      { browser: "edge", status: "supported" },
      { browser: "brave", status: "supported" },
      { browser: "opera", status: "supported" },
      { browser: "firefox", status: "partial", note: "Firefox prefers promises; callbacks work only for MV3 promise-compat APIs." },
      { browser: "safari", status: "partial" },
    ],
    severity: "info",
    suggestion: "Prefer `await chrome.tabs.query(...)` — Chrome 88+ and all other MV3 browsers support promises.",
  },
  {
    id: "offscreen-api",
    title: "chrome.offscreen API",
    category: "api",
    match: (c) => ({ hit: /chrome\.offscreen\b/.test(c.sourceBlob) }),
    support: [
      { browser: "chrome", status: "supported", note: "Chrome 109+" },
      { browser: "edge", status: "supported" },
      { browser: "brave", status: "supported" },
      { browser: "opera", status: "unknown" },
      { browser: "firefox", status: "unsupported" },
      { browser: "safari", status: "unsupported" },
    ],
    severity: "warning",
  },
  {
    id: "scripting-api",
    title: "chrome.scripting.executeScript",
    category: "api",
    match: (c) => ({ hit: /chrome\.scripting\.(executeScript|insertCSS|removeCSS)\b/.test(c.sourceBlob) }),
    support: ALL_BROWSERS.map((b) => ({ browser: b, status: "supported" as CompatStatus })),
    severity: "info",
  },
  {
    id: "sidebar-action",
    title: "sidebar_action manifest key",
    category: "manifest",
    match: (c) => ({ hit: !!c.manifest?.sidebar_action, location: "sidebar_action" }),
    support: [
      { browser: "chrome", status: "unsupported" },
      { browser: "edge", status: "unsupported" },
      { browser: "brave", status: "unsupported" },
      { browser: "opera", status: "supported" },
      { browser: "firefox", status: "supported" },
      { browser: "safari", status: "unsupported" },
    ],
    severity: "warning",
    suggestion: "Use `side_panel` for Chromium and keep `sidebar_action` for Firefox.",
  },
  {
    id: "applications-key",
    title: "browser_specific_settings (Gecko/Safari IDs)",
    category: "manifest",
    match: (c) => ({ hit: !!c.manifest?.browser_specific_settings, location: "browser_specific_settings" }),
    support: [
      { browser: "chrome", status: "supported", note: "Ignored gracefully." },
      { browser: "edge", status: "supported" },
      { browser: "brave", status: "supported" },
      { browser: "opera", status: "supported" },
      { browser: "firefox", status: "supported" },
      { browser: "safari", status: "supported" },
    ],
    severity: "info",
  },
  {
    id: "missing-gecko-id",
    title: "Missing Firefox extension ID",
    category: "manifest",
    match: (c) => {
      const bss = c.manifest?.browser_specific_settings as { gecko?: { id?: string } } | undefined;
      return { hit: !bss?.gecko?.id, location: "browser_specific_settings.gecko.id" };
    },
    support: [
      { browser: "chrome", status: "supported" },
      { browser: "edge", status: "supported" },
      { browser: "brave", status: "supported" },
      { browser: "opera", status: "supported" },
      { browser: "firefox", status: "partial", note: "Firefox requires an explicit ID for signed distribution." },
      { browser: "safari", status: "supported" },
    ],
    severity: "info",
    suggestion: 'Add `browser_specific_settings.gecko.id` (e.g. "your-ext@yourdomain.com") for Firefox publishing.',
  },
  {
    id: "css-backdrop-filter",
    title: "CSS backdrop-filter (unprefixed)",
    category: "css",
    match: (c) => {
      const hit = /(^|\W)backdrop-filter\s*:/.test(c.cssBlob) && !/-webkit-backdrop-filter\s*:/.test(c.cssBlob);
      return { hit };
    },
    support: [
      { browser: "chrome", status: "supported" },
      { browser: "edge", status: "supported" },
      { browser: "brave", status: "supported" },
      { browser: "opera", status: "supported" },
      { browser: "firefox", status: "supported", note: "FF 103+" },
      { browser: "safari", status: "partial", note: "Requires -webkit-backdrop-filter." },
    ],
    severity: "warning",
    suggestion: "Add `-webkit-backdrop-filter` alongside `backdrop-filter` for Safari.",
  },
  {
    id: "css-has",
    title: "CSS :has() selector",
    category: "css",
    match: (c) => ({ hit: /:has\(/.test(c.cssBlob) }),
    support: [
      { browser: "chrome", status: "supported", note: "105+" },
      { browser: "edge", status: "supported" },
      { browser: "brave", status: "supported" },
      { browser: "opera", status: "supported" },
      { browser: "firefox", status: "supported", note: "121+" },
      { browser: "safari", status: "supported", note: "15.4+" },
    ],
    severity: "info",
  },
];

function collectBlobs(files: Record<string, string>) {
  let source = "";
  let css = "";
  let html = "";
  let count = 0;
  for (const [path, content] of Object.entries(files)) {
    if (typeof content !== "string") continue;
    count++;
    if (/\.(js|mjs|ts|tsx|jsx)$/i.test(path)) source += "\n" + content;
    else if (/\.css$/i.test(path)) css += "\n" + content;
    else if (/\.html?$/i.test(path)) {
      html += "\n" + content;
      source += "\n" + content; // inline scripts
    }
  }
  return { source, css, html, count };
}

export function analyzeBrowserCompatibility(
  manifest: Record<string, unknown> | null,
  files: Record<string, string>
): CompatReport {
  const { source, css, html, count } = collectBlobs(files);
  const ctx: MatchCtx = { manifest, files, sourceBlob: source, cssBlob: css, htmlBlob: html };

  const findings: CompatFinding[] = [];
  for (const rule of RULES) {
    const m = rule.match(ctx);
    if (!m.hit) continue;
    findings.push({
      id: rule.id,
      title: rule.title,
      category: rule.category,
      severity: rule.severity ?? "info",
      location: m.location,
      detail: m.detail ?? deriveDetail(rule),
      support: rule.support,
      suggestion: rule.suggestion,
    });
  }

  // Per-browser scoring
  const browsers: BrowserScore[] = ALL_BROWSERS.map((id) => {
    let errors = 0;
    let warnings = 0;
    let deductions = 0;
    for (const f of findings) {
      const s = f.support.find((x) => x.browser === id);
      if (!s) continue;
      if (s.status === "unsupported") {
        if (f.severity === "error") { errors++; deductions += 25; }
        else { warnings++; deductions += 12; }
      } else if (s.status === "partial") {
        warnings++;
        deductions += 6;
      }
    }
    const score = Math.max(0, 100 - deductions);
    const verdict: BrowserScore["verdict"] =
      errors > 0 ? "blocked" : warnings > 0 ? "review" : "ready";
    return { browser: id, label: BROWSER_LABEL[id], score, errors, warnings, verdict };
  });

  const summary = {
    errors: findings.filter((f) => f.severity === "error").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    infos: findings.filter((f) => f.severity === "info").length,
    checkedFiles: count,
  };

  return { findings, browsers, summary };
}

function deriveDetail(rule: Rule): string {
  const unsupp = rule.support.filter((s) => s.status === "unsupported").map((s) => BROWSER_LABEL[s.browser]);
  const partial = rule.support.filter((s) => s.status === "partial").map((s) => BROWSER_LABEL[s.browser]);
  const parts: string[] = [];
  if (unsupp.length) parts.push(`Not supported in ${unsupp.join(", ")}`);
  if (partial.length) parts.push(`Partial in ${partial.join(", ")}`);
  return parts.join(" · ") || "Cross-browser support varies.";
}

export function compatReportMarkdown(report: CompatReport): string {
  const lines: string[] = ["# Browser Compatibility Report", ""];
  lines.push("## Per-browser summary", "");
  lines.push("| Browser | Score | Errors | Warnings | Verdict |");
  lines.push("|---|---:|---:|---:|---|");
  for (const b of report.browsers) {
    lines.push(`| ${b.label} | ${b.score}/100 | ${b.errors} | ${b.warnings} | ${b.verdict} |`);
  }
  lines.push("", `**Totals** — errors: ${report.summary.errors} · warnings: ${report.summary.warnings} · infos: ${report.summary.infos} · files scanned: ${report.summary.checkedFiles}`, "");
  lines.push("## Findings", "");
  if (!report.findings.length) {
    lines.push("_No compatibility issues detected._");
  }
  for (const f of report.findings) {
    lines.push(`### [${f.severity.toUpperCase()}] ${f.title}`);
    if (f.location) lines.push(`- Location: \`${f.location}\``);
    lines.push(`- Category: ${f.category}`);
    lines.push(`- ${f.detail}`);
    if (f.suggestion) lines.push(`- Suggestion: ${f.suggestion}`);
    lines.push("");
    lines.push("| Browser | Status | Notes |");
    lines.push("|---|---|---|");
    for (const s of f.support) {
      lines.push(`| ${BROWSER_LABEL[s.browser]} | ${s.status} | ${s.note ?? ""} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
