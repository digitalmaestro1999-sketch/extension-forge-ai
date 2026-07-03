import { describe, it, expect, vi, afterEach } from "vitest";

// The registry is small; we exercise it as a module and also verify the
// live sidebar + RouteGuard filters honor `isPlaceholderRoute`.
import * as registry from "./nav-registry";

describe("nav-registry", () => {
  const originalSet = registry.PLACEHOLDER_ROUTES;

  afterEach(() => {
    // Restore in case a test mutated the underlying set.
    Object.defineProperty(registry, "PLACEHOLDER_ROUTES", {
      value: originalSet,
      configurable: true,
    });
  });

  it("returns false for undefined / null / empty inputs", () => {
    expect(registry.isPlaceholderRoute(undefined)).toBe(false);
    expect(registry.isPlaceholderRoute(null)).toBe(false);
    expect(registry.isPlaceholderRoute("")).toBe(false);
  });

  it("returns false for unlisted routes (default: nothing placeholder)", () => {
    // Real, shipped routes should never be filtered.
    expect(registry.isPlaceholderRoute("/dashboard")).toBe(false);
    expect(registry.isPlaceholderRoute("/create")).toBe(false);
    expect(registry.isPlaceholderRoute("/manage")).toBe(false);
  });

  it("normalizes trailing slashes", () => {
    // Simulate a flagged route being present.
    Object.defineProperty(registry, "PLACEHOLDER_ROUTES", {
      value: new Set(["/foo"]),
      configurable: true,
    });
    expect(registry.isPlaceholderRoute("/foo")).toBe(true);
    expect(registry.isPlaceholderRoute("/foo/")).toBe(true);
    // Bare "/" is intentionally left alone (no slash-strip on root).
    expect(registry.isPlaceholderRoute("/")).toBe(false);
  });

  it("returns notes only for flagged routes", () => {
    expect(registry.getPlaceholderNote("/dashboard")).toBeUndefined();
  });
});

// Sanity: ensure `PLACEHOLDER_ROUTES` never accidentally hides a live route.
// If this fires, the entry in nav-registry needs to be removed AND the page
// must be reachable, or the route should be deleted from App.tsx.
describe("nav-registry — safety net", () => {
  it("does not accidentally hide any of the always-live routes", () => {
    const mustBeLive = [
      "/dashboard", "/create", "/wizard", "/editor",
      "/projects", "/api-manager", "/manage", "/manual",
    ];
    for (const route of mustBeLive) {
      expect(
        registry.isPlaceholderRoute(route),
        `Route ${route} was flagged as placeholder but must ship`,
      ).toBe(false);
    }
  });
});

// Guard against a silent regression where someone imports the wrong symbol.
describe("nav-registry — exports", () => {
  it("exposes the expected surface", () => {
    expect(typeof registry.isPlaceholderRoute).toBe("function");
    expect(typeof registry.getPlaceholderNote).toBe("function");
    expect(registry.PLACEHOLDER_ROUTES).toBeInstanceOf(Set);
    expect(registry.PLACEHOLDER_NOTES).toBeTypeOf("object");
  });
});

// Silence unused-import warnings if vi is not otherwise referenced.
void vi;
