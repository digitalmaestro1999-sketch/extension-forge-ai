// Packaging QA — validates a generated Chrome extension bundle against MV3 requirements
// before the user downloads it. Pure functions, no DOM/Chrome APIs.

import { getExtensionPageCsp, hasHardenedExtensionCsp } from "./extension-csp";

export type QASeverity = "error" | "warning" | "info";

export interface QACheck {
  id: string;
  label: string;
  severity: QASeverity;
  passed: boolean;
  detail?: string;
}

export interface QAReport {
  checks: QACheck[];
  errors: number;
  warnings: number;
  chromeReady: boolean; // true when zero errors
}

// MV3 known-valid permissions (subset covering everything our generator emits).
const KNOWN_PERMISSIONS = new Set([
  "activeTab", "alarms", "background", "bookmarks", "browsingData", "clipboardRead",
  "clipboardWrite", "contextMenus", "cookies", "debugger", "declarativeContent",
  "declarativeNetRequest", "declarativeNetRequestFeedback", "downloads", "fontSettings",
  "gcm", "geolocation", "history", "identity", "idle", "management", "nativeMessaging",
  "notifications", "offscreen", "pageCapture", "power", "printerProvider", "privacy",
  "processes", "proxy", "scripting", "search", "sessions", "sidePanel", "storage",
  "system.cpu", "system.display", "system.memory", "system.storage", "tabCapture",
  "tabGroups", "tabs", "topSites", "tts", "ttsEngine", "unlimitedStorage", "vpnProvider",
  "wallpaper", "webNavigation", "webRequest", "webRequestBlocking",
]);

const REMOTE_SCRIPT_RE = /<script\b[^>]*\bsrc\s*=\s*["'](https?:)?\/\//i;
const INLINE_SCRIPT_RE = /<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i;
const REMOTE_CSS_RE = /<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*\bhref\s*=\s*["'](https?:)?\/\//i;

function parseManifest(files: Record<string, string>): { manifest: any | null; raw: string | null; error: string | null } {
  const raw = files["manifest.json"];
  if (!raw) return { manifest: null, raw: null, error: "manifest.json is missing" };
  try {
    return { manifest: JSON.parse(raw), raw, error: null };
  } catch (e) {
    return { manifest: null, raw, error: (e as Error).message };
  }
}

export function runPackageQA(files: Record<string, string>): QAReport {
  const checks: QACheck[] = [];
  const push = (c: QACheck) => checks.push(c);

  const { manifest, error: manifestErr } = parseManifest(files);

  // 1. Manifest exists and parses
  push({
    id: "manifest-valid",
    label: "manifest.json is valid JSON",
    severity: "error",
    passed: !!manifest,
    detail: manifestErr ?? undefined,
  });

  if (!manifest) {
    return finalize(checks);
  }

  // 2. Manifest V3
  push({
    id: "manifest-v3",
    label: "Manifest V3 (Chrome Web Store requirement)",
    severity: "error",
    passed: manifest.manifest_version === 3,
    detail: manifest.manifest_version !== 3 ? `Found manifest_version=${manifest.manifest_version}` : undefined,
  });

  // 3. Required metadata
  push({
    id: "name-version",
    label: "Has name, version, and description",
    severity: "error",
    passed: !!manifest.name && !!manifest.version && !!manifest.description,
  });

  // 4. Version format (X.Y.Z numeric)
  const versionOk = typeof manifest.version === "string" && /^\d+(\.\d+){0,3}$/.test(manifest.version);
  push({
    id: "version-format",
    label: "Version is a valid dotted number (e.g. 1.0.0)",
    severity: "error",
    passed: versionOk,
    detail: !versionOk ? `Got "${manifest.version}"` : undefined,
  });

  // 5. Explicit hardened CSP for extension pages
  const cspString = getExtensionPageCsp(manifest);
  const cspOk = hasHardenedExtensionCsp(manifest);
  push({
    id: "csp-hardened",
    label: "Explicit hardened content_security_policy is present",
    severity: "error",
    passed: cspOk,
    detail: cspOk
      ? undefined
      : cspString
      ? "CSP exists but is missing one or more required directives"
      : "Missing content_security_policy.extension_pages",
  });

  // 6. Icons present in zip
  const declaredIcons: string[] = [
    ...Object.values(manifest.icons ?? {}),
    ...Object.values(manifest.action?.default_icon ?? {}),
  ].filter((v): v is string => typeof v === "string");
  const missingIcons = declaredIcons.filter(p => !files[p]);
  push({
    id: "icons-exist",
    label: "All referenced icons exist in the package",
    severity: "error",
    passed: missingIcons.length === 0,
    detail: missingIcons.length ? `Missing: ${missingIcons.join(", ")}` : undefined,
  });

  // 7. Service worker file exists
  const sw = manifest.background?.service_worker;
  push({
    id: "service-worker",
    label: "Background service worker file exists",
    severity: "error",
    passed: !sw || !!files[sw],
    detail: sw && !files[sw] ? `${sw} declared but not found` : undefined,
  });

  // 8. Popup file exists
  const popup = manifest.action?.default_popup;
  push({
    id: "popup-exists",
    label: "Popup HTML file exists",
    severity: "error",
    passed: !popup || !!files[popup],
    detail: popup && !files[popup] ? `${popup} declared but not found` : undefined,
  });

  // 9. Options page exists
  const options = manifest.options_page || manifest.options_ui?.page;
  push({
    id: "options-exists",
    label: "Options page exists (if declared)",
    severity: "warning",
    passed: !options || !!files[options],
    detail: options && !files[options] ? `${options} declared but not found` : undefined,
  });

  // 10. Content script files exist
  const csFiles: string[] = (manifest.content_scripts ?? []).flatMap((cs: any) => [
    ...(cs.js ?? []),
    ...(cs.css ?? []),
  ]);
  const missingCs = csFiles.filter(p => !files[p]);
  push({
    id: "content-scripts",
    label: "Content script files exist",
    severity: "error",
    passed: missingCs.length === 0,
    detail: missingCs.length ? `Missing: ${missingCs.join(", ")}` : undefined,
  });

  // 11. Permissions all known to Chrome
  const perms: string[] = manifest.permissions ?? [];
  const unknownPerms = perms.filter(p => !KNOWN_PERMISSIONS.has(p));
  push({
    id: "permissions-known",
    label: "All permissions are recognised by Chrome",
    severity: "warning",
    passed: unknownPerms.length === 0,
    detail: unknownPerms.length ? `Unknown: ${unknownPerms.join(", ")}` : undefined,
  });

  // 12. No remote code in any HTML file (MV3 hard rule)
  const htmlFiles = Object.entries(files).filter(([n]) => n.endsWith(".html"));
  const remoteOffenders = htmlFiles.filter(([, c]) => REMOTE_SCRIPT_RE.test(c) || REMOTE_CSS_RE.test(c)).map(([n]) => n);
  push({
    id: "no-remote-code",
    label: "No remote scripts or stylesheets (MV3 forbids)",
    severity: "error",
    passed: remoteOffenders.length === 0,
    detail: remoteOffenders.length ? `Offending files: ${remoteOffenders.join(", ")}` : undefined,
  });

  // 13. No inline <script> blocks (CSP would block them at runtime)
  const inlineOffenders = htmlFiles.filter(([, c]) => INLINE_SCRIPT_RE.test(c)).map(([n]) => n);
  push({
    id: "no-inline-scripts",
    label: "No inline <script> blocks (blocked by extension CSP)",
    severity: "error",
    passed: inlineOffenders.length === 0,
    detail: inlineOffenders.length ? `Offending files: ${inlineOffenders.join(", ")}` : undefined,
  });

  // 14. No MV2-only APIs in service worker / scripts
  const jsFiles = Object.entries(files).filter(([n]) => n.endsWith(".js"));
  const mv2Patterns: { pattern: RegExp; name: string }[] = [
    { pattern: /chrome\.browserAction\b/, name: "chrome.browserAction (use chrome.action)" },
    { pattern: /chrome\.pageAction\b/, name: "chrome.pageAction (removed in MV3)" },
    { pattern: /chrome\.extension\.getBackgroundPage\b/, name: "chrome.extension.getBackgroundPage" },
    { pattern: /\bXMLHttpRequest\b/, name: "XMLHttpRequest in service worker (use fetch)" },
  ];
  const mv2Hits: string[] = [];
  for (const [name, content] of jsFiles) {
    for (const { pattern, name: api } of mv2Patterns) {
      if (pattern.test(content)) mv2Hits.push(`${name}: ${api}`);
    }
  }
  push({
    id: "no-mv2-apis",
    label: "No deprecated MV2-only APIs",
    severity: "warning",
    passed: mv2Hits.length === 0,
    detail: mv2Hits.length ? mv2Hits.join("; ") : undefined,
  });

  // 15. Bundle size (Chrome Web Store hard limit is 2 GB; warn well below)
  const totalBytes = Object.values(files).reduce((a, f) => a + new Blob([f]).size, 0);
  push({
    id: "bundle-size",
    label: "Bundle under 10 MB (Web Store friendly)",
    severity: "warning",
    passed: totalBytes < 10 * 1024 * 1024,
    detail: totalBytes >= 10 * 1024 * 1024 ? `${(totalBytes / 1024 / 1024).toFixed(1)} MB` : undefined,
  });

  // 16. README present (nice-to-have)
  push({
    id: "readme",
    label: "README.md included",
    severity: "info",
    passed: !!files["README.md"],
  });

  return finalize(checks);
}

function finalize(checks: QACheck[]): QAReport {
  const errors = checks.filter(c => !c.passed && c.severity === "error").length;
  const warnings = checks.filter(c => !c.passed && c.severity === "warning").length;
  return { checks, errors, warnings, chromeReady: errors === 0 };
}
