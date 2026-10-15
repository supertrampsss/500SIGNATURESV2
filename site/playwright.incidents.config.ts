import { defineConfig } from '@playwright/test';
import story from './playwright.story.config.ts';
export default defineConfig({
  ...story,
  testMatch: ['mandats-incidents.test.mjs'],
  timeout: 180_000,
  outputDir: './incidents-artifacts/results',
  reporter: [
    ['list'], ['html', { outputFolder: './incidents-artifacts/report', open: 'never' }],
    ['json', { outputFile: './incidents-artifacts/report.json' }],
  ],
});
