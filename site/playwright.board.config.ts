import { defineConfig, devices } from '@playwright/test';

/** Focused browser gate for the national v9 immersive board. The site must be built first. */
export default defineConfig({
  testDir: './tests',
  testMatch: ['mandats-board.test.mjs'],
  timeout: 90_000,
  expect: { timeout: 12_000 },
  fullyParallel: true,
  workers: 3,
  retries: process.env.CI ? 1 : 0,
  outputDir: 'board-audit-artifacts',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-board', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4182',
    colorScheme: 'light',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-board', use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } } },
    { name: 'mobile-board-390', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'mobile-board-320', use: { browserName: 'chromium', viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true } },
    { name: 'mobile-webkit-board', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4182 --strictPort',
    url: 'http://127.0.0.1:4182/mandats/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
