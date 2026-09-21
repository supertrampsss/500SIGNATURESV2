import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['visual-audit.test.mjs'],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  outputDir: 'visual-audit-artifacts/results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'visual-audit-artifacts/report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4181',
    colorScheme: 'light',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'desktop-1440',
      use: {
        browserName: 'chromium',
        viewport: { width: 1440, height: 1100 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'mobile-390',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4181 --strictPort',
    url: 'http://127.0.0.1:4181/accueil/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
