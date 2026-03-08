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
      --accent-subtle: rgba(99, 102, 241, 0.08);
      --accent-border: rgba(99, 102, 241, 0.18);
      --bg: #09090b;
      --bg-elevated: #18181b;
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
      --radius: 12px;
      --radius-sm: 8px;
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
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 24px 60px;
    }
    .page-header {
      margin-bottom: 32px;
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .page-header img {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-sm);
    }
    .page-header h1 {
      font-size: 22px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .page-header p {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    /* Tabs */
    .tabs {
      display: flex;
      gap: 2px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 24px;
    }
    .tab {
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-muted);
      background: none;
      border: none;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: color 0.15s, border-color 0.15s;
    }
    .tab:hover { color: var(--text-secondary); }
    .tab.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }

    /* Sections */
    .section {
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
      margin-bottom: 16px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
      margin-bottom: 16px;
    }
    .setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 0;
      border-bottom: 1px solid var(--border-subtle);
      gap: 16px;
    }
    .setting-row:last-child { border-bottom: none; }
    .setting-info { flex: 1; }
    .setting-label {
      font-size: 14px;
      font-weight: 500;
    }
    .setting-desc {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 3px;
    }

    /* Toggle Switch */
    .toggle {
      position: relative;
      width: 42px;
      height: 24px;
      flex-shrink: 0;
    }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle-slider {
      position: absolute;
      inset: 0;
      background: var(--border);
      border-radius: 12px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .toggle-slider::after {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      width: 18px;
      height: 18px;
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

    /* Inputs */
    .input, .select {
      padding: 8px 12px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 13px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.15s;
    }
    .input:focus, .select:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px var(--accent-subtle);
    }
    .input { width: 100%; }
    .select {
      min-width: 140px;
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 10px center;
      padding-right: 30px;
    }

    /* Kbd */
    .kbd-input-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .kbd {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 26px;
      padding: 0 6px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 5px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      font-family: 'SF Mono', 'Cascadia Code', monospace;
      box-shadow: 0 1px 2px rgba(0,0,0,0.3);
    }
    .shortcut-record-btn {
      padding: 6px 12px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .shortcut-record-btn:hover {
      background: var(--surface-hover);
      color: var(--text-secondary);
    }
    .shortcut-record-btn.recording {
      border-color: var(--accent);
      color: var(--accent);
      background: var(--accent-subtle);
      animation: recording-pulse 1s ease-in-out infinite;
    }
    @keyframes recording-pulse {
      0%, 100% { box-shadow: 0 0 0 0 var(--accent-subtle); }
      50% { box-shadow: 0 0 0 4px var(--accent-subtle); }
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 20px;
      border: none;
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      outline: none;
    }
    .btn-primary {
      background: var(--accent);
      color: white;
    }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-secondary {
      background: var(--surface);
      color: var(--text-secondary);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover {
      background: var(--surface-hover);
      color: var(--text);
    }
    .btn-danger {
      background: rgba(239, 68, 68, 0.1);
      color: var(--error);
      border: 1px solid rgba(239, 68, 68, 0.2);
    }
    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.15);
    }
    .btn-group {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    /* Stats */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      padding: 14px;
      text-align: center;
    }
    .stat-value {
      font-size: 20px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: var(--text);
    }
    .stat-label {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    /* Data table */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .data-table th {
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
    }
    .data-table td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border-subtle);
      color: var(--text-secondary);
    }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table tr:hover td { background: var(--surface); }

    /* Footer bar */
    .footer-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--bg-elevated);
      border-top: 1px solid var(--border);
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 10;
    }
    .footer-bar .version-text {
      font-size: 12px;
      color: var(--text-muted);
    }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 72px;
      right: 24px;
      padding: 10px 18px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 500;
      transform: translateY(20px);
      opacity: 0;
      transition: all 0.3s ease;
      z-index: 20;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .toast.show {
      transform: translateY(0);
      opacity: 1;
    }
    .toast-success { background: var(--success); color: white; }
    .toast-error { background: var(--error); color: white; }

    /* Modal */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .modal-overlay.open { display: flex; }
    .modal {
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
      width: 90%;
      max-width: 420px;
    }
    .modal h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .modal p {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 20px;
    }

    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="page-header">
      <img src="icons/icon48.png" alt="" />
      <div>
        <h1>${spec.name}</h1>
        <p>Settings &amp; Preferences</p>
      </div>
    </div>

    <div class="tabs">
      <button class="tab active" data-tab="general">General</button>
      <button class="tab" data-tab="shortcuts">Shortcuts</button>
      <button class="tab" data-tab="automation">Automation</button>
      <button class="tab" data-tab="data">Data</button>
      <button class="tab" data-tab="about">About</button>
    </div>

    <!-- ═══ General Tab ═══ -->
    <div class="tab-panel active" id="panel-general">
      <div class="section">
        <div class="section-title">Core</div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Enable Extension</div>
            <div class="setting-desc">Turn the extension on or off globally</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="toggle-enabled" checked />
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Notifications</div>
            <div class="setting-desc">Show desktop notifications for events</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="toggle-notifications" checked />
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Badge Counter</div>
            <div class="setting-desc">Show action count on toolbar icon</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="toggle-badge" checked />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Appearance</div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Theme</div>
            <div class="setting-desc">Choose popup color scheme</div>
          </div>
          <select class="select" id="select-theme">
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Popup Width</div>
            <div class="setting-desc">Set popup window width in pixels</div>
          </div>
          <select class="select" id="select-popup-width">
            <option value="360">Compact (360px)</option>
            <option value="380" selected>Default (380px)</option>
            <option value="420">Wide (420px)</option>
          </select>
        </div>
      </div>
    </div>

    <!-- ═══ Shortcuts Tab ═══ -->
    <div class="tab-panel" id="panel-shortcuts">
      <div class="section">
        <div class="section-title">Keyboard Shortcuts</div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Run Action</div>
            <div class="setting-desc">Execute primary extension action</div>
          </div>
          <div class="kbd-input-group">
            <span class="shortcut-display" id="shortcut-run">
              <span class="kbd">Ctrl</span>
              <span class="kbd">Shift</span>
              <span class="kbd">E</span>
            </span>
            <button class="shortcut-record-btn" data-shortcut="run" title="Click to re-record">⌨</button>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Toggle Extension</div>
            <div class="setting-desc">Enable or disable the extension</div>
          </div>
          <div class="kbd-input-group">
            <span class="shortcut-display" id="shortcut-toggle">
              <span class="kbd">Ctrl</span>
              <span class="kbd">Shift</span>
              <span class="kbd">D</span>
            </span>
            <button class="shortcut-record-btn" data-shortcut="toggle" title="Click to re-record">⌨</button>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Open Settings</div>
            <div class="setting-desc">Open this settings page</div>
          </div>
          <div class="kbd-input-group">
            <span class="shortcut-display" id="shortcut-settings">
              <span class="kbd">Ctrl</span>
              <span class="kbd">Shift</span>
              <span class="kbd">,</span>
            </span>
            <button class="shortcut-record-btn" data-shortcut="settings" title="Click to re-record">⌨</button>
          </div>
        </div>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">
        💡 Click the ⌨ button then press your desired key combination. Press Escape to cancel.
      </p>
    </div>

    <!-- ═══ Automation Tab ═══ -->
    <div class="tab-panel" id="panel-automation">
      <div class="section">
        <div class="section-title">Auto-Run</div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Run on Page Load</div>
            <div class="setting-desc">Automatically execute the action when a page loads</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="toggle-autorun" />
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Auto-Run Delay</div>
            <div class="setting-desc">Wait before auto-running (milliseconds)</div>
          </div>
          <select class="select" id="select-autorun-delay">
            <option value="0">Instant</option>
            <option value="500">500ms</option>
            <option value="1000" selected>1 second</option>
            <option value="3000">3 seconds</option>
          </select>
        </div>
      </div>

      <div class="section">
        <div class="section-title">URL Filters</div>
        <div class="setting-row" style="flex-direction:column;align-items:stretch;">
          <div class="setting-info" style="margin-bottom:10px;">
            <div class="setting-label">Auto-Run Only On</div>
            <div class="setting-desc">Enter URL patterns, one per line. Leave empty for all sites. Supports wildcards (*).</div>
          </div>
          <textarea class="input" id="url-patterns" rows="4" placeholder="https://www.youtube.com/*&#10;https://github.com/*" style="resize:vertical;font-family:'SF Mono','Cascadia Code',monospace;font-size:12px;"></textarea>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Schedule</div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Active Hours Only</div>
            <div class="setting-desc">Restrict auto-run to specific hours</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="toggle-schedule" />
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="setting-row" id="schedule-times" style="display:none;">
          <div class="setting-info">
            <div class="setting-label">Time Range</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="time" class="input" id="schedule-start" value="09:00" style="width:auto;" />
            <span style="color:var(--text-muted);">→</span>
            <input type="time" class="input" id="schedule-end" value="17:00" style="width:auto;" />
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ Data Tab ═══ -->
    <div class="tab-panel" id="panel-data">
      <div class="section">
        <div class="section-title">Usage Statistics</div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value" id="stat-runs">0</div>
            <div class="stat-label">Total Runs</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="stat-pages">0</div>
            <div class="stat-label">Pages</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="stat-days">0</div>
            <div class="stat-label">Days Active</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Recent Activity</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Page</th>
              <th>Action</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody id="activity-log">
            <tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px;">No activity yet</td></tr>
          </tbody>
        </table>
      </div>

      <div class="section">
        <div class="section-title">Export &amp; Import</div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Export All Data</div>
            <div class="setting-desc">Download settings, logs, and history as JSON</div>
          </div>
          <button class="btn btn-secondary" id="btn-export">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Import Data</div>
            <div class="setting-desc">Restore from a previously exported JSON file</div>
          </div>
          <label class="btn btn-secondary" style="cursor:pointer;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import
            <input type="file" id="btn-import" accept=".json" style="display:none;" />
          </label>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Clear All Data</div>
            <div class="setting-desc">Remove all stored data and reset to defaults</div>
          </div>
          <button class="btn btn-danger" id="btn-clear">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Clear Data
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ About Tab ═══ -->
    <div class="tab-panel" id="panel-about">
      <div class="section">
        <div class="section-title">Extension Info</div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Name</div>
          </div>
          <span style="font-size:13px;color:var(--text-secondary);">${spec.name}</span>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Version</div>
          </div>
          <span class="kbd">1.0.0</span>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Manifest</div>
          </div>
          <span class="kbd">v3</span>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Description</div>
          </div>
          <span style="font-size:13px;color:var(--text-secondary);max-width:280px;text-align:right;">${spec.description}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Permissions</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${spec.permissions.map((p) => `<span class="kbd">${p}</span>`).join('\n          ')}
        </div>
      </div>

      <div class="section">
        <div class="section-title">Support</div>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">Found a bug or have feedback?</p>
        <div class="btn-group">
          <button class="btn btn-secondary" onclick="chrome.tabs.create({url:'mailto:support@example.com'})">Contact Support</button>
          <button class="btn btn-secondary" onclick="chrome.tabs.create({url:'https://chrome.google.com/webstore'})">Rate Extension</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Footer Bar -->
  <div class="footer-bar">
    <span class="version-text">${spec.name} v1.0.0</span>
    <div class="btn-group">
      <button class="btn btn-primary" id="save-btn">Save Settings</button>
    </div>
  </div>

  <!-- Clear Data Confirmation Modal -->
  <div class="modal-overlay" id="clear-modal">
    <div class="modal">
      <h3>Clear All Data?</h3>
      <p>This will permanently delete all stored settings, activity logs, and cached data. This cannot be undone.</p>
      <div class="btn-group" style="justify-content:flex-end;">
        <button class="btn btn-secondary" id="clear-cancel">Cancel</button>
        <button class="btn btn-danger" id="clear-confirm">Clear Everything</button>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>
  <script src="options.js"></script>
</body>
</html>`;
}

export function generateOptionsJs(spec: ExtensionSpec): string {
  return `// ${spec.name} — Options Controller

document.addEventListener('DOMContentLoaded', () => {
  // ── Tab navigation ──
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tab-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    });
  });

  // ── Elements ──
  const els = {
    enabled:      document.getElementById('toggle-enabled'),
    notifications: document.getElementById('toggle-notifications'),
    badge:        document.getElementById('toggle-badge'),
    theme:        document.getElementById('select-theme'),
    popupWidth:   document.getElementById('select-popup-width'),
    autorun:      document.getElementById('toggle-autorun'),
    autorunDelay: document.getElementById('select-autorun-delay'),
    urlPatterns:  document.getElementById('url-patterns'),
    schedule:     document.getElementById('toggle-schedule'),
    scheduleRow:  document.getElementById('schedule-times'),
    schedStart:   document.getElementById('schedule-start'),
    schedEnd:     document.getElementById('schedule-end'),
    saveBtn:      document.getElementById('save-btn'),
    exportBtn:    document.getElementById('btn-export'),
    importInput:  document.getElementById('btn-import'),
    clearBtn:     document.getElementById('btn-clear'),
    clearModal:   document.getElementById('clear-modal'),
    clearCancel:  document.getElementById('clear-cancel'),
    clearConfirm: document.getElementById('clear-confirm'),
    toast:        document.getElementById('toast'),
    statRuns:     document.getElementById('stat-runs'),
    statPages:    document.getElementById('stat-pages'),
    statDays:     document.getElementById('stat-days'),
    activityLog:  document.getElementById('activity-log'),
  };

  // ── Default settings ──
  const defaults = {
    enabled: true,
    notifications: true,
    badge: true,
    theme: 'dark',
    popupWidth: '380',
    autorun: false,
    autorunDelay: '1000',
    urlPatterns: '',
    schedule: false,
    scheduleStart: '09:00',
    scheduleEnd: '17:00',
    shortcuts: {
      run: 'Ctrl+Shift+E',
      toggle: 'Ctrl+Shift+D',
      settings: 'Ctrl+Shift+,',
    }
  };

  // ── Show/hide schedule times row ──
  els.schedule.addEventListener('change', () => {
    els.scheduleRow.style.display = els.schedule.checked ? 'flex' : 'none';
  });

  // ── Load settings ──
  chrome.storage.local.get(['settings', 'stats', 'activityLog'], (result) => {
    const s = { ...defaults, ...(result.settings || {}) };
    els.enabled.checked      = s.enabled;
    els.notifications.checked = s.notifications;
    els.badge.checked        = s.badge;
    els.theme.value          = s.theme;
    els.popupWidth.value     = s.popupWidth;
    els.autorun.checked      = s.autorun;
    els.autorunDelay.value   = s.autorunDelay;
    els.urlPatterns.value    = s.urlPatterns;
    els.schedule.checked     = s.schedule;
    els.schedStart.value     = s.scheduleStart;
    els.schedEnd.value       = s.scheduleEnd;
    els.scheduleRow.style.display = s.schedule ? 'flex' : 'none';

    // Render shortcuts
    if (s.shortcuts) {
      Object.entries(s.shortcuts).forEach(([key, combo]) => {
        renderShortcut(key, combo);
      });
    }

    // Stats
    const stats = result.stats || { runs: 0, pages: 0, firstUse: Date.now() };
    els.statRuns.textContent  = stats.runs || 0;
    els.statPages.textContent = stats.pages || 0;
    const days = Math.max(1, Math.floor((Date.now() - (stats.firstUse || Date.now())) / 86400000));
    els.statDays.textContent  = days;

    // Activity log
    const log = result.activityLog || [];
    if (log.length > 0) {
      els.activityLog.innerHTML = log.slice(-10).reverse().map(entry =>
        '<tr><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
        (entry.url || '—') + '</td><td>' + (entry.action || 'run') +
        '</td><td>' + new Date(entry.time).toLocaleString() + '</td></tr>'
      ).join('');
    }
  });

  // ── Keyboard shortcut recording ──
  let recordingTarget = null;
  document.querySelectorAll('.shortcut-record-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (recordingTarget) {
        document.querySelector('.shortcut-record-btn.recording')?.classList.remove('recording');
      }
      recordingTarget = btn.dataset.shortcut;
      btn.classList.add('recording');
      btn.textContent = '…';
    });
  });

  document.addEventListener('keydown', (e) => {
    if (!recordingTarget) return;
    e.preventDefault();
    if (e.key === 'Escape') {
      const btn = document.querySelector('.shortcut-record-btn.recording');
      btn?.classList.remove('recording');
      btn.textContent = '⌨';
      recordingTarget = null;
      return;
    }
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);

    const combo = parts.join('+');
    renderShortcut(recordingTarget, combo);

    const btn = document.querySelector('.shortcut-record-btn.recording');
    btn?.classList.remove('recording');
    btn.textContent = '⌨';
    recordingTarget = null;
  });

  function renderShortcut(name, combo) {
    const display = document.getElementById('shortcut-' + name);
    if (display) {
      display.innerHTML = combo.split('+').map(k =>
        '<span class="kbd">' + k + '</span>'
      ).join(' ');
    }
  }

  // ── Get current settings from UI ──
  function gatherSettings() {
    const shortcuts = {};
    ['run', 'toggle', 'settings'].forEach(name => {
      const el = document.getElementById('shortcut-' + name);
      if (el) {
        shortcuts[name] = Array.from(el.querySelectorAll('.kbd')).map(k => k.textContent).join('+');
      }
    });
    return {
      enabled: els.enabled.checked,
      notifications: els.notifications.checked,
      badge: els.badge.checked,
      theme: els.theme.value,
      popupWidth: els.popupWidth.value,
      autorun: els.autorun.checked,
      autorunDelay: els.autorunDelay.value,
      urlPatterns: els.urlPatterns.value,
      schedule: els.schedule.checked,
      scheduleStart: els.schedStart.value,
      scheduleEnd: els.schedEnd.value,
      shortcuts,
    };
  }

  // ── Toast helper ──
  function showToast(msg, type = 'success') {
    els.toast.textContent = msg;
    els.toast.className = 'toast toast-' + type + ' show';
    setTimeout(() => els.toast.classList.remove('show'), 2500);
  }

  // ── Save ──
  els.saveBtn.addEventListener('click', () => {
    chrome.storage.local.set({ settings: gatherSettings() }, () => {
      showToast('Settings saved ✓');
    });
  });

  // ── Export ──
  els.exportBtn.addEventListener('click', () => {
    chrome.storage.local.get(null, (allData) => {
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '${spec.name.toLowerCase().replace(/\\s+/g, '-')}-data.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Data exported ✓');
    });
  });

  // ── Import ──
  els.importInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        chrome.storage.local.set(data, () => {
          showToast('Data imported ✓');
          setTimeout(() => location.reload(), 800);
        });
      } catch {
        showToast('Invalid JSON file', 'error');
      }
    };
    reader.readAsText(file);
  });

  // ── Clear Data ──
  els.clearBtn.addEventListener('click', () => {
    els.clearModal.classList.add('open');
  });
  els.clearCancel.addEventListener('click', () => {
    els.clearModal.classList.remove('open');
  });
  els.clearConfirm.addEventListener('click', () => {
    chrome.storage.local.clear(() => {
      els.clearModal.classList.remove('open');
      showToast('All data cleared');
      setTimeout(() => location.reload(), 800);
    });
  });
});`;
}
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
