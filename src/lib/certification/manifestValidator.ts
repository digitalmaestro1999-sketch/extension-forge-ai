// Manifest V3 structural validator. Complements package-qa with a more
// granular per-field readout that feeds the Certification dashboard.

export type ManifestSeverity = "critical" | "warning" | "info";

export interface ManifestIssue {
  id: string;
  severity: ManifestSeverity;
  file: string;
  message: string;
  fix: string;
}

const REQUIRED_ICONS = [16, 32, 48, 128];
const VERSION_RE = /^\d{1,5}(\.\d{1,5}){0,3}$/;

export function validateManifest(files: Record<string, string>): ManifestIssue[] {
  const raw = files["manifest.json"];
  const out: ManifestIssue[] = [];
  if (!raw) {
    return [{ id: "missing-manifest", severity: "critical", file: "manifest.json",
      message: "manifest.json is missing.", fix: "Create a Manifest V3 manifest.json in the root." }];
  }
  let m: any;
  try { m = JSON.parse(raw); }
  catch { return []; } // syntax scanner reports this

  const push = (issue: Omit<ManifestIssue, "file">) => out.push({ file: "manifest.json", ...issue });

  if (m.manifest_version !== 3) {
    push({ id: "mv-version", severity: "critical",
      message: `manifest_version must be 3 (got ${m.manifest_version ?? "none"}).`,
      fix: "Set \"manifest_version\": 3." });
  }
  if (!m.name || String(m.name).trim().length < 3) {
    push({ id: "name", severity: "critical", message: "\"name\" missing or too short.",
      fix: "Add a descriptive name (3–75 chars)." });
  } else if (String(m.name).length > 75) {
    push({ id: "name-length", severity: "warning", message: "\"name\" exceeds 75 chars.",
      fix: "Shorten the name; the CWS listing enforces 75 max." });
  }
  if (!m.version) {
    push({ id: "version", severity: "critical", message: "\"version\" missing.",
      fix: "Add a semantic version like \"1.0.0\"." });
  } else if (!VERSION_RE.test(String(m.version))) {
    push({ id: "version-format", severity: "critical",
      message: `Invalid version "${m.version}". Must be 1–4 dot-separated integers.`,
      fix: "Use e.g. 1.0.0" });
  }
  if (!m.description || String(m.description).length < 20) {
    push({ id: "description", severity: "warning",
      message: "\"description\" missing or under 20 chars.",
      fix: "Add a descriptive summary (up to 132 chars)." });
  } else if (String(m.description).length > 132) {
    push({ id: "description-length", severity: "warning",
      message: "\"description\" exceeds 132 chars.",
      fix: "Shorten to 132 chars max." });
  }
  // Icons
  const icons = m.icons ?? {};
  for (const sz of REQUIRED_ICONS) {
    if (!icons[sz]) {
      push({ id: `icon-${sz}`, severity: sz === 128 ? "critical" : "warning",
        message: `Missing icon size ${sz}×${sz}.`,
        fix: `Add "icons": { "${sz}": "icons/icon${sz}.png" } and include the file.` });
      continue;
    }
    if (!files[icons[sz]]) {
      push({ id: `icon-file-${sz}`, severity: "critical",
        message: `Icon file "${icons[sz]}" referenced but not present in bundle.`,
        fix: `Include the file at ${icons[sz]} or fix the path.` });
    }
  }
  // Action / popup
  if (m.action?.default_popup && !files[m.action.default_popup]) {
    push({ id: "popup-missing", severity: "critical",
      message: `action.default_popup points to "${m.action.default_popup}" but file missing.`,
      fix: "Add the popup HTML file at that path." });
  }
  // Background
  if (m.background) {
    if (m.background.scripts) {
      push({ id: "bg-scripts-mv2", severity: "critical",
        message: "background.scripts is MV2 syntax; MV3 requires service_worker.",
        fix: "Use \"background\": { \"service_worker\": \"background.js\" }." });
    }
    if (m.background.service_worker && !files[m.background.service_worker]) {
      push({ id: "bg-sw-missing", severity: "critical",
        message: `background.service_worker "${m.background.service_worker}" file missing.`,
        fix: "Add the service worker file at that path." });
    }
  }
  // Content scripts
  if (Array.isArray(m.content_scripts)) {
    m.content_scripts.forEach((cs: any, i: number) => {
      if (!cs.matches?.length) {
        push({ id: `cs-matches-${i}`, severity: "critical",
          message: `content_scripts[${i}] missing "matches".`,
          fix: "Add at least one match pattern, e.g. \"https://*/*\"." });
      }
      for (const f of (cs.js ?? [])) if (!files[f]) push({
        id: `cs-js-${i}-${f}`, severity: "critical",
        message: `content_scripts[${i}] references missing JS "${f}".`,
        fix: `Include the file at ${f} or fix the path.` });
    });
  }
  // Update URL forbidden for CWS
  if (m.update_url) {
    push({ id: "update-url", severity: "critical",
      message: "update_url must not be present for Chrome Web Store submissions.",
      fix: "Remove the \"update_url\" field from manifest.json." });
  }
  // Permissions sanity
  const perms: string[] = m.permissions ?? [];
  const banned = ["webRequestBlocking"];
  for (const p of perms) if (banned.includes(p)) push({
    id: `perm-${p}`, severity: "critical",
    message: `Permission "${p}" is banned in MV3.`,
    fix: "Use declarativeNetRequest instead.",
  });
  if (perms.includes("<all_urls>")) push({
    id: "perm-all-urls", severity: "warning",
    message: "<all_urls> permission triggers heavy CWS review.",
    fix: "Scope host permissions to the sites you actually need.",
  });

  return out;
}
