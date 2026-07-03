import { describe, it, expect } from "vitest";

import {
  isPlaceholderRoute,
  getPlaceholderNote,
  normalizePath,
  PLACEHOLDER_ROUTES,
  PLACEHOLDER_NOTES,
} from "./nav-registry";

describe("nav-registry", () => {
  it("returns false for undefined / null / empty inputs", () => {
    expect(isPlaceholderRoute(undefined)).toBe(false);
    expect(isPlaceholderRoute(null)).toBe(false);
    expect(isPlaceholderRoute("")).toBe(false);
  });

  it("returns false for unlisted routes (default: nothing placeholder)", () => {
    expect(isPlaceholderRoute("/dashboard")).toBe(false);
    expect(isPlaceholderRoute("/create")).toBe(false);
    expect(isPlaceholderRoute("/manage")).toBe(false);
  });

  it("normalizePath strips a single trailing slash but preserves root", () => {
    expect(normalizePath("/foo")).toBe("/foo");
    expect(normalizePath("/foo/")).toBe("/foo");
    expect(normalizePath("/a/b/")).toBe("/a/b");
    expect(normalizePath("/")).toBe("/");
  });

  it("returns notes only for flagged routes", () => {
    expect(getPlaceholderNote("/dashboard")).toBeUndefined();
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
        isPlaceholderRoute(route),
        `Route ${route} was flagged as placeholder but must ship`,
      ).toBe(false);
    }
  });
});

describe("nav-registry — exports", () => {
  it("exposes the expected surface", () => {
    expect(typeof isPlaceholderRoute).toBe("function");
    expect(typeof getPlaceholderNote).toBe("function");
    expect(PLACEHOLDER_ROUTES).toBeInstanceOf(Set);
    expect(PLACEHOLDER_NOTES).toBeTypeOf("object");
  });
});

// Silence unused-import warnings if vi is not otherwise referenced.
void vi;
