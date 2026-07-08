// Runtime Simulator.
// Boots popup + background service worker in a JS sandbox with a mocked
// chrome.* API surface, executes their top-level synchronous code plus any
// registered DOMContentLoaded / onInstalled handlers, and captures errors.
// Pure client-side; no network. Best-effort — real Chrome behaviour differs.

export interface RuntimeIssue {
  file: string;
  scope: "popup" | "background";
  message: string;
  stack?: string;
}

export interface RuntimeResult {
  scopes: Array<{ file: string; scope: "popup" | "background"; ok: boolean; log: string[] }>;
  issues: RuntimeIssue[];
}

function makeChromeMock(log: string[]) {
  const listeners: Record<string, Function[]> = {};
  const on = (name: string) => ({
    addListener: (fn: Function) => { (listeners[name] ??= []).push(fn); },
    removeListener: () => {},
    hasListener: () => true,
  });
  return {
    _listeners: listeners,
    runtime: {
      id: "test-extension-id",
      lastError: null,
      getManifest: () => ({ manifest_version: 3, version: "1.0.0" }),
      getURL: (p: string) => `chrome-extension://test/${p}`,
      sendMessage: (_msg: unknown, cb?: Function) => { if (cb) cb({}); return Promise.resolve({}); },
      onMessage: on("runtime.onMessage"),
      onInstalled: on("runtime.onInstalled"),
      onStartup: on("runtime.onStartup"),
      onConnect: on("runtime.onConnect"),
    },
    storage: {
      local:  makeStorageArea(),
      sync:   makeStorageArea(),
      session: makeStorageArea(),
      onChanged: on("storage.onChanged"),
    },
    tabs: {
      query: (_q: unknown, cb?: Function) => { const r: unknown[] = []; if (cb) cb(r); return Promise.resolve(r); },
      sendMessage: () => Promise.resolve({}),
      create: () => Promise.resolve({ id: 1 }),
      update: () => Promise.resolve({ id: 1 }),
      onUpdated: on("tabs.onUpdated"),
      onActivated: on("tabs.onActivated"),
    },
    action: {
      setBadgeText: () => Promise.resolve(),
      setBadgeBackgroundColor: () => Promise.resolve(),
      setIcon: () => Promise.resolve(),
      setTitle: () => Promise.resolve(),
      onClicked: on("action.onClicked"),
    },
    scripting: {
      executeScript: () => Promise.resolve([]),
      insertCSS: () => Promise.resolve(),
    },
    alarms: {
      create: () => {},
      clear: () => Promise.resolve(true),
      onAlarm: on("alarms.onAlarm"),
    },
    contextMenus: {
      create: () => "id",
      remove: () => Promise.resolve(),
      onClicked: on("contextMenus.onClicked"),
    },
    notifications: { create: (_id: string, _opts: unknown, cb?: Function) => { if (cb) cb("id"); } },
    permissions: {
      contains: (_p: unknown, cb?: Function) => { if (cb) cb(true); return Promise.resolve(true); },
      request: () => Promise.resolve(true),
    },
    i18n: { getMessage: (k: string) => k, getUILanguage: () => "en-US" },
    webRequest: { onBeforeRequest: on("webRequest.onBeforeRequest") },
    _log: log,
  };
}

function makeStorageArea() {
  const store = new Map<string, unknown>();
  return {
    get: (keys: string | string[] | Record<string, unknown> | null, cb?: Function) => {
      const out: Record<string, unknown> = {};
      const collect = (k: string) => { if (store.has(k)) out[k] = store.get(k); };
      if (keys == null) store.forEach((v, k) => (out[k] = v));
      else if (typeof keys === "string") collect(keys);
      else if (Array.isArray(keys)) keys.forEach(collect);
      else Object.keys(keys).forEach(collect);
      if (cb) cb(out);
      return Promise.resolve(out);
    },
    set: (items: Record<string, unknown>, cb?: Function) => {
      Object.entries(items).forEach(([k, v]) => store.set(k, v));
      if (cb) cb();
      return Promise.resolve();
    },
    remove: (keys: string | string[], cb?: Function) => {
      const arr = Array.isArray(keys) ? keys : [keys];
      arr.forEach(k => store.delete(k));
      if (cb) cb();
      return Promise.resolve();
    },
    clear: (cb?: Function) => { store.clear(); if (cb) cb(); return Promise.resolve(); },
  };
}

function bootScript(source: string, scope: "popup" | "background", file: string): { ok: boolean; log: string[]; issues: RuntimeIssue[]; chromeMock: ReturnType<typeof makeChromeMock> } {
  const log: string[] = [];
  const issues: RuntimeIssue[] = [];
  const chromeMock = makeChromeMock(log);
  const consoleShim = {
    log: (...a: unknown[]) => log.push(a.map(String).join(" ")),
    warn: (...a: unknown[]) => log.push("[warn] " + a.map(String).join(" ")),
    error: (...a: unknown[]) => { log.push("[error] " + a.map(String).join(" ")); issues.push({ file, scope, message: a.map(String).join(" ") }); },
    info: (...a: unknown[]) => log.push(a.map(String).join(" ")),
    debug: () => {},
  };
  // Minimal document/window shim so popup scripts don't immediately die.
  const el = () => {
    const events: Record<string, Function[]> = {};
    const node: any = {
      innerHTML: "", textContent: "", style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      addEventListener: (name: string, fn: Function) => { (events[name] ??= []).push(fn); },
      removeEventListener: () => {},
      appendChild: (c: unknown) => c, removeChild: () => {},
      querySelector: () => el(), querySelectorAll: () => [],
      getAttribute: () => null, setAttribute: () => {},
      click: () => {}, focus: () => {}, blur: () => {},
    };
    return node;
  };
  const documentShim: any = {
    _listeners: {} as Record<string, Function[]>,
    body: el(),
    head: el(),
    createElement: () => el(),
    getElementById: () => el(),
    querySelector: () => el(),
    querySelectorAll: () => [],
    addEventListener: function (name: string, fn: Function) { (this._listeners[name] ??= []).push(fn); },
    removeEventListener: () => {},
    readyState: "loading",
  };
  const windowShim: any = {
    _listeners: {} as Record<string, Function[]>,
    addEventListener: function (name: string, fn: Function) { (this._listeners[name] ??= []).push(fn); },
    removeEventListener: () => {},
    location: { href: "chrome-extension://test/" }, navigator: { userAgent: "sim" },
  };
  const fetchShim = () => Promise.reject(new Error("fetch not simulated"));
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      "chrome", "console", "document", "window", "self", "fetch", "globalThis",
      `"use strict";\n${source}`,
    );
    fn(chromeMock, consoleShim, documentShim, windowShim, windowShim, fetchShim, windowShim);

    // Fire DOMContentLoaded for popup
    if (scope === "popup") {
      for (const cb of documentShim._listeners["DOMContentLoaded"] ?? []) {
        try { cb({ type: "DOMContentLoaded" }); }
        catch (e) { issues.push({ file, scope, message: `DOMContentLoaded handler threw: ${(e as Error).message}`, stack: (e as Error).stack }); }
      }
    } else {
      // Fire onInstalled for background
      for (const cb of chromeMock._listeners["runtime.onInstalled"] ?? []) {
        try { cb({ reason: "install" }); }
        catch (e) { issues.push({ file, scope, message: `runtime.onInstalled handler threw: ${(e as Error).message}`, stack: (e as Error).stack }); }
      }
    }
    return { ok: issues.length === 0, log, issues, chromeMock };
  } catch (e) {
    issues.push({ file, scope, message: `Boot failed: ${(e as Error).message}`, stack: (e as Error).stack });
    return { ok: false, log, issues, chromeMock };
  }
}

export function simulateRuntime(files: Record<string, string>): RuntimeResult {
  const scopes: RuntimeResult["scopes"] = [];
  const allIssues: RuntimeIssue[] = [];

  let manifest: any = {};
  try { manifest = JSON.parse(files["manifest.json"] ?? "{}"); } catch { /* handled elsewhere */ }

  // Background
  const bg = manifest?.background?.service_worker;
  if (bg && typeof files[bg] === "string") {
    const r = bootScript(files[bg], "background", bg);
    scopes.push({ file: bg, scope: "background", ok: r.ok, log: r.log });
    allIssues.push(...r.issues);
  }

  // Popup — find <script src> refs in the popup HTML and boot each.
  const popupHtml: string | undefined = manifest?.action?.default_popup;
  if (popupHtml && typeof files[popupHtml] === "string") {
    const html = files[popupHtml];
    const scriptSrcs = Array.from(html.matchAll(/<script[^>]+src\s*=\s*["']([^"']+)["']/g)).map(m => m[1]);
    // Resolve relative to popup dir
    const baseDir = popupHtml.includes("/") ? popupHtml.replace(/\/[^/]+$/, "/") : "";
    for (const src of scriptSrcs) {
      const path = src.startsWith("/") ? src.replace(/^\//, "") : baseDir + src;
      if (typeof files[path] === "string") {
        const r = bootScript(files[path], "popup", path);
        scopes.push({ file: path, scope: "popup", ok: r.ok, log: r.log });
        allIssues.push(...r.issues);
      }
    }
    if (scriptSrcs.length === 0) {
      scopes.push({ file: popupHtml, scope: "popup", ok: true, log: ["No <script src> tags in popup."] });
    }
  }

  return { scopes, issues: allIssues };
}
