import { describe, it, expect } from "vitest";
import { autoFixAndValidate } from "./package-autofix";

describe("autoFixAndValidate", () => {
  it("repairs an MV2 bundle with remote+inline scripts and unknown permissions", () => {
    const broken: Record<string, string> = {
      "manifest.json": JSON.stringify({
        manifest_version: 2,
        name: "Broken",
        version: "abc",
        permissions: ["storage", "fakeThing", "tabs"],
        background: { service_worker: "background.js" },
        action: { default_popup: "popup.html" },
        content_scripts: [{ matches: ["<all_urls>"], js: ["content.js"] }],
      }),
      "background.js": "chrome.browserAction.onClicked.addListener(()=>{})",
      "popup.html": "<!doctype html><html><body><script>alert(1)</script><script src='https://cdn.x/y.js'></script></body></html>",
      "content.js": "console.log('cs')",
    };

    const { files, fixes, report } = autoFixAndValidate(broken);

    expect(fixes.length).toBeGreaterThan(0);
    expect(report.errors).toBe(0);

    const manifest = JSON.parse(files["manifest.json"]);
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.permissions).not.toContain("fakeThing");

    expect(files["popup.html"]).not.toMatch(/<script>alert/);
    expect(files["popup.html"]).not.toMatch(/cdn\.x/);
    expect(files["popup.inline.js"]).toContain("alert(1)");

    expect(files["background.js"]).toContain("chrome.action");
    expect(files["README.md"]).toBeDefined();
  });
});
