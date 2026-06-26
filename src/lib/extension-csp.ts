export const HARDENED_EXTENSION_CSP =
  "script-src 'self'; object-src 'self'; base-uri 'self'; frame-ancestors 'none'";

export function getExtensionPageCsp(manifest: unknown): string {
  if (!manifest || typeof manifest !== "object") return "";
  const csp = (manifest as { content_security_policy?: unknown }).content_security_policy;
  if (typeof csp === "string") return csp;
  if (csp && typeof csp === "object") {
    const extensionPages = (csp as { extension_pages?: unknown }).extension_pages;
    return typeof extensionPages === "string" ? extensionPages : "";
  }
  return "";
}

export function hasHardenedExtensionCsp(manifest: unknown): boolean {
  const csp = getExtensionPageCsp(manifest);
  return (
    csp.includes("script-src 'self'") &&
    csp.includes("object-src 'self'") &&
    csp.includes("base-uri 'self'") &&
    csp.includes("frame-ancestors 'none'")
  );
}

export function ensureHardenedCspInFiles(input: Record<string, string>): { files: Record<string, string>; changed: boolean } {
  const raw = input["manifest.json"];
  if (!raw) return { files: input, changed: false };

  try {
    const manifest = JSON.parse(raw);
    if (hasHardenedExtensionCsp(manifest)) return { files: input, changed: false };

    manifest.content_security_policy = { extension_pages: HARDENED_EXTENSION_CSP };
    return {
      files: { ...input, "manifest.json": JSON.stringify(manifest, null, 2) },
      changed: true,
    };
  } catch {
    return { files: input, changed: false };
  }
}