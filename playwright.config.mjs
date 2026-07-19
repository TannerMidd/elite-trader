// Real-browser journeys live under tests/e2e and own their server lifecycle.
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.FRAMESHIFT_E2E_PORT || 8765);

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.js",
  outputDir: "test-results/playwright",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "list",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    },
  },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "America/Chicago",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: "webkit-tablet",
      grep: /@tablet/u,
      use: {
        ...devices["iPad Pro 11 landscape"],
      },
    },
  ],
});
