import { describe, it, expect } from "vitest";
import { runPackageQA } from "./package-qa";

const goodManifest = JSON.stringify({
  manifest_version: 3,
  name: "Test",
  version: "1.0.0",
  description: "demo",
  permissions: ["storage", "activeTab"],
  background: { service_worker: "background.js" },
  action: { default_popup: "popup.html", default_icon: { "16": "icons/icon16.png" } },
  icons: { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" },
  content_scripts: [{ matches: ["<all_urls>"], js: ["content.js"] }],
});

const baseFiles: Record<string, string> = {
  "manifest.json": goodManifest,
  "background.js": "chrome.runtime.onInstalled.addListener(()=>{});",
  "popup.html": "<!doctype html><html><body><script src='popup.js'></script></body></html>",
  "popup.js": "console.log('ok')",
  "content.js": "console.log('cs')",
  "icons/icon16.png": "x",
  "icons/icon48.png": "x",
  "icons/icon128.png": "x",
};

describe("runPackageQA", () => {
  it("passes a well-formed MV3 bundle", () => {
    const r = runPackageQA(baseFiles);
    expect(r.errors).toBe(0);
    expect(r.chromeReady).toBe(true);
  });

  it("flags missing icons referenced by the manifest", () => {
    const f = { ...baseFiles };
    delete f["icons/icon128.png"];
    const r = runPackageQA(f);
    expect(r.chromeReady).toBe(false);
    expect(r.checks.find(c => c.id === "icons-exist")?.passed).toBe(false);
  });

  it("flags inline scripts and remote scripts in HTML", () => {
    const f = {
      ...baseFiles,
      "popup.html": "<!doctype html><script>alert(1)</script><script src='https://cdn.example.com/a.js'></script>",
    };
    const r = runPackageQA(f);
    expect(r.checks.find(c => c.id === "no-inline-scripts")?.passed).toBe(false);
    expect(r.checks.find(c => c.id === "no-remote-code")?.passed).toBe(false);
  });

  it("flags MV2-only APIs", () => {
    const f = { ...baseFiles, "background.js": "chrome.browserAction.onClicked.addListener(()=>{})" };
    const r = runPackageQA(f);
    expect(r.checks.find(c => c.id === "no-mv2-apis")?.passed).toBe(false);
  });
});
