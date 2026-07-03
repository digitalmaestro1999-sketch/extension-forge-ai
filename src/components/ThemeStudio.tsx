import { useMemo, useState, useEffect } from "react";
import JSZip from "jszip";
import { Palette, Grid3x3, Download, Plus, Trash2, Copy, Check, Wand2, Sparkles, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  THEME_PRESETS,
  LOGO_STYLES,
  type ThemePreset,
  buildLogoSvg,
  logoDataUrl,
  themeCssVars,
  renderExtensionIcons,
  getTheme,
  getLogoStyle,
  getAllThemes,
  loadCustomThemes,
  saveCustomTheme,
  deleteCustomTheme,
  summarizeContrast,
  type ContrastCheck,
  autoFixThemeContrast,
  paletteFromBrand,
} from "@/lib/extension-themes";
import { ShieldCheck, ShieldAlert } from "lucide-react";

interface Props {
  name: string;
  themeId: string;
  logoStyleId: string;
  onChange: (themeId: string, logoStyleId: string) => void;
}

const FIELDS: Array<{ key: keyof ThemePreset; label: string; group: string }> = [
  { key: "accent", label: "Accent", group: "Brand" },
  { key: "accentHover", label: "Accent hover", group: "Brand" },
  { key: "logoBg", label: "Logo bg (from)", group: "Brand" },
  { key: "logoBgTo", label: "Logo bg (to)", group: "Brand" },
  { key: "logoFg", label: "Logo mark", group: "Brand" },
  { key: "bg", label: "Background", group: "Surface" },
  { key: "bgElevated", label: "Elevated", group: "Surface" },
  { key: "surface", label: "Surface", group: "Surface" },
  { key: "surfaceHover", label: "Surface hover", group: "Surface" },
  { key: "bgInput", label: "Input bg", group: "Surface" },
  { key: "text", label: "Text", group: "Text" },
  { key: "textSecondary", label: "Text secondary", group: "Text" },
  { key: "textMuted", label: "Text muted", group: "Text" },
  { key: "border", label: "Border", group: "Text" },
  { key: "borderSubtle", label: "Border subtle", group: "Text" },
];

function slugify(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom";
}

function blankTheme(base: ThemePreset): ThemePreset {
  return { ...base, id: `custom-${Date.now().toString(36)}`, label: "My Custom Theme", description: "Custom theme" };
}

export function ThemeStudio({ name, themeId, logoStyleId, onChange }: Props) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [customs, setCustoms] = useState<ThemePreset[]>([]);
  const [draft, setDraft] = useState<ThemePreset>(() => blankTheme(THEME_PRESETS[0]));
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { setCustoms(loadCustomThemes()); }, []);

  const currentTheme = getTheme(themeId);
  const currentA11y = useMemo(() => summarizeContrast(currentTheme), [currentTheme]);
  const draftA11y = useMemo(() => summarizeContrast(draft), [draft]);

  const openEditor = (base?: ThemePreset) => {
    setDraft(base ? { ...base, id: base.id.startsWith("custom-") ? base.id : `custom-${Date.now().toString(36)}`, label: base.label + (base.id.startsWith("custom-") ? "" : " (Custom)") } : blankTheme(currentTheme));
    setEditorOpen(true);
  };

  const handleSave = () => {
    const theme: ThemePreset = { ...draft, id: draft.id || `custom-${slugify(draft.label)}` };
    const next = saveCustomTheme(theme);
    setCustoms(next.filter(t => t.id.startsWith("custom-") || !THEME_PRESETS.some(p => p.id === t.id)));
    onChange(theme.id, logoStyleId);
    setEditorOpen(false);
    toast.success(`Saved "${theme.label}"`);
  };

  const handleDelete = (id: string) => {
    const next = deleteCustomTheme(id);
    setCustoms(next);
    if (themeId === id) onChange(THEME_PRESETS[0].id, logoStyleId);
    toast.success("Theme deleted");
  };

  const cssPreview = useMemo(() => themeCssVars(draft.id), [draft]);

  const copyCss = async () => {
    // Compose CSS for the draft directly (not yet saved)
    const inline = themeCssVars(draft.id);
    // If draft is unsaved, temporarily save cssPreview from live draft values
    const css = `:root {
  --accent: ${draft.accent};
  --accent-hover: ${draft.accentHover};
  --bg: ${draft.bg};
  --bg-elevated: ${draft.bgElevated};
  --surface: ${draft.surface};
  --text: ${draft.text};
  --border: ${draft.border};
}`;
    await navigator.clipboard.writeText(css || inline);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
    toast.success("CSS copied");
  };

  const exportAssets = async (theme: ThemePreset, styleId: string) => {
    setExporting(true);
    try {
      const style = getLogoStyle(styleId);
      const zip = new JSZip();
      const folder = zip.folder(`${slugify(theme.label)}-${styleId}`)!;
      // SVGs
      folder.file("logo-128.svg", buildLogoSvg(theme, style, name || theme.label, 128));
      folder.file("logo-512.svg", buildLogoSvg(theme, style, name || theme.label, 512));
      // PNG icons (using theme.id if present in preset list, else render via renderExtensionIcons using ad-hoc lookup)
      // renderExtensionIcons uses getTheme(id); custom themes must be persisted first — ensure it is.
      if (!getAllThemes().some(t => t.id === theme.id)) saveCustomTheme(theme);
      const icons = await renderExtensionIcons(name || theme.label, theme.id, styleId);
      folder.file("icons/icon16.png", icons["icons/icon16.png"]);
      folder.file("icons/icon48.png", icons["icons/icon48.png"]);
      folder.file("icons/icon128.png", icons["icons/icon128.png"]);
      // CSS
      folder.file("theme.css", themeCssVars(theme.id));
      // JSON
      folder.file("theme.json", JSON.stringify(theme, null, 2));
      // Preview
      folder.file("preview.html", buildPreviewHtml(theme, style, name || theme.label));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${slugify(theme.label)}-assets.zip`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Assets exported");
    } catch (e: any) {
      toast.error("Export failed: " + (e?.message || String(e)));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={() => openEditor()} disabled={exporting}>
          <Palette className="h-3.5 w-3.5" /> Custom theme editor
        </Button>
        <Button size="sm" variant="outline" onClick={() => setGalleryOpen(true)} disabled={exporting}>
          <Grid3x3 className="h-3.5 w-3.5" /> Variation gallery
        </Button>
        <Button size="sm" variant="default" onClick={() => exportAssets(currentTheme, logoStyleId)} disabled={exporting}>
          <Download className="h-3.5 w-3.5" /> {exporting ? "Exporting…" : "Export assets & CSS"}
        </Button>
        {customs.length > 0 && (
          <Badge variant="secondary" className="text-[10px]">{customs.length} custom</Badge>
        )}
        <Badge
          variant="secondary"
          className={`text-[10px] gap-1 ${currentA11y.failing === 0 ? "bg-emerald-500/15 text-emerald-500" : currentA11y.failing <= 2 ? "bg-amber-500/15 text-amber-500" : "bg-destructive/15 text-destructive"}`}
          title={`${currentA11y.passing}/${currentA11y.checks.length} WCAG checks pass`}
        >
          {currentA11y.failing === 0 ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
          A11y {currentA11y.score}
        </Badge>
      </div>

      {customs.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Your custom themes</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {customs.map(t => {
              const active = themeId === t.id;
              return (
                <div key={t.id} className={`group relative p-2 rounded-md border ${active ? "border-primary ring-1 ring-primary/40 bg-primary/5" : "border-border bg-card"}`}>
                  <button type="button" onClick={() => onChange(t.id, logoStyleId)} className="w-full text-left">
                    <div className="flex gap-1 mb-1.5 h-4 rounded overflow-hidden">
                      <span className="flex-1" style={{ background: t.bg }} />
                      <span className="flex-1" style={{ background: t.bgElevated }} />
                      <span className="flex-1" style={{ background: t.accent }} />
                      <span className="flex-1" style={{ background: t.accentHover }} />
                    </div>
                    <div className="text-[11px] font-medium truncate">{t.label}</div>
                  </button>
                  <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5">
                    <button title="Edit" onClick={() => openEditor(t)} className="p-1 rounded bg-background/80 hover:bg-background border border-border">
                      <Palette className="h-3 w-3" />
                    </button>
                    <button title="Delete" onClick={() => handleDelete(t.id)} className="p-1 rounded bg-background/80 hover:bg-destructive/20 border border-border">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom Theme Editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Palette className="h-4 w-4" /> Custom theme editor</DialogTitle>
            <DialogDescription>Design your own palette. Live preview on the right. Saved to this browser.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-4">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Description</Label>
                  <Input value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
                </div>
              </div>

              {["Brand", "Surface", "Text"].map(group => (
                <div key={group}>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">{group}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {FIELDS.filter(f => f.group === group).map(f => (
                      <div key={f.key} className="flex items-center gap-2">
                        <input
                          type="color"
                          value={(draft[f.key] as string) || "#000000"}
                          onChange={e => setDraft({ ...draft, [f.key]: e.target.value })}
                          className="h-8 w-10 rounded border border-border cursor-pointer bg-transparent"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-muted-foreground truncate">{f.label}</div>
                          <Input
                            value={(draft[f.key] as string) || ""}
                            onChange={e => setDraft({ ...draft, [f.key]: e.target.value })}
                            className="h-7 text-xs font-mono"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Preview */}
            <div className="space-y-3">
              <div
                className="rounded-lg border p-4 space-y-3"
                style={{ background: draft.bg, borderColor: draft.border, color: draft.text }}
              >
                <div className="flex items-center gap-2">
                  <img
                    src={`data:image/svg+xml;utf8,${encodeURIComponent(buildLogoSvg(draft, getLogoStyle(logoStyleId), name || draft.label, 64))}`}
                    alt="preview"
                    className="h-10 w-10 rounded-md"
                  />
                  <div>
                    <div className="text-sm font-semibold" style={{ color: draft.text }}>{draft.label}</div>
                    <div className="text-[10px]" style={{ color: draft.textMuted }}>Popup preview</div>
                  </div>
                </div>
                <div className="rounded-md p-3" style={{ background: draft.bgElevated, borderColor: draft.borderSubtle, borderWidth: 1, borderStyle: "solid" }}>
                  <div className="text-xs mb-2" style={{ color: draft.textSecondary }}>Recent activity</div>
                  <div className="space-y-1">
                    {["Item alpha", "Item beta"].map((t, i) => (
                      <div key={i} className="text-xs px-2 py-1.5 rounded" style={{ background: draft.surface }}>{t}</div>
                    ))}
                  </div>
                </div>
                <button type="button" className="w-full py-1.5 rounded-md text-xs font-medium" style={{ background: draft.accent, color: draft.logoFg }}>
                  Primary action
                </button>
              </div>

              {/* Contrast / A11y panel */}
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    {draftA11y.failing === 0 ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> : <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />}
                    WCAG contrast
                  </div>
                  <Badge variant="secondary" className={`text-[10px] ${draftA11y.failing === 0 ? "bg-emerald-500/15 text-emerald-500" : draftA11y.failing <= 2 ? "bg-amber-500/15 text-amber-500" : "bg-destructive/15 text-destructive"}`}>
                    {draftA11y.passing}/{draftA11y.checks.length} pass · {draftA11y.score}
                  </Badge>
                </div>
                <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
                  {draftA11y.checks.map((c: ContrastCheck) => (
                    <li key={c.label} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="inline-flex h-4 w-6 shrink-0 items-center justify-center rounded text-[9px] font-bold"
                          style={{ background: c.bg, color: c.fg, border: "1px solid hsl(var(--border))" }}
                          aria-hidden
                        >Aa</span>
                        <span className="truncate text-muted-foreground">{c.label}</span>
                      </span>
                      <span className={`font-mono tabular-nums ${c.passes ? "text-emerald-500" : "text-destructive"}`}>
                        {c.ratio.toFixed(2)} · {c.level}
                      </span>
                    </li>
                  ))}
                </ul>
                {draftA11y.worst && !draftA11y.worst.passes && (
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Lowest: <span className="text-foreground">{draftA11y.worst.label}</span> — needs ≥ {draftA11y.worst.required}:1.
                  </p>
                )}
              </div>


              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={copyCss}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy CSS
                </Button>
                <Button size="sm" className="flex-1" onClick={handleSave}>
                  <Plus className="h-3.5 w-3.5" /> Save theme
                </Button>
              </div>
              <Button size="sm" variant="secondary" className="w-full" onClick={() => exportAssets({ ...draft, id: draft.id || `custom-${slugify(draft.label)}` }, logoStyleId)}>
                <Download className="h-3.5 w-3.5" /> Export this theme
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Variation Gallery */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Grid3x3 className="h-4 w-4" /> Variation gallery</DialogTitle>
            <DialogDescription>
              Every theme × every logo style. Click any tile to select. {getAllThemes().length * LOGO_STYLES.length} combinations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {getAllThemes().map(theme => (
              <div key={theme.id}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-semibold">{theme.label}</div>
                    <div className="text-[11px] text-muted-foreground">{theme.description}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => exportAssets(theme, logoStyleId)} disabled={exporting}>
                    <Download className="h-3.5 w-3.5" /> Export set
                  </Button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {LOGO_STYLES.map(style => {
                    const active = themeId === theme.id && logoStyleId === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => { onChange(theme.id, style.id); setGalleryOpen(false); }}
                        className={`p-2 rounded-md border transition-all ${active ? "border-primary ring-1 ring-primary/40" : "border-border hover:border-primary/40"}`}
                        style={{ background: theme.bgElevated }}
                      >
                        <img
                          src={logoDataUrl(name || theme.label, theme.id, style.id, 96)}
                          alt={`${theme.label} ${style.label}`}
                          className="h-16 w-16 mx-auto rounded"
                        />
                        <div className="text-[10px] mt-1 text-center" style={{ color: theme.textSecondary }}>{style.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function buildPreviewHtml(theme: ThemePreset, style: ReturnType<typeof getLogoStyle>, name: string): string {
  const logo = buildLogoSvg(theme, style, name, 96);
  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>${name} — Theme preview</title>
<style>
${themeCssVars(theme.id)}
body{margin:0;font-family:-apple-system,'SF Pro Display',system-ui,sans-serif;background:${theme.bg};color:${theme.text};padding:32px;}
.card{background:${theme.bgElevated};border:1px solid ${theme.border};border-radius:12px;padding:20px;max-width:420px;margin:auto;}
.row{background:${theme.surface};padding:10px 12px;border-radius:8px;margin:6px 0;font-size:13px;}
button{background:${theme.accent};color:${theme.logoFg};border:0;padding:10px 14px;border-radius:8px;font-weight:600;cursor:pointer;width:100%;margin-top:12px;}
button:hover{background:${theme.accentHover};}
h1{font-size:16px;margin:0;} small{color:${theme.textMuted};}
</style></head><body>
<div class="card">
  <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;">
    ${logo.replace('width="96"', 'width="44"').replace('height="96"', 'height="44"')}
    <div><h1>${name}</h1><small>${theme.label} · ${style.label}</small></div>
  </div>
  <div class="row">Recent item alpha</div>
  <div class="row">Recent item beta</div>
  <div class="row">Recent item gamma</div>
  <button>Primary action</button>
</div>
</body></html>`;
}
