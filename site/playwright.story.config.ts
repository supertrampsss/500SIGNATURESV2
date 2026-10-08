import { defineConfig, devices } from '@playwright/test';

const localChromium = process.env.MANDATS_CHROMIUM_EXECUTABLE;
const webkitLaunchOptions = process.env.MANDATS_WEBKIT_EXECUTABLE ? { executablePath: process.env.MANDATS_WEBKIT_EXECUTABLE } : {};
const chromiumLaunchOptions = {
  ...(localChromium ? { executablePath: localChromium } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
};

export default defineConfig({
  testDir: './tests',
  testMatch: ['mandats-story.test.mjs'],
  timeout: 90_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: process.env.CI ? 2 : 1,
  retries: process.env.CI ? 1 : 0,
  outputDir: './story-artifacts/results',
  reporter: [
    ['list'],
    ['html', { outputFolder: './story-artifacts/report', open: 'never' }],
    ['json', { outputFile: './story-artifacts/report.json' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4180',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { browserName: 'chromium', launchOptions: chromiumLaunchOptions, viewport: { width: 1365, height: 900 } } },
    { name: 'android-chromium', use: { browserName: 'chromium', launchOptions: chromiumLaunchOptions, ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
    { name: 'compact-chromium', use: { browserName: 'chromium', launchOptions: chromiumLaunchOptions, viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'], launchOptions: webkitLaunchOptions, viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4180 --strictPort',
    url: 'http://127.0.0.1:4180/mandats/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
