// Chrome Web Store policy compliance checks.
// Mirrors the official Program Policies surface so we can flag risky
// submissions before they reach review. Pure functions, no Chrome APIs.
// https://developer.chrome.com/docs/webstore/program-policies

import { HARDENED_EXTENSION_CSP, validateExtensionCsp } from "./extension-csp";

export type PolicySeverity = "error" | "warning" | "info";

// What kind of fix can the UI apply automatically?
//  - "deterministic": handled in TS without an AI call (trim, inject CSP, ...).
//  - "ai":            requires a small AI rewrite (e.g. justification text).
//  - undefined:       no auto-fix available, user must edit manually.
export type AutoFixMode = "deterministic" | "ai";

export interface AutoFixSpec {
  mode: AutoFixMode;
  kind: string;                // discriminator used by the applier
  target: "listing" | "manifest" | "files";
  field?: string;              // field on the listing or manifest
  permission?: string;         // for per-permission fixes
}

export interface PolicyCheck {
  id: string;
  label: string;
  severity: PolicySeverity;
  passed: boolean;
  policy: string;
  detail?: string;
  fix?: string;
  autoFix?: AutoFixSpec;
}

export interface PolicyReport {
  checks: PolicyCheck[];
  errors: number;
  warnings: number;
  storeReady: boolean;
  score: number;
}

// Permissions that REQUIRE explicit justification in the store listing.
const SENSITIVE_PERMISSIONS = new Set([
  "tabs", "history", "bookmarks", "cookies", "downloads", "geolocation",
  "management", "nativeMessaging", "pageCapture", "privacy", "proxy",
  "tabCapture", "topSites", "webNavigation", "webRequest", "unlimitedStorage",
  "<all_urls>", "*://*/*", "http://*/*", "https://*/*",
]);

// MV3 forbids these except for force-installed enterprise extensions.
const MV3_BANNED_PERMISSIONS = new Set(["webRequestBlocking"]);

const TRADEMARK_TERMS = [
  "google", "chrome", "youtube", "gmail", "facebook", "instagram",
  "twitter", "x.com", "tiktok", "amazon", "microsoft", "apple",
  "netflix", "spotify", "discord", "whatsapp",
];

const SUPERLATIVE_TERMS = [
  "best ever", "#1", "number one", "guaranteed", "free money",
  "miracle", "secret", "hack", "cheat",
];

function getString(o: any, key: string): string {
  const v = o?.[key];
  return typeof v === "string" ? v : "";
}

function parseManifest(files: Record<string, string>): any | null {
  const raw = files["manifest.json"];
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export interface PolicyInputs {
  files: Record<string, string>;
  listing?: {
    title?: string;
    summary?: string;
    description?: string;
    privacyPolicyUrl?: string;
    homepageUrl?: string;
    category?: string;
    singlePurpose?: string;
    permissionJustifications?: Record<string, string>;
  };
}

export function runPolicyCheck(input: PolicyInputs): PolicyReport {
  const { files, listing = {} } = input;
  const manifest = parseManifest(files);
  const checks: PolicyCheck[] = [];
  const push = (c: PolicyCheck) => checks.push(c);

  // -------- Manifest / metadata basics ----------------------------------
  push({
    id: "mv3",
    label: "Manifest V3",
    severity: "error",
    passed: manifest?.manifest_version === 3,
    policy: "Required: only Manifest V3 is accepted for new uploads.",
    fix: "Set \"manifest_version\": 3 in manifest.json.",
    autoFix: { mode: "deterministic", kind: "set-mv3", target: "manifest" },
  });

  const name = getString(manifest, "name");
  push({
    id: "name-length",
    label: "Extension name length",
    severity: "error",
    passed: name.length >= 3 && name.length <= 75,
    policy: "Name must be 3-75 characters.",
    detail: `Current: ${name.length} chars`,
    fix: "Edit manifest.json `name` to 3-75 characters.",
    autoFix: name.length > 75
      ? { mode: "deterministic", kind: "trim-manifest-name", target: "manifest" }
      : { mode: "ai", kind: "rewrite-manifest-name", target: "manifest" },
  });

  const desc = getString(manifest, "description");
  push({
    id: "desc-length",
    label: "Manifest description length",
    severity: "error",
    passed: desc.length >= 25 && desc.length <= 132,
    policy: "manifest.description: 25-132 characters.",
    detail: `Current: ${desc.length} chars`,
    fix: "Edit manifest.json `description` to 25-132 characters.",
    autoFix: { mode: "ai", kind: "rewrite-manifest-description", target: "manifest" },
  });

  const versionStr = getString(manifest, "version");
  push({
    id: "version-format",
    label: "Version format",
    severity: "error",
    passed: /^\d+(\.\d+){0,3}$/.test(versionStr),
    policy: "Version: 1-4 dot-separated integers (e.g. 1.0.0).",
    fix: "Set a valid `version` like \"1.0.0\" in manifest.json.",
    autoFix: { mode: "deterministic", kind: "normalize-version", target: "manifest" },
  });

  // -------- Icons -------------------------------------------------------
  const icons = manifest?.icons ?? {};
  push({
    id: "icons-complete",
    label: "Icons 16/48/128 present",
    severity: "error",
    passed: !!icons["16"] && !!icons["48"] && !!icons["128"],
    policy: "Required icon sizes: 16, 48, 128.",
    fix: "Use the AI Icon Generator on /package to produce all three sizes.",
    autoFix: { mode: "deterministic", kind: "fill-icon-sizes", target: "manifest" },
  });

  // -------- Hardened CSP (mirrors package-qa) ---------------------------
  const cspValid = validateExtensionCsp(manifest?.content_security_policy);
  push({
    id: "csp-hardened",
    label: "Hardened CSP declared",
    severity: "error",
    passed: cspValid,
    policy: "Remote Code Policy: ship a hardened CSP that bans remote scripts and framing.",
    detail: cspValid ? undefined : "Missing or weak content_security_policy",
    fix: `Set content_security_policy.extension_pages to "${HARDENED_EXTENSION_CSP}".`,
    autoFix: { mode: "deterministic", kind: "inject-hardened-csp", target: "manifest" },
  });

  // -------- update_url is banned for store-uploaded items ---------------
  push({
    id: "no-update-url",
    label: "No self-hosted update_url",
    severity: "error",
    passed: !manifest?.update_url,
    policy: "Items uploaded to the Chrome Web Store must NOT declare a custom update_url.",
    fix: "Remove `update_url` from manifest.json.",
    autoFix: { mode: "deterministic", kind: "remove-update-url", target: "manifest" },
  });

  // -------- MV3 banned permissions --------------------------------------
  const perms: string[] = [
    ...(manifest?.permissions ?? []),
    ...(manifest?.host_permissions ?? []),
  ];
  const banned = perms.filter((p) => MV3_BANNED_PERMISSIONS.has(p));
  push({
    id: "mv3-banned-perms",
    label: "No MV3-banned permissions",
    severity: "error",
    passed: banned.length === 0,
    policy: "webRequestBlocking and other MV2-only APIs are rejected in MV3.",
    detail: banned.length ? `Found: ${banned.join(", ")}` : undefined,
    fix: "Switch to declarativeNetRequest.",
    autoFix: { mode: "deterministic", kind: "drop-banned-perms", target: "manifest" },
  });

  // -------- Default locale consistency ----------------------------------
  const usesMsg = `${name} ${desc}`.includes("__MSG_") ||
    Object.keys(files).some((k) => k.startsWith("_locales/"));
  if (usesMsg) {
    push({
      id: "default-locale",
      label: "default_locale set when using _locales",
      severity: "error",
      passed: !!manifest?.default_locale,
      policy: "If _locales is used or __MSG_ placeholders appear, manifest.default_locale is required.",
      fix: "Set default_locale to e.g. \"en\".",
      autoFix: { mode: "deterministic", kind: "set-default-locale", target: "manifest" },
    });
  }

  // -------- web_accessible_resources scope ------------------------------
  const war = manifest?.web_accessible_resources ?? [];
  const warBroad = Array.isArray(war) && war.some((entry: any) =>
    Array.isArray(entry?.matches) && entry.matches.some((m: string) =>
      m === "<all_urls>" || m === "*://*/*",
    ),
  );
  push({
    id: "war-scope",
    label: "Web-accessible resources scoped",
    severity: "warning",
    passed: !warBroad,
    policy: "web_accessible_resources matches should be limited to origins that actually need them.",
    fix: "Replace <all_urls> with the specific origins your resources are used on.",
    autoFix: warBroad
      ? { mode: "deterministic", kind: "tighten-war", target: "manifest" }
      : undefined,
  });

  // -------- externally_connectable wildcard -----------------------------
  const ec = manifest?.externally_connectable;
  const ecWild = Array.isArray(ec?.matches) && ec.matches.includes("*://*/*");
  push({
    id: "ec-wildcard",
    label: "externally_connectable not wildcard",
    severity: "warning",
    passed: !ecWild,
    policy: "externally_connectable should not accept messages from all origins.",
    fix: "List specific origins under externally_connectable.matches.",
  });

  // -------- action default_title ----------------------------------------
  if (manifest?.action) {
    push({
      id: "action-title",
      label: "Action tooltip set",
      severity: "info",
      passed: !!manifest.action.default_title,
      policy: "Provide an action.default_title so the toolbar icon has an accessible label.",
      fix: "Set action.default_title in manifest.json.",
      autoFix: { mode: "deterministic", kind: "set-action-title", target: "manifest" },
    });
  }

  // -------- Store listing requirements ----------------------------------
  const title = listing.title?.trim() ?? "";
  push({
    id: "listing-title",
    label: "Store title (≤45 chars)",
    severity: title ? "error" : "warning",
    passed: title.length > 0 && title.length <= 45,
    policy: "Store listing title: required, max 45 characters.",
    detail: title ? `${title.length} chars` : "Not generated yet",
    fix: "Click 'Auto-Generate Listing' or paste a title under 45 chars.",
    autoFix: title.length > 45
      ? { mode: "deterministic", kind: "trim-listing", target: "listing", field: "title" }
      : { mode: "ai", kind: "rewrite-listing", target: "listing", field: "title" },
  });

  const summary = listing.summary?.trim() ?? "";
  push({
    id: "listing-summary",
    label: "Short summary (≤132 chars)",
    severity: summary ? "error" : "warning",
    passed: summary.length > 0 && summary.length <= 132,
    policy: "Short summary: required, max 132 characters.",
    detail: summary ? `${summary.length} chars` : "Not generated yet",
    fix: "Click 'Auto-Generate Listing' or write a summary under 132 chars.",
    autoFix: summary.length > 132
      ? { mode: "deterministic", kind: "trim-listing", target: "listing", field: "summary" }
      : { mode: "ai", kind: "rewrite-listing", target: "listing", field: "summary" },
  });

  const longDesc = listing.description?.trim() ?? "";
  push({
    id: "listing-description",
    label: "Detailed description (≥100 chars)",
    severity: "warning",
    passed: longDesc.length >= 100 && longDesc.length <= 16000,
    policy: "Detailed description: recommended ≥100 chars, hard cap 16,000.",
    detail: longDesc ? `${longDesc.length} chars` : "Not generated yet",
    fix: "Auto-generate a description that explains features and value clearly.",
    autoFix: { mode: "ai", kind: "rewrite-listing", target: "listing", field: "description" },
  });

  push({
    id: "single-purpose",
    label: "Single Purpose declared",
    severity: "error",
    passed: !!(listing.singlePurpose && listing.singlePurpose.trim().length >= 10),
    policy: "Single Purpose Policy: every extension must state a narrow, easily understood purpose.",
    fix: "Write one sentence describing the single purpose of the extension.",
    autoFix: { mode: "ai", kind: "rewrite-listing", target: "listing", field: "singlePurpose" },
  });

  push({
    id: "category",
    label: "Category selected",
    severity: "warning",
    passed: !!listing.category,
    policy: "A primary category is required during submission.",
    fix: "Pick a category (Productivity, Developer Tools, etc.).",
    autoFix: { mode: "ai", kind: "pick-category", target: "listing", field: "category" },
  });

  // -------- Permissions justification -----------------------------------
  const sensitiveUsed = perms.filter((p) => SENSITIVE_PERMISSIONS.has(p));
  const justified = listing.permissionJustifications ?? {};
  const missingJust = sensitiveUsed.filter(
    (p) => !justified[p] || justified[p].trim().length < 15,
  );

  // One bulk row + per-permission rows so each has its own AI Apply button.
  push({
    id: "perm-justifications",
    label: "Sensitive permissions justified",
    severity: sensitiveUsed.length ? "error" : "info",
    passed: missingJust.length === 0,
    policy: "Minimum Permissions: every sensitive permission needs a justification in the listing.",
    detail: sensitiveUsed.length
      ? `${sensitiveUsed.length} sensitive permission(s); ${missingJust.length} unjustified`
      : "No sensitive permissions used",
    fix: missingJust.length
      ? `Add 15+ char justifications for: ${missingJust.join(", ")}`
      : undefined,
    autoFix: missingJust.length
      ? { mode: "ai", kind: "rewrite-all-justifications", target: "listing" }
      : undefined,
  });
  for (const p of missingJust) {
    push({
      id: `perm-just-${p}`,
      label: `Justification: ${p}`,
      severity: "error",
      passed: false,
      policy: "Each sensitive permission needs an individual ≥15-char justification.",
      detail: `Permission "${p}" has no justification`,
      fix: `Explain in 1-2 sentences why "${p}" is required.`,
      autoFix: { mode: "ai", kind: "rewrite-justification", target: "listing", permission: p },
    });
  }

  push({
    id: "broad-host",
    label: "Broad host access",
    severity: "warning",
    passed: !perms.some((p) => p === "<all_urls>" || p === "*://*/*"),
    policy: "Broadest hosts trigger deeper review and may be rejected as over-broad.",
    fix: "Replace <all_urls> with specific origins your extension actually needs.",
    autoFix: { mode: "deterministic", kind: "remove-broad-host", target: "manifest" },
  });

  // -------- Privacy policy ----------------------------------------------
  const filesText = Object.values(files).filter((c) => typeof c === "string").join("\n");
  const collectsData =
    perms.includes("identity") ||
    perms.includes("history") ||
    perms.includes("cookies") ||
    perms.includes("tabs") ||
    perms.some((p) => p === "<all_urls>" || p.startsWith("http")) ||
    /fetch\(|XMLHttpRequest|sendBeacon/.test(filesText);

  push({
    id: "privacy-policy",
    label: "Privacy policy URL",
    severity: collectsData ? "error" : "warning",
    passed: !!(listing.privacyPolicyUrl && /^https:\/\//.test(listing.privacyPolicyUrl)),
    policy: "User Data Policy: any extension handling user data must publish a privacy policy URL (HTTPS).",
    detail: collectsData ? "Extension appears to handle user/network data" : "Recommended for all extensions",
    fix: "Host the generated privacy policy on a public HTTPS URL and paste it here.",
  });

  push({
    id: "homepage-url",
    label: "Homepage URL set",
    severity: "info",
    passed: !!listing.homepageUrl,
    policy: "A homepage URL boosts trust and is shown in the listing footer.",
    fix: "Add an HTTPS homepage URL.",
  });

  // -------- Deceptive / trademark / spam --------------------------------
  const haystack = `${name} ${title} ${summary} ${longDesc}`.toLowerCase();
  const tmHit = TRADEMARK_TERMS.find(
    (t) => new RegExp(`\\b${t}\\b`, "i").test(haystack) &&
           !haystack.includes(`for ${t}`) && !haystack.includes(`with ${t}`),
  );
  push({
    id: "trademark",
    label: "Trademark usage",
    severity: "warning",
    passed: !tmHit,
    policy: "Impersonation/Trademark: don't lead the name with another brand. Use 'for X' or 'with X' patterns.",
    detail: tmHit ? `Possible trademark conflict: "${tmHit}"` : undefined,
    fix: tmHit ? `Rephrase to "[Your Brand] for ${tmHit}" or remove the term.` : undefined,
    autoFix: tmHit
      ? { mode: "ai", kind: "rewrite-listing", target: "listing", field: "title" }
      : undefined,
  });

  const superlativeHit = SUPERLATIVE_TERMS.find((s) => haystack.includes(s));
  push({
    id: "deceptive-claims",
    label: "No deceptive claims",
    severity: "warning",
    passed: !superlativeHit,
    policy: "Deceptive Behavior: avoid superlatives ('#1', 'guaranteed') and click-bait phrasing.",
    detail: superlativeHit ? `Flagged phrase: "${superlativeHit}"` : undefined,
    fix: superlativeHit ? "Rewrite without unverifiable superlatives." : undefined,
    autoFix: superlativeHit
      ? { mode: "ai", kind: "rewrite-listing", target: "listing", field: "summary" }
      : undefined,
  });

  push({
    id: "keyword-stuffing",
    label: "No keyword stuffing",
    severity: "warning",
    passed: !/(.{4,30})\1{3,}/i.test(`${title} ${summary}`),
    policy: "Spam: repeating the same phrase 4+ times in metadata is treated as keyword stuffing.",
    fix: "Use synonyms and natural phrasing instead of repeating keywords.",
    autoFix: { mode: "ai", kind: "rewrite-listing", target: "listing", field: "summary" },
  });

  // -------- Code: no remote scripts (mirrors QA but tracked here too) ---
  const html = Object.entries(files)
    .filter(([k]) => k.endsWith(".html"))
    .map(([, v]) => v)
    .join("\n");
  push({
    id: "no-remote-code",
    label: "No remotely hosted code",
    severity: "error",
    passed: !/<script\b[^>]*\bsrc\s*=\s*["'](https?:)?\/\//i.test(html),
    policy: "Remote Code Policy: all executed JS/WASM must ship inside the package.",
    fix: "Replace <script src='https://…'> with a local bundled file.",
    autoFix: { mode: "deterministic", kind: "strip-remote-scripts", target: "files" },
  });

  // -------- eval / new Function in extension code -----------------------
  push({
    id: "no-eval",
    label: "No eval / new Function",
    severity: "error",
    passed: !/\beval\s*\(|new\s+Function\s*\(/.test(filesText),
    policy: "Remote Code Policy: dynamic code evaluation is forbidden in extension pages.",
    fix: "Refactor eval()/new Function() usage to static code.",
  });

  // -------- Scoring -----------------------------------------------------
  const errors = checks.filter((c) => !c.passed && c.severity === "error").length;
  const warnings = checks.filter((c) => !c.passed && c.severity === "warning").length;
  const passed = checks.filter((c) => c.passed).length;
  const score = Math.round((passed / checks.length) * 100);

  return { checks, errors, warnings, storeReady: errors === 0, score };
}
