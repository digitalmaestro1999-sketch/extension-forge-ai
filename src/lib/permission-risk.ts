// Permission & Host-Origin Risk Analyzer
// Flags excessive Chrome extension permissions and suggests safer alternatives
// before the bundle is zipped. Pure functions, no DOM/Chrome APIs.

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface PermissionFinding {
  permission: string;
  kind: "permission" | "host" | "optional";
  risk: RiskLevel;
  reason: string;
  suggestion: string;
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
    if (info) findings.push({ permission: p, kind: "permission", ...info });
  }
  for (const p of asArray(m.optional_permissions)) {
    const info = PERMISSION_RISKS[p];
    if (info) {
      // optional permissions are one risk-tier safer.
      const softened: RiskLevel = info.risk === "critical" ? "high" : info.risk === "high" ? "medium" : "low";
      findings.push({
        permission: p,
        kind: "optional",
        risk: softened,
        reason: `${info.reason} (declared optional).`,
        suggestion: info.suggestion,
      });
    }
  }
  const hosts = [...asArray(m.host_permissions), ...asArray(m.optional_host_permissions)];
  for (const h of hosts) {
    const info = analyzeHostPattern(h);
    if (info) findings.push({ permission: h, kind: "host", ...info });
  }
  // Content-script matches are effectively host permissions.
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
