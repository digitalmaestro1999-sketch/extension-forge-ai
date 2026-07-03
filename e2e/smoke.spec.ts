import { test, expect } from "@playwright/test";

// Smoke E2E: verifies the built app boots and the public-facing routes render
// their key affordances. Anything auth-gated is covered by unit tests instead
// so CI doesn't need a Supabase session.

test.describe("public surface", () => {
  test("landing page renders and links to sign-in", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto("/");
    await expect(page).toHaveTitle(/.+/);
    // The landing page always shows at least one sign-in / get-started CTA.
    const cta = page.getByRole("link", { name: /sign in|get started|log in/i }).first();
    await expect(cta).toBeVisible({ timeout: 15_000 });

    expect(errors, `runtime errors: ${errors.join("\n")}`).toEqual([]);
  });

  test("/auth page loads without runtime errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    const response = await page.goto("/auth");
    expect(response?.status(), "auth page should return 2xx").toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();

    expect(errors, `runtime errors: ${errors.join("\n")}`).toEqual([]);
  });

  test("unknown route falls back gracefully (SPA)", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    // SPA fallback: index.html always resolves, then the router decides.
    await expect(page.locator("body")).toBeVisible();
  });
});
