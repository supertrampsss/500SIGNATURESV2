import { defineConfig, devices } from '@playwright/test';
const localChromium=process.env.MANDATS_CHROMIUM_EXECUTABLE;
const chromiumLaunchOptions={...(localChromium?{executablePath:localChromium}:{}),args:['--no-sandbox','--disable-dev-shm-usage']};

/** Focused browser gate for the national v9 immersive board. The site must be built first. */
export default defineConfig({
  testDir: './tests',
  testMatch: ['mandats-board.test.mjs', 'mandats-mobile.test.mjs', 'national-agenda.test.mjs', 'mandats-politics.test.mjs'],
  // Reuse the export/import and planning journeys for changes to session handling.
  grep: /default v9 board|one choice is one turn|reduced motion removes|fresh-device national|territory, sandbox|ten v9 national decisions|fresh national game defaults to v10|v10 saves the actual 577-seat tally|reduced motion presents the same saved vote outcome|an explicit v9 challenge|an early destitution save/,
  timeout: 90_000,
  expect: { timeout: 12_000 },
  fullyParallel: true,
  workers: 4,
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
    { name: 'desktop-board', use: { browserName: 'chromium', launchOptions: chromiumLaunchOptions, viewport: { width: 1280, height: 900 } } },
    { name: 'mobile-board-390', use: { browserName: 'chromium', launchOptions: chromiumLaunchOptions, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'mobile-board-320', use: { browserName: 'chromium', launchOptions: chromiumLaunchOptions, viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true } },
    { name: 'mobile-webkit-board', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4182 --strictPort',
    url: 'http://127.0.0.1:4182/mandats/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
