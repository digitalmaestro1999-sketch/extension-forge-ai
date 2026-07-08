/**
 * Renders an extension popup HTML file to a 1280x800 PNG suitable for
 * a Chrome Web Store screenshot. Uses the SVG <foreignObject> trick to
 * rasterise arbitrary HTML/CSS to canvas without external dependencies.
 *
 * Limitations: external scripts do not execute; remote images may fail
 * CORS. For accurate results, keep popup markup self-contained.
 */

export interface ScreenshotOptions {
  width?: number;   // default 1280
  height?: number;  // default 800
  caption?: string; // optional caption drawn at the bottom
  frame?: boolean;  // draw a browser-style chrome around the popup
  background?: string; // canvas background color
}

const DEFAULT_BG = "#0b0f1a";

async function svgToImage(svg: string): Promise<HTMLImageElement> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed rasterising popup HTML"));
      img.src = url;
    });
  } finally {
    // Revoke on next tick to let the browser finish decoding
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function stripScripts(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "");
}

/** Extract inline <style> blocks + linked stylesheets bundled into the extension files. */
function collectStyles(popupHtml: string, files: Record<string, string>): string {
  const styles: string[] = [];
  const inline = [...popupHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  styles.push(...inline);
  const linkRe = /<link\b[^>]*href=["']([^"']+\.css)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(popupHtml)) !== null) {
    const href = m[1].replace(/^\.?\//, "");
    if (files[href]) styles.push(files[href]);
  }
  return styles.join("\n");
}

function extractBody(html: string): string {
  const m = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return m ? m[1] : html;
}

export async function renderPopupScreenshot(
  files: Record<string, string>,
  popupPath = "popup.html",
  opts: ScreenshotOptions = {},
): Promise<string> {
  const html = files[popupPath];
  if (!html) throw new Error(`Popup file not found: ${popupPath}`);

  const width = opts.width ?? 1280;
  const height = opts.height ?? 800;
  const bg = opts.background ?? DEFAULT_BG;

  const cleaned = stripScripts(html);
  const styles = collectStyles(cleaned, files);
  const body = extractBody(cleaned);

  // Nominal popup size in a Chrome window: 380 x 560
  const popupW = 380;
  const popupH = 560;

  const popupHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#111}
    ${styles}
  </style></head><body>${body}</body></html>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${popupW}" height="${popupH}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${popupW}px;height:${popupH}px;overflow:hidden">
      ${popupHtml}
    </div>
  </foreignObject>
</svg>`;

  const popupImg = await svgToImage(svg);

  const cv = document.createElement("canvas");
  cv.width = width;
  cv.height = height;
  const ctx = cv.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, bg);
  grad.addColorStop(1, "#111827");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Draw popup centered with soft shadow
  const scale = Math.min((width * 0.55) / popupW, (height * 0.8) / popupH);
  const dw = popupW * scale;
  const dh = popupH * scale;
  const x = (width - dw) / 2;
  const y = (height - dh) / 2 - (opts.caption ? 32 : 0);

  if (opts.frame !== false) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 20;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, x - 8, y - 40, dw + 16, dh + 48, 14);
    ctx.fill();
    ctx.restore();
    // Fake title bar dots
    ctx.fillStyle = "#ff5f57"; dot(ctx, x + 6, y - 24, 5);
    ctx.fillStyle = "#febc2e"; dot(ctx, x + 22, y - 24, 5);
    ctx.fillStyle = "#28c840"; dot(ctx, x + 38, y - 24, 5);
  }

  ctx.drawImage(popupImg, x, y, dw, dh);

  if (opts.caption) {
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "600 32px -apple-system, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(opts.caption, width / 2, height - 60);
  }

  return cv.toDataURL("image/png");
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(head)?.[1] ?? "image/png";
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
