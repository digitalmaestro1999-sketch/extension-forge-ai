// Extension Theme & Logo Variation System
// Provides 8 professional color themes and 6 logo mark styles that plug
// into the generated extension's CSS + icons.

export interface ThemePreset {
  id: string;
  label: string;
  description: string;
  // Palette (all hex)
  accent: string;      // primary brand
  accentHover: string;
  accentSoft: string;  // used for rgba backgrounds; hex here, converted later
  bg: string;          // popup background
  bgElevated: string;  // cards / sections
  surface: string;     // rows
  surfaceHover: string;
  bgInput: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderSubtle: string;
  // Logo defaults
  logoBg: string;       // background gradient start
  logoBgTo: string;     // background gradient end
  logoFg: string;       // mark stroke/fill
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "midnight-indigo",
    label: "Midnight Indigo",
    description: "Deep navy with electric indigo. Sophisticated SaaS feel.",
    accent: "#6366f1", accentHover: "#818cf8", accentSoft: "#6366f1",
    bg: "#09090b", bgElevated: "#111114", surface: "#1c1c20", surfaceHover: "#232327", bgInput: "#27272a",
    text: "#fafafa", textSecondary: "#a1a1aa", textMuted: "#71717a",
    border: "#27272a", borderSubtle: "#1f1f23",
    logoBg: "#312e81", logoBgTo: "#6366f1", logoFg: "#ffffff",
  },
  {
    id: "cyber-mint",
    label: "Cyber Mint",
    description: "Neon mint on graphite. Fresh, technical, developer energy.",
    accent: "#2dd4a8", accentHover: "#5eead4", accentSoft: "#2dd4a8",
    bg: "#0a0d10", bgElevated: "#12171b", surface: "#1a2027", surfaceHover: "#232b34", bgInput: "#1e252c",
    text: "#f0fdfa", textSecondary: "#9db5b1", textMuted: "#6b7f7c",
    border: "#232b34", borderSubtle: "#1a2027",
    logoBg: "#0f766e", logoBgTo: "#2dd4a8", logoFg: "#04241e",
  },
  {
    id: "sunset-blaze",
    label: "Sunset Blaze",
    description: "Warm orange to magenta. Energetic, marketing-forward.",
    accent: "#ff6b35", accentHover: "#ff8555", accentSoft: "#ff6b35",
    bg: "#0f0a0f", bgElevated: "#1a1218", surface: "#241820", surfaceHover: "#2e2029", bgInput: "#2b1c26",
    text: "#fff5f0", textSecondary: "#c9a89e", textMuted: "#8a706a",
    border: "#2e2029", borderSubtle: "#241820",
    logoBg: "#c2410c", logoBgTo: "#e11d74", logoFg: "#ffffff",
  },
  {
    id: "noir-gold",
    label: "Noir Gold",
    description: "Pure black with luxurious gold. Premium, editorial.",
    accent: "#c9a84c", accentHover: "#e6c877", accentSoft: "#c9a84c",
    bg: "#0a0a0a", bgElevated: "#141414", surface: "#1c1c1c", surfaceHover: "#242424", bgInput: "#1f1f1f",
    text: "#f5f0e0", textSecondary: "#a89a7a", textMuted: "#736a55",
    border: "#242424", borderSubtle: "#1c1c1c",
    logoBg: "#1a1a1a", logoBgTo: "#3a2e10", logoFg: "#c9a84c",
  },
  {
    id: "arctic-frost",
    label: "Arctic Frost",
    description: "Icy blue on cool slate. Clean enterprise, trustworthy.",
    accent: "#3b82f6", accentHover: "#60a5fa", accentSoft: "#3b82f6",
    bg: "#0b1220", bgElevated: "#111a2e", surface: "#1a2540", surfaceHover: "#22304f", bgInput: "#1e2b48",
    text: "#f0f6ff", textSecondary: "#a0b2cf", textMuted: "#6b7e9c",
    border: "#22304f", borderSubtle: "#1a2540",
    logoBg: "#1e40af", logoBgTo: "#60a5fa", logoFg: "#ffffff",
  },
  {
    id: "emerald-prestige",
    label: "Emerald Prestige",
    description: "Rich emerald with gold accent. Authority + calm.",
    accent: "#10b981", accentHover: "#34d399", accentSoft: "#10b981",
    bg: "#06110d", bgElevated: "#0d1c17", surface: "#122921", surfaceHover: "#1a362c", bgInput: "#153228",
    text: "#f0fdf6", textSecondary: "#9ab8ab", textMuted: "#688477",
    border: "#1a362c", borderSubtle: "#122921",
    logoBg: "#064e3b", logoBgTo: "#10b981", logoFg: "#f5f0e0",
  },
  {
    id: "vapor-chrome",
    label: "Vapor Chrome",
    description: "Iridescent violet + cyan. Y2K futurism, playful.",
    accent: "#a78bfa", accentHover: "#c4b5fd", accentSoft: "#a78bfa",
    bg: "#0d0a1a", bgElevated: "#161129", surface: "#201938", surfaceHover: "#2a2247", bgInput: "#241d3f",
    text: "#f5f3ff", textSecondary: "#b0a8d0", textMuted: "#7a739c",
    border: "#2a2247", borderSubtle: "#201938",
    logoBg: "#6d28d9", logoBgTo: "#67e8f9", logoFg: "#0d0a1a",
  },
  {
    id: "paper-ink",
    label: "Paper & Ink",
    description: "Off-white on rich black. Swiss, editorial, minimal.",
    accent: "#0d0d0d", accentHover: "#2d2d2d", accentSoft: "#0d0d0d",
    bg: "#f5f3ee", bgElevated: "#ffffff", surface: "#eeeae2", surfaceHover: "#e4dfd4", bgInput: "#ffffff",
    text: "#0d0d0d", textSecondary: "#3a3a3a", textMuted: "#767268",
    border: "#d8d3c8", borderSubtle: "#e4dfd4",
    logoBg: "#0d0d0d", logoBgTo: "#2d2d2d", logoFg: "#f5f3ee",
  },
  {
    id: "solar-flare",
    label: "Solar Flare",
    description: "Deep charcoal with molten amber. Warm, confident, premium.",
    accent: "#f59e0b", accentHover: "#fbbf24", accentSoft: "#f59e0b",
    bg: "#0c0a09", bgElevated: "#1a1613", surface: "#26201b", surfaceHover: "#332a22", bgInput: "#2b241d",
    text: "#fef7e0", textSecondary: "#bfae86", textMuted: "#857960",
    border: "#332a22", borderSubtle: "#26201b",
    logoBg: "#7c2d12", logoBgTo: "#f59e0b", logoFg: "#0c0a09",
  },
  {
    id: "rose-quartz",
    label: "Rose Quartz",
    description: "Soft rose on plum. Elegant, lifestyle, wellness-friendly.",
    accent: "#f472b6", accentHover: "#f9a8d4", accentSoft: "#f472b6",
    bg: "#150d14", bgElevated: "#1f1520", surface: "#2b1e2c", surfaceHover: "#382838", bgInput: "#31232f",
    text: "#fdf2f8", textSecondary: "#c9a8be", textMuted: "#8a7080",
    border: "#382838", borderSubtle: "#2b1e2c",
    logoBg: "#831843", logoBgTo: "#f472b6", logoFg: "#fdf2f8",
  },
  {
    id: "carbon-lime",
    label: "Carbon Lime",
    description: "Industrial carbon with neon lime. Hacker, terminal energy.",
    accent: "#a3e635", accentHover: "#bef264", accentSoft: "#a3e635",
    bg: "#0a0b0a", bgElevated: "#131513", surface: "#1c1f1c", surfaceHover: "#252925", bgInput: "#1f2320",
    text: "#f7fee7", textSecondary: "#a3b09c", textMuted: "#6a7566",
    border: "#252925", borderSubtle: "#1c1f1c",
    logoBg: "#365314", logoBgTo: "#a3e635", logoFg: "#0a0b0a",
  },
  {
    id: "porcelain",
    label: "Porcelain",
    description: "Bright airy neutrals with cobalt accent. Docs & productivity.",
    accent: "#2563eb", accentHover: "#3b82f6", accentSoft: "#2563eb",
    bg: "#ffffff", bgElevated: "#f7f8fa", surface: "#eef1f5", surfaceHover: "#e4e8ee", bgInput: "#ffffff",
    text: "#0f172a", textSecondary: "#475569", textMuted: "#64748b",
    border: "#d8dee6", borderSubtle: "#e4e8ee",
    logoBg: "#1e40af", logoBgTo: "#3b82f6", logoFg: "#ffffff",
  },
  {
    id: "sakura-light",
    label: "Sakura Light",
    description: "Warm off-white with cherry accent. Soft, friendly, welcoming.",
    accent: "#e11d48", accentHover: "#f43f5e", accentSoft: "#e11d48",
    bg: "#fdf7f5", bgElevated: "#ffffff", surface: "#f7ebe8", surfaceHover: "#f0dcd7", bgInput: "#ffffff",
    text: "#1c0f10", textSecondary: "#5a3a3d", textMuted: "#8a6a6d",
    border: "#e8d2ce", borderSubtle: "#f0dcd7",
    logoBg: "#9f1239", logoBgTo: "#f43f5e", logoFg: "#fdf7f5",
  },
  {
    id: "matcha-cream",
    label: "Matcha Cream",
    description: "Cream backdrop with matcha green. Calm, organic, editorial.",
    accent: "#4d7c0f", accentHover: "#65a30d", accentSoft: "#4d7c0f",
    bg: "#fbfaf3", bgElevated: "#ffffff", surface: "#f0eee0", surfaceHover: "#e5e2ce", bgInput: "#ffffff",
    text: "#1a1c10", textSecondary: "#4b5238", textMuted: "#7a8064",
    border: "#dcd8c0", borderSubtle: "#e5e2ce",
    logoBg: "#365314", logoBgTo: "#65a30d", logoFg: "#fbfaf3",
  },
];

export const DEFAULT_THEME_ID = "midnight-indigo";

const CUSTOM_THEMES_KEY = "extforge:custom-themes:v1";

export function loadCustomThemes(): ThemePreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_THEMES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as ThemePreset[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomTheme(theme: ThemePreset): ThemePreset[] {
  const existing = loadCustomThemes().filter(t => t.id !== theme.id);
  const next = [...existing, theme];
  try {
    window.localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function deleteCustomTheme(id: string): ThemePreset[] {
  const next = loadCustomThemes().filter(t => t.id !== id);
  try {
    window.localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function getAllThemes(): ThemePreset[] {
  return [...THEME_PRESETS, ...loadCustomThemes()];
}

export function getTheme(id?: string | null): ThemePreset {
  const all = getAllThemes();
  return all.find(t => t.id === id) || all[0];
}

// ---------------- Contrast (WCAG 2.1) ----------------

function hexToRgbTriplet(hex: string): [number, number, number] {
  const h = (hex || "").replace("#", "").trim();
  const v = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const n = parseInt(v || "000000", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgbTriplet(hex).map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: string, bg: string): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

export type WcagLevel = "AAA" | "AA" | "AA Large" | "Fail";

export function wcagLevel(ratio: number, largeText = false): WcagLevel {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3 && largeText) return "AA Large";
  return "Fail";
}

export interface ContrastCheck {
  label: string;
  fg: string;
  bg: string;
  ratio: number;
  level: WcagLevel;
  largeText: boolean;
  required: number;
  passes: boolean;
}

export function auditThemeContrast(t: ThemePreset): ContrastCheck[] {
  const pairs: Array<Omit<ContrastCheck, "ratio" | "level" | "passes">> = [
    { label: "Body text on background",     fg: t.text,          bg: t.bg,         largeText: false, required: 4.5 },
    { label: "Body text on elevated",       fg: t.text,          bg: t.bgElevated, largeText: false, required: 4.5 },
    { label: "Secondary text on surface",   fg: t.textSecondary, bg: t.surface,    largeText: false, required: 4.5 },
    { label: "Muted text on background",    fg: t.textMuted,     bg: t.bg,         largeText: true,  required: 3   },
    { label: "Accent button label",         fg: t.logoFg,        bg: t.accent,     largeText: false, required: 4.5 },
    { label: "Accent on background (UI)",   fg: t.accent,        bg: t.bg,         largeText: true,  required: 3   },
    { label: "Border vs background (UI)",   fg: t.border,        bg: t.bg,         largeText: true,  required: 3   },
    { label: "Input text on input bg",      fg: t.text,          bg: t.bgInput,    largeText: false, required: 4.5 },
  ];
  return pairs.map(p => {
    const ratio = contrastRatio(p.fg, p.bg);
    return {
      ...p,
      ratio,
      level: wcagLevel(ratio, p.largeText),
      passes: ratio >= p.required,
    };
  });
}

export interface ContrastSummary {
  checks: ContrastCheck[];
  score: number;   // 0-100
  passing: number;
  failing: number;
  worst: ContrastCheck | null;
}

export function summarizeContrast(t: ThemePreset): ContrastSummary {
  const checks = auditThemeContrast(t);
  const passing = checks.filter(c => c.passes).length;
  const failing = checks.length - passing;
  const score = Math.round((passing / checks.length) * 100);
  const worst = checks.slice().sort((a, b) => a.ratio - b.ratio)[0] || null;
  return { checks, score, passing, failing, worst };
}

// ---------------- Auto-fix contrast ----------------

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Nudge a foreground hex toward white or black until it meets `required` contrast on bg. */
export function autoFixColor(fg: string, bg: string, required: number): string {
  if (contrastRatio(fg, bg) >= required) return fg;
  const bgLum = relativeLuminance(bg);
  const target: [number, number, number] = bgLum < 0.5 ? [255, 255, 255] : [0, 0, 0];
  const [r, g, b] = hexToRgbTriplet(fg);
  let best = fg;
  let bestRatio = contrastRatio(fg, bg);
  for (let step = 0.05; step <= 1.0001; step += 0.05) {
    const nr = r + (target[0] - r) * step;
    const ng = g + (target[1] - g) * step;
    const nb = b + (target[2] - b) * step;
    const cand = rgbToHex(nr, ng, nb);
    const ratio = contrastRatio(cand, bg);
    if (ratio > bestRatio) { best = cand; bestRatio = ratio; }
    if (ratio >= required) return cand;
  }
  return best;
}

/** Return a new theme with text/border colors adjusted so all WCAG checks pass. */
export function autoFixThemeContrast(t: ThemePreset): { theme: ThemePreset; changed: Array<keyof ThemePreset> } {
  const changed: Array<keyof ThemePreset> = [];
  const next: ThemePreset = { ...t };
  const fix = (key: keyof ThemePreset, bg: string, required: number) => {
    const cur = next[key] as string;
    const nv = autoFixColor(cur, bg, required);
    if (nv.toLowerCase() !== cur.toLowerCase()) {
      (next as any)[key] = nv;
      changed.push(key);
    }
  };
  fix("text", next.bg, 4.5);
  fix("text", next.bgElevated, 4.5);
  fix("textSecondary", next.surface, 4.5);
  fix("textMuted", next.bg, 3);
  fix("logoFg", next.accent, 4.5);
  fix("accent", next.bg, 3);
  fix("border", next.bg, 3);
  return { theme: next, changed };
}

// ---------------- Palette from brand color ----------------

function mix(hex: string, target: [number, number, number], amount: number): string {
  const [r, g, b] = hexToRgbTriplet(hex);
  return rgbToHex(r + (target[0] - r) * amount, g + (target[1] - g) * amount, b + (target[2] - b) * amount);
}

/** Generate a full ThemePreset from a single brand color. Mode auto-picks dark/light. */
export function paletteFromBrand(
  brand: string,
  opts: { mode?: "dark" | "light" | "auto"; label?: string } = {},
): ThemePreset {
  const mode: "dark" | "light" =
    opts.mode && opts.mode !== "auto" ? opts.mode : (relativeLuminance(brand) > 0.5 ? "light" : "dark");
  const BLACK: [number, number, number] = [0, 0, 0];
  const WHITE: [number, number, number] = [255, 255, 255];

  const base = mode === "dark"
    ? {
        bg: mix(brand, BLACK, 0.94),
        bgElevated: mix(brand, BLACK, 0.88),
        surface: mix(brand, BLACK, 0.80),
        surfaceHover: mix(brand, BLACK, 0.72),
        bgInput: mix(brand, BLACK, 0.78),
        text: mix(brand, WHITE, 0.92),
        textSecondary: mix(brand, WHITE, 0.55),
        textMuted: mix(brand, WHITE, 0.35),
        border: mix(brand, BLACK, 0.68),
        borderSubtle: mix(brand, BLACK, 0.78),
      }
    : {
        bg: mix(brand, WHITE, 0.96),
        bgElevated: "#ffffff",
        surface: mix(brand, WHITE, 0.88),
        surfaceHover: mix(brand, WHITE, 0.80),
        bgInput: "#ffffff",
        text: mix(brand, BLACK, 0.88),
        textSecondary: mix(brand, BLACK, 0.55),
        textMuted: mix(brand, BLACK, 0.38),
        border: mix(brand, WHITE, 0.72),
        borderSubtle: mix(brand, WHITE, 0.82),
      };

  const accentHover = mode === "dark" ? mix(brand, WHITE, 0.18) : mix(brand, BLACK, 0.14);
  const logoFg = relativeLuminance(brand) > 0.55 ? "#0a0a0a" : "#ffffff";
  const raw: ThemePreset = {
    id: `custom-brand-${Date.now().toString(36)}`,
    label: opts.label || "Brand Palette",
    description: `Generated from ${brand.toUpperCase()} (${mode})`,
    accent: brand,
    accentHover,
    accentSoft: brand,
    ...base,
    logoBg: mix(brand, BLACK, 0.35),
    logoBgTo: brand,
    logoFg,
  };
  // Ensure it lands accessible out of the box.
  return autoFixThemeContrast(raw).theme;
}





// ---------------- Logo mark styles ----------------

export interface LogoStyle {
  id: string;
  label: string;
  description: string;
  /** Render the foreground mark (viewBox 0 0 128 128). Background/rounding handled by caller. */
  mark: (fg: string, letter: string) => string;
}

const monogram = (fg: string, letter: string) => `
  <text x="64" y="64" text-anchor="middle" dominant-baseline="central"
    font-family="-apple-system, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif"
    font-weight="800" font-size="64" fill="${fg}" letter-spacing="-2">${escapeXml(letter)}</text>`;

export const LOGO_STYLES: LogoStyle[] = [
  {
    id: "monogram",
    label: "Monogram",
    description: "Bold single-letter mark. Clean, versatile, timeless.",
    mark: (fg, letter) => monogram(fg, letter),
  },
  {
    id: "orbit",
    label: "Orbit",
    description: "Letter with concentric orbital ring. Tech, precision.",
    mark: (fg, letter) => `
      <circle cx="64" cy="64" r="46" fill="none" stroke="${fg}" stroke-opacity="0.35" stroke-width="3"/>
      <circle cx="110" cy="64" r="5" fill="${fg}"/>
      ${monogram(fg, letter)}`,
  },
  {
    id: "hexagon",
    label: "Hex Shield",
    description: "Geometric hexagon frame. Secure, structured, badge-like.",
    mark: (fg, letter) => `
      <polygon points="64,14 108,40 108,88 64,114 20,88 20,40"
        fill="none" stroke="${fg}" stroke-width="6" stroke-linejoin="round"/>
      ${monogram(fg, letter)}`,
  },
  {
    id: "spark",
    label: "Spark",
    description: "Diagonal spark beside the mark. Energetic, AI-forward.",
    mark: (fg, letter) => `
      ${monogram(fg, letter)}
      <path d="M100 26 L108 44 L98 46 L104 62 L86 44 L96 42 Z" fill="${fg}"/>`,
  },
  {
    id: "grid",
    label: "Micro Grid",
    description: "Letter over a fine dot grid. Data, developer, systematic.",
    mark: (fg, letter) => {
      let dots = "";
      for (let x = 22; x <= 106; x += 12) {
        for (let y = 22; y <= 106; y += 12) {
          dots += `<circle cx="${x}" cy="${y}" r="1.4" fill="${fg}" fill-opacity="0.18"/>`;
        }
      }
      return dots + monogram(fg, letter);
    },
  },
  {
    id: "wordmark",
    label: "Wordmark",
    description: "Two-letter mark stacked with underline. Editorial.",
    mark: (fg, letter) => `
      <text x="64" y="58" text-anchor="middle" dominant-baseline="central"
        font-family="'SF Pro Display', system-ui, sans-serif" font-weight="900"
        font-size="52" fill="${fg}" letter-spacing="-3">${escapeXml(letter.slice(0, 2))}</text>
      <rect x="34" y="92" width="60" height="4" rx="2" fill="${fg}"/>`,
  },
];

export const DEFAULT_LOGO_STYLE_ID = "monogram";

export function getLogoStyle(id?: string | null): LogoStyle {
  return LOGO_STYLES.find(s => s.id === id) || LOGO_STYLES[0];
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!));
}

/** Extract 1-2 letter monogram from extension name. */
export function extractMonogram(name: string): string {
  const words = (name || "E").trim().split(/[\s-_]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  const w = words[0] || "E";
  return (w[0] + (w[1] || "")).toUpperCase();
}

/** Build a full SVG string for a given size. Rounded corners for icon look. */
export function buildLogoSvg(
  theme: ThemePreset,
  style: LogoStyle,
  name: string,
  size = 128,
): string {
  const letter = extractMonogram(name);
  const radius = Math.round(size * 0.22);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${theme.logoBg}"/>
      <stop offset="1" stop-color="${theme.logoBgTo}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="128" height="128" rx="${(radius / size) * 128}" ry="${(radius / size) * 128}" fill="url(#lg)"/>
  ${style.mark(theme.logoFg, letter)}
</svg>`;
}

// ---------------- SVG → PNG (browser) ----------------

async function svgToPngBytes(svg: string, size: number): Promise<Uint8Array> {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, size, size);
    const pngBlob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png")
    );
    const buf = await pngBlob.arrayBuffer();
    return new Uint8Array(buf);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface RenderedIcons {
  "icons/icon16.png": Uint8Array;
  "icons/icon48.png": Uint8Array;
  "icons/icon128.png": Uint8Array;
}

/** Render professional PNG icons at 16/48/128 from theme + logo style. */
export async function renderExtensionIcons(
  name: string,
  themeId?: string | null,
  logoStyleId?: string | null,
): Promise<RenderedIcons> {
  const theme = getTheme(themeId);
  const style = getLogoStyle(logoStyleId);
  const svg128 = buildLogoSvg(theme, style, name, 128);
  const [i16, i48, i128] = await Promise.all([
    svgToPngBytes(svg128, 16),
    svgToPngBytes(svg128, 48),
    svgToPngBytes(svg128, 128),
  ]);
  return {
    "icons/icon16.png": i16,
    "icons/icon48.png": i48,
    "icons/icon128.png": i128,
  };
}

/** Data URL for on-screen previews (no PNG conversion needed). */
export function logoDataUrl(name: string, themeId?: string | null, logoStyleId?: string | null, size = 128): string {
  const svg = buildLogoSvg(getTheme(themeId), getLogoStyle(logoStyleId), name, size);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ---------------- CSS variable overrides ----------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Emit a `:root { ... }` overrides block that swaps the popup / options CSS vars. */
export function themeCssVars(themeId?: string | null): string {
  const t = getTheme(themeId);
  return `:root {
  --accent: ${t.accent};
  --accent-hover: ${t.accentHover};
  --accent-subtle: ${rgba(t.accent, 0.08)};
  --accent-border: ${rgba(t.accent, 0.18)};
  --accent-glow: ${rgba(t.accent, 0.25)};
  --bg: ${t.bg};
  --bg-elevated: ${t.bgElevated};
  --bg-input: ${t.bgInput};
  --surface: ${t.surface};
  --surface-hover: ${t.surfaceHover};
  --surface-active: ${t.surfaceHover};
  --text: ${t.text};
  --text-secondary: ${t.textSecondary};
  --text-muted: ${t.textMuted};
  --border: ${t.border};
  --border-subtle: ${t.borderSubtle};
}`;
}
