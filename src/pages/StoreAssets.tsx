import { useEffect, useMemo, useState } from "react";
import { Store, Wand2, Image as ImageIcon, Camera, ShieldCheck, Download, Loader2, RefreshCw, FileText, FileWarning } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { resizeIconSet, resizePromoTile, dataUrlToBlob, type IconPack } from "@/lib/store-assets/icon-pack";
import { renderPopupScreenshot } from "@/lib/store-assets/screenshot";
import { logSecurityEvent } from "@/lib/security-audit-log";

function loadFiles(): Record<string, string> {
  try { return JSON.parse(sessionStorage.getItem("extension-files") ?? "{}"); } catch { return {}; }
}
function parseManifest(files: Record<string, string>): any {
  try { return JSON.parse(files["manifest.json"] ?? "{}"); } catch { return {}; }
}

interface Listing {
  title?: string;
  shortDescription?: string;
  detailedDescription?: string;
  category?: string;
  keywords?: string[];
  faq?: { q: string; a: string }[];
}
interface Policy {
  policyMarkdown?: string;
  singlePurpose?: string;
  permissionsJustification?: { permission: string; why: string; minimalAlternative?: string }[];
  dataUsageDisclosure?: Record<string, unknown>;
}

export default function StoreAssets() {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [manifest, setManifest] = useState<any>({});
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [developerName, setDeveloperName] = useState("");

  const [listing, setListing] = useState<Listing | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [iconPack, setIconPack] = useState<IconPack | null>(null);
  const [promoDataUrl, setPromoDataUrl] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  const [busy, setBusy] = useState<null | "listing" | "policy" | "icons" | "screenshot">(null);

  useEffect(() => {
    const f = loadFiles();
    setFiles(f);
    const m = parseManifest(f);
    setManifest(m);
    if (m.name) setName(m.name);
    if (m.description) setDescription(m.description);
  }, []);

  const empty = !Object.keys(files).length;
  const popupPath = useMemo(() => manifest?.action?.default_popup || "popup.html", [manifest]);

  const genListing = async () => {
    setBusy("listing");
    try {
      const { data, error } = await supabase.functions.invoke("store-listing-optimizer", {
        body: { name, description, manifest, category: listing?.category, provider: "lovable_gateway" },
      });
      if (error) throw error;
      setListing(data.listing);
      toast.success("Listing generated");
      await logSecurityEvent({ eventType: "store_listing_generated", severity: "info", details: { name } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Listing generation failed");
    } finally { setBusy(null); }
  };

  const genPolicy = async () => {
    setBusy("policy");
    try {
      const { data, error } = await supabase.functions.invoke("store-privacy-policy", {
        body: { name, description, manifest, contactEmail, developerName },
      });
      if (error) throw error;
      setPolicy(data.policy);
      toast.success("Privacy policy drafted");
      await logSecurityEvent({ eventType: "privacy_policy_generated", severity: "info", details: { name } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Policy generation failed");
    } finally { setBusy(null); }
  };

  const genIcons = async () => {
    setBusy("icons");
    try {
      const { data, error } = await supabase.functions.invoke("store-icon-set", {
        body: { name, description },
      });
      if (error) throw error;
      const pack = await resizeIconSet(data.iconDataUrl);
      const promo = await resizePromoTile(data.promoDataUrl);
      setIconPack(pack);
      setPromoDataUrl(promo.dataUrl);
      toast.success("Icon set + promo tile generated");
      await logSecurityEvent({ eventType: "icon_set_generated", severity: "info", details: { name } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Icon generation failed");
    } finally { setBusy(null); }
  };

  const genScreenshot = async () => {
    setBusy("screenshot");
    try {
      const url = await renderPopupScreenshot(files, popupPath, {
        caption: listing?.shortDescription?.slice(0, 60) ?? name,
      });
      setScreenshotUrl(url);
      toast.success("Screenshot rendered at 1280×800");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Screenshot render failed");
    } finally { setBusy(null); }
  };

  const downloadKit = async () => {
    const zip = new JSZip();
    if (listing) zip.file("listing.json", JSON.stringify(listing, null, 2));
    if (policy?.policyMarkdown) zip.file("PRIVACY_POLICY.md", policy.policyMarkdown);
    if (policy) zip.file("permissions-justification.json", JSON.stringify({
      singlePurpose: policy.singlePurpose,
      permissionsJustification: policy.permissionsJustification,
      dataUsageDisclosure: policy.dataUsageDisclosure,
    }, null, 2));
    if (iconPack) {
      const icons = zip.folder("icons")!;
      for (const [size, blob] of Object.entries(iconPack.blobs)) {
        icons.file(`icon-${size}.png`, blob);
      }
    }
    if (promoDataUrl) zip.file("promo-tile-440x280.png", dataUrlToBlob(promoDataUrl));
    if (screenshotUrl) zip.file("screenshot-1280x800.png", dataUrlToBlob(screenshotUrl));
    const readme = `# Chrome Web Store submission kit — ${name || "extension"}

Generated ${new Date().toISOString().slice(0, 10)}.

Contents:
- listing.json — title, descriptions, category, keywords, FAQ
- PRIVACY_POLICY.md — host this publicly and link from the CWS listing
- permissions-justification.json — paste into the CWS "Practices" tab
- icons/ — 16/32/48/128 PNGs, reference in manifest.json "icons"
- promo-tile-440x280.png — small promo tile
- screenshot-1280x800.png — CWS screenshot

Reminders:
- Confirm the privacy policy reflects actual runtime behaviour before publishing.
- Upload at least 1 screenshot (up to 5). 1280x800 or 640x400.
- CWS listing title ≤ 45 chars; short description ≤ 132 chars.
`;
    zip.file("README.md", readme);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(name || "extension").toLowerCase().replace(/\s+/g, "-")}-store-kit.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Store className="h-8 w-8 text-primary" />
            Store Assets & Listing
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate a Chrome Web Store submission kit — listing copy, icons, promo tile, screenshots, and a privacy policy.
          </p>
        </div>
        <Button onClick={downloadKit} disabled={!listing && !policy && !iconPack && !screenshotUrl}>
          <Download className="h-4 w-4 mr-2" />Download kit (.zip)
        </Button>
      </div>

      {empty && (
        <Card>
          <CardContent className="p-10 text-center space-y-2">
            <FileWarning className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-lg font-medium">No extension loaded</p>
            <p className="text-muted-foreground">Create or open an extension, then return here.</p>
          </CardContent>
        </Card>
      )}

      {!empty && (
        <>
          <Card>
            <CardHeader><CardTitle>Extension metadata</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Extension" />
              </div>
              <div className="space-y-1.5">
                <Label>Developer name</Label>
                <Input value={developerName} onChange={(e) => setDeveloperName(e.target.value)} placeholder="Acme Labs" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What the extension does, for whom, and why." />
              </div>
              <div className="space-y-1.5">
                <Label>Contact email (for privacy policy)</Label>
                <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="support@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Popup file</Label>
                <Input value={popupPath} readOnly />
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="listing" className="space-y-4">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="listing"><Wand2 className="h-4 w-4 mr-2" />Listing</TabsTrigger>
              <TabsTrigger value="icons"><ImageIcon className="h-4 w-4 mr-2" />Icons + Promo</TabsTrigger>
              <TabsTrigger value="screenshot"><Camera className="h-4 w-4 mr-2" />Screenshot</TabsTrigger>
              <TabsTrigger value="policy"><ShieldCheck className="h-4 w-4 mr-2" />Privacy</TabsTrigger>
            </TabsList>

            {/* LISTING */}
            <TabsContent value="listing">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Listing Optimizer</CardTitle>
                  <Button size="sm" onClick={genListing} disabled={busy === "listing" || !name}>
                    {busy === "listing" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Generate <Badge variant="secondary" className="ml-2 text-[10px] py-0 h-4">Lovable AI Routed</Badge>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!listing && <p className="text-sm text-muted-foreground">Generate title, short & detailed descriptions, keywords and FAQ.</p>}
                  {listing && (
                    <>
                      <div>
                        <Label>Title <span className="text-xs text-muted-foreground">({listing.title?.length ?? 0}/45)</span></Label>
                        <Input value={listing.title ?? ""} onChange={(e) => setListing({ ...listing, title: e.target.value })} />
                      </div>
                      <div>
                        <Label>Short description <span className="text-xs text-muted-foreground">({listing.shortDescription?.length ?? 0}/132)</span></Label>
                        <Textarea rows={2} value={listing.shortDescription ?? ""} onChange={(e) => setListing({ ...listing, shortDescription: e.target.value })} />
                      </div>
                      <div>
                        <Label>Detailed description</Label>
                        <Textarea rows={10} value={listing.detailedDescription ?? ""} onChange={(e) => setListing({ ...listing, detailedDescription: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Category</Label>
                          <Input value={listing.category ?? ""} onChange={(e) => setListing({ ...listing, category: e.target.value })} />
                        </div>
                        <div>
                          <Label>Keywords</Label>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {(listing.keywords ?? []).map((k, i) => (<Badge key={i} variant="secondary">{k}</Badge>))}
                          </div>
                        </div>
                      </div>
                      {(listing.faq ?? []).length > 0 && (
                        <div className="space-y-2">
                          <Label>FAQ</Label>
                          {listing.faq!.map((f, i) => (
                            <div key={i} className="p-3 rounded border border-border bg-card/50">
                              <p className="text-sm font-medium">{f.q}</p>
                              <p className="text-sm text-muted-foreground mt-1">{f.a}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ICONS */}
            <TabsContent value="icons">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Icon set + promo tile</CardTitle>
                  <Button size="sm" onClick={genIcons} disabled={busy === "icons" || !name}>
                    {busy === "icons" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Generate
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!iconPack && <p className="text-sm text-muted-foreground">Renders a hero icon and resizes to 16 / 32 / 48 / 128, plus a 440×280 promo tile.</p>}
                  {iconPack && (
                    <div className="flex items-end gap-6 flex-wrap">
                      {Object.entries(iconPack.sizes).map(([size, url]) => (
                        <div key={size} className="text-center space-y-2">
                          <img src={url} alt={`icon ${size}`} style={{ width: Math.max(Number(size), 48), height: Math.max(Number(size), 48), imageRendering: "pixelated" }} className="rounded border border-border bg-background" />
                          <p className="text-xs text-muted-foreground">{size}×{size}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {promoDataUrl && (
                    <div className="space-y-2">
                      <Label>Promo tile — 440×280</Label>
                      <img src={promoDataUrl} alt="promo tile" className="rounded border border-border" style={{ width: 440, height: 280 }} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* SCREENSHOT */}
            <TabsContent value="screenshot">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Popup screenshot (1280×800)</CardTitle>
                  <Button size="sm" onClick={genScreenshot} disabled={busy === "screenshot" || !files[popupPath]}>
                    {busy === "screenshot" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Render
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!files[popupPath] && (
                    <p className="text-sm text-amber-500">Popup file <code>{popupPath}</code> not found in this extension.</p>
                  )}
                  {!screenshotUrl && files[popupPath] && (
                    <p className="text-sm text-muted-foreground">Rasterises the popup HTML in a browser-style frame at CWS screenshot size.</p>
                  )}
                  {screenshotUrl && (
                    <img src={screenshotUrl} alt="popup screenshot" className="rounded border border-border max-w-full" />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* PRIVACY */}
            <TabsContent value="policy">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Privacy policy + permissions justification</CardTitle>
                  <Button size="sm" onClick={genPolicy} disabled={busy === "policy" || !name}>
                    {busy === "policy" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Generate
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!policy && <p className="text-sm text-muted-foreground">Drafts a GDPR/CCPA-aligned policy and per-permission justifications derived from the manifest.</p>}
                  {policy && (
                    <>
                      {policy.singlePurpose && (
                        <div>
                          <Label>Single purpose</Label>
                          <p className="text-sm mt-1">{policy.singlePurpose}</p>
                        </div>
                      )}
                      {(policy.permissionsJustification ?? []).length > 0 && (
                        <div className="space-y-2">
                          <Label>Permissions justification</Label>
                          {policy.permissionsJustification!.map((p, i) => (
                            <div key={i} className="p-3 rounded border border-border bg-card/50">
                              <div className="flex items-center gap-2">
                                <Badge>{p.permission}</Badge>
                                {p.minimalAlternative && p.minimalAlternative !== "none" && (
                                  <span className="text-xs text-muted-foreground">alt: {p.minimalAlternative}</span>
                                )}
                              </div>
                              <p className="text-sm mt-1">{p.why}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div>
                        <Label className="flex items-center gap-2"><FileText className="h-4 w-4" />Policy (markdown)</Label>
                        <Textarea rows={16} value={policy.policyMarkdown ?? ""} onChange={(e) => setPolicy({ ...policy, policyMarkdown: e.target.value })} className="font-mono text-xs" />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
