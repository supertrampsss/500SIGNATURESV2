import { defineConfig } from '@playwright/test';

const localChromium = process.env.MANDATS_CHROMIUM_EXECUTABLE;
const chromiumLaunchOptions = {
  ...(localChromium ? { executablePath: localChromium } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
};

/** Focused responsive gate for the shared public header. Build the site first. */
export default defineConfig({
  testDir: './tests',
  testMatch: ['header-navigation.test.mjs'],
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: process.env.CI ? 2 : 1,
  retries: process.env.CI ? 1 : 0,
  outputDir: './header-artifacts/results',
  reporter: [
    ['list'],
    ['html', { outputFolder: './header-artifacts/report', open: 'never' }],
    ['json', { outputFile: './header-artifacts/report.json' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4183',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'header-mobile-320', use: { browserName: 'chromium', launchOptions: chromiumLaunchOptions, viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } },
    { name: 'header-mobile-390', use: { browserName: 'chromium', launchOptions: chromiumLaunchOptions, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } },
    { name: 'header-desktop-1440', use: { browserName: 'chromium', launchOptions: chromiumLaunchOptions, viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4183 --strictPort',
    url: 'http://127.0.0.1:4183/accueil/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
