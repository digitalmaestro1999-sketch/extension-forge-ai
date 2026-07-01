// Software Intelligence — project scanner.
// Accepts a ZIP (or drag-dropped file list), extracts all text files, and
// produces a rich analysis: folders, files, deps, timers, secrets, naming,
// health scores. Fully client-side and non-destructive.

import JSZip from "jszip";

export type ScannedFile = {
  path: string;
  ext: string;
  size: number;
  lines: number;
  content?: string; // present for text files
  binary: boolean;
  purpose?: string;
  complexity: number;
  imports: string[];
  exports: string[];
  hasTests: boolean;
  todoCount: number;
  risk: "low" | "medium" | "high";
  score: number; // 0-100
};

export type FolderNode = {
  path: string;
  name: string;
  files: number;
  bytes: number;
  children: Record<string, FolderNode>;
  empty: boolean;
  purpose?: string;
};

export type TimerFinding = {
  file: string;
  line: number;
  kind: "setTimeout" | "setInterval" | "requestAnimationFrame" | "cron" | "polling" | "debounce" | "throttle";
  snippet: string;
};

export type SecurityFinding = {
  file: string;
  line: number;
  severity: "critical" | "high" | "medium" | "low";
  category: "secret" | "xss" | "eval" | "injection" | "unsafe-api" | "storage";
  message: string;
  snippet: string;
};

export type DependencyInfo = {
  name: string;
  version: string;
  type: "prod" | "dev" | "peer";
  usedIn: number; // file count referencing it
  deprecated?: boolean;
};

export type NamingReport = {
  score: number;
  consistency: number;
  inconsistencies: { name: string; kind: string; suggestion: string }[];
  conventions: Record<string, string>;
};

export type HealthScores = {
  overall: number;
  architecture: number;
  security: number;
  performance: number;
  maintainability: number;
  documentation: number;
  naming: number;
  dependencies: number;
  testing: number;
  technicalDebt: number;
};

export type ProjectScan = {
  name: string;
  totalFiles: number;
  totalBytes: number;
  totalLines: number;
  stack: string[];
  files: ScannedFile[];
  folders: FolderNode;
  dependencies: DependencyInfo[];
  timers: TimerFinding[];
  security: SecurityFinding[];
  naming: NamingReport;
  scores: HealthScores;
  duplicates: { hash: string; files: string[] }[];
  unused: string[]; // files with no consumers
  todos: number;
  scannedAt: string;
};

const TEXT_EXT =
  /\.(json|js|mjs|cjs|ts|tsx|jsx|html?|css|scss|md|txt|svg|xml|yaml|yml|toml|env|sh|py|rb|go|rs)$/i;
const CODE_EXT = /\.(js|mjs|cjs|ts|tsx|jsx)$/i;

const SECRET_PATTERNS: { re: RegExp; msg: string }[] = [
  { re: /sk_live_[A-Za-z0-9]{16,}/g, msg: "Stripe live secret key" },
  { re: /AKIA[0-9A-Z]{16}/g, msg: "AWS access key" },
  { re: /AIza[0-9A-Za-z_-]{35}/g, msg: "Google API key" },
  { re: /ghp_[A-Za-z0-9]{36}/g, msg: "GitHub personal token" },
  { re: /-----BEGIN (?:RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/g, msg: "Private key material" },
  { re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g, msg: "JWT-shaped token" },
];

const STACK_HINTS: { pkg: RegExp; label: string }[] = [
  { pkg: /^react$/, label: "React" },
  { pkg: /^next$/, label: "Next.js" },
  { pkg: /^vue$/, label: "Vue" },
  { pkg: /^svelte$/, label: "Svelte" },
  { pkg: /^vite$/, label: "Vite" },
  { pkg: /^tailwindcss$/, label: "Tailwind CSS" },
  { pkg: /^typescript$/, label: "TypeScript" },
  { pkg: /^@supabase\/supabase-js$/, label: "Supabase" },
  { pkg: /^express$/, label: "Express" },
  { pkg: /^fastify$/, label: "Fastify" },
  { pkg: /^prisma$/, label: "Prisma" },
];

function extOf(p: string) {
  const i = p.lastIndexOf(".");
  return i >= 0 ? p.slice(i).toLowerCase() : "";
}

function classifyPurpose(path: string): string {
  const p = path.toLowerCase();
  if (/\.test\.|\.spec\.|__tests__/.test(p)) return "Test";
  if (p.includes("/components/")) return "UI Component";
  if (p.includes("/pages/") || p.includes("/routes/")) return "Route/Page";
  if (p.includes("/hooks/")) return "React Hook";
  if (p.includes("/lib/") || p.includes("/utils/")) return "Utility";
  if (p.includes("/api/") || p.includes("/functions/")) return "API/Function";
  if (p.endsWith(".css") || p.endsWith(".scss")) return "Styles";
  if (p.endsWith("package.json")) return "Manifest";
  if (p.endsWith("readme.md")) return "Documentation";
  if (/\.config\.|vite|tailwind|tsconfig|eslint/.test(p)) return "Configuration";
  return "Source";
}

function classifyFolder(path: string): string {
  const parts = path.split("/").filter(Boolean);
  const last = parts[parts.length - 1]?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    src: "Application source",
    components: "UI components",
    pages: "Routed pages",
    hooks: "React hooks",
    lib: "Shared libraries",
    utils: "Utility helpers",
    api: "API endpoints",
    functions: "Serverless functions",
    public: "Static assets",
    assets: "Static assets",
    styles: "Stylesheets",
    tests: "Test suite",
    __tests__: "Test suite",
    node_modules: "Vendor dependencies",
    dist: "Build output",
    build: "Build output",
    ".git": "Git metadata",
    ".github": "CI/CD workflows",
  };
  return map[last] ?? "Module";
}

function computeComplexity(text: string): number {
  const branches = (text.match(/\b(if|else|for|while|switch|case|catch|\?\s*\S+\s*:)\b/g) ?? []).length;
  const fns = (text.match(/\bfunction\b|=>/g) ?? []).length;
  return branches + Math.floor(fns / 2);
}

function extractImports(text: string): string[] {
  const out = new Set<string>();
  const re = /(?:import\s+[^"']*from\s+|require\(\s*)["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.add(m[1]);
  return [...out];
}

function extractExports(text: string): string[] {
  const out = new Set<string>();
  const re = /export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|type|interface|enum)\s+(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.add(m[1]);
  return [...out];
}

function hashString(s: string): string {
  // FNV-1a — cheap, non-crypto, stable for dup detection
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
}

function scanTimers(path: string, text: string): TimerFinding[] {
  const findings: TimerFinding[] = [];
  const lines = text.split("\n");
  const patterns: { re: RegExp; kind: TimerFinding["kind"] }[] = [
    { re: /\bsetInterval\s*\(/g, kind: "setInterval" },
    { re: /\bsetTimeout\s*\(/g, kind: "setTimeout" },
    { re: /\brequestAnimationFrame\s*\(/g, kind: "requestAnimationFrame" },
    { re: /\bcron\s*\.|cron\(|node-cron/gi, kind: "cron" },
    { re: /\bpolling|poll\s*\(/gi, kind: "polling" },
    { re: /\bdebounce\s*\(/g, kind: "debounce" },
    { re: /\bthrottle\s*\(/g, kind: "throttle" },
  ];
  lines.forEach((ln, i) => {
    for (const p of patterns) {
      if (p.re.test(ln)) {
        findings.push({ file: path, line: i + 1, kind: p.kind, snippet: ln.trim().slice(0, 160) });
      }
      p.re.lastIndex = 0;
    }
  });
  return findings;
}

function scanSecurity(path: string, text: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const lines = text.split("\n");

  lines.forEach((ln, i) => {
    for (const p of SECRET_PATTERNS) {
      if (p.re.test(ln)) {
        findings.push({
          file: path, line: i + 1, severity: "critical", category: "secret",
          message: p.msg, snippet: ln.trim().slice(0, 160),
        });
      }
      p.re.lastIndex = 0;
    }
    if (/\beval\s*\(/.test(ln)) {
      findings.push({ file: path, line: i + 1, severity: "high", category: "eval", message: "Use of eval()", snippet: ln.trim().slice(0, 160) });
    }
    if (/dangerouslySetInnerHTML/.test(ln)) {
      findings.push({ file: path, line: i + 1, severity: "medium", category: "xss", message: "dangerouslySetInnerHTML", snippet: ln.trim().slice(0, 160) });
    }
    if (/document\.write\s*\(/.test(ln)) {
      findings.push({ file: path, line: i + 1, severity: "high", category: "xss", message: "document.write()", snippet: ln.trim().slice(0, 160) });
    }
    if (/localStorage\.setItem\([^)]*(?:token|password|secret|key)/i.test(ln)) {
      findings.push({ file: path, line: i + 1, severity: "medium", category: "storage", message: "Sensitive data in localStorage", snippet: ln.trim().slice(0, 160) });
    }
  });
  return findings;
}

function analyzeNaming(files: ScannedFile[]): NamingReport {
  const kebab = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  const camel = /^[a-z][a-zA-Z0-9]*$/;
  const pascal = /^[A-Z][a-zA-Z0-9]*$/;
  const inconsistencies: NamingReport["inconsistencies"] = [];
  const bases = files.map((f) => f.path.split("/").pop()!.replace(/\.[^.]+$/, ""));

  let ok = 0, total = 0;
  for (const f of files) {
    const base = f.path.split("/").pop()!.replace(/\.[^.]+$/, "");
    if (f.path.includes("/components/") && CODE_EXT.test(f.path)) {
      total++;
      if (pascal.test(base)) ok++;
      else inconsistencies.push({ name: base, kind: "component", suggestion: "PascalCase" });
    } else if (f.path.includes("/hooks/")) {
      total++;
      if (/^use[A-Z]/.test(base)) ok++;
      else inconsistencies.push({ name: base, kind: "hook", suggestion: "useCamelCase (must start with 'use')" });
    } else if (CODE_EXT.test(f.path)) {
      total++;
      if (kebab.test(base) || camel.test(base) || pascal.test(base)) ok++;
      else inconsistencies.push({ name: base, kind: "file", suggestion: "kebab-case or camelCase" });
    }
  }
  const consistency = total ? Math.round((ok / total) * 100) : 100;
  return {
    score: consistency,
    consistency,
    inconsistencies: inconsistencies.slice(0, 50),
    conventions: {
      components: "PascalCase.tsx",
      hooks: "use-kebab.ts exporting useCamelCase",
      utils: "kebab-case.ts",
      constants: "UPPER_SNAKE_CASE",
    },
  };
  void bases;
}

function buildFolderTree(files: ScannedFile[]): FolderNode {
  const root: FolderNode = { path: "", name: "root", files: 0, bytes: 0, children: {}, empty: false };
  for (const f of files) {
    const parts = f.path.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      if (!node.children[seg]) {
        const p = parts.slice(0, i + 1).join("/");
        node.children[seg] = { path: p, name: seg, files: 0, bytes: 0, children: {}, empty: false, purpose: classifyFolder(p) };
      }
      node = node.children[seg];
      node.files++;
      node.bytes += f.size;
    }
    root.files++;
    root.bytes += f.size;
  }
  // mark empty (no direct files and no children with files)
  const mark = (n: FolderNode) => {
    Object.values(n.children).forEach(mark);
    n.empty = n.files === 0 && Object.values(n.children).every((c) => c.empty);
  };
  mark(root);
  return root;
}

function computeScores(scan: Omit<ProjectScan, "scores">): HealthScores {
  const secCritical = scan.security.filter((s) => s.severity === "critical").length;
  const secHigh = scan.security.filter((s) => s.severity === "high").length;
  const security = Math.max(0, 100 - secCritical * 25 - secHigh * 10 - scan.security.length * 2);

  const avgComplexity = scan.files.length
    ? scan.files.reduce((a, f) => a + f.complexity, 0) / scan.files.length
    : 0;
  const maintainability = Math.max(0, 100 - Math.round(avgComplexity * 3) - scan.duplicates.length * 4);

  const readmeCount = scan.files.filter((f) => /readme/i.test(f.path)).length;
  const documentation = Math.min(100, 40 + readmeCount * 15 + (scan.files.some((f) => f.path.endsWith(".md")) ? 20 : 0));

  const testFiles = scan.files.filter((f) => f.hasTests).length;
  const testing = Math.min(100, Math.round((testFiles / Math.max(1, scan.files.length)) * 400));

  const deps = scan.dependencies.length;
  const dependencies = Math.max(0, 100 - Math.max(0, deps - 40) * 1.5);

  const naming = scan.naming.score;
  const architecture = Math.min(100, 60 + (scan.folders.children.src ? 20 : 0) + (scan.files.some((f) => f.path.includes("hooks")) ? 10 : 0) + (scan.files.some((f) => f.path.includes("lib")) ? 10 : 0));
  const performance = Math.max(0, 100 - scan.timers.length * 2 - scan.duplicates.length * 3);
  const technicalDebt = Math.max(0, 100 - scan.todos * 2 - scan.unused.length * 3 - scan.duplicates.length * 4);

  const overall = Math.round(
    (architecture + security + performance + maintainability + documentation + naming + dependencies + Math.max(30, testing) + technicalDebt) / 9
  );

  return { overall, architecture, security, performance, maintainability, documentation, naming, dependencies, testing, technicalDebt };
}

export type ScanProgress = {
  phase: "read" | "analyze" | "aggregate" | "score" | "done";
  processed: number;
  total: number;
  currentFile?: string;
  percent: number;
  detail?: string;
};
export type ProgressFn = (p: ScanProgress) => void;

const yieldToUI = () => new Promise<void>((r) => setTimeout(r, 0));

export async function scanZip(file: File, name?: string, onProgress?: ProgressFn): Promise<ProjectScan> {
  onProgress?.({ phase: "read", processed: 0, total: 1, percent: 2, currentFile: file.name });
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files).filter((e) => !e.dir && !e.name.includes("node_modules/"));
  const raw: { path: string; content?: string; size: number; binary: boolean }[] = [];
  const total = entries.length;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (TEXT_EXT.test(e.name)) {
      const content = await e.async("string");
      raw.push({ path: e.name, content, size: content.length, binary: false });
    } else {
      const blob = await e.async("uint8array");
      raw.push({ path: e.name, size: blob.byteLength, binary: true });
    }
    onProgress?.({
      phase: "read", processed: i + 1, total,
      percent: Math.round(((i + 1) / total) * 40), currentFile: e.name,
      detail: `${TEXT_EXT.test(e.name) ? "text" : "binary"} · ${raw[raw.length - 1].size.toLocaleString()}B`,
    });
    if (i % 20 === 0 || i === total - 1) await yieldToUI();
  }
  return analyzeFiles(name ?? file.name.replace(/\.zip$/i, ""), raw, onProgress);
}

export async function scanFileList(name: string, list: FileList | File[], onProgress?: ProgressFn): Promise<ProjectScan> {
  const files = Array.from(list).filter((f) => {
    const p = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    return !p.includes("node_modules/");
  });
  const raw: { path: string; content?: string; size: number; binary: boolean }[] = [];
  const total = files.length;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const path: string = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    if (TEXT_EXT.test(path) && f.size < 2_000_000) {
      const content = await f.text();
      raw.push({ path, content, size: f.size, binary: false });
    } else {
      raw.push({ path, size: f.size, binary: true });
    }
    onProgress?.({
      phase: "read", processed: i + 1, total,
      percent: Math.round(((i + 1) / total) * 40), currentFile: path,
      detail: `${TEXT_EXT.test(path) ? "text" : "binary"} · ${f.size.toLocaleString()}B`,
    });
    if (i % 20 === 0 || i === total - 1) await yieldToUI();
  }
  return analyzeFiles(name, raw, onProgress);
}


async function analyzeFiles(
  name: string,
  raw: { path: string; content?: string; size: number; binary: boolean }[],
  onProgress?: ProgressFn,
): Promise<ProjectScan> {
  const scanned: ScannedFile[] = [];
  const timers: TimerFinding[] = [];
  const security: SecurityFinding[] = [];
  const hashes = new Map<string, string[]>();
  let todos = 0;
  let totalLines = 0;

  const total = raw.length;
  for (let idx = 0; idx < raw.length; idx++) {
    const r = raw[idx];
    const ext = extOf(r.path);
    const text = r.content ?? "";
    const lines = text ? text.split("\n").length : 0;
    totalLines += lines;
    const imports = text && CODE_EXT.test(r.path) ? extractImports(text) : [];
    const exports = text && CODE_EXT.test(r.path) ? extractExports(text) : [];
    const complexity = text && CODE_EXT.test(r.path) ? computeComplexity(text) : 0;
    const todoCount = text ? (text.match(/TODO|FIXME|XXX|HACK/g) ?? []).length : 0;
    todos += todoCount;

    if (text && CODE_EXT.test(r.path)) {
      timers.push(...scanTimers(r.path, text));
      security.push(...scanSecurity(r.path, text));
      const h = hashString(text.replace(/\s+/g, ""));
      if (text.length > 300) {
        const arr = hashes.get(h) ?? [];
        arr.push(r.path);
        hashes.set(h, arr);
      }
    }

    const risk: ScannedFile["risk"] = complexity > 40 ? "high" : complexity > 15 ? "medium" : "low";
    const score = Math.max(0, 100 - complexity * 2 - todoCount * 4);

    scanned.push({
      path: r.path, ext, size: r.size, lines,
      content: text || undefined, binary: r.binary,
      purpose: classifyPurpose(r.path),
      complexity, imports, exports,
      hasTests: /\.test\.|\.spec\.|__tests__/.test(r.path),
      todoCount, risk, score,
    });

    const fileTimers = text && CODE_EXT.test(r.path) ? timers.length : 0;
    const fileSec = text && CODE_EXT.test(r.path) ? security.length : 0;
    onProgress?.({
      phase: "analyze", processed: idx + 1, total,
      percent: 40 + Math.round(((idx + 1) / Math.max(1, total)) * 45),
      currentFile: r.path,
      detail: `${lines}L · cx=${complexity} · imp=${imports.length} · exp=${exports.length} · todo=${todoCount} · risk=${risk}`,
    });
    void fileTimers; void fileSec;
    if (idx % 25 === 0 || idx === total - 1) await yieldToUI();
  }
  onProgress?.({
    phase: "aggregate", processed: total, total, percent: 90,
    detail: `${scanned.length} files · ${timers.length} timers · ${security.length} security findings · ${todos} TODOs`,
  });
  await yieldToUI();

  // Duplicates
  const duplicates = [...hashes.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([hash, files]) => ({ hash, files }));

  // Dependencies (from package.json)
  const pkgFile = scanned.find((f) => f.path.endsWith("package.json") && f.content);
  const dependencies: DependencyInfo[] = [];
  const stack = new Set<string>();
  if (pkgFile?.content) {
    try {
      const pkg = JSON.parse(pkgFile.content);
      const addDeps = (obj: Record<string, string> | undefined, type: DependencyInfo["type"]) => {
        if (!obj) return;
        for (const [n, v] of Object.entries(obj)) {
          const usedIn = scanned.filter((s) => s.imports.some((imp) => imp === n || imp.startsWith(n + "/"))).length;
          dependencies.push({ name: n, version: String(v), type, usedIn });
          for (const s of STACK_HINTS) if (s.pkg.test(n)) stack.add(s.label);
        }
      };
      addDeps(pkg.dependencies, "prod");
      addDeps(pkg.devDependencies, "dev");
      addDeps(pkg.peerDependencies, "peer");
    } catch {}
  }

  // Unused: files with exports but no other file imports their relative path base
  const bases = new Map<string, string>();
  for (const f of scanned) {
    const base = f.path.replace(/\.[^.]+$/, "");
    bases.set(base, f.path);
  }
  const referenced = new Set<string>();
  for (const f of scanned) {
    for (const imp of f.imports) {
      if (imp.startsWith(".") || imp.startsWith("/")) {
        const dir = f.path.split("/").slice(0, -1).join("/");
        const resolved = new URL(imp, "https://x/" + dir + "/").pathname.slice(1).replace(/\/$/, "");
        referenced.add(resolved);
      }
    }
  }
  const unused = scanned
    .filter((f) => CODE_EXT.test(f.path) && f.exports.length > 0)
    .filter((f) => {
      const base = f.path.replace(/\.[^.]+$/, "");
      return ![...referenced].some((r) => r === base || r === f.path || base.endsWith("/" + r));
    })
    .filter((f) => !/index\.|main\.|app\./i.test(f.path.split("/").pop() ?? ""))
    .map((f) => f.path);

  const naming = analyzeNaming(scanned);
  const folders = buildFolderTree(scanned);

  const partial: Omit<ProjectScan, "scores"> = {
    name,
    totalFiles: scanned.length,
    totalBytes: scanned.reduce((a, f) => a + f.size, 0),
    totalLines,
    stack: [...stack],
    files: scanned,
    folders,
    dependencies,
    timers,
    security,
    naming,
    duplicates,
    unused,
    todos,
    scannedAt: new Date().toISOString(),
  };
  onProgress?.({
    phase: "aggregate", processed: scanned.length, total: scanned.length, percent: 93,
    detail: `${duplicates.length} duplicate clusters · ${unused.length} unused files · ${dependencies.length} deps · stack: ${[...stack].join(", ") || "unknown"}`,
  });
  await yieldToUI();
  onProgress?.({
    phase: "score", processed: scanned.length, total: scanned.length, percent: 97,
    detail: `naming ${naming.score}/100 · ${naming.inconsistencies.length} inconsistencies`,
  });
  const result = { ...partial, scores: computeScores(partial) };
  const s = result.scores;
  onProgress?.({
    phase: "done", processed: scanned.length, total: scanned.length, percent: 100,
    detail: `overall ${s.overall} · sec ${s.security} · perf ${s.performance} · maint ${s.maintainability} · debt ${s.technicalDebt}`,
  });
  return result;
}

// ---------- Whole-project rename (safe, preview-based) ----------

export type RenamePlan = {
  from: string;
  to: string;
  changes: { path: string; occurrences: number; preview: string[] }[];
  totalOccurrences: number;
  filesAffected: number;
};

export function planRename(scan: ProjectScan, from: string, to: string): RenamePlan {
  const changes: RenamePlan["changes"] = [];
  let total = 0;
  const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
  for (const f of scan.files) {
    if (!f.content) continue;
    const matches = f.content.match(re);
    if (!matches) continue;
    const preview = f.content
      .split("\n")
      .map((ln, i) => ({ ln, i }))
      .filter(({ ln }) => re.test(ln))
      .slice(0, 3)
      .map(({ ln, i }) => `${i + 1}: ${ln.trim().slice(0, 120)}`);
    changes.push({ path: f.path, occurrences: matches.length, preview });
    total += matches.length;
    re.lastIndex = 0;
  }
  return { from, to, changes, totalOccurrences: total, filesAffected: changes.length };
}

export function applyRename(scan: ProjectScan, plan: RenamePlan): ProjectScan {
  const re = new RegExp(plan.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
  const files = scan.files.map((f) => {
    if (!f.content) return f;
    if (!re.test(f.content)) return f;
    re.lastIndex = 0;
    return { ...f, content: f.content.replace(re, plan.to) };
  });
  return { ...scan, files };
}

// ---------- Line-level & AI patch application ----------

/** Replace a single line in a file (1-indexed). Rebuilds file arrays. */
export function applyLineEdit(scan: ProjectScan, filePath: string, line: number, newLine: string): ProjectScan {
  const files = scan.files.map((f) => {
    if (f.path !== filePath || f.content == null) return f;
    const lines = f.content.split("\n");
    if (line < 1 || line > lines.length) return f;
    lines[line - 1] = newLine;
    return { ...f, content: lines.join("\n") };
  });
  return { ...scan, files };
}

/** Redact a secret finding by masking its match on the given line. */
export function redactSecurityFinding(scan: ProjectScan, f: SecurityFinding): ProjectScan {
  const target = scan.files.find((x) => x.path === f.file);
  if (!target?.content) return scan;
  const lines = target.content.split("\n");
  const ln = lines[f.line - 1] ?? "";
  let fixed = ln;
  if (f.category === "secret") {
    for (const p of SECRET_PATTERNS) fixed = fixed.replace(p.re, "***REDACTED***");
  } else if (f.category === "eval") {
    fixed = ln.replace(/\beval\s*\(/, "/* eval removed */ ((_x) => _x)(");
  } else if (f.category === "xss" && /document\.write/.test(ln)) {
    fixed = ln.replace(/document\.write\s*\(/, "/* unsafe */ console.warn(");
  } else if (f.category === "xss" && /dangerouslySetInnerHTML/.test(ln)) {
    fixed = ln.replace(/dangerouslySetInnerHTML=\{[^}]+\}/, "/* dangerouslySetInnerHTML removed */");
  } else if (f.category === "storage") {
    fixed = ln.replace(/localStorage\.setItem/, "/* moved to secure store */ void");
  }
  return applyLineEdit(scan, f.file, f.line, fixed);
}

/** Update a timer's numeric delay/interval on its source line. */
export function updateTimerValue(scan: ProjectScan, t: TimerFinding, newMs: number): ProjectScan {
  const target = scan.files.find((x) => x.path === t.file);
  if (!target?.content) return scan;
  const lines = target.content.split("\n");
  const ln = lines[t.line - 1] ?? "";
  // Replace the LAST numeric literal argument on the line (typical delay position)
  const fixed = ln.replace(/(,\s*)(\d{2,})(\s*\))/, `$1${newMs}$3`)
                  .replace(/(setTimeout|setInterval)\s*\(([^,]+),\s*\d+/, `$1($2, ${newMs}`);
  return applyLineEdit(scan, t.file, t.line, fixed);
}

export type AiPatch = { file: string; content?: string; action?: "update" | "create" | "delete" };

/** Apply a batch of AI-generated file patches to the in-memory scan. */
export function applyAiPatches(scan: ProjectScan, patches: AiPatch[]): { scan: ProjectScan; applied: number } {
  let files = scan.files.slice();
  let applied = 0;
  for (const p of patches) {
    if (!p.file) continue;
    const idx = files.findIndex((f) => f.path === p.file);
    if (p.action === "delete") {
      if (idx >= 0) { files.splice(idx, 1); applied++; }
      continue;
    }
    if (typeof p.content !== "string") continue;
    if (idx >= 0) {
      files[idx] = { ...files[idx], content: p.content, size: p.content.length, lines: p.content.split("\n").length };
      applied++;
    } else {
      files.push({
        path: p.file, ext: extOf(p.file), size: p.content.length,
        lines: p.content.split("\n").length, content: p.content, binary: false,
        purpose: classifyPurpose(p.file), complexity: 0, imports: [], exports: [],
        hasTests: false, todoCount: 0, risk: "low", score: 100,
      });
      applied++;
    }
  }
  return { scan: { ...scan, files }, applied };
}

export async function exportScan(scan: ProjectScan): Promise<Blob> {
  const zip = new JSZip();
  for (const f of scan.files) {
    if (f.content !== undefined) zip.file(f.path, f.content);
  }
  zip.file(
    "SOFTWARE_INTELLIGENCE_REPORT.md",
    renderMarkdownReport(scan)
  );
  return zip.generateAsync({ type: "blob" });
}

export function renderMarkdownReport(scan: ProjectScan): string {
  const s = scan.scores;
  return `# Software Intelligence Report — ${scan.name}

Scanned: ${scan.scannedAt}

## Overall Health: ${s.overall}/100

| Category | Score |
|---|---|
| Architecture | ${s.architecture} |
| Security | ${s.security} |
| Performance | ${s.performance} |
| Maintainability | ${s.maintainability} |
| Documentation | ${s.documentation} |
| Naming | ${s.naming} |
| Dependencies | ${s.dependencies} |
| Testing | ${s.testing} |
| Technical Debt | ${s.technicalDebt} |

## Stack
${scan.stack.map((s) => `- ${s}`).join("\n") || "_unknown_"}

## Stats
- Files: ${scan.totalFiles}
- Lines: ${scan.totalLines}
- Bytes: ${scan.totalBytes}
- Dependencies: ${scan.dependencies.length}
- Timers: ${scan.timers.length}
- Security findings: ${scan.security.length}
- Duplicates: ${scan.duplicates.length}
- Unused files: ${scan.unused.length}
- TODO/FIXME: ${scan.todos}

## Top Security Findings
${scan.security.slice(0, 10).map((f) => `- **${f.severity}** ${f.category} — ${f.file}:${f.line} — ${f.message}`).join("\n") || "_none_"}

## Duplicate Code Clusters
${scan.duplicates.slice(0, 10).map((d) => `- ${d.files.join(", ")}`).join("\n") || "_none_"}
`;
}
