// Static accessibility checks on popup HTML.
// Regex-based (no DOMParser dependency). Feeds the Perf & A11y category
// of the readiness score.

export type A11ySeverity = "critical" | "warning" | "info";

export interface A11yIssue {
  id: string;
  severity: A11ySeverity;
  file: string;
  message: string;
  fix: string;
}

const HTML = /\.html?$/i;

function checkFile(file: string, html: string): A11yIssue[] {
  const out: A11yIssue[] = [];
  const push = (i: Omit<A11yIssue, "file">) => out.push({ file, ...i });

  // <html lang="…">
  if (!/<html[^>]*\blang\s*=/i.test(html)) {
    push({ id: "html-lang", severity: "warning",
      message: "<html> missing lang attribute.",
      fix: "Add lang=\"en\" (or the actual UI language) to the <html> tag." });
  }

  // <title>
  if (!/<title>[^<]{1,}<\/title>/i.test(html)) {
    push({ id: "title", severity: "warning",
      message: "Document is missing a non-empty <title>.",
      fix: "Add a descriptive <title>Popup name</title>." });
  }

  // Images without alt
  const imgs = Array.from(html.matchAll(/<img\b[^>]*>/gi));
  for (const m of imgs) {
    if (!/\balt\s*=/.test(m[0])) {
      push({ id: "img-alt", severity: "warning",
        message: "<img> tag missing alt attribute.",
        fix: "Add alt=\"…\" (empty alt=\"\" for decorative images)." });
      break;
    }
  }

  // Buttons with no accessible name (no text between tags AND no aria-label)
  const buttons = Array.from(html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi));
  for (const [, attrs, inner] of buttons) {
    const hasAria = /\baria-label\s*=/.test(attrs) || /\baria-labelledby\s*=/.test(attrs);
    const text = inner.replace(/<[^>]+>/g, "").trim();
    if (!hasAria && !text) {
      push({ id: "button-name", severity: "critical",
        message: "<button> has no accessible name (no text and no aria-label).",
        fix: "Add visible text or aria-label=\"…\" to the button." });
      break;
    }
  }

  // Inputs without associated labels
  const inputs = Array.from(html.matchAll(/<input\b([^>]*)>/gi));
  for (const [, attrs] of inputs) {
    const type = /\btype\s*=\s*["']?(\w+)/i.exec(attrs)?.[1]?.toLowerCase();
    if (type && ["hidden", "submit", "button", "reset"].includes(type)) continue;
    const id = /\bid\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
    const hasAria = /\baria-label\s*=/.test(attrs) || /\baria-labelledby\s*=/.test(attrs);
    const hasLabel = id ? new RegExp(`<label[^>]+for\\s*=\\s*["']${id}["']`, "i").test(html) : false;
    if (!hasAria && !hasLabel) {
      push({ id: "label", severity: "warning",
        message: "Form input has no associated <label> or aria-label.",
        fix: "Wrap in a <label> or add aria-label / for=\"id\" pairing." });
      break;
    }
  }

  // Positive tabindex
  if (/tabindex\s*=\s*["']?[1-9]/i.test(html)) {
    push({ id: "tabindex", severity: "warning",
      message: "Positive tabindex disrupts natural focus order.",
      fix: "Use tabindex=\"0\" (or -1 for programmatic focus) instead." });
  }

  // Duplicate id attributes
  const ids = Array.from(html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)).map(m => m[1]);
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const id of ids) { if (seen.has(id)) dupes.add(id); else seen.add(id); }
  if (dupes.size) {
    push({ id: "duplicate-id", severity: "warning",
      message: `Duplicate id attribute(s): ${[...dupes].join(", ")}.`,
      fix: "IDs must be unique — rename or use classes." });
  }

  return out;
}

export function checkAccessibility(files: Record<string, string>): A11yIssue[] {
  const out: A11yIssue[] = [];
  let popup: string | null = null;
  try {
    const m = JSON.parse(files["manifest.json"] ?? "{}");
    popup = m?.action?.default_popup ?? null;
  } catch { /* ignore */ }

  const targets = new Set<string>();
  if (popup && files[popup]) targets.add(popup);
  // Also scan any options page or other HTML in the bundle
  for (const f of Object.keys(files)) if (HTML.test(f)) targets.add(f);

  for (const f of targets) {
    const html = files[f];
    if (typeof html !== "string") continue;
    out.push(...checkFile(f, html));
  }
  return out;
}
