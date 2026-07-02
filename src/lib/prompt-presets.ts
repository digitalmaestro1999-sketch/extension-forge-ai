// Prompt Studio: rich prompt templates + variations for the Autonomous
// Extension Agent. These are composed into the user's idea before the
// pipeline runs, and a `profile` object is attached to the spec so downstream
// stages (code / security / compliance) can honor the same quality bar.

export interface PromptPreset {
  id: string;
  label: string;
  emoji: string;
  category: string;
  short: string; // one-liner shown as chip description
  template: string; // full detailed brief injected before the user's idea
  suggestedPermissions: string[];
  suggestedFeatures: string[];
}

export interface QualityBooster {
  id: string;
  label: string;
  description: string;
  directive: string; // sentence appended to the composed prompt
  default?: boolean;
}

export interface DesignStyle {
  id: string;
  label: string;
  description: string;
  directive: string;
}

export interface AudienceTone {
  id: string;
  label: string;
  directive: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY PRESETS — detailed briefs the AI expands from
// ─────────────────────────────────────────────────────────────────────────────

export const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: "ai-summarizer",
    label: "AI Content Summarizer",
    emoji: "📝",
    category: "AI / Productivity",
    short: "Summarize any page, article, or video with one click.",
    template:
      "Build a Chrome extension that summarizes the current page's main content (articles, blog posts, YouTube transcripts) using an LLM. The popup shows a clean summary with bullet key-points, estimated reading time saved, and one-click copy/share. Users can pick length (short / medium / detailed) and tone (neutral / casual / academic). Save history to chrome.storage.local with search and pinning. Support keyboard shortcut Alt+S. Export notes as Markdown.",
    suggestedPermissions: ["activeTab", "storage", "scripting"],
    suggestedFeatures: [
      "One-click page summarization",
      "YouTube transcript summarization",
      "Length & tone controls",
      "History with search + pin",
      "Markdown export",
      "Keyboard shortcut Alt+S",
    ],
  },
  {
    id: "focus-blocker",
    label: "Focus & Site Blocker",
    emoji: "🎯",
    category: "Productivity",
    short: "Block distracting sites with schedules and streaks.",
    template:
      "Build a Chrome extension that blocks user-defined distracting sites during focus sessions. Include Pomodoro timer (25/5 configurable), scheduled focus blocks (weekday/weekend), pass-phrase override with cool-down, per-site allow-lists, daily/weekly stats and streaks, and gentle full-page block screens with motivational quotes. Sync settings via chrome.storage.sync.",
    suggestedPermissions: ["storage", "declarativeNetRequest", "alarms", "notifications"],
    suggestedFeatures: [
      "Pomodoro timer",
      "Scheduled focus blocks",
      "Pass-phrase override + cool-down",
      "Per-site allow-list",
      "Streaks & weekly stats",
      "Gentle block screen",
    ],
  },
  {
    id: "price-tracker",
    label: "Price Tracker & Deals",
    emoji: "💰",
    category: "Shopping",
    short: "Track prices across Amazon, eBay, and more.",
    template:
      "Build a Chrome extension that detects product pages on major retailers (Amazon, eBay, Walmart, Best Buy), tracks price history, and notifies users when prices drop below their target. Show price history sparkline in the popup, wishlist management, price-drop desktop notifications, and CSV export.",
    suggestedPermissions: ["activeTab", "storage", "alarms", "notifications"],
    suggestedFeatures: [
      "Auto-detect product pages",
      "Price history sparkline",
      "Target-price alerts",
      "Wishlist & folders",
      "CSV export",
    ],
  },
  {
    id: "reader-mode",
    label: "Clean Reader Mode",
    emoji: "📖",
    category: "Reading",
    short: "Strip clutter and reflow any article beautifully.",
    template:
      "Build a Chrome extension that transforms any article into a distraction-free reader view. Strip ads, popups, and sidebars; reflow content with adjustable font, line-height, column width, sepia/dark/light themes. Support text-to-speech, translate paragraph on select, and save-for-later.",
    suggestedPermissions: ["activeTab", "storage", "tts"],
    suggestedFeatures: [
      "Distraction-free reader",
      "Theme + typography controls",
      "Text-to-speech playback",
      "Translate paragraph on select",
      "Save-for-later library",
    ],
  },
  {
    id: "password-vault",
    label: "Lite Password Vault",
    emoji: "🔐",
    category: "Security",
    short: "Client-side encrypted logins with autofill.",
    template:
      "Build a Chrome extension that stores logins encrypted with a user master password (WebCrypto AES-GCM + PBKDF2). Autofill username/password on matching domains, generate strong passwords, and provide a security audit (reused, weak, breached — via k-anonymity API to HIBP). Never send plaintext credentials anywhere; all data stays in chrome.storage.local encrypted.",
    suggestedPermissions: ["activeTab", "storage", "scripting"],
    suggestedFeatures: [
      "Master-password encryption",
      "Autofill on matching domains",
      "Strong password generator",
      "Reused/weak audit",
      "HIBP breach check (k-anonymity)",
    ],
  },
  {
    id: "seo-inspector",
    label: "SEO Page Inspector",
    emoji: "🔍",
    category: "Developer",
    short: "Instant SEO, schema, and metadata audit for any page.",
    template:
      "Build a Chrome extension that inspects the current page for SEO signals: title/meta length, canonical, H1-H6 structure, Open Graph & Twitter tags, JSON-LD schema validity, image alt coverage, Core Web Vitals hints, hreflang, robots directives. Show scorecards with pass/warn/fail and copy-ready fixes.",
    suggestedPermissions: ["activeTab", "scripting", "storage"],
    suggestedFeatures: [
      "Meta & OG audit",
      "Schema.org validator",
      "Heading hierarchy check",
      "Alt-text coverage",
      "Copy-ready fix suggestions",
    ],
  },
  {
    id: "screenshot-tool",
    label: "Full-Page Screenshot & Annotate",
    emoji: "📸",
    category: "Utility",
    short: "Capture, crop, annotate, and share screenshots.",
    template:
      "Build a Chrome extension that captures full-page, viewport, or selected-area screenshots. Offer an annotation canvas (arrow, box, blur, text, numbering), export as PNG/JPG/PDF, copy to clipboard, and quick-share via mailto:. Remember last tool and colors.",
    suggestedPermissions: ["activeTab", "scripting", "storage", "downloads"],
    suggestedFeatures: [
      "Full-page + area capture",
      "Annotation canvas",
      "Blur/redact regions",
      "PNG/JPG/PDF export",
      "Copy to clipboard",
    ],
  },
  {
    id: "tab-manager",
    label: "Tab Manager Pro",
    emoji: "🗂️",
    category: "Productivity",
    short: "Group, session-save, and de-duplicate tabs.",
    template:
      "Build a Chrome extension that manages tabs at scale: group by domain/color, save/restore sessions, close duplicates, suspend inactive tabs to free memory, and search all open tabs by title/URL. Show a compact popup dashboard with drag-to-reorder.",
    suggestedPermissions: ["tabs", "storage", "tabGroups"],
    suggestedFeatures: [
      "Auto-group by domain",
      "Session save/restore",
      "Duplicate detector",
      "Inactive tab suspender",
      "Fuzzy search all tabs",
    ],
  },
  {
    id: "ai-writer",
    label: "AI Writing Assistant",
    emoji: "✍️",
    category: "AI / Productivity",
    short: "Rewrite, expand, and translate any selected text.",
    template:
      "Build a Chrome extension that adds a floating toolbar when the user selects text on any page. Offer: rewrite (formal / casual / concise / persuasive), expand, shorten, fix grammar, translate to N languages, tone-shift. Results appear in a resizable side panel with 'Copy', 'Insert', 'Replace selection'. History with undo.",
    suggestedPermissions: ["activeTab", "storage", "scripting", "sidePanel"],
    suggestedFeatures: [
      "Selection-triggered toolbar",
      "Rewrite / expand / shorten",
      "Multi-language translate",
      "Grammar fixer",
      "Insert or replace selection",
    ],
  },
  {
    id: "meeting-notes",
    label: "Meeting Notes & Transcripts",
    emoji: "🎙️",
    category: "Collaboration",
    short: "Capture Google Meet / Zoom captions to structured notes.",
    template:
      "Build a Chrome extension that captures live captions from Google Meet and Zoom Web, timestamps them, and produces a structured summary (action items, decisions, questions). Export as Markdown / Notion / clipboard. Speaker-diarize via visible name labels.",
    suggestedPermissions: ["activeTab", "storage", "scripting"],
    suggestedFeatures: [
      "Live caption capture (Meet/Zoom)",
      "Speaker-labeled transcript",
      "AI action-item extraction",
      "Markdown/Notion export",
    ],
  },
  {
    id: "dark-mode-anywhere",
    label: "Universal Dark Mode",
    emoji: "🌙",
    category: "Accessibility",
    short: "Force a beautiful dark theme on every site.",
    template:
      "Build a Chrome extension that applies a well-tuned dark theme to any website (smart color inversion, image dimming, respecting per-site opt-out). Provide brightness/contrast sliders, per-site enable/disable, and a scheduler (sunset→sunrise).",
    suggestedPermissions: ["activeTab", "storage", "scripting"],
    suggestedFeatures: [
      "Smart color inversion",
      "Image dimming",
      "Per-site toggle",
      "Sunset→sunrise scheduler",
    ],
  },
  {
    id: "json-formatter",
    label: "JSON / API Devtools",
    emoji: "🧪",
    category: "Developer",
    short: "Auto-format JSON responses and inspect APIs.",
    template:
      "Build a Chrome extension that detects JSON responses in the browser and renders them collapsible, syntax-highlighted, with search, path-copy (dot + bracket), size stats, and diff between two payloads. Include a small REST client in the popup with saved requests.",
    suggestedPermissions: ["activeTab", "storage", "scripting"],
    suggestedFeatures: [
      "Auto-format JSON responses",
      "Collapsible tree + search",
      "Copy JSONPath",
      "Two-payload diff",
      "Mini REST client",
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// QUALITY BOOSTERS — toggles that push the output toward professional grade
// ─────────────────────────────────────────────────────────────────────────────

export const QUALITY_BOOSTERS: QualityBooster[] = [
  {
    id: "polished-ui",
    label: "Polished UI",
    description: "Modern dark theme, consistent spacing, subtle motion, empty states.",
    directive:
      "Apply a polished, production-grade UI: consistent 8px spacing scale, tasteful hover/focus states, empty states with helpful copy, loading skeletons, and micro-animations under 200ms. Follow the app's dark-theme design tokens; never inline hex colors.",
    default: true,
  },
  {
    id: "accessibility",
    label: "Accessibility (WCAG AA)",
    description: "Semantic HTML, ARIA, keyboard, and 4.5:1 contrast.",
    directive:
      "Meet WCAG 2.1 AA: semantic HTML, correct aria-* attributes, visible focus rings, full keyboard navigation, 4.5:1 minimum contrast, screen-reader labels on all interactive elements, and prefers-reduced-motion support.",
    default: true,
  },
  {
    id: "i18n",
    label: "Internationalization",
    description: "Use chrome.i18n with an en/ locale scaffold.",
    directive:
      "Wire chrome.i18n: put all user-facing strings in _locales/en/messages.json, reference them via __MSG_key__ or chrome.i18n.getMessage, and set default_locale in the manifest.",
  },
  {
    id: "error-handling",
    label: "Robust Error Handling",
    description: "try/catch around all async, user-friendly error UI, no console-only failures.",
    directive:
      "Wrap every async call in try/catch. Surface failures with a user-friendly toast or inline banner (never silent). Log structured errors with a short code so support can trace them.",
    default: true,
  },
  {
    id: "storage-quota",
    label: "Storage Quota Guard",
    description: "Handle chrome.storage limits with graceful eviction.",
    directive:
      "Guard chrome.storage writes against QUOTA_BYTES limits: check size before write, LRU-evict oldest non-pinned entries, and warn the user before data loss.",
  },
  {
    id: "telemetry-optin",
    label: "Privacy-First Telemetry (opt-in)",
    description: "Anonymous usage counters, off by default, clearly explained.",
    directive:
      "Add opt-in anonymous telemetry (event counts only, no PII, no page content). Off by default. Clearly explain in the options page what is collected and provide a one-click purge.",
  },
  {
    id: "onboarding",
    label: "First-Run Onboarding",
    description: "Welcome tab on install with 3-step tour.",
    directive:
      "On install, open a welcome tab with a 3-step tour: what it does, how to use it, and a link to settings. Persist a 'seen' flag so it never repeats.",
  },
  {
    id: "keyboard-shortcuts",
    label: "Keyboard Shortcuts",
    description: "Register 1-2 shortcuts via manifest 'commands'.",
    directive:
      "Register 1-2 keyboard shortcuts via manifest 'commands' (Alt+Shift+key by default) and handle them in the background service worker.",
  },
  {
    id: "auto-update",
    label: "Update Notes on Version Bump",
    description: "Show a 'What's new' modal after chrome.runtime updates.",
    directive:
      "In background.js, listen to chrome.runtime.onInstalled for reason==='update' and open an in-popup 'What's new' modal that reads from CHANGELOG constants in the code.",
  },
  {
    id: "tests-scaffold",
    label: "Test Scaffold",
    description: "Include a tests/ folder with a smoke test for popup logic.",
    directive:
      "Include a tests/ folder with at least one Vitest smoke test that imports pure logic modules (no DOM) and asserts basic behaviour. Add a short tests/README.md.",
  },
  {
    id: "privacy-policy",
    label: "Bundled Privacy Policy",
    description: "Ship PRIVACY.md tailored to declared permissions.",
    directive:
      "Ship a PRIVACY.md at the root that lists every declared permission, the exact reason it is used, what data (if any) is stored, where it is stored, and how the user can purge it.",
    default: true,
  },
  {
    id: "least-privilege",
    label: "Least-Privilege Manifest",
    description: "Prefer activeTab over host permissions, narrow matches.",
    directive:
      "Follow least-privilege: prefer activeTab + chrome.scripting.executeScript over broad host_permissions, never use <all_urls>, and narrow content_scripts matches to specific domains.",
    default: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN STYLES — visual variations
// ─────────────────────────────────────────────────────────────────────────────

export const DESIGN_STYLES: DesignStyle[] = [
  {
    id: "cyber-dark",
    label: "Cyber Dark",
    description: "Neon accents on deep slate, mono headings, subtle glow.",
    directive:
      "Design language: 'Cyber Dark' — deep slate background (#09090b), neon primary accent, JetBrains Mono for numeric/status, subtle 8% glow on active elements.",
  },
  {
    id: "glass-minimal",
    label: "Glass Minimal",
    description: "Frosted glass, generous whitespace, thin borders.",
    directive:
      "Design language: 'Glass Minimal' — frosted-glass surfaces (backdrop-filter: blur(12px)), thin 1px borders at 10% opacity, generous 24px whitespace, no gradients.",
  },
  {
    id: "linear-clean",
    label: "Linear Clean",
    description: "Grayscale base, single accent, ultra-crisp typography.",
    directive:
      "Design language: 'Linear Clean' — near-grayscale palette with one restrained accent, Inter typography, 4px radius, ultra-tight vertical rhythm inspired by Linear.app.",
  },
  {
    id: "playful-bright",
    label: "Playful Bright",
    description: "Rounded, colorful, friendly copy, soft shadows.",
    directive:
      "Design language: 'Playful Bright' — light background, 16px radius, warm accent palette, soft ambient shadows, friendly conversational copy.",
  },
  {
    id: "brutalist-mono",
    label: "Brutalist Mono",
    description: "Sharp corners, mono type, high contrast, no shadows.",
    directive:
      "Design language: 'Brutalist Mono' — pure monospace, 0px radius, black/white/one-color, hard borders, no shadows, deliberate 'raw' aesthetic.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// AUDIENCE / TONE
// ─────────────────────────────────────────────────────────────────────────────

export const AUDIENCE_TONES: AudienceTone[] = [
  { id: "prosumer", label: "Prosumer", directive: "Target power-users comfortable with settings and shortcuts. Copy is concise and technical-friendly." },
  { id: "casual",   label: "Casual",    directive: "Target casual users. Copy is friendly, jargon-free, and every action has a plain-English label." },
  { id: "developer",label: "Developer", directive: "Target developers. Expose raw values, JSON views, and provide copyable code snippets throughout." },
  { id: "enterprise",label:"Enterprise",directive: "Target enterprise buyers. Emphasize privacy, admin controls, SSO-readiness, and audit logging in copy." },
];

// ─────────────────────────────────────────────────────────────────────────────
// Composer
// ─────────────────────────────────────────────────────────────────────────────

export interface ComposeInput {
  idea: string;
  presetId?: string | null;
  boosterIds: string[];
  styleId?: string | null;
  toneId?: string | null;
}

export interface ComposedPrompt {
  idea: string;             // final enhanced idea string (fed as `idea`)
  profile: {                // attached to spec.profile for downstream stages
    preset: string | null;
    style: string | null;
    tone: string | null;
    boosters: string[];
    directives: string[];
    variant?: string | null;
  };
}

export function composePrompt(input: ComposeInput & { variantId?: string | null }): ComposedPrompt {
  const preset = PROMPT_PRESETS.find((p) => p.id === input.presetId) || null;
  const style  = DESIGN_STYLES.find((s) => s.id === input.styleId) || null;
  const tone   = AUDIENCE_TONES.find((t) => t.id === input.toneId) || null;
  const boosters = QUALITY_BOOSTERS.filter((b) => input.boosterIds.includes(b.id));
  const variant = PROMPT_VARIATIONS.find((v) => v.id === input.variantId) || null;
  const presetTemplate = preset ? getPresetTemplate(preset.id) : "";

  const sections: string[] = [];

  if (preset) {
    sections.push(`## Preset brief: ${preset.label}\n${presetTemplate || preset.template}`);
    if (preset.suggestedFeatures.length) {
      sections.push(`### Must-have features\n- ${preset.suggestedFeatures.join("\n- ")}`);
    }
  }

  if (input.idea.trim()) {
    sections.push(`## User idea\n${input.idea.trim()}`);
  }

  const directives: string[] = [];
  if (style) directives.push(style.directive);
  if (tone) directives.push(tone.directive);
  for (const b of boosters) directives.push(b.directive);
  if (variant) directives.push(variant.directive);

  if (directives.length) {
    sections.push(`## Quality directives (non-negotiable)\n- ${directives.join("\n- ")}`);
  }

  sections.push(
    "## Output bar\nThis must feel like a paid, Web-Store-featured extension: no lorem ipsum, no TODOs, no placeholder copy, no dead buttons. Every visible control must do exactly what its label says."
  );

  return {
    idea: sections.join("\n\n"),
    profile: {
      preset: preset?.id ?? null,
      style: style?.id ?? null,
      tone: tone?.id ?? null,
      boosters: boosters.map((b) => b.id),
      directives,
      variant: variant?.id ?? null,
    } as ComposedPrompt["profile"],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT VARIATIONS — run the same brief with different creative angles
// ─────────────────────────────────────────────────────────────────────────────

export interface PromptVariation {
  id: string;
  label: string;
  description: string;
  directive: string;
}

export const PROMPT_VARIATIONS: PromptVariation[] = [
  {
    id: "mvp",
    label: "Lean MVP",
    description: "Smallest viable feature set, ship-fast.",
    directive:
      "Variation: 'Lean MVP' — implement only the 2-3 must-have features, defer nice-to-haves, keep UI to a single popup screen, no options page complexity.",
  },
  {
    id: "pro",
    label: "Feature-Rich Pro",
    description: "Full-featured, tabs, filters, exports.",
    directive:
      "Variation: 'Feature-Rich Pro' — implement every suggested feature plus advanced settings, filters, bulk actions, exports, and keyboard shortcuts. Assume power users.",
  },
  {
    id: "minimal",
    label: "Opinionated Minimal",
    description: "One job done perfectly, no settings.",
    directive:
      "Variation: 'Opinionated Minimal' — do ONE thing exceptionally well with zero configuration. No options page. Sensible defaults only. Beautiful, tight UI.",
  },
  {
    id: "privacy",
    label: "Privacy-Maximal",
    description: "Zero network calls, everything local.",
    directive:
      "Variation: 'Privacy-Maximal' — no network calls whatsoever, no analytics, no remote assets. Everything runs on-device with chrome.storage.local. Emphasize privacy in copy.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PRESET CUSTOMIZER — persist user edits to preset templates in localStorage
// ─────────────────────────────────────────────────────────────────────────────

const PRESET_OVERRIDE_KEY = "prompt-preset-overrides:v1";

function loadOverrides(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PRESET_OVERRIDE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function getPresetTemplate(id: string): string {
  const overrides = loadOverrides();
  if (overrides[id]) return overrides[id];
  return PROMPT_PRESETS.find((p) => p.id === id)?.template || "";
}

export function setPresetOverride(id: string, template: string): void {
  const overrides = loadOverrides();
  if (template.trim()) overrides[id] = template;
  else delete overrides[id];
  localStorage.setItem(PRESET_OVERRIDE_KEY, JSON.stringify(overrides));
}

export function resetPresetOverride(id: string): void {
  const overrides = loadOverrides();
  delete overrides[id];
  localStorage.setItem(PRESET_OVERRIDE_KEY, JSON.stringify(overrides));
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT QUALITY CHECKLIST — heuristic scoring of a composed prompt
// ─────────────────────────────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  label: string;
  passed: boolean;
  weight: number; // contribution to score
  hint?: string;
}

export interface PromptQualityReport {
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  items: ChecklistItem[];
}

export function scorePrompt(composed: ComposedPrompt, rawIdea: string): PromptQualityReport {
  const text = composed.idea.toLowerCase();
  const wordCount = composed.idea.trim().split(/\s+/).filter(Boolean).length;
  const items: ChecklistItem[] = [
    {
      id: "length",
      label: "Sufficient detail (>= 60 words)",
      passed: wordCount >= 60,
      weight: 10,
      hint: "Add more specifics about what the extension does and for whom.",
    },
    {
      id: "not-too-long",
      label: "Not bloated (<= 800 words)",
      passed: wordCount <= 800,
      weight: 5,
      hint: "Trim redundant sentences — long prompts hurt code quality.",
    },
    {
      id: "user-idea",
      label: "User idea present",
      passed: rawIdea.trim().length >= 12,
      weight: 15,
      hint: "Describe the extension in your own words in the main text area.",
    },
    {
      id: "preset",
      label: "Category preset selected",
      passed: !!composed.profile.preset,
      weight: 10,
      hint: "Pick a category preset for a proven brief structure.",
    },
    {
      id: "style",
      label: "Design style chosen",
      passed: !!composed.profile.style,
      weight: 8,
      hint: "Pick a visual style so the UI has a coherent design language.",
    },
    {
      id: "tone",
      label: "Audience tone chosen",
      passed: !!composed.profile.tone,
      weight: 7,
      hint: "Pick an audience tone so copy is targeted, not generic.",
    },
    {
      id: "polish",
      label: "Polished UI booster",
      passed: composed.profile.boosters.includes("polished-ui"),
      weight: 8,
    },
    {
      id: "a11y",
      label: "Accessibility booster",
      passed: composed.profile.boosters.includes("accessibility"),
      weight: 8,
    },
    {
      id: "errors",
      label: "Error-handling booster",
      passed: composed.profile.boosters.includes("error-handling"),
      weight: 7,
    },
    {
      id: "privacy",
      label: "Privacy policy or least-privilege booster",
      passed:
        composed.profile.boosters.includes("privacy-policy") ||
        composed.profile.boosters.includes("least-privilege"),
      weight: 7,
      hint: "Add at least one privacy/permission-hygiene booster.",
    },
    {
      id: "mentions-features",
      label: "Mentions concrete features (bullets, 'must', 'should')",
      passed: /(\n\s*-\s|\bmust\b|\bshould\b)/.test(text),
      weight: 10,
    },
    {
      id: "no-vague",
      label: "Avoids vague words ('etc', 'stuff', 'something')",
      passed: !/\b(etc\.?|stuff|something|whatever)\b/.test(text),
      weight: 5,
      hint: "Replace vague words with specifics.",
    },
  ];

  const totalWeight = items.reduce((a, i) => a + i.weight, 0);
  const earned = items.filter((i) => i.passed).reduce((a, i) => a + i.weight, 0);
  const score = Math.round((earned / totalWeight) * 100);
  const grade: PromptQualityReport["grade"] =
    score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 45 ? "D" : "F";
  return { score, grade, items };
}
