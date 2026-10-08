import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["mandats-rework.test.mjs"],
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  outputDir: "./rework-artifacts/results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "./rework-artifacts/report", open: "never" }],
    ["json", { outputFile: "./rework-artifacts/report.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4180",
    actionTimeout: 20_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.MANDATS_CHROMIUM_EXECUTABLE,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 960 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "compact",
      use: {
        viewport: { width: 320, height: 740 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "webkit",
      use: {
        browserName: "webkit",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        launchOptions: process.env.MANDATS_WEBKIT_EXECUTABLE
          ? { executablePath: process.env.MANDATS_WEBKIT_EXECUTABLE }
          : {},
      },
    },
  ],
  webServer: {
    command: "npx vite preview --host 127.0.0.1 --port 4180 --strictPort",
    url: "http://127.0.0.1:4180/mandats/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
