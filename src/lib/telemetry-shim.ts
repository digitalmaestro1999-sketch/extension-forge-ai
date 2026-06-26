// Generates a Manifest V3 background telemetry shim that calls the extension-ingest
// edge function. The shim handles heartbeats, action logging, error capture, and
// self-disables when the server returns allowed:false.

const INGEST_URL = "https://nufksbhydjhqaqqfxkdp.supabase.co/functions/v1/extension-ingest";

export function buildTelemetryShim(installId: string, installToken: string): string {
  return `// === Lovable live-control telemetry shim (MV3) ===
const __LV_INSTALL_ID = ${JSON.stringify(installId)};
const __LV_INSTALL_TOKEN = ${JSON.stringify(installToken)};
const __LV_INGEST = ${JSON.stringify(INGEST_URL)};

async function __lvSend(body) {
  try {
    const res = await fetch(__LV_INGEST, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-install-id": __LV_INSTALL_ID,
        "x-install-token": __LV_INSTALL_TOKEN,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (data && data.allowed === false) {
      await chrome.storage.local.set({ __lv_blocked: { reason: data.reason, message: data.message, at: Date.now() } });
    } else if (data && data.allowed === true) {
      await chrome.storage.local.remove("__lv_blocked");
    }
    return data;
  } catch (_e) { /* offline tolerated */ }
}

// Heartbeat every 60s
chrome.alarms.create("__lv_hb", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "__lv_hb") __lvSend({ event_type: "heartbeat", duration_ms: 60000 });
});
__lvSend({ event_type: "heartbeat", duration_ms: 60000 });

// Public API for the extension's own scripts to call
globalThis.__lvAction = (action_name, payload) =>
  __lvSend({ event_type: "action", action_name, payload });
globalThis.__lvError = (error_message, payload) =>
  __lvSend({ event_type: "error", error_message, payload });

// Capture unhandled errors in the service worker
self.addEventListener("error", (e) => __lvSend({ event_type: "error", error_message: String(e.message || e) }));
self.addEventListener("unhandledrejection", (e) => __lvSend({ event_type: "error", error_message: String(e.reason || e) }));

// Block check before letting messages through
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.__lv_check) {
    chrome.storage.local.get("__lv_blocked", (r) => sendResponse(r.__lv_blocked || null));
    return true;
  }
});
// === end shim ===
`;
}

export function injectShimIntoFiles(
  files: Record<string, string>,
  manifest: Record<string, unknown>,
  installId: string,
  installToken: string,
): { files: Record<string, string>; manifest: Record<string, unknown> } {
  const next = { ...files };
  next["telemetry-shim.js"] = buildTelemetryShim(installId, installToken);

  const m = JSON.parse(JSON.stringify(manifest)) as Record<string, unknown>;
  // Ensure background service worker
  const bg = (m.background as { service_worker?: string; scripts?: string[] }) || {};
  if (bg.service_worker) {
    // Prepend importScripts to existing worker
    const existing = next[bg.service_worker] ?? "";
    if (!existing.includes("telemetry-shim.js")) {
      next[bg.service_worker] = `importScripts("telemetry-shim.js");\n${existing}`;
    }
  } else {
    m.background = { service_worker: "background.js" };
    next["background.js"] = `importScripts("telemetry-shim.js");\n${next["background.js"] ?? ""}`;
  }

  // Ensure alarms permission
  const perms = new Set((m.permissions as string[] | undefined) ?? []);
  perms.add("alarms");
  perms.add("storage");
  m.permissions = Array.from(perms);

  // Add host permission for the ingest origin
  const hosts = new Set((m.host_permissions as string[] | undefined) ?? []);
  hosts.add("https://nufksbhydjhqaqqfxkdp.supabase.co/*");
  m.host_permissions = Array.from(hosts);

  next["manifest.json"] = JSON.stringify(m, null, 2);
  return { files: next, manifest: m };
}

export function newInstallSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
