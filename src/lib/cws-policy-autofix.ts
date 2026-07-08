// Applies deterministic auto-fixes for CWS policy checks. AI-mode fixes are
// orchestrated separately by the UI (see PublishAssistant.applyPolicyFix).

import { HARDENED_EXTENSION_CSP } from "./extension-csp";
import type { PolicyCheck } from "./cws-policy-check";

export type ListingPatch = Partial<{
  title: string;
  summary: string;
  description: string;
  category: string;
  singlePurpose: string;
  privacyPolicyUrl: string;
  homepageUrl: string;
  permissionJustifications: Record<string, string>;
}>;

export interface AutoFixResult {
  files?: Record<string, string>;
  listing?: ListingPatch;
  applied: string;
}

function parseManifest(files: Record<string, string>): any {
  try { return JSON.parse(files["manifest.json"] ?? "{}"); } catch { return {}; }
}
function writeManifest(files: Record<string, string>, m: any): Record<string, string> {
  return { ...files, "manifest.json": JSON.stringify(m, null, 2) };
}

/** Apply a deterministic policy fix. Returns undefined if the check needs AI. */
export function applyDeterministicPolicyFix(
  check: PolicyCheck,
  files: Record<string, string>,
  listing: { title?: string; summary?: string; description?: string } = {},
): AutoFixResult | undefined {
  const af = check.autoFix;
  if (!af || af.mode !== "deterministic") return undefined;

  if (af.target === "manifest" || af.target === "files") {
    const m = parseManifest(files);

    switch (af.kind) {
      case "set-mv3":
        m.manifest_version = 3;
        return { files: writeManifest(files, m), applied: "Set manifest_version: 3" };

      case "trim-manifest-name":
        m.name = String(m.name ?? "").slice(0, 75);
        return { files: writeManifest(files, m), applied: "Trimmed manifest.name to 75 chars" };

      case "trim-manifest-description":
        m.description = String(m.description ?? "").slice(0, 132);
        return { files: writeManifest(files, m), applied: "Trimmed manifest.description to 132 chars" };


      case "normalize-version":
        m.version = "1.0.0";
        return { files: writeManifest(files, m), applied: "Set manifest.version to 1.0.0" };

      case "fill-icon-sizes": {
        const existing = m.icons ?? {};
        const fallback =
          existing["128"] || existing["48"] || existing["16"] ||
          Object.keys(files).find((k) => k.startsWith("icons/")) ||
          "icons/icon128.png";
        m.icons = {
          "16": existing["16"] ?? fallback,
          "48": existing["48"] ?? fallback,
          "128": existing["128"] ?? fallback,
        };
        return { files: writeManifest(files, m), applied: "Filled icons 16/48/128" };
      }

      case "inject-hardened-csp":
        m.content_security_policy = { extension_pages: HARDENED_EXTENSION_CSP };
        return { files: writeManifest(files, m), applied: "Injected hardened MV3 CSP" };

      case "remove-update-url":
        delete m.update_url;
        return { files: writeManifest(files, m), applied: "Removed update_url" };

      case "drop-banned-perms": {
        const banned = new Set(["webRequestBlocking"]);
        m.permissions = (m.permissions ?? []).filter((p: string) => !banned.has(p));
        return { files: writeManifest(files, m), applied: "Removed MV3-banned permissions" };
      }

      case "set-default-locale":
        m.default_locale = m.default_locale ?? "en";
        return { files: writeManifest(files, m), applied: "Set default_locale: en" };

      case "tighten-war":
        m.web_accessible_resources = (m.web_accessible_resources ?? []).map((entry: any) => ({
          ...entry,
          matches: (entry.matches ?? []).filter(
            (mt: string) => mt !== "<all_urls>" && mt !== "*://*/*",
          ),
        }));
        return { files: writeManifest(files, m), applied: "Tightened web_accessible_resources" };

      case "set-action-title":
        m.action = { ...(m.action ?? {}), default_title: m.name ?? "Open extension" };
        return { files: writeManifest(files, m), applied: "Set action.default_title" };

      case "remove-broad-host": {
        const drop = new Set(["<all_urls>", "*://*/*", "http://*/*", "https://*/*"]);
        m.permissions = (m.permissions ?? []).filter((p: string) => !drop.has(p));
        m.host_permissions = (m.host_permissions ?? []).filter((p: string) => !drop.has(p));
        return { files: writeManifest(files, m), applied: "Removed broad host permissions" };
      }

      case "strip-remote-scripts": {
        const out = { ...files };
        for (const [k, v] of Object.entries(files)) {
          if (k.endsWith(".html") && typeof v === "string") {
            out[k] = v.replace(
              /<script\b[^>]*\bsrc\s*=\s*["'](?:https?:)?\/\/[^"']+["'][^>]*>\s*<\/script>/gi,
              "",
            );
          }
        }
        return { files: out, applied: "Stripped remote <script src> tags" };
      }
    }
  }

  if (af.target === "listing") {
    switch (af.kind) {
      case "trim-listing": {
        const field = af.field as "title" | "summary" | "description";
        const cap = field === "title" ? 45 : field === "summary" ? 132 : 16000;
        const current = (listing as any)[field] ?? "";
        return { listing: { [field]: current.slice(0, cap) }, applied: `Trimmed ${field} to ${cap} chars` };
      }
    }
  }

  return undefined;
}
