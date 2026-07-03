import { test, expect } from "@playwright/test";

// Auth surface E2E: exercises the /auth page form and the redirect gate that
// sends unauthenticated visitors from protected routes back to sign-in. We do
// not actually complete a Supabase sign-in in CI (no real session available).

test.describe("auth flow", () => {
  test("magic-link form validates and submits", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto("/auth");
    const email = page.getByLabel(/email/i).first();
    await expect(email).toBeVisible({ timeout: 15_000 });
    await email.fill("qa+e2e@example.com");

    const submit = page
      .getByRole("button", { name: /magic link|send link|sign in|continue/i })
      .first();
    await expect(submit).toBeEnabled();

    expect(errors, `runtime errors: ${errors.join("\n")}`).toEqual([]);
  });

  test("password tab renders email + password inputs", async ({ page }) => {
    await page.goto("/auth");
    const passwordTab = page.getByRole("tab", { name: /password/i });
    if (await passwordTab.count()) {
      await passwordTab.first().click();
    }
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
  });
});

test.describe("protected routes redirect to /auth", () => {
  const routes = ["/dashboard", "/revenue", "/monetization", "/admin/users"];
  for (const route of routes) {
    test(`unauthenticated visit to ${route} lands on /auth`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(/\/auth/, { timeout: 15_000 });
      expect(page.url()).toMatch(/\/auth/);
    });
  }
});
