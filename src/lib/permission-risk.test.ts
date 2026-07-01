import { describe, it, expect } from "vitest";
import { analyzePermissionRisk } from "./permission-risk";
import { injectMessageStorageShield } from "./message-storage-shield";
import { certifyExtension } from "./quality-suite";

describe("permission-risk", () => {
  it("flags <all_urls> as critical and suggests activeTab", () => {
    const r = analyzePermissionRisk({ host_permissions: ["<all_urls>"] });
    expect(r.totals.critical).toBe(1);
    expect(r.highestRisk).toBe("critical");
    expect(r.findings[0].suggestion.toLowerCase()).toContain("activetab");
  });

  it("flags webRequestBlocking and suggests declarativeNetRequest", () => {
    const r = analyzePermissionRisk({ permissions: ["webRequestBlocking"] });
    expect(r.findings[0].risk).toBe("critical");
    expect(r.findings[0].suggestion).toContain("declarativeNetRequest");
  });

  it("softens risk for optional_permissions", () => {
    const r = analyzePermissionRisk({ optional_permissions: ["cookies"] });
    expect(r.findings[0].risk).toBe("medium"); // cookies is high → softened to medium
  });

  it("returns clean report when no risky perms", () => {
    const r = analyzePermissionRisk({ permissions: ["storage", "alarms"] });
    expect(r.findings.length).toBe(0);
    expect(r.score).toBe(100);
    expect(r.summary).toMatch(/no excessive/i);
  });

  it("catches broad content-script matches", () => {
    const r = analyzePermissionRisk({ content_scripts: [{ matches: ["*://*/*"] }] });
    expect(r.totals.critical).toBe(1);
  });
});

describe("message-storage-shield", () => {
  const files = () => ({
    "manifest.json": JSON.stringify({
      manifest_version: 3,
      background: { service_worker: "background.js" },
      content_scripts: [{ matches: ["https://example.com/*"], js: ["content.js"] }],
      action: { default_popup: "popup.html" },
    }),
    "background.js": "// bg",
    "content.js": "// cs",
    "popup.html": "<!doctype html><html><head></head><body></body></html>",
  });

  it("injects into service worker + content scripts", () => {
    const { files: out, injected } = injectMessageStorageShield(files());
    expect(injected).toContain("background.js");
    expect(injected).toContain("content.js");
    expect(out["background.js"]).toContain("__EXT_MSG_SHIELD__");
    expect(out["message-shield.js"]).toContain("safeSendMessage");
    expect(out["popup.html"]).toContain("message-shield.js");
  });

  it("is idempotent", () => {
    const a = injectMessageStorageShield(files()).files;
    const b = injectMessageStorageShield(a).files;
    const count = (b["background.js"].match(/__EXT_MSG_SHIELD__/g) || []).length;
    // 2 occurrences: the guard `if` and the assignment — but only from a single injection
    expect(count).toBeLessThanOrEqual(3);
    // no double-prepend
    expect(b["background.js"].indexOf("__EXT_MSG_SHIELD__")).toBe(
      a["background.js"].indexOf("__EXT_MSG_SHIELD__"),
    );
  });
});

describe("certifyExtension integration", () => {
  it("includes permission risk + hardening flags in the report", () => {
    const manifest = {
      manifest_version: 3,
      name: "Risky",
      version: "1.0.0",
      description: "d",
      permissions: ["tabs", "history"],
      host_permissions: ["<all_urls>"],
      background: { service_worker: "background.js" },
      action: { default_popup: "popup.html" },
      icons: { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" },
    };
    const { files, report } = certifyExtension({
      "manifest.json": JSON.stringify(manifest),
      "background.js": "// bg",
      "popup.html": "<!doctype html><html><head></head><body></body></html>",
    });
    expect(report.permissionRisk.totals.critical).toBeGreaterThan(0);
    expect(report.productionReady).toBe(false); // critical perms present
    expect(report.hardening.messageShieldInjected).toContain("background.js");
    expect(files["QA_REPORT.md"]).toContain("Permission & Host Risk");
    expect(files["QA_REPORT.md"]).toContain("<all_urls>");
  });
});

describe("checkAutoFixSafety", () => {
  it("blocks removing a permission that source code actually uses", async () => {
    const { checkAutoFixSafety } = await import("./permission-risk");
    const r = checkAutoFixSafety(
      { permissions: ["tabs"] },
      { type: "remove-permission", permission: "tabs" },
      { "background.js": "chrome.tabs.query({}, () => {})" },
    );
    expect(r.safe).toBe(false);
    expect(r.issues[0].severity).toBe("block");
  });

  it("warns (but allows) moving a used permission to optional", async () => {
    const { checkAutoFixSafety } = await import("./permission-risk");
    const r = checkAutoFixSafety(
      { permissions: ["cookies"] },
      { type: "move-to-optional", permission: "cookies" },
      { "bg.js": "chrome.cookies.get({url:'x'})" },
    );
    expect(r.safe).toBe(true);
    expect(r.issues[0].severity).toBe("warn");
  });

  it("blocks removing the last content-script match", async () => {
    const { checkAutoFixSafety } = await import("./permission-risk");
    const r = checkAutoFixSafety(
      { content_scripts: [{ matches: ["<all_urls>"], js: ["c.js"] }] },
      { type: "remove-content-script-match", pattern: "<all_urls>" },
    );
    expect(r.safe).toBe(false);
  });

  it("applyAllAutoFixes skips unsafe fixes and reports them", async () => {
    const { analyzePermissionRisk, applyAllAutoFixes } = await import("./permission-risk");
    const manifest = { permissions: ["debugger", "background"] };
    const report = analyzePermissionRisk(manifest);
    const res = applyAllAutoFixes(manifest, report, {
      files: { "bg.js": "chrome.debugger.attach({tabId:1})" },
    });
    expect(res.skipped.some((s) => /debugger/i.test(s.label))).toBe(true);
    expect(res.applied.some((a) => /background/i.test(a))).toBe(true);
  });
});
