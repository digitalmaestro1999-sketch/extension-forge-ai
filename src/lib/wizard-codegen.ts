// Generates boilerplate source files for the Wizard workspace
// based on the selected extension type.

export type WizardExtType = "popup" | "sidepanel" | "content" | "background";

export interface WizardSpec {
  name: string;
  version: string;
  description: string;
  extType: WizardExtType;
  permissions: string[];
  hosts: string[];
  matches: string[]; // content-script matches
}

export type GeneratedFiles = Record<string, string>;

export function buildManifest(spec: WizardSpec): Record<string, unknown> {
  const m: Record<string, unknown> = {
    manifest_version: 3,
    name: spec.name || "Untitled Extension",
    version: /^\d+(\.\d+){0,3}$/.test(spec.version) ? spec.version : "1.0.0",
    description: spec.description || "",
    icons: {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png",
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; base-uri 'self'; frame-ancestors 'none'",
    },
  };
  if (spec.permissions.length) m.permissions = [...spec.permissions];
  if (spec.hosts.length) m.host_permissions = spec.hosts;

  if (spec.extType === "popup") {
    m.action = {
      default_popup: "popup.html",
      default_icon: "icons/icon48.png",
      default_title: spec.name,
    };
  } else if (spec.extType === "sidepanel") {
    m.side_panel = { default_path: "sidepanel.html" };
    m.permissions = Array.from(new Set([...(spec.permissions), "sidePanel"]));
    m.action = { default_title: spec.name };
  } else if (spec.extType === "content") {
    m.content_scripts = [
      {
        matches: spec.matches.length ? spec.matches : ["<all_urls>"],
        js: ["content.js"],
        run_at: "document_idle",
      },
    ];
  } else if (spec.extType === "background") {
    m.background = { service_worker: "background.js", type: "module" };
  }
  return m;
}

function popupHtml(spec: WizardSpec): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(spec.name)}</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      width: 320px;
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0b0f17;
      color: #e6edf3;
    }
    header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .logo {
      width: 36px; height: 36px; border-radius: 8px;
      background: linear-gradient(135deg, #00e68a, #6f6cff);
    }
    h1 { font-size: 14px; margin: 0; font-weight: 600; }
    p.desc { font-size: 12px; color: #9aa6b2; margin: 0 0 12px; line-height: 1.5; }
    button {
      width: 100%;
      padding: 10px 12px;
      border: 0;
      border-radius: 8px;
      background: linear-gradient(135deg, #00e68a, #6f6cff);
      color: #0b0f17;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
    }
    button.secondary {
      margin-top: 8px;
      background: #1a212d;
      color: #e6edf3;
      border: 1px solid #243043;
    }
    .meta { margin-top: 12px; font-size: 11px; color: #6b7785; font-family: ui-monospace, monospace; }
  </style>
</head>
<body>
  <header>
    <div class="logo"></div>
    <div>
      <h1>${escapeHtml(spec.name)}</h1>
      <div class="meta">v${escapeHtml(spec.version)}</div>
    </div>
  </header>
  <p class="desc">${escapeHtml(spec.description)}</p>
  <button id="run-btn">Run</button>
  <button id="settings-btn" class="secondary">Settings</button>
  <script src="popup.js"></script>
</body>
</html>
`;
}

function popupJs(spec: WizardSpec): string {
  return `// ${spec.name} — popup script
document.addEventListener("DOMContentLoaded", () => {
  const runBtn = document.getElementById("run-btn");
  const settingsBtn = document.getElementById("settings-btn");

  runBtn?.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log("[${spec.name}] running on", tab?.url);
    runBtn.textContent = "✓ Done";
    setTimeout(() => (runBtn.textContent = "Run"), 1200);
  });

  settingsBtn?.addEventListener("click", () => {
    chrome.runtime.openOptionsPage?.();
  });
});
`;
}

function sidepanelHtml(spec: WizardSpec): string {
  return popupHtml(spec).replace("width: 320px;", "width: 100%; min-height: 100vh;");
}

function contentJs(spec: WizardSpec): string {
  const matches = spec.matches.length ? spec.matches : ["<all_urls>"];
  return `// ${spec.name} — content script
// Target matches: ${matches.join(", ")}
(() => {
  console.log("[${spec.name}] content script loaded on", location.href);

  // Example: notify background that we are active
  try {
    chrome.runtime.sendMessage({ type: "CONTENT_READY", url: location.href });
  } catch (_) { /* background may not exist */ }
})();
`;
}

function backgroundJs(spec: WizardSpec): string {
  return `// ${spec.name} — background service worker (MV3)

chrome.runtime.onInstalled.addListener((details) => {
  console.log("[${spec.name}] installed:", details.reason);
  chrome.storage?.local.set({ installedAt: Date.now() });
});

chrome.runtime.onStartup?.addListener(() => {
  console.log("[${spec.name}] browser startup");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[${spec.name}] message:", message, "from", sender.tab?.url);
  sendResponse({ ok: true, received: message });
  return true;
});
`;
}

function readme(spec: WizardSpec): string {
  return `# ${spec.name}

${spec.description}

**Version:** ${spec.version}
**Surface:** ${spec.extType}

## Install (Unpacked)
1. Unzip this archive.
2. Open \`chrome://extensions\`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder.

## Files
${Object.keys(buildFiles(spec)).map((f) => `- \`${f}\``).join("\n")}

Generated by Extension Forge AI.
`;
}

export function buildFiles(spec: WizardSpec): GeneratedFiles {
  const files: GeneratedFiles = {
    "manifest.json": JSON.stringify(buildManifest(spec), null, 2),
  };
  if (spec.extType === "popup") {
    files["popup.html"] = popupHtml(spec);
    files["popup.js"] = popupJs(spec);
  } else if (spec.extType === "sidepanel") {
    files["sidepanel.html"] = sidepanelHtml(spec);
    files["popup.js"] = popupJs(spec);
  } else if (spec.extType === "content") {
    files["content.js"] = contentJs(spec);
  } else if (spec.extType === "background") {
    files["background.js"] = backgroundJs(spec);
  }
  return files;
}

export function buildAllFiles(spec: WizardSpec): GeneratedFiles {
  const files = buildFiles(spec);
  files["README.md"] = readme(spec);
  return files;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}
