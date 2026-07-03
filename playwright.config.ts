import { defineConfig, devices } from "@playwright/test";

// Playwright E2E setup. Vitest still handles unit + integration tests under
// src/**/*.test.ts; Playwright specs live under e2e/ and boot a real vite
// preview server against a production build.

const PORT = Number(process.env.PORT ?? 4173);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Retry locally once too — flakes from cold module graph or Supabase
  // client bootstrapping shouldn't fail the whole run.
  retries: process.env.CI ? 2 : 1,
  // Cap parallelism so shared vite preview server doesn't get hammered.
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI
    ? [["github"], ["list"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  // Per-test cap; individual assertions get their own budget below.
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Every click/fill/etc. waits up to 15s for the element to be actionable
    // instead of Playwright's default (no cap) — turns hangs into fast fails.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // Auto-wait for network to settle after navigations so React has had a
    // tick to render before assertions run.
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `bunx vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
