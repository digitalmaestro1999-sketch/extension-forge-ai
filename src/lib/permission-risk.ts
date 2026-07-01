// Permission & Host-Origin Risk Analyzer
// Flags excessive Chrome extension permissions and suggests safer alternatives
// before the bundle is zipped. Pure functions, no DOM/Chrome APIs.

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type AutoFixAction =
  | { type: "remove-permission"; permission: string }
  | { type: "remove-optional"; permission: string }
  | { type: "remove-host"; pattern: string }
  | { type: "replace-permission"; from: string; to: string[] }
  | { type: "move-to-optional"; permission: string }
  | { type: "replace-host"; from: string; to: string }
  | { type: "remove-content-script-match"; pattern: string }
  | { type: "replace-content-script-match"; from: string; to: string };

export interface PermissionFinding {
  permission: string;
  kind: "permission" | "host" | "optional";
  risk: RiskLevel;
  reason: string;
  suggestion: string;
  autoFix?: { label: string; action: AutoFixAction };
}

export interface PermissionRiskReport {
  findings: PermissionFinding[];
  score: number; // 0-100, higher = safer
  highestRisk: RiskLevel;
  totals: Record<RiskLevel, number>;
  summary: string;
}

// Catalog of known-risky permissions with safer alternatives.
const PERMISSION_RISKS: Record<string, { risk: RiskLevel; reason: string; suggestion: string }> = {
  "<all_urls>": {
    risk: "critical",
    reason: "Grants read/write access to every website the user visits.",
    suggestion: "Replace with `activeTab` or list only the exact host patterns you need (e.g. `https://*.github.com/*`).",
  },
  tabs: {
    risk: "medium",
    reason: "Exposes tab URLs, titles and favicons across the whole browser.",
    suggestion: "Prefer `activeTab` — it grants access only when the user clicks your action.",
  },
  history: {
    risk: "high",
    reason: "Full read/write access to browsing history.",
    suggestion: "Use `topSites` if you only need recent sites, or scope to `sessions` for recently closed tabs.",
  },
  bookmarks: {
    risk: "medium",
    reason: "Read + write to the entire bookmarks tree.",
    suggestion: "Only request at runtime via `chrome.permissions.request` when the user opens a bookmarks feature.",
  },
  cookies: {
    risk: "high",
    reason: "Reads cookies (including auth tokens) for any host you have access to.",
    suggestion: "Move to `optional_permissions` and request per-host at runtime.",
  },
  downloads: {
    risk: "medium",
    reason: "Can trigger arbitrary file downloads.",
    suggestion: "Use a data: or blob: URL + `<a download>` in the popup when possible.",
  },
  debugger: {
    risk: "critical",
    reason: "Attaches Chrome DevTools protocol — near-total control of a page.",
    suggestion: "Almost never needed. Use `scripting` + content scripts instead.",
  },
  management: {
    risk: "high",
    reason: "Lists, enables, disables and uninstalls other extensions.",
    suggestion: "Remove unless you build an extension manager.",
  },
  proxy: {
    risk: "high",
    reason: "Controls the browser's network proxy configuration.",
    suggestion: "Remove unless the core feature is proxy management.",
  },
  privacy: {
    risk: "high",
    reason: "Toggles Chrome privacy settings (Safe Browsing, WebRTC, etc.).",
    suggestion: "Remove unless the extension exists to change privacy settings.",
  },
  webRequest: {
    risk: "high",
    reason: "Observes every network request — MV3 discourages this outside enterprise.",
    suggestion: "Use `declarativeNetRequest` — it's faster, private and Web-Store friendly.",
  },
  webRequestBlocking: {
    risk: "critical",
    reason: "Blocks network requests at runtime. Only allowed for enterprise policy extensions.",
    suggestion: "Switch to `declarativeNetRequest` rules — required for Chrome Web Store approval.",
  },
  nativeMessaging: {
    risk: "high",
    reason: "Communicates with native host apps outside the browser sandbox.",
    suggestion: "Remove unless you ship a companion native app.",
  },
  clipboardRead: {
    risk: "medium",
    reason: "Reads the user's clipboard at any time.",
    suggestion: "Use `navigator.clipboard.readText()` inside a user gesture instead.",
  },
  clipboardWrite: {
    risk: "low",
    reason: "Writes to clipboard silently.",
    suggestion: "Use `navigator.clipboard.writeText()` — no permission required in MV3.",
  },
  geolocation: {
    risk: "medium",
    reason: "Reads precise user location.",
    suggestion: "Move to `optional_permissions` and request on demand.",
  },
  identity: {
    risk: "medium",
    reason: "OAuth token access for the signed-in Google account.",
    suggestion: "Fine if used for auth; move to `optional_permissions` if only used occasionally.",
  },
  background: {
    risk: "low",
    reason: "Keeps the extension alive longer than needed — MV3 discourages persistent bg.",
    suggestion: "Rely on the default MV3 service-worker lifecycle instead.",
  },
  unlimitedStorage: {
    risk: "low",
    reason: "Bypasses 10MB storage quota.",
    suggestion: "Only request if you truly cache large blobs; otherwise `storage` is enough.",
  },
  scripting: {
    risk: "medium",
    reason: "Injects arbitrary scripts into pages you have host access to.",
    suggestion: "Fine when scoped — pair it with narrow host patterns, never `<all_urls>`.",
  },
};

// Host-pattern heuristics.
function analyzeHostPattern(pattern: string): { risk: RiskLevel; reason: string; suggestion: string } | null {
  if (pattern === "<all_urls>" || pattern === "*://*/*" || pattern === "http://*/*" || pattern === "https://*/*") {
    return {
      risk: "critical",
      reason: `Host pattern "${pattern}" grants access to every site the user visits.`,
      suggestion: "List only the domains you actually need (e.g. `https://*.example.com/*`) or switch to `activeTab`.",
    };
  }
  // *://*.tld/* patterns — broad but scoped to one TLD.
  if (/^\*:\/\/\*\.[^/]+\/\*$/.test(pattern)) {
    return {
      risk: "medium",
      reason: `Host pattern "${pattern}" matches all subdomains and both http+https.`,
      suggestion: "Restrict to https-only and to the specific subdomains you use.",
    };
  }
  if (pattern.startsWith("http://")) {
    return {
      risk: "medium",
      reason: `Host pattern "${pattern}" allows plaintext HTTP.`,
      suggestion: "Prefer `https://` — Chrome Web Store rejects unnecessary HTTP access.",
    };
  }
  return null;
}

const RISK_WEIGHT: Record<RiskLevel, number> = { low: 2, medium: 8, high: 18, critical: 35 };

export function analyzePermissionRisk(manifest: unknown): PermissionRiskReport {
  const findings: PermissionFinding[] = [];
  const m = (manifest ?? {}) as {
    permissions?: unknown;
    optional_permissions?: unknown;
    host_permissions?: unknown;
    optional_host_permissions?: unknown;
    content_scripts?: Array<{ matches?: unknown }>;
  };

  const asArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

  for (const p of asArray(m.permissions)) {
    const info = PERMISSION_RISKS[p];
    if (info) findings.push({ permission: p, kind: "permission", ...info, autoFix: autoFixForPermission(p) });
  }
  for (const p of asArray(m.optional_permissions)) {
    const info = PERMISSION_RISKS[p];
    if (info) {
      const softened: RiskLevel = info.risk === "critical" ? "high" : info.risk === "high" ? "medium" : "low";
      findings.push({
        permission: p,
        kind: "optional",
        risk: softened,
        reason: `${info.reason} (declared optional).`,
        suggestion: info.suggestion,
        autoFix: { label: `Remove optional "${p}"`, action: { type: "remove-optional", permission: p } },
      });
    }
  }
  const hosts = [...asArray(m.host_permissions), ...asArray(m.optional_host_permissions)];
  for (const h of hosts) {
    const info = analyzeHostPattern(h);
    if (info) findings.push({ permission: h, kind: "host", ...info, autoFix: autoFixForHost(h, false) });
  }
  for (const cs of Array.isArray(m.content_scripts) ? m.content_scripts : []) {
    for (const match of asArray(cs?.matches)) {
      const info = analyzeHostPattern(match);
      if (info) {
        findings.push({
          permission: match,
          kind: "host",
          risk: info.risk,
          reason: `Content-script match: ${info.reason}`,
          suggestion: info.suggestion,
          autoFix: autoFixForHost(match, true),
        });
      }
    }
  }

  const totals: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  let penalty = 0;
  for (const f of findings) {
    totals[f.risk] += 1;
    penalty += RISK_WEIGHT[f.risk];
  }
  const score = Math.max(0, 100 - penalty);
  const highestRisk: RiskLevel =
    totals.critical ? "critical" : totals.high ? "high" : totals.medium ? "medium" : "low";
  const summary = findings.length === 0
    ? "No excessive permissions detected."
    : `${findings.length} risky permission${findings.length === 1 ? "" : "s"} — ${totals.critical} critical, ${totals.high} high, ${totals.medium} medium, ${totals.low} low.`;

  return { findings, score, highestRisk, totals, summary };
}

// ─── Auto-fix suggestions ───────────────────────────────────────────────────

function autoFixForPermission(p: string): PermissionFinding["autoFix"] {
  switch (p) {
    case "<all_urls>":
      return { label: 'Replace with "activeTab"', action: { type: "replace-permission", from: p, to: ["activeTab"] } };
    case "tabs":
      return { label: 'Replace with "activeTab"', action: { type: "replace-permission", from: "tabs", to: ["activeTab"] } };
    case "history":
      return { label: 'Replace with "topSites"', action: { type: "replace-permission", from: "history", to: ["topSites"] } };
    case "webRequest":
    case "webRequestBlocking":
      return { label: 'Replace with "declarativeNetRequest"', action: { type: "replace-permission", from: p, to: ["declarativeNetRequest"] } };
    case "cookies":
    case "geolocation":
    case "identity":
    case "bookmarks":
    case "clipboardRead":
      return { label: `Move "${p}" to optional_permissions`, action: { type: "move-to-optional", permission: p } };
    case "clipboardWrite":
    case "debugger":
    case "management":
    case "proxy":
    case "privacy":
    case "nativeMessaging":
    case "background":
    case "unlimitedStorage":
    case "downloads":
      return { label: `Remove "${p}"`, action: { type: "remove-permission", permission: p } };
    default:
      return undefined;
  }
}

function autoFixForHost(pattern: string, isContentScript: boolean): PermissionFinding["autoFix"] {
  if (pattern === "<all_urls>" || pattern === "*://*/*" || pattern === "http://*/*" || pattern === "https://*/*") {
    return isContentScript
      ? undefined // no safe generic replacement — user must scope manually
      : { label: `Remove overly broad host "${pattern}"`, action: { type: "remove-host", pattern } };
  }
  if (pattern.startsWith("http://")) {
    const httpsPattern = "https://" + pattern.slice("http://".length);
    return isContentScript
      ? { label: `Upgrade to HTTPS (${httpsPattern})`, action: { type: "replace-content-script-match", from: pattern, to: httpsPattern } }
      : { label: `Upgrade to HTTPS (${httpsPattern})`, action: { type: "replace-host", from: pattern, to: httpsPattern } };
  }
  if (/^\*:\/\/\*\.[^/]+\/\*$/.test(pattern)) {
    const httpsPattern = "https://" + pattern.slice(4);
    return isContentScript
      ? { label: `Restrict to HTTPS (${httpsPattern})`, action: { type: "replace-content-script-match", from: pattern, to: httpsPattern } }
      : { label: `Restrict to HTTPS (${httpsPattern})`, action: { type: "replace-host", from: pattern, to: httpsPattern } };
  }
  return undefined;
}

type Manifest = {
  permissions?: string[];
  optional_permissions?: string[];
  host_permissions?: string[];
  optional_host_permissions?: string[];
  content_scripts?: Array<{ matches?: string[]; [k: string]: unknown }>;
  [k: string]: unknown;
};

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

/** Apply a single auto-fix action to a manifest object and return a new object. */
export function applyAutoFix(manifest: unknown, action: AutoFixAction): Manifest {
  const m: Manifest = JSON.parse(JSON.stringify(manifest ?? {}));
  const perms = Array.isArray(m.permissions) ? m.permissions : [];
  const opts = Array.isArray(m.optional_permissions) ? m.optional_permissions : [];
  const hosts = Array.isArray(m.host_permissions) ? m.host_permissions : [];
  const optHosts = Array.isArray(m.optional_host_permissions) ? m.optional_host_permissions : [];

  switch (action.type) {
    case "remove-permission":
      m.permissions = perms.filter((p) => p !== action.permission);
      break;
    case "remove-optional":
      m.optional_permissions = opts.filter((p) => p !== action.permission);
      break;
    case "replace-permission":
      m.permissions = uniq(perms.filter((p) => p !== action.from).concat(action.to));
      break;
    case "move-to-optional":
      m.permissions = perms.filter((p) => p !== action.permission);
      m.optional_permissions = uniq(opts.concat(action.permission));
      break;
    case "remove-host":
      m.host_permissions = hosts.filter((h) => h !== action.pattern);
      m.optional_host_permissions = optHosts.filter((h) => h !== action.pattern);
      break;
    case "replace-host":
      m.host_permissions = uniq(hosts.map((h) => (h === action.from ? action.to : h)));
      m.optional_host_permissions = uniq(optHosts.map((h) => (h === action.from ? action.to : h)));
      break;
    case "remove-content-script-match":
      m.content_scripts = (m.content_scripts ?? []).map((cs) => ({
        ...cs,
        matches: (cs.matches ?? []).filter((x) => x !== action.pattern),
      }));
      break;
    case "replace-content-script-match":
      m.content_scripts = (m.content_scripts ?? []).map((cs) => ({
        ...cs,
        matches: uniq((cs.matches ?? []).map((x) => (x === action.from ? action.to : x))),
      }));
      break;
  }

  // Cleanup empty arrays for tidiness.
  for (const k of ["permissions", "optional_permissions", "host_permissions", "optional_host_permissions"] as const) {
    if (Array.isArray(m[k]) && (m[k] as string[]).length === 0) delete m[k];
  }
  return m;
}

// ─── Auto-fix safety checks ─────────────────────────────────────────────────
// Some auto-fixes are technically valid but functionally destructive — e.g.
// removing `webRequest` when a background script actually calls
// `chrome.webRequest.*`, or dropping the last `matches` on a content script.
// `checkAutoFixSafety` inspects a proposed action against the current manifest
// (and optional source files) and returns issues so the UI can warn before we
// mutate the bundle.

export type SafetySeverity = "block" | "warn" | "info";
export interface SafetyIssue { severity: SafetySeverity; message: string }
export interface SafetyCheckResult { safe: boolean; issues: SafetyIssue[] }

const SAFE_TO_REMOVE = new Set(["background", "unlimitedStorage", "clipboardWrite"]);

const API_SURFACE: Record<string, RegExp> = {
  tabs: /\bchrome\.tabs\.(query|update|create|remove|sendMessage|onUpdated|onActivated)\b/,
  history: /\bchrome\.history\.\w+/,
  bookmarks: /\bchrome\.bookmarks\.\w+/,
  cookies: /\bchrome\.cookies\.\w+/,
  downloads: /\bchrome\.downloads\.\w+/,
  debugger: /\bchrome\.debugger\.\w+/,
  management: /\bchrome\.management\.\w+/,
  proxy: /\bchrome\.proxy\.\w+/,
  privacy: /\bchrome\.privacy\.\w+/,
  webRequest: /\bchrome\.webRequest\.\w+/,
  webRequestBlocking: /\bchrome\.webRequest\.\w+/,
  nativeMessaging: /\bchrome\.runtime\.(connectNative|sendNativeMessage)\b/,
  clipboardRead: /\bnavigator\.clipboard\.readText\b/,
  geolocation: /\bnavigator\.geolocation\.\w+/,
  identity: /\bchrome\.identity\.\w+/,
  scripting: /\bchrome\.scripting\.\w+/,
};

function scanForApi(files: Record<string, string> | undefined, re: RegExp): string[] {
  if (!files) return [];
  const hits: string[] = [];
  for (const [name, content] of Object.entries(files)) {
    if (!/\.(js|mjs|ts|html)$/i.test(name)) continue;
    if (typeof content === "string" && re.test(content)) hits.push(name);
  }
  return hits;
}

export function checkAutoFixSafety(
  manifest: unknown,
  action: AutoFixAction,
  files?: Record<string, string>,
): SafetyCheckResult {
  const m = (manifest ?? {}) as Manifest;
  const issues: SafetyIssue[] = [];
  const usedBy = (perm: string): string[] => {
    const re = API_SURFACE[perm];
    return re ? scanForApi(files, re) : [];
  };

  switch (action.type) {
    case "remove-permission": {
      const used = usedBy(action.permission);
      if (used.length) {
        issues.push({ severity: "block", message: `"${action.permission}" is used by ${used.join(", ")} — removing it will break the extension at runtime.` });
      } else if (!SAFE_TO_REMOVE.has(action.permission)) {
        issues.push({ severity: "warn", message: `Removing "${action.permission}" — verify no feature depends on it.` });
      }
      break;
    }
    case "move-to-optional": {
      const used = usedBy(action.permission);
      if (used.length) {
        issues.push({ severity: "warn", message: `"${action.permission}" is called in ${used.join(", ")}. Wrap those calls in a chrome.permissions.request() flow before shipping.` });
      }
      break;
    }
    case "replace-permission": {
      const used = usedBy(action.from);
      if (used.length) {
        issues.push({ severity: "warn", message: `"${action.from}" is used by ${used.join(", ")} — you must migrate calls to ${action.to.join(", ")}.` });
      }
      break;
    }
    case "remove-host": {
      const remaining = (m.host_permissions ?? []).filter((h) => h !== action.pattern);
      const remainingOpt = (m.optional_host_permissions ?? []).filter((h) => h !== action.pattern);
      const hasCs = Array.isArray(m.content_scripts) && m.content_scripts.length > 0;
      if (!remaining.length && !remainingOpt.length && hasCs) {
        issues.push({ severity: "warn", message: "This is the last host pattern — background fetch/XHR will lose cross-origin access." });
      }
      break;
    }
    case "remove-content-script-match": {
      const others = (m.content_scripts ?? []).some((cs) => (cs.matches ?? []).some((x) => x !== action.pattern));
      if (!others) {
        issues.push({ severity: "block", message: "Removing this match would leave the content script with no `matches` — Chrome rejects the manifest." });
      }
      break;
    }
    case "replace-host":
    case "replace-content-script-match": {
      if (action.from.startsWith("http://") && !action.to.startsWith("https://")) {
        issues.push({ severity: "warn", message: "Replacement is not HTTPS — double-check the target." });
      }
      break;
    }
    case "remove-optional":
      break;
  }
  return { safe: !issues.some((i) => i.severity === "block"), issues };
}

/** Apply every auto-fixable finding in a report. When `opts.files` is given,
 *  each fix is safety-checked; blocking issues abort that fix unless `force`.
 *  Returns applied labels and any skipped fixes with their safety issues. */
export function applyAllAutoFixes(
  manifest: unknown,
  report: PermissionRiskReport,
  opts?: { files?: Record<string, string>; force?: boolean },
): {
  manifest: Manifest;
  applied: string[];
  skipped: Array<{ label: string; issues: SafetyIssue[] }>;
} {
  let current: Manifest = JSON.parse(JSON.stringify(manifest ?? {}));
  const applied: string[] = [];
  const skipped: Array<{ label: string; issues: SafetyIssue[] }> = [];
  for (const f of report.findings) {
    if (!f.autoFix) continue;
    const safety = checkAutoFixSafety(current, f.autoFix.action, opts?.files);
    if (!safety.safe && !opts?.force) {
      skipped.push({ label: f.autoFix.label, issues: safety.issues });
      continue;
    }
    current = applyAutoFix(current, f.autoFix.action);
    applied.push(f.autoFix.label);
  }
  return { manifest: current, applied, skipped };
}
