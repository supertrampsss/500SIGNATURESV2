import { defineConfig } from '@playwright/test';
import story from './playwright.story.config.ts';

export default defineConfig({
  ...story,
  testMatch: ['mandats-pressure.test.mjs'],
  timeout: 180_000,
  outputDir: './pressure-artifacts/results',
  reporter: [
    ['list'],
    ['html', { outputFolder: './pressure-artifacts/report', open: 'never' }],
    ['json', { outputFile: './pressure-artifacts/report.json' }],
  ],
});
