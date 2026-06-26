export interface ExtensionSpec {
  name: string;
  description: string;
  features: string[];
  permissions: string[];
  hostPermissions: string[];
  apis: string[];
}

export function generateManifest(spec: ExtensionSpec): string {
  const manifest: any = {
    manifest_version: 3,
    name: spec.name,
    version: "1.0.0",
    description: spec.description,
    permissions: [...new Set([...spec.permissions, "storage", "contextMenus"])],
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
    commands: {
      "run-action": {
        suggested_key: { default: "Ctrl+Shift+E", mac: "Command+Shift+E" },
        description: "Run primary action",
      },
      "toggle-extension": {
        suggested_key: { default: "Ctrl+Shift+D", mac: "Command+Shift+D" },
        description: "Toggle extension on/off",
      },
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; base-uri 'self'; frame-ancestors 'none'",
    },
  };
  return JSON.stringify(manifest, null, 2);
}

export function generatePopupHtml(spec: ExtensionSpec): string {
  const featureListHtml = spec.features
    .slice(0, 6)
    .map(
      (f, i) =>
        `        <div class="feature-item" style="animation-delay:${i * 60}ms">
          <svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>${f}</span>
          <span class="feature-status" id="feature-${i}">—</span>
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
        <div class="header-actions">
          <button id="quick-toggle" class="icon-btn" title="Toggle On/Off">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
          </button>
          <button id="settings-btn" class="icon-btn" title="Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
      </div>
      <p class="subtitle">${spec.description}</p>
    </header>

    <div class="divider"></div>

    <main class="main">
      <div id="status-bar" class="status-bar status-ready">
        <span class="status-dot"></span>
        <span id="status-text">Ready</span>
        <span class="status-badge" id="run-count">0 runs</span>
      </div>

      <div id="content" class="content-area">
        <div class="features-list">
${featureListHtml}
        </div>
      </div>

      <div id="result-area" class="result-area hidden"></div>

      <div id="log-panel" class="log-panel hidden">
        <div class="log-header">
          <span>Activity Log</span>
          <button id="clear-log" class="text-btn">Clear</button>
        </div>
        <div id="log-entries" class="log-entries"></div>
      </div>
    </main>

    <footer class="footer">
      <button id="action-btn" class="btn btn-primary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        Run
      </button>
      <button id="log-toggle" class="btn btn-ghost" title="Toggle Log">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        Log
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
  --accent-glow: rgba(99, 102, 241, 0.25);

  --bg: #09090b;
  --bg-elevated: #18181b;
  --bg-input: #27272a;

  --surface: #1c1c20;
  --surface-hover: #232327;
  --surface-active: #2a2a2e;

  --text: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;

  --border: #27272a;
  --border-subtle: #1f1f23;

  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;
  --info: #3b82f6;

  --radius: 10px;
  --radius-sm: 6px;
  --radius-lg: 14px;
  --shadow: 0 4px 24px rgba(0,0,0,0.4);
  --shadow-lg: 0 8px 40px rgba(0,0,0,0.6);
  --transition: 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  width: 380px;
  min-height: 520px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  line-height: 1.5;
}

/* ---- Layout ---- */
.popup { display: flex; flex-direction: column; min-height: 520px; }

.header { padding: 20px 20px 0; }

.header-top { display: flex; align-items: center; justify-content: space-between; }

.logo-group { display: flex; align-items: center; gap: 12px; }

.header-actions { display: flex; gap: 4px; }

.header-icon { width: 36px; height: 36px; border-radius: var(--radius-sm); }

.title { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; color: var(--text); }

.version { font-size: 11px; color: var(--text-muted); font-weight: 500; }

.subtitle { font-size: 13px; color: var(--text-secondary); margin-top: 12px; line-height: 1.5; }

.divider { height: 1px; background: var(--border); margin: 16px 20px; }

/* ---- Status Bar ---- */
.status-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: var(--radius-sm);
  font-size: 12px; font-weight: 500; margin-bottom: 12px;
}
.status-badge {
  margin-left: auto; font-size: 10px; font-weight: 600;
  padding: 2px 8px; border-radius: 10px;
  background: rgba(255,255,255,0.06); color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.status-ready { background: rgba(34, 197, 94, 0.08); color: var(--success); border: 1px solid rgba(34, 197, 94, 0.15); }
.status-running { background: rgba(99, 102, 241, 0.08); color: var(--accent); border: 1px solid var(--accent-border); }
.status-error { background: rgba(239, 68, 68, 0.08); color: var(--error); border: 1px solid rgba(239, 68, 68, 0.15); }
.status-disabled { background: rgba(113, 113, 122, 0.08); color: var(--text-muted); border: 1px solid rgba(113, 113, 122, 0.15); }

.status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
.status-running .status-dot { animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }

/* ---- Main Content ---- */
.main { flex: 1; padding: 0 20px; overflow-y: auto; }
.content-area { padding: 4px 0; }

.features-list { display: flex; flex-direction: column; gap: 6px; }

.feature-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: var(--radius-sm);
  background: var(--surface); border: 1px solid var(--border-subtle);
  font-size: 13px; color: var(--text-secondary);
  transition: background var(--transition), border-color var(--transition);
  animation: fadeSlideIn 0.3s ease forwards; opacity: 0;
}
@keyframes fadeSlideIn { to { opacity: 1; transform: translateY(0); } from { opacity: 0; transform: translateY(6px); } }

.feature-item:hover { background: var(--surface-hover); border-color: var(--border); }
.feature-icon { width: 16px; height: 16px; flex-shrink: 0; color: var(--accent); }
.feature-status { margin-left: auto; font-size: 10px; color: var(--text-muted); font-weight: 500; }

/* ---- Result Area ---- */
.result-area {
  margin-top: 12px; padding: 14px; border-radius: var(--radius-sm);
  background: var(--surface); border: 1px solid var(--border);
  font-size: 13px; color: var(--text-secondary);
  white-space: pre-wrap; max-height: 200px; overflow-y: auto;
}
.result-area.success { border-color: rgba(34, 197, 94, 0.25); background: rgba(34, 197, 94, 0.05); }
.hidden { display: none; }

/* ---- Log Panel ---- */
.log-panel {
  margin-top: 12px; border-radius: var(--radius-sm);
  background: var(--surface); border: 1px solid var(--border);
  max-height: 180px; overflow: hidden; display: flex; flex-direction: column;
}
.log-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 12px; border-bottom: 1px solid var(--border-subtle);
  font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;
}
.log-entries { flex: 1; overflow-y: auto; padding: 4px 0; }
.log-entry {
  padding: 4px 12px; font-size: 11px; color: var(--text-muted);
  font-family: 'SF Mono', 'Cascadia Code', monospace; border-bottom: 1px solid var(--border-subtle);
}
.log-entry:last-child { border-bottom: none; }
.log-time { color: var(--text-muted); margin-right: 8px; }
.text-btn {
  background: none; border: none; color: var(--accent); cursor: pointer;
  font-size: 11px; font-weight: 500; padding: 2px 6px; border-radius: 4px;
}
.text-btn:hover { background: var(--accent-subtle); }

/* ---- Footer ---- */
.footer { display: flex; gap: 8px; padding: 16px 20px 20px; margin-top: auto; }

/* ---- Buttons ---- */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 9px 16px; border: none; border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all var(--transition); outline: none; white-space: nowrap;
}
.btn:focus-visible { box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent); }
.btn-primary { flex: 1; background: var(--accent); color: white; }
.btn-primary:hover { background: var(--accent-hover); box-shadow: 0 2px 12px var(--accent-glow); }
.btn-primary:active { transform: scale(0.98); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ghost { background: transparent; color: var(--text-muted); border: 1px solid var(--border); }
.btn-ghost:hover { background: var(--surface); color: var(--text-secondary); border-color: var(--border); }
.icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border: none; border-radius: var(--radius-sm);
  background: transparent; color: var(--text-muted); cursor: pointer;
  transition: all var(--transition);
}
.icon-btn:hover { background: var(--surface); color: var(--text); }
.icon-btn.active { color: var(--accent); background: var(--accent-subtle); }

/* ---- Scrollbar ---- */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

/* ---- Loading spinner ---- */
.spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.2); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
`;
}

export function generatePopupJs(spec: ExtensionSpec): string {
  return `// ${spec.name} — Popup Controller

document.addEventListener('DOMContentLoaded', () => {
  const actionBtn    = document.getElementById('action-btn');
  const resetBtn     = document.getElementById('reset-btn');
  const settingsBtn  = document.getElementById('settings-btn');
  const quickToggle  = document.getElementById('quick-toggle');
  const logToggle    = document.getElementById('log-toggle');
  const clearLog     = document.getElementById('clear-log');
  const statusBar    = document.getElementById('status-bar');
  const statusText   = document.getElementById('status-text');
  const runCountEl   = document.getElementById('run-count');
  const resultArea   = document.getElementById('result-area');
  const logPanel     = document.getElementById('log-panel');
  const logEntries   = document.getElementById('log-entries');

  let isEnabled = true;
  let runCount = 0;

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

  function addLogEntry(msg) {
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = '<span class="log-time">' + time + '</span>' + msg;
    logEntries.prepend(entry);
    // Keep max 50 entries
    while (logEntries.children.length > 50) logEntries.lastChild.remove();
  }

  // Load state
  chrome.storage.local.get(['settings', 'stats'], (result) => {
    const s = result.settings || {};
    isEnabled = s.enabled !== false;
    quickToggle.classList.toggle('active', isEnabled);
    if (!isEnabled) {
      setStatus('disabled', 'Disabled');
      actionBtn.disabled = true;
    }

    const stats = result.stats || {};
    runCount = stats.runs || 0;
    runCountEl.textContent = runCount + ' runs';

    if (stats.lastRun) {
      setStatus('ready', 'Last run: ' + new Date(stats.lastRun).toLocaleTimeString());
    }
  });

  // Quick toggle
  quickToggle.addEventListener('click', () => {
    isEnabled = !isEnabled;
    quickToggle.classList.toggle('active', isEnabled);
    chrome.storage.local.get(['settings'], (r) => {
      const s = r.settings || {};
      s.enabled = isEnabled;
      chrome.storage.local.set({ settings: s });
    });
    if (isEnabled) {
      setStatus('ready', 'Ready');
      actionBtn.disabled = false;
      addLogEntry('Extension enabled');
    } else {
      setStatus('disabled', 'Disabled');
      actionBtn.disabled = true;
      addLogEntry('Extension disabled');
    }
  });

  // Run action
  actionBtn.addEventListener('click', async () => {
    if (!isEnabled) return;
    setStatus('running', 'Running…');
    actionBtn.disabled = true;
    actionBtn.innerHTML = '<span class="spinner"></span> Running…';
    addLogEntry('Action triggered');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab found');

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'run' });

      runCount++;
      runCountEl.textContent = runCount + ' runs';

      // Update stats
      chrome.storage.local.get(['stats'], (r) => {
        const stats = r.stats || { runs: 0, pages: 0, firstUse: Date.now() };
        stats.runs = (stats.runs || 0) + 1;
        stats.lastRun = Date.now();
        chrome.storage.local.set({ stats });
      });

      // Log activity
      chrome.storage.local.get(['activityLog'], (r) => {
        const log = r.activityLog || [];
        log.push({ url: tab.url, action: 'run', time: Date.now() });
        if (log.length > 100) log.splice(0, log.length - 100);
        chrome.storage.local.set({ activityLog: log });
      });

      if (response?.success) {
        setStatus('ready', 'Completed');
        showResult('✓ ' + (response.message || 'Action completed successfully.'), true);
        addLogEntry('✓ Completed on ' + (tab.url || '').slice(0, 50));
      } else {
        throw new Error(response?.error || 'Unknown error');
      }
    } catch (err) {
      setStatus('error', 'Error');
      showResult('⚠ ' + (err.message || 'Something went wrong'), false);
      addLogEntry('✗ Error: ' + (err.message || 'Unknown'));
    } finally {
      actionBtn.disabled = false;
      actionBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Run';
    }
  });

  // Log toggle
  logToggle.addEventListener('click', () => {
    logPanel.classList.toggle('hidden');
  });

  // Clear log
  clearLog.addEventListener('click', () => {
    logEntries.innerHTML = '';
    addLogEntry('Log cleared');
  });

  // Reset
  resetBtn.addEventListener('click', () => {
    setStatus('ready', 'Ready');
    resultArea.classList.add('hidden');
    resultArea.innerHTML = '';
    addLogEntry('Reset');
  });

  // Settings
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});`;
}

export function generateBackgroundJs(spec: ExtensionSpec): string {
  const safeName = spec.name.replace(/[^a-zA-Z0-9]/g, '_');
  return `// ${spec.name} — Background Service Worker

const DEFAULTS = {
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
  contextMenu: true,
  debugMode: false,
  cacheEnabled: true,
  cacheDuration: '3600',
  maxMemoryMB: '50',
  debounceMs: '300',
  collectAnonymousStats: false,
  clearDataOnUninstall: false,
  incognitoMode: false,
  dataRetention: '30',
  fontSize: 'medium',
  highContrast: false,
  reducedMotion: false,
  focusIndicators: true,
  shortcuts: { run: 'Ctrl+Shift+E', toggle: 'Ctrl+Shift+D', settings: 'Ctrl+Shift+,' }
};

// ── Install ──
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[${spec.name}] Installed — reason:', details.reason);
  chrome.storage.local.get(['settings'], (r) => {
    const merged = { ...DEFAULTS, ...(r.settings || {}) };
    chrome.storage.local.set({
      settings: merged,
      stats: { runs: 0, pages: 0, firstUse: Date.now() },
      state: { installed: true, timestamp: Date.now(), version: '1.0.0' },
    });
    if (merged.contextMenu) createContextMenus();
  });
});

// ── Context Menus ──
function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: '${safeName}_run',
      title: 'Run ${spec.name}',
      contexts: ['page', 'selection'],
    });
    chrome.contextMenus.create({
      id: '${safeName}_toggle',
      title: 'Toggle ${spec.name}',
      contexts: ['page'],
    });
    chrome.contextMenus.create({
      id: '${safeName}_settings',
      title: '${spec.name} Settings',
      contexts: ['page'],
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === '${safeName}_run' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'run', selectedText: info.selectionText || '' });
  } else if (info.menuItemId === '${safeName}_toggle') {
    chrome.storage.local.get(['settings'], (r) => {
      const s = r.settings || DEFAULTS;
      s.enabled = !s.enabled;
      chrome.storage.local.set({ settings: s });
      if (s.notifications) {
        chrome.action.setBadgeText({ text: s.enabled ? '' : 'OFF' });
        chrome.action.setBadgeBackgroundColor({ color: s.enabled ? '#22c55e' : '#ef4444' });
      }
    });
  } else if (info.menuItemId === '${safeName}_settings') {
    chrome.runtime.openOptionsPage();
  }
});

// ── Commands (keyboard shortcuts registered in manifest) ──
chrome.commands.onCommand.addListener((command) => {
  if (command === 'run-action') {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { action: 'run' });
    });
  } else if (command === 'toggle-extension') {
    chrome.storage.local.get(['settings'], (r) => {
      const s = r.settings || DEFAULTS;
      s.enabled = !s.enabled;
      chrome.storage.local.set({ settings: s });
      chrome.action.setBadgeText({ text: s.enabled ? '' : 'OFF' });
    });
  }
});

// ── Tab navigation: auto-run logic ──
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  chrome.storage.local.get(['settings'], (r) => {
    const s = r.settings || DEFAULTS;
    if (!s.enabled || !s.autorun) return;

    // Check schedule
    if (s.schedule) {
      const now = new Date();
      const h = now.getHours(), m = now.getMinutes();
      const current = h * 60 + m;
      const [sh, sm] = (s.scheduleStart || '09:00').split(':').map(Number);
      const [eh, em] = (s.scheduleEnd || '17:00').split(':').map(Number);
      if (current < sh * 60 + sm || current > eh * 60 + em) return;
    }

    // Check URL patterns
    if (s.urlPatterns && s.urlPatterns.trim()) {
      const patterns = s.urlPatterns.split('\\n').map(p => p.trim()).filter(Boolean);
      const matches = patterns.some(pattern => {
        const regex = new RegExp('^' + pattern.replace(/\\*/g, '.*').replace(/\\?/g, '.') + '$');
        return regex.test(tab.url);
      });
      if (!matches) return;
    }

    // Check incognito
    if (!s.incognitoMode && tab.incognito) return;

    const delay = parseInt(s.autorunDelay) || 1000;
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { action: 'run', autoRun: true }).catch(() => {});
    }, delay);
  });
});

// ── Message handling ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'getData':
      chrome.storage.local.get(['state', 'settings', 'stats'], (result) => {
        sendResponse({ success: true, data: result });
      });
      return true;

    case 'saveState':
      chrome.storage.local.set({ state: { ...message.data, lastRun: Date.now() } }, () => {
        sendResponse({ success: true });
      });
      return true;

    case 'getSettings':
      chrome.storage.local.get(['settings'], (r) => {
        sendResponse({ success: true, settings: { ...DEFAULTS, ...(r.settings || {}) } });
      });
      return true;

    case 'updateStats':
      chrome.storage.local.get(['stats'], (r) => {
        const stats = r.stats || { runs: 0, pages: 0, firstUse: Date.now() };
        if (message.increment === 'pages') {
          const pages = new Set(stats.pagesList || []);
          pages.add(message.url || '');
          stats.pages = pages.size;
          stats.pagesList = [...pages];
        }
        chrome.storage.local.set({ stats }, () => sendResponse({ success: true }));
      });
      return true;

    case 'log':
      if (message.level) console.log('[${spec.name}]', message.level + ':', message.message);
      sendResponse({ success: true });
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown action: ' + message.action });
  }
});

// ── Badge management ──
chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) {
    const s = changes.settings.newValue || DEFAULTS;
    if (s.badge) {
      chrome.action.setBadgeText({ text: s.enabled ? '' : 'OFF' });
      chrome.action.setBadgeBackgroundColor({ color: s.enabled ? '#22c55e' : '#ef4444' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
    // Rebuild context menus if setting changed
    if (s.contextMenu) createContextMenus();
    else chrome.contextMenus.removeAll();
  }
});`;
}

export function generateContentJs(spec: ExtensionSpec): string {
  const guard = spec.name.replace(/[^a-zA-Z]/g, '_');
  return `// ${spec.name} — Content Script
'use strict';

(function() {
  // Prevent double injection
  if (window.__${guard}_loaded) return;
  window.__${guard}_loaded = true;

  let settings = {};
  let debounceTimer = null;

  // Load settings from background
  chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
    if (response?.success) settings = response.settings;
  });

  // Listen for settings changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
      settings = changes.settings.newValue || {};
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!settings.enabled && settings.enabled !== undefined) {
      sendResponse({ success: false, error: 'Extension is disabled' });
      return true;
    }

    if (message.action === 'run') {
      const debounceMs = parseInt(settings.debounceMs) || 300;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        try {
          const result = performAction(message);
          // Track page
          chrome.runtime.sendMessage({ action: 'updateStats', increment: 'pages', url: window.location.hostname });
          // Persist last run
          chrome.runtime.sendMessage({ action: 'saveState', data: { lastRun: Date.now(), url: window.location.href } });
          // Debug log
          if (settings.debugMode) {
            chrome.runtime.sendMessage({ action: 'log', level: 'info', message: 'Action completed on ' + window.location.href });
          }
          sendResponse({ success: true, data: result, message: result.summary || 'Action completed' });
        } catch (error) {
          console.error('[${spec.name}] Error:', error);
          if (settings.debugMode) {
            chrome.runtime.sendMessage({ action: 'log', level: 'error', message: error.message });
          }
          sendResponse({ success: false, error: error.message });
        }
      }, message.autoRun ? 0 : debounceMs);

      return true; // async
    }

    if (message.action === 'ping') {
      sendResponse({ success: true, loaded: true, url: window.location.href });
      return;
    }

    if (message.action === 'getPageInfo') {
      sendResponse({
        success: true,
        data: {
          title: document.title,
          url: window.location.href,
          domain: window.location.hostname,
          contentLength: document.body?.innerText?.length || 0,
          links: document.querySelectorAll('a').length,
          images: document.querySelectorAll('img').length,
          headings: document.querySelectorAll('h1,h2,h3').length,
        }
      });
      return;
    }
  });

  function performAction(message) {
    const url = window.location.href;
    const title = document.title;
    const selectedText = message?.selectedText || window.getSelection()?.toString() || '';

    // Gather page metrics
    const metrics = {
      url,
      title,
      domain: window.location.hostname,
      timestamp: Date.now(),
      selectedText: selectedText.slice(0, 500),
      elements: {
        links: document.querySelectorAll('a[href]').length,
        images: document.querySelectorAll('img').length,
        headings: document.querySelectorAll('h1,h2,h3,h4').length,
        forms: document.querySelectorAll('form').length,
        buttons: document.querySelectorAll('button, [role="button"]').length,
        inputs: document.querySelectorAll('input, textarea, select').length,
      },
      meta: {
        description: document.querySelector('meta[name="description"]')?.content || '',
        keywords: document.querySelector('meta[name="keywords"]')?.content || '',
        author: document.querySelector('meta[name="author"]')?.content || '',
      },
      performance: {
        domElements: document.querySelectorAll('*').length,
        documentHeight: document.documentElement.scrollHeight,
        loadTime: performance.timing ? (performance.timing.loadEventEnd - performance.timing.navigationStart) : 0,
      }
    };

    console.log('[${spec.name}] Action executed:', metrics);

    return {
      processed: true,
      summary: 'Processed ' + metrics.domain + ' (' + metrics.elements.links + ' links, ' + metrics.elements.images + ' images)',
      ...metrics
    };
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
      --accent: #6366f1; --accent-hover: #818cf8;
      --accent-subtle: rgba(99, 102, 241, 0.08); --accent-border: rgba(99, 102, 241, 0.18);
      --bg: #09090b; --bg-elevated: #18181b; --surface: #1c1c20; --surface-hover: #232327;
      --text: #fafafa; --text-secondary: #a1a1aa; --text-muted: #71717a;
      --border: #27272a; --border-subtle: #1f1f23;
      --success: #22c55e; --warning: #f59e0b; --error: #ef4444; --info: #3b82f6;
      --radius: 12px; --radius-sm: 8px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; line-height: 1.6; }
    .container { max-width: 680px; margin: 0 auto; padding: 40px 24px 80px; }
    .page-header { margin-bottom: 32px; display: flex; align-items: center; gap: 14px; }
    .page-header img { width: 44px; height: 44px; border-radius: var(--radius-sm); }
    .page-header h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
    .page-header p { font-size: 13px; color: var(--text-muted); margin-top: 2px; }

    /* Tabs */
    .tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--border); margin-bottom: 24px; overflow-x: auto; scrollbar-width: none; }
    .tabs::-webkit-scrollbar { display: none; }
    .tab { padding: 10px 14px; font-size: 12px; font-weight: 500; color: var(--text-muted); background: none; border: none; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color 0.15s, border-color 0.15s; white-space: nowrap; }
    .tab:hover { color: var(--text-secondary); }
    .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }

    /* Sections */
    .section { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; margin-bottom: 16px; }
    .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .section-title svg { width: 14px; height: 14px; }
    .section-desc { font-size: 12px; color: var(--text-muted); margin-top: -10px; margin-bottom: 16px; }
    .setting-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--border-subtle); gap: 16px; }
    .setting-row:last-child { border-bottom: none; }
    .setting-info { flex: 1; }
    .setting-label { font-size: 14px; font-weight: 500; }
    .setting-desc { font-size: 12px; color: var(--text-muted); margin-top: 3px; }
    .setting-tag { display: inline-block; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; padding: 2px 6px; border-radius: 4px; margin-left: 8px; }
    .tag-new { background: rgba(34,197,94,0.15); color: var(--success); }
    .tag-beta { background: rgba(245,158,11,0.15); color: var(--warning); }

    /* Toggle */
    .toggle { position: relative; width: 42px; height: 24px; flex-shrink: 0; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle-slider { position: absolute; inset: 0; background: var(--border); border-radius: 12px; cursor: pointer; transition: background 0.2s; }
    .toggle-slider::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; background: var(--text-muted); border-radius: 50%; transition: transform 0.2s, background 0.2s; }
    .toggle input:checked + .toggle-slider { background: var(--accent); }
    .toggle input:checked + .toggle-slider::after { transform: translateX(18px); background: white; }

    /* Inputs */
    .input, .select { padding: 8px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 13px; font-family: inherit; outline: none; transition: border-color 0.15s; }
    .input:focus, .select:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-subtle); }
    .input { width: 100%; }
    .select { min-width: 140px; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; padding-right: 30px; }
    textarea.input { resize: vertical; font-family: 'SF Mono', 'Cascadia Code', monospace; font-size: 12px; }

    /* Range slider */
    .range-group { display: flex; align-items: center; gap: 12px; }
    .range-value { font-size: 12px; font-weight: 600; color: var(--accent); min-width: 40px; text-align: right; font-variant-numeric: tabular-nums; }
    input[type="range"] { -webkit-appearance: none; width: 140px; height: 4px; background: var(--border); border-radius: 2px; outline: none; }
    input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; background: var(--accent); border-radius: 50%; cursor: pointer; }

    /* Kbd */
    .kbd-input-group { display: flex; align-items: center; gap: 8px; }
    .kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 26px; padding: 0 6px; background: var(--surface); border: 1px solid var(--border); border-radius: 5px; font-size: 11px; font-weight: 600; color: var(--text-secondary); font-family: 'SF Mono', 'Cascadia Code', monospace; box-shadow: 0 1px 2px rgba(0,0,0,0.3); }
    .shortcut-record-btn { padding: 6px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-muted); font-size: 12px; cursor: pointer; transition: all 0.15s; }
    .shortcut-record-btn:hover { background: var(--surface-hover); color: var(--text-secondary); }
    .shortcut-record-btn.recording { border-color: var(--accent); color: var(--accent); background: var(--accent-subtle); animation: recording-pulse 1s ease-in-out infinite; }
    @keyframes recording-pulse { 0%, 100% { box-shadow: 0 0 0 0 var(--accent-subtle); } 50% { box-shadow: 0 0 0 4px var(--accent-subtle); } }

    /* Buttons */
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 20px; border: none; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; outline: none; }
    .btn-primary { background: var(--accent); color: white; }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-secondary { background: var(--surface); color: var(--text-secondary); border: 1px solid var(--border); }
    .btn-secondary:hover { background: var(--surface-hover); color: var(--text); }
    .btn-danger { background: rgba(239,68,68,0.1); color: var(--error); border: 1px solid rgba(239,68,68,0.2); }
    .btn-danger:hover { background: rgba(239,68,68,0.15); }
    .btn-group { display: flex; gap: 8px; flex-wrap: wrap; }

    /* Stats */
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
    .stat-card { background: var(--surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 14px; text-align: center; }
    .stat-value { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text); }
    .stat-label { font-size: 11px; color: var(--text-muted); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.04em; }

    /* Data table */
    .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .data-table th { text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); padding: 8px 12px; border-bottom: 1px solid var(--border); }
    .data-table td { padding: 10px 12px; border-bottom: 1px solid var(--border-subtle); color: var(--text-secondary); }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table tr:hover td { background: var(--surface); }

    /* Color dot */
    .color-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
    .dot-green { background: var(--success); }
    .dot-yellow { background: var(--warning); }
    .dot-red { background: var(--error); }
    .dot-blue { background: var(--info); }

    /* Permission badge */
    .perm-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 500; background: var(--surface); border: 1px solid var(--border-subtle); color: var(--text-secondary); margin: 3px; }
    .perm-badge .risk-dot { width: 6px; height: 6px; border-radius: 50%; }

    /* Footer bar */
    .footer-bar { position: fixed; bottom: 0; left: 0; right: 0; background: var(--bg-elevated); border-top: 1px solid var(--border); padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 10; backdrop-filter: blur(8px); }
    .footer-bar .version-text { font-size: 12px; color: var(--text-muted); }
    .footer-bar .save-status { font-size: 11px; color: var(--text-muted); margin-right: 12px; }

    /* Toast */
    .toast { position: fixed; bottom: 72px; right: 24px; padding: 10px 18px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; transform: translateY(20px); opacity: 0; transition: all 0.3s ease; z-index: 20; display: flex; align-items: center; gap: 8px; }
    .toast.show { transform: translateY(0); opacity: 1; }
    .toast-success { background: var(--success); color: white; }
    .toast-error { background: var(--error); color: white; }
    .toast-info { background: var(--info); color: white; }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; z-index: 100; }
    .modal-overlay.open { display: flex; }
    .modal { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; width: 90%; max-width: 420px; }
    .modal h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
    .modal p { font-size: 13px; color: var(--text-muted); margin-bottom: 20px; }

    /* Info box */
    .info-box { padding: 12px 16px; border-radius: var(--radius-sm); font-size: 12px; color: var(--text-muted); margin-bottom: 16px; display: flex; align-items: flex-start; gap: 10px; }
    .info-box svg { flex-shrink: 0; width: 16px; height: 16px; margin-top: 1px; }
    .info-box.info { background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.15); color: var(--info); }
    .info-box.warning { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.15); color: var(--warning); }

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
        <p>Configuration &amp; Preferences</p>
      </div>
    </div>

    <div class="tabs">
      <button class="tab active" data-tab="general">⚙ General</button>
      <button class="tab" data-tab="shortcuts">⌨ Shortcuts</button>
      <button class="tab" data-tab="automation">⚡ Automation</button>
      <button class="tab" data-tab="privacy">🔒 Privacy</button>
      <button class="tab" data-tab="performance">🚀 Performance</button>
      <button class="tab" data-tab="accessibility">♿ Accessibility</button>
      <button class="tab" data-tab="data">📊 Data</button>
      <button class="tab" data-tab="about">ℹ About</button>
    </div>

    <!-- ═══ GENERAL ═══ -->
    <div class="tab-panel active" id="panel-general">
      <div class="section">
        <div class="section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg> Core Settings</div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Enable Extension</div><div class="setting-desc">Turn the extension on or off globally</div></div>
          <label class="toggle"><input type="checkbox" id="toggle-enabled" checked /><span class="toggle-slider"></span></label>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Notifications</div><div class="setting-desc">Show desktop notifications for events</div></div>
          <label class="toggle"><input type="checkbox" id="toggle-notifications" checked /><span class="toggle-slider"></span></label>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Badge Counter</div><div class="setting-desc">Show status indicator on toolbar icon</div></div>
          <label class="toggle"><input type="checkbox" id="toggle-badge" checked /><span class="toggle-slider"></span></label>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Context Menu</div><div class="setting-desc">Add right-click menu items to web pages</div></div>
          <label class="toggle"><input type="checkbox" id="toggle-context-menu" checked /><span class="toggle-slider"></span></label>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Debug Mode<span class="setting-tag tag-beta">DEV</span></div><div class="setting-desc">Show verbose logging in browser console</div></div>
          <label class="toggle"><input type="checkbox" id="toggle-debug" /><span class="toggle-slider"></span></label>
        </div>
      </div>

      <div class="section">
        <div class="section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> Appearance</div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Theme</div><div class="setting-desc">Choose popup color scheme</div></div>
          <select class="select" id="select-theme"><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Popup Width</div><div class="setting-desc">Set popup window width</div></div>
          <select class="select" id="select-popup-width"><option value="360">Compact (360px)</option><option value="380" selected>Default (380px)</option><option value="420">Wide (420px)</option><option value="480">Extra Wide (480px)</option></select>
        </div>
      </div>
    </div>

    <!-- ═══ SHORTCUTS ═══ -->
    <div class="tab-panel" id="panel-shortcuts">
      <div class="info-box info">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>Click the ⌨ button then press your desired key combination. Press <strong>Escape</strong> to cancel. Shortcuts defined in manifest.json take effect globally.</span>
      </div>
      <div class="section">
        <div class="section-title">⌨ Keyboard Shortcuts</div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Run Action</div><div class="setting-desc">Execute primary extension action on current page</div></div>
          <div class="kbd-input-group">
            <span class="shortcut-display" id="shortcut-run"><span class="kbd">Ctrl</span><span class="kbd">Shift</span><span class="kbd">E</span></span>
            <button class="shortcut-record-btn" data-shortcut="run">⌨</button>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Toggle Extension</div><div class="setting-desc">Enable or disable the extension quickly</div></div>
          <div class="kbd-input-group">
            <span class="shortcut-display" id="shortcut-toggle"><span class="kbd">Ctrl</span><span class="kbd">Shift</span><span class="kbd">D</span></span>
            <button class="shortcut-record-btn" data-shortcut="toggle">⌨</button>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Open Settings</div><div class="setting-desc">Open this settings page</div></div>
          <div class="kbd-input-group">
            <span class="shortcut-display" id="shortcut-settings"><span class="kbd">Ctrl</span><span class="kbd">Shift</span><span class="kbd">,</span></span>
            <button class="shortcut-record-btn" data-shortcut="settings">⌨</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ AUTOMATION ═══ -->
    <div class="tab-panel" id="panel-automation">
      <div class="section">
        <div class="section-title">⚡ Auto-Run</div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Run on Page Load</div><div class="setting-desc">Automatically execute when a matching page loads</div></div>
          <label class="toggle"><input type="checkbox" id="toggle-autorun" /><span class="toggle-slider"></span></label>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Auto-Run Delay</div><div class="setting-desc">Wait before auto-running</div></div>
          <select class="select" id="select-autorun-delay"><option value="0">Instant</option><option value="500">500ms</option><option value="1000" selected>1 second</option><option value="2000">2 seconds</option><option value="3000">3 seconds</option><option value="5000">5 seconds</option></select>
        </div>
      </div>

      <div class="section">
        <div class="section-title">🔗 URL Filters</div>
        <div class="section-desc">Only auto-run on matching URLs. Leave empty for all sites. Supports wildcards (*).</div>
        <div class="setting-row" style="flex-direction:column;align-items:stretch;">
          <textarea class="input" id="url-patterns" rows="4" placeholder="https://www.youtube.com/*&#10;https://github.com/*&#10;*://docs.google.com/*"></textarea>
        </div>
      </div>

      <div class="section">
        <div class="section-title">🕒 Schedule</div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Active Hours Only</div><div class="setting-desc">Restrict auto-run to specific hours</div></div>
          <label class="toggle"><input type="checkbox" id="toggle-schedule" /><span class="toggle-slider"></span></label>
        </div>
        <div class="setting-row" id="schedule-times" style="display:none;">
          <div class="setting-info"><div class="setting-label">Time Range</div></div>
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="time" class="input" id="schedule-start" value="09:00" style="width:auto;" />
            <span style="color:var(--text-muted);">→</span>
            <input type="time" class="input" id="schedule-end" value="17:00" style="width:auto;" />
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ PRIVACY ═══ -->
    <div class="tab-panel" id="panel-privacy">
      <div class="info-box warning">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span>Your privacy matters. All data is stored locally on your device and never transmitted to external servers unless you explicitly enable it.</span>
      </div>
      <div class="section">
        <div class="section-title">🔒 Data Collection</div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Anonymous Usage Statistics</div><div class="setting-desc">Help improve this extension by sharing anonymous usage data</div></div>
          <label class="toggle"><input type="checkbox" id="toggle-anonymous-stats" /><span class="toggle-slider"></span></label>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Activity Logging</div><div class="setting-desc">Keep a local log of actions performed (visible in Data tab)</div></div>
          <label class="toggle"><input type="checkbox" id="toggle-activity-log" checked /><span class="toggle-slider"></span></label>
        </div>
      </div>

      <div class="section">
        <div class="section-title">🗑 Data Retention</div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Auto-Delete Old Data</div><div class="setting-desc">Automatically remove activity logs older than</div></div>
          <select class="select" id="select-data-retention"><option value="7">7 days</option><option value="14">14 days</option><option value="30" selected>30 days</option><option value="90">90 days</option><option value="0">Never</option></select>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Clear Data on Uninstall</div><div class="setting-desc">Remove all stored data when the extension is uninstalled</div></div>
          <label class="toggle"><input type="checkbox" id="toggle-clear-on-uninstall" /><span class="toggle-slider"></span></label>
        </div>
      </div>

      <div class="section">
        <div class="section-title">🕵 Incognito</div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Work in Incognito</div><div class="setting-desc">Allow extension to run in incognito/private windows</div></div>
          <label class="toggle"><input type="checkbox" id="toggle-incognito" /><span class="toggle-slider"></span></label>
        </div>
      </div>
    </div>

    <!-- ═══ PERFORMANCE ═══ -->
    <div class="tab-panel" id="panel-performance">
      <div class="section">
        <div class="section-title">💾 Cache</div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Enable Caching</div><div class="setting-desc">Cache results to reduce redundant processing</div></div>
          <label class="toggle"><input type="checkbox" id="toggle-cache" checked /><span class="toggle-slider"></span></label>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Cache Duration</div><div class="setting-desc">How long to keep cached results</div></div>
          <select class="select" id="select-cache-duration"><option value="300">5 minutes</option><option value="900">15 minutes</option><option value="1800">30 minutes</option><option value="3600" selected>1 hour</option><option value="86400">24 hours</option></select>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Clear Cache Now</div><div class="setting-desc">Remove all cached data immediately</div></div>
          <button class="btn btn-secondary" id="btn-clear-cache">Clear Cache</button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">⚙ Resource Limits</div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Max Memory Usage</div><div class="setting-desc">Limit extension memory consumption</div></div>
          <div class="range-group">
            <input type="range" id="range-memory" min="10" max="200" value="50" step="10" />
            <span class="range-value" id="memory-value">50 MB</span>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Action Debounce</div><div class="setting-desc">Minimum time between consecutive actions</div></div>
          <div class="range-group">
            <input type="range" id="range-debounce" min="0" max="2000" value="300" step="100" />
            <span class="range-value" id="debounce-value">300ms</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ ACCESSIBILITY ═══ -->
    <div class="tab-panel" id="panel-accessibility">
      <div class="section">
        <div class="section-title">♿ Display</div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Font Size</div><div class="setting-desc">Adjust text size in the popup and options</div></div>
          <select class="select" id="select-font-size"><option value="small">Small</option><option value="medium" selected>Medium</option><option value="large">Large</option><option value="x-large">Extra Large</option></select>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">High Contrast Mode</div><div class="setting-desc">Increase contrast for better visibility</div></div>
          <label class="toggle"><input type="checkbox" id="toggle-high-contrast" /><span class="toggle-slider"></span></label>
        </div>
      </div>

      <div class="section">
        <div class="section-title">🎬 Motion</div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Reduce Motion</div><div class="setting-desc">Minimize animations and transitions</div></div>
          <label class="toggle"><input type="checkbox" id="toggle-reduced-motion" /><span class="toggle-slider"></span></label>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Focus Indicators</div><div class="setting-desc">Show visible focus outlines for keyboard navigation</div></div>
          <label class="toggle"><input type="checkbox" id="toggle-focus-indicators" checked /><span class="toggle-slider"></span></label>
        </div>
      </div>
    </div>

    <!-- ═══ DATA ═══ -->
    <div class="tab-panel" id="panel-data">
      <div class="section">
        <div class="section-title">📊 Usage Statistics</div>
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-value" id="stat-runs">0</div><div class="stat-label">Total Runs</div></div>
          <div class="stat-card"><div class="stat-value" id="stat-pages">0</div><div class="stat-label">Pages</div></div>
          <div class="stat-card"><div class="stat-value" id="stat-days">0</div><div class="stat-label">Days Active</div></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">📝 Recent Activity</div>
        <table class="data-table">
          <thead><tr><th>Page</th><th>Action</th><th>Time</th></tr></thead>
          <tbody id="activity-log"><tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px;">No activity yet</td></tr></tbody>
        </table>
      </div>

      <div class="section">
        <div class="section-title">💾 Export &amp; Import</div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Export All Data</div><div class="setting-desc">Download settings, logs, and history as JSON</div></div>
          <button class="btn btn-secondary" id="btn-export">⬇ Export</button>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Import Data</div><div class="setting-desc">Restore from a previously exported JSON file</div></div>
          <label class="btn btn-secondary" style="cursor:pointer;">⬆ Import<input type="file" id="btn-import" accept=".json" style="display:none;" /></label>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Export as CSV</div><div class="setting-desc">Download activity log as spreadsheet<span class="setting-tag tag-new">NEW</span></div></div>
          <button class="btn btn-secondary" id="btn-export-csv">📄 CSV</button>
        </div>
        <div class="setting-row">
          <div class="setting-info"><div class="setting-label">Clear All Data</div><div class="setting-desc">Remove all stored data and reset to defaults</div></div>
          <button class="btn btn-danger" id="btn-clear">🗑 Clear Data</button>
        </div>
      </div>
    </div>

    <!-- ═══ ABOUT ═══ -->
    <div class="tab-panel" id="panel-about">
      <div class="section">
        <div class="section-title">ℹ Extension Info</div>
        <div class="setting-row"><div class="setting-info"><div class="setting-label">Name</div></div><span style="font-size:13px;color:var(--text-secondary);">${spec.name}</span></div>
        <div class="setting-row"><div class="setting-info"><div class="setting-label">Version</div></div><span class="kbd">1.0.0</span></div>
        <div class="setting-row"><div class="setting-info"><div class="setting-label">Manifest</div></div><span class="kbd">v3</span></div>
        <div class="setting-row"><div class="setting-info"><div class="setting-label">Description</div></div><span style="font-size:13px;color:var(--text-secondary);max-width:300px;text-align:right;">${spec.description}</span></div>
      </div>

      <div class="section">
        <div class="section-title">🔑 Permissions</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${spec.permissions.map((p) => {
            const risk = ['tabs', 'webNavigation', 'history', 'cookies'].includes(p) ? 'dot-yellow' : ['<all_urls>', 'debugger'].includes(p) ? 'dot-red' : 'dot-green';
            return `<span class="perm-badge"><span class="risk-dot ${risk}"></span>${p}</span>`;
          }).join('\n          ')}
        </div>
      </div>

      <div class="section">
        <div class="section-title">📋 Features</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${spec.features.map((f) => `<div style="font-size:13px;color:var(--text-secondary);padding:6px 0;border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;gap:8px;"><span class="color-dot dot-blue"></span>${f}</div>`).join('\n          ')}
        </div>
      </div>

      <div class="section">
        <div class="section-title">🆘 Support</div>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">Found a bug or have feedback?</p>
        <div class="btn-group">
          <button class="btn btn-secondary" onclick="chrome.tabs.create({url:'mailto:support@example.com'})">📧 Contact Support</button>
          <button class="btn btn-secondary" onclick="chrome.tabs.create({url:'https://chrome.google.com/webstore'})">⭐ Rate Extension</button>
          <button class="btn btn-secondary" id="btn-reset-defaults">🔄 Reset to Defaults</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Footer Bar -->
  <div class="footer-bar">
    <span class="version-text">${spec.name} v1.0.0</span>
    <div style="display:flex;align-items:center;">
      <span class="save-status" id="save-status"></span>
      <button class="btn btn-primary" id="save-btn">💾 Save Settings</button>
    </div>
  </div>

  <!-- Clear Data Confirmation Modal -->
  <div class="modal-overlay" id="clear-modal">
    <div class="modal">
      <h3>⚠ Clear All Data?</h3>
      <p>This will permanently delete all stored settings, activity logs, and cached data. This action cannot be undone.</p>
      <div class="btn-group" style="justify-content:flex-end;">
        <button class="btn btn-secondary" id="clear-cancel">Cancel</button>
        <button class="btn btn-danger" id="clear-confirm">Clear Everything</button>
      </div>
    </div>
  </div>

  <!-- Reset Defaults Modal -->
  <div class="modal-overlay" id="reset-modal">
    <div class="modal">
      <h3>🔄 Reset to Defaults?</h3>
      <p>This will restore all settings to their original values. Your activity data will be preserved.</p>
      <div class="btn-group" style="justify-content:flex-end;">
        <button class="btn btn-secondary" id="reset-cancel">Cancel</button>
        <button class="btn btn-primary" id="reset-confirm">Reset Settings</button>
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
    enabled:         document.getElementById('toggle-enabled'),
    notifications:   document.getElementById('toggle-notifications'),
    badge:           document.getElementById('toggle-badge'),
    contextMenu:     document.getElementById('toggle-context-menu'),
    debugMode:       document.getElementById('toggle-debug'),
    theme:           document.getElementById('select-theme'),
    popupWidth:      document.getElementById('select-popup-width'),
    autorun:         document.getElementById('toggle-autorun'),
    autorunDelay:    document.getElementById('select-autorun-delay'),
    urlPatterns:     document.getElementById('url-patterns'),
    schedule:        document.getElementById('toggle-schedule'),
    scheduleRow:     document.getElementById('schedule-times'),
    schedStart:      document.getElementById('schedule-start'),
    schedEnd:        document.getElementById('schedule-end'),
    anonymousStats:  document.getElementById('toggle-anonymous-stats'),
    activityLogToggle: document.getElementById('toggle-activity-log'),
    dataRetention:   document.getElementById('select-data-retention'),
    clearOnUninstall:document.getElementById('toggle-clear-on-uninstall'),
    incognito:       document.getElementById('toggle-incognito'),
    cacheEnabled:    document.getElementById('toggle-cache'),
    cacheDuration:   document.getElementById('select-cache-duration'),
    clearCacheBtn:   document.getElementById('btn-clear-cache'),
    memoryRange:     document.getElementById('range-memory'),
    memoryValue:     document.getElementById('memory-value'),
    debounceRange:   document.getElementById('range-debounce'),
    debounceValue:   document.getElementById('debounce-value'),
    fontSize:        document.getElementById('select-font-size'),
    highContrast:    document.getElementById('toggle-high-contrast'),
    reducedMotion:   document.getElementById('toggle-reduced-motion'),
    focusIndicators: document.getElementById('toggle-focus-indicators'),
    saveBtn:         document.getElementById('save-btn'),
    saveStatus:      document.getElementById('save-status'),
    exportBtn:       document.getElementById('btn-export'),
    exportCsvBtn:    document.getElementById('btn-export-csv'),
    importInput:     document.getElementById('btn-import'),
    clearBtn:        document.getElementById('btn-clear'),
    clearModal:      document.getElementById('clear-modal'),
    clearCancel:     document.getElementById('clear-cancel'),
    clearConfirm:    document.getElementById('clear-confirm'),
    resetBtn:        document.getElementById('btn-reset-defaults'),
    resetModal:      document.getElementById('reset-modal'),
    resetCancel:     document.getElementById('reset-cancel'),
    resetConfirm:    document.getElementById('reset-confirm'),
    toast:           document.getElementById('toast'),
    statRuns:        document.getElementById('stat-runs'),
    statPages:       document.getElementById('stat-pages'),
    statDays:        document.getElementById('stat-days'),
    activityLog:     document.getElementById('activity-log'),
  };

  // ── Defaults ──
  const defaults = {
    enabled: true, notifications: true, badge: true, contextMenu: true, debugMode: false,
    theme: 'dark', popupWidth: '380',
    autorun: false, autorunDelay: '1000', urlPatterns: '',
    schedule: false, scheduleStart: '09:00', scheduleEnd: '17:00',
    collectAnonymousStats: false, activityLogging: true,
    dataRetention: '30', clearDataOnUninstall: false, incognitoMode: false,
    cacheEnabled: true, cacheDuration: '3600', maxMemoryMB: '50', debounceMs: '300',
    fontSize: 'medium', highContrast: false, reducedMotion: false, focusIndicators: true,
    shortcuts: { run: 'Ctrl+Shift+E', toggle: 'Ctrl+Shift+D', settings: 'Ctrl+Shift+,' }
  };

  // ── Range slider live updates ──
  els.memoryRange.addEventListener('input', () => { els.memoryValue.textContent = els.memoryRange.value + ' MB'; });
  els.debounceRange.addEventListener('input', () => { els.debounceValue.textContent = els.debounceRange.value + 'ms'; });

  // ── Show/hide schedule ──
  els.schedule.addEventListener('change', () => { els.scheduleRow.style.display = els.schedule.checked ? 'flex' : 'none'; });

  // ── Load settings ──
  chrome.storage.local.get(['settings', 'stats', 'activityLog'], (result) => {
    const s = { ...defaults, ...(result.settings || {}) };
    els.enabled.checked         = s.enabled;
    els.notifications.checked   = s.notifications;
    els.badge.checked           = s.badge;
    els.contextMenu.checked     = s.contextMenu;
    els.debugMode.checked       = s.debugMode;
    els.theme.value             = s.theme;
    els.popupWidth.value        = s.popupWidth;
    els.autorun.checked         = s.autorun;
    els.autorunDelay.value      = s.autorunDelay;
    els.urlPatterns.value       = s.urlPatterns;
    els.schedule.checked        = s.schedule;
    els.schedStart.value        = s.scheduleStart;
    els.schedEnd.value          = s.scheduleEnd;
    els.scheduleRow.style.display = s.schedule ? 'flex' : 'none';
    els.anonymousStats.checked  = s.collectAnonymousStats;
    els.activityLogToggle.checked = s.activityLogging !== false;
    els.dataRetention.value     = s.dataRetention || '30';
    els.clearOnUninstall.checked = s.clearDataOnUninstall;
    els.incognito.checked       = s.incognitoMode;
    els.cacheEnabled.checked    = s.cacheEnabled;
    els.cacheDuration.value     = s.cacheDuration || '3600';
    els.memoryRange.value       = s.maxMemoryMB || '50';
    els.memoryValue.textContent = (s.maxMemoryMB || '50') + ' MB';
    els.debounceRange.value     = s.debounceMs || '300';
    els.debounceValue.textContent = (s.debounceMs || '300') + 'ms';
    els.fontSize.value          = s.fontSize || 'medium';
    els.highContrast.checked    = s.highContrast;
    els.reducedMotion.checked   = s.reducedMotion;
    els.focusIndicators.checked = s.focusIndicators !== false;

    // Shortcuts
    if (s.shortcuts) Object.entries(s.shortcuts).forEach(([k, v]) => renderShortcut(k, v));

    // Stats
    const stats = result.stats || { runs: 0, pages: 0, firstUse: Date.now() };
    els.statRuns.textContent  = stats.runs || 0;
    els.statPages.textContent = stats.pages || 0;
    els.statDays.textContent  = Math.max(1, Math.floor((Date.now() - (stats.firstUse || Date.now())) / 86400000));

    // Activity log
    const log = result.activityLog || [];
    if (log.length > 0) {
      els.activityLog.innerHTML = log.slice(-15).reverse().map(e =>
        '<tr><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
        (e.url || '—') + '</td><td>' + (e.action || 'run') +
        '</td><td style="white-space:nowrap;">' + new Date(e.time).toLocaleString() + '</td></tr>'
      ).join('');
    }
  });

  // ── Shortcut recording ──
  let recordingTarget = null;
  document.querySelectorAll('.shortcut-record-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (recordingTarget) document.querySelector('.shortcut-record-btn.recording')?.classList.remove('recording');
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
      btn?.classList.remove('recording'); btn.textContent = '⌨'; recordingTarget = null; return;
    }
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
    renderShortcut(recordingTarget, parts.join('+'));
    const btn = document.querySelector('.shortcut-record-btn.recording');
    btn?.classList.remove('recording'); btn.textContent = '⌨'; recordingTarget = null;
  });

  function renderShortcut(name, combo) {
    const el = document.getElementById('shortcut-' + name);
    if (el) el.innerHTML = combo.split('+').map(k => '<span class="kbd">' + k + '</span>').join(' ');
  }

  // ── Gather settings ──
  function gatherSettings() {
    const shortcuts = {};
    ['run', 'toggle', 'settings'].forEach(n => {
      const el = document.getElementById('shortcut-' + n);
      if (el) shortcuts[n] = Array.from(el.querySelectorAll('.kbd')).map(k => k.textContent).join('+');
    });
    return {
      enabled: els.enabled.checked, notifications: els.notifications.checked, badge: els.badge.checked,
      contextMenu: els.contextMenu.checked, debugMode: els.debugMode.checked,
      theme: els.theme.value, popupWidth: els.popupWidth.value,
      autorun: els.autorun.checked, autorunDelay: els.autorunDelay.value, urlPatterns: els.urlPatterns.value,
      schedule: els.schedule.checked, scheduleStart: els.schedStart.value, scheduleEnd: els.schedEnd.value,
      collectAnonymousStats: els.anonymousStats.checked, activityLogging: els.activityLogToggle.checked,
      dataRetention: els.dataRetention.value, clearDataOnUninstall: els.clearOnUninstall.checked, incognitoMode: els.incognito.checked,
      cacheEnabled: els.cacheEnabled.checked, cacheDuration: els.cacheDuration.value,
      maxMemoryMB: els.memoryRange.value, debounceMs: els.debounceRange.value,
      fontSize: els.fontSize.value, highContrast: els.highContrast.checked,
      reducedMotion: els.reducedMotion.checked, focusIndicators: els.focusIndicators.checked,
      shortcuts,
    };
  }

  // ── Toast ──
  function showToast(msg, type = 'success') {
    els.toast.textContent = msg;
    els.toast.className = 'toast toast-' + type + ' show';
    setTimeout(() => els.toast.classList.remove('show'), 2500);
  }

  // ── Save ──
  els.saveBtn.addEventListener('click', () => {
    els.saveStatus.textContent = 'Saving…';
    chrome.storage.local.set({ settings: gatherSettings() }, () => {
      showToast('✓ Settings saved successfully');
      els.saveStatus.textContent = 'Saved ✓';
      setTimeout(() => { els.saveStatus.textContent = ''; }, 3000);
    });
  });

  // ── Clear Cache ──
  els.clearCacheBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['cache'], () => showToast('Cache cleared ✓'));
  });

  // ── Export JSON ──
  els.exportBtn.addEventListener('click', () => {
    chrome.storage.local.get(null, (allData) => {
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = '${spec.name.toLowerCase().replace(/\s+/g, '-')}-backup.json';
      a.click(); URL.revokeObjectURL(url);
      showToast('Data exported ✓');
    });
  });

  // ── Export CSV ──
  els.exportCsvBtn.addEventListener('click', () => {
    chrome.storage.local.get(['activityLog'], (r) => {
      const log = r.activityLog || [];
      if (!log.length) { showToast('No activity data to export', 'info'); return; }
      const csv = 'URL,Action,Timestamp\\n' + log.map(e =>
        '"' + (e.url || '').replace(/"/g, '""') + '","' + (e.action || 'run') + '","' + new Date(e.time).toISOString() + '"'
      ).join('\\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = '${spec.name.toLowerCase().replace(/\s+/g, '-')}-activity.csv';
      a.click(); URL.revokeObjectURL(url);
      showToast('CSV exported ✓');
    });
  });

  // ── Import ──
  els.importInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        chrome.storage.local.set(data, () => { showToast('Data imported ✓'); setTimeout(() => location.reload(), 800); });
      } catch { showToast('Invalid JSON file', 'error'); }
    };
    reader.readAsText(file);
  });

  // ── Clear Data ──
  els.clearBtn.addEventListener('click', () => els.clearModal.classList.add('open'));
  els.clearCancel.addEventListener('click', () => els.clearModal.classList.remove('open'));
  els.clearConfirm.addEventListener('click', () => {
    chrome.storage.local.clear(() => { els.clearModal.classList.remove('open'); showToast('All data cleared'); setTimeout(() => location.reload(), 800); });
  });

  // ── Reset Defaults ──
  els.resetBtn.addEventListener('click', () => els.resetModal.classList.add('open'));
  els.resetCancel.addEventListener('click', () => els.resetModal.classList.remove('open'));
  els.resetConfirm.addEventListener('click', () => {
    chrome.storage.local.set({ settings: { ...defaults } }, () => { els.resetModal.classList.remove('open'); showToast('Settings reset to defaults ✓'); setTimeout(() => location.reload(), 800); });
  });
});`;
}

export function generateReadme(spec: ExtensionSpec): string {
  const safeName = spec.name.toLowerCase().replace(/\s+/g, '-');
  const featuresList = spec.features.map(f => `- ✅ **${f}**`).join('\n');
  const permissionsList = spec.permissions.map(p => `| \`${p}\` | Required for core extension functionality |`).join('\n');

  return `# ${spec.name}

> ${spec.description}

![Chrome Web Store](https://img.shields.io/badge/Manifest-V3-brightgreen?style=flat-square)
![Version](https://img.shields.io/badge/Version-1.0.0-blue?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

---

## 📋 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Usage](#-usage)
- [Configuration](#-configuration)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [File Structure](#-file-structure)
- [Permissions](#-permissions)
- [Development](#-development)
- [Privacy Policy](#-privacy-policy)
- [Changelog](#-changelog)
- [License](#-license)

---

## ✨ Features

${featuresList}

---

## 🚀 Installation

### From Chrome Web Store
1. Visit the [Chrome Web Store listing](#) for **${spec.name}**
2. Click **"Add to Chrome"**
3. Confirm the permissions prompt
4. The extension icon will appear in your toolbar

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and navigate to \`chrome://extensions/\`
3. Enable **"Developer mode"** (toggle in top-right corner)
4. Click **"Load unpacked"**
5. Select the extension folder containing \`manifest.json\`
6. The extension is now installed and ready to use

---

## 📖 Usage

### Quick Start
1. Click the **${spec.name}** icon in your Chrome toolbar
2. The popup will show the current status and available features
3. Click **"Run"** to execute the primary action on the current page
4. View results directly in the popup

### Context Menu
Right-click on any webpage to access ${spec.name} actions:
- **Run ${spec.name}** — Execute the primary action
- **Toggle ${spec.name}** — Enable/disable the extension
- **${spec.name} Settings** — Open the configuration page

### Status Indicators
| Status | Meaning |
|--------|---------|
| 🟢 Ready | Extension is active and ready |
| 🔵 Running | Action is being executed |
| 🔴 Error | An error occurred |
| ⚫ Disabled | Extension is turned off |

---

## ⚙ Configuration

Access settings by clicking the gear icon in the popup, or right-click → **${spec.name} Settings**.

### General Settings
| Setting | Description | Default |
|---------|-------------|---------|
| Enable Extension | Global on/off toggle | ✅ On |
| Notifications | Desktop notifications for events | ✅ On |
| Badge Counter | Status indicator on toolbar icon | ✅ On |
| Context Menu | Right-click menu integration | ✅ On |
| Debug Mode | Verbose console logging | ❌ Off |
| Theme | Dark / Light / System | Dark |
| Popup Width | 360px / 380px / 420px / 480px | 380px |

### Automation Settings
| Setting | Description | Default |
|---------|-------------|---------|
| Auto-Run on Page Load | Execute action automatically | ❌ Off |
| Auto-Run Delay | Delay before auto-execution | 1 second |
| URL Filters | Restrict auto-run to specific URLs (wildcards supported) | All sites |
| Active Hours | Schedule when auto-run is active | 09:00–17:00 |

### Privacy Settings
| Setting | Description | Default |
|---------|-------------|---------|
| Anonymous Statistics | Share anonymous usage data | ❌ Off |
| Activity Logging | Keep local activity log | ✅ On |
| Data Retention | Auto-delete logs older than N days | 30 days |
| Clear on Uninstall | Remove data when extension is removed | ❌ Off |
| Incognito Mode | Allow in private browsing | ❌ Off |

### Performance Settings
| Setting | Description | Default |
|---------|-------------|---------|
| Caching | Cache results to reduce redundant work | ✅ On |
| Cache Duration | How long to keep cached results | 1 hour |
| Max Memory | Memory usage limit | 50 MB |
| Action Debounce | Minimum time between actions | 300ms |

### Accessibility Settings
| Setting | Description | Default |
|---------|-------------|---------|
| Font Size | Small / Medium / Large / Extra Large | Medium |
| High Contrast | Increase visual contrast | ❌ Off |
| Reduce Motion | Minimize animations | ❌ Off |
| Focus Indicators | Visible keyboard focus outlines | ✅ On |

---

## ⌨ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| \`Ctrl+Shift+E\` | Run primary action |
| \`Ctrl+Shift+D\` | Toggle extension on/off |
| \`Ctrl+Shift+,\` | Open settings page |

> **Tip:** Customize shortcuts in the Settings → Shortcuts tab, or via \`chrome://extensions/shortcuts\`.

---

## 📁 File Structure

\`\`\`
${safeName}/
├── manifest.json          # Extension manifest (Manifest V3)
├── background.js          # Service worker (auto-run, commands, context menus)
├── content.js             # Content script (page interaction logic)
├── content-styles.css     # Injected page styles
├── popup.html             # Popup UI
├── popup.js               # Popup controller
├── styles.css             # Popup & shared styles
├── options.html           # Settings page (8-tab configuration)
├── options.js             # Settings controller
├── README.md              # This file
└── icons/
    ├── icon16.png         # Toolbar icon
    ├── icon48.png         # Extensions page icon
    └── icon128.png        # Chrome Web Store icon
\`\`\`

---

## 🔑 Permissions

| Permission | Justification |
|------------|--------------|
${permissionsList}
| \`storage\` | Save user settings, activity logs, and cached data locally |
| \`contextMenus\` | Add right-click menu integration for quick actions |

> All data is stored locally using \`chrome.storage.local\`. No data is transmitted externally unless you explicitly enable anonymous statistics.

---

## 🛠 Development

### Prerequisites
- Google Chrome (latest stable)
- Basic knowledge of JavaScript, HTML, CSS

### Local Development
1. Clone or download the project
2. Make changes to the source files
3. Go to \`chrome://extensions/\` → click **"Reload"** on the extension card
4. Open Chrome DevTools (\`F12\`) → check the Console for logs

### Testing
- **Popup:** Click the extension icon to test popup functionality
- **Content Script:** Navigate to a test page and check console logs
- **Background:** Go to \`chrome://extensions/\` → click **"Inspect views: service worker"**
- **Options:** Right-click icon → **Options** or navigate to the options page

### Building for Production
This extension is ready to load as-is. For Chrome Web Store submission:
1. Remove any debug/development code
2. Create a ZIP file of the extension directory
3. Upload at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)

---

## 🔐 Privacy Policy

**${spec.name}** respects your privacy:

- **Local Storage Only:** All data (settings, logs, cache) is stored on your device using Chrome's \`chrome.storage.local\` API
- **No External Servers:** No data is sent to external servers by default
- **Optional Analytics:** Anonymous usage statistics can be enabled in Settings → Privacy (disabled by default)
- **Data Control:** You can export, import, or delete all stored data at any time from Settings → Data
- **Incognito:** The extension does not operate in incognito mode unless explicitly enabled
- **Data Retention:** Activity logs are automatically cleaned up based on your retention settings (default: 30 days)

---

## 📝 Changelog

### v1.0.0 (Initial Release)
- 🎉 Initial release with full feature set
- ⚙ 8-tab configuration system (General, Shortcuts, Automation, Privacy, Performance, Accessibility, Data, About)
- ⌨ Customizable keyboard shortcuts
- ⚡ Auto-run with URL filtering and scheduling
- 🔒 Privacy controls with data retention management
- 🚀 Performance tuning (caching, memory limits, debouncing)
- ♿ Accessibility options (font size, high contrast, reduced motion)
- 📊 Usage statistics and activity logging
- 💾 JSON/CSV data export and import
- 🖱 Context menu integration

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with ❤️ using <strong>Manifest V3</strong>
</p>
`;
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
    "README.md": generateReadme(spec),
  };
}
