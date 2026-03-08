export interface ExtensionSpec {
  name: string;
  description: string;
  features: string[];
  permissions: string[];
  hostPermissions: string[];
  apis: string[];
}

export function generateManifest(spec: ExtensionSpec): string {
  return JSON.stringify(
    {
      manifest_version: 3,
      name: spec.name,
      version: "1.0.0",
      description: spec.description,
      permissions: spec.permissions,
      host_permissions: spec.hostPermissions.length > 0 ? spec.hostPermissions : ["https://*/*"],
      background: { service_worker: "background.js" },
      action: { default_popup: "popup.html", default_icon: { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" } },
      content_scripts: [
        {
          matches: ["<all_urls>"],
          js: ["content.js"],
          css: ["styles.css"],
        },
      ],
    },
    null,
    2
  );
}

export function generatePopupHtml(spec: ExtensionSpec): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${spec.name}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="popup-container">
    <header class="popup-header">
      <h1>${spec.name}</h1>
      <p>${spec.description}</p>
    </header>
    <main class="popup-main">
      <div id="content">
        <p>Loading...</p>
      </div>
    </main>
    <footer class="popup-footer">
      <button id="action-btn" class="btn-primary">Run</button>
      <button id="settings-btn" class="btn-secondary">Settings</button>
    </footer>
  </div>
  <script src="popup.js"></script>
</body>
</html>`;
}

export function generatePopupJs(spec: ExtensionSpec): string {
  return `// ${spec.name} - Popup Script
document.addEventListener('DOMContentLoaded', () => {
  const contentEl = document.getElementById('content');
  const actionBtn = document.getElementById('action-btn');
  const settingsBtn = document.getElementById('settings-btn');

  // Load saved state
  chrome.storage.local.get(['state'], (result) => {
    if (result.state) {
      contentEl.innerHTML = '<p>Ready to go!</p>';
    }
  });

  actionBtn.addEventListener('click', async () => {
    // Send message to content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'run' }, (response) => {
        if (response?.success) {
          contentEl.innerHTML = '<p>✅ Action completed!</p>';
        }
      });
    }
  });

  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});`;
}

export function generateBackgroundJs(spec: ExtensionSpec): string {
  return `// ${spec.name} - Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('${spec.name} installed');
  chrome.storage.local.set({ state: { installed: true, timestamp: Date.now() } });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getData') {
    // Handle data requests from content scripts
    sendResponse({ success: true, data: {} });
  }
  return true; // Keep message channel open for async response
});`;
}

export function generateContentJs(spec: ExtensionSpec): string {
  return `// ${spec.name} - Content Script

(function() {
  'use strict';

  // Listen for messages from popup or background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'run') {
      try {
        // Main extension logic here
        const result = performAction();
        sendResponse({ success: true, data: result });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }
    return true;
  });

  function performAction() {
    // TODO: Implement extension-specific logic
    console.log('${spec.name} action executed');
    return { processed: true };
  }
})();`;
}

export function generateStylesCss(): string {
  return `/* Extension Styles */
:root {
  --primary: #00e68a;
  --bg: #0f1118;
  --surface: #161923;
  --text: #e2e8f0;
  --text-muted: #64748b;
  --border: #1e2433;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  width: 360px;
  min-height: 400px;
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
}

.popup-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
}

.popup-header {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.popup-header h1 {
  font-size: 16px;
  font-weight: 600;
  color: var(--primary);
}

.popup-header p {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.popup-main {
  flex: 1;
  padding: 8px 0;
}

.popup-footer {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.btn-primary, .btn-secondary {
  flex: 1;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-primary {
  background: var(--primary);
  color: var(--bg);
}

.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-primary:hover, .btn-secondary:hover { opacity: 0.85; }`;
}

export function generateOptionsHtml(spec: ExtensionSpec): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${spec.name} - Settings</title>
  <link rel="stylesheet" href="styles.css">
  <style>
    body { width: auto; min-height: auto; padding: 24px; max-width: 600px; margin: 0 auto; }
  </style>
</head>
<body>
  <h1>Settings</h1>
  <div style="margin-top: 16px;">
    <label style="display: block; margin-bottom: 8px; font-size: 13px; color: var(--text-muted);">Configuration</label>
    <p style="font-size: 13px;">Configure your ${spec.name} preferences here.</p>
  </div>
  <script src="options.js"></script>
</body>
</html>`;
}

export function generateOptionsJs(spec: ExtensionSpec): string {
  return `// ${spec.name} - Options Script
document.addEventListener('DOMContentLoaded', () => {
  // Load and save settings
  chrome.storage.local.get(['settings'], (result) => {
    console.log('Settings loaded:', result.settings);
  });
});`;
}

export interface GeneratedFiles {
  [filename: string]: string;
}

export function generateAllFiles(spec: ExtensionSpec): GeneratedFiles {
  return {
    "manifest.json": generateManifest(spec),
    "popup.html": generatePopupHtml(spec),
    "popup.js": generatePopupJs(spec),
    "background.js": generateBackgroundJs(spec),
    "content.js": generateContentJs(spec),
    "styles.css": generateStylesCss(),
    "options.html": generateOptionsHtml(spec),
    "options.js": generateOptionsJs(spec),
  };
}
