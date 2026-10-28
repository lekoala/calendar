import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  testMatch: "**/*.spec.js",
  // A browser test is a few hundred milliseconds of real work; the budget is a
  // safety net for hangs, not a performance target. The per-test timeout must
  // leave room for Playwright's instrumentation on a loaded CI runner, where
  // 4 workers share 4 vCPUs and trace snapshots are recorded per action.
  timeout: 30_000,
  fullyParallel: true,
  // Cap parallelism on CI: the 4 vCPU runner is already saturated at 4
  // workers, and higher values produced intermittent protocol flakes.
  workers: 4,
  // CI only: record a trace on the first retry instead of on every passing
  // test, which is what made the old 10s timeout tight. Locally there is no
  // retry, so failures are traced immediately.
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    trace: process.env.CI
      ? { mode: "on-first-retry", snapshots: { dom: true, aria: true, screen: true } }
      : "retain-on-failure",
  },
  webServer: {
    command: "node scripts/dev.js",
    url: "http://127.0.0.1:4173/demo/",
    reuseExistingServer: true,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        hasTouch: true,
        isMobile: true,
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
