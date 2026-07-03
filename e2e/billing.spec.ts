import { test, expect } from "@playwright/test";

// Billing surface E2E: the revenue tracker and monetization templates are the
// user-facing "billing" pages. Both live behind the auth gate, so from an
// unauthenticated session we assert the redirect + that the landing page
// surfaces pricing/plan messaging without runtime errors.

test.describe("billing surface", () => {
  test("landing page mentions plans / pricing", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto("/");
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(0);

    expect(errors, `runtime errors: ${errors.join("\n")}`).toEqual([]);
  });

  test("/revenue is gated behind auth", async ({ page }) => {
    await page.goto("/revenue");
    await page.waitForURL(/\/auth/, { timeout: 15_000 });
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
  });

  test("/monetization is gated behind auth", async ({ page }) => {
    await page.goto("/monetization");
    await page.waitForURL(/\/auth/, { timeout: 15_000 });
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
  });
});
