/**
 * Client-side image utilities for store assets.
 * Takes a base64 or data-URL image and resizes it into the standard
 * Chrome Web Store icon set (16/32/48/128) plus keeps a full-size version.
 */

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

function canvasToDataUrl(cv: HTMLCanvasElement): string {
  return cv.toDataURL("image/png");
}

async function canvasToBlob(cv: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("blob failed"))), "image/png"));
}

export interface IconPack {
  sizes: Record<number, string>; // dataUrl
  blobs: Record<number, Blob>;
}

export async function resizeIconSet(src: string, sizes: number[] = [16, 32, 48, 128]): Promise<IconPack> {
  const img = await loadImage(src);
  const out: IconPack = { sizes: {}, blobs: {} };
  for (const size of sizes) {
    const cv = document.createElement("canvas");
    cv.width = size;
    cv.height = size;
    const ctx = cv.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // Preserve aspect via cover-fit
    const ratio = Math.max(size / img.width, size / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    out.sizes[size] = canvasToDataUrl(cv);
    out.blobs[size] = await canvasToBlob(cv);
  }
  return out;
}

export async function resizePromoTile(src: string, w = 440, h = 280): Promise<{ dataUrl: string; blob: Blob }> {
  const img = await loadImage(src);
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const ratio = Math.max(w / img.width, h / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return { dataUrl: canvasToDataUrl(cv), blob: await canvasToBlob(cv) };
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(head)?.[1] ?? "image/png";
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
