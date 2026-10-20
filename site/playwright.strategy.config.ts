import { defineConfig } from '@playwright/test';
import presidency from './playwright.presidency.config.ts';

const phase = process.env.MANDATS_STRATEGY_PHASE ?? 'verified';

export default defineConfig({
  ...presidency,
  testMatch: ['mandats-strategy.test.mjs'],
  timeout: 150_000,
  workers: 1,
  outputDir: `./strategy-artifacts/${phase}/results`,
  reporter: [
    ['list'],
    ['html', { outputFolder: `./strategy-artifacts/${phase}/report`, open: 'never' }],
    ['json', { outputFile: `./strategy-artifacts/${phase}/report.json` }],
  ],
  use: { ...presidency.use, trace: 'retain-on-failure', video: 'on' },
});
