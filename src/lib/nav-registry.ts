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
