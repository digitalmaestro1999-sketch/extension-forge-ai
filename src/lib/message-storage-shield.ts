// Safe message-passing & storage-access shield.
// Injected into every generated extension so runtime.sendMessage / onMessage /
// chrome.storage calls can't take the extension down and can't be spoofed by
// arbitrary websites.

export const MESSAGE_STORAGE_SHIELD_JS = `// ─── Safe messaging + storage shield (auto-injected) ─────────────
(() => {
  if (globalThis.__EXT_MSG_SHIELD__) return;
  globalThis.__EXT_MSG_SHIELD__ = true;
  if (!globalThis.chrome) return;

  // 1. Trusted-sender guard for chrome.runtime.onMessage
  //    Rejects messages whose sender.id is not the extension itself.
  //    (Blocks externally_connectable / rogue-page spoofing.)
  const rt = chrome.runtime;
  if (rt && rt.onMessage && rt.onMessage.addListener) {
    const origAdd = rt.onMessage.addListener.bind(rt.onMessage);
    rt.onMessage.addListener = function safeAddListener(listener) {
      return origAdd((msg, sender, sendResponse) => {
        try {
          if (sender && sender.id && sender.id !== chrome.runtime.id) {
            // Silently drop untrusted senders.
            return false;
          }
          // Normalise message shape: must be a plain object with string "type".
          if (msg == null || typeof msg !== "object" || typeof msg.type !== "string") {
            return false;
          }
          return listener(msg, sender, sendResponse);
        } catch (e) {
          try { sendResponse && sendResponse({ ok: false, error: String(e && e.message || e) }); } catch (_) {}
          return false;
        }
      });
    };
  }

  // 2. Promise-friendly sendMessage that swallows lastError and times out.
  if (rt && rt.sendMessage) {
    const orig = rt.sendMessage.bind(rt);
    globalThis.safeSendMessage = (payload, { timeoutMs = 5000 } = {}) => new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => { if (!done) { done = true; resolve({ ok: false, error: "timeout" }); } }, timeoutMs);
      try {
        orig(payload, (resp) => {
          if (done) return; done = true; clearTimeout(timer);
          if (chrome.runtime.lastError) return resolve({ ok: false, error: chrome.runtime.lastError.message });
          resolve({ ok: true, data: resp });
        });
      } catch (e) {
        if (done) return; done = true; clearTimeout(timer);
        resolve({ ok: false, error: String(e && e.message || e) });
      }
    });
  }

  // 3. Storage-access helpers that never throw and normalise callback→promise.
  const wrapArea = (area) => {
    if (!area) return null;
    return {
      get: (keys) => new Promise((res) => {
        try { area.get(keys, (v) => res(chrome.runtime.lastError ? {} : v || {})); }
        catch { res({}); }
      }),
      set: (obj) => new Promise((res) => {
        try {
          // Reject non-JSON-serialisable payloads early so storage never corrupts.
          JSON.stringify(obj);
          area.set(obj, () => res(!chrome.runtime.lastError));
        } catch { res(false); }
      }),
      remove: (keys) => new Promise((res) => {
        try { area.remove(keys, () => res(!chrome.runtime.lastError)); }
        catch { res(false); }
      }),
    };
  };
  if (chrome.storage) {
    globalThis.safeStorage = {
      local: wrapArea(chrome.storage.local),
      sync: wrapArea(chrome.storage.sync),
      session: wrapArea(chrome.storage.session),
    };
  }
})();
`;

const MARK = "__EXT_MSG_SHIELD__";

/** Inject the message/storage shield into the service worker + content scripts. */
export function injectMessageStorageShield(
  files: Record<string, string>,
): { files: Record<string, string>; injected: string[] } {
  const out = { ...files };
  const injected: string[] = [];
  let manifest: any = null;
  try { if (out["manifest.json"]) manifest = JSON.parse(out["manifest.json"]); } catch { /* ignore */ }

  const targets = new Set<string>();
  if (manifest?.background?.service_worker) targets.add(manifest.background.service_worker);
  for (const cs of manifest?.content_scripts ?? []) {
    for (const js of cs.js ?? []) targets.add(js);
  }

  for (const name of targets) {
    const src = out[name];
    if (typeof src === "string" && !src.includes(MARK)) {
      out[name] = MESSAGE_STORAGE_SHIELD_JS + "\n" + src;
      injected.push(name);
    }
  }

  // Also expose to popup/options via the shared shield file if present.
  const htmlTargets = [
    manifest?.action?.default_popup,
    manifest?.options_page,
    manifest?.options_ui?.page,
  ].filter((v): v is string => typeof v === "string" && !!out[v]);

  if (htmlTargets.length) {
    if (!out["message-shield.js"]) out["message-shield.js"] = MESSAGE_STORAGE_SHIELD_JS;
    for (const html of htmlTargets) {
      if (!out[html].includes("message-shield.js")) {
        out[html] = out[html].replace(/<head[^>]*>/i, (m) => `${m}\n  <script src="/message-shield.js"></script>`);
        injected.push(html);
      }
    }
  }

  return { files: out, injected };
}
