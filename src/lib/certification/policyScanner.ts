// Google Chrome Web Store policy scanner.
// Pure, sync scan of extension files. Flags patterns Google forbids or
// heavily scrutinizes: remote code, eval, inline handlers, obfuscation, etc.

export type PolicySeverity = "critical" | "warning" | "info";

export interface PolicyIssue {
  id: string;
  severity: PolicySeverity;
  file: string;
  line?: number;
  message: string;
  fix: string;
}

const JS_LIKE = /\.(js|mjs|ts)$/i;
const HTML_LIKE = /\.html?$/i;

interface Rule {
  id: string;
  severity: PolicySeverity;
  match: RegExp;
  files: RegExp;
  message: string;
  fix: string;
}

const RULES: Rule[] = [
  { id: "remote-script", severity: "critical", files: HTML_LIKE,
    match: /<script[^>]+src\s*=\s*["'](https?:\/\/|\/\/)[^"']+["']/gi,
    message: "Remote script tag detected (loading JS from external URL).",
    fix: "Bundle the script locally. CWS forbids remote code in MV3." },
  { id: "eval-call", severity: "critical", files: JS_LIKE,
    match: /\beval\s*\(/g,
    message: "Use of eval() is prohibited in Manifest V3.",
    fix: "Replace eval with parsed JSON or explicit function calls." },
  { id: "new-function", severity: "critical", files: JS_LIKE,
    match: /\bnew\s+Function\s*\(/g,
    message: "new Function() executes arbitrary code — prohibited in MV3.",
    fix: "Refactor to use static functions or JSON data." },
  { id: "inline-handler", severity: "warning", files: HTML_LIKE,
    match: /\son(?:click|load|error|submit|change|focus|blur|input)\s*=\s*["']/gi,
    message: "Inline event handler in HTML violates default CSP.",
    fix: "Attach the listener from a bundled JS file via addEventListener." },
  { id: "inline-script", severity: "critical", files: HTML_LIKE,
    match: /<script(?![^>]*\bsrc\s*=)[^>]*>[\s\S]*?<\/script>/gi,
    message: "Inline <script> block in HTML violates MV3 CSP.",
    fix: "Move the code into a .js file and reference it via <script src>." },
  { id: "javascript-url", severity: "critical", files: HTML_LIKE,
    match: /href\s*=\s*["']\s*javascript:/gi,
    message: "javascript: URL detected (equivalent to inline script).",
    fix: "Use a normal handler wired from a bundled JS file." },
  { id: "document-write", severity: "warning", files: JS_LIKE,
    match: /document\.write(?:ln)?\s*\(/g,
    message: "document.write can inject unsafe content.",
    fix: "Use DOM APIs like appendChild or textContent." },
  { id: "remote-import", severity: "critical", files: JS_LIKE,
    match: /\bimport\s*\(\s*["'](https?:)/g,
    message: "Dynamic import() from a remote URL — remote code.",
    fix: "Bundle the module or ship it inside the extension." },
  { id: "remote-fetch-script", severity: "warning", files: JS_LIKE,
    match: /fetch\s*\(\s*["']https?:\/\/[^"']+\.js["']/g,
    message: "Fetching a .js file at runtime is treated as remote code.",
    fix: "Fetch data (JSON) instead of executable scripts." },
  { id: "crypto-miner", severity: "critical", files: JS_LIKE,
    match: /\b(coinhive|cryptonight|monero|webminer|coinimp)\b/gi,
    message: "Crypto-mining identifier detected — banned by CWS.",
    fix: "Remove any cryptocurrency mining code." },
  { id: "tracking-pixel", severity: "warning", files: HTML_LIKE,
    match: /<img[^>]+src\s*=\s*["'](https?:\/\/[^"']*(?:analytics|tracking|pixel|beacon)[^"']*)["']/gi,
    message: "Tracking pixel detected. Disclose in privacy policy.",
    fix: "Ensure user consent + disclosure in your listing." },
  { id: "hidden-iframe", severity: "warning", files: HTML_LIKE,
    match: /<iframe[^>]+(?:hidden|style\s*=\s*["'][^"']*display\s*:\s*none)/gi,
    message: "Hidden iframe detected — often a policy red flag.",
    fix: "Remove or make the iframe visible and disclosed." },
];

const OBFUSCATION_MIN_LINE = 500; // char threshold for a single line

export function scanPolicy(files: Record<string, string>): PolicyIssue[] {
  const out: PolicyIssue[] = [];
  for (const [file, content] of Object.entries(files)) {
    if (typeof content !== "string") continue;
    for (const rule of RULES) {
      if (!rule.files.test(file)) continue;
      // reset regex state
      rule.match.lastIndex = 0;
      let m: RegExpExecArray | null;
      const seenLines = new Set<number>();
      while ((m = rule.match.exec(content)) !== null) {
        const line = content.slice(0, m.index).split("\n").length;
        if (seenLines.has(line)) continue;
        seenLines.add(line);
        out.push({
          id: rule.id, severity: rule.severity, file, line,
          message: rule.message, fix: rule.fix,
        });
        if (!rule.match.global) break;
      }
    }
    // Obfuscation heuristic — huge single lines in JS
    if (JS_LIKE.test(file)) {
      const lines = content.split("\n");
      const longest = lines.reduce((max, l, i) => l.length > max.len ? { len: l.length, i } : max, { len: 0, i: 0 });
      if (longest.len > OBFUSCATION_MIN_LINE) {
        out.push({
          id: "obfuscation", severity: "warning", file, line: longest.i + 1,
          message: `Very long single line (${longest.len} chars) — may look like minified/obfuscated code.`,
          fix: "Ship readable source. CWS requires reviewable JS.",
        });
      }
    }
  }
  return out;
}
