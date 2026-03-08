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
      action: {
        default_popup: "popup.html",
        default_icon: {
          "16": "icons/icon16.png",
          "48": "icons/icon48.png",
          "128": "icons/icon128.png",
        },
      },
      icons: {
        "16": "icons/icon16.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png",
      },
      content_scripts: [
        {
          matches: ["<all_urls>"],
          js: ["content.js"],
          css: ["content-styles.css"],
        },
      ],
      options_page: "options.html",
    },
    null,
    2
  );
}

export function generatePopupHtml(spec: ExtensionSpec): string {
  const featureListHtml = spec.features
    .slice(0, 4)
    .map(
      (f) =>
        `        <div class="feature-item">
          <svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>${f}</span>
        </div>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${spec.name}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="popup">
    <header class="header">
      <div class="header-top">
        <div class="logo-group">
          <img src="icons/icon48.png" alt="" class="header-icon" />
          <div>
            <h1 class="title">${spec.name}</h1>
            <p class="version">v1.0.0</p>
          </div>
        </div>
        <button id="settings-btn" class="icon-btn" title="Settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
      <p class="subtitle">${spec.description}</p>
    </header>

    <div class="divider"></div>

    <main class="main">
      <div id="status-bar" class="status-bar status-ready">
        <span class="status-dot"></span>
        <span id="status-text">Ready</span>
      </div>

      <div id="content" class="content-area">
        <div class="features-list">
${featureListHtml}
        </div>
      </div>

      <div id="result-area" class="result-area hidden"></div>
    </main>

    <footer class="footer">
      <button id="action-btn" class="btn btn-primary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        Run
      </button>
      <button id="reset-btn" class="btn btn-ghost">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
        Reset
      </button>
    </footer>
  </div>
  <script src="popup.js"></script>
</body>
</html>`;
}

export function generateStylesCss(spec: ExtensionSpec): string {
  return `/* ${spec.name} — Extension Styles */

:root {
  --accent: #6366f1;
  --accent-hover: #818cf8;
  --accent-subtle: rgba(99, 102, 241, 0.08);
  --accent-border: rgba(99, 102, 241, 0.18);

  --bg: #09090b;
  --bg-elevated: #18181b;
  --bg-input: #27272a;

  --surface: #1c1c20;
  --surface-hover: #232327;

  --text: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;

  --border: #27272a;
  --border-subtle: #1f1f23;

  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;

  --radius: 10px;
  --radius-sm: 6px;
  --shadow: 0 4px 24px rgba(0,0,0,0.4);
  --transition: 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  width: 380px;
  min-height: 480px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  line-height: 1.5;
}

/* ---- Layout ---- */

.popup {
  display: flex;
  flex-direction: column;
  min-height: 480px;
}

.header {
  padding: 20px 20px 0;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
}

.title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text);
}

.version {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

.subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 12px;
  line-height: 1.5;
}

.divider {
  height: 1px;
  background: var(--border);
  margin: 16px 20px;
}

/* ---- Status Bar ---- */

.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 12px;
}

.status-ready {
  background: rgba(34, 197, 94, 0.08);
  color: var(--success);
  border: 1px solid rgba(34, 197, 94, 0.15);
}

.status-running {
  background: rgba(99, 102, 241, 0.08);
  color: var(--accent);
  border: 1px solid var(--accent-border);
}

.status-error {
  background: rgba(239, 68, 68, 0.08);
  color: var(--error);
  border: 1px solid rgba(239, 68, 68, 0.15);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.status-running .status-dot {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

/* ---- Main Content ---- */

.main {
  flex: 1;
  padding: 0 20px;
  overflow-y: auto;
}

.content-area {
  padding: 4px 0;
}

.features-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  font-size: 13px;
  color: var(--text-secondary);
  transition: background var(--transition), border-color var(--transition);
}

.feature-item:hover {
  background: var(--surface-hover);
  border-color: var(--border);
}

.feature-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--accent);
}

/* ---- Result Area ---- */

.result-area {
  margin-top: 12px;
  padding: 14px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  font-size: 13px;
  color: var(--text-secondary);
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
}

.result-area.success {
  border-color: rgba(34, 197, 94, 0.25);
  background: rgba(34, 197, 94, 0.05);
}

.hidden { display: none; }

/* ---- Footer ---- */

.footer {
  display: flex;
  gap: 8px;
  padding: 16px 20px 20px;
  margin-top: auto;
}

/* ---- Buttons ---- */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 16px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition);
  outline: none;
  white-space: nowrap;
}

.btn:focus-visible {
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
}

.btn-primary {
  flex: 1;
  background: var(--accent);
  color: white;
}

.btn-primary:hover {
  background: var(--accent-hover);
  box-shadow: 0 2px 12px rgba(99, 102, 241, 0.3);
}

.btn-primary:active {
  transform: scale(0.98);
}

.btn-ghost {
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border);
}

.btn-ghost:hover {
  background: var(--surface);
  color: var(--text-secondary);
  border-color: var(--border);
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition);
}

.icon-btn:hover {
  background: var(--surface);
  color: var(--text);
}

/* ---- Scrollbar ---- */

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

/* ---- Loading spinner ---- */

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.2);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
`;
}

export function generatePopupJs(spec: ExtensionSpec): string {
  return `// ${spec.name} — Popup Controller

document.addEventListener('DOMContentLoaded', () => {
  const actionBtn    = document.getElementById('action-btn');
  const resetBtn     = document.getElementById('reset-btn');
  const settingsBtn  = document.getElementById('settings-btn');
  const statusBar    = document.getElementById('status-bar');
  const statusText   = document.getElementById('status-text');
  const resultArea   = document.getElementById('result-area');
  const contentArea  = document.getElementById('content');

  function setStatus(state, text) {
    statusBar.className = 'status-bar status-' + state;
    statusText.textContent = text;
  }

  function showResult(html, isSuccess) {
    resultArea.innerHTML = html;
    resultArea.classList.remove('hidden');
    if (isSuccess) resultArea.classList.add('success');
    else resultArea.classList.remove('success');
  }

  // Run action
  actionBtn.addEventListener('click', async () => {
    setStatus('running', 'Running…');
    actionBtn.disabled = true;
    actionBtn.innerHTML = '<span class="spinner"></span> Running…';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab found');

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'run' });

      if (response?.success) {
        setStatus('ready', 'Completed');
        showResult('✓ Action completed successfully.', true);
      } else {
        throw new Error(response?.error || 'Unknown error');
      }
    } catch (err) {
      setStatus('error', 'Error');
      showResult('⚠ ' + (err.message || 'Something went wrong'), false);
    } finally {
      actionBtn.disabled = false;
      actionBtn.innerHTML = \`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Run\`;
    }
  });

  // Reset
  resetBtn.addEventListener('click', () => {
    setStatus('ready', 'Ready');
    resultArea.classList.add('hidden');
    resultArea.classList.remove('success');
    resultArea.innerHTML = '';
  });

  // Settings
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Load saved state
  chrome.storage.local.get(['state'], (result) => {
    if (result.state?.lastRun) {
      setStatus('ready', 'Last run: ' + new Date(result.state.lastRun).toLocaleTimeString());
    }
  });
});`;
}

export function generateBackgroundJs(spec: ExtensionSpec): string {
  return `// ${spec.name} — Background Service Worker

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[${spec.name}] Installed — reason:', details.reason);
  chrome.storage.local.set({
    state: { installed: true, timestamp: Date.now(), version: '1.0.0' },
    settings: { enabled: true, notifications: true }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'getData':
      chrome.storage.local.get(['state'], (result) => {
        sendResponse({ success: true, data: result.state || {} });
      });
      return true;

    case 'saveState':
      chrome.storage.local.set({ state: { ...message.data, lastRun: Date.now() } }, () => {
        sendResponse({ success: true });
      });
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});`;
}

export function generateContentJs(spec: ExtensionSpec): string {
  return `// ${spec.name} — Content Script
'use strict';

(function() {
  // Prevent double injection
  if (window.__${spec.name.replace(/[^a-zA-Z]/g, '_')}_loaded) return;
  window.__${spec.name.replace(/[^a-zA-Z]/g, '_')}_loaded = true;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'run') {
      try {
        const result = performAction();
        // Persist last run time
        chrome.runtime.sendMessage({ action: 'saveState', data: { lastRun: Date.now() } });
        sendResponse({ success: true, data: result });
      } catch (error) {
        console.error('[${spec.name}] Error:', error);
        sendResponse({ success: false, error: error.message });
      }
    }
    return true;
  });

  function performAction() {
    // TODO: Implement your extension logic here
    console.log('[${spec.name}] Action executed on', window.location.href);
    return { processed: true, url: window.location.href, timestamp: Date.now() };
  }
})();`;
}

export function generateContentStylesCss(): string {
  return `/* Content script styles — injected into web pages */
/* Keep this minimal to avoid conflicts with host page styles */
`;
}

export function generateOptionsHtml(spec: ExtensionSpec): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${spec.name} — Settings</title>
  <style>
    :root {
      --accent: #6366f1;
      --accent-hover: #818cf8;
      --bg: #09090b;
      --bg-elevated: #18181b;
      --surface: #1c1c20;
      --text: #fafafa;
      --text-secondary: #a1a1aa;
      --text-muted: #71717a;
      --border: #27272a;
      --success: #22c55e;
      --radius: 10px;
      --radius-sm: 6px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      -webkit-font-smoothing: antialiased;
      line-height: 1.6;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      padding: 40px 24px;
    }
    .page-header {
      margin-bottom: 32px;
    }
    .page-header h1 {
      font-size: 22px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .page-header p {
      font-size: 14px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .section {
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
      margin-bottom: 16px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 16px;
    }
    .setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid var(--border);
    }
    .setting-row:last-child { border-bottom: none; }
    .setting-label {
      font-size: 14px;
      font-weight: 500;
    }
    .setting-desc {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    /* Toggle Switch */
    .toggle {
      position: relative;
      width: 40px;
      height: 22px;
      flex-shrink: 0;
    }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle-slider {
      position: absolute;
      inset: 0;
      background: var(--border);
      border-radius: 11px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .toggle-slider::after {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      width: 16px;
      height: 16px;
      background: var(--text-muted);
      border-radius: 50%;
      transition: transform 0.2s, background 0.2s;
    }
    .toggle input:checked + .toggle-slider {
      background: var(--accent);
    }
    .toggle input:checked + .toggle-slider::after {
      transform: translateX(18px);
      background: white;
    }
    .save-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 20px;
      background: var(--accent);
      color: white;
      border: none;
      border-radius: var(--radius-sm);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
    }
    .save-btn:hover { background: var(--accent-hover); }
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 10px 18px;
      background: var(--success);
      color: white;
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 500;
      transform: translateY(80px);
      opacity: 0;
      transition: all 0.3s ease;
    }
    .toast.show {
      transform: translateY(0);
      opacity: 1;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="page-header">
      <h1>${spec.name}</h1>
      <p>Configure your extension preferences</p>
    </div>

    <div class="section">
      <div class="section-title">General</div>
      <div class="setting-row">
        <div>
          <div class="setting-label">Enable Extension</div>
          <div class="setting-desc">Turn the extension on or off</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="toggle-enabled" checked />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="setting-row">
        <div>
          <div class="setting-label">Notifications</div>
          <div class="setting-desc">Show desktop notifications</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="toggle-notifications" checked />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <button class="save-btn" id="save-btn">Save Settings</button>
    <div class="toast" id="toast">Settings saved ✓</div>
  </div>
  <script src="options.js"></script>
</body>
</html>`;
}

export function generateOptionsJs(spec: ExtensionSpec): string {
  return `// ${spec.name} — Options Controller

document.addEventListener('DOMContentLoaded', () => {
  const enabledToggle = document.getElementById('toggle-enabled');
  const notifToggle   = document.getElementById('toggle-notifications');
  const saveBtn       = document.getElementById('save-btn');
  const toast         = document.getElementById('toast');

  // Load settings
  chrome.storage.local.get(['settings'], (result) => {
    const s = result.settings || {};
    enabledToggle.checked = s.enabled !== false;
    notifToggle.checked   = s.notifications !== false;
  });

  // Save
  saveBtn.addEventListener('click', () => {
    chrome.storage.local.set({
      settings: {
        enabled: enabledToggle.checked,
        notifications: notifToggle.checked
      }
    }, () => {
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    });
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
    "styles.css": generateStylesCss(spec),
    "background.js": generateBackgroundJs(spec),
    "content.js": generateContentJs(spec),
    "content-styles.css": generateContentStylesCss(),
    "options.html": generateOptionsHtml(spec),
    "options.js": generateOptionsJs(spec),
  };
}
