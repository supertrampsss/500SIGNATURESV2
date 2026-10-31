import { defineConfig, devices } from "@playwright/test";

// Navigateurs locaux facultatifs (bac à sable sans téléchargement de Playwright).
const chromium = process.env.PW_CHROMIUM_EXECUTABLE;
const webkit = process.env.PW_WEBKIT_EXECUTABLE;
const lancementChromium = { ...(chromium ? { executablePath: chromium } : {}), args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] };
const lancementWebkit = webkit ? { executablePath: webkit } : {};

/** Les parcours du site : le récit, Salaires et le consentement, le jeu Mandats. Cinq formats. */
export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: { baseURL: "http://127.0.0.1:4180", trace: "on-first-retry", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop-chromium", use: { browserName: "chromium", launchOptions: lancementChromium, viewport: { width: 1440, height: 900 } } },
    { name: "android-chromium", use: { ...devices["Pixel 5"], launchOptions: lancementChromium, viewport: { width: 390, height: 844 } } },
    { name: "compact-chromium", use: { browserName: "chromium", launchOptions: lancementChromium, viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } },
    { name: "iphone-webkit", use: { ...devices["iPhone 13"], launchOptions: lancementWebkit } },
    { name: "landscape-webkit", use: { ...devices["iPhone 13"], launchOptions: lancementWebkit, viewport: { width: 844, height: 390 } } },
  ],
  webServer: { command: "npm run test:serve", url: "http://127.0.0.1:4180/", reuseExistingServer: false, timeout: 120000 },
});
