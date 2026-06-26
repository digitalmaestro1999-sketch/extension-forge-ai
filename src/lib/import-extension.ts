import JSZip from "jszip";

export type ImportedExtension = {
  name: string;
  version: string;
  description: string;
  permissions: string[];
  hostPermissions: string[];
  manifest: Record<string, unknown>;
  files: Record<string, string>; // text files only (code/html/json/css/md/svg)
  binaryFiles: string[]; // names of non-text assets (kept in originalZip)
  fileNames: string[]; // all entries
  originalZip: JSZip; // for re-export
  sourceName: string; // uploaded filename
};

const TEXT_EXT = /\.(json|js|mjs|cjs|ts|tsx|jsx|html?|css|md|txt|svg|xml|yaml|yml)$/i;

/**
 * Strip CRX (v2/v3) header so we get to the inner ZIP payload.
 * CRX magic: "Cr24" + uint32 version + ... (v3: header_size, then header bytes).
 */
function stripCrxHeader(buf: ArrayBuffer): ArrayBuffer {
  const view = new DataView(buf);
  if (buf.byteLength < 16) return buf;
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== "Cr24") return buf; // already a ZIP
  const version = view.getUint32(4, true);
  if (version === 2) {
    const pubKeyLen = view.getUint32(8, true);
    const sigLen = view.getUint32(12, true);
    return buf.slice(16 + pubKeyLen + sigLen);
  }
  if (version === 3) {
    const headerSize = view.getUint32(8, true);
    return buf.slice(12 + headerSize);
  }
  return buf;
}

export async function importExtensionFile(file: File): Promise<ImportedExtension> {
  const raw = await file.arrayBuffer();
  const zipBuf = stripCrxHeader(raw);
  const zip = await JSZip.loadAsync(zipBuf);

  const files: Record<string, string> = {};
  const binaryFiles: string[] = [];
  const fileNames: string[] = [];

  const entries = Object.values(zip.files).filter((f) => !f.dir);
  for (const entry of entries) {
    fileNames.push(entry.name);
    if (TEXT_EXT.test(entry.name)) {
      try {
        files[entry.name] = await entry.async("string");
      } catch {
        binaryFiles.push(entry.name);
      }
    } else {
      binaryFiles.push(entry.name);
    }
  }

  const manifestRaw =
    files["manifest.json"] ??
    files[Object.keys(files).find((k) => k.endsWith("/manifest.json")) ?? ""];

  if (!manifestRaw) {
    throw new Error("No manifest.json found inside the uploaded file.");
  }

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch (e) {
    throw new Error("manifest.json is not valid JSON: " + (e as Error).message);
  }

  return {
    name: String(manifest.name ?? file.name),
    version: String(manifest.version ?? "0.0.0"),
    description: String(manifest.description ?? ""),
    permissions: Array.isArray(manifest.permissions) ? (manifest.permissions as string[]) : [],
    hostPermissions: Array.isArray(manifest.host_permissions) ? (manifest.host_permissions as string[]) : [],
    manifest,
    files,
    binaryFiles,
    fileNames,
    originalZip: zip,
    sourceName: file.name,
  };
}

/**
 * Re-export the imported extension with any edits applied to text files.
 * Binary assets are preserved untouched from the originalZip.
 */
export async function exportImportedExtension(
  ext: ImportedExtension,
  editedFiles: Record<string, string>,
  outName?: string
): Promise<Blob> {
  const out = new JSZip();
  // Copy binary entries from original
  for (const name of ext.binaryFiles) {
    const entry = ext.originalZip.file(name);
    if (entry) {
      const data = await entry.async("uint8array");
      out.file(name, data);
    }
  }
  // Write text files (edited or original)
  for (const name of Object.keys(ext.files)) {
    out.file(name, editedFiles[name] ?? ext.files[name]);
  }
  const blob = await out.generateAsync({ type: "blob" });
  return blob;
}

export function classifyPermission(p: string): { level: "safe" | "warning" | "danger"; note: string } {
  const SAFE = new Set(["storage", "activeTab", "alarms", "contextMenus", "notifications", "idle", "offscreen"]);
  const DANGER = new Set(["debugger", "proxy", "privacy", "management", "nativeMessaging", "<all_urls>"]);
  if (SAFE.has(p)) return { level: "safe", note: "Low-risk permission." };
  if (DANGER.has(p) || p === "<all_urls>") return { level: "danger", note: "High-risk — requires strong justification." };
  if (p.startsWith("http")) return { level: "warning", note: "Host permission — review scope." };
  return { level: "warning", note: "Sensitive — review usage in code." };
}
