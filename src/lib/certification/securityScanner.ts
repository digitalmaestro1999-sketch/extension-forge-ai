// Static security scanner for Chrome extension source.
// Flags common XSS sinks, unsafe CSP directives, and leaked credentials.

export type SecuritySeverity = "critical" | "warning" | "info";

export interface SecurityIssue {
  id: string;
  severity: SecuritySeverity;
  file: string;
  line?: number;
  message: string;
  fix: string;
}

const JS_LIKE = /\.(js|mjs|ts)$/i;
const HTML_LIKE = /\.html?$/i;

interface Rule {
  id: string;
  severity: SecuritySeverity;
  files: RegExp;
  match: RegExp;
  message: string;
  fix: string;
}

const RULES: Rule[] = [
  { id: "innerhtml-sink", severity: "warning", files: JS_LIKE,
    match: /\.innerHTML\s*=/g,
    message: "innerHTML assignment can enable XSS if input is untrusted.",
    fix: "Use textContent, or sanitize with DOMPurify before assigning." },
  { id: "outerhtml-sink", severity: "warning", files: JS_LIKE,
    match: /\.outerHTML\s*=/g,
    message: "outerHTML assignment is an XSS sink.",
    fix: "Rebuild DOM with createElement/textContent." },
  { id: "insert-adjacent-html", severity: "warning", files: JS_LIKE,
    match: /insertAdjacentHTML\s*\(/g,
    message: "insertAdjacentHTML can execute HTML — XSS sink.",
    fix: "Use insertAdjacentText or create nodes explicitly." },
  { id: "exec-script-code", severity: "critical", files: JS_LIKE,
    match: /chrome\.scripting\.executeScript\s*\([^)]*code\s*:/g,
    message: "Legacy string-based executeScript is disallowed in MV3.",
    fix: "Use { func } or { files } form of chrome.scripting.executeScript." },
  { id: "openai-key", severity: "critical", files: /.*/,
    match: /\bsk-[A-Za-z0-9]{20,}\b/g,
    message: "Possible OpenAI API key committed to source.",
    fix: "Rotate the key immediately. Never bundle API keys in the extension." },
  { id: "google-api-key", severity: "critical", files: /.*/,
    match: /\bAIza[0-9A-Za-z_\-]{35}\b/g,
    message: "Possible Google API key committed to source.",
    fix: "Rotate the key and load it from a backend proxy." },
  { id: "slack-token", severity: "critical", files: /.*/,
    match: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
    message: "Possible Slack token committed to source.",
    fix: "Rotate the token; never ship credentials in an extension." },
  { id: "aws-key", severity: "critical", files: /.*/,
    match: /\bAKIA[0-9A-Z]{16}\b/g,
    message: "Possible AWS access key committed to source.",
    fix: "Rotate the key and remove from the bundle." },
  { id: "jwt-token", severity: "warning", files: /.*/,
    match: /\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b/g,
    message: "Possible JWT embedded in source.",
    fix: "If real, rotate. Tokens must be issued at runtime, not bundled." },
];

const CSP_UNSAFE = /(unsafe-inline|unsafe-eval|\*\s|https?:\s)/i;

export function scanSecurity(files: Record<string, string>): SecurityIssue[] {
  const out: SecurityIssue[] = [];
  for (const [file, content] of Object.entries(files)) {
    if (typeof content !== "string") continue;
    for (const rule of RULES) {
      if (!rule.files.test(file)) continue;
      rule.match.lastIndex = 0;
      let m: RegExpExecArray | null;
      const seen = new Set<number>();
      while ((m = rule.match.exec(content)) !== null) {
        const line = content.slice(0, m.index).split("\n").length;
        if (seen.has(line)) continue;
        seen.add(line);
        out.push({ id: rule.id, severity: rule.severity, file, line, message: rule.message, fix: rule.fix });
        if (!rule.match.global) break;
      }
    }
  }

  // Manifest CSP inspection
  const manifestRaw = files["manifest.json"];
  if (manifestRaw) {
    try {
      const m = JSON.parse(manifestRaw);
      const csp = m?.content_security_policy;
      const values: string[] = [];
      if (typeof csp === "string") values.push(csp);
      else if (csp && typeof csp === "object") {
        if (csp.extension_pages) values.push(csp.extension_pages);
        if (csp.sandbox) values.push(csp.sandbox);
      }
      for (const v of values) {
        if (CSP_UNSAFE.test(v)) {
          out.push({
            id: "csp-unsafe", severity: "critical", file: "manifest.json",
            message: `content_security_policy contains unsafe directive: "${v}"`,
            fix: "Use script-src 'self'; object-src 'self'; no unsafe-inline or unsafe-eval.",
          });
        }
      }
    } catch { /* handled by syntax scanner */ }
  }
  return out;
}
