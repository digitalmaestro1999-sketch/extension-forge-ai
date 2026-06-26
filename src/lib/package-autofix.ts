// Auto-fixes a generated extension bundle to clear common QA failures.
// Pure functions, no side effects. Returns the patched files plus a fix log.

import { runPackageQA } from "./package-qa";

export interface AutoFix {
  id: string;
  label: string;
  detail?: string;
}

export interface AutoFixResult {
  files: Record<string, string>;
  fixes: AutoFix[];
}

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

export function autoFixPackage(input: Record<string, string>): AutoFixResult {
  const files: Record<string, string> = { ...input };
  const fixes: AutoFix[] = [];

  // Parse manifest if possible
  let manifest: any = null;
  try {
    if (files["manifest.json"]) manifest = JSON.parse(files["manifest.json"]);
  } catch {
    // leave manifest as null
  }

  if (manifest) {
    let manifestChanged = false;

    // Fix MV3
    if (manifest.manifest_version !== 3) {
      manifest.manifest_version = 3;
      manifestChanged = true;
      fixes.push({ id: "manifest-v3", label: "Upgraded manifest_version to 3" });
    }

    // Fix version format
    if (!manifest.version || !/^\d+(\.\d+){0,3}$/.test(String(manifest.version))) {
      manifest.version = "1.0.0";
      manifestChanged = true;
      fixes.push({ id: "version-format", label: "Set version to 1.0.0" });
    }

    // Ensure required metadata
    if (!manifest.name) {
      manifest.name = "My Extension";
      manifestChanged = true;
      fixes.push({ id: "name", label: "Added default name" });
    }
    if (!manifest.description) {
      manifest.description = manifest.name;
      manifestChanged = true;
      fixes.push({ id: "description", label: "Added default description" });
    }

    // Strip unknown permissions
    if (Array.isArray(manifest.permissions)) {
      const removed = manifest.permissions.filter((p: string) => !KNOWN_PERMISSIONS.has(p));
      if (removed.length) {
        manifest.permissions = manifest.permissions.filter((p: string) => KNOWN_PERMISSIONS.has(p));
        manifestChanged = true;
        fixes.push({
          id: "permissions-known",
          label: "Removed unrecognised permissions",
          detail: removed.join(", "),
        });
      }
    }

    // Remove icon references that don't exist (so the validator doesn't flag them).
    // Caller still injects the icons/ folder at zip time, but we don't want broken
    // references hanging around if the manifest mentions a non-standard path.
    const standardIcons = {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png",
    };
    if (!manifest.icons || Object.keys(manifest.icons).length === 0) {
      manifest.icons = standardIcons;
      manifestChanged = true;
      fixes.push({ id: "icons", label: "Added standard icon references" });
    }

    if (manifestChanged) {
      files["manifest.json"] = JSON.stringify(manifest, null, 2);
    }
  }

  // Fix HTML: remove remote scripts/stylesheets and extract inline <script> blocks
  for (const [name, content] of Object.entries(files)) {
    if (!name.endsWith(".html")) continue;

    let html = content;
    let touched = false;

    // 1. Strip remote scripts
    const remoteScriptRe = /<script\b[^>]*\bsrc\s*=\s*["'](?:https?:)?\/\/[^"']+["'][^>]*>\s*<\/script>/gi;
    if (remoteScriptRe.test(html)) {
      html = html.replace(remoteScriptRe, "<!-- remote script removed for MV3 CSP -->");
      touched = true;
      fixes.push({ id: "no-remote-code", label: `Removed remote <script> from ${name}` });
    }

    // 2. Strip remote stylesheets
    const remoteCssRe = /<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*\bhref\s*=\s*["'](?:https?:)?\/\/[^"']+["'][^>]*\/?>/gi;
    if (remoteCssRe.test(html)) {
      html = html.replace(remoteCssRe, "<!-- remote stylesheet removed for MV3 CSP -->");
      touched = true;
      fixes.push({ id: "no-remote-code", label: `Removed remote <link> from ${name}` });
    }

    // 3. Extract inline <script> blocks into a sibling .js file
    const inlineRe = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    const inlineBlocks: string[] = [];
    html = html.replace(inlineRe, (_m, body) => {
      inlineBlocks.push(String(body).trim());
      return "";
    });
    if (inlineBlocks.length) {
      const base = name.replace(/\.html$/, "");
      const extractedName = `${base}.inline.js`;
      const existing = files[extractedName] ?? "";
      files[extractedName] = [existing, ...inlineBlocks].filter(Boolean).join("\n\n");
      // Inject single <script src> right before </body> (or append)
      const tag = `<script src="${extractedName}"></script>`;
      if (/<\/body>/i.test(html)) {
        html = html.replace(/<\/body>/i, `  ${tag}\n</body>`);
      } else {
        html += `\n${tag}\n`;
      }
      touched = true;
      fixes.push({
        id: "no-inline-scripts",
        label: `Extracted inline scripts from ${name}`,
        detail: `→ ${extractedName}`,
      });
    }

    if (touched) files[name] = html;
  }

  // Fix MV2 APIs in JS files (simple text replacements that are safe in 99% of cases)
  const mv2Replacements: { pattern: RegExp; replacement: string; label: string }[] = [
    { pattern: /\bchrome\.browserAction\b/g, replacement: "chrome.action", label: "chrome.browserAction → chrome.action" },
    { pattern: /\bchrome\.pageAction\b/g, replacement: "chrome.action", label: "chrome.pageAction → chrome.action" },
  ];
  for (const [name, content] of Object.entries(files)) {
    if (!name.endsWith(".js")) continue;
    let js = content;
    let touched = false;
    for (const r of mv2Replacements) {
      if (r.pattern.test(js)) {
        js = js.replace(r.pattern, r.replacement);
        touched = true;
        fixes.push({ id: "no-mv2-apis", label: `${r.label} in ${name}` });
      }
    }
    if (touched) files[name] = js;
  }

  // Add a stub README so the info check passes
  if (!files["README.md"] && manifest) {
    files["README.md"] = `# ${manifest.name ?? "Extension"}\n\n${manifest.description ?? ""}\n\n## Install (unpacked)\n\n1. Unzip the downloaded archive.\n2. Open \`chrome://extensions\` and enable Developer mode.\n3. Click "Load unpacked" and select the unzipped folder.\n`;
    fixes.push({ id: "readme", label: "Added README.md" });
  }

  return { files, fixes };
}

// Convenience: run autofix then re-run QA.
export function autoFixAndValidate(input: Record<string, string>) {
  const { files, fixes } = autoFixPackage(input);
  const report = runPackageQA({
    ...files,
    "icons/icon16.png": files["icons/icon16.png"] ?? "<binary>",
    "icons/icon48.png": files["icons/icon48.png"] ?? "<binary>",
    "icons/icon128.png": files["icons/icon128.png"] ?? "<binary>",
  });
  return { files, fixes, report };
}
