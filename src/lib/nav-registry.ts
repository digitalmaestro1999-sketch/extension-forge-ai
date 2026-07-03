// Single source of truth for routes flagged as unfinished/placeholder.
// Any path listed here is:
//   1. Hidden from the sidebar (see `AppSidebar.tsx`).
//   2. Blocked by `RouteGuard`, which renders a "Coming soon" screen instead
//      of the underlying page, so deep-linked users don't hit dead UI.
//
// To flag a route as a work-in-progress:
//   - Add its exact path (as written in `App.tsx`) to `PLACEHOLDER_ROUTES`.
//   - Optionally add a friendly note in `PLACEHOLDER_NOTES` shown on the
//     coming-soon screen.
// To ship a route, delete the entry — no other files need to change.

/** Every route mounted under the authenticated shell in `App.tsx`.
 *  Kept in sync manually — the runtime validator below will scream in dev
 *  if `PLACEHOLDER_ROUTES` ever references a path that isn't in this list. */
export const KNOWN_ROUTES: ReadonlySet<string> = new Set<string>([
  "/dashboard", "/create", "/wizard", "/ai-builder", "/editor",
  "/templates", "/projects", "/api-manager", "/test", "/package",
  "/publish", "/portfolio", "/monetization", "/store-seo", "/settings",
  "/manual", "/manage", "/control", "/intelligence",
  "/trends", "/batch", "/revenue", "/admin/users",
]);

export const PLACEHOLDER_ROUTES: ReadonlySet<string> = new Set<string>([
  // e.g. "/experimental-analytics",
]);

export const PLACEHOLDER_NOTES: Readonly<Record<string, string>> = {
  // "/experimental-analytics": "Rolling out to superadmins first.",
};

/** Strip a single trailing slash so "/foo" and "/foo/" match the same entry.
 *  Exported so tests can verify the normalization behavior directly. */
export function normalizePath(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function isPlaceholderRoute(path: string | undefined | null): boolean {
  if (!path) return false;
  return PLACEHOLDER_ROUTES.has(normalizePath(path));
}

export function getPlaceholderNote(path: string): string | undefined {
  return PLACEHOLDER_NOTES[path];
}

export interface NavRegistryValidation {
  ok: boolean;
  unknownPlaceholders: string[];
  orphanNotes: string[];
}

/** Cross-checks that every flagged placeholder maps to a real route and
 *  every note points at a flagged placeholder. Pure — safe to call from
 *  tests and from a dev-mode boot hook. */
export function validateNavRegistry(
  known: ReadonlySet<string> = KNOWN_ROUTES,
  placeholders: ReadonlySet<string> = PLACEHOLDER_ROUTES,
  notes: Readonly<Record<string, string>> = PLACEHOLDER_NOTES,
): NavRegistryValidation {
  const unknownPlaceholders: string[] = [];
  for (const p of placeholders) {
    if (!known.has(normalizePath(p))) unknownPlaceholders.push(p);
  }
  const orphanNotes: string[] = [];
  for (const p of Object.keys(notes)) {
    if (!placeholders.has(normalizePath(p))) orphanNotes.push(p);
  }
  return {
    ok: unknownPlaceholders.length === 0 && orphanNotes.length === 0,
    unknownPlaceholders,
    orphanNotes,
  };
}

// Dev-mode runtime guard: log a loud warning if the registry drifts from the
// real router config. Runs once at module load. Silent in production builds.
if (typeof import.meta !== "undefined" && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
  const result = validateNavRegistry();
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.warn(
      "[nav-registry] drift detected — update KNOWN_ROUTES or fix the entry:",
      result,
    );
  }
}
