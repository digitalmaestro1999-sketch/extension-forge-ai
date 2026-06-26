// Chrome Web Store policy compliance checks.
// Mirrors the official Program Policies surface so we can flag risky
// submissions before they reach review. Pure functions, no Chrome APIs.
// https://developer.chrome.com/docs/webstore/program-policies

export type PolicySeverity = "error" | "warning" | "info";

export interface PolicyCheck {
  id: string;
  label: string;
  severity: PolicySeverity;
  passed: boolean;
  policy: string; // CWS policy section reference
  detail?: string;
  fix?: string;
}

export interface PolicyReport {
  checks: PolicyCheck[];
  errors: number;
  warnings: number;
  storeReady: boolean; // zero errors
  score: number;       // 0-100
}

// Permissions that REQUIRE explicit justification in the store listing.
const SENSITIVE_PERMISSIONS = new Set([
  "tabs", "history", "bookmarks", "cookies", "downloads", "geolocation",
  "management", "nativeMessaging", "pageCapture", "privacy", "proxy",
  "tabCapture", "topSites", "webNavigation", "webRequest",
  "<all_urls>", "*://*/*", "http://*/*", "https://*/*",
]);

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
  });

  push({
    id: "version-format",
    label: "Version format",
    severity: "error",
    passed: /^\d+(\.\d+){0,3}$/.test(getString(manifest, "version")),
    policy: "Version: 1-4 dot-separated integers (e.g. 1.0.0).",
    fix: "Set a valid `version` like \"1.0.0\" in manifest.json.",
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
  });

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
  });

  const longDesc = listing.description?.trim() ?? "";
  push({
    id: "listing-description",
    label: "Detailed description (≥100 chars)",
    severity: longDesc ? "warning" : "warning",
    passed: longDesc.length >= 100 && longDesc.length <= 16000,
    policy: "Detailed description: recommended ≥100 chars, hard cap 16,000.",
    detail: longDesc ? `${longDesc.length} chars` : "Not generated yet",
    fix: "Auto-generate a description that explains features and value clearly.",
  });

  push({
    id: "single-purpose",
    label: "Single Purpose declared",
    severity: "error",
    passed: !!(listing.singlePurpose && listing.singlePurpose.trim().length >= 10),
    policy: "Single Purpose Policy: every extension must state a narrow, easily understood purpose.",
    fix: "Write one sentence describing the single purpose of the extension.",
  });

  push({
    id: "category",
    label: "Category selected",
    severity: "warning",
    passed: !!listing.category,
    policy: "A primary category is required during submission.",
    fix: "Pick a category (Productivity, Developer Tools, etc.).",
  });

  // -------- Permissions justification -----------------------------------
  const perms: string[] = [
    ...(manifest?.permissions ?? []),
    ...(manifest?.host_permissions ?? []),
  ];
  const sensitiveUsed = perms.filter((p) => SENSITIVE_PERMISSIONS.has(p));
  const justified = listing.permissionJustifications ?? {};
  const missingJust = sensitiveUsed.filter(
    (p) => !justified[p] || justified[p].trim().length < 15,
  );
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
  });

  push({
    id: "broad-host",
    label: "Broad host access",
    severity: "warning",
    passed: !perms.some((p) => p === "<all_urls>" || p === "*://*/*"),
    policy: "Broadest hosts trigger deeper review and may be rejected as over-broad.",
    fix: "Replace <all_urls> with specific origins your extension actually needs.",
  });

  // -------- Privacy policy ----------------------------------------------
  const collectsData =
    perms.includes("identity") ||
    perms.includes("history") ||
    perms.includes("cookies") ||
    perms.includes("tabs") ||
    perms.some((p) => p === "<all_urls>" || p.startsWith("http")) ||
    /fetch\(|XMLHttpRequest|sendBeacon/.test(
      Object.values(files).filter((c) => typeof c === "string").join("\n"),
    );

  push({
    id: "privacy-policy",
    label: "Privacy policy URL",
    severity: collectsData ? "error" : "warning",
    passed: !!(listing.privacyPolicyUrl && /^https:\/\//.test(listing.privacyPolicyUrl)),
    policy: "User Data Policy: any extension handling user data must publish a privacy policy URL (HTTPS).",
    detail: collectsData ? "Extension appears to handle user/network data" : "Recommended for all extensions",
    fix: "Host the generated privacy policy on a public HTTPS URL and paste it here.",
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
  });

  push({
    id: "keyword-stuffing",
    label: "No keyword stuffing",
    severity: "warning",
    passed: !/(.{4,30})\1{3,}/i.test(`${title} ${summary}`),
    policy: "Spam: repeating the same phrase 4+ times in metadata is treated as keyword stuffing.",
    fix: "Use synonyms and natural phrasing instead of repeating keywords.",
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
  });

  // -------- Scoring -----------------------------------------------------
  const errors = checks.filter((c) => !c.passed && c.severity === "error").length;
  const warnings = checks.filter((c) => !c.passed && c.severity === "warning").length;
  const passed = checks.filter((c) => c.passed).length;
  const score = Math.round((passed / checks.length) * 100);

  return { checks, errors, warnings, storeReady: errors === 0, score };
}
