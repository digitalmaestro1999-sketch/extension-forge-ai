// Static syntax validation for extension source files.
// Uses `new Function` to check JS parseability without executing it — the
// Function constructor throws SyntaxError if the source can't be parsed.

export type SyntaxSeverity = "critical" | "warning" | "info";

export interface SyntaxIssue {
  id: string;
  severity: SyntaxSeverity;
  file: string;
  line?: number;
  message: string;
  fix: string;
}

function checkJson(file: string, source: string): SyntaxIssue[] {
  try {
    JSON.parse(source);
    return [];
  } catch (e) {
    return [{
      id: "invalid-json", severity: "critical", file,
      message: `Invalid JSON: ${(e as Error).message}`,
      fix: "Fix the JSON syntax — a broken manifest fails Chrome load.",
    }];
  }
}

function checkJs(file: string, source: string): SyntaxIssue[] {
  try {
    // eslint-disable-next-line no-new-func
    new Function(source);
    return [];
  } catch (e) {
    const msg = (e as Error).message;
    // Rough line hint from V8/Chromium: "Unexpected token ... at line N"
    const lineMatch = /line\s+(\d+)/i.exec(msg);
    return [{
      id: "invalid-js", severity: "critical", file,
      line: lineMatch ? Number(lineMatch[1]) : undefined,
      message: `JavaScript syntax error: ${msg}`,
      fix: "Fix the syntax error — the extension will fail to load.",
    }];
  }
}

function checkHtml(file: string, source: string): SyntaxIssue[] {
  // Very light heuristic: mismatched < and > counts.
  const opens = (source.match(/</g) || []).length;
  const closes = (source.match(/>/g) || []).length;
  if (opens !== closes) {
    return [{
      id: "unbalanced-html", severity: "warning", file,
      message: `HTML tag delimiters unbalanced (${opens} '<' vs ${closes} '>').`,
      fix: "Check for a missing '>' or stray '<' in the markup.",
    }];
  }
  return [];
}

function checkCss(file: string, source: string): SyntaxIssue[] {
  const opens = (source.match(/{/g) || []).length;
  const closes = (source.match(/}/g) || []).length;
  if (opens !== closes) {
    return [{
      id: "unbalanced-css", severity: "warning", file,
      message: `CSS braces unbalanced (${opens} '{' vs ${closes} '}').`,
      fix: "Match every '{' with a '}'.",
    }];
  }
  return [];
}

export function validateSyntax(files: Record<string, string>): SyntaxIssue[] {
  const out: SyntaxIssue[] = [];
  for (const [file, content] of Object.entries(files)) {
    if (typeof content !== "string") continue;
    if (/\.json$/i.test(file)) out.push(...checkJson(file, content));
    else if (/\.(js|mjs)$/i.test(file)) out.push(...checkJs(file, content));
    else if (/\.html?$/i.test(file)) out.push(...checkHtml(file, content));
    else if (/\.css$/i.test(file)) out.push(...checkCss(file, content));
  }
  return out;
}
