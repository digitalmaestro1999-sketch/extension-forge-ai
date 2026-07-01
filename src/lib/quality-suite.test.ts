import { describe, it, expect } from "vitest";
import { certifyExtension, injectErrorShield, injectUpgradeHelper } from "./quality-suite";

const baseManifest = {
  manifest_version: 3,
  name: "Test",
  version: "1.0.0",
  description: "d",
  background: { service_worker: "background.js" },
  action: { default_popup: "popup.html" },
  icons: { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" },
  content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" },
};

const files = () => ({
  "manifest.json": JSON.stringify(baseManifest),
  "background.js": "// bg\nconsole.log('hi');",
  "popup.html": "<!doctype html><html><head><title>t</title></head><body></body></html>",
});

describe("quality-suite", () => {
  it("injects the error shield into background + popup", () => {
    const { files: out, injected } = injectErrorShield(files());
    expect(injected).toContain("background.js");
    expect(injected).toContain("popup.html");
    expect(out["background.js"]).toContain("__EXT_SHIELD__");
    expect(out["error-shield.js"]).toContain("__EXT_SHIELD__");
    expect(out["popup.html"]).toContain("error-shield.js");
  });

  it("injects the upgrade helper only once", () => {
    const { files: a } = injectUpgradeHelper(files());
    const { files: b } = injectUpgradeHelper(a);
    const count = (b["background.js"].match(/onUpdateAvailable/g) || []).length;
    expect(count).toBe(1);
  });

  it("certifyExtension returns a bundled QA report and score", () => {
    const { files: out, report } = certifyExtension(files());
    expect(out["QA_REPORT.json"]).toBeTruthy();
    expect(out["QA_REPORT.md"]).toContain("Extension Quality Report");
    expect(report.score).toBeGreaterThan(0);
    expect(["A+", "A", "B", "C", "D", "F"]).toContain(report.grade);
    expect(report.hardening.errorShieldInjected.length).toBeGreaterThan(0);
  });
});
