// End-to-end coverage for the Wizard workspace's code-generation pipeline.
// Exercises every extension type the UI can produce and asserts the shape of
// the emitted files without needing to render React — the wizard's UI is a
// thin controller around these pure functions.

import { describe, it, expect } from "vitest";
import {
  buildManifest,
  buildFiles,
  buildAllFiles,
  type WizardSpec,
  type WizardExtType,
} from "./wizard-codegen";

function specFor(overrides: Partial<WizardSpec> = {}): WizardSpec {
  return {
    name: "Test Extension",
    version: "1.2.3",
    description: "A test extension.",
    extType: "popup",
    permissions: ["storage", "activeTab"],
    hosts: ["https://*.example.com/*"],
    matches: ["https://*.example.com/*"],
    ...overrides,
  };
}

describe("wizard-codegen (end-to-end)", () => {
  const types: WizardExtType[] = ["popup", "sidepanel", "content", "background"];

  it.each(types)("produces a valid MV3 manifest for %s", (extType) => {
    const m = buildManifest(specFor({ extType })) as Record<string, unknown>;
    expect(m.manifest_version).toBe(3);
    expect(m.name).toBe("Test Extension");
    expect(m.version).toBe("1.2.3");
    expect(m.icons).toEqual({
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png",
    });
    // CSP must never allow remote script sources.
    const csp = (m.content_security_policy as { extension_pages: string }).extension_pages;
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/https?:/);
  });

  it("falls back to a safe version when input is invalid", () => {
    const m = buildManifest(specFor({ version: "not-a-version" }));
    expect(m.version).toBe("1.0.0");
  });

  it("popup wires up the toolbar action", () => {
    const m = buildManifest(specFor({ extType: "popup" }));
    expect(m.action).toMatchObject({ default_popup: "popup.html" });
  });

  it("sidepanel auto-adds the sidePanel permission", () => {
    const m = buildManifest(specFor({ extType: "sidepanel", permissions: ["storage"] }));
    expect(m.permissions).toContain("sidePanel");
    expect(m.side_panel).toEqual({ default_path: "sidepanel.html" });
  });

  it("content script uses provided match patterns", () => {
    const m = buildManifest(specFor({
      extType: "content",
      matches: ["https://github.com/*"],
    })) as Record<string, unknown>;
    const scripts = m.content_scripts as Array<{ matches: string[]; js: string[] }>;
    expect(scripts[0].matches).toEqual(["https://github.com/*"]);
    expect(scripts[0].js).toContain("content.js");
  });

  it("emits type-specific source files", () => {
    const popup = buildFiles(specFor({ extType: "popup" }));
    expect(popup["popup.html"]).toBeDefined();

    const side = buildFiles(specFor({ extType: "sidepanel" }));
    expect(side["sidepanel.html"]).toBeDefined();

    const content = buildFiles(specFor({ extType: "content" }));
    expect(content["content.js"]).toBeDefined();

    const bg = buildFiles(specFor({ extType: "background" }));
    // background service worker file must exist somewhere in the bundle
    expect(Object.keys(bg).some((k) => /background/i.test(k) || /service.?worker/i.test(k)))
      .toBe(true);
  });

  it("buildAllFiles is a superset of buildFiles and always includes manifest.json", () => {
    const spec = specFor({ extType: "popup" });
    const some = buildFiles(spec);
    const all = buildAllFiles(spec);
    for (const key of Object.keys(some)) {
      expect(all[key]).toBe(some[key]);
    }
    expect(all["manifest.json"]).toBeDefined();
    const parsed = JSON.parse(all["manifest.json"]);
    expect(parsed.manifest_version).toBe(3);
  });

  it("omits permissions / host_permissions when the user picks none", () => {
    const m = buildManifest(specFor({
      extType: "background",
      permissions: [],
      hosts: [],
    }));
    expect(m.permissions).toBeUndefined();
    expect(m.host_permissions).toBeUndefined();
  });

  it("full compile round-trip: every extension type produces parseable JSON + non-empty files", () => {
    for (const extType of types) {
      const files = buildAllFiles(specFor({ extType }));
      expect(Object.keys(files).length).toBeGreaterThan(1);
      for (const [name, contents] of Object.entries(files)) {
        expect(contents, `file ${name} for ${extType} was empty`).toBeTruthy();
      }
      expect(() => JSON.parse(files["manifest.json"])).not.toThrow();
    }
  });
});
